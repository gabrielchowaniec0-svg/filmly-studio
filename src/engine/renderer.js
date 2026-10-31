// renderFrame(): the single entry point used by the editor preview AND the MP4 exporter.
import { drawShape, trs, mul, IDENT } from './paint.js';
import { drawRig, poseAt, applyOverrides, holdTime } from './rig.js';
import { actorState, captionsAt, cameraAt, windowsAt, STAGE_W, STAGE_H } from './timeline.js';
import { TRANSITIONS } from '../assets/transitions/index.js';
import { heldBy, effectsAt } from './timeline.js';
import { scenePropsAt, drawFreeProp, drawActorWithProps } from './props.js';
import { EFFECTS } from '../assets/effects/index.js';

/**
 * assets = { rigs:{id:rig}, characters:{id:char}, scenes:{id:scene} }
 * ctx must be a 2D context (canvas or OffscreenCanvas) already scaled so the stage is 1920x1080.
 */
export function renderFrame(ctx, film, assets, t) {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  const wins = windowsAt(film, t);
  if (wins.length === 1) {
    drawScene(ctx, film, assets, wins[0].scene, wins[0].lt);
  } else {
    const a = wins[0], b = wins[wins.length - 1];
    const tr = TRANSITIONS[b.scene.transitionIn?.type] || TRANSITIONS.fade;
    tr.draw(
      ctx, STAGE_W, STAGE_H, b.progress,
      () => drawScene(ctx, film, assets, a.scene, a.lt),
      () => drawScene(ctx, film, assets, b.scene, b.lt),
    );
  }
  const fi = film.fadeIn || 0, fo = film.fadeOut || 0;
  let black = 0;
  if (fi > 0 && t < fi) black = Math.max(black, 1 - t / fi);
  if (fo > 0 && t > film.duration - fo) black = Math.max(black, (t - (film.duration - fo)) / fo);
  if (black > 0) {
    ctx.globalAlpha = Math.min(1, black);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }
  ctx.restore();
}

function drawScene(ctx, film, assets, scene, lt) {
  const bg = assets.scenes[scene.bg];
  if (!bg) throw new Error(`Unknown scene background "${scene.bg}"`);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, STAGE_W, STAGE_H);
  ctx.clip();

  // camera
  const cam = cameraAt(scene, lt);
  const z = Math.max(1, cam.zoom);
  const fx = Math.min(Math.max((cam.x / 100) * STAGE_W, STAGE_W / (2 * z)), STAGE_W - STAGE_W / (2 * z));
  const fy = Math.min(Math.max((cam.y / 100) * STAGE_H, STAGE_H / (2 * z)), STAGE_H - STAGE_H / (2 * z));
  ctx.translate(STAGE_W / 2, STAGE_H / 2);
  ctx.scale(z, z);
  ctx.translate(-fx, -fy);

  for (const layer of bg.layers) drawShape(ctx, layer, null, null);

  // actors and props, back to front (props marked `back` first, `front` last)
  const frames = new Map();
  const frameOf = (name, time) => {
    const key = name + '@' + time;
    if (!frames.has(key)) frames.set(key, scene.cast[name] ? actorFrame(film, assets, scene, bg, name, time) : null);
    return frames.get(key);
  };
  const props = scene.propOrder && scene.propOrder.length ? scenePropsAt(scene, assets, lt, bg, frameOf) : null;
  const items = [];
  scene.castOrder.forEach((name, idx) => {
    const af = frameOf(name, lt);
    if (af.st.visible) items.push({ y: af.st.y, rank: 1, idx, af });
  });
  if (props) props.free.forEach((P, idx) => items.push({ y: P.y, rank: P.back ? 0 : P.front ? 2 : 1, idx: -1000 + idx, P }));
  items.sort((a, b) => a.rank - b.rank || a.y - b.y || a.idx - b.idx);
  for (const it of items) {
    if (it.P) { drawFreeProp(ctx, it.P); continue; }
    const af = it.af;
    const held = props?.held[af.name];
    if (held) drawActorWithProps(ctx, af, held, () => drawActor(ctx, af));
    else drawActor(ctx, af);
  }
  ctx.restore();

  drawEffects(ctx, scene, lt, frameOf);
  drawCaptions(ctx, captionsAt(scene, lt));
}

/** Everything needed to draw (or attach props to) one actor at scene time lt. */
function actorFrame(film, assets, scene, bg, name, lt) {
  const st = actorState(scene, name, lt);
  const c = scene.cast[name];
  const char = (film.characters && film.characters[c.char]) || assets.characters[c.char];
  const rig = assets.rigs[char.rig];
  const layers = [];
  for (const L of st.layers) {
    const clip = rig.clips[L.clip] || (layers.length ? null : rig.clips.idle);
    if (!clip) continue;
    layers.push({ clip, t: L.hold != null ? holdTime(clip, L.t, L.hold) : L.t, weight: L.weight });
  }
  const pose = applyOverrides(poseAt(layers), { gaze: { pos: st.gaze } });
  pose.lidN = { ...(pose.lidN || {}), scale: [1, st.lid] };
  pose.lidF = { ...(pose.lidF || {}), scale: [1, st.lid] };
  if (scene.propOrder && scene.propOrder.length) {
    // a hand holding a prop closes into a fist (or stays open for trays, plates…)
    const h = heldBy(scene, name, lt);
    for (const hand of ['F', 'N']) {
      if (!h[hand]) continue;
      const def = assets.props?.[scene.props[h[hand]].prop];
      pose.__slots = { ...(pose.__slots || {}), ['hand' + hand]: def?.handPose || 'fist' };
    }
  }
  const depthScale = 1 + st.y * 0.002;
  const s = (char.scale || 1) * (c.scale || 1) * (rig.displayScale || 0.85) * depthScale;
  const floor = bg.floorY + st.y * 2;
  const placement = trs(st.x, floor, 0, s * st.turn, s);
  return { name, st, c, char, rig, pose, s, floor, placement, bg, mats: null };
}

function drawActor(ctx, af) {
  const { st, s, floor, pose } = af;
  // soft contact shadow (shrinks when airborne)
  const lift = -(pose.root?.pos?.[1] || 0);
  const k = Math.max(0.4, 1 - lift / 260);
  ctx.save();
  ctx.globalAlpha = 0.22 * k;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(st.x, floor + 4, 64 * s * k, 13 * s * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawRig(ctx, af.rig, af.char, pose, st.face, af.placement);
}

/** Screen effects (rain, fog, grades…) over the scene, in layer order. Seeded per scene + effect. */
function drawEffects(ctx, scene, lt, frameOf) {
  const list = effectsAt(scene, lt);
  if (!list.length) return;
  const sorted = list.map((e, i) => ({ e, i, fx: EFFECTS[e.id] })).filter((x) => x.fx).sort((a, b) => (a.fx.layer || 0) - (b.fx.layer || 0) || a.i - b.i);
  for (const { e, fx } of sorted) {
    let opts = { ...e.opts, amount: e.amount };
    if (e.opts.follow) {
      const af = frameOf(e.opts.follow, lt);
      if (af) opts = { ...opts, x: (af.st.x / STAGE_W) * 100 };
    }
    ctx.save();
    fx.draw(ctx, STAGE_W, STAGE_H, lt, opts, seedOf(scene.id + ':' + e.id));
    ctx.restore();
  }
}
function seedOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 100003;
}

const FONT = '"Segoe UI", Inter, system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';

function drawCaptions(ctx, caps) {
  for (const c of caps) {
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const title = c.style === 'title';
    const size = title ? 120 : 52;
    ctx.font = `${title ? 800 : 700} ${size}px ${FONT}`;
    const y = c.pos === 'top' ? 130 : c.pos === 'center' || title ? STAGE_H / 2 : STAGE_H - 110;
    if (!title) {
      const w = ctx.measureText(c.text).width + 70;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.roundRect(STAGE_W / 2 - w / 2, y - size * 0.8, w, size * 1.6, 20);
      ctx.fill();
    }
    ctx.lineWidth = title ? 14 : 8;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    if (title) ctx.strokeText(c.text, STAGE_W / 2, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(c.text, STAGE_W / 2, y);
    ctx.restore();
  }
}
