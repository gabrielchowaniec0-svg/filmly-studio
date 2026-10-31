// Adventure exteriors: mansion_exterior_night, forest_day, snowy_village, desert, underwater.
import {
  W, H, rect, ell, poly, path, line, lin, vgrad, rad, rgba, shade, shadow, glow, pool, vignette, band,
  sCirc, sEll, sRect, sRR, sPoly, sLine, sPuff, sRidge, sSmooth, sStars, sSparkle, sPine, sArch, outlined, range, scene, rng,
} from './lib.mjs';
import { sTufts, lampPost } from './exteriors1.mjs';

/** Bare, twisted dead tree silhouette as one path (recursive branches as tapered quads). */
function sDeadTree(x, y, h, seed, depth = 4) {
  const r = rng(seed);
  let d = '';
  const branch = (x0, y0, ang, len, w, k) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const w1 = w * 0.62;
    const cx = (x0 + x1) / 2 + nx * len * 0.12 * (r() - 0.5) * 2, cy = (y0 + y1) / 2 + ny * len * 0.12 * (r() - 0.5) * 2;
    d += `M${(x0 + nx * w).toFixed(1)} ${(y0 + ny * w).toFixed(1)}Q${(cx + nx * w * 0.8).toFixed(1)} ${(cy + ny * w * 0.8).toFixed(1)} ${(x1 + nx * w1).toFixed(1)} ${(y1 + ny * w1).toFixed(1)}L${(x1 - nx * w1).toFixed(1)} ${(y1 - ny * w1).toFixed(1)}Q${(cx - nx * w * 0.8).toFixed(1)} ${(cy - ny * w * 0.8).toFixed(1)} ${(x0 - nx * w).toFixed(1)} ${(y0 - ny * w).toFixed(1)}Z`;
    if (k <= 0) return;
    const n = 2 + (r() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(x1, y1, ang + (i - (n - 1) / 2) * (0.5 + r() * 0.35) + (r() - 0.5) * 0.3, len * (0.55 + r() * 0.2), w1, k - 1);
  };
  branch(x, y, -Math.PI / 2 + (r() - 0.5) * 0.2, h * 0.42, h * 0.05, depth);
  // root flare
  d += `M${x - h * 0.12} ${y}Q${x - h * 0.04} ${y - h * 0.05} ${x - h * 0.04} ${y - h * 0.18}L${x + h * 0.04} ${y - h * 0.18}Q${x + h * 0.04} ${y - h * 0.05} ${x + h * 0.12} ${y}Z`;
  return d;
}
const sBat = (x, y, s) => `M${x} ${y}q${-10 * s} ${-14 * s} ${-30 * s} ${-12 * s}q${8 * s} ${6 * s} ${4 * s} ${14 * s}q${-6 * s} ${-6 * s} ${-14 * s} ${-2 * s}q${16 * s} ${4 * s} ${22 * s} ${16 * s}q${4 * s} ${-6 * s} ${8 * s} ${-6 * s}q${4 * s} 0 ${8 * s} ${6 * s}q${6 * s} ${-12 * s} ${22 * s} ${-16 * s}q${-8 * s} ${-4 * s} ${-14 * s} ${2 * s}q${-4 * s} ${-8 * s} ${4 * s} ${-14 * s}q${-20 * s} ${-2 * s} ${-30 * s} ${12 * s}Z`;

// ---------------------------------------------------------------------------------------------
export function mansion_exterior_night() {
  const floorY = 830, hz = 660;
  // mansion silhouette pieces (centre-back on a hill)
  const mx = 960;
  const body = sRect(mx - 300, 300, 600, 300) + sRect(mx - 420, 380, 140, 220) + sRect(mx + 280, 360, 150, 240) + sRect(mx - 60, 170, 120, 140) +
    sPoly([[mx - 330, 300], [mx, 190], [mx + 330, 300]]) + sPoly([[mx - 440, 380], [mx - 350, 300], [mx - 260, 380]]) + sPoly([[mx + 265, 360], [mx + 355, 250], [mx + 445, 360]]) +
    sPoly([[mx - 80, 170], [mx, 60], [mx + 80, 170]]) + sRect(mx + 160, 200, 40, 110) + sRect(mx - 220, 220, 36, 90) + sRect(mx - 4, 30, 8, 40);
  const lit = sRR(mx - 30, 210, 60, 70, 30) + sRect(mx - 240, 340, 60, 80) + sRect(mx + 180, 340, 60, 80) + sRect(mx - 380, 430, 50, 70) + sRect(mx + 330, 410, 50, 70) + sRect(mx - 240, 470, 60, 80);
  const dark = sRect(mx - 100, 340, 60, 80) + sRect(mx + 40, 340, 60, 80) + sRect(mx + 40, 470, 60, 80) + sRect(mx + 180, 470, 60, 80);
  const r = rng(13);
  let tombs = '';
  for (const [x, y, s] of [[260, 700, 1], [420, 690, 0.8], [1560, 700, 1], [1700, 712, 0.9], [1440, 686, 0.7]]) tombs += `M${x - 30 * s} ${y}V${y - 60 * s}Q${x - 30 * s} ${y - 90 * s} ${x} ${y - 90 * s}Q${x + 30 * s} ${y - 90 * s} ${x + 30 * s} ${y - 60 * s}V${y}Z`;
  // fence across the mid-ground, with an open gate in the middle
  let fence = '';
  const fy = 690;
  for (let x = 10; x < W; x += 34) { if (x > 860 && x < 1060) continue; fence += `M${x - 4} ${fy}V${fy - 100}l4 -16l4 16V${fy}Z`; }
  fence += sRect(0, fy - 80, 860, 8) + sRect(1060, fy - 80, W - 1060, 8) + sRect(0, fy - 30, 860, 8) + sRect(1060, fy - 30, W - 1060, 8);
  fence += sRect(846, fy - 160, 22, 160) + sRect(1052, fy - 160, 22, 160) + sCirc(857, fy - 168, 16) + sCirc(1063, fy - 168, 16);
  return scene({
    id: 'mansion_exterior_night', name: 'Haunted mansion (night)', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, hz + 20, vgrad(0, hz, '#0a0a1e', '#24204a', '#3a4a5a')),
      path(sStars(23, 90, { y1: 360 }), '#ffffff', { alpha: 0.7 }),
      glow(1330, 220, 460, '#e8f0c8', 0.35),
      ell(1330, 220, 150, 150, rad(1300, 190, 160, '#fbfae6', '#dcdcb8')),
      path(sCirc(1280, 190, 22) + sCirc(1370, 250, 30) + sCirc(1360, 160, 12) + sCirc(1270, 270, 14), '#c8c8a4', { alpha: 0.55 }),
      path('M1150 230q120 -30 240 -6q-120 22 -240 6zM1240 300q140 -24 260 0q-130 20 -260 0z', '#3a3a5a', { alpha: 0.7 }),
      // distant hills
      path(sRidge(6, 560, 60, { step: 240 }), '#1e2438'),
      // hill + mansion
      path(`M300 ${hz}Q600 520 960 540Q1320 520 1620 ${hz}Z`, '#151a2a'),
      path(body, '#141022'),
      path(lit, '#ffd86a'),
      glow(mx - 210, 380, 120, '#ffd86a', 0.3), glow(mx, 245, 100, '#ffd86a', 0.3),
      path(dark, '#262040'),
      line(`M${mx - 100} 380h60M${mx - 70} 340v80M${mx + 40} 510h60M${mx + 180} 380h60M${mx + 210} 340v80`, '#141022', 4),
      // bats
      path(sBat(700, 160, 1) + sBat(780, 210, 0.7) + sBat(1560, 120, 0.8) + sBat(620, 260, 0.55), '#06040c'),
      // ground
      rect(0, hz, W, H - hz, vgrad(hz, H, '#1c2a2a', '#22302c', '#1a2422')),
      path(`M900 ${fy}Q860 820 700 1080H1220Q1060 820 1020 ${fy}Z`, vgrad(fy, H, '#3a4040', '#4a5048')),
      path(`M920 ${hz}L900 ${fy}H1020L1000 ${hz}Z`, '#2e3434'),
      path(tombs, '#5a6268', { stroke: '#2a3034', lw: 3 }),
      line('M250 640v20M240 648h20M1550 640v20M1540 648h20', '#2a3034', 4),
      path(sTufts(14, 40, 0, W, 700, 1070, 1.1), '#0e1614'),
      // dead trees
      path(sDeadTree(120, 720, 640, 3) + sDeadTree(1800, 730, 560, 8), '#07060e'),
      // fence
      path(fence, '#0a0812'),
      // gate leaves swung open
      path(`M868 ${fy - 150}L790 ${fy - 140}V${fy + 10}L868 ${fy}Z`, null, { stroke: '#0a0812', lw: 6 }),
      line(range(0, 4, 1).map((i) => `M${868 - i * 20} ${fy - 150 + i * 2.5}V${fy - i * 2}`).join(''), '#0a0812', 5),
      path(`M1052 ${fy - 150}L1130 ${fy - 140}V${fy + 10}L1052 ${fy}Z`, null, { stroke: '#0a0812', lw: 6 }),
      line(range(0, 4, 1).map((i) => `M${1052 + i * 20} ${fy - 150 + i * 2.5}V${fy - i * 2}`).join(''), '#0a0812', 5),
      // fog banks
      path(sPuff(400, 700, 900, 90, 2, 7) + sPuff(1500, 710, 900, 80, 5, 7), '#9aa8c0', { alpha: 0.11 }),
      rect(0, 640, W, 160, vgrad(640, 800, 'rgba(150,170,200,0)', 'rgba(150,170,200,0.2)', 'rgba(150,170,200,0)')),
      vignette(0.6, '#02020a', 0.42),
    ],
    front: [
      path(sPuff(300, 1060, 900, 100, 7, 7) + sPuff(1600, 1070, 900, 90, 9, 7), '#aab6cc', { alpha: 0.08 }),
      path('M1920 0Q1700 40 1560 30Q1680 70 1760 64Q1700 110 1620 120Q1740 130 1820 96Q1860 130 1920 140Z', '#05040a'),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function forest_day() {
  const floorY = 820, hz = 640;
  const trunks = (seed, n, y0, y1, wMin, wMax) => {
    const r = rng(seed);
    let d = '';
    for (let i = 0; i < n; i++) { const x = (i + 0.2 + r() * 0.6) * (W / n); const w = wMin + r() * (wMax - wMin); d += `M${x - w / 2} ${y1}C${x - w / 2} ${(y0 + y1) / 2} ${x - w * 0.3} ${y0} ${x - w * 0.35} -10H${x + w * 0.35}C${x + w * 0.3} ${y0} ${x + w / 2} ${(y0 + y1) / 2} ${x + w / 2} ${y1}Z`; }
    return d;
  };
  const canopy = (seed, y, n, h) => range(0, n, 1).map((i) => sPuff(i * (W / (n - 1)), y, W / (n - 1) * 1.6, h, seed + i, 5, false)).join('');
  let flowers = '';
  const r = rng(19);
  for (let i = 0; i < 22; i++) flowers += sCirc(r() * W, 700 + r() * 360, 5 + r() * 4);
  return scene({
    id: 'forest_day', name: 'Forest (day)', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, hz + 20, vgrad(0, hz, '#cfeec8', '#e8f6d4', '#d4ecbc')),
      // far layer
      path(trunks(1, 22, 300, hz, 18, 30), '#a9c8a0'),
      path(canopy(10, 120, 10, 260), '#b8d8a8'),
      rect(0, 0, W, hz, vgrad(0, hz, 'rgba(240,255,220,0.25)', 'rgba(240,255,220,0.5)')),
      // mid layer
      path(trunks(2, 12, 300, hz + 20, 34, 56), '#7a9a68'),
      path(canopy(30, 40, 8, 280), '#86b26a'),
      // light shafts
      poly([[700, -10], [860, -10], [1100, 1080], [700, 1080]], lin(0, 0, 0, 1080, 'rgba(255,250,200,0.35)', 'rgba(255,250,200,0)')),
      poly([[1200, -10], [1280, -10], [1500, 1080], [1300, 1080]], lin(0, 0, 0, 1080, 'rgba(255,250,200,0.3)', 'rgba(255,250,200,0)')),
      poly([[300, -10], [360, -10], [520, 900], [380, 900]], lin(0, 0, 0, 900, 'rgba(255,250,200,0.25)', 'rgba(255,250,200,0)')),
      // ground
      rect(0, hz, W, H - hz, vgrad(hz, H, '#8fbf5a', '#6aa848', '#5a9640')),
      path(`M880 ${hz}Q760 800 560 1080H1380Q1140 800 1020 ${hz}Z`, vgrad(hz, H, '#d8c890', '#c8b070'), { stroke: '#a89050', lw: 3 }),
      path(sTufts(31, 70, 0, W, 660, 1070, 1.1), '#4f8a38'),
      path(flowers, '#ffffff', { stroke: '#d0d0c0', lw: 1.5 }),
      path(flowers.replace(/a([\d.]+) ([\d.]+) 0 1 1 ([\d.]+) 0a/g, (m, a, b, c) => `a${(a / 2.5).toFixed(1)} ${(b / 2.5).toFixed(1)} 0 1 1 ${(c / 2.5).toFixed(1)} 0a`).replace(/M([\d.]+) /g, (m, x) => `M${(+x + 3).toFixed(1)} `), '#f2c14e'),
      // near trunks at edges with roots
      ...outlined(`M60 ${hz + 100}C80 400 70 200 50 -10H210C200 200 190 400 230 ${hz + 100}Q260 ${hz + 140} 300 ${hz + 150}H-20Z`, lin(40, 0, 240, 0, '#8a5a34', '#6a4224', '#4a2a14'), '#2e1a0e', 3),
      ...outlined(`M1700 ${hz + 120}C1730 400 1720 200 1710 -10H1860C1850 200 1850 400 1880 ${hz + 120}Q1910 ${hz + 150} 1940 ${hz + 160}H1660Z`, lin(1700, 0, 1880, 0, '#8a5a34', '#6a4224', '#4a2a14'), '#2e1a0e', 3),
      line('M100 200q30 20 60 0M110 420q30 16 70 -4M1740 260q40 20 80 0M1750 500q30 16 70 -4', '#4a2a14', 4),
      // mushrooms + log
      ...shadow(1450, 730, 150, 12, 0.3),
      path('M1320 730q-20 -40 0 -70h240q24 34 0 70z', lin(0, 660, 0, 730, '#9a6a3a', '#6a4224'), { stroke: '#3a2210', lw: 4 }),
      ell(1560, 695, 22, 35, '#e8c890', { stroke: '#3a2210', lw: 4 }), ell(1560, 695, 10, 18, null, { stroke: '#a88050', lw: 3 }),
      ...[[1360, 662], [1400, 662]].flatMap(([x, y]) => [path(`M${x - 6} ${y}v-18h12v18z`, '#f4efe6'), path(`M${x - 22} ${y - 16}q22 -30 44 0z`, '#e2574a', { stroke: '#7a201a', lw: 3 })]),
      path(sTufts(32, 14, 1300, 1600, 726, 740, 1.2), '#4f8a38'),
      rect(0, 0, W, 160, vgrad(0, 160, 'rgba(60,110,40,0.5)', 'rgba(60,110,40,0)')),
      vignette(0.25, '#1a2a0a'),
    ],
    front: [
      ...outlined(sPuff(120, 1050, 420, 220, 51, 5, false), '#4f9a3c', '#245a22', 4),
      path(sPuff(90, 1010, 220, 130, 52, 4, false), '#62ae4a'),
      ...outlined(sPuff(1820, 1060, 420, 200, 53, 5, false), '#4f9a3c', '#245a22', 4),
      // leafy canopy edge
      ...outlined(range(0, 8, 1).map((i) => sPuff(i * 280, -30, 420, 160, 60 + i, 5, false)).join(''), '#5aa04a', '#2f6e2a', 4),
      path(range(0, 8, 1).map((i) => sPuff(i * 280 - 40, -60, 300, 120, 70 + i, 4, false)).join(''), '#72b85a'),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function snowy_village() {
  const floorY = 830, hz = 650;
  const r = rng(5);
  let flakes = '';
  for (let i = 0; i < 90; i++) flakes += sCirc(r() * W, r() * 1000, 2 + r() * 3);
  const house = (x, y, w, h, c, roof) => {
    const rh = w * 0.42;
    return [
      ...shadow(x + w / 2, y, w * 0.6, 12, 0.18, '#3a4a6a'),
      rect(x, y - h, w, h, lin(x, 0, x + w, 0, c, shade(c, -14)), { stroke: shade(c, -45), lw: 4 }),
      path(sRR(x + w * 0.18, y - h * 0.62, w * 0.24, h * 0.34, 4) + sRR(x + w * 0.6, y - h * 0.62, w * 0.24, h * 0.34, 4), '#ffd56a', { stroke: shade(c, -45), lw: 3 }),
      glow(x + w * 0.3, y - h * 0.45, 70, '#ffd56a', 0.35), glow(x + w * 0.72, y - h * 0.45, 70, '#ffd56a', 0.35),
      line(`M${x + w * 0.3} ${y - h * 0.62}v${h * 0.34}M${x + w * 0.18} ${y - h * 0.45}h${w * 0.24}M${x + w * 0.72} ${y - h * 0.62}v${h * 0.34}M${x + w * 0.6} ${y - h * 0.45}h${w * 0.24}`, shade(c, -45), 3),
      rect(x + w * 0.42, y - h * 0.5, w * 0.16, h * 0.5, shade(roof, -10), { r: 4, stroke: shade(c, -45), lw: 3 }),
      rect(x + w * 0.68, y - h - rh * 0.9, w * 0.12, rh * 0.7, '#8a5a4a', { stroke: '#3a2a2a', lw: 3 }),
      poly([[x - 24, y - h + 4], [x + w / 2, y - h - rh], [x + w + 24, y - h + 4]], roof, { stroke: shade(roof, -45), lw: 4 }),
      path(`M${x - 30} ${y - h + 8}Q${x - 30} ${y - h - 10} ${x - 10} ${y - h - 6}L${x + w / 2} ${y - h - rh - 14}L${x + w + 10} ${y - h - 6}Q${x + w + 30} ${y - h - 10} ${x + w + 30} ${y - h + 8}Q${x + w * 0.75} ${y - h - 6} ${x + w * 0.6} ${y - h + 14}Q${x + w * 0.4} ${y - h - 4} ${x + w * 0.2} ${y - h + 12}Q${x + w * 0.05} ${y - h - 4} ${x - 30} ${y - h + 8}Z`, '#ffffff', { stroke: '#b8c8e0', lw: 3 }),
      path(sPuff(x + w * 0.74, y - h - rh * 1.05, w * 0.2, 30, x, 3, false), '#ffffff'),
      path(sPuff(x + w * 0.8, y - h - rh * 1.6, w * 0.3, 50, x + 1, 3, false), '#e4ecf6', { alpha: 0.6 }),
    ];
  };
  return scene({
    id: 'snowy_village', name: 'Snowy village', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, hz + 20, vgrad(0, hz, '#8fb2dc', '#c8daf0', '#eaf1fa')),
      path(sRidge(3, 360, 200, { step: 220, jag: true }), '#b8c8e4'),
      path(sRidge(4, 470, 120, { step: 200, jag: true }), '#d4e0f2'),
      path(sRidge(5, 560, 50, { step: 180 }), '#eef3fa'),
      // distant pines
      path(range(0, 30, 1).map((i) => sPine(i * 66 + 20, 600 + (i % 3) * 8, 90 + (i % 4) * 20, 50)).join(''), '#7a96b8'),
      // houses
      ...house(150, 650, 300, 200, '#c8705a', '#6a3a4a'),
      ...house(560, 640, 240, 170, '#e0b06a', '#4a5a7a'),
      ...house(1180, 640, 260, 180, '#7aa0c8', '#6a3a4a'),
      ...house(1540, 655, 320, 220, '#b8a0c8', '#3a5a5a'),
      // snowy pines near houses
      ...outlined(sPine(940, 660, 260, 150), '#3a6a5a', '#1e3a34', 3),
      path(range(0, 3, 1).map((i) => `M${940 - 60 + i * 14} ${600 - i * 60}q${60 - i * 14} -20 ${120 - i * 28} 0q${-60 + i * 14} 14 ${-120 + i * 28} 0z`).join(''), '#ffffff'),
      // snow ground
      rect(0, hz, W, H - hz, vgrad(hz, H, '#e6eef8', '#f6f9fd', '#dfe8f4')),
      path(`M900 ${hz}Q820 820 640 1080H1300Q1100 820 1020 ${hz}Z`, '#d0dcee'),
      path(range(0, 12, 1).map((i) => `M${i * 170 + 30} ${760 + (i % 3) * 90}q50 -18 100 0`).join(''), null, { stroke: '#c4d2e8', lw: 5 }),
      ...lampPost(1080, 700, 400, { color: '#2a3a4a', lit: true, glowColor: '#ffe3a0' }),
      // snowman
      ...shadow(1470, 760, 80, 12, 0.18, '#3a4a6a'),
      path(sCirc(1470, 710, 54) + sCirc(1470, 630, 40) + sCirc(1470, 570, 30), '#ffffff', { stroke: '#a8b8d0', lw: 3 }),
      path(sCirc(1460, 562, 4) + sCirc(1482, 562, 4) + sCirc(1470, 625, 4) + sCirc(1470, 645, 4), '#2a2a2a'),
      path('M1470 572l30 6l-30 4z', '#f19a3e'),
      path('M1440 548h60v-10h-10v-40h-40v40h-10z', '#2a2a3a'),
      line('M1430 600q40 20 80 0', '#e2574a', 10),
      line('M1430 630l-40 -30M1510 630l40 -34', '#5a3a2a', 5),
      // falling snow
      path(flakes, '#ffffff', { alpha: 0.85 }),
      vignette(0.2, '#3a4a6a'),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function desert() {
  const floorY = 830, hz = 620;
  const cactus = (x, y, s) => outlined(
    `M${x - 22 * s} ${y}V${y - 200 * s}Q${x - 22 * s} ${y - 230 * s} ${x} ${y - 230 * s}Q${x + 22 * s} ${y - 230 * s} ${x + 22 * s} ${y - 200 * s}V${y}Z` +
    `M${x - 20 * s} ${y - 90 * s}H${x - 70 * s}Q${x - 90 * s} ${y - 90 * s} ${x - 90 * s} ${y - 110 * s}V${y - 160 * s}Q${x - 90 * s} ${y - 176 * s} ${x - 76 * s} ${y - 176 * s}Q${x - 62 * s} ${y - 176 * s} ${x - 62 * s} ${y - 160 * s}V${y - 120 * s}H${x - 20 * s}Z` +
    `M${x + 20 * s} ${y - 120 * s}H${x + 62 * s}V${y - 180 * s}Q${x + 62 * s} ${y - 196 * s} ${x + 76 * s} ${y - 196 * s}Q${x + 90 * s} ${y - 196 * s} ${x + 90 * s} ${y - 180 * s}V${y - 140 * s}Q${x + 90 * s} ${y - 92 * s} ${x + 50 * s} ${y - 92 * s}H${x + 20 * s}Z`,
    lin(x - 90 * s, 0, x + 90 * s, 0, '#5aa85a', '#3f8a46'), '#1f5a2a', 4);
  return scene({
    id: 'desert', name: 'Desert', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, hz + 20, vgrad(0, hz, '#4a9ad8', '#9ccbe4', '#f6dcae')),
      glow(1500, 160, 360, '#fff2c0', 0.7), ell(1500, 160, 80, 80, '#fff6d0'),
      // mesas (atmospheric)
      path(`M80 ${hz}L140 430H420L470 ${hz}ZM1180 ${hz}L1230 470H1360L1380 450H1560L1610 ${hz}Z`, '#e4b49a'),
      path(`M140 430H420L424 450H136ZM1230 470H1360L1380 450H1560L1564 470H1236Z`, '#d49a80'),
      path(sRidge(8, 600, 40, { step: 300 }), '#e8bf8a'),
      // dunes
      rect(0, hz, W, H - hz, vgrad(hz, H, '#eec486', '#f2cf94', '#e6b878')),
      path(`M-40 760Q400 640 900 720T1960 690V1080H-40Z`, vgrad(640, 1080, '#f2cc8e', '#e8ba7a')),
      path(`M-40 760Q400 640 900 720`, null, { stroke: '#fbe2b0', lw: 6, alpha: 0.8 }),
      path(range(0, 10, 1).map((i) => `M${i * 200 + 20} ${820 + (i % 3) * 70}q40 -14 80 0t80 0`).join(''), null, { stroke: '#d8a868', lw: 4, alpha: 0.7 }),
      // heat haze
      rect(0, 560, W, 80, vgrad(560, 640, 'rgba(255,240,210,0)', 'rgba(255,240,210,0.5)', 'rgba(255,240,210,0)')),
      // cacti + rocks
      ...shadow(300, 720, 110, 14, 0.25, '#7a4a2a'), ...cactus(300, 720, 1.2),
      ...shadow(1640, 700, 80, 10, 0.25, '#7a4a2a'), ...cactus(1640, 700, 0.85),
      ...shadow(1180, 690, 40, 6, 0.25, '#7a4a2a'), ...cactus(1180, 690, 0.4),
      ...outlined('M720 700q10 -50 60 -56q60 0 70 56zM840 700q6 -26 34 -28q30 2 34 28z', lin(720, 640, 900, 700, '#c89070', '#9a6a50'), '#5a3a2a', 3),
      // tumbleweed
      ell(1450, 860, 40, 40, null, { stroke: '#9a7a4a', lw: 4 }),
      line('M1420 840q30 40 60 0M1418 870q30 -40 64 0M1440 822q30 30 0 76M1460 822q-30 30 0 76', '#9a7a4a', 3),
      // vultures
      line('M640 200q20 -20 40 0q20 -20 40 0M800 260q14 -14 28 0q14 -14 28 0', '#3a2a2a', 4),
      vignette(0.18, '#5a2a10'),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function underwater() {
  const floorY = 830, hz = 640;
  const r = rng(71);
  let bubbles = '';
  for (let i = 0; i < 26; i++) bubbles += sCirc(r() * W, 60 + r() * 800, 5 + r() * 10);
  const weed = (x, y, h, seed, n = 3) => {
    const q = rng(seed);
    let d = '';
    for (let i = 0; i < n; i++) {
      const bx = x + (i - (n - 1) / 2) * 22, hh = h * (0.7 + q() * 0.4), sway = 30 + q() * 30;
      d += `M${bx - 10} ${y}C${bx - 10 - sway} ${y - hh * 0.3} ${bx - 10 + sway} ${y - hh * 0.6} ${bx} ${y - hh}C${bx + 10 + sway} ${y - hh * 0.6} ${bx + 10 - sway} ${y - hh * 0.3} ${bx + 10} ${y}Z`;
    }
    return d;
  };
  const fish = (x, y, s, dir) => `M${x} ${y}q${dir * 30 * s} ${-24 * s} ${dir * 60 * s} 0q${dir * -30 * s} ${24 * s} ${dir * -60 * s} 0zM${x} ${y}l${dir * -20 * s} ${-14 * s}v${28 * s}z`;
  return scene({
    id: 'underwater', name: 'Underwater', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, H, vgrad(0, H, '#3fc0d8', '#1f8ab8', '#145a8a', '#0e3f6a')),
      // surface ripples
      path(range(0, 16, 1).map((i) => `M${i * 130} 30q30 -14 65 0t65 0`).join(''), null, { stroke: '#bff4ff', lw: 5, alpha: 0.5 }),
      // light rays
      poly([[300, 0], [420, 0], [700, 900], [460, 900]], lin(0, 0, 0, 900, 'rgba(220,255,255,0.35)', 'rgba(220,255,255,0)')),
      poly([[800, 0], [880, 0], [1100, 800], [940, 800]], lin(0, 0, 0, 800, 'rgba(220,255,255,0.3)', 'rgba(220,255,255,0)')),
      poly([[1300, 0], [1440, 0], [1700, 900], [1440, 900]], lin(0, 0, 0, 900, 'rgba(220,255,255,0.3)', 'rgba(220,255,255,0)')),
      // distant rocks (atmospheric)
      path(sRidge(4, 560, 160, { step: 200 }), '#2a7aa0', { alpha: 0.6 }),
      path(fish(500, 300, 0.6, 1) + fish(580, 330, 0.5, 1) + fish(540, 360, 0.55, 1) + fish(1380, 250, 0.7, -1) + fish(1300, 280, 0.6, -1), '#1a6a90', { alpha: 0.7 }),
      // sand floor
      path(`M-20 ${hz + 20}Q480 ${hz - 30} 960 ${hz + 10}T1940 ${hz}V1080H-20Z`, vgrad(hz, H, '#e8d6a0', '#d8c088', '#b8a070')),
      rect(0, hz, W, H - hz, vgrad(hz, H, 'rgba(40,120,160,0.35)', 'rgba(40,120,160,0.1)')),
      path(range(0, 10, 1).map((i) => `M${i * 200 + 40} ${760 + (i % 3) * 80}q40 -14 80 0t80 0`).join(''), null, { stroke: '#c8b078', lw: 4, alpha: 0.7 }),
      // rocks + coral
      ...outlined(`M120 ${hz + 60}Q130 520 240 500Q350 490 380 ${hz + 60}Z`, lin(120, 500, 380, 700, '#5a7a8a', '#3a5868'), '#1e3440', 4),
      ...outlined(`M1500 ${hz + 60}Q1520 540 1640 520Q1780 520 1800 ${hz + 60}Z`, lin(1500, 520, 1800, 700, '#5a7a8a', '#3a5868'), '#1e3440', 4),
      ...outlined(weed(260, 520, 200, 1, 3) + weed(1660, 530, 220, 2, 4) + weed(760, 700, 160, 3, 3), vgrad(300, 700, '#5ad08a', '#2a9a5a'), '#1a5a34', 3),
      ...outlined('M440 700q-10 -60 -40 -90q20 0 34 30q4 -50 -16 -80q24 6 30 50q16 -40 40 -50q-10 30 -20 70q20 -30 44 -30q-30 30 -40 100z', '#f07a7a', '#8a2a3a', 3),
      ...outlined('M1360 700q-6 -50 -30 -70q16 -2 30 20q0 -50 20 -70q6 30 0 70q16 -30 40 -34q-20 30 -26 84z', '#f2a33a', '#8a5a1a', 3),
      ...outlined(sCirc(1120, 690, 26) + sCirc(1150, 700, 18), '#b07ad0', '#5a3a7a', 3),
      // starfish + shell
      path('M600 900l10 -26l10 26l28 2l-22 16l8 28l-24 -16l-24 16l8 -28l-22 -16z', '#f07a5a', { stroke: '#8a3a2a', lw: 3 }),
      path('M1500 940q30 -50 60 0z', '#f4c8a8', { stroke: '#a87a5a', lw: 3 }),
      // bright fish
      ...outlined(fish(1000, 200, 1, 1) + fish(1080, 240, 0.8, 1), '#f2c14e', '#8a6a1d', 3),
      path(sCirc(1048, 196, 4) + sCirc(1114, 236, 3), '#1a1a2a'),
      path(bubbles, 'rgba(220,250,255,0.18)', { stroke: 'rgba(230,255,255,0.7)', lw: 3 }),
      vignette(0.5, '#04203a', 0.45),
    ],
    front: [
      ...outlined(weed(40, 1080, 360, 7, 4) + weed(1880, 1080, 320, 8, 4), vgrad(700, 1080, '#3aa86a', '#1e7a4a'), '#0e4a2a', 3),
    ],
  });
}
