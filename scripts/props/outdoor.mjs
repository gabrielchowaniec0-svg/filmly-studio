import { rect, ell, poly, path, solid, flat, line, glow, blob, dk, lt, prop, OUT } from './lib.mjs';

const M = '$main';
const BARK = '#8a5a36';

export default [
  prop('tree', 'Tree', 'outdoor', [420, 640], [
    solid(path('M -34 0 Q -26 -120 -30 -300 L 30 -300 Q 26 -120 34 0 Q 50 4 60 0 L -60 0 Q -50 4 -34 0 Z'), BARK, { k: 10 }),
    line('M -10 -40 Q -4 -100 -12 -160 M 12 -120 Q 18 -180 10 -240', dk(BARK, 25), 3),
    solid(path('M 10 -260 Q 60 -300 96 -330 L 104 -320 Q 70 -290 28 -246 Z'), BARK, { k: 3 }),
    solid(path(blob(-110, -380, 110, 90, 9, 22, 1)), M, { k: 18 }),
    solid(path(blob(110, -390, 110, 92, 9, 22, 2)), M, { k: 18 }),
    solid(path(blob(0, -500, 150, 120, 11, 26, 3)), M, { k: 20, hi: [-60, -560, 40, 22, -20], hiAlpha: 0.22 }),
    solid(path(blob(0, -360, 120, 70, 9, 20, 4)), dk(M, 6), { k: 14 }),
  ], { palette: { main: '#5cae5f' }, shadow: 170 }),

  prop('pine_tree', 'Pine tree', 'outdoor', [300, 560], [
    solid(rect(-20, -90, 40, 90, 4), BARK),
    solid(path('M -150 -90 L 150 -90 L 60 -210 L 110 -210 L 30 -330 L 76 -330 L 0 -556 L -76 -330 L -30 -330 L -110 -210 L -60 -210 Z'), M, { k: 18, hi: [-30, -420, 14, 60, 20], hiAlpha: 0.2 }),
    line('M -110 -210 Q 0 -190 110 -210 M -76 -330 Q 0 -312 76 -330', dk(M, 28), 3),
  ], { palette: { main: '#2f7d4f' }, shadow: 120 }),

  prop('bush', 'Bush', 'outdoor', [230, 130], [
    solid(path(blob(-60, -52, 64, 50, 7, 14, 5)), M, { k: 10 }),
    solid(path(blob(62, -50, 62, 48, 7, 14, 6)), M, { k: 10 }),
    solid(path(blob(0, -76, 78, 56, 9, 16, 7)), M, { k: 12, hi: [-26, -102, 22, 10, -15], hiAlpha: 0.22 }),
    flat(rect(-110, -12, 220, 12), dk(M, 30)),
    solid(ell(-30, -80, 6, 6), '#f06292', { k: 1, lw: 2 }),
    solid(ell(40, -64, 6, 6), '#f06292', { k: 1, lw: 2 }),
    solid(ell(8, -104, 6, 6), '#f06292', { k: 1, lw: 2 }),
  ], { palette: { main: '#4f9a55' }, shadow: 110 }),

  prop('bench', 'Park bench', 'outdoor', [300, 170], [
    line('M -120 -86 L -126 0 M 120 -86 L 126 0', '#3a3a44', 9),
    line('M -110 -86 L -100 -168 M 110 -86 L 100 -168', '#3a3a44', 8),
    solid(rect(-140, -170, 280, 22, 6), M, { k: 4 }),
    solid(rect(-140, -140, 280, 22, 6), M, { k: 4 }),
    solid(poly([[-150, -88], [150, -88], [138, -104], [-138, -104]]), lt(M, 12), { k: 3 }),
    solid(rect(-152, -90, 304, 18, 5), M, { k: 4 }),
    line('M -130 -40 Q -126 -70 -110 -86 M 130 -40 Q 126 -70 110 -86', '#3a3a44', 6),
  ], { palette: { main: '#a86b3c' }, shadow: 140 }),

  prop('streetlamp', 'Street lamp', 'outdoor', [150, 660], [
    glow(32, -560, 190, '#ffe7a0', 0.4),
    solid(path('M -24 0 L 24 0 L 14 -40 L -14 -40 Z'), M, { k: 4 }),
    solid(rect(-8, -600, 16, 562, 5), M, { k: 3 }),
    line('M 0 -600 Q 0 -640 40 -640 Q 70 -640 70 -610', M, 10),
    solid(path('M 46 -610 L 94 -610 L 84 -580 L 56 -580 Z'), M, { k: 2 }),
    solid(path('M 56 -580 L 84 -580 Q 82 -560 70 -556 Q 58 -560 56 -580 Z'), '#fff1b8', { k: 2, lw: 2.6 }),
  ], { palette: { main: '#3a4150' }, shadow: 40 }),

  prop('fence', 'Picket fence', 'outdoor', [420, 160], (() => {
    const out = [solid(rect(-210, -120, 420, 16, 3), dk(M, 6), { k: 3 }), solid(rect(-210, -54, 420, 16, 3), dk(M, 6), { k: 3 })];
    for (let x = -196; x <= 196; x += 49) out.push(solid(path(`M ${x - 15} 0 L ${x - 15} -136 L ${x} -158 L ${x + 15} -136 L ${x + 15} 0 Z`), M, { k: 4 }));
    return out;
  })(), { palette: { main: '#f4f1ea' }, shadow: 200 }),

  prop('car', 'Car', 'outdoor', [520, 240], [
    solid(path('M -250 -50 Q -256 -110 -210 -118 L -150 -124 Q -120 -200 -40 -206 L 70 -206 Q 130 -200 168 -126 L 226 -116 Q 262 -104 258 -50 Q 258 -30 240 -30 L -236 -30 Q -252 -30 -250 -50 Z'), M, { k: 14, hi: [-80, -190, 60, 8, -4] }),
    solid(path('M -130 -128 Q -104 -186 -44 -190 L -6 -190 L -6 -128 Z'), '#bfe3f5', { k: 4 }),
    solid(path('M 10 -128 L 10 -190 L 64 -190 Q 116 -184 146 -128 Z'), '#bfe3f5', { k: 4 }),
    flat(path('M -100 -134 L -70 -180 L -56 -180 L -86 -134 Z'), '#ffffff', { alpha: 0.5 }),
    line('M 2 -126 L 2 -40', dk(M, 30), 3),
    line('M -142 -60 L 120 -60', dk(M, 30), 2.6),
    solid(rect(-24, -112, 22, 7, 3), dk(M, 30), { k: 1, lw: 2 }),
    solid(rect(30, -112, 22, 7, 3), dk(M, 30), { k: 1, lw: 2 }),
    solid(ell(244, -88, 12, 10), '#fff1b8', { k: 2, lw: 2.6 }),
    solid(rect(-258, -96, 16, 20, 4), '#e5484d', { k: 2, lw: 2.6 }),
    solid(rect(-262, -50, 40, 14, 6), '#9aa3ad', { k: 2 }),
    solid(rect(226, -50, 40, 14, 6), '#9aa3ad', { k: 2 }),
    ...[-150, 150].flatMap((x) => [
      flat(ell(x, -40, 58, 52), dk(M, 45)),
      solid(ell(x, -38, 44, 44), '#2f3440', { k: 6 }),
      solid(ell(x, -38, 22, 22), '#c9ced6', { k: 4 }),
      flat(ell(x, -38, 7, 7), '#6a6f7a'),
    ]),
  ], { palette: { main: '#3a7bd5' }, shadow: 250 }),

  prop('bicycle', 'Bicycle', 'outdoor', [270, 170], [
    ...[-82, 82].flatMap((x) => [
      line(ell(x, -54, 52, 52), OUT, 10),
      line(ell(x, -54, 52, 52), '#3a3a44', 6),
      line(`M ${x - 46} -54 L ${x + 46} -54 M ${x} -100 L ${x} -8 M ${x - 32} -86 L ${x + 32} -22 M ${x + 32} -86 L ${x - 32} -22`, '#b8bec8', 1.6),
      solid(ell(x, -54, 6, 6), '#9aa3ad', { k: 1, lw: 2 }),
    ]),
    line('M -82 -54 L -10 -54 L 54 -124 L -34 -124 Z M -10 -54 L -46 -136 M 54 -124 L 82 -54', OUT, 10),
    line('M -82 -54 L -10 -54 L 54 -124 L -34 -124 Z M -10 -54 L -46 -136 M 54 -124 L 82 -54', M, 6),
    line('M 54 -124 L 46 -150 L 72 -156', OUT, 8),
    line('M 54 -124 L 46 -150 L 72 -156', '#3a3a44', 4),
    solid(path('M -70 -142 Q -46 -150 -26 -140 Q -40 -132 -66 -134 Z'), '#3a3a44', { k: 2, lw: 2.6 }),
    solid(ell(-10, -54, 10, 10), '#9aa3ad', { k: 2, lw: 2.6 }),
  ], { palette: { main: '#e5484d' }, shadow: 130 }),

  prop('mailbox', 'Mailbox', 'outdoor', [110, 180], [
    solid(rect(-9, -110, 18, 110, 3), '#8a5a36'),
    solid(path('M -50 -100 L -50 -150 Q -50 -180 -20 -180 L 20 -180 Q 50 -180 50 -150 L 50 -100 Z'), M, { k: 8, hi: [-30, -164, 8, 6] }),
    line('M -50 -150 Q -50 -180 -20 -180', OUT, 3.4),
    solid(path('M -50 -150 Q -50 -176 -26 -178 L -26 -100 L -50 -100 Z'), dk(M, 10), { k: 3 }),
    solid(rect(42, -170, 8, 50, 2), '#e5484d', { k: 2, lw: 2.6 }),
    solid(rect(42, -170, 26, 16, 2), '#e5484d', { k: 2, lw: 2.6 }),
  ], { palette: { main: '#5a7bb0' }, shadow: 50 }),

  prop('rock', 'Rock', 'outdoor', [130, 80], [
    solid(path('M -62 0 Q -70 -44 -36 -66 Q -6 -84 26 -72 Q 62 -62 64 -24 Q 66 -4 58 0 Z'), M, { k: 14, hi: [-22, -58, 16, 7, -14], hiAlpha: 0.3 }),
    line('M -10 -40 Q 6 -34 12 -20', dk(M, 30), 2.6),
  ], { palette: { main: '#9a9aa6' }, shadow: 64 }),

  prop('campfire', 'Campfire', 'outdoor', [170, 170], [
    glow(0, -60, 170, '#ffb347', 0.45, 0.8),
    ...[-56, -20, 20, 56].map((x, i) => solid(ell(x, -10, 18, 12), i % 2 ? '#8a8a96' : '#a0a0aa', { k: 3, lw: 2.6 })),
    solid(rect(-74, -30, 148, 22, 10, ), BARK, { k: 4 }),
    solid(path('M -70 -6 L 60 -46 L 68 -30 L -62 10 Z'), dk(BARK, 8), { k: 3 }),
    solid(path('M -46 -26 Q -60 -80 -24 -112 Q -30 -76 -6 -66 Q -4 -120 22 -150 Q 18 -104 40 -86 Q 50 -110 44 -124 Q 76 -84 46 -26 Z'), '#ff7a2e', { k: 6, stroke: '#a83a12' }),
    solid(path('M -26 -26 Q -34 -60 -12 -80 Q -6 -56 6 -52 Q 6 -90 22 -104 Q 22 -72 36 -62 Q 46 -40 28 -26 Z'), '#ffc23a', { k: 4, outline: false }),
    flat(path('M -6 -26 Q -12 -46 2 -60 Q 8 -46 14 -40 Q 18 -32 12 -26 Z'), '#fff1b8'),
  ], { shadow: 70 }),

  prop('hydrant', 'Fire hydrant', 'outdoor', [80, 110], [
    solid(rect(-30, -14, 60, 14, 3), M, { k: 3 }),
    solid(rect(-22, -90, 44, 78, 6), M, { hi: [-12, -76, 4, 12] }),
    solid(path('M -26 -88 Q -26 -114 0 -114 Q 26 -114 26 -88 Z'), M, { k: 4 }),
    solid(rect(-6, -122, 12, 10, 2), dk(M, 10), { k: 1 }),
    solid(rect(-38, -66, 18, 18, 4), dk(M, 6), { k: 2 }),
    solid(rect(20, -66, 18, 18, 4), dk(M, 6), { k: 2 }),
    solid(ell(0, -56, 9, 9), '#e8c66a', { k: 2, lw: 2.6 }),
  ], { palette: { main: '#e0403a' }, shadow: 36 }),
];
