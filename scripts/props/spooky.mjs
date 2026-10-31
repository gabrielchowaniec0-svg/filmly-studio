import { rect, ell, poly, path, solid, flat, line, glow, dk, lt, prop, OUT } from './lib.mjs';

const M = '$main';
const GOLD = '#d9a93a';
const flame = (x, y, s = 1) => [
  glow(x, y - 8 * s, 40 * s, '#ffd27a', 0.5),
  solid(path(`M ${x} ${y - 22 * s} Q ${x + 9 * s} ${y - 8 * s} ${x + 5 * s} ${y} Q ${x} ${y + 4 * s} ${x - 5 * s} ${y} Q ${x - 9 * s} ${y - 8 * s} ${x} ${y - 22 * s} Z`), '#ffb030', { k: 2, lw: 2.2, stroke: '#a8501a' }),
  flat(ell(x, y - 3 * s, 2.6 * s, 5 * s), '#fff4c0'),
];

export default [
  prop('candelabra', 'Candelabra', 'spooky', [130, 170], [
    solid(ell(0, -6, 34, 8), M, { k: 3 }),
    solid(path('M -8 -10 L 8 -10 L 5 -80 L -5 -80 Z'), M, { k: 2 }),
    solid(ell(0, -48, 9, 7), M, { k: 2 }),
    line('M 0 -82 Q -50 -82 -50 -112 M 0 -82 Q 50 -82 50 -112', OUT, 9),
    line('M 0 -82 Q -50 -82 -50 -112 M 0 -82 Q 50 -82 50 -112', M, 5),
    ...[-50, 0, 50].flatMap((x) => [
      solid(ell(x, -112, 12, 4), M, { k: 1, lw: 2.6 }),
      solid(rect(x - 6, -146, 12, 34, 2), '#f4ead2', { k: 2, lw: 2.6 }),
      flame(x, -150),
    ]),
  ], { palette: { main: GOLD }, grip: [0, -40], shadow: 32 }),

  prop('candle', 'Candle', 'spooky', [40, 70], [
    solid(ell(0, -6, 18, 6), '#9a9aa6', { k: 2 }),
    line('M 18 -8 Q 28 -12 24 -20', '#9a9aa6', 4),
    solid(rect(-7, -40, 14, 34, 2), '#f4ead2', { k: 2 }),
    flat(path('M -7 -40 Q -2 -36 -4 -30 Q -6 -36 -7 -36 Z'), '#e6d8b8'),
    flame(0, -44),
  ], { grip: [0, -16], shadow: 14 }),

  prop('lantern', 'Lantern', 'spooky', [60, 110], [
    line('M -14 -90 Q 0 -112 14 -90', OUT, 6),
    glow(0, -46, 70, '#ffd27a', 0.5),
    solid(rect(-24, -16, 48, 14, 3), M, { k: 2 }),
    solid(rect(-20, -76, 40, 60, 4), '#fff1b8', { k: 3, outline: false }),
    flame(0, -38, 1.2),
    line('M -20 -76 L -20 -16 M 20 -76 L 20 -16 M 0 -76 L 0 -64', M, 5),
    line(rect(-20, -76, 40, 60, 4), OUT, 3),
    solid(path('M -26 -76 L 26 -76 L 14 -92 L -14 -92 Z'), M, { k: 2 }),
  ], { palette: { main: '#3a3a44' }, grip: [0, -104], shadow: 22 }),

  prop('portrait', 'Old portrait', 'spooky', [180, 230], [
    solid(rect(-90, -230, 180, 230, 10), GOLD, { k: 6, hi: [-70, -214, 14, 6] }),
    line(rect(-78, -218, 156, 206, 6), dk(GOLD, 30), 2.4),
    solid(rect(-70, -210, 140, 190, 2), '#3d2e3e', { k: 4 }),
    flat(ell(0, -70, 70, 60), '#4a3a4c'),
    solid(path('M -54 -20 Q -50 -80 0 -86 Q 50 -80 54 -20 Z'), M, { k: 5 }),
    solid(path('M -12 -86 L 0 -60 L 12 -86 Z'), '#f4ead2', { k: 1, lw: 2 }),
    solid(ell(0, -126, 30, 36), '#d8b89a', { k: 5 }),
    solid(path('M -32 -134 Q -30 -170 0 -168 Q 30 -170 32 -134 Q 20 -150 0 -150 Q -20 -150 -32 -134 Z'), '#2a1d1d', { k: 2 }),
    line('M -16 -128 L -6 -124 M 6 -124 L 16 -128', OUT, 3),
    flat(ell(-11, -120, 3.4, 3.4), '#e8d040'),
    flat(ell(11, -120, 3.4, 3.4), '#e8d040'),
    line('M -10 -104 Q 0 -108 10 -104', OUT, 2.6),
    line('M -16 -110 Q -8 -106 -2 -110 Q 4 -106 14 -110', '#2a1d1d', 3),
  ], { palette: { main: '#5a2a3a' }, shadow: false }),

  prop('armor', 'Suit of armor', 'spooky', [170, 420], [
    solid(rect(-60, -16, 120, 16, 4), '#6a4a32'),
    solid(rect(-34, -150, 26, 136, 8), M, { k: 5 }),
    solid(rect(8, -150, 26, 136, 8), M, { k: 5 }),
    solid(ell(-21, -84, 15, 12), lt(M, 10), { k: 3 }),
    solid(ell(21, -84, 15, 12), lt(M, 10), { k: 3 }),
    solid(path('M -40 -22 L -4 -22 L -2 -6 L -44 -6 Z'), dk(M, 8), { k: 2 }),
    solid(path('M 4 -22 L 40 -22 L 44 -6 L 2 -6 Z'), dk(M, 8), { k: 2 }),
    solid(rect(-70, -290, 24, 120, 10), M, { k: 4 }),
    solid(rect(46, -290, 24, 120, 10), M, { k: 4 }),
    solid(ell(-58, -164, 14, 14), dk(M, 6), { k: 3 }),
    solid(ell(58, -164, 14, 14), dk(M, 6), { k: 3 }),
    solid(path('M -48 -296 L 48 -296 L 40 -186 Q 0 -170 -40 -186 Z'), M, { k: 10, hi: [-20, -270, 10, 24] }),
    line('M 0 -290 L 0 -182', dk(M, 30), 2.4),
    solid(path('M -42 -186 L 42 -186 L 38 -150 L -38 -150 Z'), dk(M, 8), { k: 3 }),
    solid(path('M -82 -300 Q -76 -324 -40 -322 L -36 -276 Q -64 -270 -82 -282 Z'), lt(M, 6), { k: 4 }),
    solid(path('M 82 -300 Q 76 -324 40 -322 L 36 -276 Q 64 -270 82 -282 Z'), lt(M, 6), { k: 4 }),
    solid(path('M -32 -312 L -34 -370 Q 0 -404 34 -370 L 32 -312 Q 0 -300 -32 -312 Z'), M, { k: 8, hi: [-16, -380, 6, 12] }),
    flat(rect(-26, -356, 52, 6, 2), '#1a1418'),
    flat(rect(-26, -342, 52, 4, 2), '#1a1418'),
    solid(path('M 0 -396 Q 26 -430 52 -414 Q 30 -410 10 -390 Z'), '#c0393a', { k: 3 }),
  ], { palette: { main: '#a7afba' }, shadow: 70 }),

  prop('cobweb', 'Cobweb', 'spooky', [160, 160], (() => {
    const out = [];
    const cx = 0, cy = -80, n = 8;
    const spokes = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      spokes.push([Math.cos(a), Math.sin(a)]);
      out.push(line(`M ${cx} ${cy} L ${(cx + Math.cos(a) * 80).toFixed(1)} ${(cy + Math.sin(a) * 80).toFixed(1)}`, '#dcdce8', 2, { alpha: 0.9 }));
    }
    for (const r of [18, 34, 50, 66]) {
      let d = '';
      spokes.forEach(([x, y], i) => {
        const [x2, y2] = spokes[(i + 1) % n];
        const p1 = [cx + x * r, cy + y * r], p2 = [cx + x2 * r, cy + y2 * r];
        const m = [cx + (x + x2) * r * 0.38, cy + (y + y2) * r * 0.38];
        d += `${i ? '' : `M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} `}Q ${m[0].toFixed(1)} ${m[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
      });
      out.push(line(d, '#dcdce8', 1.8, { alpha: 0.85 }));
    }
    out.push(line('M 0 -160 L 0 -96', '#e8e8f0', 1.4, { alpha: 0.7 }));
    out.push(solid(ell(18, -70, 6, 7), '#2a1d1d', { k: 1, lw: 1.2 }));
    out.push(line('M 12 -74 L 4 -80 M 12 -68 L 4 -66 M 24 -74 L 32 -80 M 24 -68 L 32 -66', '#2a1d1d', 1.6));
    return out;
  })(), { shadow: false }),

  prop('magnifier', 'Magnifying glass', 'spooky', [70, 140], [
    solid(rect(-6, -76, 12, 74, 5), '#7a4a2a', { k: 2 }),
    solid(rect(-8, -84, 16, 12, 3), GOLD, { k: 2 }),
    { ...ell(0, -112, 28, 28), fill: '#bfe8ff', stroke: null, alpha: 0.45 },
    flat(path('M -16 -124 Q -10 -134 2 -134 L -2 -126 Q -10 -126 -12 -118 Z'), '#ffffff', { alpha: 0.85 }),
    line(ell(0, -112, 28, 28), OUT, 9),
    line(ell(0, -112, 28, 28), GOLD, 5),
  ], { grip: [0, -30], hold: 'rotate', holdAngle: -70, shadow: 20 }),

  prop('map', 'Treasure map', 'spooky', [96, 74], [
    solid(path('M -40 -66 Q -20 -72 0 -66 Q 20 -60 40 -66 L 40 -8 Q 20 -2 0 -8 Q -20 -14 -40 -8 Z'), M, { k: 3 }),
    solid(ell(-42, -37, 7, 31), dk(M, 8), { k: 2 }),
    solid(ell(42, -37, 7, 31), dk(M, 8), { k: 2 }),
    line('M -28 -24 Q -18 -48 -2 -40 Q 12 -32 14 -50', '#a0522d', 2.4, { dash: [6, 6] }),
    line('M 18 -56 L 28 -46 M 28 -56 L 18 -46', '#c0392b', 3.4),
    line('M -30 -56 Q -26 -60 -22 -56 Q -18 -52 -14 -56', '#5a7bb0', 2),
  ], { palette: { main: '#e9d3a0' }, grip: [-42, -37], shadow: 34 }),

  prop('treasure_chest', 'Treasure chest', 'spooky', [160, 130], [
    solid(rect(-76, -76, 152, 76, 6), M, { k: 8 }),
    solid(path('M -76 -76 L -76 -100 Q -76 -132 0 -132 Q 76 -132 76 -100 L 76 -76 Z'), lt(M, 6), { k: 8, hi: [-40, -116, 18, 5] }),
    solid(rect(-58, -132, 16, 132, 2), GOLD, { k: 2, lw: 2.6 }),
    solid(rect(42, -132, 16, 132, 2), GOLD, { k: 2, lw: 2.6 }),
    solid(rect(-80, -82, 160, 12, 2), GOLD, { k: 2, lw: 2.6 }),
    solid(rect(-13, -90, 26, 30, 5), GOLD, { k: 3 }),
    flat(path('M 0 -82 L 4 -72 L -4 -72 Z'), '#2a1d1d'),
  ], { palette: { main: '#8a5a36' }, shadow: 80 }),

  prop('ghost', 'Sheet ghost', 'spooky', [140, 200], [
    solid(path('M -60 -10 Q -66 -120 -50 -160 Q -30 -200 0 -200 Q 30 -200 50 -160 Q 66 -120 60 -10 Q 45 -24 30 -6 Q 15 -24 0 -6 Q -15 -24 -30 -6 Q -45 -24 -60 -10 Z'), M, { k: 14, hi: [-24, -172, 12, 16, -20], hiAlpha: 0.5 }),
    flat(ell(-20, -142, 9, 14), '#2a1d1d'),
    flat(ell(20, -142, 9, 14), '#2a1d1d'),
    flat(ell(0, -104, 12, 16), '#2a1d1d'),
    flat(ell(-23, -147, 3, 4), '#ffffff'),
    flat(ell(17, -147, 3, 4), '#ffffff'),
  ], { palette: { main: '#f4f6fb' }, style: { stroke: '#4a4a66', lw: 3.4 }, shadow: 50 }),
];
