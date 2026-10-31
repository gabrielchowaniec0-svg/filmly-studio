// Evaluates a compiled film (see src/filmscript/compile.js) at an arbitrary time. Pure and deterministic.
import { ease, lerp, EASE } from './ease.js';
import { buildTalk, mouthAt } from './lipsync.js';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** Moods set brows/eyes/mouth and how heavy the eyelids are (lid 0 = wide open, 1 = closed). */
export const MOODS = {
  neutral: { eyes: 'open', brows: 'neutral', mouth: 'rest', lid: 0.06 },
  happy: { eyes: 'open', brows: 'happy', mouth: 'smile', lid: 0.08 },
  joy: { eyes: 'happy', brows: 'happy', mouth: 'grin', lid: 0.06 },
  sad: { eyes: 'open', brows: 'sad', mouth: 'sad', lid: 0.24 },
  angry: { eyes: 'open', brows: 'angry', mouth: 'frown', lid: 0.3 },
  surprised: { eyes: 'open', brows: 'surprised', mouth: 'wow', lid: 0 },
  worried: { eyes: 'open', brows: 'worried', mouth: 'frown', lid: 0.1 },
  sleepy: { eyes: 'open', brows: 'neutral', mouth: 'rest', lid: 0.55 },
};

export const TALK_CLIPS = ['talk_a', 'talk_b', 'talk_c'];
const BLEND = 0.24; // seconds to cross-fade between base animations
const TURN = 0.2; // seconds for a facing turn

const cache = new WeakMap();
const talkCache = new WeakMap();

function lastAtOrBefore(list, t, key = 't') {
  let r = null;
  for (const item of list) {
    if (item[key] <= t) r = item;
    else break;
  }
  return r;
}

function posOf(A, t) {
  let m = null;
  for (const mv of A.moves) {
    if (mv.t0 <= t) m = mv;
    else break;
  }
  if (!m) return { x: A.init.x, y: A.init.y, move: null };
  if (t >= m.t1) return { x: m.to.x, y: m.to.y, move: null };
  const u = ease(m.ease || 'inout', (t - m.t0) / (m.t1 - m.t0));
  return { x: lerp(m.from.x, m.to.x, u), y: lerp(m.from.y, m.to.y, u), move: m };
}

function camOf(P, t) {
  let m = null;
  for (const mv of P.camera) {
    if (mv.t0 <= t) m = mv;
    else break;
  }
  if (!m) return P.cam0;
  if (t >= m.t1) return m.to;
  const u = ease(m.ease || 'inout', (t - m.t0) / (m.t1 - m.t0));
  return { zoom: lerp(m.from.zoom, m.to.zoom, u), x: lerp(m.from.x, m.to.x, u), y: lerp(m.from.y, m.to.y, u) };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Build lookup tables for a compiled scene (cached per scene object). */
export function prepareScene(scene) {
  let P = cache.get(scene);
  if (P) return P;
  P = { actors: {}, camera: [], cam0: { zoom: 1, x: 50, y: 50 }, captions: [], says: [], order: Object.keys(scene.cast) };
  for (const [name, c] of Object.entries(scene.cast)) {
    P.actors[name] = {
      name,
      init: { x: c.x, y: c.y || 0 },
      moves: [],
      vis: [{ t: -Infinity, v: !c.hidden }],
      face: [{ t: -Infinity, v: c.facing || 'right', prev: c.facing || 'right' }],
      stance: [{ t: -Infinity, clip: 'idle' }],
      gestures: [],
      moods: [{ t: -Infinity, v: c.mood || 'neutral' }],
      looks: [{ t: -Infinity, target: 'auto' }],
      says: [],
      blinks: [],
    };
  }
  const evs = scene.events.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i);
  for (const { e } of evs) {
    const A = e.actor ? P.actors[e.actor] : null;
    switch (e.type) {
      case 'show': A.vis.push({ t: e.t, v: true }); if (e.x != null) A.moves.push({ t0: e.t, t1: e.t, from: { x: e.x, y: e.y ?? 0 }, to: { x: e.x, y: e.y ?? 0 } }); break;
      case 'hide': A.vis.push({ t: e.t, v: false }); break;
      case 'face': {
        const prev = A.face[A.face.length - 1].v;
        A.face.push({ t: e.t, v: e.dir, prev });
        if (prev !== e.dir) A.blinks.push(e.t + 0.02);
        break;
      }
      case 'stance': A.stance.push({ t: e.t, clip: e.clip }); break;
      case 'mood': A.moods.push({ t: e.t, v: e.mood }); break;
      case 'look': A.looks.push({ t: e.t, target: e.target }); break;
      case 'gesture': A.gestures.push(e); break;
      case 'say': A.says.push(e); P.says.push(e); break;
      case 'move': {
        const from = posOf(A, e.t);
        const mv = { t0: e.t, t1: e.t + e.dur, from: { x: from.x, y: from.y }, to: { x: e.to.x, y: e.to.y ?? from.y }, ease: e.ease, clip: e.clip, rate: e.rate || 1, phase0: 0 };
        // keep the walk cycle continuous across back-to-back moves
        const prev = A.moves[A.moves.length - 1];
        if (prev && prev.clip && prev.clip === mv.clip && Math.abs(prev.t1 - mv.t0) < 0.05) mv.phase0 = prev.phase0 + (prev.t1 - prev.t0) * prev.rate;
        A.moves.push(mv);
        break;
      }
      case 'caption': P.captions.push(e); break;
      case 'camera': {
        const from = camOf(P, e.t);
        P.camera.push({ t0: e.t, t1: e.t + e.dur, from: { ...from }, to: { zoom: e.zoom ?? from.zoom, x: e.x ?? from.x, y: e.y ?? from.y }, ease: e.ease });
        break;
      }
      default: break;
    }
  }
  // base-animation switch points (for cross-fades) and natural blink schedules
  for (const A of Object.values(P.actors)) {
    const sw = [];
    for (const m of A.moves) if (m.clip && m.t1 > m.t0) sw.push(m.t0, m.t1);
    for (const s of A.stance) if (s.t !== -Infinity) sw.push(s.t);
    A.switches = [...new Set(sw)].sort((a, b) => a - b);
    const r = rng(hashStr(scene.id + ':' + A.name));
    let t = 0.4 + r() * 2;
    const end = (scene.duration || 60) + 5;
    while (t < end) {
      A.blinks.push(t);
      if (r() < 0.12) A.blinks.push(t + 0.28); // occasional double blink
      t += 2.2 + r() * 3.4;
    }
    A.blinks.sort((a, b) => a - b);
  }
  P.says.sort((a, b) => a.t - b.t);
  cache.set(scene, P);
  return P;
}

function baseAt(A, lt) {
  const pos = posOf(A, lt);
  if (pos.move && pos.move.clip) return { clip: pos.move.clip, t: (lt - pos.move.t0) * pos.move.rate + pos.move.phase0, key: 'move' };
  const st = lastAtOrBefore(A.stance, lt);
  return { clip: st.clip, t: st.clip === 'idle' || st.t === -Infinity ? lt : lt - st.t, key: 'stance' };
}

function blinkAmount(A, lt) {
  let best = 0;
  for (const b of A.blinks) {
    const u = lt - b;
    if (u < -0.01) break;
    if (u > 0.3) continue;
    let v;
    if (u < 0.07) v = u / 0.07;
    else if (u < 0.11) v = 1;
    else v = Math.max(0, 1 - (u - 0.11) / 0.14);
    best = Math.max(best, v);
  }
  return best;
}

/** State of one actor at local scene time lt. */
export function actorState(scene, name, lt) {
  const P = prepareScene(scene);
  const A = P.actors[name];
  const pos = posOf(A, lt);
  const visible = lastAtOrBefore(A.vis, lt).v;

  // facing + quick squash turn
  const fe = lastAtOrBefore(A.face, lt);
  const facing = fe.v;
  let turn = facing === 'left' ? -1 : 1;
  if (fe.prev !== fe.v && lt - fe.t < TURN) {
    const u = EASE.inout((lt - fe.t) / TURN);
    const from = fe.prev === 'left' ? -1 : 1;
    turn = lerp(from, turn, u);
    if (Math.abs(turn) < 0.1) turn = turn < 0 ? -0.1 : 0.1;
  }

  // base layer, cross-faded from the previous base when it just changed
  const layers = [];
  const cur = baseAt(A, lt);
  let sw = null;
  for (const s of A.switches) { if (s <= lt) sw = s; else break; }
  if (sw !== null && lt - sw < BLEND) {
    const prev = baseAt(A, sw - 1e-4);
    if (prev.clip !== cur.clip || prev.key !== cur.key) {
      layers.push({ clip: prev.clip, t: prev.t });
      layers.push({ clip: cur.clip, t: cur.t, weight: EASE.smooth((lt - sw) / BLEND) });
    }
  }
  if (!layers.length) layers.push({ clip: cur.clip, t: cur.t });

  // gesture overlay (with optional hold)
  let gesture = null;
  for (const g of A.gestures) if (g.t <= lt && lt < g.t + g.dur) gesture = g;
  if (gesture) {
    const k = 0.12;
    const w = Math.max(0, Math.min(1, (lt - gesture.t) / k, (gesture.t + gesture.dur - lt) / k));
    layers.push({ clip: gesture.clip, t: (lt - gesture.t) * (gesture.speed || 1), weight: w, hold: gesture.dur * (gesture.speed || 1) });
  }

  // speech
  let say = null;
  for (const s of A.says) if (s.t <= lt && lt < s.t + s.dur) say = s;
  if (say && !gesture && !say.still && !(pos.move && pos.move.clip)) {
    const k = 0.25;
    const w = Math.max(0, Math.min(1, (lt - say.t) / k, (say.t + say.dur - lt) / k));
    const clip = say.gesture || TALK_CLIPS[hashStr(say.text) % TALK_CLIPS.length];
    layers.push({ clip, t: lt - say.t, weight: w * (say.energy ?? 1) });
  }

  // face
  const mood = lastAtOrBefore(A.moods, lt).v;
  const m = MOODS[mood] || MOODS.neutral;
  const face = { eyes: m.eyes, brows: m.brows, mouth: m.mouth };
  if (say) {
    let talk = talkCache.get(say);
    if (!talk) talkCache.set(say, (talk = buildTalk(say.text, say.dur, say.env || null)));
    const vis = mouthAt(talk, lt - say.t);
    if (vis) face.mouth = vis === 'rest' && (m.mouth === 'smile' || m.mouth === 'grin') ? 'smile' : vis;
  }
  const blink = blinkAmount(A, lt);
  const lid = (m.lid ?? 0.06) + (1 - (m.lid ?? 0.06)) * blink;

  // gaze: explicit target, else watch whoever is talking
  const look = lastAtOrBefore(A.looks, lt);
  const fSign = facing === 'left' ? -1 : 1;
  let gaze = [0, 0];
  const towards = (other) => {
    const B = P.actors[other];
    const bx = B ? posOf(B, lt).x : propState(scene, other, lt)?.x;
    if (bx == null) return [0, 0];
    const dx = bx - pos.x;
    return Math.abs(dx) < 4 ? [0, 0] : [Math.sign(dx) * fSign * 4.5, 0];
  };
  const tgt = look.target;
  if (tgt === 'left' || tgt === 'right') gaze = [(tgt === 'right' ? 1 : -1) * fSign * 5, 0];
  else if (tgt === 'up') gaze = [1, -4];
  else if (tgt === 'down') gaze = [1, 4];
  else if (tgt === 'camera') gaze = [-3.5, 0];
  else if (tgt === 'center') gaze = [0, 0];
  else if (tgt && tgt !== 'auto') gaze = towards(tgt);
  else {
    let speaker = null;
    for (const s of P.says) { if (s.t > lt) break; if (s.actor !== name && lt < s.t + s.dur + 0.3) speaker = s.actor; }
    if (speaker && lastAtOrBefore(P.actors[speaker].vis, lt).v) gaze = towards(speaker);
  }

  return { visible, x: pos.x, y: pos.y, facing, turn, layers, face, lid, blink, gaze, say, mood, moving: !!pos.move };
}

export function captionsAt(scene, lt) {
  const P = prepareScene(scene);
  const out = [];
  for (const c of P.captions) {
    if (lt >= c.t && lt < c.t + c.dur) {
      const k = 0.2;
      out.push({ ...c, alpha: Math.max(0, Math.min(1, (lt - c.t) / k, (c.t + c.dur - lt) / k)) });
    }
  }
  return out;
}

export function cameraAt(scene, lt) {
  return camOf(prepareScene(scene), lt);
}

/** Which scenes contribute to the frame at global time t. */
export function windowsAt(film, t) {
  const out = [];
  const last = film.scenes[film.scenes.length - 1];
  const tt = Math.min(t, film.duration - 1e-6);
  for (let i = 0; i < film.scenes.length; i++) {
    const s = film.scenes[i];
    if (tt >= s.start && tt < s.start + s.duration) out.push({ index: i, scene: s, lt: tt - s.start });
  }
  if (!out.length) out.push({ index: film.scenes.length - 1, scene: last, lt: Math.min(last.duration, tt - last.start) });
  if (out.length >= 2) {
    const incoming = out[out.length - 1];
    const tr = incoming.scene.transitionIn;
    incoming.progress = tr ? Math.max(0, Math.min(1, incoming.lt / tr.dur)) : 1;
  }
  return out;
}

export function frameCount(film) {
  return Math.max(1, Math.round(film.duration * film.meta.fps));
}

// ---- props & effects (scene.props / scene.propOrder and prop*/hold/drop/effect events) -------
export const PROP_GRAB = 0.25; // seconds for a prop to glide into a hand
export const PROP_FALL = 0.42; // seconds for a dropped prop to fall to the floor
export const EFFECT_FADE = 0.5; // default effect fade in/out
const propCache = new WeakMap();

function propPosOf(A, t) {
  let m = null;
  for (const mv of A.moves) {
    if (mv.t0 <= t) m = mv;
    else break;
  }
  if (!m) return { ...A.init };
  if (t >= m.t1) return { ...m.to };
  const u = ease(m.ease || 'inout', (t - m.t0) / (m.t1 - m.t0));
  return { x: lerp(m.from.x, m.to.x, u), y: lerp(m.from.y, m.to.y, u), up: lerp(m.from.up, m.to.up, u) };
}

export function prepareProps(scene) {
  let P = propCache.get(scene);
  if (P) return P;
  P = { props: {}, effects: [] };
  for (const [name, c] of Object.entries(scene.props || {})) {
    P.props[name] = { name, init: { x: c.x, y: c.y || 0, up: c.up || 0 }, moves: [], vis: [{ t: -Infinity, v: !c.hidden }], attach: [{ t: -Infinity, actor: null, name }] };
  }
  const evs = (scene.events || []).map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i);
  for (const { e } of evs) {
    if (e.type === 'effect') { P.effects.push(e); continue; }
    const A = e.prop ? P.props[e.prop] : null;
    if (!A) continue;
    switch (e.type) {
      case 'propmove': {
        const from = propPosOf(A, e.t);
        A.moves.push({ t0: e.t, t1: e.t + e.dur, from, to: { x: e.to.x ?? from.x, y: e.to.y ?? from.y, up: e.to.up ?? from.up }, ease: e.ease });
        break;
      }
      case 'propvis': A.vis.push({ t: e.t, v: e.v }); break;
      case 'hold': A.attach.push({ t: e.t, actor: e.actor, hand: e.hand, name: A.name }); A.vis.push({ t: e.t, v: true }); break;
      case 'drop': {
        A.attach.push({ t: e.t, actor: null, name: A.name });
        const to = { x: e.to.x, y: e.to.y, up: 0 };
        A.moves.push({ t0: e.t, t1: e.t, from: to, to });
        break;
      }
      default: break;
    }
  }
  propCache.set(scene, P);
  return P;
}

/** State of a prop at local scene time lt: position (stage px x, depth y, lift up), visibility, attachment. */
export function propState(scene, name, lt) {
  const A = prepareProps(scene).props[name];
  if (!A) return null;
  let ai = 0;
  for (let i = 0; i < A.attach.length; i++) if (A.attach[i].t <= lt) ai = i;
  const pos = propPosOf(A, lt);
  return { visible: lastAtOrBefore(A.vis, lt).v, x: pos.x, y: pos.y, up: pos.up || 0, attach: A.attach[ai], prevAttach: ai > 0 ? A.attach[ai - 1] : null };
}

/** Which props an actor has in each hand at lt: {F: propName|null, N: propName|null}. */
export function heldBy(scene, actor, lt) {
  const out = { F: null, N: null };
  const P = prepareProps(scene);
  for (const A of Object.values(P.props)) {
    let at = null;
    for (const a of A.attach) { if (a.t <= lt) at = a; else break; }
    if (at && at.actor === actor) out[at.hand] = A.name;
  }
  return out;
}

/** Active effects at lt: [{id, amount (fade applied), opts, start}] in the order they were started. */
export function effectsAt(scene, lt) {
  const P = prepareProps(scene);
  if (!P.effects.length) return [];
  const st = new Map(); // id -> {target, from, t, fade, opts, start}
  const level = (s, t) => (s.fade > 0 ? lerp(s.from, s.target, Math.min(1, (t - s.t) / s.fade)) : s.target);
  for (const e of P.effects) {
    if (e.t > lt) break;
    const ids = e.id === '*' ? [...st.keys()] : [e.id];
    for (const id of ids) {
      const prev = st.get(id);
      const from = prev ? level(prev, e.t) : 0;
      st.set(id, { target: e.amount, from, t: e.t, fade: e.fade ?? EFFECT_FADE, opts: e.id === '*' && prev ? prev.opts : e.opts || {}, start: prev && from > 0 ? prev.start : e.t });
    }
  }
  const out = [];
  for (const [id, s] of st) {
    const a = level(s, lt);
    if (a > 0.001) out.push({ id, amount: a, opts: s.opts, start: s.start });
  }
  return out;
}
