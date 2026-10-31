// Shared vector drawing used by rigs and scenes. Works on main-thread and OffscreenCanvas contexts.
//
// Colors: "#rrggbb", "rgba(...)", "$token" (from a palette), "$token-15" (15% darker), "$token+20" (20% lighter).
// Fills may also be gradients: {stops:[[0,c],[1,c]], x0,y0,x1,y1}  or  {radial:true, stops, cx,cy,r}.

const colorCache = new Map();

function parseHex(h) {
  let s = h.slice(1);
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Darken (amt<0) or lighten (amt>0) a hex color by a percentage. Darkening keeps saturation (multiplies). */
export function shade(hex, amt) {
  const key = hex + '|' + amt;
  let out = colorCache.get(key);
  if (out) return out;
  const [r, g, b] = parseHex(hex);
  const k = amt / 100;
  out = k < 0 ? toHex(r * (1 + k), g * (1 + k) * 0.995, b * (1 + k) * 1.01) : toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k);
  colorCache.set(key, out);
  return out;
}

export function resolveColor(c, palette) {
  if (typeof c !== 'string' || c[0] !== '$') return c;
  const m = /^\$([A-Za-z_][\w]*)([+-]\d+(?:\.\d+)?)?$/.exec(c);
  if (!m) return '#ff00ff';
  const base = palette && palette[m[1]];
  if (!base) return '#ff00ff';
  return m[2] ? shade(base, parseFloat(m[2])) : base;
}

const pathCache = new WeakMap();

export function buildPath(s) {
  let p = pathCache.get(s);
  if (p) return p;
  p = new Path2D();
  switch (s.type) {
    case 'rect':
      if (s.r) p.roundRect(s.x, s.y, s.w, s.h, s.r);
      else p.rect(s.x, s.y, s.w, s.h);
      break;
    case 'ellipse':
      p.ellipse(s.cx, s.cy, s.rx, s.ry, ((s.rot || 0) * Math.PI) / 180, 0, Math.PI * 2);
      break;
    case 'poly':
      s.points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      if (s.closed !== false) p.closePath();
      break;
    case 'path':
      p = new Path2D(s.d);
      break;
    default:
      throw new Error(`Unknown shape type "${s.type}"`);
  }
  pathCache.set(s, p);
  return p;
}

function makePaint(ctx, f, palette) {
  if (f && typeof f === 'object' && f.stops) {
    const g = f.radial
      ? ctx.createRadialGradient(f.cx ?? 0, f.cy ?? 0, f.r0 ?? 0, f.cx ?? 0, f.cy ?? 0, f.r ?? 1)
      : ctx.createLinearGradient(f.x0 ?? 0, f.y0 ?? 0, f.x1 ?? 0, f.y1 ?? 0);
    for (const [o, c] of f.stops) g.addColorStop(o, resolveColor(c, palette));
    return g;
  }
  return resolveColor(f, palette);
}

/** Draw one shape. Shape: {type, ...geometry, fill?, stroke?, lw?, alpha?} */
export function drawShape(ctx, s, palette, defaults) {
  const fill = s.fill !== undefined ? s.fill : defaults?.fill;
  const stroke = s.stroke !== undefined ? s.stroke : defaults?.stroke;
  const lw = s.lw ?? defaults?.lw ?? 1;
  const alpha = s.alpha ?? defaults?.alpha;
  const path = buildPath(s);
  if (alpha != null) {
    ctx.save();
    ctx.globalAlpha *= alpha;
  }
  if (fill) {
    ctx.fillStyle = makePaint(ctx, fill, palette);
    ctx.fill(path);
  }
  if (stroke) {
    ctx.strokeStyle = makePaint(ctx, stroke, palette);
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  }
  if (alpha != null) ctx.restore();
}

// --- 2D affine matrices as [a,b,c,d,e,f] ---------------------------------------------------
export const IDENT = [1, 0, 0, 1, 0, 0];
export function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export function inv(m) {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
export function trs(x, y, deg, sx = 1, sy = 1) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c * sx, s * sx, -s * sy, c * sy, x, y];
}
