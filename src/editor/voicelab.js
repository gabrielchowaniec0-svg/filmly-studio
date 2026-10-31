// Voice Lab: configure TTS providers, browse voices, audition lines, insert voices into the script.
import { PROVIDERS, PROVIDER_IDS } from '../tts/catalog.js';
import { loadSettings, saveSettings, providerConfig, isConfigured, synthesize, listVoices, browserVoices, speakBrowser, stopBrowserSpeech, clearCache } from '../tts/index.js';
import { buildTalk } from '../engine/lipsync.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let audioCtx = null;
let current = null; // playing source

async function playBytes(bytes) {
  audioCtx = audioCtx || new AudioContext();
  await audioCtx.resume();
  const buf = await audioCtx.decodeAudioData(bytes.slice(0));
  stopAll();
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start();
  current = src;
  return buf.duration;
}
function stopAll() {
  try { current && current.stop(); } catch { /* already stopped */ }
  current = null;
  stopBrowserSpeech();
}

/**
 * Open the Voice Lab. host: { insert(text, mode), onSaved(), assets }
 */
export function openVoiceLab(host) {
  let dlg = document.getElementById('voiceLab');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'voiceLab';
    dlg.className = 'lab';
    document.body.appendChild(dlg);
  }
  const settings = loadSettings();
  const state = { engine: state0(), voices: {}, sample: 'Hi! I just got here. Did I miss anything exciting?' };
  function state0() { return PROVIDER_IDS.find((id) => PROVIDERS[id].kind === 'cloud' && isConfigured(id, settings)) || 'webspeech'; }

  const render = () => {
    const meta = PROVIDERS[state.engine];
    const cfg = providerConfig(state.engine, settings);
    const voices = state.voices[state.engine] || (state.engine === 'webspeech' ? browserVoices() : meta.voices);
    const sel = state.sel?.[state.engine] || voices[0]?.id || '';
    const params = state.params?.[state.engine] || {};
    dlg.innerHTML = `
      <div class="labHead"><b>🎙 Voice Lab</b><span class="small">Keys stay in this browser only. ${PROVIDER_IDS.length} engines.</span><span class="spacer"></span>
        <button data-act="clear" title="Delete generated audio stored in this browser">Clear voice cache</button><button data-act="close">Close</button></div>
      <div class="labBody">
        <nav class="labList">${PROVIDER_IDS.map((id) => {
          const p = PROVIDERS[id];
          const ok = p.fields.filter((f) => f.secret).length === 0 || isConfigured(id, settings);
          return `<button class="${id === state.engine ? 'on' : ''}" data-engine="${id}"><span class="dot ${ok ? 'ok' : ''}"></span>${esc(p.label)}${p.exportable ? '' : ' <i>(preview)</i>'}</button>`;
        }).join('')}</nav>
        <section class="labMain">
          <h3>${esc(meta.label)}</h3>
          <p class="small">${esc(meta.blurb)} ${meta.site ? `<a href="${meta.site}" target="_blank" rel="noopener">Get a key ↗</a>` : ''}</p>
          ${meta.fields.length ? `<div class="labGrid">${meta.fields.map((f) => `<label>${esc(f.label)}${f.options
            ? `<select data-field="${f.key}">${f.options.map((o) => `<option ${o === cfg[f.key] ? 'selected' : ''}>${o}</option>`).join('')}</select>`
            : `<input data-field="${f.key}" type="${f.secret ? 'password' : 'text'}" value="${esc(cfg[f.key] || '')}" placeholder="${esc(f.placeholder || f.default || '')}" autocomplete="off">`}</label>`).join('')}</div>` : ''}
          ${meta.kind === 'cloud' && state.engine !== 'custom' ? `<label class="check"><input type="checkbox" data-act="proxy" ${settings.proxy?.[state.engine] ? 'checked' : ''}> Route through site proxy (use if you see "network error" — needs the Netlify deploy)</label>` : ''}
          <div class="labGrid">
            <label>Voice ${voices.length ? `<select data-act="voice">${voices.map((v) => `<option value="${esc(v.id)}" ${v.id === sel ? 'selected' : ''}>${esc(v.name)}${v.info ? ' — ' + esc(v.info) : ''}</option>`).join('')}</select>` : ''}
              <input data-act="voiceText" placeholder="or paste a voice id" value="${esc(voices.some((v) => v.id === sel) ? '' : sel)}"></label>
            ${meta.listVoices ? `<div class="go"><button data-act="load">Load my voices</button></div>` : ''}
            ${meta.params.map((p) => `<label>${esc(p.label)}${p.options
              ? `<select data-param="${p.key}">${p.options.map((o) => `<option ${o === (params[p.key] ?? p.default) ? 'selected' : ''}>${o}</option>`).join('')}</select>`
              : `<input data-param="${p.key}" value="${esc(params[p.key] ?? p.default ?? '')}">`}</label>`).join('')}
          </div>
          <label class="full">Test line <input data-act="sample" value="${esc(state.sample)}"></label>
          <div class="row">
            <button class="primary" data-act="test">▶ Test voice</button><button data-act="stop">■</button>
            <span class="spacer"></span>
            <input data-act="name" placeholder="name (e.g. narrator)" value="${esc(state.name || '')}" style="width:150px">
            <button data-act="define" title="Adds: voice <name> = ${state.engine}:… at the top of your script">Add as named voice</button>
            <button data-act="inline" title="Inserts voice=${state.engine}:… at the cursor">Insert voice= at cursor</button>
          </div>
          <div class="labStatus mono small" id="labStatus">${esc(state.status || '')}</div>
        </section>
      </div>`;
  };

  const spec = () => {
    const meta = PROVIDERS[state.engine];
    const voices = state.voices[state.engine] || meta.voices;
    const typed = dlg.querySelector('[data-act=voiceText]')?.value.trim();
    const v = typed || state.sel?.[state.engine] || voices[0]?.id || 'default';
    const params = {};
    for (const p of meta.params) {
      const raw = state.params?.[state.engine]?.[p.key];
      if (raw === undefined || raw === '' || String(raw) === String(p.default ?? '')) continue;
      params[p.key] = typeof p.default === 'number' && !Number.isNaN(+raw) ? +raw : raw;
    }
    return { engine: state.engine, voice: v, ...params };
  };
  const fmtProps = (v) => Object.entries(v).filter(([k]) => k !== 'engine' && k !== 'voice').map(([k, x]) => (typeof x === 'number' ? `${k}=${x}` : `${k}="${String(x).replace(/"/g, "'")}"`)).join(' ');
  const needsQuote = (s) => !/^[A-Za-z0-9_][A-Za-z0-9_.\-]*$/.test(s);
  const specText = (v) => (needsQuote(v.voice) ? `"${v.engine}:${v.voice}"` : `${v.engine}:${v.voice}`);
  const setStatus = (s) => { state.status = s; const el = dlg.querySelector('#labStatus'); if (el) el.textContent = s; };

  dlg.onclick = async (e) => {
    const b = e.target.closest('[data-engine],[data-act]');
    if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
    if (b.dataset.engine) { state.engine = b.dataset.engine; state.status = ''; render(); return; }
    const act = b.dataset.act;
    if (act === 'close') { stopAll(); dlg.close(); host.onSaved && host.onSaved(); }
    else if (act === 'stop') stopAll();
    else if (act === 'clear') { await clearCache(); setStatus('Voice cache cleared. Lines will be generated again when needed.'); host.onSaved && host.onSaved(); }
    else if (act === 'load') {
      setStatus('Loading voices…');
      try { state.voices[state.engine] = await listVoices(state.engine, settings); render(); setStatus(`Loaded ${state.voices[state.engine].length} voices.`); } catch (err) { setStatus('⚠ ' + err.message); }
    } else if (act === 'test') {
      const v = spec();
      const text = state.sample;
      setStatus('Generating…');
      try {
        if (v.engine === 'webspeech') { speakBrowser(text, v); setStatus('Speaking with your browser (preview only — not included in MP4 exports).'); }
        else {
          const t0 = performance.now();
          const bytes = await synthesize(v, text, { settings, onProgress: (p) => setStatus(`Downloading model… ${Math.round(p.progress || 0)}% (${p.file || ''})`) });
          const d = await playBytes(bytes);
          setStatus(`✓ ${(bytes.byteLength / 1024).toFixed(0)} KB, ${d.toFixed(2)} s of audio in ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
        }
      } catch (err) { setStatus('⚠ ' + (err.message || err)); }
    } else if (act === 'define') {
      const v = spec();
      const name = (dlg.querySelector('[data-act=name]').value.trim() || 'voice1').replace(/[^A-Za-z0-9_]/g, '_');
      state.name = name;
      host.insert(`voice ${name} = ${specText(v)}${fmtProps(v) ? ' ' + fmtProps(v) : ''}\n`, 'top');
      setStatus(`Added "voice ${name}". Use it with: someone: "Hello" voice=${name}  (or character … voice=${name})`);
    } else if (act === 'inline') {
      const v = spec();
      if (fmtProps(v)) { setStatus('This voice has options; use "Add as named voice" so they are kept.'); return; }
      host.insert(` voice=${specText(v)}`, 'inline');
      setStatus('Inserted at the cursor.');
    }
  };
  dlg.onchange = (e) => {
    const t = e.target;
    if (t.dataset.field) {
      settings.providers[state.engine] = { ...(settings.providers[state.engine] || {}), [t.dataset.field]: t.value.trim() };
      saveSettings(settings);
      render();
    } else if (t.dataset.act === 'proxy') {
      settings.proxy = { ...(settings.proxy || {}), [state.engine]: t.checked };
      saveSettings(settings);
    } else if (t.dataset.act === 'voice') {
      state.sel = { ...(state.sel || {}), [state.engine]: t.value };
      const txt = dlg.querySelector('[data-act=voiceText]');
      if (txt) txt.value = '';
    } else if (t.dataset.param) {
      state.params = { ...(state.params || {}), [state.engine]: { ...(state.params?.[state.engine] || {}), [t.dataset.param]: t.value } };
    } else if (t.dataset.act === 'sample') state.sample = t.value;
  };
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = () => state.engine === 'webspeech' && render();
  render();
  if (!dlg.open) dlg.showModal();
}
