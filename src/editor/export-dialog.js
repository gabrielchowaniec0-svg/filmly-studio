// Export MP4 dialog: presets, advanced settings, a voice check and progress.
import { openModal, esc, prefs } from './ui.js';
import { icon } from './icons.js';
import { PROVIDERS } from '../tts/catalog.js';

const PRESETS = [
  { id: 'youtube', label: 'YouTube 1080p', sub: 'Full HD · high quality', set: { res: '1920', fps: '0', quality: 'high', codec: 'auto', range: 'full' } },
  { id: '4k', label: '4K UHD', sub: '3840×2160 · slower to render', set: { res: '3840', fps: '0', quality: 'high', codec: 'auto', range: 'full' } },
  { id: 'test', label: 'Quick test', sub: '720p · first 5 seconds', set: { res: '1280', fps: '0', quality: 'draft', codec: 'auto', range: '5' } },
  { id: 'shorts', label: 'Shorts / vertical', sub: 'Not supported yet — films are 16:9 for now', disabled: true },
];

export function openExportDialog(app, { startExport }) {
  let running = false;
  const film = app.film;
  const saved = prefs.get('export', PRESETS[0].set);
  const body = document.createElement('div');
  body.className = 'exportBody';
  body.innerHTML = `
    <div class="presets">${PRESETS.map((p) => `<button type="button" class="preset" data-preset="${p.id}" ${p.disabled ? 'disabled' : ''}>${icon(p.id === 'shorts' ? 'image' : p.id === 'test' ? 'bolt' : 'film', 18)}<b>${esc(p.label)}</b><small>${esc(p.sub)}</small></button>`).join('')}</div>
    <div class="voiceCheck" id="voiceCheck"></div>
    <details class="advanced" ${prefs.get('export.adv', false) ? 'open' : ''}>
      <summary>Advanced settings</summary>
      <div class="advGrid">
        <label class="field"><span>Resolution</span><select id="expRes">
          <option value="1280">720p · 1280×720</option><option value="1920">1080p · 1920×1080</option><option value="2560">1440p · 2560×1440</option>
          <option value="3840">4K · 3840×2160</option><option value="7680">8K · 7680×4320</option></select></label>
        <label class="field"><span>Frame rate</span><select id="expFps"><option value="0">As written in the film (${film?.meta.fps || 30} fps)</option><option>24</option><option>30</option><option>60</option><option>120</option><option>240</option></select></label>
        <label class="field"><span>Quality</span><select id="expQuality"><option value="draft">Draft (small file)</option><option value="high">High</option><option value="max">Maximum (large file)</option></select></label>
        <label class="field"><span>Video codec</span><select id="expCodec"><option value="auto">Automatic</option><option value="avc">H.264 (plays everywhere)</option><option value="hevc">HEVC / H.265 (smaller)</option></select></label>
        <label class="field"><span>Length</span><select id="expRange"><option value="full">Whole film (${film ? film.duration.toFixed(1) : 0} s)</option><option value="5">First 5 seconds (test)</option></select></label>
      </div>
    </details>
    <div class="progress" id="expProgress" hidden><div class="bar"><div id="expBar"></div></div></div>
    <div id="expStatus" class="expStatus"></div>`;
  const m = openModal({ title: 'Export video', sub: `“${esc(film?.meta.title || 'Untitled')}” · ${film ? film.duration.toFixed(1) : 0} s · MP4 with sound, rendered frame by frame in your browser`, body, width: 720, cls: 'exportModal', canClose: () => !running });
  const dlg = m.el;
  const foot = document.createElement('footer');
  foot.className = 'modalFoot';
  foot.innerHTML = `<span class="small dim" id="expEstimate"></span><span class="spacer"></span><button id="btnCancel" hidden>Cancel export</button><button data-close id="btnCloseExp">Close</button><button class="primary" id="btnExport">${icon('download', 15)} Export MP4</button>`;
  dlg.appendChild(foot);

  const $d = (id) => dlg.querySelector('#' + id);
  const fields = { res: $d('expRes'), fps: $d('expFps'), quality: $d('expQuality'), codec: $d('expCodec'), range: $d('expRange') };
  const apply = (set) => { for (const [k, v] of Object.entries(set)) if (fields[k]) fields[k].value = v; sync(); };
  const current = () => Object.fromEntries(Object.entries(fields).map(([k, el]) => [k, el.value]));
  function sync() {
    const c = current();
    dlg.querySelectorAll('.preset').forEach((b) => { const p = PRESETS.find((x) => x.id === b.dataset.preset); b.classList.toggle('on', !!p.set && Object.entries(p.set).every(([k, v]) => c[k] === v)); });
    const fps = +c.fps || film?.meta.fps || 30;
    const secs = c.range === 'full' ? film?.duration || 0 : Math.min(5, film?.duration || 0);
    $d('expEstimate').textContent = `${Math.round(secs * fps)} frames · ${c.res === '7680' ? '8K' : c.res === '3840' ? '4K' : c.res === '2560' ? '1440p' : c.res === '1920' ? '1080p' : '720p'} @ ${fps} fps`;
    prefs.set('export', c);
  }
  apply(saved);
  dlg.querySelector('.presets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b && !b.disabled) apply(PRESETS.find((p) => p.id === b.dataset.preset).set); });
  Object.values(fields).forEach((el) => el.addEventListener('change', sync));
  dlg.querySelector('.advanced').addEventListener('toggle', (e) => prefs.set('export.adv', e.target.open));

  function renderVoices() {
    const v = app.voiceSummary();
    const el = $d('voiceCheck');
    const engines = Object.entries(v.byEngine).map(([e, n]) => `${esc(PROVIDERS[e]?.label.split(' (')[0] || e)} (${n})`).join(', ');
    if (!v.total) { el.innerHTML = `<div class="note">${icon('info', 16)}<div><b>No dialogue</b><p>Your film has no spoken lines, so the video will only have music and sound effects (if any).</p></div></div>`; return; }
    if (v.browser) {
      el.innerHTML = `<div class="note warn">${icon('alert', 16)}<div><b>${v.browser} line${v.browser > 1 ? 's use' : ' uses'} browser voices — ${v.browser === v.total ? 'the video will be silent' : 'those lines will be silent'}</b>
        <p>Browser voices are great for previewing, but browsers don't let pages record them. Switch to Kokoro (free, runs in your browser) to hear them in the MP4.</p>
        <button class="sm primary" data-act="kokoro">${icon('wand', 13)} Switch voices to Kokoro…</button></div></div>`;
    } else {
      el.innerHTML = `<div class="note ok">${icon('check', 16)}<div><b>Voices: ${engines}</b><p>${v.pending ? `${v.pending} line${v.pending > 1 ? 's' : ''} will be generated before rendering (cached for next time).` : 'All voice audio is ready and will be included.'}</p></div></div>`;
    }
  }
  $d('voiceCheck').addEventListener('click', async (e) => {
    if (e.target.closest('[data-act=kokoro]')) { await app.switchToKokoro(); if (dlg.isConnected) { if (!dlg.open) dlg.showModal(); renderVoices(); } }
  });
  renderVoices();

  const status = $d('expStatus');
  const ui = {
    status: (s) => { status.innerHTML = `<p class="small">${esc(s)}</p>`; },
    progress: (p) => { $d('expBar').style.width = `${Math.round(p * 100)}%`; },
    done: (url, name, info, warnings) => {
      running = false;
      $d('expBar').style.width = '100%';
      status.innerHTML = `<div class="doneBox"><video src="${url}" controls playsinline></video><div><b>${icon('check', 15)} Your video is ready</b>
        <p class="small">${info.width}×${info.height} · ${info.fps} fps · ${(info.bytes / 1048576).toFixed(1)} MB · ${esc(info.codec)} (${info.hardware ? 'hardware' : 'software'}) · audio: ${esc(info.audio || 'none')} · ${info.elapsed.toFixed(1)} s</p>
        <a class="button primary" id="expDownload" href="${url}" download="${esc(name)}">${icon('download', 15)} Download ${esc(name)}</a>
        ${warnings.length ? `<ul class="warns">${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}</div></div>`;
      finish();
    },
    failed: (msg) => { running = false; status.innerHTML = `<div class="note bad">${icon('alert', 16)}<div><b>Export stopped</b><p>${esc(msg)}</p></div></div>`; finish(); },
  };
  function finish() { $d('btnExport').disabled = false; $d('btnCancel').hidden = true; $d('btnCloseExp').hidden = false; }
  $d('btnExport').addEventListener('click', () => {
    if (running) return;
    const c = current();
    running = true;
    $d('btnExport').disabled = true;
    $d('btnCancel').hidden = false;
    $d('btnCloseExp').hidden = true;
    $d('expProgress').hidden = false;
    $d('expBar').style.width = '0%';
    ui.status('Starting…');
    startExport({ width: +c.res, fps: +c.fps || 0, quality: c.quality, codec: c.codec, range: c.range === 'full' ? null : [0, +c.range] }, ui);
  });
  $d('btnCancel').addEventListener('click', () => app.cancelExport());
  return m;
}
