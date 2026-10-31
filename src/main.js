// Filmly Studio editor shell. The FilmScript text is the single source of truth: every panel reads the compiled
// film and every action writes script (so undo, Claude and the .fly file always agree).
import { loadAssets, renderAssets } from './assets/loader.js';
import { compileSource } from './filmscript/index.js';
import { renderFrame } from './engine/renderer.js';
import { STAGE_W, MOODS } from './engine/timeline.js';
import { mixAudio } from './engine/audio.js';
import { TRANSITIONS } from './assets/transitions/index.js';
import { exportFilm } from './export/exporter.js';
import { lineInfo, lineBytes, generateLines, speakBrowser, stopBrowserSpeech } from './tts/index.js';
import { needsAudio, PROVIDERS } from './tts/catalog.js';
import { openVoiceLab } from './editor/voicelab.js';
import { openCreator } from './editor/creator.js';
import { createPlainEditor } from './editor/plain-editor.js';
import { createProjectStore } from './editor/projects.js';
import * as ops from './editor/script-ops.js';
import { sceneIndexAt, timeOfLine, lineAtTime } from './editor/timeline-data.js';
import { toast, openModal, confirmDialog, ask, showMenu, download, prefs, esc, $ } from './editor/ui.js';
import { icon } from './editor/icons.js';
import { initLayout } from './editor/layout.js';
import { createLibrary } from './editor/library.js';
import { createInspector } from './editor/inspector.js';
import { createTimeline } from './editor/timeline-view.js';
import { createStage } from './editor/stage.js';
import { openExportDialog } from './editor/export-dialog.js';
import { openHelp, openShortcuts } from './editor/help.js';
import { openWelcome } from './editor/welcome.js';
import { startCoach } from './editor/coach.js';
import { buildMenus } from './editor/menus.js';
import { createActions } from './editor/actions.js';
import { TEMPLATES } from './editor/templates.js';

const listeners = {};
const app = {
  assets: null, effects: {}, transitions: TRANSITIONS, film: null, result: null, lines: [], errors: [],
  t: 0, playing: false, rate: 1, loop: prefs.get('loop', false), sel: null, cursorLine: 1, lastFocus: 'ui',
  insertMode: prefs.get('insertMode', 'scene-end'), projectId: null, editor: null, store: createProjectStore(),
  on(ev, fn) { (listeners[ev] ||= []).push(fn); },
  emit(ev, ...a) { for (const fn of listeners[ev] || []) { try { fn(...a); } catch (e) { console.error(e); } } },
  toast, esc, icon, ops, MOODS, PROVIDERS, STAGE_W,
};
window.filmly = app; // handy for tests and for poking around in devtools

init().catch((e) => {
  document.body.insertAdjacentHTML('afterbegin', `<pre class="fatal">Filmly Studio failed to start: ${esc(e.message)}</pre>`);
  console.error(e);
});

async function init() {
  applyTheme(prefs.get('theme', 'dark'));
  app.assets = await loadAssets('./');
  try { app.effects = (await import('./assets/effects/index.js')).EFFECTS || {}; } catch { app.effects = {}; }
  app.assets.props ||= {};
  app.assets.sounds ||= {};
  await createEditor();
  initLayout(app);
  app.actions = createActions(app);
  app.stage = createStage(app);
  app.library = createLibrary(app);
  app.inspector = createInspector(app);
  app.timeline = createTimeline(app);
  buildMenus(app);
  bind();

  const legacy = app.store.migrateLegacy((t) => ops.filmTitle(t) || 'My film');
  const cur = legacy?.id || app.store.current();
  if (cur && app.store.get(cur)) openProject(cur);
  else {
    // nothing saved yet: show the demo behind the welcome screen
    const demo = app.assets.manifest.films[0];
    const text = demo ? await (await fetch(demo)).text() : TEMPLATES[0].build({ title: 'Untitled' });
    loadText(text, { project: null });
    welcome();
  }
  frame();
}

// ---- script editor ------------------------------------------------------------------------------
async function createEditor() {
  const host = $('#codeHost');
  const opts = {
    value: '',
    getAssets: () => app.assets,
    getVocabulary: () => vocabulary(),
    onChange: (v, meta) => { if (meta?.source !== 'set') scheduleCompile(); },
    onCursor: (line) => {
      const moved = line !== app.cursorLine;
      app.cursorLine = line;
      app.lastFocus = 'script';
      if (moved && !app.playing && app.film) { const t = timeOfLine(app.film, line); if (t != null) { app.t = Math.min(t + 0.01, app.film.duration - 1e-3); draw(); } }
      app.emit('cursor', line);
    },
    readOnly: false,
  };
  try {
    const mod = await import('./editor/code/code-editor.js');
    app.editor = mod.createCodeEditor(host, opts);
    app.editorKind = 'code';
  } catch (e) {
    if (!/Failed to fetch|Cannot find|404|Importing a module/i.test(String(e))) console.warn('Code editor unavailable, using the plain editor:', e);
    app.editor = createPlainEditor(host, opts);
    app.editorKind = 'plain';
  }
  host.addEventListener('focusin', () => { app.lastFocus = 'script'; });
}

function vocabulary() {
  const f = app.film;
  const rig = Object.values(app.assets.rigs)[0];
  const actors = new Set();
  if (f) for (const s of f.scenes) s.castOrder.forEach((n) => actors.add(n));
  else for (const m of app.getScript().matchAll(/^\s*cast\s+([\w-]+)\s*:/gm)) actors.add(m[1]);
  return {
    actors: [...actors], characters: [...Object.keys(app.assets.characters), ...Object.keys(f?.characters || {})],
    backgrounds: Object.keys(app.assets.scenes), voices: Object.keys(app.assets.voices), providers: Object.keys(PROVIDERS),
    clips: rig ? Object.keys(rig.clips) : [], moods: Object.keys(MOODS), transitions: Object.keys(TRANSITIONS),
    effects: Object.keys(app.effects), sounds: Object.keys(app.assets.sounds), props: Object.keys(app.assets.props),
  };
}

app.getScript = () => app.editor.getValue();
/** Replace the whole script (undoable). opts: {select: line, seekLine, quiet} */
app.setScript = (text, { line, seek = true } = {}) => {
  app.editor.setValue(text, { keepHistory: true });
  recompile();
  if (line) {
    app.editor.goto(line, { select: true, focus: false }); // keep keyboard focus where it was (Space still plays)
    app.cursorLine = line;
    if (seek) { const t = timeOfLine(app.film, line); if (t != null && !app.playing) app.seek(t + 0.01); }
  }
};
function loadText(text, { project }) {
  app.projectId = project;
  app.editor.setValue(text, { keepHistory: false });
  app.t = 0;
  app.sel = null;
  recompile();
  // start on a frame with something to see (not the black of a fade-in)
  if (app.film) { app.t = Math.min(app.film.duration * 0.5, (app.film.fadeIn || 0) + 0.8); draw(); }
  updateProjectName();
}

// ---- compile -----------------------------------------------------------------------------------
let compileTimer = 0;
function scheduleCompile() { clearTimeout(compileTimer); compileTimer = setTimeout(recompile, 180); markDirty(); }
function recompile() {
  clearTimeout(compileTimer);
  const src = app.getScript();
  const t0 = performance.now();
  const r = compileSource(src, app.assets, { lineAudio: lineInfo });
  app.result = r;
  app.lines = r.lines || [];
  app.errors = [...r.errors, ...r.warnings];
  app.compileMs = performance.now() - t0;
  if (r.film) {
    app.film = r.film;
    app.t = Math.min(app.t, Math.max(0, r.film.duration - 1e-3));
    app.audioKey = '';
    if (app.sel && !r.film.scenes.some((s) => s.cast[app.sel.actor])) app.sel = null;
  }
  app.scan = ops.scanBlocks(src);
  app.editor.setDiagnostics(app.errors.map((e) => ({ line: e.line, col: e.col || 0, message: e.message, severity: e.severity })));
  drawProblems();
  updateStatus();
  app.emit('compile', app.film);
  draw();
  autosave();
}

function drawProblems() {
  const el = $('#problems');
  const errs = app.errors;
  $('#pScript').classList.toggle('hasProblems', errs.length > 0);
  if (!errs.length) {
    el.innerHTML = app.film ? `<div class="problem ok">${icon('check', 14)} ${app.film.scenes.length} scene${app.film.scenes.length === 1 ? '' : 's'} · ${ops.formatTime(app.film.duration, 1)} · compiled in ${app.compileMs.toFixed(0)} ms</div>` : '';
    return;
  }
  el.innerHTML = errs.map((p) => `<button class="problem ${p.severity}" data-line="${p.line}">${icon(p.severity === 'error' ? 'alert' : 'info', 14)}<b>Line ${p.line}</b><span>${esc(p.message)}</span></button>`).join('');
}

// ---- voices ------------------------------------------------------------------------------------
const pendingLines = () => app.lines.filter((l) => needsAudio(l.voice) && !lineInfo(l.voice, l.text));
app.pendingLines = pendingLines;
app.voiceSummary = () => {
  const by = {};
  for (const l of app.lines) by[l.voice.engine] = (by[l.voice.engine] || 0) + 1;
  return { total: app.lines.length, byEngine: by, browser: by.webspeech || 0, pending: pendingLines().length };
};
let generating = null;
app.ensureVoices = async function ensureVoices() {
  if (generating) return generating;
  const todo = pendingLines();
  if (!todo.length) return { failed: [] };
  generating = (async () => {
    const r = await generateLines(todo, {
      onProgress: (p) => setVoiceStatus(p.model ? `Downloading voice model… ${Math.round(p.model.progress || 0)}%` : `Generating voices ${p.done}/${p.total}…`, 'busy'),
    });
    recompile();
    if (r.failed.length) setVoiceStatus(`${r.failed.length} line(s) failed (line ${r.failed[0].line}): ${r.failed[0].error}`, 'error');
    else updateStatus();
    return r;
  })();
  try { return await generating; } finally { generating = null; }
};
function setVoiceStatus(msg, kind = '') {
  const el = $('#voiceStatus');
  el.textContent = msg;
  el.dataset.kind = kind;
}

/** Ask, then rewrite every browser voice in the script to a Kokoro voice. */
app.switchToKokoro = async () => {
  const { src, changes } = ops.switchToKokoro(app.getScript(), app.assets, app.lines);
  if (!changes.length) { toast('No browser voices to switch — every line already uses an exportable voice.', { kind: 'ok' }); return false; }
  const list = changes.slice(0, 40).map((c) => `<div class="diff"><span class="ln">${c.line}</span><div><del>${esc(c.before.trim())}</del><ins>${esc(c.after.trim())}</ins></div></div>`).join('');
  const okd = await openModal({
    title: 'Switch voices to Kokoro?', width: 640,
    sub: 'Kokoro is free and runs in your browser, and its audio is included in MP4 exports. The first use downloads a ~90 MB voice model once.',
    body: `<p class="small">${changes.length} line${changes.length === 1 ? '' : 's'} will change. You can undo this with Ctrl+Z.</p><div class="diffList">${list}</div>${changes.length > 40 ? `<p class="small">…and ${changes.length - 40} more.</p>` : ''}`,
    actions: [{ label: 'Cancel', value: false }, { label: `Switch ${changes.length} line${changes.length === 1 ? '' : 's'}`, primary: true, value: true }],
  }).done;
  if (!okd) return false;
  app.setScript(src);
  toast('Voices switched to Kokoro. Press Play (or Generate voices) to create the audio.', { kind: 'ok' });
  return true;
};

// ---- status bar --------------------------------------------------------------------------------
function updateStatus() {
  const errs = app.errors.filter((e) => e.severity === 'error');
  const warns = app.errors.length - errs.length;
  const c = $('#stCompile');
  c.className = 'stItem ' + (errs.length ? 'bad' : warns ? 'warn' : 'good');
  c.innerHTML = errs.length ? `${icon('alert', 13)} ${errs.length} error${errs.length > 1 ? 's' : ''} — line ${errs[0].line}`
    : `${icon('check', 13)} ${warns ? `${warns} note${warns > 1 ? 's' : ''}` : 'Ready'}`;
  c.dataset.line = errs[0]?.line || app.errors[0]?.line || '';
  $('#stFilm').textContent = app.film ? `${app.film.scenes.length} scene${app.film.scenes.length === 1 ? '' : 's'} · ${ops.formatTime(app.film.duration, 1)} · ${app.film.meta.width}×${app.film.meta.height} @${app.film.meta.fps}` : '—';
  const v = app.voiceSummary();
  const engines = Object.keys(v.byEngine).map((e) => PROVIDERS[e]?.label.split(' (')[0] || e);
  setVoiceStatus(v.total ? `${v.total} line${v.total > 1 ? 's' : ''} · ${engines.join(', ')}${v.pending ? ` · ${v.pending} to generate` : ''}${v.browser ? ' · browser voices are silent in MP4' : ''}` : 'No dialogue yet', v.browser ? 'warn' : '');
  $('#btnVoices').classList.toggle('attn', v.pending > 0);
  $('#btnVoices').hidden = !v.pending && !Object.keys(v.byEngine).some((e) => needsAudio({ engine: e }));
}

// ---- projects ----------------------------------------------------------------------------------
let saveTimer = 0;
function markDirty() { if (app.projectId) $('#saveState').textContent = 'Editing…'; }
function autosave() {
  if (!app.projectId) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = app.store.save(app.projectId, app.getScript(), ops.filmTitle(app.getScript()) || undefined);
    $('#saveState').textContent = ok ? 'Saved' : 'Not saved (storage full)';
    $('#saveState').classList.toggle('bad', !ok);
    updateProjectName();
  }, 350);
}
function updateProjectName() {
  const p = app.projectId && app.store.get(app.projectId);
  $('#projName').textContent = p ? p.name : 'Not saved';
  $('#projName').title = p ? 'Rename this film' : 'This film is not in your projects yet';
  document.title = `${p ? p.name + ' — ' : ''}Filmly Studio`;
}
function openProject(id) {
  const p = app.store.get(id);
  if (!p) return;
  app.store.setCurrent(id);
  loadText(p.text, { project: id });
  $('#saveState').textContent = 'Saved';
}
app.openProject = openProject;
app.newProject = (name, text) => { const p = app.store.create(name, text); openProject(p.id); return p; };
app.renameProject = async () => {
  if (!app.projectId) { app.newProject(ops.filmTitle(app.getScript()) || 'My film', app.getScript()); toast('Saved to your films.', { kind: 'ok' }); return; }
  const p = app.store.get(app.projectId);
  const r = await ask({ title: 'Rename film', fields: [{ key: 'name', label: 'Name', value: p.name }, { key: 'title', label: 'Also change the title inside the film', type: 'check', value: true }], ok: 'Rename' });
  if (!r || !r.name.trim()) return;
  app.store.rename(app.projectId, r.name.trim());
  if (r.title) app.setScript(ops.setFilmTitle(app.getScript(), r.name.trim()));
  updateProjectName();
};
app.duplicateProject = () => { if (!app.projectId) return; const p = app.store.duplicate(app.projectId); openProject(p.id); toast(`Duplicated as "${p.name}".`, { kind: 'ok' }); };
app.saveFile = () => {
  download(new Blob([app.getScript()], { type: 'text/plain' }), `${ops.slug(ops.filmTitle(app.getScript()))}.fly`);
  toast('Saved a .fly file to your downloads.', { kind: 'ok' });
};
app.openFile = () => $('#fileInput').click();
app.openExample = async (path) => { const text = await (await fetch(path)).text(); app.newProject(ops.filmTitle(text) || path, text); };
function welcome() { openWelcome(app); }
app.welcome = welcome;
app.startCoach = () => startCoach(app);

// ---- preview + playback ------------------------------------------------------------------------
function draw() {
  if (!app.film) { app.stage.drawEmpty(); return; }
  app.stage.render(app.film, renderAssets(app.assets), app.t);
  app.emit('time', app.t);
}
app.draw = draw;
app.seek = (t) => {
  const was = app.playing && app.rate > 0;
  if (was) pause();
  app.t = Math.max(0, Math.min(t, (app.film?.duration || 0) - 1e-3));
  draw();
  if (was) play();
};
app.step = (frames) => { if (!app.film) return; pause(); const fps = app.film.meta.fps; app.seek(Math.round(app.t * fps + frames) / fps + 1e-4); };

const clock = { startedAt: 0, startT: 0, timers: [], audioCtx: null, audioSrc: null };
function frame() {
  if (app.playing && app.film) {
    const now = clock.audioSrc ? clock.audioCtx.currentTime : performance.now() / 1000;
    app.t = clock.startT + (now - clock.startedAt) * app.rate;
    const D = app.film.duration;
    if (app.t >= D) {
      if (app.loop) { app.t = 0; restartPlayback(); } else { pause(); app.t = D - 1e-3; }
    } else if (app.t <= 0 && app.rate < 0) { pause(); app.t = 0; }
    draw();
  }
  requestAnimationFrame(frame);
}
async function play() {
  if (!app.film || app.playing) return;
  if (app.rate > 0 && app.t >= app.film.duration - 0.02) app.t = 0;
  app.playing = true;
  app.emit('play', true);
  if (app.rate > 0 && pendingLines().length) {
    setVoiceStatus('Preparing voices…', 'busy');
    await app.ensureVoices();
    if (!app.playing) return;
  }
  await startClock();
}
async function startClock() {
  clock.startT = app.t;
  clock.startedAt = performance.now() / 1000;
  clock.audioSrc = null;
  if (app.rate <= 0) return;
  scheduleBrowserSpeech(app.t);
  try {
    const key = JSON.stringify(app.film.scenes.map((s) => s.events)) + app.film.duration;
    if (app.audioKey !== key) {
      app.audioMix = await mixAudio(app.film, renderAssets(app.assets), { tts: lineBytes, onWarning: (m) => console.warn(m) });
      app.audioKey = key;
    }
    if (app.audioMix && app.playing) {
      clock.audioCtx = clock.audioCtx || new AudioContext({ sampleRate: app.audioMix.sampleRate });
      await clock.audioCtx.resume();
      const buf = clock.audioCtx.createBuffer(2, app.audioMix.channels[0].length, app.audioMix.sampleRate);
      buf.copyToChannel(app.audioMix.channels[0], 0);
      buf.copyToChannel(app.audioMix.channels[1], 1);
      const src = clock.audioCtx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = app.rate;
      src.connect(clock.audioCtx.destination);
      const startT = app.t;
      src.start(0, Math.min(startT, buf.duration));
      clock.audioSrc = src;
      clock.startedAt = clock.audioCtx.currentTime;
      clock.startT = startT;
    }
  } catch (e) { console.warn('audio unavailable', e); }
}
function stopClock() {
  clock.timers.forEach(clearTimeout);
  clock.timers = [];
  stopBrowserSpeech();
  if (clock.audioSrc) { try { clock.audioSrc.stop(); } catch { /* already stopped */ } clock.audioSrc = null; }
}
function restartPlayback() { stopClock(); startClock(); }
function scheduleBrowserSpeech(from) {
  for (const sc of app.film.scenes) for (const e of sc.events) {
    if (e.type !== 'say' || e.voice?.engine !== 'webspeech') continue;
    const at = (sc.start + e.t - from) / app.rate;
    if (at < -0.05) continue;
    clock.timers.push(setTimeout(() => app.playing && speakBrowser(e.text, { ...e.voice, rate: (+e.voice.rate || 1) * app.rate }), Math.max(0, at * 1000)));
  }
}
function pause() {
  if (!app.playing) return;
  stopClock();
  app.playing = false;
  app.emit('play', false);
}
app.play = () => { app.rate = Math.abs(app.rate) || 1; play(); };
app.pause = pause;
app.toggle = () => (app.playing ? pause() : app.play());
app.setRate = (r) => {
  const was = app.playing;
  if (was) pause();
  app.rate = r;
  app.emit('rate', r);
  if (was) play();
};
app.shuttle = (dir) => { // J / L: each press goes faster in that direction
  const speeds = [1, 2, 4];
  const cur = app.playing && Math.sign(app.rate) === dir ? Math.abs(app.rate) : 0;
  const next = speeds.find((s) => s > cur) || 4;
  if (app.playing) pause();
  app.rate = next * dir;
  app.emit('rate', app.rate);
  play();
};

// ---- inserting script --------------------------------------------------------------------------
/** Scene the user is working on: the one with the script cursor if they were just typing, else at the playhead. */
app.targetScene = () => {
  const scan = app.scan || ops.scanBlocks(app.getScript());
  if (app.lastFocus === 'script') { const s = ops.sceneAtLine(scan, app.cursorLine); if (s) return s.index; }
  return Math.max(0, sceneIndexAt(app.film, app.t));
};
app.actorsIn = (si) => { const s = app.film?.scenes[si]; return s ? s.castOrder.map((n) => ({ name: n, char: s.cast[n].char, x: (s.cast[n].x / STAGE_W) * 100 })) : []; };

/**
 * Insert FilmScript statements. where: 'auto' (the user's insert-mode setting), 'scene-end', 'cursor', 'now' (after the
 * statement playing at the playhead), 'after-casts', 'header'. Selects the new line and moves the playhead to it.
 */
app.insert = (snippet, { where = 'auto', scene, quiet = false } = {}) => {
  const src = app.getScript();
  let mode = where === 'auto' ? app.insertMode : where;
  let si = scene ?? app.targetScene();
  let r;
  const scan = ops.scanBlocks(src);
  if (!scan.scenes.length && mode !== 'header') {
    const ap = ops.appendScene(src, { id: 'one', bg: 'studio', body: snippet });
    app.setScript(ap.src, { line: ap.line + 1 });
    return ap.line + 1;
  }
  if (mode === 'cursor') {
    const sc = ops.sceneAtLine(scan, app.cursorLine);
    if (sc && app.cursorLine > sc.line && app.cursorLine < sc.end) r = ops.insertAfterLine(src, app.cursorLine, snippet);
    else mode = 'scene-end';
  }
  if (mode === 'now') {
    const line = app.film && lineAtTime(app.film, si, app.t - (app.film.scenes[si]?.start || 0));
    if (line) r = ops.insertAfterLine(src, ops.topLevelLine(scan, line), snippet);
    else r = ops.insertAfterCasts(src, si, snippet);
  }
  if (!r && mode === 'after-casts') r = ops.insertAfterCasts(src, si, snippet);
  if (!r && mode === 'header') r = ops.insertAfterHeader(src, snippet);
  if (!r) r = ops.insertAtSceneEnd(src, si, snippet);
  app.setScript(r.src, { line: r.line });
  app.cursorLine = r.line;
  if (!quiet) toast(`Added to line ${r.line}`, { kind: 'ok', ms: 1800, action: { label: 'Undo', run: () => app.undo() } });
  return r.line;
};
app.replaceLine = (line, text) => app.setScript(ops.replaceLine(app.getScript(), line, text), { line, seek: false });
app.lineText = (line) => app.getScript().split('\n')[line - 1] ?? '';
app.gotoLine = (line) => { app.editor.goto(line, { select: true }); app.cursorLine = line; app.lastFocus = 'script'; app.emit('cursor', line); };
app.undo = () => { app.editor.undo(); recompile(); };
app.redo = () => { app.editor.redo(); recompile(); };
app.select = (actor) => { app.sel = actor ? { actor } : null; app.emit('select', app.sel); draw(); };
app.setInsertMode = (m) => { app.insertMode = m; prefs.set('insertMode', m); app.emit('insertMode', m); };

app.voiceLab = () => openVoiceLab({
  assets: app.assets,
  insert: (text, mode) => {
    if (mode === 'top') { const r = ops.insertAfterHeader(app.getScript(), text); app.setScript(r.src, { line: r.line, seek: false }); }
    else { app.editor.insert(text, 'cursor'); recompile(); }
  },
  onSaved: () => { app.audioKey = ''; recompile(); },
  toast,
});
app.creator = (baseId) => openCreator({
  assets: app.assets, baseId,
  insert: (text) => { const r = ops.insertAfterHeader(app.getScript(), text); app.setScript(r.src, { line: r.line, seek: false }); },
  toast: (m) => toast(m, { kind: 'ok', ms: 5000 }),
});
app.exportDialog = () => { pause(); openExportDialog(app, { startExport }); };
app.help = (tab) => openHelp(app, tab);

// ---- theme -------------------------------------------------------------------------------------
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  prefs.set('theme', t);
  const b = document.getElementById('btnTheme');
  if (b) { b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 17); b.title = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'; }
}
app.toggleTheme = () => { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); app.emit('theme'); draw(); };

// ---- Claude ------------------------------------------------------------------------------------
app.copyForClaude = async function copyForClaude() {
  let guide = '';
  try { guide = await (await fetch('docs/FILMSCRIPT.md')).text(); } catch { guide = '(FilmScript reference unavailable)'; }
  const a = app.assets;
  const rig = Object.values(a.rigs)[0];
  const listOf = (o, f) => Object.values(o || {}).map(f).join(', ');
  const text = [
    '# Filmly Studio context', '', 'I am making a 2D film with Filmly Studio. Please edit my FilmScript below (or write a new one) using only the assets listed.', '',
    '## Assets',
    `- characters: ${Object.values(a.characters).map((c) => `${c.id} (${c.about || ''} ${Object.values(c.options).join('/')}, ${c.build || 'regular'})`).join('; ')}`,
    `- character slots (for "character x from y ..."): ${Object.entries(rig.slots).filter(([k]) => !['eyes', 'brows', 'mouth', 'handF', 'handN'].includes(k)).map(([k, s]) => `${k}=${s.options.join('|')}`).join('; ')}; build=${Object.keys(rig.builds).join('|')}`,
    `- voice engines (provider:voice): ${Object.entries(PROVIDERS).map(([k, p]) => `${k} (e.g. ${k}:${p.voices[0]?.id || '<id>'})`).join(', ')}`,
    `- backgrounds: ${Object.keys(a.scenes).join(', ')}`,
    `- voices: ${Object.values(a.voices).map((v) => `${v.id} [${v.engine}]`).join(', ')}`,
    `- transitions: ${Object.keys(TRANSITIONS).join(', ')}`,
    `- clips: ${Object.keys(rig.clips).join(', ')}`,
    `- moods: ${Object.keys(MOODS).join(', ')}`,
    Object.keys(a.props).length ? `- props: ${listOf(a.props, (p) => `${p.id}${p.category ? ` (${p.category})` : ''}`)}` : null,
    Object.keys(a.sounds).length ? `- sounds: ${listOf(a.sounds, (s) => `${s.id} [${s.kind}]`)}` : null,
    Object.keys(app.effects).length ? `- effects: ${Object.keys(app.effects).join(', ')}` : null,
    '', guide, '', '## My current script', '```', app.getScript(), '```', '',
  ].filter((x) => x != null).join('\n');
  try { await navigator.clipboard.writeText(text); toast('Copied! Paste it into Claude, then paste Claude\'s script back here.', { kind: 'ok', ms: 4500 }); } catch { download(new Blob([text], { type: 'text/markdown' }), 'filmly-context.md'); toast('Clipboard blocked — downloaded filmly-context.md instead.'); }
};

// ---- bindings ----------------------------------------------------------------------------------
function bind() {
  $('#fileInput').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (f) { const text = await f.text(); app.newProject(ops.filmTitle(text) || f.name.replace(/\.\w+$/, ''), text); toast(`Opened ${f.name}`, { kind: 'ok' }); }
    e.target.value = '';
  });
  $('#problems').addEventListener('click', (e) => { const b = e.target.closest('[data-line]'); if (b) app.gotoLine(+b.dataset.line); });
  $('#stCompile').addEventListener('click', () => { const l = +$('#stCompile').dataset.line; if (l) app.gotoLine(l); });
  $('#btnVoices').addEventListener('click', async () => { const r = await app.ensureVoices(); if (!r.failed?.length) { updateStatus(); toast('All voices are ready.', { kind: 'ok' }); } });
  $('#voiceStatus').addEventListener('click', () => { if (app.voiceSummary().browser) app.switchToKokoro(); else app.voiceLab(); });
  $('#projName').addEventListener('click', () => app.renameProject());
  $('#btnLab').addEventListener('click', () => app.voiceLab());
  $('#btnCreator').addEventListener('click', () => app.creator(app.sel && app.film?.scenes[sceneIndexAt(app.film, app.t)]?.cast[app.sel.actor]?.char));
  $('#btnClaude').addEventListener('click', () => app.copyForClaude());
  $('#btnTheme').addEventListener('click', () => app.toggleTheme());
  $('#btnOpenExport').addEventListener('click', () => app.exportDialog());
  $('#btnHome').addEventListener('click', () => welcome());
  $('#btnUndo').addEventListener('click', () => app.undo());
  $('#btnRedo').addEventListener('click', () => app.redo());
  applyTheme(document.documentElement.dataset.theme);
  window.addEventListener('keydown', onKey);
  // the stage and timeline drive "where am I" from the playhead; the script drives it from the cursor
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('#pStage, #pTimeline')) app.lastFocus = 'ui'; }, true);
}

const typing = (el) => el && (el.closest?.('#codeHost, .cm-editor, [contenteditable="true"]') || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
function onKey(e) {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if ((document.querySelector('dialog[open]:not(.drawer)') || document.getElementById('coach')) && !mod) return; // modals handle their own keys
  if (mod && k === 's') { e.preventDefault(); app.saveFile(); return; }
  if (mod && k === 'e') { e.preventDefault(); app.exportDialog(); return; }
  if (mod && k === 'o') { e.preventDefault(); app.openFile(); return; }
  if (typing(e.target)) {
    if (e.key === 'Escape') { e.target.blur?.(); }
    return;
  }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? app.redo() : app.undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); app.redo(); return; }
  if (mod || e.altKey) return;
  const fps = app.film?.meta.fps || 30;
  switch (e.key) {
    case ' ': e.preventDefault(); app.toggle(); break;
    case 'k': case 'K': pause(); break;
    case 'l': case 'L': app.shuttle(1); break;
    case 'j': case 'J': app.shuttle(-1); break;
    case 'ArrowLeft': e.preventDefault(); e.shiftKey ? app.seek(app.t - 1) : app.step(-1); break;
    case 'ArrowRight': e.preventDefault(); e.shiftKey ? app.seek(app.t + 1) : app.step(1); break;
    case 'Home': app.seek(0); break;
    case 'End': app.seek(app.film?.duration || 0); break;
    case 'f': case 'F': app.stage.fullscreen(); break;
    case '?': openShortcuts(app); break;
    case 'Escape': app.select(null); break;
    case 'Delete': case 'Backspace': break;
    default: void fps;
  }
}

// ---- export ------------------------------------------------------------------------------------
let exportWorker = null;
/** Export with options {width, fps, quality, codec, range}; ui: {status(html), progress(0-1), done(url,name,info,warnings), failed(msg)} */
async function startExport(options, ui) {
  if (!app.film) return;
  if (app.errors.some((e) => e.severity === 'error')) { ui.failed('Fix the errors in your script before exporting.'); return; }
  pause();
  const warnings = [];
  if (pendingLines().length) {
    ui.status('Generating voices…');
    const g = await app.ensureVoices();
    if (g.failed?.length) warnings.push(`${g.failed.length} voice line(s) could not be generated: ${g.failed[0].error}`);
  }
  const film = app.film;
  ui.status('Mixing audio…');
  let audio = null;
  try { audio = await mixAudio(film, renderAssets(app.assets), { tts: lineBytes, onWarning: (m) => warnings.push(m) }); } catch (e) { warnings.push('Audio mix failed: ' + e.message); }
  const onDone = ({ blob, info }) => {
    const name = ops.slug(film.meta.title) + `-${info.width}x${info.height}-${info.fps}fps.mp4`;
    ui.done(URL.createObjectURL(blob), name, info, [...warnings, ...info.warnings]);
  };
  const onProgress = (p) => {
    ui.progress(p.frame / p.total);
    ui.status(p.phase === 'mux' ? 'Finishing the MP4…' : `Rendering frame ${p.frame} of ${p.total} · ${p.renderFps.toFixed(1)} fps · about ${Math.ceil(p.etaSeconds)} s left`);
  };
  const assets = renderAssets(app.assets);
  const fps = options.fps || film.meta.fps;
  const opts = { ...options, fps };
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    exportWorker = new Worker(new URL('./export/export.worker.js', import.meta.url), { type: 'module' });
    exportWorker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m);
      else if (m.type === 'done') { exportWorker.terminate(); exportWorker = null; onDone(m); }
      else if (m.type === 'error') { exportWorker.terminate(); exportWorker = null; ui.failed(m.name === 'AbortError' ? 'Export cancelled.' : `Export failed: ${m.message}`); }
    };
    exportWorker.onerror = (e) => ui.failed(`Worker error: ${e.message || 'could not start'}`);
    const transfer = audio ? audio.channels.map((c) => c.buffer) : [];
    exportWorker.postMessage({ type: 'start', film, assets, audio, options: opts }, transfer);
  } else {
    try { onDone(await exportFilm({ ...opts, film, assets, audio, onProgress })); } catch (e) { ui.failed(`Export failed: ${e.message}`); }
  }
}
app.cancelExport = () => exportWorker && exportWorker.postMessage({ type: 'cancel' });
app.showMenu = showMenu;
app.confirm = confirmDialog;
app.ask = ask;
app.renderAssets = () => renderAssets(app.assets);
app.renderFrame = renderFrame;
