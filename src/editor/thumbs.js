// Little preview canvases for the library, pickers and inspector.
import { drawShape, trs } from '../engine/paint.js';
import { drawRig, poseAt, holdTime } from '../engine/rig.js';
import { STAGE_W, STAGE_H, MOODS } from '../engine/timeline.js';
import { TRANSITIONS } from '../assets/transitions/index.js';

function backdrop(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b3042');
  g.addColorStop(1, '#171a24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
const charOf = (assets, id, extra) => extra?.[id] || assets.characters[id];

export function drawCharacterThumb(canvas, assets, charId, extra) {
  const char = charOf(assets, charId, extra);
  if (!char) return;
  const rig = assets.rigs[char.rig];
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  backdrop(ctx, W, H);
  const s = (H * 0.9) / (rig.height * (char.scale || 1)) * (char.scale || 1);
  const pose = poseAt({ clip: rig.clips.idle, t: 0.8 }, null);
  drawRig(ctx, rig, char, pose, { eyes: 'open', brows: 'neutral', mouth: 'smile' }, trs(W / 2, H * 0.95, 0, s, s));
}

/** A character holding a clip pose at time t (crop: 'body' | 'head'), optionally with a mood face. */
export function drawPoseThumb(canvas, assets, charId, clipId, t = null, { mood, crop = 'body', extra } = {}) {
  const char = charOf(assets, charId, extra);
  if (!char) return;
  const rig = assets.rigs[char.rig];
  const clip = rig.clips[clipId] || rig.clips.idle;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  backdrop(ctx, W, H);
  const tt = t ?? (clip.overlay ? clip.duration * 0.45 : 0.6);
  const layers = clip.overlay ? [{ clip: rig.clips.idle, t: 0.6 }, { clip, t: holdTime(clip, tt, clip.duration), weight: 1 }] : [{ clip, t: tt }];
  const pose = poseAt(layers);
  const m = MOODS[mood || 'neutral'] || MOODS.neutral;
  const face = { eyes: m.eyes, brows: m.brows, mouth: mood ? m.mouth : 'smile' };
  if (mood) { pose.lidN = { scale: [1, m.lid ?? 0.06] }; pose.lidF = { scale: [1, m.lid ?? 0.06] }; }
  if (crop === 'head') {
    const s = (H * 2.3) / rig.height;
    drawRig(ctx, rig, char, pose, face, trs(W / 2 - 6 * s, H * 0.12 + rig.height * s * 0.98, 0, s, s));
  } else {
    const s = (H * 0.8) / rig.height;
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.93, 50 * s, 10 * s, 0, 0, 7); ctx.fill(); ctx.restore();
    drawRig(ctx, rig, char, pose, face, trs(W / 2, H * 0.93, 0, s, s));
  }
}

export function drawSceneThumb(canvas, assets, sceneId) {
  const sc = assets.scenes[sceneId];
  if (!sc) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(canvas.width / STAGE_W, canvas.height / STAGE_H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  for (const layer of sc.layers) drawShape(ctx, layer, null, null);
  if (sc.front) for (const layer of sc.front) drawShape(ctx, layer, null, null);
  ctx.restore();
}

const sceneCache = new Map();
function sceneBitmap(assets, id, w, h) {
  const key = `${id}@${w}x${h}`;
  if (!sceneCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    drawSceneThumb(c, assets, id);
    sceneCache.set(key, c);
  }
  return sceneCache.get(key);
}
/** Transition preview between two backgrounds at progress p (0..1). */
export function drawTransitionThumb(canvas, assets, trId, p = 0.5) {
  const tr = TRANSITIONS[trId];
  const ids = Object.keys(assets.scenes);
  const a = ids.includes('living_room') ? 'living_room' : ids[0];
  const b = ids.includes('street_day') ? 'street_day' : ids[1] || ids[0];
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const A = sceneBitmap(assets, a, W, H), B = sceneBitmap(assets, b, W, H);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  try { tr.draw(ctx, W, H, p, () => ctx.drawImage(A, 0, 0), () => ctx.drawImage(B, 0, 0)); } catch { ctx.drawImage(p < 0.5 ? A : B, 0, 0); }
  ctx.restore();
}
