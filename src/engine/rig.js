// Skeleton evaluation (forward kinematics), animation layering and drawing for rigs in src/assets/rigs/*.json
//
// Pose: { [boneId]: {rot?, pos?:[x,y], scale?:[sx,sy]}, __slots?: {slot: option} }
// Clip: { duration, loop, ease, overlay?, holdAt?, tracks:{bone:{rot,pos,scale}}, slots?:{slot:[[t,option],...]} }
import { drawShape, buildPath, mul, inv, trs, IDENT } from './paint.js';
import { lerp } from './ease.js';

// --- keyframe sampling ---------------------------------------------------------------------
function cr(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

/** keys: [[t, number | [x,y]]]. mode: 'smooth' (Catmull-Rom) | 'linear' | 'step'. loop wraps neighbours. */
export function sampleKeys(keys, t, mode = 'smooth', loop = false) {
  const n = keys.length;
  if (n === 0) return null;
  if (n === 1 || t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (keys[i + 1][0] < t) i++;
  const [t0, v0] = keys[i];
  const [t1, v1] = keys[i + 1];
  if (mode === 'step') return v0;
  const u = (t - t0) / (t1 - t0);
  const vec = Array.isArray(v0);
  if (mode === 'linear') return vec ? [lerp(v0[0], v1[0], u), lerp(v0[1], v1[1], u)] : lerp(v0, v1, u);
  const uniq = loop && n > 2 ? n - 1 : n; // last key duplicates the first in loops
  const at = (k) => {
    if (loop && n > 2) return keys[((k % uniq) + uniq) % uniq][1];
    // clamp, but mirror the slope at the ends so non-looping clips ease in/out
    if (k < 0) return keys[0][1];
    if (k > n - 1) return keys[n - 1][1];
    return keys[k][1];
  };
  const a = at(i - 1), b = v0, c = v1, d = at(i + 2);
  if (vec) return [cr(a[0], b[0], c[0], d[0], u), cr(a[1], b[1], c[1], d[1], u)];
  return cr(a, b, c, d, u);
}

export function clipTime(clip, t) {
  if (clip.loop) return ((t % clip.duration) + clip.duration) % clip.duration;
  return Math.max(0, Math.min(clip.duration, t));
}

/** Map gesture-local time onto a clip with an optional hold (clip.holdAt) when the gesture runs longer than the clip. */
export function holdTime(clip, t, dur) {
  if (clip.loop || clip.holdAt == null || dur == null || dur <= clip.duration) return t;
  const outLen = clip.duration - clip.holdAt;
  if (t < clip.holdAt) return t;
  if (t > dur - outLen) return clip.holdAt + (t - (dur - outLen));
  return clip.holdAt;
}

function evalClip(clip, t) {
  const ct = clipTime(clip, t);
  const out = {};
  for (const [bone, tr] of Object.entries(clip.tracks)) {
    const o = (out[bone] = {});
    if (tr.rot) o.rot = sampleKeys(tr.rot, ct, clip.ease, clip.loop);
    if (tr.pos) o.pos = sampleKeys(tr.pos, ct, clip.ease, clip.loop);
    if (tr.scale) o.scale = sampleKeys(tr.scale, ct, clip.ease, clip.loop);
  }
  if (clip.slots) {
    out.__slots = {};
    for (const [slot, keys] of Object.entries(clip.slots)) out.__slots[slot] = sampleKeys(keys, ct, 'step');
  }
  return out;
}

function blendInto(pose, layer, w) {
  for (const [bone, v] of Object.entries(layer)) {
    if (bone === '__slots') {
      if (w >= 0.5) pose.__slots = { ...(pose.__slots || {}), ...v };
      continue;
    }
    const b = pose[bone] || {};
    const m = { ...b };
    if (v.rot !== undefined) m.rot = lerp(b.rot ?? 0, v.rot, w);
    if (v.pos !== undefined) {
      const p0 = b.pos ?? [0, 0];
      m.pos = [lerp(p0[0], v.pos[0], w), lerp(p0[1], v.pos[1], w)];
    }
    if (v.scale !== undefined) {
      const s0 = b.scale ?? [1, 1];
      m.scale = [lerp(s0[0], v.scale[0], w), lerp(s0[1], v.scale[1], w)];
    }
    pose[bone] = m;
  }
  return pose;
}

/**
 * Evaluate animation layers in order. Each layer: {clip, t, weight}. The first layer is the base
 * (weight ignored); later layers replace the bones they animate, mixed by weight.
 * Back-compat: poseAt(base, overlay) also works.
 */
export function poseAt(layers, overlay) {
  if (!Array.isArray(layers)) layers = overlay ? [layers, overlay] : [layers];
  let pose = null;
  for (const L of layers) {
    if (!L || !L.clip) continue;
    const ev = evalClip(L.clip, L.t);
    if (!pose) pose = ev;
    else if ((L.weight ?? 1) > 0) blendInto(pose, ev, L.weight ?? 1);
  }
  return pose || {};
}

/** Add procedural tweaks: {bone: {rot (added), pos (added), scale (multiplied)}} */
export function applyOverrides(pose, ov) {
  if (!ov) return pose;
  for (const [bone, v] of Object.entries(ov)) {
    const b = pose[bone] || (pose[bone] = {});
    if (v.rot) b.rot = (b.rot ?? 0) + v.rot;
    if (v.pos) { const p = b.pos ?? [0, 0]; b.pos = [p[0] + v.pos[0], p[1] + v.pos[1]]; }
    if (v.scale) { const s = b.scale ?? [1, 1]; b.scale = [s[0] * v.scale[0], s[1] * v.scale[1]]; }
  }
  return pose;
}

/** Resolve a character's build (preset name, object, or both via {preset, ...overrides}). */
export function resolveBuild(rig, character) {
  const b = character.build;
  if (!b) return rig.builds?.regular || {};
  if (typeof b === 'string') return rig.builds?.[b] || {};
  const base = b.preset ? rig.builds?.[b.preset] || {} : {};
  const out = { ...base };
  for (const [k, v] of Object.entries(b)) if (k !== 'preset') out[k] = { ...(out[k] || {}), ...v };
  return out;
}

/** World matrices for each bone (parents must precede children in rig.bones). */
export function boneMatrices(rig, pose, root = IDENT, build = {}) {
  const m = {};
  for (const b of rig.bones) {
    const p = pose[b.id] || {};
    const bd = build[b.id];
    const px = (p.pos ? p.pos[0] : 0) + (bd?.dpos ? bd.dpos[0] : 0);
    const py = (p.pos ? p.pos[1] : 0) + (bd?.dpos ? bd.dpos[1] : 0);
    let s = p.scale || b.scale || [1, 1];
    if (bd?.bscale) s = [s[0] * bd.bscale[0], s[1] * bd.bscale[1]];
    const local = trs(b.pos[0] + px, b.pos[1] + py, (b.rot || 0) + (p.rot || 0), s[0], s[1]);
    m[b.id] = mul(b.parent ? m[b.parent] : root, local);
  }
  return m;
}

const prepCache = new WeakMap();
function prep(rig) {
  let s = prepCache.get(rig);
  if (!s) {
    const byId = {};
    rig.parts.forEach((p) => (byId[p.id] = p));
    const sorted = rig.parts.map((p, i) => ({ p, i })).sort((a, b) => (a.p.z - b.p.z) || (a.i - b.i)).map((x) => x.p);
    s = { byId, sorted };
    prepCache.set(rig, s);
  }
  return s;
}

/** Slot options currently in effect for a character (character.options, rig defaults, face/clip overrides). */
export function activeOptions(rig, character, face, poseSlots) {
  const o = {};
  for (const [slot, def] of Object.entries(rig.slots)) o[slot] = character.options?.[slot] ?? def.default;
  if (face) for (const [k, v] of Object.entries(face)) if (v && rig.slots[k]) o[k] = v;
  if (poseSlots) for (const [k, v] of Object.entries(poseSlots)) if (v && rig.slots[k]) o[k] = v;
  return o;
}

function matches(want, have) {
  return Array.isArray(want) ? want.includes(have) : want === have;
}
export function partVisible(part, opts) {
  if (part.slot && !matches(part.option, opts[part.slot])) return false;
  if (part.when) for (const [k, v] of Object.entries(part.when)) if (!matches(v, opts[k])) return false;
  if (part.unless) for (const [k, v] of Object.entries(part.unless)) if (matches(v, opts[k])) return false;
  return true;
}

function partMatrix(mats, build, part) {
  const m = mats[part.bone];
  const sc = build[part.bone]?.scale;
  return sc ? mul(m, [sc[0], 0, 0, sc[1], 0, 0]) : m;
}

/**
 * Draw a character. ctx must already have the stage transform. `placement` puts the rig origin
 * (between the feet) in stage space with scale/facing.
 */
export function drawRig(ctx, rig, character, pose, face, placement) {
  const build = resolveBuild(rig, character);
  const mats = boneMatrices(rig, pose, placement, build);
  const opts = activeOptions(rig, character, face, pose.__slots);
  const palette = character.palette;
  const { byId, sorted } = prep(rig);
  const defStroke = rig.style?.stroke, defLw = rig.style?.lw;
  for (const part of sorted) {
    if (!partVisible(part, opts)) continue;
    const m = partMatrix(mats, build, part);
    ctx.save();
    if (part.clip) {
      const cp = byId[part.clip];
      const cm = partMatrix(mats, build, cp);
      ctx.transform(cm[0], cm[1], cm[2], cm[3], cm[4], cm[5]);
      ctx.clip(buildPath(cp.shape));
      const rel = mul(inv(cm), m);
      ctx.transform(rel[0], rel[1], rel[2], rel[3], rel[4], rel[5]);
    } else {
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    }
    drawShape(ctx, part.shape, palette, {
      fill: part.fill,
      stroke: part.stroke === undefined ? defStroke : part.stroke,
      lw: part.lw ?? defLw,
      alpha: part.alpha,
    });
    ctx.restore();
  }
}
