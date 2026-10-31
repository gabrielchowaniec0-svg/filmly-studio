// renderFrame(): the single entry point used by the editor preview AND the MP4 exporter.
import { drawShape, trs, mul, IDENT } from './paint.js';
import { drawRig, poseAt, applyOverrides, holdTime } from './rig.js';
import { actorState, captionsAt, cameraAt, windowsAt, STAGE_W, STAGE_H } from './timeline.js';
import { TRANSITIONS } from '../assets/transitions/index.js';

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

  // actors, back to front
  const states = [];
  scene.castOrder.forEach((name, idx) => {
    const st = actorState(scene, name, lt);
    if (st.visible) states.push({ name, st, idx });
  });
  states.sort((a, b) => a.st.y - b.st.y || a.idx - b.idx);
  for (const { name, st } of states) {
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
    const depthScale = 1 + st.y * 0.002;
    const s = (char.scale || 1) * (c.scale || 1) * (rig.displayScale || 0.85) * depthScale;
    const floor = bg.floorY + st.y * 2;
    const placement = trs(st.x, floor, 0, s * st.turn, s);
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
    drawRig(ctx, rig, char, pose, st.face, placement);
  }
  // optional foreground layer of the background (drawn over the characters)
  if (bg.front) for (const layer of bg.front) drawShape(ctx, layer, null, null);
  ctx.restore();

  drawCaptions(ctx, captionsAt(scene, lt));
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
