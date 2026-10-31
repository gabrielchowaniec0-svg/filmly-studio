// Shared helpers for the humanoid rig modules. Each module receives a `ctx` with these helpers and
// pushes parts into the same list. Draw order is by z (then insertion order). z ranges:
//   5      back hair / ponytail (behind everything)      10-15  far arm         20-25  far leg
//   30-35  near leg       40-43  hips / bottoms          48-59  neck, torso, tops, hood
//   65     bun            70-73  head, ears, cheeks       80-89  eyes, nose, facial hair
//   90-93  mouth, brows   95     front hair               97     eyewear     98-99  headwear
//   100-105 near arm (in front of the body)
export function makeCtx() {
  const parts = [];
  const P = (id, bone, z, shape, extra = {}) => parts.push({ id, bone, z, shape, ...extra });
  const rect = (x, y, w, h, r = 0) => ({ type: 'rect', x, y, w, h, ...(r ? { r } : {}) });
  const ell = (cx, cy, rx, ry, rot) => ({ type: 'ellipse', cx, cy, rx, ry, ...(rot ? { rot } : {}) });
  const path = (d) => ({ type: 'path', d });
  const NOSTROKE = { stroke: null };
  return { parts, P, rect, ell, path, NOSTROKE, bumpy, shiftY };
}

/** Bumpy arc path (curly hair, clouds): angles in degrees, canvas convention (0 = +x, clockwise). */
export function bumpy(cx, cy, r, a0, a1, n, bump) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const am = ((a0 + ((a1 - a0) * (i - 0.5)) / n) * Math.PI) / 180;
    const c = [cx + (r + bump) * Math.cos(am), cy + (r + bump) * Math.sin(am)];
    d += ` Q ${c[0].toFixed(1)} ${c[1].toFixed(1)} ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  }
  return d;
}
/** Shift every y coordinate of an SVG path (absolute-coordinate paths only). */
export const shiftY = (d, dy) => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${x} ${(+y + dy).toFixed(1).replace(/\.0$/, '')}`);
