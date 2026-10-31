// Home & studio interiors: studio, living_room, kitchen, bedroom.
import {
  W, H, rect, ell, poly, path, line, lin, vgrad, rad, rgba, shade, shadow, glow, pool, vignette, band,
  sCirc, sRect, sRR, sPoly, sLine, sPuff, sRidge, floorQuad, range, windowFrame, picture, plant, pendant, scene, rng, sEll,
} from './lib.mjs';
import { room } from './room.mjs';

// ---------------------------------------------------------------------------------------------
function lightStand(x, dir) {
  // tripod + pole + softbox facing the centre (dir = +1 faces right)
  const top = 250, y = 760;
  const bx = x + dir * 40;
  return [
    ...shadow(x, y + 8, 90, 14, 0.25),
    line(`M${x} ${y - 40}L${x - 60} ${y}M${x} ${y - 40}L${x + 60} ${y}M${x} ${y - 40}L${x} ${y + 6}M${x} ${y - 40}L${x} ${top + 60}`, '#2c2f36', 8),
    poly([[bx - dir * 70, top - 40], [bx + dir * 40, top - 110], [bx + dir * 40, top + 210], [bx - dir * 70, top + 140]], lin(bx - dir * 70, 0, bx + dir * 40, 0, '#3a3e48', '#22252b'), { stroke: '#15171b', lw: 4 }),
    poly([[bx + dir * 40, top - 110], [bx + dir * 56, top - 104], [bx + dir * 56, top + 204], [bx + dir * 40, top + 210]], '#fffaf0', { stroke: '#c9c2b2', lw: 3 }),
    glow(bx + dir * 70, top + 50, 320, '#fff6df', 0.5),
  ];
}

export function studio() {
  const floorY = 790;
  return scene({
    id: 'studio', name: 'Photo studio', type: 'interior', floorY,
    layers: [
      // cyclorama: one seamless sweep from backdrop to floor
      rect(0, 0, W, H, vgrad(0, H, [0, '#c4cad6'], [0.42, '#e3e5ea'], [0.62, '#efede9'], [0.7, '#e8e2d9'], [0.82, '#d9d0c4'], [1, '#c1b6a7'])),
      ell(960, 520, 900, 520, rad(960, 520, 900, [0, 'rgba(255,255,255,0.75)'], [0.55, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)'])),
      // paper edge + roll at top
      rect(0, 0, W, 46, vgrad(0, 46, '#8d939e', '#b4bac4')),
      rect(0, 46, W, 10, 'rgba(0,0,0,0.12)'),
      // backdrop subtle side falloff
      rect(0, 0, 420, H, lin(0, 0, 420, 0, 'rgba(40,44,60,0.18)', 'rgba(40,44,60,0)')),
      rect(W - 420, 0, 420, H, lin(W, 0, W - 420, 0, 'rgba(40,44,60,0.18)', 'rgba(40,44,60,0)')),
      ...pool(960, 880, 760, 150, '#ffffff', 0.55),
      // gaffer tape marks
      path(['M640 845l40 14M680 845l-40 14', 'M940 905l40 14M980 905l-40 14', 'M1240 845l40 14M1280 845l-40 14'].join(''), null, { stroke: '#e0663d', lw: 7, alpha: 0.85 }),
      // cables
      line('M70 770C260 880 520 1000 760 1080M1850 770C1700 900 1560 960 1500 1080', '#2a2c31', 7, { alpha: 0.85 }),
      ...lightStand(80, 1),
      ...lightStand(W - 80, -1),
      // sandbags
      ...[110, W - 110].map((x) => path(sRR(x - 36, 752, 72, 26, 12), '#6b5e45', { stroke: '#3d3426', lw: 3 })),
      vignette(0.32),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function living_room() {
  const floorY = 800;
  const R = room({ yTop: 690, sw: 140, ceil: 34, wall: '#eedbb9', floor: '#b67b4b', base: '#f7efe0', plankW: 110, sideShade: -12, ceilColor: '#d9c29b' });
  const { P, x0, x1 } = R;
  const wainTop = 450;
  // wallpaper stripes
  let stripes = '';
  for (let x = x0 + 20; x < x1; x += 64) stripes += sRect(x, 34, 18, wainTop - 34);
  const wx = 1150, wy = 130, ww = 400, wh = 290;
  const view = [
    rect(wx, wy, ww, wh, vgrad(wy, wy + wh, '#8ecbf0', '#d9f0fb')),
    path(sPuff(wx + 110, wy + 70, 150, 50, 3, 4), '#ffffff', { alpha: 0.9 }),
    path(sRidge(5, wy + wh - 70, 30, { x0: wx, x1: wx + ww, step: 90, yBottom: wy + wh }), '#8fc27a'),
    path(sPuff(wx + 300, wy + wh - 100, 150, 120, 9, 4, false), '#5f9c58'),
    rect(wx, wy + wh - 30, ww, 30, '#6fae62'),
  ];
  const curtain = (x, dir) => {
    const w = 120, top = 100, bot = 520;
    const d = `M${x} ${top}L${x + dir * w} ${top}Q${x + dir * (w - 30)} ${(top + bot) / 2} ${x + dir * (w + 20)} ${bot}L${x - dir * 10} ${bot}Q${x + dir * 14} ${(top + bot) / 2} ${x} ${top}Z`;
    return [
      path(d, lin(x, 0, x + dir * w, 0, '#c9553f', '#e2735a', '#b84a36'), { stroke: '#7d2f22', lw: 3 }),
      line(`M${x + dir * 35} ${top + 10}Q${x + dir * 30} ${bot - 150} ${x + dir * 45} ${bot - 5}M${x + dir * 75} ${top + 10}Q${x + dir * 70} ${bot - 150} ${x + dir * 85} ${bot - 5}`, '#9c3b2b', 3, { alpha: 0.6 }),
      rect(x + (dir > 0 ? 0 : -w), 330, w, 16, '#f2c14e', { r: 8, alpha: 0.95 }),
    ];
  };
  // sofa
  const sx = 300, sw = 620, sy = 500;
  const sofa = [
    ...shadow(sx + sw / 2, 702, sw / 2 + 40, 18, 0.32),
    rect(sx + 30, sy, sw - 60, 140, vgrad(sy, sy + 140, '#e8ae45', '#c98d2c'), { r: 34, stroke: '#7c5413', lw: 4 }),
    rect(sx + 10, sy + 110, sw - 20, 80, vgrad(sy + 110, sy + 190, '#f0bb55', '#d29530'), { r: 22, stroke: '#7c5413', lw: 4 }),
    line(`M${sx + sw / 2} ${sy + 18}L${sx + sw / 2} ${sy + 110}M${sx + sw / 2} ${sy + 118}L${sx + sw / 2} ${sy + 180}`, '#a8731f', 4),
    rect(sx - 20, sy + 70, 80, 130, vgrad(sy + 70, sy + 200, '#e2a43c', '#b97f22'), { r: 30, stroke: '#7c5413', lw: 4 }),
    rect(sx + sw - 60, sy + 70, 80, 130, vgrad(sy + 70, sy + 200, '#e2a43c', '#b97f22'), { r: 30, stroke: '#7c5413', lw: 4 }),
    path(sRR(sx + 90, sy + 50, 110, 80, 26), '#3f7f8c', { stroke: '#22505a', lw: 4 }),
    path(sRR(sx + sw - 200, sy + 50, 110, 80, 26), '#d9654b', { stroke: '#8b3424', lw: 4 }),
    line(`M${sx + 10} ${sy + 196}l0 16M${sx + sw - 10} ${sy + 196}l0 16`, '#5a3a1a', 10),
  ];
  const lampX = 1700;
  const rq = floorQuad(P, 610, 1310, 742, 960);
  const rq2 = floorQuad(P, 635, 1285, 750, 948);
  return scene({
    id: 'living_room', name: 'Living room', type: 'interior', floorY,
    layers: [
      ...R.layers,
      // wainscot
      rect(x0, wainTop, x1 - x0, 690 - 26 - wainTop, vgrad(wainTop, 690, '#87a98f', '#76977e')),
      path(range(x0 + 40, x1 - 200, 230).map((x) => sRR(x, wainTop + 40, 190, 150, 6)).join(''), null, { stroke: '#5f7d66', lw: 3, alpha: 0.7 }),
      path(stripes, 'rgba(255,255,255,0.28)'),
      rect(x0, wainTop - 8, x1 - x0, 16, '#f7efe0', { stroke: '#cdbb9c', lw: 2 }),
      band(x0, wainTop + 8, x1 - x0, 24, '#000000', 0.12),
      // window + curtains
      ...windowFrame(wx, wy, ww, wh, { frame: '#f7efe0', cols: 2, rows: 2, view, outline: '#b9a684' }),
      line(`M${wx - 160} 96L${wx + ww + 160} 96`, '#5b3d26', 10),
      ...[wx - 160, wx + ww + 160].map((x) => ell(x, 96, 14, 14, '#7a5236')),
      ...curtain(wx - 30, -1),
      ...curtain(wx + ww + 30, 1),
      // pictures
      ...picture(380, 200, 200, 150, { art: [rect(400, 220, 160, 110, vgrad(220, 330, '#f7c873', '#e98a5a')), path(sRidge(2, 300, 40, { x0: 400, x1: 560, step: 50, yBottom: 330 }), '#7a5aa6'), ell(480, 255, 18, 18, '#fff3c4')] }),
      ...picture(640, 250, 130, 160, { frame: '#2f3a4a', art: [ell(705, 330, 34, 46, '#3f7f8c'), ell(705, 300, 22, 22, '#f2c14e')] }),
      // side table + lamp
      ...shadow(1040, 700, 70, 10, 0.3),
      rect(985, 590, 110, 112, vgrad(590, 700, '#8a5a34', '#6a4224'), { r: 6, stroke: '#3f2614', lw: 3 }),
      rect(975, 578, 130, 18, '#9b6a40', { r: 4, stroke: '#3f2614', lw: 3 }),
      rect(1030, 500, 20, 80, '#e9d8b8', { stroke: '#8a7350', lw: 3 }),
      glow(1040, 470, 220, '#ffd98a', 0.45),
      poly([[1000, 500], [1080, 500], [1066, 430], [1014, 430]], vgrad(430, 500, '#fff1cc', '#f6d58b'), { stroke: '#b88d3d', lw: 3 }),
      // sofa
      ...sofa,
      // floor lamp
      ...shadow(lampX, 700, 60, 10, 0.3),
      line(`M${lampX} 300L${lampX} 696M${lampX - 40} 698L${lampX + 40} 698`, '#3a3029', 8),
      glow(lampX, 290, 300, '#ffd98a', 0.4),
      poly([[lampX - 70, 330], [lampX + 70, 330], [lampX + 46, 240], [lampX - 46, 240]], vgrad(240, 330, '#fff1cc', '#f2c86a'), { stroke: '#b88d3d', lw: 3 }),
      ...plant(1430, 702, 0.85, { pot: '#3f7f8c', seed: 4 }),
      // rug
      poly(rq, '#35507a', { stroke: '#22344f', lw: 3 }),
      poly(rq2, null, { stroke: '#e9d8b8', lw: 6 }),
      path(range(680, 1200, 130).map((X) => { const y = 850; const [a, b] = [P.px(X, y), P.px(X + 60, y)]; return sPoly([[a, y], [(a + b) / 2, y - 16], [b, y], [(a + b) / 2, y + 18]]); }).join(''), '#d9654b', { alpha: 0.85 }),
      vignette(0.3),
    ],
    front: [
      // big monstera leaves in the near corner
      path('M1920 760C1830 770 1760 840 1770 930C1790 900 1820 905 1830 930C1800 960 1800 1010 1830 1050C1850 1010 1880 1000 1920 1010Z', vgrad(760, 1060, '#4f9a5a', '#2f6e3c'), { stroke: '#1e4a28', lw: 4 }),
      path('M1920 880C1880 900 1850 960 1870 1080L1920 1080Z', '#3d8449', { stroke: '#1e4a28', lw: 4 }),
      line('M1920 790C1860 830 1830 900 1840 1000', '#1e4a28', 3, { alpha: 0.6 }),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function kitchen() {
  const floorY = 800, yTop = 700;
  const R = room({ yTop, wall: '#f6efe0', floor: '#e8dccb', floorKind: 'checker', tile: { w: 120, rows: 7, color: '#d27a5c', alpha: 0.6 }, base: '#2f6f73', baseH: 0 });
  const cTop = 548, cBot = yTop;
  // backsplash tiles
  let tiles = '';
  for (let y = 380; y < cTop; y += 42) tiles += sLine(0, y, W, y);
  for (let y = 380, k = 0; y < cTop; y += 42, k++) for (let x = (k % 2) * 40; x < W; x += 80) tiles += sLine(x, y, x, Math.min(y + 42, cTop));
  // lower cabinets doors
  let doors = '', knobs = '';
  for (let x = 330; x < 1290; x += 160) { doors += sRR(x + 10, cTop + 34, 140, cBot - cTop - 52, 8); knobs += sCirc(x + 130, cTop + 70, 6); }
  for (let x = 1530; x < W; x += 160) { doors += sRR(x + 10, cTop + 34, 140, cBot - cTop - 52, 8); knobs += sCirc(x + 22, cTop + 70, 6); }
  // upper cabinets
  let upper = '', uk = '';
  for (const x of [330, 490, 1530, 1690]) { upper += sRR(x + 8, 110, 144, 220, 8); uk += sCirc(x + 80, 306, 6); }
  const wx = 760, wy = 130, ww = 420, wh = 250;
  const view = [rect(wx, wy, ww, wh, vgrad(wy, wy + wh, '#9fd6f2', '#e5f6fb')), path(sRidge(8, wy + wh - 60, 50, { x0: wx, x1: wx + ww, step: 80, yBottom: wy + wh }), '#9cc98a'), path(sPuff(wx + 90, wy + 160, 140, 110, 3, 4, false), '#62a35c'), path(sPuff(wx + 320, wy + 60, 120, 40, 6, 4), '#ffffff')];
  return scene({
    id: 'kitchen', name: 'Kitchen', type: 'interior', floorY,
    layers: [
      ...R.layers,
      rect(0, 380, W, cTop - 380, '#d7ece6'),
      path(tiles, null, { stroke: '#ffffff', lw: 3, alpha: 0.9 }),
      ...windowFrame(wx, wy, ww, wh, { frame: '#ffffff', cols: 2, rows: 1, view, outline: '#9db8b3', sill: false }),
      // valance
      path(`M${wx - 40} ${wy - 30}H${wx + ww + 40}V${wy + 20}` + range(0, 7, 1).map((i) => `Q${wx + ww + 40 - (i + 0.5) * ((ww + 80) / 8)} ${wy + 50} ${wx + ww + 40 - (i + 1) * ((ww + 80) / 8)} ${wy + 20}`).join('') + 'Z', '#e46b52', { stroke: '#9c3b2b', lw: 3 }),
      // upper cabinets
      rect(330, 100, 320, 240, '#3f8a8e', { stroke: '#1f4f52', lw: 4 }),
      rect(1530, 100, 390, 240, '#3f8a8e', { stroke: '#1f4f52', lw: 4 }),
      path(upper, '#4fa1a5', { stroke: '#2b6467', lw: 3 }),
      path(uk, '#f2c14e', { stroke: '#8a6a1d', lw: 2 }),
      band(330, 340, 320, 40, '#000000', 0.16), band(1530, 340, 390, 40, '#000000', 0.16),
      // range hood + stove
      poly([[1330, 150], [1490, 150], [1520, 330], [1300, 330]], vgrad(150, 330, '#d2d7db', '#a9b0b6'), { stroke: '#5f666d', lw: 4 }),
      rect(1290, 330, 240, 22, '#8d949b', { r: 6, stroke: '#5f666d', lw: 3 }),
      // counter + lower cabinets
      rect(300, cTop + 20, W - 300, cBot - cTop - 20, vgrad(cTop, cBot, '#4fa1a5', '#3a7f83')),
      path(doors, '#55a9ad', { stroke: '#2b6467', lw: 3 }),
      path(knobs, '#f2c14e', { stroke: '#8a6a1d', lw: 2 }),
      rect(1290, cTop + 20, 240, cBot - cTop - 20, vgrad(cTop, cBot, '#3a3f45', '#25292d'), { stroke: '#15181b', lw: 3 }),
      rect(1316, cTop + 70, 188, 90, '#11161a', { r: 8, stroke: '#5f666d', lw: 4 }),
      rect(1316, cTop + 70, 188, 90, rad(1410, cTop + 140, 110, 'rgba(255,140,60,0.35)', 'rgba(255,140,60,0)'), { r: 8 }),
      rect(290, cTop, W - 290, 26, vgrad(cTop, cTop + 26, '#f3f1ec', '#cfcac0'), { stroke: '#8f897d', lw: 3 }),
      band(300, cTop + 26, W - 300, 26, '#000000', 0.18),
      // sink faucet
      line(`M970 ${cTop}L970 ${cTop - 70}Q970 ${cTop - 96} 1000 ${cTop - 96}L1030 ${cTop - 96}L1030 ${cTop - 80}`, '#9aa3ab', 10),
      // stuff on counter
      ell(1360, cTop - 2, 50, 10, '#22262a'), path(`M1325 ${cTop - 6}Q1320 ${cTop - 70} 1360 ${cTop - 74}Q1400 ${cTop - 70} 1395 ${cTop - 6}Z`, lin(1320, 0, 1400, 0, '#e2574a', '#b33a30'), { stroke: '#6e1f1a', lw: 3 }),
      ell(1460, cTop - 4, 46, 8, '#22262a'), path(`M1420 ${cTop - 4}h80v-38q0 -12 -12 -12h-56q-12 0 -12 12Z`, lin(1420, 0, 1500, 0, '#c9ced3', '#8f979e'), { stroke: '#4f565c', lw: 3 }),
      path(`M560 ${cTop}h110l-12 -40h-86Z`, '#f3ead7', { stroke: '#a89a7c', lw: 3 }),
      path(sCirc(590, cTop - 52, 20) + sCirc(625, cTop - 58, 22) + sCirc(650, cTop - 46, 18), '#e2574a', { stroke: '#7a201a', lw: 3 }),
      path(sCirc(612, cTop - 74, 16), '#f2c14e', { stroke: '#8a6a1d', lw: 3 }),
      rect(1700, cTop - 90, 70, 90, lin(1700, 0, 1770, 0, '#e9e2d2', '#c9c0ac'), { r: 8, stroke: '#7d7460', lw: 3 }),
      line(`M1720 ${cTop - 90}l-14 -60M1735 ${cTop - 90}l4 -70M1750 ${cTop - 90}l20 -56`, '#7a5236', 7),
      // fridge
      ...shadow(185, 702, 150, 14, 0.3),
      rect(50, 160, 270, 542, lin(50, 0, 320, 0, '#f4f6f7', '#d3d9dd'), { r: 26, stroke: '#7c868d', lw: 4 }),
      line('M50 360H320', '#7c868d', 4),
      rect(280, 210, 14, 110, '#9aa3ab', { r: 7 }), rect(280, 400, 14, 160, '#9aa3ab', { r: 7 }),
      rect(100, 410, 70, 90, '#f2c14e', { r: 4, alpha: 0.9 }), rect(180, 430, 60, 50, '#7fc4d8', { r: 4, alpha: 0.9 }),
      ...pendant(620, 40, { shadeColor: '#e46b52' }).slice(1),
      ...pendant(1300, 40, { shadeColor: '#e46b52' }).slice(1),
      line('M620 0V40M1300 0V40', '#3a3a3a', 3),
      ...pool(960, 880, 700, 120, '#fff4d6', 0.22),
      vignette(0.28),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function bedroom() {
  const floorY = 800;
  const R = room({ yTop: 690, sw: 130, ceil: 30, wall: '#c9d4f0', floor: '#c49a6c', base: '#ffffff', plankW: 100, ceilColor: '#aebbe0' });
  const { P, x0, x1 } = R;
  // polka-dot wallpaper
  const r = rng(12);
  let dots = '';
  for (let y = 70; y < 640; y += 70) for (let x = x0 + ((y / 70) % 2) * 45; x < x1; x += 90) dots += sCirc(x + r() * 4, y, 6);
  const wx = 860, wy = 140, ww = 340, wh = 300;
  const view = [rect(wx, wy, ww, wh, vgrad(wy, wy + wh, '#7fc0ec', '#d4eefa')), path(sPuff(wx + 230, wy + 80, 150, 60, 2, 4), '#fff'), path(sRidge(9, wy + wh - 40, 40, { x0: wx, x1: wx + ww, step: 70, yBottom: wy + wh }), '#a5cf8f')];
  // fairy lights
  let bulbs = '';
  for (let i = 0; i <= 12; i++) { const t = i / 12; const x = 230 + t * 520; const y = 150 + Math.sin(t * Math.PI * 3) * 26 + 30; bulbs += sCirc(x, y + 10, 8); }
  const bx = 190, bw = 600;
  return scene({
    id: 'bedroom', name: 'Bedroom', type: 'interior', floorY,
    layers: [
      ...R.layers,
      path(dots, '#ffffff', { alpha: 0.4 }),
      // fairy lights
      line(range(0, 12, 1).map((i) => { const t = i / 12; return `${i ? 'L' : 'M'}${230 + t * 520} ${150 + Math.sin(t * Math.PI * 3) * 26 + 30}`; }).join(''), '#5a6a7a', 2),
      path(bulbs, '#ffe08a', { stroke: '#d9a73a', lw: 2 }),
      // window
      ...windowFrame(wx, wy, ww, wh, { frame: '#ffffff', cols: 2, rows: 2, view, outline: '#9aa7c6' }),
      path(`M${wx - 50} ${wy - 30}H${wx + ww + 50}L${wx + ww + 30} ${wy + 40}Q${wx + ww / 2} ${wy + 90} ${wx - 30} ${wy + 40}Z`, vgrad(wy - 30, wy + 60, '#f4a7b9', '#e07f98'), { stroke: '#a3485f', lw: 3 }),
      // poster + shelf
      ...picture(1330, 150, 170, 230, { frame: '#2f3a4a', mat: '#24304a', fw: 8, art: [path(sCirc(1415, 240, 50), '#f2c14e'), path(sRidge(4, 330, 40, { x0: 1338, x1: 1492, step: 50, yBottom: 372 }), '#e07f98'), path(sRect(1350, 345, 130, 8), '#ffffff')] }),
      rect(1550, 300, 260, 18, '#8a5a34', { r: 3, stroke: '#4f3018', lw: 3 }),
      band(1550, 318, 260, 26, '#000000', 0.15),
      rect(1570, 230, 26, 70, '#e46b52', { stroke: '#8b3424', lw: 3 }), rect(1598, 240, 22, 60, '#3f8a8e', { stroke: '#1f4f52', lw: 3 }), rect(1622, 222, 26, 78, '#f2c14e', { stroke: '#8a6a1d', lw: 3 }),
      path(sCirc(1740, 268, 32), '#ffffff', { stroke: '#9aa7c6', lw: 3 }), line('M1740 268V248M1740 268L1756 276', '#2f3a4a', 3),
      // bed (against back wall, left)
      ...shadow(bx + bw / 2, 700, bw / 2 + 30, 18, 0.32),
      path(`M${bx} 700V430Q${bx} 380 ${bx + 60} 380H${bx + 200}Q${bx + 260} 380 ${bx + 260} 430V700Z`, vgrad(380, 700, '#8a5a34', '#6a4224'), { stroke: '#3f2614', lw: 4 }),
      rect(bx + 40, 560, bw - 40, 140, vgrad(560, 700, '#8a5a34', '#6a4224'), { stroke: '#3f2614', lw: 4 }),
      rect(bx + 30, 520, bw - 20, 70, '#ffffff', { r: 16, stroke: '#9aa7c6', lw: 3 }),
      path(`M${bx + 230} 515Q${bx + 240} 500 ${bx + 270} 500H${bx + bw + 6}Q${bx + bw + 24} 500 ${bx + bw + 24} 520V610Q${bx + bw + 24} 630 ${bx + bw + 4} 630H${bx + 250}Q${bx + 222} 630 ${bx + 222} 600Z`, vgrad(500, 630, '#6aa8d8', '#4a82b8'), { stroke: '#2b5580', lw: 4 }),
      path(range(0, 5, 1).map((i) => sRect(bx + 290 + i * 100, 500, 40, 128)).join(''), '#ffffff', { alpha: 0.18 }),
      rect(bx + 60, 470, 150, 70, '#ffffff', { r: 30, stroke: '#9aa7c6', lw: 3 }),
      // rug
      ell(980, 870, 420, 90, '#f4a7b9', { stroke: '#c46b84', lw: 4 }), ell(980, 870, 340, 68, null, { stroke: '#ffffff', lw: 5, alpha: 0.7 }),
      // desk + lamp + laptop
      ...shadow(1560, 700, 230, 14, 0.3),
      rect(1340, 520, 440, 22, '#e9d8b8', { r: 4, stroke: '#8a7350', lw: 3 }),
      rect(1360, 542, 24, 158, '#d1bf9c', { stroke: '#8a7350', lw: 3 }), rect(1736, 542, 24, 158, '#d1bf9c', { stroke: '#8a7350', lw: 3 }),
      rect(1600, 542, 140, 110, '#d1bf9c', { stroke: '#8a7350', lw: 3 }), line('M1610 597H1730', '#8a7350', 3), ell(1670, 575, 10, 4, '#8a7350'), ell(1670, 625, 10, 4, '#8a7350'),
      poly([[1440, 518], [1580, 518], [1600, 512], [1420, 512]], '#5f666d'), poly([[1450, 512], [1570, 512], [1560, 420], [1460, 420]], '#3a3f45', { stroke: '#1d2023', lw: 3 }),
      poly([[1462, 505], [1558, 505], [1550, 428], [1470, 428]], vgrad(428, 505, '#8fd3f5', '#5aa8d8')),
      line('M1700 518V430L1660 380', '#2f3a4a', 6), poly([[1640, 360], [1700, 360], [1690, 400], [1650, 400]], '#e46b52', { stroke: '#8b3424', lw: 3 }), glow(1670, 420, 160, '#ffe08a', 0.35),
      // chair
      path('M1480 560h120v18h-120zM1500 578v120M1580 578v120M1490 470h100v90h-100z', '#e46b52', { stroke: '#8b3424', lw: 4 }),
      vignette(0.3),
    ],
  });
}
