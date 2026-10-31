// Where is each actor on screen? Mirrors the placement maths in engine/renderer.js (pure).
import { actorState, cameraAt, windowsAt, STAGE_W, STAGE_H } from '../engine/timeline.js';

/** Camera transform for a scene at local time lt: stage point (scene space) -> screen (stage px). */
export function cameraFor(scene, lt) {
  const cam = cameraAt(scene, lt);
  const z = Math.max(1, cam.zoom);
  const fx = Math.min(Math.max((cam.x / 100) * STAGE_W, STAGE_W / (2 * z)), STAGE_W - STAGE_W / (2 * z));
  const fy = Math.min(Math.max((cam.y / 100) * STAGE_H, STAGE_H / (2 * z)), STAGE_H - STAGE_H / (2 * z));
  return {
    z, fx, fy,
    toScreen: (x, y) => [(x - fx) * z + STAGE_W / 2, (y - fy) * z + STAGE_H / 2],
    toScene: (sx, sy) => [(sx - STAGE_W / 2) / z + fx, (sy - STAGE_H / 2) / z + fy],
  };
}

/**
 * Screen boxes (stage px, 1920x1080) for the visible actors of the scene showing at global time t.
 * Returns { sceneIndex, lt, cam, boxes: [{name, char, x, y, w, h, footX, footY, xPct, depth}] } — front-most last.
 */
export function actorBoxes(film, assets, t) {
  if (!film || !film.scenes.length) return { sceneIndex: -1, boxes: [] };
  const wins = windowsAt(film, t);
  const w = wins[wins.length - 1];
  const scene = w.scene;
  const bg = assets.scenes[scene.bg];
  const cam = cameraFor(scene, w.lt);
  const boxes = [];
  scene.castOrder.forEach((name, idx) => {
    const st = actorState(scene, name, w.lt);
    if (!st.visible) return;
    const c = scene.cast[name];
    const char = film.characters?.[c.char] || assets.characters[c.char];
    const rig = char && assets.rigs[char.rig];
    if (!rig) return;
    const s = (char.scale || 1) * (c.scale || 1) * (rig.displayScale || 0.85) * (1 + st.y * 0.002);
    const floor = (bg?.floorY ?? 800) + st.y * 2;
    const h = (rig.height || 420) * s * 1.06;
    const wd = h * 0.42;
    const [sx, sy] = cam.toScreen(st.x, floor);
    boxes.push({ name, char: c.char, idx, depth: st.y, x: sx - (wd * cam.z) / 2, y: sy - h * cam.z, w: wd * cam.z, h: h * cam.z + 10 * cam.z, footX: sx, footY: sy, xPct: (st.x / STAGE_W) * 100, yDepth: st.y, facing: st.facing });
  });
  boxes.sort((a, b) => a.depth - b.depth || a.idx - b.idx);
  return { sceneIndex: w.index, lt: w.lt, cam, boxes };
}

/** Front-most actor under a stage-space point, or null. */
export function hitActor(info, px, py) {
  for (let i = info.boxes.length - 1; i >= 0; i--) {
    const b = info.boxes[i];
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b;
  }
  return null;
}

/** Has this actor done anything that moves or reveals them before local time lt? (decides cast-edit vs walk) */
export function actorTouchedBefore(scene, name, lt) {
  return scene.events.some((e) => e.actor === name && (e.type === 'move' || e.type === 'show') && e.t < lt - 1e-3);
}
