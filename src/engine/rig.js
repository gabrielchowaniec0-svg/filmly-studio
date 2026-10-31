// Skeleton evaluation (forward kinematics) and drawing for rigs defined in src/assets/rigs/*.json
import { drawShape, mul, trs, IDENT } from './paint.js';
import { lerp } from './ease.js';

// --- keyframe sampling ---------------------------------------------------------------------
function cr(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

/** keys: [[t, number | [x,y]]]. mode: 'smooth' (Catmull-Rom) | 'linear'. loop wraps neighbours. */
export function sampleKeys(keys, t, mode = 'smooth', loop = false) {
  const n = keys.length;
  if (n === 0) return null;
  if (n === 1 || t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (keys[i + 1][0] < t) i++;
  const [t0, v0] = keys[i];
  const [t1, v1] = keys[i + 1];
  const u = (t - t0) / (t1 - t0);
  const vec = Array.isArray(v0);
  if (mode === 'linear') return vec ? [lerp(v0[0], v1[0], u), lerp(v0[1], v1[1], u)] : lerp(v0, v1, u);
  const uniq = loop && n > 2 ? n - 1 : n; // last key duplicates the first in loops
  const at = (k) => {
    if (loop && n > 2) return keys[((k % uniq) + uniq) % uniq][1];
    return keys[Math.max(0, Math.min(n - 1, k))][1];
  };
  const a = at(i - 1), b = v0, c = v1, d = at(i + 2);
  if (vec) return [cr(a[0], b[0], c[0], d[0], u), cr(a[1], b[1], c[1], d[1], u)];
  return cr(a, b, c, d, u);
}

function clipTime(clip, t) {
  if (clip.loop) return ((t % clip.duration) + clip.duration) % clip.duration;
  return Math.max(0, Math.min(clip.duration, t));
}

function evalClip(clip, t, out) {
  const ct = clipTime(clip, t);
  for (const [bone, tr] of Object.entries(clip.tracks)) {
    const o = out[bone] || (out[bone] = {});
    if (tr.rot) o.rot = sampleKeys(tr.rot, ct, clip.ease, clip.loop);
    if (tr.pos) o.pos = sampleKeys(tr.pos, ct, clip.ease, clip.loop);
  }
  return out;
}

/**
 * Blend a base clip with an optional overlay clip.
 * base: {clip, t}   overlay: {clip, t, weight} (weight 0..1)
 */
export function poseAt(base, overlay) {
  const a = evalClip(base.clip, base.t, {});
  if (!overlay) return a;
  const b = evalClip(overlay.clip, overlay.t, {});
  const w = overlay.weight ?? 1;
  const pose = { ...a };
  for (const [bone, ov] of Object.entries(b)) {
    const bs = a[bone] || {};
    const merged = { ...bs };
    if (ov.rot !== undefined) merged.rot = lerp(bs.rot ?? 0, ov.rot, w);
    if (ov.pos !== undefined) {
      const p0 = bs.pos ?? [0, 0];
      merged.pos = [lerp(p0[0], ov.pos[0], w), lerp(p0[1], ov.pos[1], w)];
    }
    pose[bone] = merged;
  }
  return pose;
}

/** World matrices for each bone (parents must precede children in rig.bones). */
export function boneMatrices(rig, pose, root = IDENT) {
  const m = {};
  for (const b of rig.bones) {
    const p = pose[b.id] || {};
    const px = p.pos ? p.pos[0] : 0, py = p.pos ? p.pos[1] : 0;
    const local = trs(b.pos[0] + px, b.pos[1] + py, (b.rot || 0) + (p.rot || 0));
    m[b.id] = mul(b.parent ? m[b.parent] : root, local);
  }
  return m;
}

const sortedCache = new WeakMap();
function sortedParts(rig) {
  let s = sortedCache.get(rig);
  if (!s) {
    s = rig.parts.map((p, i) => ({ p, i })).sort((a, b) => (a.p.z - b.p.z) || (a.i - b.i)).map((x) => x.p);
    sortedCache.set(rig, s);
  }
  return s;
}

/** Slot options currently in effect for a character (character.options, rig defaults, face overrides). */
export function activeOptions(rig, character, face) {
  const o = {};
  for (const [slot, def] of Object.entries(rig.slots)) o[slot] = character.options?.[slot] ?? def.default;
  if (face) for (const k of ['eyes', 'brows', 'mouth']) if (face[k]) o[k] = face[k];
  return o;
}

/**
 * Draw a character. ctx must already have the stage transform. `placement` is a matrix that puts
 * the rig origin (feet) at the right place with scale/facing.
 */
export function drawRig(ctx, rig, character, pose, face, placement) {
  const mats = boneMatrices(rig, pose, placement);
  const opts = activeOptions(rig, character, face);
  const palette = character.palette;
  for (const part of sortedParts(rig)) {
    if (part.slot && opts[part.slot] !== part.option) continue;
    const m = mats[part.bone];
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    drawShape(ctx, part.shape, palette, {
      fill: part.fill,
      stroke: part.stroke === undefined ? rig.style?.stroke : part.stroke,
      lw: part.lw ?? rig.style?.lw,
      ...(part.fill !== undefined ? { fill: part.fill } : {}),
    });
    ctx.restore();
  }
}
