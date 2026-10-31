// Props: drawing prop assets (src/assets/props/*.json) and placing them in a scene — free-standing
// (depth-sorted with the actors) or held in a character's hand (follows the animation).
//
// Prop asset: { id, name, category, size:[w,h], anchor, grip?:[x,y], hold?:'upright'|'rotate', holdAngle?,
//               handPose?:'fist'|'open', palette?:{main,...}, style?:{stroke,lw}, shadow?:number|false,
//               text?:{x,y,w,h,color,weight}, shapes:[shape] }
// Shapes are paint.js shapes in local units (origin = bottom-centre on the floor, y up is negative) plus:
//   clipTo: <shape>  clip this shape to another shape (cel shading)      off:[dx,dy] translate this shape
import { drawShape, buildPath, mul, trs } from './paint.js';
import { boneMatrices, resolveBuild, drawRig } from './rig.js';
import { propState, PROP_GRAB, PROP_FALL } from './timeline.js';
import { EASE } from './ease.js';

/** Fist centre in hand-bone space (the rig's hand shapes span x -11..12, y -4..20). */
export const HAND_POINT = [0.5, 8];
const FONT = '"Segoe UI", Inter, system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';

/** Draw a prop asset in its local space. inst: {palette?, text?} */
export function drawPropAsset(ctx, def, inst = {}, mirrored = false) {
  const palette = inst.palette ? { ...(def.palette || {}), ...inst.palette } : def.palette;
  const defaults = { stroke: def.style?.stroke ?? '#2a1d1d', lw: def.style?.lw ?? 3.4 };
  for (const s of def.shapes) {
    if (s.clipTo || s.off || s.dash) {
      ctx.save();
      if (s.clipTo) ctx.clip(buildPath(s.clipTo));
      if (s.off) ctx.translate(s.off[0], s.off[1]);
      if (s.dash) ctx.setLineDash(s.dash);
      drawShape(ctx, s, palette, defaults);
      ctx.restore();
    } else drawShape(ctx, s, palette, defaults);
  }
  const text = inst.text ?? def.text?.default;
  if (def.text && text) drawPropText(ctx, def.text, String(text), mirrored);
}

function drawPropText(ctx, box, text, mirrored) {
  ctx.save();
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  ctx.translate(cx, cy);
  if (mirrored) ctx.scale(-1, 1); // keep lettering readable on flipped props
  if (box.rot) ctx.rotate((box.rot * Math.PI) / 180);
  const lines = text.split('\n');
  let size = box.size || box.h / lines.length * 0.8;
  ctx.font = `${box.weight || 800} ${size}px ${box.font || FONT}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  if (widest > box.w * 0.92) {
    size *= (box.w * 0.92) / widest;
    ctx.font = `${box.weight || 800} ${size}px ${box.font || FONT}`;
  }
  ctx.fillStyle = box.color || '#2a1d1d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = size * 1.1;
  lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
  ctx.restore();
}

// --- placement -------------------------------------------------------------------------------
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Matrix for a prop standing on the floor (or lifted `up` px) at depth y. */
export function freeMatrix(def, inst, ps, bg) {
  const s = (1 + ps.y * 0.002) * (def.scale || 1) * (inst.scale || 1);
  const f = inst.flip ? -1 : 1;
  return [s * f, 0, 0, s, ps.x, bg.floorY + ps.y * 2 - (ps.up || 0) * (1 + ps.y * 0.002)];
}

/** Matrix that puts the prop's grip point in an actor's hand. af = renderer actor frame. */
export function heldMatrix(def, inst, af, hand) {
  const hm = frameMats(af)['hand' + hand];
  if (!hm) return freeMatrix(def, inst, { x: af.st.x, y: af.st.y, up: 0 }, af.bg);
  const [px, py] = apply(hm, HAND_POINT[0], HAND_POINT[1]);
  const sp = (1 + af.st.y * 0.002) * (def.scale || 1) * (inst.scale || 1);
  const turn = af.st.turn || 1;
  const ang = Math.atan2(-hm[2], hm[3]); // screen angle of the hand's "down" axis
  const k = def.hold === 'rotate' ? 1 : 0.12;
  const flip = inst.flip ? -1 : 1;
  let rot = ang * k + (def.hold === 'rotate' ? (Math.sign(turn) * (def.holdAngle || 0) * Math.PI) / 180 : 0);
  if (def.hold !== 'rotate') rot = Math.max(-0.35, Math.min(0.35, rot));
  const g = def.grip || [0, -def.size[1] / 2];
  const M = mul(trs(px, py, (rot * 180) / Math.PI, 1, 1), [turn * flip * sp, 0, 0, sp, 0, 0]);
  return mul(M, [1, 0, 0, 1, -g[0], -g[1]]);
}

function lerpM(a, b, u, uy = u) {
  const o = new Array(6);
  for (let i = 0; i < 4; i++) o[i] = a[i] + (b[i] - a[i]) * u;
  o[4] = a[4] + (b[4] - a[4]) * u;
  o[5] = a[5] + (b[5] - a[5]) * uy;
  return o;
}


/**
 * Work out every visible prop for this frame.
 * frameOf(name, time) -> actor frame {st, rig, char, pose, placement, mats, bg} (memoised by the renderer)
 * Returns { free: [{name, y, front, back, M, def, inst, shadow, ps}], held: {actorName: [{name, hand, M, def, inst, pose}]} }
 */
export function scenePropsAt(scene, assets, lt, bg, frameOf) {
  const out = { free: [], held: {} };
  const lib = assets.props || {};
  for (const name of scene.propOrder || []) {
    const inst = scene.props[name];
    const def = lib[inst.prop];
    if (!def) continue;
    const ps = propState(scene, name, lt);
    if (!ps.visible) continue;
    const at = ps.attach;
    const since = lt - at.t;
    if (at.actor) {
      // in a hand (gliding in from where it was during the first PROP_GRAB seconds)
      const af = frameOf(at.actor, lt);
      if (!af) continue;
      let M = heldMatrix(def, inst, af, at.hand);
      if (since < PROP_GRAB && ps.prevAttach) {
        const M0 = matrixFor(ps.prevAttach, at.t, def, inst, scene, bg, frameOf);
        M = lerpM(M0, M, EASE.smooth(since / PROP_GRAB));
      }
      (out.held[at.actor] ||= []).push({ name, hand: at.hand, M, def, inst, pose: def.handPose || 'fist' });
    } else {
      let M = freeMatrix(def, inst, ps, bg);
      let shadowK = ps.up ? 0 : 1;
      if (since < PROP_FALL && ps.prevAttach && ps.prevAttach.actor) {
        // dropped: fall from the hand to the floor (gravity on y)
        const M0 = matrixFor(ps.prevAttach, at.t, def, inst, scene, bg, frameOf);
        const u = since / PROP_FALL;
        M = lerpM(M0, M, EASE.out(u), u * u);
        shadowK *= u;
      }
      out.free.push({ name, y: ps.y, front: !!inst.front, back: !!inst.back, M, def, inst, shadow: shadowK, ps });
    }
  }
  return out;
}

function matrixFor(attach, t, def, inst, scene, bg, frameOf) {
  if (attach.actor) {
    const af = frameOf(attach.actor, t);
    if (af) return heldMatrix(def, inst, af, attach.hand);
  }
  const ps = propState(scene, attach.name, t - 1e-4);
  return freeMatrix(def, inst, ps, bg);
}

/** Free-standing prop with its soft contact shadow. */
export function drawFreeProp(ctx, P) {
  const { M, def, inst } = P;
  const sw = def.shadow === false ? 0 : def.shadow ?? def.size[0] * 0.42;
  if (sw > 0 && P.shadow > 0) {
    const s = Math.hypot(M[0], M[1]);
    const floorY = P.ps ? M[5] + (P.ps.up || 0) : M[5];
    ctx.save();
    ctx.globalAlpha *= 0.2 * P.shadow;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(M[4], floorY + 3, sw * s, Math.max(4, sw * s * 0.16), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  drawPropAsset(ctx, def, inst, M[0] * M[3] - M[1] * M[2] < 0);
  ctx.restore();
}

export function drawHeldProp(ctx, H) {
  const { M, def, inst } = H;
  ctx.save();
  ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  drawPropAsset(ctx, def, inst, M[0] * M[3] - M[1] * M[2] < 0);
  ctx.restore();
}

/**
 * Draw a character together with what it holds. Hidden behind the torso a far-hand prop would be
 * hard to read, so it is drawn over the body, then the far hand (gripping it) and the whole near arm
 * are re-drawn on top. Props with `behind: true` stay behind the body instead. Near-hand props go
 * over everything and the near hand is re-drawn over the grip.
 */
export function drawActorWithProps(ctx, af, held, drawBody) {
  const behind = held.filter((h) => h.hand === 'F' && h.def.behind);
  const far = held.filter((h) => h.hand === 'F' && !h.def.behind);
  const near = held.filter((h) => h.hand !== 'F');
  const redraw = (key) => drawRig(ctx, subRig(af.rig, key), af.char, af.pose, af.st.face, af.placement);
  for (const h of behind) drawHeldProp(ctx, h);
  drawBody();
  if (far.length) {
    for (const h of far) drawHeldProp(ctx, h);
    redraw('handF');
    redraw('armN');
  }
  if (near.length) {
    for (const h of near) drawHeldProp(ctx, h);
    redraw('handN');
  }
}

// Subsets of a rig's parts for re-drawing over a held prop.
const SUBSETS = {
  handF: (p) => p.bone === 'handF',
  handN: (p) => p.bone === 'handN',
  armN: (p) => p.z >= 100 && p.z < 110, // near arm block (see scripts/rigs/humanoid/common.mjs)
};
const subCache = new WeakMap();
function subRig(rig, key) {
  let m = subCache.get(rig);
  if (!m) subCache.set(rig, (m = {}));
  if (!m[key]) {
    const parts = rig.parts.filter(SUBSETS[key]);
    // keep clip targets so clipped parts still work
    const ids = new Set(parts.map((p) => p.id));
    for (const p of parts) if (p.clip && !ids.has(p.clip)) { const c = rig.parts.find((q) => q.id === p.clip); if (c) { ids.add(c.id); parts.push({ ...c, alpha: 0 }); } }
    m[key] = { ...rig, parts };
  }
  return m[key];
}

/** Bone matrices for an actor frame (cached on the frame object). */
export function frameMats(af) {
  if (!af.mats) af.mats = boneMatrices(af.rig, af.pose, af.placement, resolveBuild(af.rig, af.char));
  return af.mats;
}
