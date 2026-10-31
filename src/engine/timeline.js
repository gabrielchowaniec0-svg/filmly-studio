// Evaluates a compiled film (see src/filmscript/compile.js) at an arbitrary time. Pure and deterministic.
import { ease, lerp } from './ease.js';
import { buildTalk, mouthAt } from './lipsync.js';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

export const MOODS = {
  neutral: { eyes: 'open', brows: 'neutral', mouth: 'closed' },
  happy: { eyes: 'open', brows: 'happy', mouth: 'smile' },
  joy: { eyes: 'happy', brows: 'happy', mouth: 'smile' },
  sad: { eyes: 'open', brows: 'sad', mouth: 'sad' },
  angry: { eyes: 'open', brows: 'angry', mouth: 'closed' },
  surprised: { eyes: 'wide', brows: 'surprised', mouth: 'wow' },
};

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

/** Build lookup tables for a compiled scene (cached per scene object). */
export function prepareScene(scene) {
  let P = cache.get(scene);
  if (P) return P;
  P = { actors: {}, camera: [], cam0: { zoom: 1, x: 50, y: 50 }, captions: [], order: Object.keys(scene.cast) };
  for (const [name, c] of Object.entries(scene.cast)) {
    P.actors[name] = {
      init: { x: c.x, y: c.y || 0 },
      moves: [],
      vis: [{ t: -Infinity, v: !c.hidden }],
      face: [{ t: -Infinity, v: c.facing || 'right' }],
      stance: [{ t: -Infinity, clip: 'idle' }],
      gestures: [],
      moods: [{ t: -Infinity, v: 'neutral' }],
      says: [],
    };
  }
  const evs = scene.events.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i);
  for (const { e } of evs) {
    const A = e.actor ? P.actors[e.actor] : null;
    switch (e.type) {
      case 'show': A.vis.push({ t: e.t, v: true }); if (e.x != null) A.moves.push({ t0: e.t, t1: e.t, from: { x: e.x, y: e.y ?? 0 }, to: { x: e.x, y: e.y ?? 0 } }); break;
      case 'hide': A.vis.push({ t: e.t, v: false }); break;
      case 'face': A.face.push({ t: e.t, v: e.dir }); break;
      case 'stance': A.stance.push({ t: e.t, clip: e.clip }); break;
      case 'mood': A.moods.push({ t: e.t, v: e.mood }); break;
      case 'gesture': A.gestures.push(e); break;
      case 'say': A.says.push(e); break;
      case 'move': {
        const from = posOf(A, e.t);
        A.moves.push({ t0: e.t, t1: e.t + e.dur, from: { x: from.x, y: from.y }, to: { x: e.to.x, y: e.to.y ?? from.y }, ease: e.ease, clip: e.clip, rate: e.rate });
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
  cache.set(scene, P);
  return P;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** State of one actor at local scene time lt. */
export function actorState(scene, name, lt) {
  const P = prepareScene(scene);
  const A = P.actors[name];
  const pos = posOf(A, lt);
  const visible = lastAtOrBefore(A.vis, lt).v;
  const facing = lastAtOrBefore(A.face, lt).v;
  const stance = lastAtOrBefore(A.stance, lt);

  let baseClip = stance.clip;
  let baseT = lt - (stance.t === -Infinity ? 0 : stance.t);
  if (pos.move && pos.move.clip) {
    baseClip = pos.move.clip;
    baseT = (lt - pos.move.t0) * (pos.move.rate || 1);
  }

  let overlay = null;
  for (const g of A.gestures) {
    if (g.t <= lt && lt < g.t + g.dur) overlay = g;
  }
  let overlayT = 0, overlayW = 1, overlayClip = null;
  if (overlay) {
    overlayClip = overlay.clip;
    overlayT = (lt - overlay.t) * (overlay.speed || 1);
    const k = 0.14;
    overlayW = Math.min(1, (lt - overlay.t) / k, (overlay.t + overlay.dur - lt) / k);
    overlayW = Math.max(0, overlayW);
  }

  let say = null;
  for (const s of A.says) if (s.t <= lt && lt < s.t + s.dur) say = s;
  if (say && !overlayClip && !say.still && !pos.move) {
    overlayClip = 'talk';
    overlayT = lt - say.t;
    const k = 0.2;
    overlayW = Math.max(0, Math.min(1, (lt - say.t) / k, (say.t + say.dur - lt) / k));
  }

  const mood = lastAtOrBefore(A.moods, lt).v;
  const m = MOODS[mood] || MOODS.neutral;
  const face = { eyes: m.eyes, brows: m.brows, mouth: m.mouth };
  if (say) {
    let talk = talkCache.get(say);
    if (!talk) talkCache.set(say, (talk = buildTalk(say.text, say.dur)));
    const mo = mouthAt(talk, lt - say.t);
    if (mo && mo !== 'closed') face.mouth = mo;
  }
  if (face.eyes === 'open') {
    const period = 3.4, off = (hashStr(name) % 1000) / 1000 * period;
    if (((lt + off) % period) < 0.13) face.eyes = 'blink';
  }
  return { visible, x: pos.x, y: pos.y, facing, baseClip, baseT, overlayClip, overlayT, overlayW, face, say, mood };
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
