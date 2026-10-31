// One-point-perspective room shell: back wall, optional side walls + ceiling strip, floor, baseboards,
// ambient occlusion. Returns { layers, P, sw, x0, x1 } where x0..x1 is the back wall span.
import { W, H, rect, poly, path, vgrad, lin, band, persp, sPlanks, sChecker, sGrid, range, shade, rgba } from './lib.mjs';

export function room({
  yTop = 700, hY = 380, vx = W / 2, sw = 0, ceil = 0,
  wall = '#efe3cf', wallTop, floor = '#b98a5c', floorNear, floorKind = 'planks', plankW = 120, plankRows = 7,
  tile = null, base = '#ffffff', baseH = 26, sideShade = -14, ceilColor,
}) {
  const P = persp({ yTop, hY, vx });
  const x0 = sw, x1 = W - sw;
  const L = [];
  // seam y where the side-wall/floor line leaves the frame
  const yL = sw ? hY + (yTop - hY) * (vx / (vx - sw)) : yTop;
  const yR = sw ? hY + (yTop - hY) * ((W - vx) / (W - vx - sw)) : yTop;
  const cyL = sw ? hY + (ceil - hY) * (vx / (vx - sw)) : 0;
  const cyR = sw ? hY + (ceil - hY) * ((W - vx) / (W - vx - sw)) : 0;
  L.push(rect(0, 0, W, yTop + 4, vgrad(0, yTop, wallTop || shade(wall, -6), wall)));
  // floor
  const fl = [[0, yL], [x0, yTop], [x1, yTop], [W, yR], [W, H], [0, H]];
  L.push(poly(fl, vgrad(yTop, H, shade(floor, -12), floorNear || shade(floor, 6))));
  if (floorKind === 'planks') {
    L.push(path(sPlanks(P, range(x0, x1, plankW), plankRows), null, { stroke: shade(floor, -30), lw: 3, alpha: 0.55 }));
  } else if (floorKind === 'checker') {
    L.push(path(sChecker(P, range(x0 - 0, x1, tile.w), tile.rows, 0), tile.color, { alpha: tile.alpha ?? 1 }));
  } else if (floorKind === 'tiles') {
    L.push(path(sGrid(P, range(x0, x1, tile.w), tile.rows), null, { stroke: tile.color, lw: 2.5, alpha: tile.alpha ?? 0.6 }));
  }
  // back-wall baseboard + AO
  L.push(band(0, yTop, W, 70, '#000000', 0.2));
  L.push(rect(x0, yTop - baseH, x1 - x0, baseH, base, { stroke: shade(base, -30), lw: 2 }));
  L.push(band(x0, yTop - baseH, x1 - x0, -40, '#000000', 0.06));
  if (sw) {
    // side walls (slightly darker), with ceiling strip
    const sideL = [[0, cyL], [x0, ceil], [x0, yTop], [0, yL]];
    const sideR = [[W, cyR], [x1, ceil], [x1, yTop], [W, yR]];
    const sc = shade(wall, sideShade);
    L.push(poly(sideL, lin(0, 0, x0, 0, shade(sc, -10), sc)));
    L.push(poly(sideR, lin(W, 0, x1, 0, shade(sc, -10), sc)));
    // side baseboards
    const bh = baseH * 1.15;
    L.push(poly([[0, yL - bh * 1.2], [x0, yTop - baseH], [x0, yTop], [0, yL]], shade(base, -10), { stroke: shade(base, -35), lw: 2 }));
    L.push(poly([[W, yR - bh * 1.2], [x1, yTop - baseH], [x1, yTop], [W, yR]], shade(base, -10), { stroke: shade(base, -35), lw: 2 }));
    // corner lines
    L.push(path(`M${x0} ${ceil}L${x0} ${yTop}M${x1} ${ceil}L${x1} ${yTop}`, null, { stroke: rgba('#000000', 0.18), lw: 3 }));
    if (ceil > 0) L.push(poly([[0, 0], [W, 0], [W, cyR], [x1, ceil], [x0, ceil], [0, cyL]], ceilColor || shade(wall, -22)));
  }
  return { layers: L, P, sw, x0, x1, yL, yR };
}
