// Filmly Studio editor shell.
import { loadAssets, renderAssets } from './assets/loader.js';
import { compileSource } from './filmscript/index.js';
import { renderFrame } from './engine/renderer.js';
import { STAGE_W, STAGE_H, frameCount } from './engine/timeline.js';
import { mixAudio } from './engine/audio.js';
import { TRANSITIONS } from './assets/transitions/index.js';
import { drawCharacterThumb, drawSceneThumb } from './editor/thumbs.js';
import { exportFilm } from './export/exporter.js';
import { lineInfo, lineBytes, generateLines, speakBrowser, stopBrowserSpeech } from './tts/index.js';
import { needsAudio, PROVIDERS } from './tts/catalog.js';
import { openVoiceLab } from './editor/voicelab.js';
import { openCreator } from './editor/creator.js';

const $ = (id) => document.getElementById(id);
const els = {
  editor: $('editor'), gutter: $('gutter'), problems: $('problems'), canvas: $('preview'), play: $('btnPlay'), scrub: $('scrub'), time: $('timeLabel'),
  tabs: $('assetTabs'), list: $('assetList'), filmSelect: $('filmSelect'),
  expBar: $('expBar'), expStatus: $('expStatus'), btnExport: $('btnExport'), btnCancel: $('btnCancel'),
};
const state = { assets: null, film: null, lines: [], errors: [], t: 0, speechTimers: [], playing: false, tab: 'characters', audioMix: null, audioKey: '', audioCtx: null, audioSrc: null, startedAt: 0, startT: 0 };
const KEY = 'filmly.script.v1';

// ---- boot ------------------------------------------------------------------------------------
init().catch((e) => { document.body.insertAdjacentHTML('afterbegin', `<pre style="color:#ff6b6b;padding:16px">Failed to start: ${e.message}</pre>`); console.error(e); });

async function init() {
  state.assets = await loadAssets('./');
  buildTabs();
  showTab('characters');
  els.filmSelect.innerHTML = '<option value="">Open a film…</option>' + state.assets.manifest.films.map((p) => `<option value="${p}">${p.replace('films/', '')}</option>`).join('');
  const saved = localStorage.getItem(KEY);
  if (saved) els.editor.value = saved;
  else if (state.assets.manifest.films[0]) els.editor.value = await (await fetch(state.assets.manifest.films[0])).text();
  else els.editor.value = NEW_FILM;
  bind();
  recompile();
  frame();
}

const NEW_FILM = `film "Untitled" 1920x1080 @30

scene one bg=studio {
  cast mira: mira at 40
  mira: "Hello!"
}
`;

// ---- compile + problems ----------------------------------------------------------------------
let compileTimer = 0;
function recompile() {
  const src = els.editor.value;
  try { localStorage.setItem(KEY, src); } catch { /* storage may be blocked */ }
  const t0 = performance.now();
  const r = compileSource(src, state.assets, { lineAudio: lineInfo });
  state.lines = r.lines || [];
  state.errors = [...r.errors, ...r.warnings];
  if (r.film) {
    state.film = r.film;
    els.scrub.max = String(Math.round(r.film.duration * 1000));
    state.t = Math.min(state.t, r.film.duration);
    state.audioKey = '';
  }
  drawProblems(r, performance.now() - t0);
  updateGutter();
  updateVoiceStatus();
  draw();
}

// ---- voices ----------------------------------------------------------------------------------
const pendingLines = () => state.lines.filter((l) => needsAudio(l.voice) && !lineInfo(l.voice, l.text));
function updateVoiceStatus(msg) {
  const el = $('voiceStatus');
  if (!el) return;
  if (msg) { el.textContent = msg; return; }
  const engines = [...new Set(state.lines.map((l) => l.voice.engine))];
  const p = pendingLines().length;
  el.textContent = `${state.lines.length} line(s) · ${engines.map((e) => PROVIDERS[e]?.label.split(' (')[0] || e).join(', ') || 'no dialogue'}${p ? ` · ${p} need generating` : ''}`;
  $('btnVoices').classList.toggle('attn', p > 0);
}
let generating = null;
async function ensureVoices() {
  if (generating) return generating;
  const todo = pendingLines();
  if (!todo.length) return { failed: [] };
  generating = (async () => {
    const r = await generateLines(todo, {
      onProgress: (p) => updateVoiceStatus(p.model ? `Downloading voice model… ${Math.round(p.model.progress || 0)}%` : `Generating voices ${p.done}/${p.total}…`),
    });
    recompile();
    if (r.failed.length) {
      const first = r.failed[0];
      updateVoiceStatus(`⚠ ${r.failed.length} line(s) failed (line ${first.line}): ${first.error}`);
    } else updateVoiceStatus();
    return r;
  })();
  try { return await generating; } finally { generating = null; }
}

function drawProblems(r, ms) {
  const all = [...r.errors, ...r.warnings];
  if (!all.length) {
    els.problems.innerHTML = `<div class="problem ok">✓ ${state.film.scenes.length} scene(s), ${state.film.duration.toFixed(1)} s — compiled in ${ms.toFixed(1)} ms</div>`;
    return;
  }
  els.problems.innerHTML = all.map((p) => `<div class="problem ${p.severity}" data-line="${p.line}"><b>${p.severity === 'error' ? 'Error' : 'Note'} · line ${p.line}</b> ${escapeHtml(p.message)}</div>`).join('');
  els.problems.querySelectorAll('.problem[data-line]').forEach((d) => d.addEventListener('click', () => gotoLine(+d.dataset.line)));
}

function gotoLine(n) {
  const lines = els.editor.value.split('\n');
  let pos = 0;
  for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  els.editor.focus();
  els.editor.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
  els.editor.scrollTop = Math.max(0, (n - 4) * 20);
}

function updateGutter() {
  const n = els.editor.value.split('\n').length;
  const bad = new Set(state.errors.filter((e) => e.severity === 'error').map((e) => e.line));
  let s = '';
  for (let i = 1; i <= n; i++) s += (bad.has(i) ? '●' : '') + i + '\n';
  els.gutter.textContent = s;
  els.gutter.scrollTop = els.editor.scrollTop;
}

const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---- preview + playback ----------------------------------------------------------------------
function sizeCanvas() {
  const r = els.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, Math.round(r.width * dpr));
  if (els.canvas.width !== w) { els.canvas.width = w; els.canvas.height = Math.round((w * 9) / 16); }
}

function draw() {
  if (!state.film) return;
  sizeCanvas();
  const ctx = els.canvas.getContext('2d', { alpha: false });
  ctx.setTransform(els.canvas.width / STAGE_W, 0, 0, els.canvas.width / STAGE_W, 0, 0);
  try { renderFrame(ctx, state.film, renderAssets(state.assets), state.t); } catch (e) { console.error(e); }
  const fmt = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(2).padStart(5, '0')}`;
  els.time.textContent = `${fmt(state.t)} / ${fmt(state.film.duration)}`;
  els.scrub.value = String(Math.round(state.t * 1000));
}

function frame() {
  if (state.playing && state.film) {
    const clock = state.audioSrc ? state.audioCtx.currentTime - state.startedAt + state.startT : (performance.now() - state.startedAt) / 1000 + state.startT;
    state.t = clock;
    if (state.t >= state.film.duration) { pause(); state.t = state.film.duration - 1e-3; }
    draw();
  }
  requestAnimationFrame(frame);
}

async function play() {
  if (!state.film) return;
  if (state.t >= state.film.duration - 0.01) state.t = 0;
  state.playing = true;
  els.play.textContent = '❚❚ Pause';
  if (pendingLines().length) {
    els.play.textContent = '… voices';
    await ensureVoices();
    if (!state.playing) return;
    els.play.textContent = '❚❚ Pause';
  }
  state.startT = state.t;
  state.startedAt = performance.now();
  scheduleBrowserSpeech(state.t);
  try {
    const key = JSON.stringify(state.film);
    if (state.audioKey !== key) {
      state.audioMix = await mixAudio(state.film, renderAssets(state.assets), { tts: lineBytes, onWarning: (m) => console.warn(m) });
      state.audioKey = key;
    }
    if (state.audioMix && state.playing) {
      state.audioCtx = state.audioCtx || new AudioContext({ sampleRate: state.audioMix.sampleRate });
      await state.audioCtx.resume();
      const buf = state.audioCtx.createBuffer(2, state.audioMix.channels[0].length, state.audioMix.sampleRate);
      buf.copyToChannel(state.audioMix.channels[0], 0);
      buf.copyToChannel(state.audioMix.channels[1], 1);
      const src = state.audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(state.audioCtx.destination);
      src.start(0, state.t);
      state.audioSrc = src;
      state.startedAt = state.audioCtx.currentTime;
      state.startT = state.t;
    }
  } catch (e) { console.warn('audio unavailable', e); }
}
function scheduleBrowserSpeech(from) {
  for (const sc of state.film.scenes) for (const e of sc.events) {
    if (e.type !== 'say' || e.voice?.engine !== 'webspeech') continue;
    const at = sc.start + e.t - from;
    if (at < -0.05) continue;
    state.speechTimers.push(setTimeout(() => state.playing && speakBrowser(e.text, e.voice), Math.max(0, at * 1000)));
  }
}
function pause() {
  state.speechTimers.forEach(clearTimeout);
  state.speechTimers = [];
  stopBrowserSpeech();
  state.playing = false;
  els.play.textContent = '▶ Play';
  if (state.audioSrc) { try { state.audioSrc.stop(); } catch { /* already stopped */ } state.audioSrc = null; }
}


// ---- asset browser ---------------------------------------------------------------------------
const TABS = ['characters', 'scenes', 'voices', 'transitions', 'clips', 'moods'];
function buildTabs() {
  els.tabs.innerHTML = TABS.map((t) => `<button data-tab="${t}">${t}</button>`).join('');
  els.tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
}
function showTab(tab) {
  state.tab = tab;
  els.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const a = state.assets;
  const list = els.list;
  list.innerHTML = '';
  const add = (html, onClick, wide) => {
    const d = document.createElement('div');
    d.className = 'card' + (wide ? ' wide' : '');
    d.innerHTML = html;
    d.addEventListener('click', onClick);
    list.appendChild(d);
    return d;
  };
  if (tab === 'characters') {
    add(`<b>＋ Character Creator</b><div class="id">mix hair, outfits, colours, body builds</div>`, () => openCreator(host()), true);
    for (const c of Object.values(a.characters)) {
      const d = add(`<canvas width="200" height="260"></canvas><b>${c.name}</b><div class="id">${c.id} · ${c.build || 'regular'}</div>`, () => insertAtCursor(`  cast ${c.id}: ${c.id} at 50\n`));
      drawCharacterThumb(d.querySelector('canvas'), a, c.id);
    }
  } else if (tab === 'scenes') {
    for (const s of Object.values(a.scenes)) {
      const d = add(`<canvas width="320" height="180"></canvas><b>${s.name}</b><div class="id">bg=${s.id}</div>`, () => insertAtCursor(`scene new bg=${s.id} {\n  \n}\n`), true);
      drawSceneThumb(d.querySelector('canvas'), a, s.id);
    }
  } else if (tab === 'voices') {
    add(`<b>🎙 Open Voice Lab</b><div class="id">${Object.keys(PROVIDERS).length} engines: OpenAI, ElevenLabs, Google, Gemini, Azure, Polly, Deepgram, Cartesia, Hume, Fish, LMNT, Kokoro (free), your own server…</div>`, () => openVoiceLab(host()), true);
    for (const v of Object.values(a.voices)) add(`<b>${v.name}</b><div class="id">voice=${v.id} · ${v.engine}${v.engine === 'webspeech' ? ' (preview only)' : ''}</div>`, () => insertAtCursor(` voice=${v.id}`, true), true);
  } else if (tab === 'transitions') {
    for (const [id, t] of Object.entries(TRANSITIONS)) add(`<b>${t.label}</b><div class="id">transition ${id} 1s</div>`, () => insertAtCursor(`transition ${id} 1s\n`), true);
  } else if (tab === 'clips') {
    const rig = Object.values(a.rigs)[0];
    for (const [id, c] of Object.entries(rig.clips)) add(`<b>${id}</b><div class="id">${c.overlay ? 'gesture' : 'base loop'} · ${c.duration}s</div>`, () => insertAtCursor(`  ${firstActor()} plays ${id}\n`), true);
  } else {
    for (const m of ['neutral', 'happy', 'joy', 'sad', 'angry', 'surprised', 'worried', 'sleepy']) add(`<b>${m}</b><div class="id">${firstActor()} feels ${m}</div>`, () => insertAtCursor(`  ${firstActor()} feels ${m}\n`), true);
  }
}
function firstActor() {
  const m = /^\s*cast\s+([A-Za-z_][\w-]*)\s*:/m.exec(els.editor.value);
  return m ? m[1] : 'actor';
}
function host() {
  return {
    assets: state.assets,
    insert: (text, mode) => (mode === 'top' ? insertAfterHeader(text) : insertAtCursor(text, mode === 'inline')),
    onSaved: () => { state.audioKey = ''; recompile(); },
    toast: (m) => flash(m),
  };
}
function insertAfterHeader(text) {
  const ed = els.editor;
  const lines = ed.value.split('\n');
  let i = lines.findIndex((l) => /^\s*film\s+"/.test(l));
  i = i < 0 ? 0 : i + 1;
  while (i < lines.length && /^\s*(fade|voice|character|let)\b/.test(lines[i])) i++;
  lines.splice(i, 0, text.replace(/\n$/, ''));
  ed.value = lines.join('\n');
  recompile();
}
function insertAtCursor(text, inline = false) {
  const ed = els.editor;
  ed.focus();
  let pos = ed.selectionStart;
  if (!inline) {
    // insert at the start of the current line
    const before = ed.value.slice(0, pos);
    pos = before.lastIndexOf('\n') + 1;
  }
  ed.setRangeText(text, pos, inline ? ed.selectionEnd : pos, 'end');
  recompile();
}

// ---- files -----------------------------------------------------------------------------------
function bind() {
  els.editor.addEventListener('input', () => { clearTimeout(compileTimer); compileTimer = setTimeout(recompile, 200); updateGutter(); });
  els.editor.addEventListener('scroll', () => { els.gutter.scrollTop = els.editor.scrollTop; });
  els.editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); els.editor.setRangeText('  ', els.editor.selectionStart, els.editor.selectionEnd, 'end'); }
  });
  els.play.addEventListener('click', () => (state.playing ? pause() : play()));
  els.scrub.addEventListener('input', () => { const was = state.playing; if (was) pause(); state.t = +els.scrub.value / 1000; draw(); if (was) play(); });
  window.addEventListener('resize', draw);
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && document.activeElement !== els.editor && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); els.play.click(); } });
  els.filmSelect.addEventListener('change', async () => {
    if (!els.filmSelect.value) return;
    els.editor.value = await (await fetch(els.filmSelect.value)).text();
    state.t = 0;
    recompile();
  });
  $('btnNew').addEventListener('click', () => { if (confirm('Start a new film? Unsaved edits in the editor will be replaced.')) { els.editor.value = NEW_FILM; state.t = 0; recompile(); } });
  $('btnOpen').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) { els.editor.value = await f.text(); state.t = 0; recompile(); } e.target.value = ''; });
  $('btnSave').addEventListener('click', () => {
    const title = (/^film\s+"([^"]*)"/m.exec(els.editor.value) || [, 'film'])[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'film';
    download(new Blob([els.editor.value], { type: 'text/plain' }), `${title}.fly`);
  });
  $('btnClaude').addEventListener('click', copyForClaude);
  $('btnLab').addEventListener('click', () => openVoiceLab(host()));
  $('btnCreator').addEventListener('click', () => openCreator(host()));
  $('btnVoices').addEventListener('click', async () => { const r = await ensureVoices(); if (!r.failed?.length) updateVoiceStatus(pendingLines().length ? undefined : '✓ All voices ready'); });
  els.btnExport.addEventListener('click', startExport);
  els.btnCancel.addEventListener('click', () => exportWorker && exportWorker.postMessage({ type: 'cancel' }));
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

async function copyForClaude() {
  let guide = '';
  try { guide = await (await fetch('docs/FILMSCRIPT.md')).text(); } catch { guide = '(FilmScript reference unavailable)'; }
  const a = state.assets;
  const text = [
    '# Filmly Studio context', '', 'I am making a 2D film with Filmly Studio. Please edit my FilmScript below (or write a new one) using only the assets listed.', '',
    '## Assets',
    `- characters: ${Object.values(a.characters).map((c) => `${c.id} (${c.about || ''} ${Object.values(c.options).join('/')}, ${c.build || 'regular'})`).join('; ')}`,
    `- character slots (for "character x from y ..."): ${Object.entries(Object.values(a.rigs)[0].slots).filter(([k]) => !['eyes', 'brows', 'mouth', 'handF', 'handN'].includes(k)).map(([k, s]) => `${k}=${s.options.join('|')}`).join('; ')}; build=${Object.keys(Object.values(a.rigs)[0].builds).join('|')}`,
    `- voice engines (provider:voice): ${Object.entries(PROVIDERS).map(([k, p]) => `${k} (e.g. ${k}:${p.voices[0]?.id || '<id>'})`).join(', ')}`,
    `- backgrounds: ${Object.keys(a.scenes).join(', ')}`,
    `- voices: ${Object.values(a.voices).map((v) => `${v.id} [${v.engine}]`).join(', ')}`,
    `- transitions: ${Object.keys(TRANSITIONS).join(', ')}`,
    `- clips: ${Object.keys(Object.values(a.rigs)[0].clips).join(', ')}`, '',
    guide, '', '## My current script', '```', els.editor.value, '```', '',
  ].join('\n');
  try { await navigator.clipboard.writeText(text); flash('Copied! Paste it into Claude.'); } catch { download(new Blob([text], { type: 'text/markdown' }), 'filmly-context.md'); flash('Clipboard blocked — downloaded filmly-context.md instead.'); }
}
function flash(msg) { els.expStatus.textContent = msg; }

// ---- export ----------------------------------------------------------------------------------
let exportWorker = null;
async function startExport() {
  if (!state.film) return;
  if (state.errors.some((e) => e.severity === 'error')) { flash('Fix the errors in your script before exporting.'); return; }
  pause();
  const width = +$('expRes').value;
  const fps = +$('expFps').value || state.film.meta.fps;
  const options = { width, fps, quality: $('expQuality').value, codec: $('expCodec').value, range: $('expRange').value === 'full' ? null : [0, +$('expRange').value] };
  els.btnExport.disabled = true;
  els.btnCancel.hidden = false;
  els.expBar.style.width = '0%';
  const warnings = [];
  if (pendingLines().length) {
    els.expStatus.textContent = 'Generating voices…';
    const g = await ensureVoices();
    if (g.failed?.length) warnings.push(`${g.failed.length} voice line(s) could not be generated: ${g.failed[0].error}`);
  }
  els.expStatus.textContent = 'Mixing audio…';
  let audio = null;
  try {
    audio = await mixAudio(state.film, renderAssets(state.assets), { tts: lineBytes, onWarning: (m) => warnings.push(m) });
  } catch (e) { warnings.push('Audio mix failed: ' + e.message); }
  const finish = (html) => { els.btnExport.disabled = false; els.btnCancel.hidden = true; els.expStatus.innerHTML = html; };
  const onDone = ({ blob, info }) => {
    const name = (state.film.meta.title || 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + `-${info.width}x${info.height}-${info.fps}fps.mp4`;
    const url = URL.createObjectURL(blob);
    els.expBar.style.width = '100%';
    const all = [...warnings, ...info.warnings];
    finish(`Done in ${info.elapsed.toFixed(1)} s · ${(info.bytes / 1048576).toFixed(1)} MB · ${info.codec} (${info.hardware ? 'hardware' : 'software'}) · ${(info.bitrate / 1e6).toFixed(0)} Mbps · audio: ${info.audio || 'none'}\n<a href="${url}" download="${name}">⬇ Download ${name}</a>${all.length ? '\n⚠ ' + all.map(escapeHtml).join('\n⚠ ') : ''}`);
  };
  const onProgress = (p) => {
    els.expBar.style.width = `${Math.round((p.frame / p.total) * 100)}%`;
    els.expStatus.textContent = p.phase === 'mux' ? 'Finishing MP4…' : `Rendering frame ${p.frame}/${p.total} · ${p.renderFps.toFixed(1)} fps · ~${Math.ceil(p.etaSeconds)} s left`;
  };
  const assets = renderAssets(state.assets);
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    exportWorker = new Worker(new URL('./export/export.worker.js', import.meta.url), { type: 'module' });
    exportWorker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m);
      else if (m.type === 'done') { exportWorker.terminate(); exportWorker = null; onDone(m); }
      else if (m.type === 'error') { exportWorker.terminate(); exportWorker = null; finish(m.name === 'AbortError' ? 'Export cancelled.' : `Export failed: ${escapeHtml(m.message)}`); }
    };
    exportWorker.onerror = (e) => { finish(`Worker error: ${escapeHtml(e.message || 'could not start')}`); };
    const transfer = audio ? audio.channels.map((c) => c.buffer) : [];
    exportWorker.postMessage({ type: 'start', film: state.film, assets, audio, options }, transfer);
  } else {
    try { onDone(await exportFilm({ ...options, film: state.film, assets, audio, onProgress })); } catch (e) { finish(`Export failed: ${escapeHtml(e.message)}`); }
  }
}
