// Helpers for the prop generators. Props are drawn in local units: origin at the bottom centre
// (on the floor), x right, y DOWN (so everything above the floor has negative y). One unit is one
// stage pixel at depth 0; a character is about 400 units tall.
//
// Cel style: every solid body is a flat fill with a darker crescent on the lower-right (light comes
// from the upper-left), an optional soft highlight, and a clean dark outline drawn last.
import { shade } from '../../src/engine/paint.js';

export const OUT = '#2a1d1d';
export const LW = 3.4;

export const rect = (x, y, w, h, r = 0) => ({ type: 'rect', x, y, w, h, ...(r ? { r } : {}) });
export const ell = (cx, cy, rx, ry, rot) => ({ type: 'ellipse', cx, cy, rx, ry, ...(rot ? { rot } : {}) });
export const poly = (points, closed = true) => ({ type: 'poly', points, ...(closed ? {} : { closed: false }) });
export const path = (d) => ({ type: 'path', d });

/** darker / lighter version of a colour (works with "$token" colours too) */
function tok(c, d) {
  const m = /^(\$[A-Za-z_]\w*)([+-]\d+(?:\.\d+)?)?$/.exec(c);
  const v = (m[2] ? parseFloat(m[2]) : 0) + d;
  return v === 0 ? m[1] : `${m[1]}${v > 0 ? '+' : ''}${v}`;
}
export const dk = (c, a = 18) => (c[0] === '$' ? tok(c, -a) : shade(c, -a));
export const lt = (c, a = 25) => (c[0] === '$' ? tok(c, a) : shade(c, a));

function bbox(s) {
  if (s.type === 'rect') return [s.x, s.y, s.w, s.h];
  if (s.type === 'ellipse') return [s.cx - s.rx, s.cy - s.ry, s.rx * 2, s.ry * 2];
  if (s.type === 'poly') {
    const xs = s.points.map((p) => p[0]), ys = s.points.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  }
  const nums = (s.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

/**
 * A shaded solid. opts: k (crescent size, default ~12% of the short side), hi (true or [cx,cy,rx,ry] highlight),
 * outline (default true), lw, flat (no shading), alpha.
 */
export function solid(shape, color, opts = {}) {
  const [bx, by, bw, bh] = bbox(shape);
  const k = opts.k ?? Math.max(2.5, Math.min(14, Math.min(bw, bh) * 0.13));
  const out = [];
  const a = opts.alpha != null ? { alpha: opts.alpha } : {};
  if (opts.flat) out.push({ ...shape, fill: color, stroke: null, ...a });
  else {
    out.push({ ...shape, fill: dk(color, opts.dark ?? 20), stroke: null, ...a });
    out.push({ ...shape, fill: color, stroke: null, off: [-k, -k], clipTo: shape, ...a });
  }
  if (opts.hi) {
    const h = Array.isArray(opts.hi) ? opts.hi : [bx + bw * 0.3, by + bh * 0.26, Math.max(2, bw * 0.13), Math.max(2, bh * 0.08)];
    out.push({ ...ell(h[0], h[1], h[2], h[3], h[4] || -20), fill: '#ffffff', stroke: null, alpha: opts.hiAlpha ?? 0.35, clipTo: shape });
  }
  if (opts.outline !== false) out.push({ ...shape, fill: null, stroke: opts.stroke ?? OUT, lw: opts.lw ?? LW });
  return out;
}

/** Flat fill, no outline (details, glows). */
export const flat = (shape, color, extra = {}) => [{ ...shape, fill: color, stroke: null, ...extra }];
/** Stroke-only line art. */
export const line = (d, color = OUT, lw = LW, extra = {}) => [{ ...(typeof d === 'string' ? path(d) : d), fill: null, stroke: color, lw, ...extra }];
/** Radial glow (lamps, fire). */
export const glow = (cx, cy, r, color, alpha = 0.35, squash = 1) => [{
  ...ell(cx, cy, r, r * squash),
  fill: { radial: true, cx, cy, r0: 0, r, stops: [[0, color], [1, 'rgba(255,255,255,0)']] },
  stroke: null,
  alpha,
}];

/** Bumpy blob (bushes, canopies, clouds) — returns an SVG path. */
export function blob(cx, cy, rx, ry, n, bump, seed = 1) {
  let d = '';
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 1 + 0.08 * Math.sin(seed * 12.9898 + i * 78.233);
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % n];
    const am = ((i + 0.5) / n) * Math.PI * 2;
    const c = [cx + Math.cos(am) * (rx + bump), cy + Math.sin(am) * (ry + bump)];
    if (i === 0) d += `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    d += ` Q ${c[0].toFixed(1)} ${c[1].toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  });
  return d + ' Z';
}

export const f = (n) => +n.toFixed(1);

/** Assemble a prop definition. */
export function prop(id, name, category, size, shapes, extra = {}) {
  return { id, name, category, size, anchor: 'bottom', ...extra, shapes: shapes.flat(Infinity) };
}
