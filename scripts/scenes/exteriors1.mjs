// Everyday exteriors: street_day, night_forest, park_day, beach, city_night, rooftop_sunset.
import {
  W, H, rect, ell, poly, path, line, lin, vgrad, rad, rgba, shade, shadow, glow, pool, vignette, band,
  sCirc, sRect, sRR, sPoly, sLine, sPuff, outlined, sRidge, sSmooth, sStars, sSparkle, sPine, persp, range, tree, plant, scene, rng,
} from './lib.mjs';

/** Grass tufts scattered in a band. */
export function sTufts(seed, count, x0, x1, y0, y1, s = 1) {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), k = s * (0.6 + (y - y0) / (y1 - y0 + 1) * 0.8);
    d += `M${(x - 14 * k).toFixed(1)} ${y.toFixed(1)}L${(x - 10 * k).toFixed(1)} ${(y - 22 * k).toFixed(1)}L${(x - 3 * k).toFixed(1)} ${(y - 6 * k).toFixed(1)}L${x.toFixed(1)} ${(y - 30 * k).toFixed(1)}L${(x + 4 * k).toFixed(1)} ${(y - 6 * k).toFixed(1)}L${(x + 11 * k).toFixed(1)} ${(y - 20 * k).toFixed(1)}L${(x + 14 * k).toFixed(1)} ${y.toFixed(1)}Z`;
  }
  return d;
}
/** Lamp post with optional lit glow. */
export function lampPost(x, yBase, h = 420, { color = '#2f3a4a', lit = false, glowColor = '#ffe3a0' } = {}) {
  const top = yBase - h;
  return [
    ...shadow(x, yBase, 40, 8, 0.3),
    path(`M${x - 6} ${yBase}V${top + 40}H${x + 6}V${yBase}Z` + sRR(x - 18, yBase - 40, 36, 40, 6), color),
    path(`M${x - 26} ${top + 40}h52l-10 -56h-32z`, lit ? '#fff1b8' : '#dfe8ee', { stroke: color, lw: 5 }),
    path(`M${x - 32} ${top - 16}h64l-14 -18h-36z`, color),
    ...(lit ? [glow(x, top + 12, 180, glowColor, 0.55)] : []),
  ];
}

// ---------------------------------------------------------------------------------------------
export function street_day() {
  const floorY = 820, base = 690;
  const r = rng(9);
  let far = '';
  for (let x = -20; x < W; x += 60 + r() * 70) far += sRect(x, 300 + r() * 160, 50 + r() * 60, 400);
  const bld = [
    { x: -20, w: 420, h: 520, c: '#e8a87c', awn: '#e2574a' },
    { x: 400, w: 380, h: 600, c: '#9cc5d8', awn: '#3f78b5' },
    { x: 780, w: 360, h: 470, c: '#f2d38a', awn: '#4f9a5a' },
    { x: 1140, w: 420, h: 640, c: '#c9a8d8', awn: '#e0a53b' },
    { x: 1560, w: 380, h: 540, c: '#a8d0a0', awn: '#e2574a' },
  ];
  const L = [];
  for (const b of bld) {
    const top = base - b.h;
    L.push(rect(b.x, top, b.w, b.h, lin(b.x, 0, b.x + b.w, 0, b.c, shade(b.c, -10)), { stroke: shade(b.c, -45), lw: 4 }));
    L.push(rect(b.x - 10, top - 24, b.w + 20, 30, shade(b.c, -22), { stroke: shade(b.c, -45), lw: 4 }));
    // upper windows
    let wins = '', sills = '';
    for (let y = top + 50; y < base - 290; y += 120) for (let x = b.x + 40; x < b.x + b.w - 90; x += 110) { wins += sRR(x, y, 70, 86, 6); sills += sRect(x - 6, y + 86, 82, 10); }
    L.push(path(wins, vgrad(top, base - 260, '#d9eef8', '#9cc7de'), { stroke: shade(b.c, -45), lw: 4 }));
    L.push(path(sills, '#f7f1e3', { stroke: shade(b.c, -40), lw: 2 }));
    // shop front
    const sy = base - 230;
    L.push(rect(b.x + 30, sy + 50, b.w - 60, 180, '#3a3f45'));
    L.push(rect(b.x + 40, sy + 60, b.w * 0.55, 150, vgrad(sy + 60, sy + 210, '#bfe3f2', '#7fb6d0'), { stroke: '#2a2f35', lw: 3 }));
    L.push(rect(b.x + 40, sy + 60, b.w * 0.55, 150, lin(b.x + 40, sy + 60, b.x + 40 + b.w * 0.55, sy + 210, 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0)')));
    L.push(rect(b.x + b.w * 0.62 + 10, sy + 70, b.w * 0.3, 160, shade(b.awn, -10), { stroke: '#2a2f35', lw: 3 }));
    L.push(ell(b.x + b.w * 0.62 + 30, sy + 150, 6, 6, '#f2c14e'));
    // striped scalloped awning
    const ax0 = b.x + 20, ax1 = b.x + b.w - 20, ay = sy, n = Math.round((ax1 - ax0) / 50);
    let aw = `M${ax0 + 20} ${ay - 20}H${ax1 - 20}L${ax1} ${ay + 40}`;
    for (let i = 0; i < n; i++) { const xa = ax1 - (i * (ax1 - ax0)) / n, xb = ax1 - ((i + 1) * (ax1 - ax0)) / n; aw += `Q${(xa + xb) / 2} ${ay + 70} ${xb} ${ay + 40}`; }
    aw += 'Z';
    L.push(path(aw, b.awn, { stroke: shade(b.awn, -45), lw: 4 }));
    let st = '';
    for (let i = 0; i < n; i += 2) { const xa = ax0 + (i * (ax1 - ax0)) / n, xb = ax0 + ((i + 1) * (ax1 - ax0)) / n; st += sPoly([[xa + 20 * (1 - i / n), ay - 20], [xb + 20 * (1 - (i + 1) / n), ay - 20], [xb, ay + 40], [xa, ay + 40]]); }
    L.push(path(st, '#ffffff', { alpha: 0.85 }));
    L.push(band(b.x + 30, sy + 50, b.w - 60, 40, '#000000', 0.25));
  }
  const P = persp({ yTop: base, hY: 420 });
  let paving = '';
  for (const y of P.rows(6, 1010).slice(1, -1)) paving += sLine(0, y, W, y);
  for (let X = -400; X <= W + 400; X += 160) paving += sLine(P.px(X, base), base, P.px(X, 1010), 1010);
  return scene({
    id: 'street_day', name: 'Town street', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, base, vgrad(0, base, '#6fb6ea', '#bfe3f7', '#e6f4fb')),
      path(sPuff(300, 90, 320, 90, 1, 5) + sPuff(1300, 70, 260, 80, 2, 5) + sPuff(1800, 140, 200, 60, 3, 4), '#ffffff', { alpha: 0.95 }),
      path(far, '#b9d3e3'),
      ...L,
      // sidewalk + curb + road
      rect(0, base, W, 1010 - base, vgrad(base, 1010, '#c9c2b6', '#ddd6ca')),
      path(paving, null, { stroke: '#a8a092', lw: 3, alpha: 0.7 }),
      band(0, base, W, 40, '#000000', 0.22),
      rect(0, 1010, W, 22, '#efe9df', { stroke: '#8f897d', lw: 3 }),
      rect(0, 1032, W, 48, vgrad(1032, 1080, '#4a4f56', '#3a3f45')),
      path(range(0, 6, 1).map((i) => sRect(60 + i * 340, 1060, 160, 10)).join(''), '#f2c14e'),
      // planter tree + hydrant + lamp
      ...tree(320, 720, 0.75, { seed: 4 }),
      rect(250, 700, 140, 34, '#8f897d', { r: 4, stroke: '#5a554c', lw: 3 }),
      ...lampPost(1080, 712, 470, { color: '#2f4a3a' }),
      ...shadow(1700, 730, 34, 7, 0.3),
      path('M1680 730v-50q0 -26 20 -30q20 4 20 30v50zM1670 690h60v10h-60zM1694 646h12v-10h-12z', '#e2574a', { stroke: '#7a201a', lw: 3 }),
      // bench
      ...shadow(1360, 728, 120, 10, 0.3),
      rect(1250, 640, 220, 18, '#8a5a34', { stroke: '#4f3018', lw: 3 }), rect(1250, 668, 220, 18, '#8a5a34', { stroke: '#4f3018', lw: 3 }),
      rect(1240, 690, 240, 16, '#9b6a40', { stroke: '#4f3018', lw: 3 }),
      line('M1262 706v22M1458 706v22M1262 640v50M1458 640v50', '#2f3a4a', 8),
      vignette(0.18),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function night_forest() {
  const floorY = 820, hz = 640;
  const pines = (seed, n, y, hMin, hMax, wk) => { const r = rng(seed); let d = ''; for (let i = 0; i < n; i++) { const x = -60 + (i + r() * 0.8) * ((W + 120) / n); const h = hMin + r() * (hMax - hMin); d += sPine(x, y + r() * 20, h, h * wk); } return d; };
  const r = rng(4);
  let flies = '';
  for (let i = 0; i < 14; i++) flies += sCirc(80 + r() * 1760, 420 + r() * 380, 3 + r() * 2);
  const flyList = flies.match(/M[\d.]+ [\d.]+/g).slice(0, 8).map((m) => m.slice(1).split(' ').map(Number));
  return scene({
    id: 'night_forest', name: 'Forest at night', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, hz + 40, vgrad(0, hz, '#0b1230', '#1d2a5a', '#34477a')),
      path(sStars(17, 140, { y1: 520 }), '#ffffff', { alpha: 0.85 }),
      path(sSparkle(300, 120, 10) + sSparkle(1500, 80, 12) + sSparkle(900, 200, 8), '#ffffff'),
      glow(1450, 200, 420, '#bcd0ff', 0.35),
      ell(1450, 200, 92, 92, rad(1430, 180, 100, '#fffbe6', '#e8e6c8')),
      path(sCirc(1420, 180, 14) + sCirc(1480, 230, 20) + sCirc(1470, 160, 9), '#d8d4b0', { alpha: 0.6 }),
      // layered pines (atmospheric perspective)
      path(pines(1, 26, 600, 180, 300, 0.42), '#3b4d7a'),
      rect(0, 520, W, 140, vgrad(520, 660, 'rgba(120,140,200,0)', 'rgba(120,140,200,0.35)')),
      path(pines(2, 18, 680, 260, 420, 0.45), '#24345e'),
      // ground
      rect(0, hz, W, H - hz, vgrad(hz, H, '#1f3046', '#2a3f4a', '#203238')),
      path(`M860 ${hz}Q760 760 520 1080H1400Q1140 760 1000 ${hz}Z`, vgrad(hz, H, '#3d4f66', '#5a6a72'), { alpha: 0.9 }),
      path(sTufts(5, 40, 0, W, 680, 1060, 1.2), '#16262c'),
      path(pines(3, 6, 740, 520, 700, 0.42).replace(/./, 'M'), '#101a30'),
      // mushrooms
      ...[[340, 880], [1610, 900]].flatMap(([x, y]) => [path(`M${x - 8} ${y}v-26h16v26z`, '#e8e2d0'), path(`M${x - 30} ${y - 24}q30 -40 60 0z`, '#c0504d', { stroke: '#5a1d1b', lw: 3 }), path(sCirc(x - 10, y - 34, 4) + sCirc(x + 10, y - 32, 3), '#ffffff')]),
      // fireflies
      ...flyList.map(([x, y]) => glow(x + 4, y, 26, '#d8ff8a', 0.6)),
      path(flies, '#eaffb0'),
      // moonlight wash + vignette
      rect(0, 0, W, H, lin(W, 0, 0, H, 'rgba(150,170,255,0.1)', 'rgba(0,0,0,0)')),
      vignette(0.55, '#02040c', 0.45),
    ],
    front: [
      path('M0 760C60 820 120 900 120 1080H0Z' + 'M0 900Q90 950 200 1080H0Z', '#070d1a'),
      path('M1920 820C1840 860 1790 960 1800 1080H1920Z', '#070d1a'),
      path(sTufts(8, 16, 0, 260, 1040, 1080, 1.8) + sTufts(9, 16, 1680, 1920, 1040, 1080, 1.8), '#070d1a'),
      // overhanging branch top-left
      path('M0 40Q200 70 420 30Q300 90 120 110Q60 112 0 130Z', '#070d1a'),
      path(range(0, 6, 1).map((i) => { const x = 30 + i * 62, y = 92 - i * 8; return `M${x} ${y}l-16 34l16 -12l12 30l6 -34l20 18l-10 -36Z`; }).join(''), '#070d1a'),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function park_day() {
  const floorY = 820, hz = 600;
  const pondY = 690;
  return scene({
    id: 'park_day', name: 'Park', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, hz + 20, vgrad(0, hz, '#5aaee8', '#a9d8f5', '#e2f3fb')),
      glow(260, 140, 260, '#fff6c8', 0.6), ell(260, 140, 60, 60, '#fff3b0'),
      path(sPuff(700, 110, 340, 100, 3, 6) + sPuff(1500, 160, 280, 80, 5, 5) + sPuff(1150, 70, 160, 50, 7, 4), '#ffffff', { alpha: 0.95 }),
      path(sRidge(3, 470, 90, { step: 260 }), '#a9cfc0'),
      path(sRidge(4, 540, 70, { step: 200 }), '#8fc290'),
      // tree line
      path(range(0, 12, 1).map((i) => sPuff(i * 170 + 40, 560, 220, 120, i + 20, 4, false)).join(''), '#5f9c58'),
      rect(0, hz, W, H - hz, vgrad(hz, H, '#86c26a', '#6aae54', '#5a9c48')),
      // pond
      ell(1500, pondY, 330, 56, vgrad(pondY - 56, pondY + 56, '#6fb8dc', '#4f98c0'), { stroke: '#3f7a52', lw: 6 }),
      ell(1460, pondY - 8, 200, 20, 'rgba(255,255,255,0.3)'),
      path('M1580 690q14 -24 30 -8q14 -4 20 4q-10 16 -40 14zM1610 676q6 -14 16 -6', '#ffffff', { stroke: '#8f897d', lw: 2 }),
      path(sCirc(1628, 671, 3), '#f2a33a'),
      // path
      path(`M820 ${hz}Q700 760 360 1080H1240Q1060 800 960 ${hz}Z`, vgrad(hz, H, '#e2cf9f', '#d6bf8a'), { stroke: '#b8a070', lw: 4 }),
      path(sTufts(2, 60, 0, W, 640, 1070, 1.1), '#4f9440', { alpha: 0.9 }),
      // trees
      ...tree(260, 690, 1.2, { seed: 12 }),
      ...tree(1150, 640, 0.75, { seed: 33, leaf: '#62a85c' }),
      // bench
      ...shadow(560, 690, 140, 12, 0.3),
      rect(440, 590, 240, 20, '#a0682f', { stroke: '#4f3018', lw: 3 }), rect(440, 620, 240, 20, '#a0682f', { stroke: '#4f3018', lw: 3 }),
      rect(430, 646, 260, 18, '#b07a3c', { stroke: '#4f3018', lw: 3 }),
      line('M452 664v26M668 664v26M452 590v56M668 590v56', '#2f3a4a', 9),
      // flower beds
      ...outlined(sPuff(1820, 700, 200, 70, 4, 5), '#4f9440', '#2f6e2a', 3),
      path(range(0, 8, 1).map((i) => sCirc(1740 + i * 24, 682 + (i % 2) * 10, 8)).join(''), '#f4a7b9', { stroke: '#a3485f', lw: 2 }),
      path(range(0, 6, 1).map((i) => sCirc(1752 + i * 28, 700 - (i % 2) * 10, 7)).join(''), '#f2c14e', { stroke: '#8a6a1d', lw: 2 }),
      ...lampPost(900, 650, 380, { color: '#2f4a3a' }),
      vignette(0.15),
    ],
    front: [
      ...outlined(sPuff(80, 1040, 360, 200, 41, 5, false), '#3f8a3a', '#245a22', 4),
      path(sPuff(60, 1010, 200, 120, 42, 4, false), '#4f9a48'),
      ...outlined(sPuff(1880, 1060, 320, 180, 43, 5, false), '#3f8a3a', '#245a22', 4),
      path(sPuff(1900, 1030, 160, 100, 44, 3, false), '#4f9a48'),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function beach() {
  const floorY = 830, hz = 520, shore = 660;
  let waves = '';
  for (let y = hz + 20, k = 0; y < shore - 10; y += 22 + k * 6, k++) for (let x = (k % 2) * 90; x < W; x += 180) waves += `M${x} ${y}q20 -8 40 0`;
  const r = rng(6);
  let shells = '';
  for (let i = 0; i < 10; i++) shells += sCirc(100 + r() * 1700, 760 + r() * 300, 4 + r() * 4);
  return scene({
    id: 'beach', name: 'Beach', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, hz + 4, vgrad(0, hz, '#3fa2e0', '#8ed0f2', '#d8f1fb')),
      glow(1450, 180, 340, '#fff6c8', 0.6), ell(1450, 180, 70, 70, '#fff6c0'),
      path(sPuff(500, 160, 360, 90, 8, 6) + sPuff(1000, 100, 220, 60, 9, 4), '#ffffff', { alpha: 0.95 }),
      path(`M1600 ${hz}q60 -70 130 -40q50 -30 90 10q30 10 60 30z`, '#7fb6a8'),
      rect(0, hz, W, shore - hz + 30, vgrad(hz, shore, '#2f8fc8', '#3fb6d6', '#7fd8e0')),
      line(waves, '#ffffff', 4, { alpha: 0.55 }),
      // wet sand + foam
      path(`M0 ${shore}Q480 ${shore - 26} 960 ${shore}T1920 ${shore}V${shore + 70}H0Z`, '#d8bf8a'),
      path(`M0 ${shore}Q480 ${shore - 26} 960 ${shore}T1920 ${shore}`, null, { stroke: '#ffffff', lw: 10, alpha: 0.85 }),
      rect(0, shore + 30, W, H - shore - 30, vgrad(shore + 30, H, '#ecd39c', '#f2dcaa', '#e8cc92')),
      path(`M0 ${shore + 32}Q480 ${shore + 6} 960 ${shore + 32}T1920 ${shore + 32}V${shore + 60}H0Z`, '#ecd39c'),
      path(range(0, 9, 1).map((i) => `M${i * 220 + 40} ${900 + (i % 3) * 40}q30 -10 60 0`).join(''), null, { stroke: '#d6b878', lw: 4 }),
      path(shells, '#f4a7b9', { stroke: '#c46b84', lw: 2 }),
      // palm tree
      ...shadow(260, 740, 160, 16, 0.25),
      path('M240 740Q250 520 340 330L362 338Q290 520 286 740Z', lin(240, 0, 290, 0, '#b0804a', '#8a5a2a'), { stroke: '#5a3a1a', lw: 4 }),
      line(range(0, 9, 1).map((i) => { const t = i / 9; const x = 250 + t * 100 - (1 - t) * 0, y = 720 - t * 380; return `M${x - 14} ${y}l30 -8`; }).join(''), '#6a4224', 4),
      path(palmLeaves(352, 336, [[120, 330, -40], [190, 450, 30], [560, 250, -50], [540, 430, 40], [330, 130, 40], [470, 160, 50]]), vgrad(120, 460, '#5cb85c', '#2f8a3a'), { stroke: '#1f5a24', lw: 4 }),
      path(sCirc(340, 345, 16) + sCirc(366, 352, 15), '#6a4224'),
      // umbrella + towel
      ...shadow(1500, 760, 220, 26, 0.22),
      poly([[1380, 780], [1640, 780], [1680, 860], [1340, 860]], '#3fa2e0', { stroke: '#22446a', lw: 3 }),
      path(sRect(1360, 800, 320, 14) + sRect(1350, 830, 330, 14), '#ffffff', { alpha: 0.8 }),
      line('M1520 790L1500 470', '#f4efe6', 8),
      path('M1320 520Q1450 330 1690 450Q1640 450 1610 466Q1560 452 1520 480Q1470 470 1430 500Q1370 494 1320 520Z', '#e2574a', { stroke: '#7a201a', lw: 4 }),
      path('M1503 398L1430 500Q1470 470 1520 480ZM1503 398L1610 466Q1640 450 1690 450Z', '#ffffff', { alpha: 0.92 }),
      path('M1320 520Q1450 330 1690 450Q1640 450 1610 466Q1560 452 1520 480Q1470 470 1430 500Q1370 494 1320 520Z', null, { stroke: '#7a201a', lw: 4 }),
      // sandcastle + bucket
      ...shadow(780, 770, 90, 12, 0.2),
      path('M700 770v-60h20v-14h16v14h20v-14h16v14h20v60zM740 710v-50h16v-12h12v12h16v50z', '#e0bf7a', { stroke: '#a8854a', lw: 3 }),
      poly([[740, 648], [772, 600], [784, 648]], '#e2574a'),
      path('M860 772l10 -50h50l10 50z', '#f2c14e', { stroke: '#8a6a1d', lw: 3 }),
      // gulls
      line('M700 220q20 -20 40 0q20 -20 40 0M880 280q14 -14 28 0q14 -14 28 0M1180 200q16 -16 32 0q16 -16 32 0', '#2f3a4a', 4),
      vignette(0.12),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function city_night() {
  const floorY = 830, base = 700;
  const r = rng(31);
  let far = '', mid = '', near = '', lit = '', litWarm = '';
  for (let x = -20; x < W; x += 50 + r() * 60) far += sRect(x, 280 + r() * 220, 60 + r() * 50, 500);
  for (let x = -40; x < W; x += 120 + r() * 80) {
    const w = 110 + r() * 90, h = 260 + r() * 260, top = base - h;
    mid += sRect(x, top, w, h);
    if (r() < 0.3) mid += sPoly([[x + w / 2 - 6, top - 60], [x + w / 2 + 6, top - 60], [x + w / 2 + 6, top], [x + w / 2 - 6, top]]);
    for (let y = top + 20; y < base - 40; y += 34) for (let wx = x + 14; wx < x + w - 18; wx += 26) { const q = r(); if (q < 0.22) lit += sRect(wx, y, 14, 18); else if (q < 0.3) litWarm += sRect(wx, y, 14, 18); }
  }
  // near street-level buildings
  const shops = [[-20, 360, 300, '#2a2440'], [340, 400, 380, '#32294a'], [740, 360, 260, '#2a2440'], [1100, 420, 340, '#32294a'], [1520, 420, 300, '#2a2440']];
  const L = [];
  for (const [x, w, h, c] of shops) {
    near += '';
    L.push(rect(x, base - h, w, h, c, { stroke: '#120e20', lw: 4 }));
    let wn = '';
    for (let y = base - h + 30; y < base - 150; y += 70) for (let wx = x + 30; wx < x + w - 60; wx += 80) wn += sRR(wx, y, 50, 46, 4);
    L.push(path(wn, '#ffd56a', { alpha: 0.9 }));
    L.push(rect(x + 30, base - 120, w - 60, 100, vgrad(base - 120, base - 20, '#ffcf7a', '#f29a4a'), { stroke: '#120e20', lw: 4 }));
    L.push(glow(x + w / 2, base - 60, 220, '#ffb86a', 0.3));
  }
  return scene({
    id: 'city_night', name: 'City at night', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, base, vgrad(0, base, '#0d0c2a', '#2a1f5a', '#5a3a7a')),
      path(sStars(41, 80, { y1: 300 }), '#ffffff', { alpha: 0.7 }),
      glow(380, 150, 220, '#d8d0ff', 0.35), ell(380, 150, 56, 56, '#f4f0e0'), path(sCirc(362, 136, 10) + sCirc(398, 168, 13) + sCirc(400, 128, 6), '#d8d2c0'),
      path(far, '#3d3570'),
      path(mid, '#241e48'),
      path(lit, '#ffe28a', { alpha: 0.85 }),
      path(litWarm, '#8ad8ff', { alpha: 0.6 }),
      ...L,
      // neon sign
      rect(1180, 230, 180, 70, '#1a1530', { r: 10, stroke: '#ff4fa8', lw: 6 }), glow(1270, 265, 160, '#ff4fa8', 0.35),
      line('M1210 280q20 -40 40 0t40 0t40 0', '#7af0ff', 6),
      // sidewalk + road
      rect(0, base, W, 320, vgrad(base, 1020, '#3a3550', '#4a4560')),
      path(range(0, 12, 1).map((i) => { const X = -400 + i * 240; return sLine(960 + (X - 960) * 0.6, base, 960 + (X - 960) * 1.6, 1020); }).join('') + sLine(0, 800, W, 800) + sLine(0, 900, W, 900), null, { stroke: '#2a2640', lw: 3 }),
      band(0, base, W, 40, '#000000', 0.35),
      rect(0, 1020, W, 18, '#5a5570'),
      rect(0, 1038, W, 42, '#1e1b2c'),
      path(range(0, 6, 1).map((i) => sRect(60 + i * 340, 1056, 160, 8)).join(''), '#c9b860', { alpha: 0.7 }),
      ...lampPost(660, 760, 480, { color: '#151226', lit: true }),
      ...lampPost(1460, 760, 480, { color: '#151226', lit: true }),
      ...pool(660, 840, 260, 70, '#ffe3a0', 0.35),
      ...pool(1460, 840, 260, 70, '#ffe3a0', 0.35),
      vignette(0.5, '#05040f', 0.45),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function rooftop_sunset() {
  const floorY = 820, ledge = 640;
  const r = rng(51);
  let sky1 = '', sky2 = '', lit = '';
  for (let x = -20; x < W; x += 60 + r() * 60) sky1 += sRect(x, 380 + r() * 150, 60 + r() * 50, 400);
  for (let x = -40; x < W; x += 110 + r() * 90) {
    const w = 90 + r() * 80, h = 140 + r() * 200, top = 600 - h;
    sky2 += sRect(x, top, w, h + 100);
    for (let y = top + 18; y < 590; y += 30) for (let wx = x + 12; wx < x + w - 16; wx += 24) if (r() < 0.18) lit += sRect(wx, y, 12, 14);
  }
  let bulbs = '', wire = 'M0 120';
  for (let i = 0; i <= 16; i++) { const x = i * 120, y = 120 + Math.sin((i / 16) * Math.PI * 2) * 30 + 40 * Math.sin((i % 4) / 4 * Math.PI); wire += `L${x} ${y}`; bulbs += sCirc(x, y + 14, 10); }
  return scene({
    id: 'rooftop_sunset', name: 'Rooftop at sunset', type: 'exterior', floorY,
    layers: [
      rect(0, 0, W, 660, vgrad(0, 660, '#3a2a6a', '#a04a7a', '#f08a5a', '#ffc870')),
      glow(1300, 520, 420, '#ffd890', 0.55),
      ell(1300, 520, 110, 110, vgrad(410, 630, '#fff1c0', '#ffb860')),
      path('M100 220q120 -20 260 10q-140 20 -260 -10zM1500 160q160 -30 320 0q-160 26 -320 0zM700 300q100 -14 220 6q-120 14 -220 -6z', '#f4a0a0', { alpha: 0.6 }),
      path(sky1, '#8a4a7a', { alpha: 0.75 }),
      path(sky2, '#4a2a5a'),
      path(lit, '#ffd88a', { alpha: 0.9 }),
      // roof surface
      rect(0, ledge, W, H - ledge, vgrad(ledge, H, '#6a5a6a', '#8a7a82', '#7a6a72')),
      path(range(0, 7, 1).map((i) => sLine(0, 720 + i * 52 + i * i * 4, W, 720 + i * 52 + i * i * 4)).join(''), null, { stroke: '#5a4a5a', lw: 2, alpha: 0.6 }),
      // parapet ledge
      rect(0, ledge - 90, W, 100, vgrad(ledge - 90, ledge + 10, '#b0707a', '#8a5560')),
      rect(0, ledge - 104, W, 20, '#c88a90', { stroke: '#5a3540', lw: 3 }),
      path(range(0, 15, 1).map((i) => sLine(i * 140, ledge - 84, i * 140, ledge + 8)).join('') + sLine(0, ledge - 40, W, ledge - 40), null, { stroke: '#7a4550', lw: 2, alpha: 0.6 }),
      band(0, ledge + 10, W, 50, '#000000', 0.3),
      // water tower (right)
      ...shadow(1700, 700, 170, 16, 0.35),
      line('M1600 700L1620 420M1800 700L1780 420M1610 560L1790 480M1610 480L1790 560', '#3a2a3a', 10),
      rect(1590, 250, 220, 180, lin(1590, 0, 1810, 0, '#a86a5a', '#7a4a3a'), { stroke: '#2a1a1a', lw: 4 }),
      path('M1580 250L1700 160L1820 250Z', '#5a3a3a', { stroke: '#2a1a1a', lw: 4 }),
      line('M1590 300h220M1590 380h220', '#5a3a2a', 4),
      // AC unit + vent
      ...shadow(330, 700, 130, 12, 0.35),
      rect(220, 580, 220, 120, lin(220, 0, 440, 0, '#c8c0c8', '#9a929a'), { r: 6, stroke: '#3a343a', lw: 4 }),
      ell(330, 640, 44, 44, '#6a646a', { stroke: '#3a343a', lw: 4 }), line('M290 640h80M330 600v80', '#3a343a', 4),
      path('M520 700v-90h50v90zM510 610h70v-16h-70z', '#8a828a', { stroke: '#3a343a', lw: 3 }),
      // string lights
      line(wire, '#2a1a2a', 3),
      path(bulbs, '#ffe08a', { stroke: '#c8962a', lw: 2 }),
      rect(0, 0, W, H, lin(1300, 520, 0, H, 'rgba(255,170,90,0.12)', 'rgba(60,20,80,0.18)')),
      vignette(0.35, '#1a0a20', 0.5),
    ],
  });
}

function palmLeaves(bx, by, tips) {
  // each tip: [x, y, bend]; leaf = two quadratic curves bulging either side of the base→tip line
  return tips.map(([tx, ty, bend]) => {
    const mx = (bx + tx) / 2, my = (by + ty) / 2, dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    const c1 = [mx + nx * (bend + 34), my + ny * (bend + 34)], c2 = [mx + nx * (bend - 34), my + ny * (bend - 34)];
    return `M${bx} ${by}Q${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${tx} ${ty}Q${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${bx} ${by}Z`;
  }).join('');
}
