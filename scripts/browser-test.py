"""Headless-Chrome end-to-end test.
   python3 scripts/browser-test.py [outdir]      (needs: python3 playwright + google-chrome, ffmpeg)
   - loads the editor, compiles the demo, screenshots frames
   - opens Voice Lab + Character Creator
   - generates TTS through a mock OpenAI-compatible server, checks lip-sync timing uses the real audio length
   - exports MP4s and verifies them with ffprobe (video frames + non-silent audio)"""
import sys, os, json, base64, subprocess, time, math, struct, threading, io, wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/filmly-bt'
os.makedirs(out, exist_ok=True)
MOCK_SECONDS = 1.7
calls = []

def mock_wav():
    sr = 24000; n = int(sr * MOCK_SECONDS)
    buf = io.BytesIO(); w = wave.open(buf, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    frames = bytearray()
    for i in range(n):
        t = i / sr
        on = (t % 0.23) < 0.15 and t < MOCK_SECONDS - 0.2
        v = 0.5 * math.sin(2 * math.pi * 220 * t) if on else 0.0
        frames += struct.pack('<h', int(v * 32767))
    w.writeframes(bytes(frames)); w.close()
    return buf.getvalue()
WAV = mock_wav()

class Mock(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        calls.append(body)
        self.send_response(200); self.cors(); self.send_header('Content-Type', 'audio/wav'); self.send_header('Content-Length', str(len(WAV))); self.end_headers()
        self.wfile.write(WAV)

mock = ThreadingHTTPServer(('127.0.0.1', 5197), Mock)
threading.Thread(target=mock.serve_forever, daemon=True).start()
srv = subprocess.Popen(['node', 'scripts/serve.mjs', '5199'], stdout=subprocess.DEVNULL)
time.sleep(1)
errors = []

def probe(path):
    j = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-of', 'json', path]))
    vol = subprocess.run(['ffmpeg', '-i', path, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], capture_output=True, text=True).stderr
    mean = [l for l in vol.splitlines() if 'mean_volume' in l]
    return {s['codec_type']: (s['codec_name'], s.get('nb_read_frames'), s.get('width'), s.get('height')) for s in j['streams']}, (mean[0].split(':')[-1].strip() if mean else 'n/a')

def export(pg, name, res='1280', rng='5'):
    pg.select_option('#expRes', res); pg.select_option('#expRange', rng)
    pg.click('#btnExport')
    pg.wait_for_function("document.querySelector('#expStatus a') || /failed|cancel/i.test(document.getElementById('expStatus').textContent)", timeout=240000)
    print(f'[{name}] status:', pg.inner_text('#expStatus').replace('\n', ' | '))
    a = pg.query_selector('#expStatus a')
    if not a: return None
    b64 = pg.evaluate("""async (u) => { const r = await fetch(u); const buf = new Uint8Array(await r.arrayBuffer()); let s=''; for (let i=0;i<buf.length;i+=32768) s+=String.fromCharCode.apply(null, buf.subarray(i,i+32768)); return btoa(s); }""", a.get_attribute('href'))
    path = f'{out}/{name}.mp4'
    open(path, 'wb').write(base64.b64decode(b64))
    print(f'[{name}] ffprobe:', *probe(path))
    return path

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(viewport={'width': 1500, 'height': 940})
        pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' and 'favicon' not in m.text and '404' not in m.text else None)
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.goto('http://localhost:5199/')
        pg.evaluate("localStorage.clear()")
        pg.reload()
        pg.wait_for_selector('#problems .problem')
        print('problems:', pg.inner_text('#problems')[:300].replace('\n', ' | '))
        pg.screenshot(path=f'{out}/editor.png')
        for name, t in [('f_02', 2600), ('f_09', 9000), ('f_16', 16500), ('f_31', 31000), ('f_44', 44500)]:
            pg.evaluate(f"(()=>{{const s=document.getElementById('scrub'); s.value={t}; s.dispatchEvent(new Event('input'));}})()")
            pg.wait_for_timeout(150)
            data = pg.evaluate("document.getElementById('preview').toDataURL('image/png')")
            open(f'{out}/{name}.png', 'wb').write(base64.b64decode(data.split(',')[1]))
        export(pg, 'demo')

        pg.click('#btnLab'); pg.wait_for_selector('dialog#voiceLab[open]')
        pg.click('dialog#voiceLab [data-engine=openai]'); pg.wait_for_timeout(200)
        pg.screenshot(path=f'{out}/voicelab.png')
        pg.click('dialog#voiceLab [data-act=close]')
        pg.click('#btnCreator'); pg.wait_for_selector('dialog#creator[open]')
        pg.click('dialog#creator [data-act=random]'); pg.wait_for_timeout(400)
        pg.screenshot(path=f'{out}/creator.png')
        pg.click('dialog#creator [data-act=insert]'); pg.wait_for_timeout(200)
        print('creator inserted:', pg.evaluate("document.getElementById('editor').value.split('\\n').find(l => l.startsWith('character my_'))"))

        # --- TTS end to end through the mock server ---
        pg.evaluate("""localStorage.setItem('filmly.tts.settings.v1', JSON.stringify({providers:{custom:{baseUrl:'http://127.0.0.1:5197/v1'}}, proxy:{}}))""")
        script = 'film "TTS" 1920x1080 @30\\nvoice nar = custom:af_heart speed=1.1\\nscene s bg=studio {\\n  cast a: nora at 40\\n  cast b: leo at 70\\n  a: "Generated speech drives the mouth." voice=nar\\n  b: "And the timing too." voice=custom:am_michael\\n  a: "Blips still work." \\n}\\n'
        pg.evaluate("(s)=>{const e=document.getElementById('editor'); e.value=s; e.dispatchEvent(new Event('input'));}", script.replace('\\n', '\n'))
        pg.wait_for_timeout(400)
        print('before:', pg.inner_text('#voiceStatus'))
        pg.click('#btnVoices')
        pg.wait_for_function("/ready|failed|⚠/.test(document.getElementById('voiceStatus').textContent)", timeout=60000)
        print('after:', pg.inner_text('#voiceStatus'), '| mock calls:', len(calls), calls[0] if calls else None)
        durs = pg.evaluate("""async () => { const { compileSource } = await import('/src/filmscript/index.js'); const { lineInfo } = await import('/src/tts/index.js'); const { loadAssets } = await import('/src/assets/loader.js');
            const A = await loadAssets('/'); const r = compileSource(document.getElementById('editor').value, A, { lineAudio: lineInfo });
            return r.film.scenes[0].events.filter(e => e.type === 'say').map(e => [e.voice.engine, +e.dur.toFixed(2), !!e.env]); }""")
        print('say durations (engine, seconds, has envelope):', durs)
        pg.evaluate("(()=>{const s=document.getElementById('scrub'); s.value=900; s.dispatchEvent(new Event('input'));})()")
        pg.wait_for_timeout(150)
        open(f'{out}/tts_frame.png', 'wb').write(base64.b64decode(pg.evaluate("document.getElementById('preview').toDataURL('image/png')").split(',')[1]))
        export(pg, 'tts', '1280', 'full')
        b.close()
finally:
    srv.terminate(); mock.shutdown()
print('console errors:', errors or 'none')
