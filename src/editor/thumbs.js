// Little preview canvases for the asset browser.
import { drawShape, trs } from '../engine/paint.js';
import { drawRig, poseAt } from '../engine/rig.js';
import { STAGE_W, STAGE_H } from '../engine/timeline.js';

export function drawCharacterThumb(canvas, assets, charId) {
  const char = assets.characters[charId];
  const rig = assets.rigs[char.rig];
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b3042');
  g.addColorStop(1, '#171a24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const s = (H * 0.9) / (rig.height * (char.scale || 1)) * (char.scale || 1);
  const pose = poseAt({ clip: rig.clips.idle, t: 0.8 }, null);
  drawRig(ctx, rig, char, pose, { eyes: 'open', brows: 'neutral', mouth: 'smile' }, trs(W / 2, H * 0.95, 0, s, s));
}

export function drawSceneThumb(canvas, assets, sceneId) {
  const sc = assets.scenes[sceneId];
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(canvas.width / STAGE_W, canvas.height / STAGE_H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  for (const layer of sc.layers) drawShape(ctx, layer, null, null);
  if (sc.front) for (const layer of sc.front) drawShape(ctx, layer, null, null);
  ctx.restore();
}
