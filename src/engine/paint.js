// Shared vector drawing used by rigs and scenes. Works on main-thread and OffscreenCanvas contexts.

export function resolveColor(c, palette) {
  if (typeof c === 'string' && c[0] === '$') return (palette && palette[c.slice(1)]) || '#ff00ff';
  return c;
}

const pathCache = new WeakMap();

function buildPath(s) {
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
    const g = ctx.createLinearGradient(f.x0 ?? 0, f.y0 ?? 0, f.x1 ?? 0, f.y1 ?? 0);
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
  const path = buildPath(s);
  if (s.alpha != null) {
    ctx.save();
    ctx.globalAlpha *= s.alpha;
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
  if (s.alpha != null) ctx.restore();
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
export function trs(x, y, deg, sx = 1, sy = 1) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c * sx, s * sx, -s * sy, c * sy, x, y];
}
