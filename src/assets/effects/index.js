// Screen effects: weather, light and colour grades drawn over a scene.
//   EFFECTS[id] = { label, layer, draw(ctx, W, H, t, opts, seed) }
// - ctx is already scaled so the stage is W x H (1920x1080 units) — draw in those units.
// - t is the scene-local time in seconds. Everything is a pure function of (t, opts, seed):
//   no Math.random() and no state carried between frames, so exports are frame-exact.
// - opts.amount (0..1, already multiplied by the fade-in/out) scales density and strength.
// - layer orders effects within a frame: 0 weather/particles, 1 light, 2 colour grade, 3 grain (last).
// Keep them cheap: one path per batch of particles, few gradients, at most a couple of full-screen blends.

/** Integer hash -> [0,1). */
function h1(n) {
  n |= 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Random value k for particle i under seed. */
const R = (seed, i, k = 0) => h1((seed | 0) * 7919 + i * 131 + k * 1000003);
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mod = (a, b) => ((a % b) + b) % b;
const amt = (o) => clamp01(o.amount ?? 1);

function fillScreen(ctx, W, H, style, alpha, op) {
  if (alpha <= 0) return;
  ctx.save();
  if (op) ctx.globalCompositeOperation = op;
  ctx.globalAlpha *= Math.min(1, alpha);
  ctx.fillStyle = style;
  ctx.fillRect(-2, -2, W + 4, H + 4);
  ctx.restore();
}

function vignette(ctx, W, H, strength, color = '0,0,0', inner = 0.45) {
  if (strength <= 0) return;
  ctx.save();
  // radial gradient stretched into an ellipse that fits the frame
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / H, 1);
  const r = H * 0.82;
  const g = ctx.createRadialGradient(0, 0, r * inner, 0, 0, r);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.6, `rgba(${color},${(0.35 * strength).toFixed(3)})`);
  g.addColorStop(1, `rgba(${color},${Math.min(1, strength).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.restore();
}

// ---- rain ---------------------------------------------------------------------------------
function rain(heavy) {
  return (ctx, W, H, t, o, seed) => {
    const a = amt(o);
    if (a <= 0) return;
    fillScreen(ctx, W, H, heavy ? '#1c2636' : '#2a3548', (heavy ? 0.3 : 0.14) * a);
    const n = Math.round((heavy ? 820 : 300) * a);
    const span = H + 240;
    const slant = heavy ? 0.26 : 0.16;
    ctx.save();
    ctx.lineCap = 'round';
    // two depth layers: far (thin, dim, slower) and near (thick, bright, fast)
    for (const layer of [0, 1]) {
      ctx.beginPath();
      for (let i = layer; i < n; i += 2) {
        const sp = (layer ? 1900 : 1300) + 700 * R(seed, i, 1);
        const len = (layer ? 46 : 26) + 30 * R(seed, i, 2);
        const y = mod(R(seed, i, 3) * span + sp * t, span) - 120;
        const x = mod(R(seed, i, 0) * (W + 400) - y * slant, W + 400) - 200;
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * slant, y + len);
      }
      ctx.strokeStyle = layer ? 'rgba(214,226,245,0.55)' : 'rgba(180,198,224,0.32)';
      ctx.lineWidth = layer ? 2.4 : 1.4;
      ctx.stroke();
    }
    // splashes on the ground band
    const ns = Math.round((heavy ? 70 : 28) * a);
    ctx.beginPath();
    for (let i = 0; i < ns; i++) {
      const per = 0.45 + 0.4 * R(seed, i, 5);
      const k = Math.floor((t + R(seed, i, 6) * per) / per);
      const u = (t + R(seed, i, 6) * per) / per - k;
      if (u > 0.3) continue;
      const q = u / 0.3;
      const x = R(seed + 17, i * 977 + k, 7) * W;
      const y = H * 0.76 + R(seed + 17, i * 977 + k, 8) * H * 0.22;
      const rx = 4 + q * 16, ry = rx * 0.3;
      ctx.moveTo(x + rx, y);
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    }
    ctx.strokeStyle = 'rgba(220,232,250,0.5)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  };
}

// ---- snow ---------------------------------------------------------------------------------
function snow(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  const n = Math.round(260 * a);
  const span = H + 40;
  ctx.save();
  for (const [lo, hi, alpha] of [[1.5, 3, 0.55], [3, 5, 0.8], [5, 8, 0.95]]) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const r = 1.5 + 6.5 * R(seed, i, 1);
      if (r < lo || r >= hi) continue;
      const sp = 30 + r * 14 + 20 * R(seed, i, 2);
      const y = mod(R(seed, i, 3) * span + sp * t, span) - 20;
      const sway = Math.sin(t * (0.6 + R(seed, i, 4)) + R(seed, i, 5) * TAU) * (10 + r * 3);
      const x = mod(R(seed, i, 0) * (W + 60) + sway + t * 12, W + 60) - 30;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }
  ctx.restore();
  fillScreen(ctx, W, H, '#dfe9ff', 0.06 * a);
}

// ---- fog ----------------------------------------------------------------------------------
function fog(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  const col = o.color || '226,232,240';
  ctx.save();
  const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
  g.addColorStop(0, `rgba(${col},0)`);
  g.addColorStop(0.55, `rgba(${col},${(0.35 * a).toFixed(3)})`);
  g.addColorStop(1, `rgba(${col},${(0.55 * a).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // drifting soft banks
  for (let i = 0; i < 9; i++) {
    const sp = 14 + 26 * R(seed, i, 1);
    const rw = 380 + 360 * R(seed, i, 2);
    const x = mod(R(seed, i, 0) * (W + rw * 2) + sp * t * (i % 2 ? 1 : -1), W + rw * 2) - rw;
    const y = H * (0.5 + 0.42 * R(seed, i, 3)) + Math.sin(t * 0.3 + i) * 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.38);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
    rg.addColorStop(0, `rgba(${col},${(0.42 * a).toFixed(3)})`);
    rg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(-rw, -rw, rw * 2, rw * 2);
    ctx.restore();
  }
  ctx.restore();
}

// ---- floating particles -------------------------------------------------------------------
function dust(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  const n = Math.round(90 * a);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const r = 1.2 + 2.6 * R(seed, i, 1);
    const x = mod(R(seed, i, 0) * W + Math.sin(t * 0.21 + i) * 40 + t * (6 + 10 * R(seed, i, 4)), W);
    const y = mod(R(seed, i, 2) * H + Math.cos(t * 0.17 + i * 1.3) * 30 - t * (4 + 6 * R(seed, i, 5)), H);
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + 2 * R(seed, i, 3)) + i);
    if (tw < 0.25) continue;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fillStyle = `rgba(255,236,190,${(0.55 * a).toFixed(3)})`;
  ctx.fill();
  ctx.restore();
  if (o.beam !== 0 && o.beam !== 'off') {
    // a soft light shaft from the top-left
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(W * 0.1, 0, W * 0.5, H);
    g.addColorStop(0, `rgba(255,228,170,${(0.16 * a).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,228,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(W * 0.12, -10); ctx.lineTo(W * 0.36, -10); ctx.lineTo(W * 0.72, H); ctx.lineTo(W * 0.3, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function star4(ctx, x, y, r) {
  const k = r * 0.22;
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.closePath();
}

function sparkles(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  const n = Math.round(46 * a);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gold = [], white = [];
  for (let i = 0; i < n; i++) {
    const per = 1.1 + 1.2 * R(seed, i, 1);
    const ph = (t + R(seed, i, 2) * per) / per;
    const k = Math.floor(ph);
    const u = ph - k;
    const s = Math.sin(u * Math.PI);
    if (s < 0.05) continue;
    const x = R(seed + 3, i * 131 + k, 3) * W;
    const y = R(seed + 3, i * 131 + k, 4) * H * 0.9;
    const r = (8 + 20 * R(seed, i, 5)) * s;
    (i % 3 ? gold : white).push(x, y, r);
  }
  for (const [list, col] of [[gold, 'rgba(255,214,110,0.9)'], [white, 'rgba(255,255,255,0.95)']]) {
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 3) star4(ctx, list[j], list[j + 1], list[j + 2]);
    ctx.fillStyle = col;
    ctx.globalAlpha = a;
    ctx.fill();
    // soft halo
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 3) { ctx.moveTo(list[j] + list[j + 2] * 0.45, list[j + 1]); ctx.arc(list[j], list[j + 1], list[j + 2] * 0.45, 0, TAU); }
    ctx.globalAlpha = a * 0.25;
    ctx.fill();
  }
  ctx.restore();
}
function fireflies(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  const n = Math.round(34 * a);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = [], core = [];
  for (let i = 0; i < n; i++) {
    const bx = R(seed, i, 0) * W, by = H * (0.25 + 0.7 * R(seed, i, 1));
    const x = bx + Math.sin(t * (0.3 + 0.4 * R(seed, i, 2)) + i) * 70 + Math.sin(t * 1.3 + i * 2.1) * 14;
    const y = by + Math.cos(t * (0.25 + 0.35 * R(seed, i, 3)) + i * 0.7) * 50;
    const p = Math.max(0, Math.sin(t * (1.2 + 1.5 * R(seed, i, 4)) + R(seed, i, 5) * TAU));
    if (p < 0.02) continue;
    halo.push(x, y, 14 + 10 * p);
    core.push(x, y, 2.5 + 2 * p);
  }
  ctx.fillStyle = `rgba(214,255,120,${(0.16 * a).toFixed(3)})`;
  ctx.beginPath();
  for (let j = 0; j < halo.length; j += 3) { ctx.moveTo(halo[j] + halo[j + 2], halo[j + 1]); ctx.arc(halo[j], halo[j + 1], halo[j + 2], 0, TAU); }
  ctx.fill();
  ctx.beginPath();
  for (let j = 0; j < halo.length; j += 3) { ctx.moveTo(halo[j] + halo[j + 2] * 0.5, halo[j + 1]); ctx.arc(halo[j], halo[j + 1], halo[j + 2] * 0.5, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = `rgba(250,255,200,${(0.95 * a).toFixed(3)})`;
  ctx.beginPath();
  for (let j = 0; j < core.length; j += 3) { ctx.moveTo(core[j] + core[j + 2], core[j + 1]); ctx.arc(core[j], core[j + 1], core[j + 2], 0, TAU); }
  ctx.fill();
  ctx.restore();
}

const LEAF_COLORS = ['#e2742b', '#d9502f', '#f0a830', '#b8502a', '#c9a03a'];
function leaves(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  const n = Math.round(30 * a);
  const span = H + 80;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(70,35,15,0.7)';
  for (let i = 0; i < n; i++) {
    const sp = 70 + 60 * R(seed, i, 1);
    const y = mod(R(seed, i, 2) * span + sp * t, span) - 40;
    const x = mod(R(seed, i, 0) * (W + 120) + Math.sin(t * (0.8 + R(seed, i, 3)) + i) * 60 + t * 40, W + 120) - 60;
    const s = 0.7 + 0.6 * R(seed, i, 4);
    const rot = t * (1 + 2 * R(seed, i, 5)) * (i % 2 ? 1 : -1) + i;
    const flip = Math.cos(t * (1.5 + R(seed, i, 6) * 2) + i); // 3D tumble
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s * (0.25 + 0.75 * Math.abs(flip)), s);
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(12, -6, 0, 16);
    ctx.quadraticCurveTo(-12, -6, 0, -16);
    ctx.fillStyle = LEAF_COLORS[(i * 7) % LEAF_COLORS.length];
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ---- light --------------------------------------------------------------------------------
/** Flash envelope for the strike in window k (period seconds). */
function strike(seed, k, period) {
  const t0 = k * period + 0.4 + R(seed, k, 1) * (period - 1.2);
  return t0;
}
function lightning(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  const period = +o.every || 4.5;
  fillScreen(ctx, W, H, '#141a2c', 0.22 * a); // stormy dusk
  const k = Math.floor(t / period);
  let env = 0, kk = k, u = 0;
  for (const c of [k, k - 1]) {
    if (c < 0) continue;
    const s = strike(seed, c, period);
    const d = t - s;
    if (d >= 0 && d < 0.6) {
      // double pulse: bright, dip, bright, decay
      const e = d < 0.06 ? d / 0.06 : d < 0.12 ? 1 - (d - 0.06) / 0.06 * 0.7 : d < 0.18 ? 0.3 + (d - 0.12) / 0.06 * 0.7 : Math.max(0, 1 - (d - 0.18) / 0.42);
      if (e > env) { env = e; kk = c; u = d; }
    }
  }
  if (env <= 0) return;
  // bolt
  if (u < 0.32) {
    ctx.save();
    let x = W * (0.15 + 0.7 * R(seed, kk, 2)), y = -10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const branches = [];
    let i = 0;
    while (y < H * 0.72) {
      x += (R(seed, kk * 97 + i, 3) - 0.5) * 90;
      y += 30 + 40 * R(seed, kk * 97 + i, 4);
      ctx.lineTo(x, y);
      if (R(seed, kk * 97 + i, 5) < 0.18) branches.push(x, y, i);
      i++;
    }
    for (let j = 0; j < branches.length; j += 3) {
      let bx = branches[j], by = branches[j + 1];
      const dir = R(seed, kk + j, 6) < 0.5 ? -1 : 1;
      ctx.moveTo(bx, by);
      for (let m = 0; m < 4; m++) { bx += dir * (20 + 30 * R(seed, kk * 31 + j + m, 7)); by += 25 + 25 * R(seed, kk * 37 + j + m, 8); ctx.lineTo(bx, by); }
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(150,170,255,${(0.35 * env * a).toFixed(3)})`;
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.strokeStyle = `rgba(240,245,255,${(env * a).toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }
  fillScreen(ctx, W, H, '#eef2ff', 0.55 * env * a, 'lighter');
}

function caustics(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  fillScreen(ctx, W, H, '#2a8fb0', 0.55 * a, 'multiply');
  fillScreen(ctx, W, H, '#0b4a66', 0.18 * a);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // god rays from the surface
  for (let i = 0; i < 6; i++) {
    const x = W * (0.08 + 0.17 * i + 0.05 * Math.sin(t * 0.3 + i * 1.7));
    const w = 60 + 60 * R(seed, i, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const al = (0.1 + 0.06 * Math.sin(t * 0.7 + i)) * a;
    g.addColorStop(0, `rgba(190,245,255,${al.toFixed(3)})`);
    g.addColorStop(1, 'rgba(190,245,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, 0); ctx.lineTo(x + w / 2, 0); ctx.lineTo(x + w * 1.6 + 120, H); ctx.lineTo(x + 120, H);
    ctx.closePath();
    ctx.fill();
  }
  // caustic network: a jittered grid of wobbling rounded cells whose bright rims touch
  ctx.lineJoin = 'round';
  const cell = 150;
  const drift = t * 18;
  for (const [lw, al] of [[9, 0.035], [3.5, 0.1]]) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = `rgba(210,255,255,${(al * a).toFixed(3)})`;
    ctx.beginPath();
    for (let gy = -1; gy <= Math.ceil(H / cell); gy++) {
      for (let gx = -1; gx <= Math.ceil(W / cell) + 1; gx++) {
        const id = gx * 31 + gy * 977;
        const cx = gx * cell + (gy % 2 ? cell / 2 : 0) + (R(seed, id, 1) - 0.5) * 50 + mod(drift, cell) - cell / 2;
        const cy = gy * cell + (R(seed, id, 2) - 0.5) * 50;
        const r = cell * (0.5 + 0.06 * Math.sin(t * 1.3 + id));
        const ph = R(seed, id, 3) * TAU;
        // smooth closed curve through 8 wobbling points (quadratic through midpoints)
        const N = 8;
        let px0 = 0, py0 = 0, mx0 = 0, my0 = 0;
        for (let s = 0; s <= N; s++) {
          const ang = (s / N) * TAU;
          const rr = r * (1 + 0.14 * Math.sin(ang * 3 + ph + t * 1.6) + 0.07 * Math.sin(ang * 5 - t * 2.1 + ph));
          const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.75;
          if (s === 0) { px0 = x; py0 = y; continue; }
          const mx = (px0 + x) / 2, my = (py0 + y) / 2;
          if (s === 1) { ctx.moveTo(mx, my); mx0 = mx; my0 = my; }
          else ctx.quadraticCurveTo(px0, py0, mx, my);
          px0 = x; py0 = y;
        }
        ctx.quadraticCurveTo(px0, py0, mx0, my0);
      }
    }
    ctx.stroke();
  }
  // bubbles
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(220,250,255,${(0.6 * a).toFixed(3)})`;
  ctx.beginPath();
  const n = Math.round(26 * a);
  for (let i = 0; i < n; i++) {
    const sp = 60 + 80 * R(seed, i, 2);
    const y = H + 20 - mod(R(seed, i, 3) * (H + 40) + sp * t, H + 40);
    const x = R(seed, i, 4) * W + Math.sin(t * 2 + i) * 8;
    const r = 3 + 7 * R(seed, i, 5);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  ctx.stroke();
  ctx.restore();
}

function spotlight(ctx, W, H, t, o) {
  const a = amt(o);
  if (a <= 0) return;
  const cx = ((o.x ?? 50) / 100) * W;
  const cy = ((o.y ?? 52) / 100) * H;
  const r = ((o.size ?? 18) / 100) * W;
  ctx.save();
  // darkness outside an elliptical pool of light
  ctx.translate(cx, cy);
  ctx.scale(1, 1.25);
  const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.25);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(4,4,12,${(0.8 * a).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(-W * 2, -H * 2, W * 4, H * 4);
  ctx.restore();
  // warm beam from above
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bg = ctx.createLinearGradient(0, 0, 0, cy + r);
  bg.addColorStop(0, `rgba(255,244,210,${(0.09 * a).toFixed(3)})`);
  bg.addColorStop(1, 'rgba(255,244,210,0.02)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.18, -10); ctx.lineTo(cx + r * 0.18, -10); ctx.lineTo(cx + r * 0.95, cy + r * 1.1); ctx.lineTo(cx - r * 0.95, cy + r * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function sunsetGlow(ctx, W, H, t, o) {
  const a = amt(o);
  if (a <= 0) return;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ff8a3d');
  g.addColorStop(0.55, '#ffb070');
  g.addColorStop(1, '#a0508a');
  fillScreen(ctx, W, H, g, 0.42 * a, 'multiply');
  const sx = ((o.x ?? 82) / 100) * W, sy = ((o.y ?? 28) / 100) * H;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.6);
  rg.addColorStop(0, `rgba(255,200,120,${(0.6 * a).toFixed(3)})`);
  rg.addColorStop(0.35, `rgba(255,140,80,${(0.22 * a).toFixed(3)})`);
  rg.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  vignette(ctx, W, H, 0.35 * a, '60,20,40');
}

// ---- colour grades ------------------------------------------------------------------------
function nightTint(ctx, W, H, t, o) {
  const a = amt(o);
  if (a <= 0) return;
  fillScreen(ctx, W, H, '#3d4f8f', 0.85 * a, 'multiply');
  fillScreen(ctx, W, H, '#0a1030', 0.18 * a);
  // a hint of moonlight from the top
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  g.addColorStop(0, `rgba(120,150,220,${(0.18 * a).toFixed(3)})`);
  g.addColorStop(1, 'rgba(120,150,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  vignette(ctx, W, H, 0.5 * a, '5,8,25');
}

function sepia(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  fillScreen(ctx, W, H, '#8a6a45', 0.9 * a, 'color');
  fillScreen(ctx, W, H, '#f3dfb8', 0.35 * a, 'multiply');
  const old = o.style !== 'clean';
  const frame = Math.floor(t * 24);
  if (old) {
    // projector flicker
    const fl = (R(seed, frame, 1) - 0.5) * 0.12;
    fillScreen(ctx, W, H, fl > 0 ? '#fff6e0' : '#1a1206', Math.abs(fl) * a);
    ctx.save();
    // scratches: thin vertical lines that jump each frame
    ctx.beginPath();
    const ns = Math.floor(R(seed, frame, 2) * 3);
    for (let i = 0; i < ns; i++) {
      const x = R(seed, frame * 7 + i, 3) * W;
      const y0 = R(seed, frame * 7 + i, 4) * H * 0.5;
      ctx.moveTo(x, y0);
      ctx.lineTo(x + (R(seed, frame * 7 + i, 5) - 0.5) * 8, y0 + H * (0.3 + 0.6 * R(seed, frame * 7 + i, 6)));
    }
    ctx.strokeStyle = `rgba(250,240,220,${(0.45 * a).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // dust specks
    ctx.beginPath();
    const nd = 4 + Math.floor(R(seed, frame, 7) * 8);
    for (let i = 0; i < nd; i++) {
      const x = R(seed, frame * 13 + i, 8) * W, y = R(seed, frame * 13 + i, 9) * H;
      const r = 1 + 3.5 * R(seed, frame * 13 + i, 10);
      ctx.moveTo(x + r, y);
      ctx.ellipse(x, y, r, r * (0.4 + R(seed, frame * 13 + i, 11)), 0, 0, TAU);
    }
    ctx.fillStyle = `rgba(30,20,10,${(0.6 * a).toFixed(3)})`;
    ctx.fill();
    ctx.restore();
  }
  vignette(ctx, W, H, (old ? 0.75 : 0.4) * a, '40,25,10', 0.4);
}

// film grain from a few pre-baked noise tiles (seeded, so deterministic)
const GRAIN_TILE = 256;
let grainTiles = null;
function grainTilesFor(ctx) {
  if (grainTiles) return grainTiles;
  const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : null);
  const tiles = [];
  for (let k = 0; k < 4; k++) {
    const c = mk(GRAIN_TILE, GRAIN_TILE);
    if (!c) return (grainTiles = []);
    const g = c.getContext('2d');
    const img = g.createImageData(GRAIN_TILE, GRAIN_TILE);
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      // roughly gaussian: average of 3 hashes
      const v = (h1(i * 3 + k * 99991) + h1(i * 3 + 1 + k * 99991) + h1(i * 3 + 2 + k * 99991)) / 3;
      const c8 = Math.round(128 + (v - 0.5) * 2.2 * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = Math.max(0, Math.min(255, c8));
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    tiles.push(c);
  }
  grainTiles = tiles.map((c) => ({ c, pat: null }));
  return grainTiles;
}
function filmGrain(ctx, W, H, t, o, seed) {
  const a = amt(o);
  if (a <= 0) return;
  const tiles = grainTilesFor(ctx);
  if (!tiles.length) return;
  const frame = Math.floor(t * 24);
  const tile = tiles[frame % tiles.length];
  const pat = ctx.createPattern(tile.c, 'repeat');
  if (!pat) return;
  const ox = Math.floor(R(seed, frame, 1) * GRAIN_TILE), oy = Math.floor(R(seed, frame, 2) * GRAIN_TILE);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha *= Math.min(1, 0.2 * a);
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W + GRAIN_TILE, H + GRAIN_TILE);
  ctx.restore();
}

export const EFFECTS = {
  rain: { label: 'Rain', layer: 0, draw: rain(false) },
  heavy_rain: { label: 'Heavy rain', layer: 0, draw: rain(true) },
  snow: { label: 'Snow', layer: 0, draw: snow },
  fog: { label: 'Fog', layer: 0, draw: fog },
  dust: { label: 'Dust motes', layer: 0, draw: dust },
  sparkles: { label: 'Sparkles', layer: 0, draw: sparkles },
  fireflies: { label: 'Fireflies', layer: 0, draw: fireflies },
  leaves: { label: 'Falling leaves', layer: 0, draw: leaves },
  lightning: { label: 'Lightning', layer: 1, draw: lightning },
  underwater: { label: 'Underwater', layer: 1, draw: caustics },
  spotlight: { label: 'Spotlight', layer: 1, draw: spotlight },
  sunset_glow: { label: 'Sunset glow', layer: 2, draw: sunsetGlow },
  night_tint: { label: 'Night', layer: 2, draw: nightTint },
  sepia: { label: 'Sepia', layer: 2, draw: (c, W, H, t, o, s) => sepia(c, W, H, t, { ...o, style: o.style || 'clean' }, s) },
  old_film: { label: 'Old film', layer: 2, draw: sepia },
  vignette: { label: 'Vignette', layer: 2, draw: (c, W, H, t, o) => vignette(c, W, H, 0.7 * amt(o)) },
  film_grain: { label: 'Film grain', layer: 3, draw: filmGrain },
};
export const EFFECT_ALIASES = { motes: 'dust', caustics: 'underwater', night: 'night_tint', sunset: 'sunset_glow', grain: 'film_grain', storm: 'lightning', sparkle: 'sparkles' };
