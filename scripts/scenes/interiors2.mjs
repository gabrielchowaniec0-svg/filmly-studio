// Public interiors: classroom, office, cafe, library, school_hallway, hospital_room, grocery_aisle.
import {
  W, H, rect, ell, poly, path, line, lin, vgrad, rad, rgba, shade, shadow, glow, pool, vignette, band,
  sCirc, sRect, sRR, sPoly, sLine, sPuff, sRidge, sArch, floorQuad, range, windowFrame, picture, plant, pendant, packBooks, scene, rng, persp,
} from './lib.mjs';
import { room } from './room.mjs';

const BOOK = ['#c0504d', '#3f78b5', '#e0a53b', '#4f9a5a', '#7a5aa6', '#e9d8b8'];

// ---------------------------------------------------------------------------------------------
export function classroom() {
  const floorY = 800, yTop = 700;
  const R = room({ yTop, wall: '#f3e9cf', floor: '#d9cdb6', floorKind: 'tiles', tile: { w: 150, rows: 6, color: '#b5a68a', alpha: 0.7 }, base: '#5f8fa8' });
  // alphabet cards
  const cards = ['', '', '', ''];
  range(0, 25, 1).forEach((i) => { cards[i % 4] += sRR(120 + i * 64, 40, 54, 54, 6); });
  // chalk doodles
  const chalk = 'M640 220l20 -50l20 50M648 200h24M700 170v50h20q14 0 14 -12q0 -12 -14 -13q12 -1 12 -12q0 -13 -14 -13h-18M790 172q-30 -6 -30 22q0 28 30 22' +
    'M640 274q14 -12 26 -2q8 10 -26 34h28M690 290h30M705 275v30M745 274q14 -12 26 -2q8 10 -26 34h28M800 284h26M800 298h26M866 270l-24 28h32M864 280v30' +
    'M1120 250m-40 0a40 40 0 1 0 80 0a40 40 0 1 0 -80 0M1120 190v-20M1120 310v20M1060 250h-20M1180 250h20M1077 207l-14 -14M1163 293l14 14M1163 207l14 -14M1077 293l-14 14' +
    'M900 360q40 -30 80 0t80 0t80 0';
  const wins = [1510, 1700];
  const view = (x) => [rect(x, 150, 160, 330, vgrad(150, 480, '#86c6ee', '#d8f0fb')), path(sPuff(x + 90, 220, 110, 40, x, 3), '#ffffff'), path(sPuff(x + 60, 450, 200, 120, x + 3, 4, false), '#6aab5e')];
  // front desks
  const desk = (x, dir) => [
    poly([[x, 1080], [x + dir * 120, 990], [x + dir * 520, 990], [x + dir * 560, 1080]], vgrad(990, 1080, '#e9c27f', '#c99a53'), { stroke: '#6b4c1f', lw: 5 }),
    poly([[x + dir * 120, 990], [x + dir * 520, 990], [x + dir * 520, 1002], [x + dir * 120, 1002]], '#a87c3c'),
    path(sRR(x + (dir > 0 ? 200 : -320), 1010, 120, 30, 4), '#ffffff', { stroke: '#9aa7c6', lw: 3 }),
    line(`M${x + dir * 380} 1030l${dir * 90} -18`, '#e0a53b', 9),
  ];
  return scene({
    id: 'classroom', name: 'Classroom', type: 'interior', floorY,
    layers: [
      ...R.layers,
      rect(0, 470, W, yTop - 26 - 470, vgrad(470, yTop, '#8fb7cc', '#7aa2b8')),
      rect(0, 462, W, 14, '#f7f1e3', { stroke: '#b5a68a', lw: 2 }),
      path(cards[0], '#e46b52', { stroke: '#8b3424', lw: 2 }), path(cards[1], '#f2c14e', { stroke: '#8a6a1d', lw: 2 }), path(cards[2], '#4fa1a5', { stroke: '#2b6467', lw: 2 }), path(cards[3], '#7a5aa6', { stroke: '#46336a', lw: 2 }),
      path(range(0, 25, 1).map((i) => sRR(134 + i * 64, 54, 26, 26, 4)).join(''), '#ffffff', { alpha: 0.8 }),
      // chalkboard
      rect(580, 130, 760, 330, '#8a5a34', { r: 8, stroke: '#4f3018', lw: 4 }),
      rect(598, 148, 724, 294, vgrad(148, 442, '#3a6e58', '#2c5545')),
      rect(598, 148, 724, 294, rad(820, 250, 420, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)')),
      line(chalk, '#f4f7f2', 5, { alpha: 0.85 }),
      rect(570, 452, 780, 18, '#a87c3c', { r: 3, stroke: '#4f3018', lw: 3 }),
      path(sRect(700, 440, 40, 10) + sRect(760, 442, 28, 8), '#ffffff'), path(sRR(1220, 436, 70, 16, 4), '#e46b52'),
      // clock
      ell(1430, 200, 52, 52, '#ffffff', { stroke: '#2f3a4a', lw: 8 }), line('M1430 200V165M1430 200L1455 212', '#2f3a4a', 5),
      // bulletin board
      rect(110, 170, 340, 240, '#c79a63', { r: 6, stroke: '#6b4c1f', lw: 6 }),
      path(sRect(130, 190, 90, 110) + sRect(240, 200, 90, 70) + sRect(340, 190, 90, 120) + sRect(150, 320, 120, 70) + sRect(300, 300, 120, 90), '#ffffff', { stroke: '#d6cbb5', lw: 2 }),
      path(sRect(250, 280, 70, 14) + sRect(140, 205, 60, 6) + sRect(140, 222, 50, 6) + sRect(350, 205, 50, 50), '#e46b52', { alpha: 0.7 }),
      path(sCirc(175, 190, 6) + sCirc(285, 200, 6) + sCirc(385, 190, 6) + sCirc(210, 320, 6) + sCirc(360, 300, 6), '#3f78b5'),
      // windows
      ...wins.flatMap((x) => windowFrame(x, 150, 160, 330, { frame: '#ffffff', cols: 1, rows: 2, view: view(x), outline: '#9aa7c6', fw: 14 })),
      // teacher desk
      ...shadow(330, 702, 230, 16, 0.3),
      rect(130, 520, 400, 30, '#a0682f', { r: 4, stroke: '#4f3018', lw: 4 }),
      rect(150, 550, 360, 152, vgrad(550, 700, '#8a5a2a', '#6e451e'), { stroke: '#4f3018', lw: 4 }),
      line('M330 560V690M170 600H310', '#4f3018', 3, { alpha: 0.6 }),
      path(sCirc(220, 488, 30), '#e2574a', { stroke: '#7a201a', lw: 3 }), line('M220 458q4 -14 16 -16', '#4f7a2a', 5),
      poly([[300, 520], [440, 520], [430, 500], [310, 500]], '#3f78b5', { stroke: '#22446a', lw: 3 }), poly([[310, 500], [430, 500], [424, 484], [316, 484]], '#f2c14e', { stroke: '#8a6a1d', lw: 3 }),
      // globe
      line('M1460 700V640M1430 700H1490', '#4f3018', 8), ell(1460, 600, 46, 46, '#4fa1d8', { stroke: '#22446a', lw: 4 }), path('M1440 570q20 10 10 30q-10 20 10 30M1480 585q-10 10 0 20', null, { stroke: '#5aa25a', lw: 9 }),
      vignette(0.25),
    ],
    front: [...desk(-20, 1), ...desk(W + 20, -1)],
  });
}

// ---------------------------------------------------------------------------------------------
export function office() {
  const floorY = 800, yTop = 700;
  const R = room({ yTop, wall: '#e9edf1', floor: '#8a98a8', floorKind: 'tiles', tile: { w: 200, rows: 6, color: '#7a8796', alpha: 0.5 }, base: '#5f6b78', baseH: 18 });
  const gx = 260, gy = 70, gw = 1400, gh = 470;
  const r = rng(21);
  let far = '', near = '', lit = '';
  for (let x = gx - 20; x < gx + gw; x += 50 + r() * 60) { const h = 120 + r() * 160; far += sRect(x, gy + gh - h, 40 + r() * 40, h); }
  for (let x = gx - 30; x < gx + gw; x += 110 + r() * 80) {
    const w = 90 + r() * 70, h = 160 + r() * 230;
    near += sRect(x, gy + gh - h, w, h);
    for (let y = gy + gh - h + 18; y < gy + gh - 20; y += 30) for (let wx = x + 12; wx < x + w - 16; wx += 24) if (r() < 0.5) lit += sRect(wx, y, 12, 14);
  }
  const panes = range(0, 4, 1).map((i) => gx + (gw * i) / 4);
  return scene({
    id: 'office', name: 'Office', type: 'interior', floorY,
    layers: [
      ...R.layers,
      // window wall
      rect(gx, gy, gw, gh, vgrad(gy, gy + gh, '#a9d4f0', '#e4f3fb')),
      path(sPuff(gx + 300, gy + 90, 260, 70, 4, 5) + sPuff(gx + 1050, gy + 130, 200, 60, 7, 4), '#ffffff', { alpha: 0.85 }),
      path(far, '#c3d6e6'),
      path(near, '#8fb0cb'),
      path(lit, '#d9e9f5', { alpha: 0.9 }),
      rect(gx, gy, gw, gh, lin(gx, gy, gx + gw, gy + gh, 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)')),
      path(sRect(gx, gy, gw, gh) + panes.slice(1, -1).map((x) => sLine(x, gy, x, gy + gh)).join(''), null, { stroke: '#5f6b78', lw: 14 }),
      rect(gx - 20, gy + gh, gw + 40, 18, '#cfd6dd', { stroke: '#5f6b78', lw: 3 }),
      // low credenza under the window
      rect(gx + 40, 560, gw - 80, 140, vgrad(560, 700, '#f4f1ea', '#d9d3c6'), { stroke: '#8f897d', lw: 3 }),
      path(range(0, 5, 1).map((i) => sRR(gx + 60 + i * 260, 580, 240, 100, 6)).join(''), null, { stroke: '#b6ae9e', lw: 3 }),
      ...plant(gx + 140, 560, 0.6, { pot: '#f4f1ea', seed: 31 }),
      ...plant(gx + gw - 140, 560, 0.6, { pot: '#f4f1ea', seed: 33 }),
      rect(gx + 600, 520, 90, 40, '#3f78b5', { stroke: '#22446a', lw: 3 }), rect(gx + 610, 494, 70, 26, '#e0a53b', { stroke: '#8a6a1d', lw: 3 }),
      // desk + monitor + chair (left)
      ...shadow(150, 702, 150, 14, 0.3),
      rect(10, 520, 260, 22, '#f4f1ea', { r: 4, stroke: '#8f897d', lw: 3 }), line('M30 542V700M250 542V700', '#6b7480', 8),
      rect(70, 390, 150, 100, '#22262b', { r: 6, stroke: '#0e1012', lw: 3 }), rect(80, 400, 130, 80, vgrad(400, 480, '#5fb2e8', '#3a7fc0')),
      line('M145 490V516M115 518H175', '#3a3f45', 8),
      path('M95 425h60M95 440h90M95 455h40', null, { stroke: '#ffffff', lw: 5, alpha: 0.7 }),
      // water cooler (right)
      ...shadow(1790, 702, 70, 12, 0.3),
      rect(1745, 500, 90, 200, vgrad(500, 700, '#f4f6f7', '#cdd4d9'), { r: 8, stroke: '#7c868d', lw: 3 }),
      path('M1755 500Q1750 390 1790 380Q1830 390 1825 500Z', lin(1750, 0, 1830, 0, 'rgba(120,190,240,0.75)', 'rgba(170,220,250,0.6)'), { stroke: '#4f8fc0', lw: 3 }),
      rect(1770, 540, 14, 16, '#3f78b5'), rect(1796, 540, 14, 16, '#e2574a'),
      // wall clock + framed chart on right wall
      ell(1790, 200, 50, 50, '#ffffff', { stroke: '#2f3a4a', lw: 7 }), line('M1790 200V168M1790 200L1812 214', '#2f3a4a', 5),
      ...picture(40, 160, 180, 140, { frame: '#2f3a4a', mat: '#ffffff', fw: 8, art: [path(sRect(66, 250, 24, 36) + sRect(100, 220, 24, 66) + sRect(134, 236, 24, 50) + sRect(168, 196, 24, 90), '#4fa1a5')] }),
      ...pool(960, 860, 900, 140, '#ffffff', 0.18),
      vignette(0.22),
    ].filter(Boolean),
  });
}

// ---------------------------------------------------------------------------------------------
export function cafe() {
  const floorY = 800, yTop = 700;
  const R = room({ yTop, wall: '#b5654a', floor: '#9b6b45', plankW: 90, base: '#3b2a22' });
  // bricks
  let bricks = '';
  for (let y = 20, k = 0; y < yTop - 26; y += 36, k++) { bricks += sLine(0, y, W, y); for (let x = (k % 2) * 60; x < W; x += 120) bricks += sLine(x, y, x, y + 36); }
  const cx0 = 1060; // counter start
  const ct = 520;
  let mugs = '';
  for (let i = 0; i < 6; i++) mugs += sRR(1160 + i * 60, 252, 40, 40, 6);
  return scene({
    id: 'cafe', name: 'Cafe', type: 'interior', floorY,
    layers: [
      ...R.layers,
      path(bricks, null, { stroke: '#8f4a34', lw: 3, alpha: 0.6 }),
      rect(0, 0, W, yTop, lin(0, 0, W, 0, 'rgba(40,20,10,0.25)', 'rgba(40,20,10,0)', 'rgba(40,20,10,0.25)')),
      // menu boards
      ...[[440, 'M470 180h120M470 210h90M470 240h140M470 270h100M470 300h120', '#f2c14e'], [720, 'M750 180h140M750 210h100M750 240h120M750 270h90M750 300h130', '#f4a7b9']].flatMap(([x, d, c]) => [
        rect(x + 8, 128, 240, 220, '#000000', { alpha: 0.2, r: 6 }),
        rect(x, 120, 240, 220, '#2b2f2d', { r: 6, stroke: '#6b4226', lw: 10 }),
        line(d, '#f4f7f2', 6, { alpha: 0.8 }),
        line(d.replace(/h\d+/g, 'h1').replace(/M(\d+)/g, (m, v) => `M${+v + 170}`), c, 10),
      ]),
      // round window
      ell(220, 270, 130, 130, '#2e2018'),
      ell(220, 270, 116, 116, vgrad(160, 390, '#f6c59b', '#f19a7b')),
      path('M106 300Q160 270 220 296T334 290A116 116 0 0 1 106 300Z', '#c96f6a', { alpha: 0.7 }),
      path(sCirc(250, 240, 26), '#fff1cc', { alpha: 0.9 }),
      line('M104 270H336M220 154V386', '#2e2018', 12),
      ell(220, 270, 122, 122, null, { stroke: '#6b4226', lw: 14 }),
      // shelf with mugs
      rect(1130, 292, 400, 16, '#6b4226', { stroke: '#3b2a22', lw: 3 }), band(1130, 308, 400, 24, '#000000', 0.2),
      path(mugs, '#f4efe6', { stroke: '#8f897d', lw: 3 }),
      path(range(0, 5, 1).map((i) => `M${1200 + i * 60} 262q14 0 14 14q0 14 -14 14`).join(''), null, { stroke: '#f4efe6', lw: 6 }),
      // jars
      ...[1600, 1680, 1760].map((x, i) => rect(x, 220, 60, 72, ['#c08a4e', '#6b4226', '#e0a53b'][i], { r: 10, stroke: '#3b2a22', lw: 3 })),
      rect(1590, 292, 240, 16, '#6b4226', { stroke: '#3b2a22', lw: 3 }),
      // counter
      ...shadow(1490, 702, 480, 16, 0.35),
      rect(cx0, ct + 24, W - cx0, yTop - ct - 24, vgrad(ct, yTop, '#7a4a2c', '#5a341d'), { stroke: '#2e1a0e', lw: 4 }),
      path(range(cx0 + 20, W, 70).map((x) => sRect(x, ct + 40, 50, yTop - ct - 60)).join(''), null, { stroke: '#4a2a16', lw: 3, alpha: 0.7 }),
      rect(cx0 - 20, ct, W - cx0 + 20, 26, vgrad(ct, ct + 26, '#e9e2d2', '#c9c0ac'), { stroke: '#7d7460', lw: 3 }),
      // pastry case
      rect(cx0 + 40, ct - 110, 300, 110, 'rgba(220,240,250,0.35)', { stroke: '#d8e4ea', lw: 4 }),
      line(`M${cx0 + 40} ${ct - 55}h300`, '#d8e4ea', 4),
      path(sEllAll([[cx0 + 90, ct - 66], [cx0 + 160, ct - 66], [cx0 + 230, ct - 66], [cx0 + 120, ct - 12], [cx0 + 200, ct - 12], [cx0 + 280, ct - 12]], 26, 12), '#e0a053', { stroke: '#8a5a24', lw: 3 }),
      path(sEllAll([[cx0 + 90, ct - 74], [cx0 + 160, ct - 74], [cx0 + 230, ct - 74]], 14, 6), '#f4a7b9'),
      // espresso machine
      rect(1500, ct - 150, 220, 150, lin(1500, 0, 1720, 0, '#d2d7db', '#8f979e'), { r: 10, stroke: '#4f565c', lw: 4 }),
      rect(1500, ct - 170, 220, 24, '#3a3f45', { r: 6 }),
      path(sRR(1540, ct - 70, 30, 30, 4) + sRR(1650, ct - 70, 30, 30, 4), '#3a3f45'),
      path(sCirc(1610, ct - 110, 18), '#ffffff', { stroke: '#4f565c', lw: 3 }),
      path(sRR(1546, ct - 34, 20, 28, 3) + sRR(1656, ct - 34, 20, 28, 3), '#f4efe6', { stroke: '#8f897d', lw: 2 }),
      // till
      poly([[1780, ct], [1880, ct], [1870, ct - 60], [1790, ct - 60]], '#2f3a4a', { stroke: '#15181b', lw: 3 }),
      rect(1795, ct - 100, 70, 40, vgrad(ct - 100, ct - 60, '#5fe0a0', '#3ab07a'), { r: 4, stroke: '#15181b', lw: 3 }),
      ...pendant(560, 40, { shadeColor: '#2e2018', lit: '#ffc970' }),
      ...pendant(1260, 40, { shadeColor: '#2e2018', lit: '#ffc970' }),
      ...pendant(1660, 40, { shadeColor: '#2e2018', lit: '#ffc970' }),
      ...pool(960, 880, 900, 140, '#ffc970', 0.18),
      vignette(0.35, '#1a0c06'),
    ],
    front: [
      // little cafe table in the near-left corner
      ell(120, 1040, 210, 46, vgrad(994, 1086, '#f4efe6', '#d6cfc0'), { stroke: '#5a3a1a', lw: 5 }),
      ell(120, 1052, 200, 36, null, { stroke: '#b7ae9c', lw: 3, alpha: 0.6 }),
      path('M150 1030h56l-6 -54h-44z', '#ffffff', { stroke: '#5a3a1a', lw: 4 }),
      path('M206 990q22 0 22 16q0 16 -22 16', null, { stroke: '#5a3a1a', lw: 5 }),
      ell(178, 976, 26, 6, '#7a4a2c', { stroke: '#5a3a1a', lw: 3 }),
      line('M168 960q-8 -20 4 -36M188 958q-6 -16 6 -30', '#ffffff', 4, { alpha: 0.6 }),
    ],
  });
}
function sEllAll(pts, rx, ry) { return pts.map(([x, y]) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`).join(''); }

// ---------------------------------------------------------------------------------------------
export function library() {
  const floorY = 800, yTop = 700;
  const R = room({ yTop, wall: '#3d5a4a', wallTop: '#2c4337', floor: '#7a4a2c', plankW: 100, base: '#4a2c18' });
  const buckets = BOOK.map(() => '');
  const shelfYs = [190, 320, 450, 580];
  const cases = [[40, 640], [1280, 1880]];
  let shelves = '';
  for (const [a, b] of cases) for (const y of shelfYs) { packBooks(buckets, a + 24, b - 24, y, 70, 110, a + y); shelves += sRect(a, y, b - a, 16); }
  packBooks(buckets, 50, 600, 698, 60, 95, 99);
  const wx = 760, wy = 120, ww = 400, wh = 440;
  const view = [path(sArch(wx, wy, ww, wh), vgrad(wy, wy + wh, '#26365c', '#5a6f9c')), path(sCirc(wx + 290, wy + 140, 36), '#fff6d8'), glow(wx + 290, wy + 140, 140, '#fff6d8', 0.35), path(sRidge(14, wy + wh - 60, 60, { x0: wx, x1: wx + ww, step: 70, yBottom: wy + wh }), '#1b2742')];
  return scene({
    id: 'library', name: 'Library', type: 'interior', floorY,
    layers: [
      ...R.layers,
      // wall panelling
      path(range(660, 1220, 280).map((x) => sRR(x, 600, 260, 70, 4)).join(''), null, { stroke: '#2c4337', lw: 3 }),
      ...windowFrame(wx, wy, ww, wh, { frame: '#6b4226', view, arch: true, cols: 2, rows: 3, fw: 14, sill: true, outline: '#2e1a0e' }),
      // bookcases
      ...cases.flatMap(([a, b]) => [
        ...shadow((a + b) / 2, 702, (b - a) / 2 + 20, 14, 0.4),
        rect(a, 40, b - a, 662, vgrad(40, 700, '#5a341d', '#4a2a16'), { stroke: '#2e1a0e', lw: 4 }),
        rect(a + 24, 60, b - a - 48, 640, '#2a1a10'),
        rect(a - 14, 30, b - a + 28, 34, '#7a4a2c', { r: 4, stroke: '#2e1a0e', lw: 4 }),
      ]),
      ...buckets.map((d, i) => path(d, BOOK[i], { stroke: shade(BOOK[i], -45), lw: 2.5 })),
      path(shelves, '#7a4a2c', { stroke: '#2e1a0e', lw: 3 }),
      ...cases.map(([a, b]) => rect(a + 24, 60, b - a - 48, 640, lin(a, 0, b, 0, 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)'))),
      // ladder
      line('M1430 40L1370 700M1520 40L1460 700' + range(100, 660, 70).map((y) => { const t = (y - 40) / 660; return `M${1430 - 60 * t} ${y}L${1520 - 60 * t} ${y}`; }).join(''), '#a87c3c', 10),
      line('M1410 40H1540', '#3a3029', 6),
      // reading table with green lamp
      ...shadow(960, 702, 220, 14, 0.4),
      rect(760, 586, 400, 24, '#8a5a34', { r: 4, stroke: '#2e1a0e', lw: 4 }),
      path('M790 610V700M1130 610V700', null, { stroke: '#5a341d', lw: 14 }),
      line('M900 586V540', '#c9a24a', 6), ell(900, 586, 30, 6, '#c9a24a'),
      path('M850 548Q850 510 900 506Q950 510 950 548Z', vgrad(506, 548, '#3a9a5e', '#1f6b3c'), { stroke: '#123f22', lw: 3 }),
      glow(900, 560, 240, '#ffe08a', 0.45),
      poly([[1000, 586], [1100, 586], [1096, 572], [1004, 572]], '#c0504d', { stroke: '#5a1d1b', lw: 3 }),
      path('M1010 572q35 -14 45 0q10 -14 45 0', null, { stroke: '#f4efe6', lw: 6 }),
      // rug
      poly(floorQuad(R.P, 560, 1360, 735, 990), '#7a2f2f', { stroke: '#3d1515', lw: 3 }),
      poly(floorQuad(R.P, 590, 1330, 745, 975), null, { stroke: '#d9a74a', lw: 5 }),
      ...pool(900, 760, 420, 70, '#ffe08a', 0.2),
      vignette(0.45, '#0e0804'),
    ].filter((s) => s && (s.type !== 'path' || s.d)),
  });
}

// ---------------------------------------------------------------------------------------------
export function school_hallway() {
  const floorY = 820;
  const yTop = 600, hY = 420, vx = 960, sw = 600, ceil = 150;
  const R = room({ yTop, hY, vx, sw, ceil, wall: '#efe6cf', floor: '#d7cdb8', floorKind: 'checker', tile: { w: 60, rows: 14, color: '#b9ab90', alpha: 0.55 }, base: '#5f7e95', sideShade: -6, ceilColor: '#e4ddcc' });
  const P = R.P;
  // depth samples along a side wall: t=1 at back wall, larger = nearer
  const tAt = (k) => 1 / (1 - k * 0.11);
  const wallPt = (side, t, y) => [vx + ((side < 0 ? sw : W - sw) - vx) * t, hY + (y - hY) * t];
  // lockers on both side walls, between y 330 (top) and 590 (bottom) at the back wall plane
  const lockTop = 400, lockBot = yTop - 18;
  const lockers = { L: '', R: '', vents: '', lines: '' };
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7.6; k += 0.6) {
      const t0 = tAt(k), t1 = tAt(k + 0.6);
      const a = wallPt(side, t0, lockTop), b = wallPt(side, t1, lockTop), c = wallPt(side, t1, lockBot), d = wallPt(side, t0, lockBot);
      if (a[0] < -50 || a[0] > W + 50) break;
      lockers[side < 0 ? 'L' : 'R'] += sPoly([a, b, c, d]);
      const v0 = wallPt(side, t0 + (t1 - t0) * 0.2, lockTop + 30), v1 = wallPt(side, t0 + (t1 - t0) * 0.8, lockTop + 30);
      const v2 = wallPt(side, t0 + (t1 - t0) * 0.8, lockTop + 44), v3 = wallPt(side, t0 + (t1 - t0) * 0.2, lockTop + 44);
      lockers.vents += sPoly([v0, v1, v2, v3]);
      const h0 = wallPt(side, t0 + (t1 - t0) * 0.78, (lockTop + lockBot) / 2 - 10), h1 = wallPt(side, t0 + (t1 - t0) * 0.78, (lockTop + lockBot) / 2 + 14);
      lockers.lines += sLine(...h0, ...h1);
    }
  }
  // ceiling lights (quads on the ceiling plane)
  let lights = '';
  for (let k = 0; k < 5; k++) {
    const t0 = tAt(k * 1.5 + 0.2), t1 = tAt(k * 1.5 + 0.7);
    const y0 = hY + (ceil - hY) * t0, y1 = hY + (ceil - hY) * t1;
    if (y1 < -20) break;
    const xs = (t, f) => vx + (f - vx) * t;
    lights += sPoly([[xs(t0, 880), y0], [xs(t0, 1040), y0], [xs(t1, 1040), y1], [xs(t1, 880), y1]]);
  }
  // lockers' coloured upper band per side + far wall door
  return scene({
    id: 'school_hallway', name: 'School hallway', type: 'interior', floorY,
    layers: [
      ...R.layers,
      // far wall: double door with windows + exit sign
      rect(860, 410, 200, 190, '#6aa0c4', { stroke: '#2f5670', lw: 4 }),
      path(sRect(880, 430, 70, 70) + sRect(970, 430, 70, 70), vgrad(430, 500, '#e4f3fb', '#a9d4f0'), { stroke: '#2f5670', lw: 3 }),
      line('M960 410V600M930 540h20M970 540h20', '#2f5670', 4),
      rect(925, 370, 70, 26, '#2f3a2a', { r: 4 }), rect(931, 375, 58, 16, '#6ce08a', { r: 2 }),
      // stripe along walls
      poly([wallPt(-1, 1, 380), wallPt(-1, 6, 380), wallPt(-1, 6, 392), wallPt(-1, 1, 392)], '#e46b52'),
      poly([wallPt(1, 1, 380), wallPt(1, 6, 380), wallPt(1, 6, 392), wallPt(1, 1, 392)], '#e46b52'),
      rect(sw, 380, W - 2 * sw, 12, '#e46b52'),
      path(lockers.L, lin(0, 0, sw, 0, '#3f78b5', '#5a93cc'), { stroke: '#22446a', lw: 3 }),
      path(lockers.R, lin(W, 0, W - sw, 0, '#3f78b5', '#5a93cc'), { stroke: '#22446a', lw: 3 }),
      path(lockers.vents, '#22446a', { alpha: 0.6 }),
      line(lockers.lines, '#cfd6dd', 6),
      // bulletin + poster on left wall
      poly([wallPt(-1, 1.05, 200), wallPt(-1, 1.25, 200), wallPt(-1, 1.25, 340), wallPt(-1, 1.05, 340)], '#c79a63', { stroke: '#6b4c1f', lw: 4 }),
      poly([wallPt(1, 1.1, 200), wallPt(1, 1.3, 200), wallPt(1, 1.3, 340), wallPt(1, 1.1, 340)], '#f2c14e', { stroke: '#8a6a1d', lw: 4 }),
      poly([wallPt(1, 1.15, 230), wallPt(1, 1.25, 230), wallPt(1, 1.25, 300), wallPt(1, 1.15, 300)], '#e46b52'),
      path(lights, '#fffdf2', { stroke: '#cfc8b4', lw: 3 }),
      ...pool(960, 700, 360, 60, '#ffffff', 0.25),
      ...pool(960, 880, 700, 120, '#ffffff', 0.15),
      // floor reflection of the far door
      rect(860, 600, 200, 60, vgrad(600, 660, 'rgba(106,160,196,0.25)', 'rgba(106,160,196,0)')),
      vignette(0.3),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function hospital_room() {
  const floorY = 800, yTop = 700;
  const R = room({ yTop, sw: 120, ceil: 40, wall: '#d6ece4', floor: '#c9d3d6', floorKind: 'tiles', tile: { w: 140, rows: 6, color: '#a9b5ba', alpha: 0.6 }, base: '#7fa79a', ceilColor: '#bcd6cc' });
  const wx = 1180, wy = 140, ww = 380, wh = 300;
  let blinds = '';
  for (let y = wy + 10; y < wy + 190; y += 16) blinds += sRect(wx, y, ww, 9);
  const view = [rect(wx, wy, ww, wh, vgrad(wy, wy + wh, '#8ecbf0', '#e2f4fb')), path(sRidge(3, wy + wh - 40, 60, { x0: wx, x1: wx + ww, step: 70, yBottom: wy + wh }), '#9fc98d'), path(blinds, '#f4f6f7', { stroke: '#c5ccd0', lw: 1.5 })];
  const bx = 220;
  return scene({
    id: 'hospital_room', name: 'Hospital room', type: 'interior', floorY,
    layers: [
      ...R.layers,
      rect(120, 470, W - 240, 14, '#a9cfc2'),
      ...windowFrame(wx, wy, ww, wh, { frame: '#f4f6f7', cols: 2, rows: 1, view, outline: '#9db8b3' }),
      // curtain track + privacy curtain (right)
      line('M1640 70H1800', '#9aa3ab', 8),
      path('M1650 74H1800V620Q1780 600 1760 620Q1740 600 1720 620Q1700 600 1680 620Q1665 600 1650 620Z', lin(1650, 0, 1800, 0, '#8ac4d8', '#a8d8e8', '#7ab4c8', '#a8d8e8'), { stroke: '#4f8fa8', lw: 3 }),
      line('M1690 90V600M1730 90V600M1770 90V600', '#5f9fb8', 3, { alpha: 0.5 }),
      // wall panel with outlets + light
      rect(160, 260, 560, 60, '#f4f6f7', { r: 6, stroke: '#9aa3ab', lw: 3 }),
      path(sRR(190, 276, 30, 30, 4) + sRR(240, 276, 30, 30, 4) + sRR(600, 276, 30, 30, 4) + sRR(650, 276, 30, 30, 4), '#cfd6dd', { stroke: '#7c868d', lw: 2 }),
      rect(340, 270, 200, 40, '#fffdf2', { r: 20 }), glow(440, 300, 220, '#fffdf2', 0.4),
      // monitor
      line('M800 700V420', '#7c868d', 8), line('M770 700h60', '#7c868d', 8),
      rect(720, 330, 170, 120, '#2f3a4a', { r: 10, stroke: '#15181b', lw: 4 }),
      rect(734, 344, 142, 92, '#0d1a14', { r: 4 }),
      line('M740 400h30l10 -26l14 46l12 -36l8 16h56', '#5ef08a', 4),
      path('M846 360h22v10h-22z', '#f2c14e'),
      // IV stand
      line('M1000 700V170M960 700h80M985 170h30', '#9aa3ab', 6),
      path('M972 180h56v80q0 20 -28 20q-28 0 -28 -20Z', 'rgba(200,230,250,0.75)', { stroke: '#7c868d', lw: 3 }),
      line('M1000 280Q1010 500 760 560', '#c5d8e0', 3),
      // bed
      ...shadow(bx + 260, 702, 330, 16, 0.32),
      rect(bx, 380, 34, 320, '#9aa3ab', { r: 10, stroke: '#5f666d', lw: 3 }),
      rect(bx + 34, 560, 500, 60, vgrad(560, 620, '#cfd6dd', '#9aa3ab'), { stroke: '#5f666d', lw: 3 }),
      rect(bx + 20, 500, 530, 70, '#ffffff', { r: 16, stroke: '#9aa7b6', lw: 3 }),
      path(`M${bx + 160} 494Q${bx + 170} 482 ${bx + 200} 482H${bx + 540}Q${bx + 560} 482 ${bx + 560} 502V560Q${bx + 560} 580 ${bx + 540} 580H${bx + 170}Q${bx + 150} 580 ${bx + 150} 556Z`, vgrad(482, 580, '#8fd0e8', '#6ab0cc'), { stroke: '#3f7f98', lw: 3 }),
      rect(bx + 40, 450, 130, 60, '#ffffff', { r: 26, stroke: '#9aa7b6', lw: 3 }),
      line(`M${bx + 200} 520H${bx + 520}M${bx + 200} 520V560M${bx + 520} 520V560`, '#9aa3ab', 5),
      path(`M${bx + 60} 620v70M${bx + 500} 620v70`, null, { stroke: '#5f666d', lw: 10 }),
      path(sCirc(bx + 60, 690, 10) + sCirc(bx + 500, 690, 10), '#2f3a4a'),
      // visitor chair + flowers on side table
      ...shadow(1460, 702, 90, 12, 0.3),
      rect(1390, 600, 140, 30, '#e0a53b', { r: 8, stroke: '#8a6a1d', lw: 3 }), rect(1400, 500, 120, 100, '#e0a53b', { r: 14, stroke: '#8a6a1d', lw: 3 }),
      line('M1400 630V700M1520 630V700', '#5f666d', 7),
      rect(1080, 590, 130, 110, '#f4f6f7', { stroke: '#9aa3ab', lw: 3 }), line('M1080 640H1210', '#9aa3ab', 3),
      path('M1125 590h40l-6 -50h-28z', 'rgba(200,230,250,0.8)', { stroke: '#7c868d', lw: 3 }),
      path(sCirc(1125, 520, 16) + sCirc(1160, 512, 18) + sCirc(1145, 492, 14), '#f4a7b9', { stroke: '#a3485f', lw: 3 }),
      line('M1140 540l-10 -20M1148 540l10 -24', '#4f9a5a', 4),
      ...pool(960, 860, 800, 130, '#ffffff', 0.15),
      vignette(0.22),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function grocery_aisle() {
  const floorY = 810, yTop = 700;
  const R = room({ yTop, wall: '#e8eef0', floor: '#e9e6df', floorKind: 'tiles', tile: { w: 160, rows: 7, color: '#c9c4b8', alpha: 0.7 }, base: '#3f8a5e', baseH: 0 });
  const r = rng(77);
  const PROD = ['#e2574a', '#f2c14e', '#3f78b5', '#4f9a5a', '#f19a3e', '#7a5aa6', '#f4efe6'];
  const buckets = PROD.map(() => '');
  const shelfYs = [250, 380, 510, 640];
  let shelves = '', tags = '';
  for (const y of shelfYs) {
    shelves += sRect(0, y, W, 20);
    let x = 10;
    while (x < W - 40) {
      const kind = r();
      const k = Math.floor(r() * PROD.length);
      const n = 2 + Math.floor(r() * 4);
      for (let i = 0; i < n && x < W - 40; i++) {
        if (kind < 0.4) { const w = 46, h = 70 + r() * 30; buckets[k] += sRR(x, y - h, w, h, 4); x += w + 4; }
        else if (kind < 0.7) { const w = 34; buckets[k] += sRR(x, y - 56, w, 56, 6); x += w + 4; }
        else { const w = 30; buckets[k] += `M${x} ${y}v-50q0 -14 10 -20v-16h10v16q10 6 10 20v50Z`; x += w + 6; }
      }
      tags += sRect(x - 40, y + 4, 28, 12);
      x += 14;
    }
  }
  let lamps = '';
  for (let i = 0; i < 4; i++) lamps += sRR(150 + i * 460, 18, 260, 16, 8);
  return scene({
    id: 'grocery_aisle', name: 'Grocery store', type: 'interior', floorY,
    layers: [
      ...R.layers,
      path(lamps, '#fffdf2', { stroke: '#cfc8b4', lw: 2 }),
      ...range(0, 3, 1).map((i) => glow(280 + i * 460, 30, 260, '#ffffff', 0.5)),
      // shelving unit
      rect(0, 110, W, 590, '#d0d7db'),
      rect(0, 100, W, 30, '#3f8a5e', { stroke: '#22553a', lw: 3 }),
      path(range(0, 4, 1).map((i) => sRect(i * 480 + 10, 104, 120, 22)).join(''), '#ffffff', { alpha: 0.85 }),
      rect(0, 130, W, 570, lin(0, 0, W, 0, 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.1)')),
      ...buckets.map((d, i) => path(d, PROD[i], { stroke: shade(PROD[i], -40), lw: 2.5 })),
      path(shelves, vgrad(0, 20, '#f4f6f7', '#aab3b9'), { stroke: '#6b747b', lw: 2 }),
      path(tags, '#f2c14e'),
      path(range(0, 4, 1).map((i) => sRect(i * 480, 130, 10, 570)).join(''), '#9aa3ab'),
      band(0, 130, W, 40, '#000000', 0.2),
      rect(0, 660, W, 40, vgrad(660, 700, '#9aa3ab', '#7c868d')),
      // hanging aisle signs
      ...[560, 1360].flatMap((x, i) => [
        line(`M${x - 70} 0V60M${x + 70} 0V60`, '#6b747b', 3),
        rect(x - 110, 50, 220, 70, i ? '#e2574a' : '#3f78b5', { r: 10, stroke: '#15181b', lw: 3 }),
        rect(x - 94, 64, 52, 42, '#ffffff', { r: 8 }),
        path(`M${x - 30} 74h110M${x - 30} 96h80`, null, { stroke: '#ffffff', lw: 8 }),
      ]),
      // glossy floor reflections
      rect(0, yTop, W, 120, vgrad(yTop, yTop + 120, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)')),
      ...pool(960, 880, 900, 120, '#ffffff', 0.25),
      vignette(0.2),
    ],
    front: [
      // shopping cart edge peeking in from the near right
      path('M1720 1080L1760 900H1920', null, { stroke: '#9aa3ab', lw: 12 }),
      path('M1750 940H1920M1740 985H1920M1730 1030H1920M1800 900L1790 1080M1860 900L1855 1080', null, { stroke: '#b7c0c6', lw: 6 }),
      line('M1760 860L1764 905', '#9aa3ab', 10),
      line('M1700 860H1920', '#e2574a', 16),
    ],
  });
}
