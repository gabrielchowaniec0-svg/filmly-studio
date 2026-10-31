// Quick actions: small dialogs that write FilmScript. Shared by the Inspector, Library, Insert menu and Stage.
import { drawCharacterThumb, drawSceneThumb, drawPoseThumb, drawTransitionThumb } from './thumbs.js';
import { pick, ask, toast } from './ui.js';
import * as ops from './script-ops.js';
import { PROVIDERS } from '../tts/catalog.js';
import { MOODS } from '../engine/timeline.js';

const ALIAS = { wave: 'waves', jump: 'jumps', shrug: 'shrugs', nod: 'nods', cheer: 'cheers', point: 'points', think: 'thinks', clap: 'claps', laugh: 'laughs', bow: 'bows', dance: 'dances', facepalm: 'facepalms', surprised: 'gasps', sad_slump: 'sulks', look_around: null };
export const GESTURE_LABELS = { idle: 'Idle', walk: 'Walk', run: 'Run', wave: 'Wave', point: 'Point', shrug: 'Shrug', nod: 'Nod', shake_head: 'Shake head', jump: 'Jump', cheer: 'Cheer', clap: 'Clap', laugh: 'Laugh', facepalm: 'Facepalm', think: 'Think', cross_arms: 'Cross arms', bow: 'Bow', look_around: 'Look around', surprised: 'Gasp', dance: 'Dance', sad_slump: 'Sulk', talk_a: 'Talk (a)', talk_b: 'Talk (b)', talk_c: 'Talk (c)', talk: 'Talk' };
const MOOD_LABELS = { neutral: 'Neutral', happy: 'Happy', joy: 'Joyful', sad: 'Sad', angry: 'Angry', surprised: 'Surprised', worried: 'Worried', sleepy: 'Sleepy' };
const pretty = (id) => GESTURE_LABELS[id] || id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** The statement for one clip: "mira waves" where there's a verb, else "mira plays cross_arms". */
export function clipStatement(actor, clip, dur) {
  const verb = ALIAS[clip];
  if (verb && !dur) return `${actor} ${verb}`;
  if (clip === 'look_around' && !dur) return `${actor} looks around`;
  return `${actor} plays ${clip}${dur ? ` for ${dur}s` : ''}`;
}

export function createActions(app) {
  const A = () => app.assets;
  const rig = () => Object.values(A().rigs)[0];
  const scene = (si) => app.film?.scenes[si ?? app.targetScene()];
  const charOfActor = (actor, si) => scene(si)?.cast[actor]?.char;
  const extraChars = () => app.film?.characters || {};
  const allChars = () => ({ ...A().characters, ...extraChars() });

  /** Voice choices for a <select>: groups of [value, label]. */
  function voiceOptions(defaultLabel) {
    const named = [...app.getScript().matchAll(/^\s*voice\s+(\w+)\s*=\s*(\S+)/gm)].map((m) => [m[1], `${m[1]} (${m[2]})`]);
    const presets = Object.values(A().voices);
    const byEngine = (pred) => presets.filter(pred).map((v) => [v.id, v.name]);
    return [
      ['', defaultLabel || "Character's own voice"],
      ...(named.length ? [{ group: 'Voices defined in this film', options: named }] : []),
      { group: 'Browser voices — instant, preview only (silent in MP4)', options: byEngine((v) => v.engine === 'webspeech') },
      { group: 'Kokoro — free, in your browser, exports with sound', options: PROVIDERS.kokoro.voices.map((v) => [`kokoro:${v.id}`, `Kokoro · ${v.name}`]) },
      { group: 'Cloud voices (need a key in Voice Lab)', options: byEngine((v) => !['webspeech', 'kokoro'].includes(v.engine)) },
    ];
  }
  const charVoiceLabel = (charId) => {
    const c = allChars()[charId];
    const v = c?.voice && (typeof c.voice === 'string' ? A().voices[c.voice]?.name || c.voice : c.voice.name || c.voice.id);
    return v ? `Character's own voice (${v})` : "Character's own voice";
  };

  const act = {
    voiceOptions,
    // ---- characters + scenes ----
    async addCharacter(si = app.targetScene()) {
      const items = Object.values(allChars()).map((c) => ({ value: c.id, label: c.name || c.id, sub: c.about || c.build || '', w: 150, h: 195, draw: (cv) => drawCharacterThumb(cv, A(), c.id, extraChars()) }));
      const id = await pick({ title: 'Add a character', sub: 'They join the current scene. Drag them on the stage to place them.', items, width: 760, tile: 'tall' });
      if (id) act.castCharacter(id, { scene: si });
    },
    castCharacter(charId, { scene: si = app.targetScene(), x, hidden = false } = {}) {
      if (!app.film && !app.scan?.scenes.length) { app.insert(`cast ${ops.ident(charId)}: ${charId} at ${x ?? 50}`); return; }
      const actors = app.actorsIn(si);
      const name = ops.uniqueName(charId, actors.map((a) => a.name));
      const px = x ?? ops.freeX(actors.map((a) => a.x));
      app.insert(`cast ${name}: ${charId} at ${Math.round(px)}${hidden ? ' hidden' : ''}`, { where: 'after-casts', scene: si, quiet: true });
      app.select(name);
      toast(`${name} joined the scene. Use the Inspector to make them talk or move.`, { kind: 'ok', action: { label: 'Undo', run: () => app.undo() } });
    },
    async pickBackground(si = app.targetScene()) {
      const items = Object.values(A().scenes).map((s) => ({ value: s.id, label: s.name || s.id, sub: `bg=${s.id}`, w: 256, h: 144, draw: (cv) => drawSceneThumb(cv, A(), s.id) }));
      const id = await pick({ title: 'Choose a background', items, width: 720 });
      if (id) act.setBackground(si, id);
    },
    setBackground(si, bg) {
      const sc = (app.scan || ops.scanBlocks(app.getScript())).scenes[si];
      if (!sc) { act.addScene({ bg }); return; }
      app.replaceLine(sc.line, ops.setProp(app.lineText(sc.line), 'bg', bg));
      toast(`Background: ${A().scenes[bg]?.name || bg}`, { kind: 'ok', action: { label: 'Undo', run: () => app.undo() } });
    },
    async addScene({ bg } = {}) {
      const scan = ops.scanBlocks(app.getScript());
      const ids = scan.scenes.map((s) => s.id);
      const r = await ask({
        title: 'New scene', ok: 'Add scene',
        fields: [
          { key: 'id', label: 'Scene name', value: ops.uniqueName(`scene${ids.length + 1}`, ids) },
          { key: 'bg', label: 'Background', type: 'select', value: bg || Object.keys(A().scenes)[0], options: Object.values(A().scenes).map((s) => [s.id, s.name || s.id]) },
          ...(scan.scenes.length ? [{ key: 'tr', label: 'Transition from the previous scene', type: 'select', value: 'fade', options: [['', 'None (cut)'], ...Object.entries(app.transitions).map(([k, t]) => [k, t.label])] }] : []),
          { key: 'who', label: 'Bring along', type: 'select', value: '', options: [['', 'Nobody yet'], ...Object.values(allChars()).map((c) => [c.id, c.name || c.id])] },
        ],
      });
      if (!r) return;
      const body = r.who ? `cast ${ops.ident(r.who)}: ${r.who} at 50` : '';
      const out = ops.appendScene(app.getScript(), { id: ops.ident(r.id, 'scene'), bg: r.bg, body, transition: r.tr ? `${r.tr} 1s` : '' });
      app.setScript(out.src, { line: out.line });
      toast(`Scene "${r.id}" added.`, { kind: 'ok' });
    },
    // ---- actor actions ----
    async say(actor, si) {
      const ch = charOfActor(actor, si);
      const r = await ask({
        title: `What does ${actor} say?`, ok: 'Add line',
        fields: [
          { key: 'text', label: 'Line', type: 'textarea', rows: 3, placeholder: 'Type the dialogue…' },
          { key: 'voice', label: 'Voice', type: 'select', value: '', options: voiceOptions(charVoiceLabel(ch)) },
          { key: 'mood', label: 'Mood', type: 'select', value: '', options: [['', 'Keep current mood'], ...Object.keys(MOODS).map((m) => [m, MOOD_LABELS[m] || m])] },
          { key: 'together', label: 'Start together with the next line (&)', type: 'check', value: false },
        ],
        preview: (v) => sayLine(actor, v),
      });
      if (!r || !r.text.trim()) return;
      app.insert(sayLine(actor, r), { scene: si });
    },
    async walk(actor, si) {
      const sc = scene(si);
      const others = sc ? sc.castOrder.filter((n) => n !== actor) : [];
      const cur = sc ? Math.round((sc.cast[actor].x / app.STAGE_W) * 100) : 50;
      const r = await ask({
        title: `Move ${actor}`, ok: 'Add move',
        fields: [
          { key: 'mode', label: 'How', type: 'segmented', value: 'walks', options: [['walks', 'Walk'], ['runs', 'Run'], ['moves', 'Glide']] },
          { key: 'target', label: 'Towards', type: 'select', value: '', options: [['', 'A position (below)'], ...others.map((o) => [o, `Next to ${o}`])] },
          { key: 'x', label: 'Position', type: 'range', min: 0, max: 100, step: 1, value: cur > 50 ? 30 : 70, unit: '%', hint: '0 = left edge, 100 = right edge' },
          { key: 'over', label: 'Take (seconds, optional)', type: 'number', min: 0.2, max: 30, step: 0.1, placeholder: 'automatic' },
          { key: 'together', label: 'Start together with the next line (&)', type: 'check', value: false },
        ],
        preview: (v) => walkLine(actor, v),
      });
      if (r) app.insert(walkLine(actor, r), { scene: si });
    },
    async gesture(actor, si) {
      const ch = charOfActor(actor, si) || Object.keys(A().characters)[0];
      const clips = Object.entries(rig().clips).filter(([id, c]) => c.overlay && !/^talk/.test(id));
      const items = clips.map(([id]) => ({ value: id, label: pretty(id), sub: ALIAS[id] ? `${actor} ${ALIAS[id]}` : `plays ${id}`, w: 140, h: 170, draw: (cv) => drawPoseThumb(cv, A(), ch, id, null, { extra: extraChars() }) }));
      const id = await pick({ title: `Gesture for ${actor}`, sub: 'Plays once, on top of whatever they are doing.', items, width: 820, tile: 'tall' });
      if (id) app.insert(clipStatement(actor, id), { scene: si });
    },
    async mood(actor, si) {
      const ch = charOfActor(actor, si) || Object.keys(A().characters)[0];
      const items = Object.keys(MOODS).map((m) => ({ value: m, label: MOOD_LABELS[m] || m, sub: `feels ${m}`, w: 140, h: 140, draw: (cv) => drawPoseThumb(cv, A(), ch, 'idle', 0.6, { mood: m, crop: 'head', extra: extraChars() }) }));
      const m = await pick({ title: `How does ${actor} feel?`, sub: 'Changes their face until the next mood.', items, width: 720, tile: 'square' });
      if (m) app.insert(`${actor} feels ${m}`, { scene: si });
    },
    async look(actor, si) {
      const sc = scene(si);
      const others = sc ? sc.castOrder.filter((n) => n !== actor) : [];
      const r = await ask({
        title: `Where does ${actor} look?`, ok: 'Add',
        fields: [{ key: 'target', label: 'Look at', type: 'select', value: others[0] || 'camera', options: [...(others.length ? [{ group: 'Actors', options: others }] : []), { group: 'Directions', options: [['camera', 'The camera'], ['left', 'Left'], ['right', 'Right'], ['up', 'Up'], ['down', 'Down'], ['around', 'Look around'], ['away', 'Straight ahead']] }] }],
        preview: (v) => `${actor} looks ${v.target === 'around' || v.target === 'away' ? '' : 'at '}${v.target}`.replace('  ', ' '),
      });
      if (r) app.insert(`${actor} looks ${r.target === 'around' || r.target === 'away' ? '' : 'at '}${r.target}`.replace('  ', ' '), { scene: si });
    },
    async enterExit(actor, si) {
      const r = await ask({
        title: `${actor} enters or leaves`, ok: 'Add',
        fields: [
          { key: 'dir', label: 'Action', type: 'segmented', value: 'enters', options: [['enters', 'Enter'], ['exits', 'Exit']] },
          { key: 'side', label: 'Side', type: 'segmented', value: 'right', options: [['left', 'Left'], ['right', 'Right']] },
          { key: 'over', label: 'Take (seconds, optional)', type: 'number', min: 0.3, max: 20, step: 0.1, placeholder: 'automatic' },
        ],
        preview: (v) => `${actor} ${v.dir} ${v.dir === 'enters' ? 'from' : 'to'} ${v.side}${v.over ? ` over ${v.over}s` : ''}`,
      });
      if (!r) return;
      app.insert(`${actor} ${r.dir} ${r.dir === 'enters' ? 'from' : 'to'} ${r.side}${r.over ? ` over ${r.over}s` : ''}`, { scene: si });
      if (r.dir === 'enters') {
        // entering only makes sense if they start hidden
        const sc = scene(si);
        const c = sc?.cast[actor];
        if (c && !c.hidden && c.line && !/\bhidden\b/.test(app.lineText(c.line))) {
          const t = app.lineText(c.line);
          const code = ops.codePart(t).replace(/\s+$/, '');
          app.replaceLine(c.line, code + ' hidden' + t.slice(ops.codePart(t).length));
        }
      }
    },
    showHide(actor, si, show) { app.insert(`${actor} ${show ? 'shows' : 'hides'}`, { scene: si }); },
    async face(actor, si) {
      const sc = scene(si);
      const others = sc ? sc.castOrder.filter((n) => n !== actor) : [];
      const r = await ask({ title: `Which way does ${actor} face?`, ok: 'Add', fields: [{ key: 'dir', label: 'Face', type: 'select', value: 'left', options: [['left', 'Left'], ['right', 'Right'], ...others.map((o) => [o, `Towards ${o}`])] }] });
      if (r) app.insert(`${actor} faces ${r.dir}`, { scene: si });
    },
    // ---- scene actions ----
    async caption(si, kind = 'caption') {
      const r = await ask({
        title: kind === 'title' ? 'Add a title card' : 'Add a caption', ok: 'Add',
        fields: [
          { key: 'text', label: 'Text', value: '', placeholder: kind === 'title' ? 'Chapter One' : 'Meanwhile…' },
          { key: 'dur', label: 'Seconds on screen', type: 'number', value: kind === 'title' ? 2.5 : 2.5, min: 0.5, max: 30, step: 0.1 },
          ...(kind === 'caption' ? [{ key: 'pos', label: 'Position', type: 'segmented', value: 'bottom', options: ['top', 'center', 'bottom'] }] : []),
          { key: 'together', label: 'Keep the scene going while it shows (&)', type: 'check', value: false },
        ],
        preview: (v) => captionLine(kind, v),
      });
      if (r && r.text.trim()) app.insert(captionLine(kind, r), { scene: si });
    },
    async camera(si) {
      const r = await ask({
        title: 'Camera move', ok: 'Add camera move',
        fields: [
          { key: 'zoom', label: 'Zoom', type: 'range', min: 1, max: 3, step: 0.05, value: 1.4, unit: '×', hint: '1× shows the whole stage' },
          { key: 'x', label: 'Look at (left ↔ right)', type: 'range', min: 0, max: 100, value: 50, unit: '%' },
          { key: 'y', label: 'Look at (top ↕ bottom)', type: 'range', min: 0, max: 100, value: 55, unit: '%' },
          { key: 'over', label: 'Move over (seconds)', type: 'number', value: 1.2, min: 0, max: 30, step: 0.1 },
          { key: 'ease', label: 'Motion', type: 'select', value: 'inout', options: [['inout', 'Smooth'], ['linear', 'Constant'], ['out', 'Fast then slow'], ['in', 'Slow then fast'], ['back', 'Overshoot']] },
          { key: 'together', label: 'Move while the next line plays (&)', type: 'check', value: true },
        ],
        preview: (v) => cameraLine(v),
      });
      if (r) app.insert(cameraLine(r), { scene: si });
    },
    resetCamera(si) { app.insert('camera zoom=1 x=50 y=50 over 0.8s', { scene: si }); },
    async wait(si) {
      const r = await ask({ title: 'Pause', ok: 'Add pause', fields: [{ key: 's', label: 'Seconds', type: 'number', value: 1, min: 0.1, max: 60, step: 0.1 }] });
      if (r && r.s) app.insert(`wait ${r.s}s`, { scene: si });
    },
    async transition(si) {
      if (!si) { toast('Transitions go between scenes — add a second scene first.', { kind: 'info' }); return; }
      const items = Object.entries(app.transitions).map(([id, t]) => ({ value: id, label: t.label || id, sub: id, w: 224, h: 126, draw: (cv) => drawTransitionThumb(cv, A(), id, 0.5) }));
      const id = await pick({ title: 'Transition into this scene', items, width: 760 });
      if (!id) return;
      const scan = ops.scanBlocks(app.getScript());
      const sc = scan.scenes[si];
      const lines = app.getScript().split('\n');
      // replace an existing transition between the scenes, else add one just before the scene
      for (let l = sc.line - 1; l > scan.scenes[si - 1].end; l--) {
        if (/^\s*transition\b/.test(lines[l - 1])) { app.replaceLine(l, `transition ${id} 1s`); toast(`Transition: ${app.transitions[id].label}`, { kind: 'ok' }); return; }
      }
      const r = ops.insertLines(app.getScript(), sc.line - 1, `transition ${id} 1s\n`);
      app.setScript(r.src, { line: r.line });
      toast(`Transition: ${app.transitions[id].label}`, { kind: 'ok' });
    },
    async effect(si) {
      const fx = Object.entries(app.effects || {});
      if (!fx.length) { toast('No effects are installed in this asset library yet.', { kind: 'info' }); return; }
      const id = await pick({ title: 'Add an effect', items: [...fx.map(([k, e]) => ({ value: k, label: e.label || k, sub: `effect ${k}`, html: `<span class="tileIcon">${app.icon('cloud', 28)}</span>` })), { value: 'none', label: 'Clear effects', sub: 'effect none', html: `<span class="tileIcon">${app.icon('x', 28)}</span>` }], width: 640, tile: 'sm' });
      if (id) app.insert(`effect ${id}`, { scene: si });
    },
    async sound(si, kind) {
      const all = Object.values(A().sounds || {}).filter((s) => !kind || s.kind === kind);
      if (!all.length) { toast('No sounds in this asset library yet. You can still write sfx "audio/file.wav".', { kind: 'info' }); return; }
      const id = await pick({ title: kind === 'music' ? 'Add music' : kind === 'ambience' ? 'Add ambience' : 'Add a sound', items: all.map((s) => ({ value: s.id, label: s.name || s.id, sub: `${s.kind}${s.duration ? ` · ${(+s.duration).toFixed(1)}s` : ''}`, html: `<span class="tileIcon">${app.icon(s.kind === 'music' ? 'music' : 'wave', 28)}</span>` })), width: 640, tile: 'sm' });
      if (!id) return;
      const s = A().sounds[id];
      app.insert(s.kind === 'music' ? `music ${id} vol=0.4 fade=1s` : s.kind === 'ambience' ? `ambience ${id} vol=0.5` : `sfx ${id}`, { scene: si });
    },
    addProp(propId, { scene: si = app.targetScene(), x } = {}) {
      const actors = app.actorsIn(si);
      const name = ops.uniqueName(propId, [...actors.map((a) => a.name), ...[...app.getScript().matchAll(/^\s*prop\s+([\w-]+)\s*:/gm)].map((m) => m[1])]);
      app.insert(`prop ${name}: ${propId} at ${Math.round(x ?? ops.freeX(actors.map((a) => a.x)))},10`, { where: 'after-casts', scene: si });
    },
    dropItem(item, { x, scene: si }) {
      if (item.kind === 'character') act.castCharacter(item.id, { x, scene: si });
      else if (item.kind === 'scene') act.setBackground(si, item.id);
      else if (item.kind === 'prop') act.addProp(item.id, { x, scene: si });
      else if (item.snippet) app.insert(item.snippet, { scene: si });
    },
  };
  return act;
}

export function sayLine(actor, v) {
  let s = `${actor}: ${ops.q((v.text || '').trim() || '…')}`;
  if (v.voice) s += ` voice=${/^[\w.:-]+$/.test(v.voice) ? v.voice : ops.q(v.voice)}`;
  if (v.mood) s += ` mood=${v.mood}`;
  if (v.together) s += ' &';
  return s;
}
export function walkLine(actor, v) {
  return `${actor} ${v.mode} to ${v.target || Math.round(v.x)}${v.over ? ` over ${v.over}s` : ''}${v.together ? ' &' : ''}`;
}
export function captionLine(kind, v) {
  return `${kind} ${ops.q((v.text || '').trim() || '…')} ${v.dur || 2}s${v.pos && v.pos !== 'bottom' ? ` pos=${v.pos}` : ''}${v.together ? ' &' : ''}`;
}
export function cameraLine(v) {
  const z = Math.round(v.zoom * 100) / 100;
  return `camera zoom=${z} x=${Math.round(v.x)} y=${Math.round(v.y)} over ${v.over ?? 1}s${v.ease && v.ease !== 'inout' ? ` ease=${v.ease}` : ''}${v.together ? ' &' : ''}`;
}
