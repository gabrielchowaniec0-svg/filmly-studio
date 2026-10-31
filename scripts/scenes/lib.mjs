// Shared helpers for the scene (background) generators. Every helper returns plain shape objects
// understood by src/engine/paint.js, or SVG sub-path strings that can be merged into one `path` shape
// (fewer, larger paths keep per-frame cost low).
import { shade } from '../../src/engine/paint.js';

export const W = 1920, H = 1080;
export { shade };
const n = (v) => Math.round(v * 10) / 10;

/** Deterministic PRNG so generated JSON is stable between runs. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---- fills -------------------------------------------------------------------------------
const stopList = (stops) => stops.map((s, i) => (Array.isArray(s) ? s : [stops.length === 1 ? 0 : n(i / (stops.length - 1) * 1000) / 1000, s]));
export const lin = (x0, y0, x1, y1, ...stops) => ({ stops: stopList(stops), x0: n(x0), y0: n(y0), x1: n(x1), y1: n(y1) });
export const vgrad = (y0, y1, ...stops) => lin(0, y0, 0, y1, ...stops);
export const rad = (cx, cy, r, ...stops) => ({ radial: true, stops: stopList(stops), cx: n(cx), cy: n(cy), r: n(r) });
export const rgba = (hex, a) => {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
};

// ---- shapes ------------------------------------------------------------------------------
const clean = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
export const rect = (x, y, w, h, fill, o = {}) => clean({ type: 'rect', x: n(x), y: n(y), w: n(w), h: n(h), fill, ...o });
export const ell = (cx, cy, rx, ry, fill, o = {}) => clean({ type: 'ellipse', cx: n(cx), cy: n(cy), rx: n(rx), ry: n(ry), fill, ...o });
export const poly = (pts, fill, o = {}) => clean({ type: 'poly', points: pts.map(([x, y]) => [n(x), n(y)]), fill, ...o });
export const path = (d, fill, o = {}) => clean({ type: 'path', d: Array.isArray(d) ? d.join('') : d, fill, ...o });
/** Filled union of overlapping sub-paths with a single clean outer outline (stroke underlay + fill). */
export const outlined = (d, fill, stroke, lw = 4, o = {}) => [path(d, null, { stroke, lw: lw * 2, ...o }), path(d, fill, o)];
/** Stroke-only path. */
export const line = (d, stroke, lw, o = {}) => path(d, null, { stroke, lw, ...o });

// ---- sub-path builders (strings) ---------------------------------------------------------
// circles/ellipses wind clockwise like rects, so overlapping sub-paths union under the nonzero rule
export const sCirc = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 1 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 1 ${n(-2 * r)} 0Z`;
export const sEll = (cx, cy, rx, ry) => `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 1 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 1 ${n(-2 * rx)} 0Z`;
export const sRect = (x, y, w, h) => `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
export const sPoly = (pts) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'Z';
export const sLine = (x0, y0, x1, y1) => `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
export function sRR(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}v${n(h - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}h${n(-(w - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}v${n(-(h - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}Z`;
}
/** Arched window/door: rect with a semicircular top. */
export function sArch(x, y, w, h) {
  const r = w / 2;
  return `M${n(x)} ${n(y + h)}V${n(y + r)}a${n(r)} ${n(r)} 0 0 1 ${n(w)} 0V${n(y + h)}Z`;
}
/** Smooth closed curve through points (Catmull-Rom style via quadratic midpoints). */
export function sSmooth(pts, closed = true) {
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (!closed) {
    let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) { const q = m(pts[i], pts[i + 1]); d += `Q${n(pts[i][0])} ${n(pts[i][1])} ${n(q[0])} ${n(q[1])}`; }
    const L = pts[pts.length - 1];
    return d + `L${n(L[0])} ${n(L[1])}`;
  }
  const s = m(pts[pts.length - 1], pts[0]);
  let d = `M${n(s[0])} ${n(s[1])}`;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = m(p, pts[(i + 1) % pts.length]); d += `Q${n(p[0])} ${n(p[1])} ${n(q[0])} ${n(q[1])}`; }
  return d + 'Z';
}
/** Rolling ridge across [x0,x1] around baseline y with amplitude amp, closed down to yBottom. */
export function sRidge(seed, y, amp, { x0 = -40, x1 = W + 40, step = 160, yBottom = H, jag = false } = {}) {
  const r = rng(seed);
  const pts = [];
  for (let x = x0; x <= x1 + step; x += step * (0.7 + r() * 0.6)) pts.push([Math.min(x, x1), y - r() * amp]);
  if (jag) return sPoly([[x0, yBottom], ...pts, [x1, yBottom]]);
  const top = sSmooth([[x0, pts[0][1]], ...pts, [x1, pts[pts.length - 1][1]]], false);
  return top + `L${x1} ${yBottom}L${x0} ${yBottom}Z`;
}
/** Puffy cloud / bush / tree-crown made of overlapping circles (same winding, so it unions). */
export function sPuff(cx, cy, w, h, seed = 1, k = 6, flatBottom = true) {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < k; i++) {
    const t = k === 1 ? 0.5 : i / (k - 1);
    const x = cx - w / 2 + w * (0.15 + 0.7 * t);
    const bump = Math.sin(Math.PI * t);
    const rr = h * (0.35 + 0.35 * bump) * (0.85 + r() * 0.3);
    const y = cy + h / 2 - rr - bump * h * 0.15 * r() - (flatBottom ? 0 : (r() - 0.5) * h * 0.3);
    d += sCirc(x, y, rr);
  }
  if (flatBottom) d += sRR(cx - w * 0.42, cy + h * 0.1, w * 0.84, h * 0.4, h * 0.2);
  return d;
}
/** Star field: many tiny circles in one path. */
export function sStars(seed, count, { x0 = 0, x1 = W, y0 = 0, y1 = 600, rMin = 1.2, rMax = 3.4 } = {}) {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) d += sCirc(x0 + r() * (x1 - x0), y0 + Math.pow(r(), 1.4) * (y1 - y0), rMin + r() * r() * (rMax - rMin));
  return d;
}
/** Four-point twinkle star. */
export const sSparkle = (x, y, s) => `M${n(x)} ${n(y - s)}Q${n(x)} ${n(y)} ${n(x + s)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y + s)}Q${n(x)} ${n(y)} ${n(x - s)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y - s)}Z`;

// ---- composite helpers (return shape arrays) ---------------------------------------------
/** Soft blurry ground shadow built from 3 stacked low-alpha ellipses. */
export function shadow(cx, cy, rx, ry, a = 0.22, color = '#000000') {
  return [ell(cx, cy, rx * 1.15, ry * 1.25, color, { alpha: a * 0.35 }), ell(cx, cy, rx, ry, color, { alpha: a * 0.45 }), ell(cx, cy, rx * 0.75, ry * 0.7, color, { alpha: a * 0.5 })];
}
/** Glow: radial gradient disc fading to transparent. */
export const glow = (cx, cy, r, color, a = 0.6) => ell(cx, cy, r, r, rad(cx, cy, r, [0, rgba(color, a)], [0.45, rgba(color, a * 0.35)], [1, rgba(color, 0)]));
/** Elliptical glow pool (e.g. light on the floor). */
export function pool(cx, cy, rx, ry, color, a = 0.35, k = 14) {
  // radial gradients are circular; approximate an elliptical fade with a stack of faint ellipses
  return Array.from({ length: k }, (_, i) => { const f = 1 - i / k; return ell(cx, cy, rx * f, ry * f, color, { alpha: Math.round((a / k) * 1000) / 1000 }); });
}
/** Vignette over the whole frame. */
export const vignette = (a = 0.45, color = '#000000', inner = 0.55) => rect(0, 0, W, H, rad(W / 2, H * 0.48, W * 0.62, [0, rgba(color, 0)], [inner, rgba(color, 0)], [1, rgba(color, a)]));
/** Horizontal soft band (ambient occlusion along a seam). Positive h fades downward, negative upward. */
export const band = (x, y, w, h, color, a) => (h > 0 ? rect(x, y, w, h, vgrad(y, y + h, [0, rgba(color, a)], [1, rgba(color, 0)])) : rect(x, y + h, w, -h, vgrad(y, y + h, [0, rgba(color, a)], [1, rgba(color, 0)])));

// ---- perspective floor ---------------------------------------------------------------------
/** Perspective helper for a floor plane whose far edge (wall seam) is at yTop, eye height at hY, vanishing x vx. */
export function persp({ yTop, hY = 380, vx = W / 2 }) {
  const px = (X, y) => vx + (X - vx) * (y - hY) / (yTop - hY); // X measured at the seam
  // rows spaced evenly in world depth (y = hY + k/d)
  const rows = (count, yEnd = H + 10) => {
    const a = 1 / (yTop - hY), b = 1 / (yEnd - hY);
    return Array.from({ length: count + 1 }, (_, i) => hY + 1 / (a + (b - a) * (i / count)));
  };
  return { px, rows, yTop, hY, vx };
}
/** Planks / floor seams: lines converging on the vanishing point, plus a few cross joints. */
export function sPlanks(P, xs, crossRows = 0, seed = 3) {
  let d = '';
  for (const X of xs) d += sLine(P.px(X, P.yTop), P.yTop, P.px(X, H + 10), H + 10);
  if (crossRows) {
    const r = rng(seed);
    const ys = P.rows(crossRows);
    for (let j = 1; j < ys.length - 1; j++)
      for (let i = 0; i < xs.length - 1; i++) {
        if (r() > 0.45) continue;
        d += sLine(P.px(xs[i], ys[j]), ys[j], P.px(xs[i + 1], ys[j]), ys[j]);
      }
  }
  return d;
}
/** Checkerboard cells (only the alternate cells) for tiles. */
export function sChecker(P, xs, rowCount, parity = 0) {
  const ys = P.rows(rowCount);
  let d = '';
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      if ((i + j) % 2 !== parity) continue;
      const y0 = ys[j], y1 = ys[j + 1];
      d += sPoly([[P.px(xs[i], y0), y0], [P.px(xs[i + 1], y0), y0], [P.px(xs[i + 1], y1), y1], [P.px(xs[i], y1), y1]]);
    }
  return d;
}
/** Grid lines for tiles. */
export function sGrid(P, xs, rowCount) {
  let d = sPlanks(P, xs);
  for (const y of P.rows(rowCount).slice(1)) d += sLine(P.px(xs[0], y), y, P.px(xs[xs.length - 1], y), y);
  return d;
}
/** Perspective rug/carpet as a quad on the floor: X range at the seam scale, between two y values. */
export const floorQuad = (P, X0, X1, y0, y1) => [[P.px(X0, y0), y0], [P.px(X1, y0), y0], [P.px(X1, y1), y1], [P.px(X0, y1), y1]];
export const range = (a, b, step) => { const o = []; for (let v = a; v <= b + 1e-6; v += step) o.push(v); return o; };

// ---- reusable props --------------------------------------------------------------------------
/** A framed window. view: array of shapes drawn inside (already positioned). Returns shapes. */
export function windowFrame(x, y, w, h, { frame = '#f4efe6', sill = true, cols = 2, rows = 2, view = [], glass = 'rgba(255,255,255,0.18)', fw = 18, arch = false, outline = null } = {}) {
  const out = [];
  const inner = arch ? sArch(x, y, w, h) : sRect(x, y, w, h);
  out.push(path(inner, frame, outline ? { stroke: outline, lw: 4 } : {}));
  // view clipped by drawing inside the opening (caller keeps view within bounds)
  out.push(...view);
  out.push(path(arch ? sArch(x + 6, y + 6, w - 12, h - 12) : sRect(x + 6, y + 6, w - 12, h - 12), lin(x, y, x + w, y + h, [0, glass], [0.5, 'rgba(255,255,255,0)'], [0.62, rgba('#ffffff', 0.12)], [1, 'rgba(255,255,255,0)'])));
  // mullions as one path with a frame-coloured stroke
  let d = '';
  for (let i = 1; i < cols; i++) d += sLine(x + (w * i) / cols, y + (arch ? w / 2 : 0), x + (w * i) / cols, y + h);
  for (let j = 1; j < rows; j++) d += sLine(x, y + (h * j) / rows, x + w, y + (h * j) / rows);
  if (arch) d += sLine(x + w / 2, y, x + w / 2, y + h);
  out.push(path((arch ? sArch(x, y, w, h) : sRect(x, y, w, h)) + d, null, { stroke: frame, lw: fw }));
  if (outline) out.push(path(arch ? sArch(x - fw / 2, y - fw / 2, w + fw, h + fw) : sRect(x - fw / 2, y - fw / 2, w + fw, h + fw), null, { stroke: outline, lw: 3 }));
  if (sill) out.push(rect(x - 30, y + h + fw / 2 - 2, w + 60, 20, frame, { r: 4, stroke: outline || shade(frame.startsWith('#') ? frame : '#cccccc', -25), lw: 3 }), band(x - 30, y + h + fw / 2 + 18, w + 60, 26, '#000000', 0.14));
  return out;
}
/** Simple picture frame with inner art shapes. */
export function picture(x, y, w, h, { frame = '#8a5a34', mat = '#f7f1e3', art = [], fw = 14 } = {}) {
  return [
    rect(x + 8, y + 10, w, h, '#000000', { alpha: 0.14, r: 4 }),
    rect(x, y, w, h, frame, { r: 4, stroke: shade(frame, -35), lw: 3 }),
    rect(x + fw, y + fw, w - 2 * fw, h - 2 * fw, mat),
    ...art,
  ];
}
/** Potted plant (pot base at x,y bottom centre). */
export function plant(x, y, s = 1, { pot = '#c46a43', leaf = '#4f9a5a', seed = 7 } = {}) {
  const r = rng(seed);
  let leaves = '', leaves2 = '';
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i / 8 - 0.5) * 2.4 + (r() - 0.5) * 0.2;
    const L = (90 + r() * 70) * s;
    const ex = x + Math.cos(a) * L, ey = y - 90 * s + Math.sin(a) * L;
    const bx = x, by = y - 90 * s;
    const nx = -Math.sin(a) * 22 * s, ny = Math.cos(a) * 22 * s;
    const leaf1 = `M${n(bx)} ${n(by)}Q${n((bx + ex) / 2 + nx)} ${n((by + ey) / 2 + ny)} ${n(ex)} ${n(ey)}Q${n((bx + ex) / 2 - nx)} ${n((by + ey) / 2 - ny)} ${n(bx)} ${n(by)}Z`;
    if (i % 2) leaves += leaf1; else leaves2 += leaf1;
  }
  return [
    ...shadow(x, y, 70 * s, 12 * s, 0.25),
    path(leaves2, shade(leaf, -18), { stroke: shade(leaf, -45), lw: 3 }),
    path(leaves, leaf, { stroke: shade(leaf, -45), lw: 3 }),
    poly([[x - 52 * s, y - 100 * s], [x + 52 * s, y - 100 * s], [x + 40 * s, y], [x - 40 * s, y]], lin(x - 52 * s, 0, x + 52 * s, 0, pot, shade(pot, -25)), { stroke: shade(pot, -45), lw: 3 }),
    rect(x - 58 * s, y - 108 * s, 116 * s, 22 * s, shade(pot, 8), { r: 6 * s, stroke: shade(pot, -45), lw: 3 }),
  ];
}
/** Bookshelf books packed along a shelf; returns {d by color index}. Merges into caller-provided buckets. */
export function packBooks(buckets, x0, x1, yBase, hMin, hMax, seed) {
  const r = rng(seed);
  let x = x0;
  while (x < x1 - 14) {
    const w = 16 + r() * 22;
    if (x + w > x1) break;
    const h = hMin + r() * (hMax - hMin);
    const k = Math.floor(r() * buckets.length);
    if (r() < 0.08 && x + h < x1) {
      // a book lying flat
      buckets[k] += sRect(x, yBase - w, h, w);
      x += h + 4;
      continue;
    }
    const lean = r() < 0.06 ? 10 : 0;
    buckets[k] += lean ? sPoly([[x, yBase], [x + w, yBase], [x + w + lean, yBase - h], [x + lean, yBase - h]]) : sRect(x, yBase - h, w, h);
    x += w + 2 + lean;
  }
}
/** Tree with a trunk and puffy crown. */
export function tree(x, yBase, s = 1, { trunk = '#7a5236', leaf = '#5aa25a', seed = 11, outline = null } = {}) {
  const ol = outline || shade(leaf, -45);
  const th = 230 * s;
  return [
    ...shadow(x, yBase, 130 * s, 20 * s, 0.25),
    path(`M${n(x - 22 * s)} ${n(yBase)}Q${n(x - 14 * s)} ${n(yBase - th * 0.6)} ${n(x - 10 * s)} ${n(yBase - th)}L${n(x + 10 * s)} ${n(yBase - th)}Q${n(x + 14 * s)} ${n(yBase - th * 0.6)} ${n(x + 24 * s)} ${n(yBase)}Z` +
      `M${n(x - 4 * s)} ${n(yBase - th * 0.55)}L${n(x - 60 * s)} ${n(yBase - th * 0.95)}L${n(x - 48 * s)} ${n(yBase - th)}L${n(x + 2 * s)} ${n(yBase - th * 0.7)}Z`, lin(x - 24 * s, 0, x + 24 * s, 0, trunk, shade(trunk, -30)), { stroke: shade(trunk, -45), lw: 3 }),
    ...outlined(sPuff(x, yBase - th - 70 * s, 320 * s, 260 * s, seed, 6, false), shade(leaf, -14), ol, 4),
    path(sPuff(x - 20 * s, yBase - th - 110 * s, 230 * s, 190 * s, seed + 1, 5, false), leaf),
    path(sPuff(x - 50 * s, yBase - th - 150 * s, 120 * s, 100 * s, seed + 2, 3, false), shade(leaf, 18)),
  ];
}
/** Pine tree: stacked triangles. */
export function sPine(x, yBase, h, w) {
  let d = '';
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t0 = yBase - h * 0.12 - (h * 0.88 * i) / tiers;
    const ww = w * (1 - i * 0.2);
    d += sPoly([[x - ww / 2, t0], [x, t0 - h * 0.42], [x + ww / 2, t0]]);
  }
  d += sRect(x - w * 0.06, yBase - h * 0.14, w * 0.12, h * 0.14);
  return d;
}
/** Hanging pendant lamp (cord from y=0). */
export function pendant(x, yLamp, { shadeColor = '#2f3a4a', lit = '#ffd98a', w = 120 } = {}) {
  return [
    line(sLine(x, 0, x, yLamp), '#3a3a3a', 3),
    glow(x, yLamp + 40, 260, lit, 0.35),
    path(`M${n(x - w / 2)} ${n(yLamp + 50)}Q${n(x - w / 2)} ${n(yLamp)} ${n(x)} ${n(yLamp)}Q${n(x + w / 2)} ${n(yLamp)} ${n(x + w / 2)} ${n(yLamp + 50)}Z`, lin(x - w / 2, 0, x + w / 2, 0, shade(shadeColor, 15), shadeColor), { stroke: shade(shadeColor, -40), lw: 3 }),
    ell(x, yLamp + 50, w / 2 - 4, 8, lit),
  ];
}
/** Scene object, validated for the stage. */
export function scene(def) {
  const out = { id: def.id, name: def.name, type: def.type, floorY: def.floorY, layers: def.layers.flat(3).filter(Boolean) };
  if (def.front) out.front = def.front.flat(3).filter(Boolean);
  if (def.tags) out.tags = def.tags;
  return out;
}
