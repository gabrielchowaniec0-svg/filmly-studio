"""Headless-Chrome smoke test: loads the editor, checks for errors, screenshots frames, runs a real MP4 export.
   python3 scripts/browser-test.py [outdir]     (needs: python3 playwright + google-chrome)"""
import sys, os, json, base64, subprocess, time
from playwright.sync_api import sync_playwright

out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/filmly-bt'
os.makedirs(out, exist_ok=True)
srv = subprocess.Popen(['node', 'scripts/serve.mjs', '5199'], stdout=subprocess.DEVNULL)
time.sleep(1)
errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox', '--enable-features=VaapiVideoEncoder', '--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(viewport={'width': 1500, 'height': 900})
        pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error',) else None)
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.goto('http://localhost:5199/')
        pg.wait_for_selector('#problems .problem')
        print('problems:', pg.inner_text('#problems')[:200].replace('\n', ' | '))
        pg.evaluate("localStorage.clear()")
        pg.screenshot(path=f'{out}/editor.png')
        # scrub to a few moments and capture the canvas
        for name, t in [('t3', 3000), ('t9', 9000), ('t30', 30000)]:
            pg.evaluate(f"(()=>{{const s=document.getElementById('scrub'); s.value={t}; s.dispatchEvent(new Event('input'));}})()")
            pg.wait_for_timeout(250)
            data = pg.evaluate("document.getElementById('preview').toDataURL('image/png')")
            open(f'{out}/{name}.png', 'wb').write(base64.b64decode(data.split(',')[1]))
        caps = pg.evaluate("""async () => ({
          VideoEncoder: typeof VideoEncoder, AudioEncoder: typeof AudioEncoder, OffscreenCanvas: typeof OffscreenCanvas,
          avc: (await VideoEncoder.isConfigSupported({codec:'avc1.640028',width:1920,height:1080,bitrate:8e6,framerate:30,avc:{format:'avc'}})).supported,
          avcHW: (await VideoEncoder.isConfigSupported({codec:'avc1.640028',width:1920,height:1080,bitrate:8e6,framerate:30,hardwareAcceleration:'prefer-hardware',avc:{format:'avc'}})).supported,
          aac: (await AudioEncoder.isConfigSupported({codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,bitrate:192000})).supported,
          opus: (await AudioEncoder.isConfigSupported({codec:'opus',sampleRate:48000,numberOfChannels:2,bitrate:128000})).supported,
        })""")
        print('caps:', caps)
        # real export through the UI (worker): 720p, first 5 seconds
        pg.select_option('#expRes', '1280')
        pg.select_option('#expRange', '5')
        pg.click('#btnExport')
        pg.wait_for_function("document.querySelector('#expStatus a') || /failed|cancel/i.test(document.getElementById('expStatus').textContent)", timeout=180000)
        print('status:', pg.inner_text('#expStatus').replace('\n', ' | '))
        href = pg.get_attribute('#expStatus a', 'href') if pg.query_selector('#expStatus a') else None
        if href:
            b64 = pg.evaluate("""async (u) => { const r = await fetch(u); const buf = new Uint8Array(await r.arrayBuffer()); let s=''; for (let i=0;i<buf.length;i+=32768) s+=String.fromCharCode.apply(null, buf.subarray(i,i+32768)); return btoa(s); }""", href)
            open(f'{out}/export.mp4', 'wb').write(base64.b64decode(b64))
            print('wrote', f'{out}/export.mp4', os.path.getsize(f'{out}/export.mp4'), 'bytes')
        b.close()
finally:
    srv.terminate()
print('console errors:', errors or 'none')
