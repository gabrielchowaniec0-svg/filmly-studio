import { loadAssets } from '../src/assets/loader.js';
import { drawRig, poseAt, applyOverrides } from '../src/engine/rig.js';
import { trs } from '../src/engine/paint.js';

const A = await loadAssets('../');
const rig = A.rigs.humanoid;
const chars = Object.values(A.characters);
const $ = (id) => document.getElementById(id);
const who = $('who'), clipSel = $('clip');
who.innerHTML = chars.map((c) => `<option>${c.id}</option>`).join('');
clipSel.innerHTML = Object.keys(rig.clips).map((c) => `<option>${c}</option>`).join('');

function bg(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b3042'); g.addColorStop(1, '#1b1e28');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3a3f52'; ctx.fillRect(0, H - 40, W, 40);
}
function person(ctx, char, x, floor, s, layers, face, ov, facing = 1, lid) {
  const pose = applyOverrides(poseAt(layers), ov);
  if (lid != null) { pose.lidN = { scale: [1, lid] }; pose.lidF = { scale: [1, lid] }; }
  const k = s * (char.scale || 1);
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, floor + 3, 60 * k, 12 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  drawRig(ctx, rig, char, pose, face, trs(x, floor, 0, k * facing, k));
}
const idle = (t = 0.6) => [{ clip: rig.clips.idle, t }];
function label(ctx, txt, x, y) { ctx.fillStyle = '#cfd3df'; ctx.font = '600 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText(txt, x, y); }

function drawCast() {
  const c = $('cast'), ctx = c.getContext('2d');
  bg(ctx, c.width, c.height);
  const step = c.width / chars.length;
  chars.forEach((ch, i) => { person(ctx, ch, step * (i + 0.5), c.height - 60, 1, idle(i * 0.3), { mouth: 'smile' }); label(ctx, ch.name, step * (i + 0.5), c.height - 14); });
}
function drawStrip() {
  const c = $('strip'), ctx = c.getContext('2d');
  bg(ctx, c.width, c.height);
  const ch = A.characters[who.value], clip = rig.clips[clipSel.value];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const t = (clip.duration * i) / N;
    const layers = clip.overlay ? [...idle(), { clip, t, weight: 1 }] : [{ clip, t }];
    person(ctx, ch, (c.width / N) * (i + 0.5), c.height - 60, 0.95, layers, null);
    label(ctx, `${clipSel.value} ${t.toFixed(2)}s`, (c.width / N) * (i + 0.5), c.height - 14);
  }
}
function drawFaces() {
  const c = $('faces'), ctx = c.getContext('2d');
  bg(ctx, c.width, c.height);
  const ch = A.characters[who.value];
  const items = [];
  for (const [m, f] of Object.entries(rig.moods)) items.push([m, { eyes: f.eyes, brows: f.brows, mouth: f.mouth }, f.lid ?? 0.06]);
  for (const v of rig.slots.mouth.options) items.push(['mouth ' + v, { mouth: v }, 0.06]);
  for (const l of [0.35, 0.7, 1]) items.push(['blink ' + l, {}, l]);
  const cols = 12, cw = c.width / cols, rh = 250;
  items.forEach(([name, face, lid], i) => {
    const x = cw * (i % cols + 0.5), row = Math.floor(i / cols);
    ctx.save();
    ctx.beginPath(); ctx.rect(cw * (i % cols), row * rh, cw, rh); ctx.clip();
    const s = 1.55;
    person(ctx, ch, x - 10, row * rh + 640, s, idle(0), face, null, 1, Math.max(0.06, lid));
    ctx.restore();
    label(ctx, name, x, row * rh + rh - 10);
  });
}
function drawBuilds() {
  const c = $('builds'), ctx = c.getContext('2d');
  bg(ctx, c.width, c.height);
  const base = A.characters[who.value];
  const variants = Object.keys(rig.builds).map((b) => ({ ...base, build: b, scale: 1, _l: b }))
    .concat(rig.slots.top.options.map((t) => ({ ...base, scale: 1, options: { ...base.options, top: t, bottom: t === 'dress' ? 'bare' : (base.options.bottom === 'bare' ? 'pants' : base.options.bottom || 'pants') }, _l: t })));
  const step = c.width / variants.length;
  variants.forEach((v, i) => { person(ctx, v, step * (i + 0.5), c.height - 60, 0.85, idle(), { mouth: 'smile' }); label(ctx, v._l, step * (i + 0.5), c.height - 14); });
}
let raf = 0;
function live() {
  cancelAnimationFrame(raf);
  const c = $('live'), ctx = c.getContext('2d');
  const t0 = performance.now();
  const ch = A.characters[who.value], clip = rig.clips[clipSel.value];
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    bg(ctx, c.width, c.height);
    const layers = clip.overlay ? [...idle(t), { clip, t: clip.loop ? t : t % (clip.duration + 0.5), weight: 1 }] : [{ clip, t }];
    person(ctx, ch, c.width / 2, c.height - 60, 1.1, layers, null);
    raf = requestAnimationFrame(tick);
  };
  tick();
}
function all() { drawCast(); drawStrip(); drawFaces(); drawBuilds(); }
who.onchange = clipSel.onchange = all;
$('play').onclick = live;
const q = new URLSearchParams(location.search);
if (q.get('who')) who.value = q.get('who');
if (q.get('clip')) clipSel.value = q.get('clip');
all();
window.__ready = true;
