// Context-aware FilmScript completion + hover docs. Pure (no DOM): the editor passes lines and a caret.
import { KEYWORDS, VERBS, inStringOrComment, tokenizeLine } from './highlight.js';

export const CURSOR = '‸'; // snippet marker: one marker = caret; two markers = selected placeholder

// ---- docs -------------------------------------------------------------------------------------
export const DOCS = {
  film: 'film "Title" 1920x1080 @30 — required first line: title, size and frame rate.',
  scene: 'scene <name> bg=<background> { … } — a scene with its own time cursor. tail=1s pads the end.',
  cast: 'cast <name>: <character> at X[,Y] [facing=left] [hidden] [scale=1.1] — put a character on stage.',
  prop: 'prop <name>: <prop-id> at X[,Y] [scale=1.2] [hidden] [front] — place a prop in the scene.',
  voice: 'voice <name> = provider:voice [style="…"] [speed=1] — define a named voice; or voice=… on a line.',
  character: 'character <new-id> from <existing> hair=… top=… build=… color.top=#hex voice=… — a character variant.',
  effect: 'effect rain|snow|fog [amount=0.7] — weather/overlay effect. effect rain off, effect none.',
  transition: 'transition <kind> 1s — transition between the previous and next scene.',
  fade: 'fade in 1s | fade out 1s — fade from/to black at the start/end of the film.',
  wait: 'wait 0.5s — advance the time cursor.',
  at: 'at 3s — jump the time cursor to an absolute scene time.',
  hold: 'hold 1s — pad the end of the scene.',
  par: 'par { … } — every line inside starts at the same moment; the scene waits for the longest.',
  repeat: 'repeat N { … } — repeat a block N times.',
  let: 'let name = value — a variable, used as $name.',
  caption: 'caption "Text" 2s [pos=top|center|bottom] — subtitle-style text.',
  title: 'title "BIG TEXT" 3s — large title card text.',
  camera: 'camera zoom=1.4 x=30 y=60 over 1.5s [ease=smooth] — move the camera (zoom ≥ 1, x/y in % of stage).',
  music: 'music <id|"file.mp3"> [vol=0.4] [fade=1s] — background music. music stop [fade=2s].',
  sfx: 'sfx <id|"file.wav"> [vol=0.8] — one-shot sound effect.',
  ambience: 'ambience <id> [vol=0.5] — looping background ambience. ambience stop.',
  says: '<actor> says "…" [voice=…] [mood=…] [for=2s] — dialogue (same as  name: "…").',
  walks: '<actor> walks to <X|X,Y|actor> [over 2s] [style=sneak] — walk to a position.',
  runs: '<actor> runs to <X|actor> [over 1s] — run to a position.',
  moves: '<actor> moves to <X|actor> [over 1s] — glide without walking.',
  enters: '<actor> enters from left|right [over 2s] — walk in from off-stage.',
  exits: '<actor> exits to left|right [over 2s] — walk off-stage.',
  faces: '<actor> faces left|right|<actor> — turn to face a direction.',
  looks: '<actor> looks at <actor>|left|right|up|down|camera|around|away — direct the gaze.',
  plays: '<actor> plays <clip> [for 2s] [speed=1.5] — play an animation clip.',
  feels: '<actor> feels <mood> — change facial mood.',
  idles: '<actor> idles — return to the idle base clip.',
  shows: '<actor> shows — make a hidden actor or prop visible.',
  hides: '<actor> hides — hide an actor or prop.',
  holds: '<actor> holds <prop> — attach a prop to the hand.',
  drops: '<actor> drops <prop> — release a held prop.',
  waves: 'Shortcut for  plays wave.', jumps: 'Shortcut for  plays jump.', shrugs: 'Shortcut for  plays shrug.',
  nods: 'Shortcut for  plays nod.', cheers: 'Shortcut for  plays cheer.', points: 'Shortcut for  plays point.',
  thinks: 'Shortcut for  plays think.', claps: 'Shortcut for  plays clap.', laughs: 'Shortcut for  plays laugh.',
  bows: 'Shortcut for  plays bow.', dances: 'Shortcut for  plays dance.', facepalms: 'Shortcut for  plays facepalm.',
  gasps: 'Shortcut for  plays surprised.', sulks: 'Shortcut for  plays sad_slump.', gestures: 'Shortcut for  plays talk.',
  over: 'over 2s — how long the action takes.',
  bg: 'bg=<background id> — the scene background.',
  mood: 'mood=<mood> — facial mood while speaking.',
  style: 'style=<clip> — walk style (sneak, stroll, march, tiptoe…).',
};

// ---- vocabulary -------------------------------------------------------------------------------
const DEF = {
  moods: ['neutral', 'happy', 'joy', 'sad', 'angry', 'surprised', 'worried', 'sleepy'],
  clips: ['idle', 'walk', 'run', 'wave', 'point', 'shrug', 'nod', 'shake_head', 'jump', 'cheer', 'clap', 'laugh', 'facepalm', 'think', 'cross_arms', 'bow', 'look_around', 'surprised', 'dance', 'sad_slump', 'talk'],
  transitions: ['fade', 'dip_black', 'dip_white', 'wipe_left', 'wipe_right', 'wipe_up', 'wipe_down', 'push_left', 'push_right', 'iris', 'zoom', 'blinds', 'cut'],
  effects: ['rain', 'snow', 'fog'],
  providers: ['browser', 'webspeech', 'kokoro', 'openai', 'elevenlabs', 'google', 'gemini', 'azure', 'polly', 'deepgram', 'cartesia', 'hume', 'fish', 'lmnt', 'custom'],
  builds: ['regular', 'slim', 'broad', 'round', 'tall', 'kid'],
  eases: ['linear', 'in', 'out', 'inout', 'smooth', 'back'],
};
const SLOT_KEYS = ['hair', 'top', 'bottom', 'facial', 'eyewear', 'headwear', 'lashes'];
const PALETTE_KEYS = ['skin', 'hair', 'brow', 'eye', 'blush', 'top', 'top2', 'bottom', 'shoes', 'sole', 'accent', 'frame'];

const keysOf = (o) => (o && typeof o === 'object' ? Object.keys(o) : []);
const toItems = (arr) => (arr || []).map((x) => (typeof x === 'string' ? { id: x } : x)).filter((x) => x && x.id);
const uniqBy = (arr) => { const seen = new Set(); return arr.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))); };

/** Merge assets + extra vocabulary into flat lists of {id, detail}. Tolerates anything missing. */
export function buildVocab(assets, extra = {}) {
  const a = assets || {};
  const ex = extra || {};
  const rig = a.rigs ? Object.values(a.rigs)[0] : null;
  const fromObj = (o, detail) => keysOf(o).map((id) => ({ id, detail: detail(o[id]) }));
  const list = (name, base) => uniqBy([...toItems(ex[name]), ...base]);
  const sounds = keysOf(a.sounds).map((id) => ({ id, kind: a.sounds[id].kind || 'sfx', detail: a.sounds[id].name || a.sounds[id].kind || '' }));
  for (const s of toItems(ex.sounds)) sounds.push({ kind: 'sfx', ...s });
  const clipIds = rig && rig.clips ? keysOf(rig.clips).filter((c) => !/^talk_/.test(c)) : DEF.clips;
  const slots = {};
  if (rig && rig.slots) for (const k of keysOf(rig.slots)) slots[k] = (rig.slots[k].options || []).map((id) => ({ id }));
  return {
    characters: fromObj(a.characters, (c) => c.name || ''),
    scenes: fromObj(a.scenes, (s) => s.name || ''),
    voices: list('voices', fromObj(a.voices, (v) => v.name || v.engine || '')),
    props: list('props', fromObj(a.props, (p) => p.name || p.category || '')),
    sounds,
    clips: list('clips', clipIds.map((id) => ({ id }))),
    moods: list('moods', (rig && rig.moods ? keysOf(rig.moods) : DEF.moods).map((id) => ({ id }))),
    transitions: list('transitions', (keysOf(a.transitions).length ? keysOf(a.transitions) : DEF.transitions).map((id) => ({ id }))),
    effects: list('effects', (keysOf(a.effects).length ? keysOf(a.effects) : DEF.effects).map((id) => ({ id, detail: a.effects && a.effects[id] && a.effects[id].label }))),
    providers: list('providers', DEF.providers.map((id) => ({ id }))),
    builds: (rig && rig.builds ? keysOf(rig.builds) : DEF.builds).map((id) => ({ id })),
    slots,
  };
}

// ---- document scan ----------------------------------------------------------------------------
/** Names declared in the document: actors of the scene around `lineIndex`, variables, named voices, variants. */
export function scanDocument(lines, lineIndex = 0) {
  const vars = [], voices = [], variants = [];
  let sceneStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if ((m = /^\s*let\s+([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(l))) vars.push({ id: m[1], detail: m[2].trim() });
    else if ((m = /^\s*voice\s+([A-Za-z_][\w-]*)\s*=\s*(\S*)/.exec(l))) voices.push({ id: m[1], detail: m[2] });
    else if ((m = /^\s*character\s+([A-Za-z_][\w-]*)\s+from\s+(\S+)/.exec(l))) variants.push({ id: m[1], detail: 'from ' + m[2] });
    if (i <= lineIndex && /^\s*scene\b/.test(l)) sceneStart = i;
  }
  const actors = [], props = [];
  if (sceneStart >= 0) {
    for (let i = sceneStart + 1; i < lines.length && !/^\s*scene\b/.test(lines[i]); i++) {
      const m = /^\s*(cast|prop)\s+([A-Za-z_][\w-]*)\s*:\s*(\S*)/.exec(lines[i]);
      if (m) (m[1] === 'cast' ? actors : props).push({ id: m[2], detail: m[3], line: i });
    }
  }
  return { actors, props, vars, voices, variants, sceneStart };
}

// ---- completion -------------------------------------------------------------------------------
const opt = (arr, kind) => arr.map((x) => ({ label: x.id, kind, detail: x.detail || '' }));
const words = (arr, kind, detail = '') => arr.map((w) => ({ label: w, kind, detail }));
const snip = (label, text, detail) => ({ label, kind: 'snippet', detail, insert: text });

const SNIPPETS = [
  snip('scene', `scene ${CURSOR}name${CURSOR} bg=studio {\n  \n}`, 'scene block'),
  snip('par', `par {\n  ${CURSOR}\n}`, 'parallel block'),
  snip('repeat', `repeat ${CURSOR}3${CURSOR} {\n  \n}`, 'repeat block'),
  snip('character', `character ${CURSOR}new_id${CURSOR} from mira`, 'character variant'),
  snip('cast', `cast ${CURSOR}name${CURSOR}: mira at 50`, 'put a character on stage'),
  snip('prop', `prop ${CURSOR}name${CURSOR}: mug at 40,10`, 'place a prop'),
  snip('camera', `camera zoom=${CURSOR}1.4${CURSOR} x=50 y=50 over 1.5s`, 'camera move'),
  snip('caption', `caption "${CURSOR}" 2s`, 'caption text'),
  snip('title', `title "${CURSOR}" 3s`, 'title text'),
];
const TOP_ONLY = ['film', 'fade', 'voice', 'character', 'let', 'scene', 'transition'];
const SCENE_ONLY = ['cast', 'prop', 'effect', 'wait', 'at', 'hold', 'par', 'repeat', 'caption', 'title', 'camera', 'music', 'sfx', 'ambience'];

const DIALOGUE_OPTS = ['voice=', 'mood=', 'for=', 'gesture=', 'energy=', 'audio=', 'gap=', 'still'];
const OPTS_BY_KEYWORD = {
  cast: ['facing=', 'hidden', 'scale='], prop: ['scale=', 'hidden', 'front'], scene: ['bg=', 'tail='],
  camera: ['zoom=', 'x=', 'y=', 'over', 'ease='], caption: ['pos='], music: ['vol=', 'fade='], sfx: ['vol='],
  ambience: ['vol=', 'fade='], effect: ['amount=', 'off'], voice: ['style=', 'speed=', 'model=', 'pitch='],
  character: [...SLOT_KEYS.map((k) => k + '='), 'build=', 'scale=', 'voice=', ...PALETTE_KEYS.map((k) => `color.${k}=`)],
};
const VERB_OPTS = { walks: ['to', 'over', 'style='], runs: ['to', 'over'], moves: ['to', 'over'], enters: ['from', 'over'], exits: ['to', 'over'], plays: ['for', 'speed='] };

/**
 * Work out what to suggest at a caret. Returns null or { from, to, items:[{label, kind, detail, insert?}] }
 * where from/to are 0-based columns of the word being replaced in `lines[lineIndex]`.
 */
export function complete(lines, lineIndex, col, vocab, { explicit = false } = {}) {
  const line = lines[lineIndex] || '';
  if (inStringOrComment(line, col)) return null;
  const before = line.slice(0, col);
  const wm = /[A-Za-z0-9_.\-$]*$/.exec(before);
  let from = col - wm[0].length;
  let prefix = wm[0];
  const head = before.slice(0, from);
  const V = vocab || buildVocab(null);
  const doc = scanDocument(lines, lineIndex);
  const actorItems = () => [...opt(doc.actors, 'actor'), ...opt(doc.props, 'prop')];
  let items = null;
  let m;

  if (prefix.startsWith('$')) {
    items = doc.vars.map((v) => ({ label: '$' + v.id, kind: 'variable', detail: v.detail }));
  } else if (/(?:^|\s)voice=[\w.:\-]*$/.test(before) || /^\s*voice\s+[\w-]+\s*=\s*[\w.:\-]*$/.test(before)) {
    // voice=<preset | named | provider:voice>
    const vm = /([A-Za-z0-9_\-]+):([\w.\-]*)$/.exec(before);
    if (vm) {
      from = col - vm[2].length; prefix = vm[2];
      const pv = (V.voices || []).filter((v) => v.id.startsWith(vm[1] + ':')).map((v) => ({ label: v.id.slice(vm[1].length + 1), kind: 'voice', detail: v.detail }));
      items = pv;
    } else {
      items = [...opt(doc.voices, 'voice'), ...opt(V.voices.filter((v) => !v.id.includes(':')), 'voice'),
        ...V.providers.map((p) => ({ label: p.id + ':', kind: 'provider', detail: 'provider', retrigger: true }))];
    }
  } else if ((m = /(?:^|\s)([A-Za-z_][\w.]*)=$/.exec(head))) {
    const key = m[1];
    const kw = (/^\s*(\w+)/.exec(line) || [])[1];
    if (key === 'bg') items = opt(V.scenes, 'scene');
    else if (key === 'mood') items = opt(V.moods, 'mood');
    else if (key === 'style' && kw !== 'voice') items = opt(V.clips, 'clip');
    else if (key === 'gesture') items = opt(V.clips.filter((c) => /talk|wave|point|shrug|nod/.test(c.id)), 'clip');
    else if (key === 'pos') items = words(['top', 'center', 'bottom'], 'value');
    else if (key === 'ease') items = words(DEF.eases, 'value');
    else if (key === 'facing') items = words(['left', 'right'], 'value');
    else if (key === 'build') items = opt(V.builds, 'build');
    else if (V.slots[key]) items = opt(V.slots[key], 'option');
    else items = [];
  } else if (/^\s*cast\s+[\w-]+\s*:\s*$/.test(head)) {
    items = [...opt(doc.variants, 'character'), ...opt(V.characters, 'character')];
  } else if (/^\s*prop\s+[\w-]+\s*:\s*$/.test(head)) {
    items = opt(V.props, 'prop');
  } else if (/^\s*character\s+[\w-]+\s+from\s+$/.test(head)) {
    items = opt(V.characters, 'character');
  } else if (/^\s*character\s+[\w-]+\s+$/.test(head)) {
    items = words(['from'], 'keyword');
  } else if (/^\s*transition\s+$/.test(head)) {
    items = opt(V.transitions, 'transition');
  } else if (/^\s*effect\s+$/.test(head)) {
    items = [...opt(V.effects, 'effect'), ...words(['none'], 'keyword')];
  } else if (/^\s*effect\s+\w+\s+$/.test(head)) {
    items = words(['off', 'amount='], 'keyword');
  } else if ((m = /^\s*(sfx|music|ambience)\s+$/.exec(head))) {
    const kind = m[1];
    items = V.sounds.filter((s) => (s.kind || 'sfx') === kind).map((s) => ({ label: s.id, kind: 'sound', detail: s.detail }));
    if (kind !== 'sfx') items.push({ label: 'stop', kind: 'keyword', detail: 'stop ' + kind });
  } else if (/^\s*fade\s+$/.test(head)) {
    items = words(['in', 'out'], 'keyword');
  } else if (/\bplays\s+$/.test(head)) {
    items = opt(V.clips, 'clip');
  } else if (/\bfeels\s+$/.test(head)) {
    items = opt(V.moods, 'mood');
  } else if (/\blooks\s+at\s+$/.test(head)) {
    items = opt(doc.actors, 'actor');
  } else if (/\blooks\s+$/.test(head)) {
    items = [...words(['at'], 'keyword'), ...words(['left', 'right', 'up', 'down', 'camera', 'around', 'away'], 'value')];
  } else if (/\bfaces\s+$/.test(head)) {
    items = [...words(['left', 'right'], 'value'), ...opt(doc.actors, 'actor')];
  } else if (/\b(?:enters\s+from|exits\s+to)\s+$/.test(head)) {
    items = words(['left', 'right'], 'value');
  } else if (/\b(?:walks|runs|moves)\s+to\s+$/.test(head)) {
    items = actorItems();
  } else if (/\b(?:holds|drops)\s+$/.test(head)) {
    items = opt(doc.props, 'prop');
  } else if ((m = /^\s*(\$?[A-Za-z_][\w-]*)\s+$/.exec(head)) && !KEYWORDS.has(m[1])) {
    const name = m[1];
    const known = name.startsWith('$') || doc.actors.some((a) => a.id === name) || doc.props.some((a) => a.id === name);
    if (known) items = [...[...VERBS].map((v) => ({ label: v, kind: 'verb', detail: (DOCS[v] || '').replace(/^<actor> /, '') }))];
    else if (explicit) items = [...VERBS].map((v) => ({ label: v, kind: 'verb' }));
  } else if (/^\s*$/.test(head)) {
    const inScene = isInsideScene(lines, lineIndex);
    const kws = [...KEYWORDS].filter((k) => (inScene ? !TOP_ONLY.includes(k) || k === 'voice' : !SCENE_ONLY.includes(k)));
    items = [
      ...(inScene ? actorItems().map((a) => ({ ...a, detail: a.kind === 'actor' ? 'actor · ' + a.detail : a.detail })) : []),
      ...SNIPPETS.filter((s) => kws.includes(s.label) || (inScene && ['par', 'repeat', 'camera', 'caption', 'title', 'cast', 'prop'].includes(s.label))),
      ...kws.map((k) => ({ label: k, kind: 'keyword', detail: (DOCS[k] || '').split(' — ')[0] })),
    ];
    if (inScene) for (const a of doc.actors) items.unshift({ label: a.id + ': "…"', kind: 'snippet', detail: 'dialogue', insert: `${a.id}: "${CURSOR}"`, filter: a.id });
  } else {
    // trailing options
    const kw = (/^\s*(\w+)/.exec(line) || [])[1];
    const verbM = /^\s*\$?[\w-]+\s+(\w+)/.exec(line);
    if (/^\s*\$?[\w-]+\s*:\s*"/.test(line) || (verbM && verbM[1] === 'says')) items = words(DIALOGUE_OPTS, 'option');
    else if (OPTS_BY_KEYWORD[kw]) items = words(OPTS_BY_KEYWORD[kw], 'option');
    else if (verbM && VERB_OPTS[verbM[1]]) items = words(VERB_OPTS[verbM[1]], 'option');
    if (items && !prefix && !explicit && !/\s$/.test(before)) items = null;
  }
  if (!items) return null;
  if (!prefix && !explicit && items.length === 0) return null;
  const ranked = rank(items, prefix);
  if (!ranked.length) return null;
  if (ranked.length === 1 && ranked[0].label === prefix && !ranked[0].insert) return null;
  return { from, to: col + identTail(line, col), items: ranked.slice(0, 60), prefix };
}

function identTail(line, col) {
  const m = /^[A-Za-z0-9_.\-]*/.exec(line.slice(col));
  return m ? m[0].length : 0;
}

function isInsideScene(lines, lineIndex) {
  let depth = 0, inScene = false;
  for (let i = 0; i < lineIndex; i++) {
    for (const t of tokenizeLine(lines[i])) {
      if (t.t !== 'brace') continue;
      const ch = lines[i][t.s];
      if (ch === '{') { if (depth === 0) inScene = /^\s*scene\b/.test(lines[i]); depth++; } else depth = Math.max(0, depth - 1);
    }
  }
  return depth > 0 && inScene;
}

/** Filter + sort by match quality: exact prefix, case-insensitive prefix, word-part prefix, subsequence. */
export function rank(items, prefix) {
  const p = prefix.toLowerCase();
  const scored = [];
  const seen = new Set();
  items.forEach((it, idx) => {
    const key = it.label + '|' + it.kind;
    if (seen.has(key)) return;
    seen.add(key);
    const l = (it.filter || it.label).toLowerCase();
    let s;
    if (!p) s = 0;
    else if (l.startsWith(p)) s = l === p ? 0 : 1;
    else if (l.split(/[_:.\-]/).some((w) => w.startsWith(p))) s = 2;
    else if (subseq(l, p)) s = 3;
    else return;
    scored.push({ it, s, idx });
  });
  scored.sort((a, b) => a.s - b.s || a.idx - b.idx);
  return scored.map((x) => x.it);
}
function subseq(s, p) { let j = 0; for (let i = 0; i < s.length && j < p.length; i++) if (s[i] === p[j]) j++; return j === p.length; }

/** Expand a completion's insert text: returns { text, selStart, selEnd } (offsets into text). Re-indents lines. */
export function expandInsert(item, indent = '') {
  let text = item.insert != null ? item.insert : item.label;
  text = text.replace(/\n/g, '\n' + indent);
  const a = text.indexOf(CURSOR);
  if (a < 0) return { text, selStart: text.length, selEnd: text.length };
  text = text.slice(0, a) + text.slice(a + 1);
  const b = text.indexOf(CURSOR);
  if (b < 0) return { text, selStart: a, selEnd: a };
  text = text.slice(0, b) + text.slice(b + 1);
  return { text, selStart: a, selEnd: b };
}

// ---- hover ------------------------------------------------------------------------------------
/** One-line help for the word at column `col` of `line`, or null. */
export function hoverInfo(line, col, vocab, lines = null, lineIndex = 0) {
  const toks = tokenizeLine(line);
  const t = toks.find((x) => col >= x.s && col < x.e);
  if (!t || t.t === 'comment' || t.t.startsWith('string')) return null;
  const w = line.slice(t.s, t.e);
  if (t.t === 'color') return { from: t.s, to: t.e, text: `Color ${w}`, color: w };
  if (t.t === 'keyword' || t.t === 'verb' || t.t === 'kw2') return DOCS[w] ? { from: t.s, to: t.e, text: DOCS[w] } : null;
  if (t.t === 'key' && DOCS[w]) return { from: t.s, to: t.e, text: DOCS[w] };
  const V = vocab || buildVocab(null);
  const find = (list, label) => { const x = (list || []).find((i) => i.id === w); return x ? { from: t.s, to: t.e, text: `${label} ${w}${x.detail ? ' — ' + x.detail : ''}` } : null; };
  if (t.t === 'var' && lines) {
    const v = scanDocument(lines, lineIndex).vars.find((x) => '$' + x.id === w);
    return v ? { from: t.s, to: t.e, text: `${w} = ${v.detail}` } : null;
  }
  if (t.t === 'actor' && lines) {
    const d = scanDocument(lines, lineIndex);
    const a = d.actors.find((x) => x.id === w) || d.props.find((x) => x.id === w);
    if (a) return { from: t.s, to: t.e, text: `${w} — ${d.props.includes(a) ? 'prop' : 'actor'} (${a.detail}), declared on line ${a.line + 1}` };
  }
  return find(V.characters, 'Character') || find(V.scenes, 'Background') || find(V.voices, 'Voice') || find(V.props, 'Prop') ||
    find(V.sounds, 'Sound') || find(V.transitions, 'Transition') || find(V.effects, 'Effect') || find(V.moods, 'Mood') || find(V.clips, 'Clip');
}
