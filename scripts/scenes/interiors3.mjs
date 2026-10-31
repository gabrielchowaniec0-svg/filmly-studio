// Story-world interiors: spooky_mansion_hall, castle_throne_room, spaceship_bridge, theater_stage.
import {
  W, H, rect, ell, poly, path, line, lin, vgrad, rad, rgba, shade, shadow, glow, pool, vignette, band,
  sCirc, sRect, sRR, sPoly, sLine, sPuff, sRidge, sArch, sStars, sSparkle, floorQuad, range, windowFrame, picture, scene, rng,
} from './lib.mjs';
import { room } from './room.mjs';

const flame = (x, y, s = 1, c1 = '#ffd36a', c2 = '#ff8a3a') => [
  glow(x, y - 10 * s, 150 * s, '#ffb04a', 0.45),
  path(`M${x} ${y - 34 * s}Q${x + 14 * s} ${y - 12 * s} ${x + 9 * s} ${y}Q${x} ${y + 6 * s} ${x - 9 * s} ${y}Q${x - 14 * s} ${y - 12 * s} ${x} ${y - 34 * s}Z`, c2),
  path(`M${x} ${y - 22 * s}Q${x + 7 * s} ${y - 8 * s} ${x + 4 * s} ${y}Q${x} ${y + 3 * s} ${x - 4 * s} ${y}Q${x - 7 * s} ${y - 8 * s} ${x} ${y - 22 * s}Z`, c1),
];
const cobweb = (cx, cy, dx, dy, R = 220) => {
  // corner web: radial threads + sagging rings
  let d = '';
  const angs = [0, 0.2, 0.45, 0.7, 1].map((t) => t * Math.PI / 2);
  const pt = (a, r) => [cx + dx * Math.cos(a) * r, cy + dy * Math.sin(a) * r];
  for (const a of angs) { const p = pt(a, R); d += sLine(cx, cy, p[0], p[1]); }
  for (const r of [0.3, 0.55, 0.8].map((f) => f * R)) {
    for (let i = 0; i < angs.length - 1; i++) {
      const p0 = pt(angs[i], r), p1 = pt(angs[i + 1], r), m = pt((angs[i] + angs[i + 1]) / 2, r * 0.82);
      d += `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}Q${m[0].toFixed(1)} ${m[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    }
  }
  return line(d, 'rgba(225,220,240,0.55)', 2.5);
};

// ---------------------------------------------------------------------------------------------
export function spooky_mansion_hall() {
  const floorY = 800, yTop = 690;
  const R = room({ yTop, sw: 150, ceil: 0, wall: '#3b2c4a', wallTop: '#22192c', floor: '#2b2433', floorNear: '#3a3044', floorKind: 'checker', tile: { w: 110, rows: 8, color: '#4a3f58', alpha: 0.9 }, base: '#1c121a', baseH: 30, sideShade: -22 });
  const { P } = R;
  // damask diamonds
  let dam = '';
  for (let y = 60, k = 0; y < 440; y += 80, k++) for (let x = 190 + (k % 2) * 50; x < 1760; x += 100) dam += sPoly([[x, y - 18], [x + 12, y], [x, y + 18], [x - 12, y]]);
  // staircase
  const steps = 9, sx0 = 700, sx1 = 1220, st = 300;
  let treads = '', risers = '';
  for (let i = 0; i < steps; i++) {
    const y = 690 - (i + 1) * ((690 - st) / steps);
    const inset = i * 14;
    risers += sRect(sx0 + inset, y, sx1 - sx0 - 2 * inset, (690 - st) / steps);
    treads += sLine(sx0 + inset, y, sx1 - inset, y);
  }
  const wx = 840, wy = 60, ww = 240, wh = 230;
  const view = [path(sArch(wx, wy, ww, wh), vgrad(wy, wy + wh, '#1d2440', '#41406a')), path(sCirc(wx + 150, wy + 90, 40), '#f4f0d8'), glow(wx + 150, wy + 90, 140, '#d8e0ff', 0.3),
    path(`M${wx + 30} ${wy + wh}L${wx + 40} ${wy + 150}L${wx + 60} ${wy + 140}L${wx + 70} ${wy + wh}Z`, '#141024')];
  const portrait = (x, y, w, h, eyes) => [
    rect(x + 10, y + 12, w, h, '#000000', { alpha: 0.35 }),
    rect(x, y, w, h, vgrad(y, y + h, '#b8913a', '#7a5a1d'), { stroke: '#3a2a0a', lw: 4 }),
    rect(x + 16, y + 16, w - 32, h - 32, vgrad(y, y + h, '#3a2f2a', '#1f1814')),
    path(`M${x + w / 2 - 50} ${y + h - 16}Q${x + w / 2 - 54} ${y + h - 90} ${x + w / 2} ${y + h - 100}Q${x + w / 2 + 54} ${y + h - 90} ${x + w / 2 + 50} ${y + h - 16}Z` + sEllipse(x + w / 2, y + h - 140, 34, 44), '#5a4a3a'),
    path(sEllipse(x + w / 2 - 12, y + h - 146, 6, 4) + sEllipse(x + w / 2 + 12, y + h - 146, 6, 4), eyes ? '#ffe66a' : '#2a201a'),
    ...(eyes ? [glow(x + w / 2, y + h - 146, 50, '#ffe66a', 0.45)] : []),
  ];
  return scene({
    id: 'spooky_mansion_hall', name: 'Spooky mansion hall', type: 'interior', floorY,
    layers: [
      ...R.layers,
      path(dam, '#4a3a5c', { alpha: 0.6 }),
      // wainscot
      rect(150, 460, 1620, 230 - 30, vgrad(460, 690, '#2a1a20', '#1c1015')),
      path(range(170, 1700, 200).map((x) => sRR(x, 485, 170, 150, 4)).join(''), null, { stroke: '#3d2830', lw: 3 }),
      rect(150, 452, 1620, 14, '#4a2f38'),
      // window behind landing + moonbeam
      ...windowFrame(wx, wy, ww, wh, { frame: '#1c121a', cols: 2, rows: 2, view, arch: true, fw: 12, sill: false }),
      poly([[wx + 10, wy + 120], [wx + ww - 10, wy + 120], [1500, 1080], [420, 1080]], lin(0, wy + 120, 0, 1080, 'rgba(190,200,255,0.16)', 'rgba(190,200,255,0.02)')),
      // staircase
      rect(sx0 - 40, st - 30, sx1 - sx0 + 80, 40, '#3a2228', { stroke: '#140a0e', lw: 3 }),
      path(risers, vgrad(st, 690, '#4a2a32', '#3a2026'), { stroke: '#140a0e', lw: 3 }),
      line(treads, '#6a4048', 4),
      poly([[sx0 + 140, 300], [sx1 - 140, 300], [sx1 - 40, 690], [sx0 + 40, 690]], vgrad(300, 690, '#7a1f2a', '#a02a36'), { alpha: 0.9 }),
      // banisters
      ...[[-1, sx0 - 20], [1, sx1 + 20]].map(([dir, x]) => line(`M${x} 690L${x + dir * -10} ${st - 20}` + range(0, 8, 1).map((i) => { const y = 690 - i * 45; const xx = x + dir * -10 * (i / 8); return `M${xx} ${y}v-60`; }).join(''), '#2a1418', 8)),
      ...[[-1, sx0 - 20], [1, sx1 + 20]].map(([dir, x]) => line(`M${x} 630L${x - dir * 10} ${st - 70}`, '#5a2e36', 14)),
      ...[sx0 - 20, sx1 + 20].flatMap((x) => [rect(x - 20, 600, 40, 92, '#2a1418', { stroke: '#0e0608', lw: 3 }), path(sCirc(x, 588, 22), '#5a2e36', { stroke: '#0e0608', lw: 3 })]),
      // portraits
      ...portrait(230, 110, 210, 280, true),
      ...portrait(500, 150, 150, 200, false),
      ...portrait(1480, 120, 200, 260, false),
      // grandfather clock
      ...shadow(300, 692, 80, 12, 0.5),
      rect(240, 430, 120, 260, vgrad(430, 690, '#4a2a1a', '#2a160e'), { stroke: '#0e0806', lw: 4 }),
      path(sArch(230, 360, 140, 110), '#4a2a1a', { stroke: '#0e0806', lw: 4 }),
      ell(300, 420, 44, 44, '#d8cfb0', { stroke: '#0e0806', lw: 4 }), line('M300 420V390M300 420L318 436', '#1a1010', 4),
      path(sRR(270, 480, 60, 160, 8), '#1a0e08'), line('M300 486V600', '#b8913a', 4), ell(300, 610, 16, 16, '#b8913a'),
      // side table + candelabra (right)
      ...shadow(1350, 692, 90, 12, 0.5),
      rect(1270, 560, 160, 20, '#3a2228', { stroke: '#0e0608', lw: 3 }), line('M1290 580V690M1410 580V690', '#2a1418', 10),
      line('M1350 560V470M1310 500Q1310 520 1350 520Q1390 520 1390 500M1310 500V470M1390 500V470', '#b8913a', 7),
      path(sRect(1302, 440, 16, 32) + sRect(1342, 438, 16, 34) + sRect(1382, 440, 16, 32), '#efe6d0'),
      ...flame(1310, 438, 0.7), ...flame(1350, 436, 0.7), ...flame(1390, 438, 0.7),
      // suit of armor (right)
      ...shadow(1650, 692, 70, 12, 0.5),
      path('M1620 690v-120h20v120zM1660 690v-120h20v120z', '#8a93a3', { stroke: '#2a2f38', lw: 3 }),
      path('M1600 580q0 -130 50 -140q50 10 50 140z', lin(1600, 0, 1700, 0, '#b8c0cc', '#6f7888'), { stroke: '#2a2f38', lw: 3 }),
      path('M1620 440q0 -60 30 -66q30 6 30 66z', lin(1620, 0, 1680, 0, '#b8c0cc', '#6f7888'), { stroke: '#2a2f38', lw: 3 }),
      line('M1628 410h44', '#1a1d22', 6), line('M1650 374v-30', '#a02a36', 8),
      line('M1712 690L1712 380', '#5a3a1a', 6), poly([[1712, 380], [1700, 410], [1724, 410]], '#8a93a3'),
      // runner on the floor
      poly(floorQuad(P, 820, 1100, 690, 1080), vgrad(690, 1080, '#7a1f2a', '#a02a36')),
      poly(floorQuad(P, 836, 1084, 690, 1080), null, { stroke: '#c9a24a', lw: 3, alpha: 0.6 }),
      // low fog
      rect(0, 760, W, 320, vgrad(760, 1080, 'rgba(140,120,180,0)', 'rgba(140,120,180,0.22)')),
      path(sPuff(300, 1000, 700, 120, 3, 6) + sPuff(1500, 1020, 800, 110, 8, 6), '#8f80b0', { alpha: 0.12 }),
      vignette(0.65, '#0a0612', 0.4),
    ],
    front: [
      cobweb(0, 0, 1, 1, 260),
      cobweb(W, 0, -1, 1, 200),
      // hanging chandelier silhouette at top
      line('M960 0V40', '#1a1010', 4),
      path('M880 70Q960 110 1040 70L1030 60Q960 90 890 60Z', '#2a1a14'),
      path(sRect(886, 40, 8, 22) + sRect(956, 34, 8, 26) + sRect(1026, 40, 8, 22), '#efe6d0'),
      ...flame(890, 40, 0.5), ...flame(960, 34, 0.5), ...flame(1030, 40, 0.5),
    ],
  });
}
const sEllipse = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

// ---------------------------------------------------------------------------------------------
export function castle_throne_room() {
  const floorY = 800, yTop = 690;
  const R = room({ yTop, sw: 0, wall: '#8d8676', wallTop: '#6b6558', floor: '#8a8070', floorKind: 'tiles', tile: { w: 160, rows: 6, color: '#5f574a', alpha: 0.6 }, base: '#5f574a', baseH: 0 });
  const { P } = R;
  let blocks = '';
  for (let y = 40, k = 0; y < yTop; y += 60, k++) { blocks += sLine(0, y, W, y); for (let x = (k % 2) * 70; x < W; x += 140) blocks += sLine(x, y, x, Math.min(y + 60, yTop)); }
  // stained glass
  const gx = 830, gy = 60, gw = 260, gh = 300;
  const r = rng(5);
  const glass = ['#d64545', '#3f78d0', '#f2c14e', '#4fae6a', '#8a5ac0'];
  const gb = glass.map(() => '');
  const acy = gy + gw / 2, acx = gx + gw / 2; // arch centre
  for (let y = acy; y < gy + gh - 1; y += (gy + gh - acy) / 3) for (let x = gx; x < gx + gw - 1; x += gw / 5) gb[Math.floor(r() * glass.length)] += sRect(x, y, gw / 5, (gy + gh - acy) / 3);
  // rose-window wedges in the arch
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i * Math.PI) / 6, a1 = Math.PI + ((i + 1) * Math.PI) / 6, R0 = gw / 2;
    gb[i % glass.length] += `M${acx} ${acy}L${(acx + R0 * Math.cos(a0)).toFixed(1)} ${(acy + R0 * Math.sin(a0)).toFixed(1)}A${R0} ${R0} 0 0 1 ${(acx + R0 * Math.cos(a1)).toFixed(1)} ${(acy + R0 * Math.sin(a1)).toFixed(1)}Z`;
  }
  const banner = (x) => [
    line(`M${x - 80} 70H${x + 80}`, '#4a3a1a', 10),
    path(`M${x - 70} 74H${x + 70}V420L${x} 370L${x - 70} 420Z`, lin(x - 70, 0, x + 70, 0, '#8a1f24', '#b8343a', '#8a1f24'), { stroke: '#4a0e12', lw: 4 }),
    path(`M${x - 56} 90H${x + 56}`, null, { stroke: '#e0b84a', lw: 6 }),
    path(`M${x} 170L${x + 36} 210L${x + 24} 280L${x} 300L${x - 24} 280L${x - 36} 210Z`, '#e0b84a', { stroke: '#7a5a1a', lw: 3 }),
    path(`M${x - 12} 220h24v40h-24z`, '#8a1f24'),
  ];
  const pillar = (x) => [
    rect(x - 70, 0, 140, yTop, lin(x - 70, 0, x + 70, 0, '#a8a090', '#c8c0b0', '#8a8272', '#6e675a')),
    line(`M${x - 35} 0V${yTop}M${x} 0V${yTop}M${x + 35} 0V${yTop}`, '#6e675a', 3, { alpha: 0.5 }),
    rect(x - 90, yTop - 50, 180, 50, '#9a9282', { stroke: '#4a443a', lw: 3 }),
    rect(x - 90, 0, 180, 40, '#9a9282', { stroke: '#4a443a', lw: 3 }),
    band(x + 70, 0, 60, yTop, '#000000', 0),
    rect(x + 70, 0, 50, yTop, lin(x + 70, 0, x + 120, 0, 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0)')),
  ];
  const torch = (x, y) => [line(`M${x} ${y + 60}L${x} ${y}`, '#3a2a1a', 10), path(`M${x - 20} ${y}h40l-8 22h-24z`, '#5a4a3a', { stroke: '#2a1a0e', lw: 3 }), ...flame(x, y - 2, 1.4)];
  return scene({
    id: 'castle_throne_room', name: 'Castle throne room', type: 'interior', floorY,
    layers: [
      ...R.layers,
      path(blocks, null, { stroke: '#6b6558', lw: 3, alpha: 0.7 }),
      // stained glass
      path(sArch(gx - 20, gy - 20, gw + 40, gh + 40), '#4a443a'),
      ...gb.map((d, i) => path(d, glass[i])),
      path(sArch(gx, gy, gw, gh), null, { stroke: '#2a2620', lw: 8 }),
      path(range(1, 4, 1).map((i) => sLine(gx + (gw * i) / 5, acy, gx + (gw * i) / 5, gy + gh)).join('') + range(0, 2, 1).map((i) => sLine(gx, acy + ((gy + gh - acy) * i) / 3, gx + gw, acy + ((gy + gh - acy) * i) / 3)).join('') +
        range(1, 5, 1).map((i) => { const a = Math.PI + (i * Math.PI) / 6; return sLine(acx, acy, acx + (gw / 2) * Math.cos(a), acy + (gw / 2) * Math.sin(a)); }).join('') + sCirc(acx, acy, 34), null, { stroke: '#2a2620', lw: 5 }),
      path(sCirc(acx, acy, 30), '#f2c14e', { stroke: '#2a2620', lw: 4 }),
      path(sArch(gx - 20, gy - 20, gw + 40, gh + 40), null, { stroke: '#4a443a', lw: 12 }),
      poly([[gx, gy + gh], [gx + gw, gy + gh], [1300, 1080], [620, 1080]], lin(0, gy + gh, 0, 1080, 'rgba(255,230,160,0.2)', 'rgba(255,230,160,0)')),
      ...banner(560), ...banner(1360),
      ...pillar(170), ...pillar(1750),
      ...torch(380, 300), ...torch(1540, 300),
      // dais
      rect(700, 620, 520, 70, vgrad(620, 690, '#a8a090', '#7a7266'), { stroke: '#4a443a', lw: 3 }),
      rect(760, 570, 400, 54, vgrad(570, 624, '#b8b0a0', '#8a8272'), { stroke: '#4a443a', lw: 3 }),
      // throne
      ...shadow(960, 572, 160, 14, 0.4),
      path('M860 570V330Q860 250 960 210Q1060 250 1060 330V570Z', vgrad(210, 570, '#e0b84a', '#a8822a'), { stroke: '#5a4010', lw: 5 }),
      path('M890 520V350Q890 290 960 262Q1030 290 1030 350V520Z', vgrad(262, 520, '#b8343a', '#7a1f24'), { stroke: '#5a4010', lw: 3 }),
      path(sCirc(960, 232, 16), '#d64545', { stroke: '#5a4010', lw: 3 }),
      rect(840, 470, 240, 54, vgrad(470, 524, '#c8343a', '#8a1f24'), { r: 10, stroke: '#5a4010', lw: 4 }),
      rect(830, 420, 36, 150, '#e0b84a', { r: 8, stroke: '#5a4010', lw: 4 }), rect(1054, 420, 36, 150, '#e0b84a', { r: 8, stroke: '#5a4010', lw: 4 }),
      // carpet runner
      poly([[860, 690], [1060, 690], ...floorQuad(P, 860, 1060, 690, 1080).slice(2)], vgrad(690, 1080, '#8a1f24', '#b8343a')),
      poly([[860, 690], [1060, 690], ...floorQuad(P, 860, 1060, 690, 1080).slice(2)], null, { stroke: '#e0b84a', lw: 6 }),
      ...pool(960, 880, 600, 120, '#ffd890', 0.2),
      vignette(0.5, '#140c06', 0.45),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function spaceship_bridge() {
  const floorY = 800, yTop = 700;
  const R = room({ yTop, sw: 170, ceil: 70, wall: '#28324a', wallTop: '#1c2438', floor: '#2a3346', floorNear: '#394560', floorKind: 'tiles', tile: { w: 160, rows: 6, color: '#4a5878', alpha: 0.8 }, base: '#161c2a', baseH: 16, sideShade: -18, ceilColor: '#161c2a' });
  // viewport: octagon
  const vx0 = 330, vx1 = 1590, vy0 = 110, vy1 = 500, c = 70;
  const oct = [[vx0 + c, vy0], [vx1 - c, vy0], [vx1, vy0 + c], [vx1, vy1 - c], [vx1 - c, vy1], [vx0 + c, vy1], [vx0, vy1 - c], [vx0, vy0 + c]];
  const octIn = oct.map(([x, y]) => [x + (x < 960 ? 14 : -14), y + (y < 300 ? 14 : -14)]);
  const cons = (x0, x1) => [
    poly([[x0, 700], [x0 + 20, 590], [x1 - 20, 590], [x1, 700]], vgrad(590, 700, '#3a4660', '#222a3c'), { stroke: '#0e121c', lw: 4 }),
    poly([[x0 + 20, 590], [x1 - 20, 590], [x1 - 40, 560], [x0 + 40, 560]], '#4a5878', { stroke: '#0e121c', lw: 3 }),
  ];
  let btn = '', btn2 = '', scr = '';
  for (let x = 420; x < 1500; x += 70) { btn += sRR(x, 568, 30, 14, 4); if ((x / 70) % 3 < 1) btn2 += sRR(x + 36, 568, 18, 14, 4); }
  for (const x of [520, 860, 1200]) scr += sRR(x, 610, 200, 60, 6);
  return scene({
    id: 'spaceship_bridge', name: 'Spaceship bridge', type: 'interior', floorY,
    layers: [
      ...R.layers,
      // wall panel seams
      path(range(250, 1700, 180).map((x) => sLine(x, 70, x, 690)).join('') + sLine(170, 540, 1750, 540), null, { stroke: '#1a2132', lw: 4 }),
      // viewport
      poly(oct, '#10141f'),
      poly(octIn, vgrad(vy0, vy1, '#060818', '#141a3a')),
      ell(1250, 260, 420, 220, rad(1250, 260, 420, 'rgba(160,80,200,0.35)', 'rgba(60,40,140,0.15)', 'rgba(0,0,0,0)')),
      path(sStars(8, 120, { x0: vx0 + 20, x1: vx1 - 20, y0: vy0 + 20, y1: vy1 - 20, rMin: 1, rMax: 3 }), '#ffffff', { alpha: 0.9 }),
      path(sSparkle(560, 190, 12) + sSparkle(1420, 420, 10) + sSparkle(900, 160, 8), '#cfe0ff'),
      // planet with ring
      ell(700, 400, 120, 120, lin(600, 300, 800, 500, '#f7b267', '#e0605a', '#7a2f5a')),
      path('M700 280a120 120 0 0 1 0 240a90 120 0 0 0 0 -240Z', 'rgba(20,10,40,0.45)'),
      ell(700, 410, 220, 40, null, { stroke: '#f4d9a8', lw: 10, alpha: 0.75, rot: -12 }),
      ell(1350, 210, 30, 30, lin(1330, 190, 1370, 230, '#cfe0ff', '#6a80c0')),
      poly(octIn, lin(vx0, vy0, vx1, vy1, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.05)')),
      poly(oct, null, { stroke: '#5a6a8a', lw: 10 }),
      line(`M960 ${vy0}V${vy1}`, '#3a4660', 12),
      // ceiling light strips
      ...range(0, 2, 1).map((i) => rect(420 + i * 400, 74, 280, 12, '#7af0ff', { r: 6, alpha: 0.9 })),
      ...range(0, 2, 1).map((i) => glow(560 + i * 400, 90, 200, '#7af0ff', 0.3)),
      // consoles under the viewport
      ...cons(380, 1540),
      path(btn, '#7af0ff'), path(btn2, '#ff5aa0'),
      path(scr, vgrad(610, 670, '#0c3a4a', '#08202a'), { stroke: '#7af0ff', lw: 2 }),
      line('M540 650l30 -20l30 10l30 -26l30 14l30 -8M880 640h150M880 655h100M1220 650q40 -40 80 0t80 0', '#7af0ff', 3, { alpha: 0.9 }),
      // side doors
      poly([[0, 230], [110, 250], [110, 690], [0, 740]], '#1a2132', { stroke: '#7af0ff', lw: 3, alpha: 0.9 }),
      poly([[W, 230], [W - 110, 250], [W - 110, 690], [W, 740]], '#1a2132', { stroke: '#7af0ff', lw: 3, alpha: 0.9 }),
      line('M55 245V715M1865 245V715', '#0c0f18', 6),
      // floor glow strips
      line(range(0, 1, 1).map(() => '').join('') + `M${R.P.px(700, 700)} 700L${R.P.px(700, 1090)} 1090M${R.P.px(1220, 700)} 700L${R.P.px(1220, 1090)} 1090`, '#7af0ff', 4, { alpha: 0.6 }),
      ...pool(960, 860, 800, 130, '#7af0ff', 0.12),
      vignette(0.5, '#05070e', 0.45),
    ],
    front: [
      // captain's console edges in the near corners
      poly([[0, 940], [260, 980], [300, 1080], [0, 1080]], vgrad(940, 1080, '#3a4660', '#1a2132'), { stroke: '#0e121c', lw: 5 }),
      poly([[W, 940], [W - 260, 980], [W - 300, 1080], [W, 1080]], vgrad(940, 1080, '#3a4660', '#1a2132'), { stroke: '#0e121c', lw: 5 }),
      path(sRR(60, 990, 40, 16, 4) + sRR(120, 996, 40, 16, 4) + sRR(W - 100, 990, 40, 16, 4) + sRR(W - 160, 996, 40, 16, 4), '#7af0ff'),
      path(sRR(180, 1004, 40, 16, 4) + sRR(W - 220, 1004, 40, 16, 4), '#ff5aa0'),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
export function theater_stage() {
  const floorY = 790, yTop = 660;
  const R = room({ yTop, sw: 0, wall: '#5a1520', floor: '#a8743f', floorNear: '#c08850', plankW: 80, plankRows: 0, base: '#2a0a10', baseH: 0, hY: 300 });
  // back curtain folds
  let folds = '';
  for (let x = 0; x < W; x += 90) folds += `M${x} 0Q${x + 20} ${yTop / 2} ${x + 6} ${yTop}H${x + 46}Q${x + 60} ${yTop / 2} ${x + 44} 0Z`;
  const lip = 1010;
  // side drapes (front)
  const drape = (dir) => {
    const x = dir > 0 ? 0 : W;
    const w = 230;
    const d = `M${x} 0H${x + dir * w}Q${x + dir * (w - 40)} 380 ${x + dir * (w - 90)} 560Q${x + dir * (w - 120)} 800 ${x + dir * (w - 60)} 1080H${x}Z`;
    let f = '';
    for (const k of [0.25, 0.5, 0.75]) f += `M${x + dir * w * k} 10Q${x + dir * w * k * 0.8} 500 ${x + dir * w * k * 0.9} 1070`;
    return [
      path(d, lin(x, 0, x + dir * w, 0, '#6a1420', '#b8283a', '#8a1a2a', '#c8384a'), { stroke: '#3a0810', lw: 4 }),
      line(f, '#4a0c16', 6, { alpha: 0.6 }),
      path(`M${x + dir * (w - 100)} 540q${dir * 30} -20 ${dir * 50} 10q${dir * -10} 30 ${dir * -50} 20z`, '#e0b84a', { stroke: '#7a5a1a', lw: 3 }),
      line(`M${x + dir * (w - 80)} 560l${dir * 6} 80`, '#e0b84a', 8),
    ];
  };
  let valance = 'M0 0H1920V90';
  for (let i = 0; i < 8; i++) { const x1 = W - i * 240, x2 = x1 - 240; valance += `Q${(x1 + x2) / 2} 190 ${x2} 90`; }
  valance += 'Z';
  const r = rng(3);
  let heads = '';
  for (let x = -20; x < W + 40; x += 70 + r() * 30) heads += sCirc(x, 1060 + r() * 10, 34 + r() * 8) + sRR(x - 50, 1080, 100, 40, 20);
  return scene({
    id: 'theater_stage', name: 'Theater stage', type: 'interior', floorY,
    layers: [
      ...R.layers,
      rect(0, 0, W, yTop, vgrad(0, yTop, '#3a0a14', '#6a1a28')),
      path(folds, '#7a1e2e', { alpha: 0.8 }),
      rect(0, 0, W, yTop, rad(960, 380, 700, 'rgba(255,220,160,0.32)', 'rgba(255,220,160,0)')),
      rect(0, yTop - 10, W, 20, '#2a0a10'),
      // stage floor boards (planks run left-right on a stage)
      path(range(0, 7, 1).map((i) => { const y = yTop + Math.pow(i / 7, 1.4) * (lip - yTop); return sLine(0, y, W, y); }).join(''), null, { stroke: '#7a4a24', lw: 3, alpha: 0.7 }),
      ...pool(560, 860, 330, 90, '#fff3c8', 0.4),
      ...pool(1360, 860, 330, 90, '#fff3c8', 0.4),
      poly([[470, -10], [650, -10], [890, 860], [230, 860]], lin(0, 0, 0, 860, 'rgba(255,243,200,0.14)', 'rgba(255,243,200,0.04)')),
      poly([[1270, -10], [1450, -10], [1690, 860], [1030, 860]], lin(0, 0, 0, 860, 'rgba(255,243,200,0.14)', 'rgba(255,243,200,0.04)')),
      // stage lip + footlights + pit
      rect(0, lip, W, 22, vgrad(lip, lip + 22, '#7a4a24', '#4a2a10'), { stroke: '#2a1408', lw: 3 }),
      rect(0, lip + 22, W, H - lip - 22, '#120608'),
      vignette(0.4, '#0a0204', 0.5),
    ],
    front: [
      path(heads, '#0a0406'),
      path(range(140, W - 140, 160).map((x) => sRR(x - 26, lip - 16, 52, 16, 6)).join(''), '#2a1a10'),
      rect(0, lip - 70, W, 70, vgrad(lip - 70, lip, 'rgba(255,230,150,0)', 'rgba(255,230,150,0.35)')),
      ...drape(1), ...drape(-1),
      path(valance, lin(0, 0, 0, 190, '#b8283a', '#7a1420'), { stroke: '#3a0810', lw: 4 }),
      path(range(0, 7, 1).map((i) => { const x = W - i * 240 - 120; return sCirc(x, 150, 10); }).join(''), '#e0b84a'),
      line('M0 30H1920', '#e0b84a', 8),
    ],
  });
}
