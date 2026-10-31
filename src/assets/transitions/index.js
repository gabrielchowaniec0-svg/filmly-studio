// Transitions: draw(ctx, W, H, p, drawA, drawB) where p is 0..1 progress, drawA draws the outgoing
// scene and drawB the incoming one. W/H are stage units (1920x1080). Keep these pure and stateless.
import { ease } from '../../engine/ease.js';

const fade = (ctx, W, H, p, A, B) => {
  A();
  ctx.save();
  ctx.globalAlpha = ease('smooth', p);
  B();
  ctx.restore();
};

const dip = (color) => (ctx, W, H, p, A, B) => {
  const q = ease('smooth', p);
  if (q < 0.5) A(); else B();
  const a = q < 0.5 ? q * 2 : (1 - q) * 2;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
};

const wipe = (dir) => (ctx, W, H, p, A, B) => {
  const q = ease('inout', p);
  A();
  ctx.save();
  ctx.beginPath();
  if (dir === 'left') ctx.rect(W * (1 - q), 0, W * q, H);
  else if (dir === 'right') ctx.rect(0, 0, W * q, H);
  else if (dir === 'up') ctx.rect(0, H * (1 - q), W, H * q);
  else ctx.rect(0, 0, W, H * q);
  ctx.clip();
  B();
  ctx.restore();
};

const push = (dir) => (ctx, W, H, p, A, B) => {
  const q = ease('inout', p);
  const dx = dir === 'left' ? -W : W;
  ctx.save();
  ctx.translate(dx * q, 0);
  A();
  ctx.restore();
  ctx.save();
  ctx.translate(dx * (q - 1), 0);
  B();
  ctx.restore();
};

const iris = (ctx, W, H, p, A, B) => {
  const q = ease('inout', p);
  const maxR = Math.hypot(W, H) / 2;
  A();
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, Math.max(0.001, maxR * q), 0, Math.PI * 2);
  ctx.clip();
  B();
  ctx.restore();
};

const zoomFade = (ctx, W, H, p, A, B) => {
  const q = ease('smooth', p);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1 + q * 0.35, 1 + q * 0.35);
  ctx.translate(-W / 2, -H / 2);
  A();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = q;
  ctx.translate(W / 2, H / 2);
  ctx.scale(1.35 - q * 0.35, 1.35 - q * 0.35);
  ctx.translate(-W / 2, -H / 2);
  B();
  ctx.restore();
};

const blinds = (ctx, W, H, p, A, B) => {
  const q = ease('inout', p);
  const n = 8, h = H / n;
  A();
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < n; i++) ctx.rect(0, i * h, W, h * q);
  ctx.clip();
  B();
  ctx.restore();
};

export const TRANSITIONS = {
  cut: { label: 'Hard cut', draw: (ctx, W, H, p, A, B) => (p < 0.5 ? A() : B()) },
  fade: { label: 'Cross-fade', draw: fade },
  dip_black: { label: 'Dip to black', draw: dip('#000000') },
  dip_white: { label: 'Dip to white', draw: dip('#ffffff') },
  wipe_left: { label: 'Wipe from right', draw: wipe('left') },
  wipe_right: { label: 'Wipe from left', draw: wipe('right') },
  wipe_up: { label: 'Wipe from bottom', draw: wipe('up') },
  wipe_down: { label: 'Wipe from top', draw: wipe('down') },
  push_left: { label: 'Push left', draw: push('left') },
  push_right: { label: 'Push right', draw: push('right') },
  iris: { label: 'Iris open', draw: iris },
  zoom: { label: 'Zoom blend', draw: zoomFade },
  blinds: { label: 'Blinds', draw: blinds },
};
