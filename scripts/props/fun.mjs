import { rect, ell, poly, path, solid, flat, line, glow, dk, lt, prop, OUT } from './lib.mjs';

const M = '$main';
const GOLD = '#f2c14e';

export default [
  prop('pizza', 'Pizza', 'fun', [110, 40], [
    solid(path('M -54 -10 L 54 -10 L 50 -2 L -50 -2 Z'), '#c8a06a', { k: 2 }),
    solid(ell(0, -16, 50, 13), '#e9a64a', { k: 3 }),
    flat(ell(0, -17, 42, 10), '#e5533b'),
    flat(ell(0, -18, 38, 8.5), '#f6cf5a'),
    ...[[-22, -18], [4, -22], [24, -15], [-6, -13], [14, -20]].map(([x, y]) => solid(ell(x, y, 6, 3), '#c0392b', { k: 1, lw: 1.8 })),
    ...[[-12, -21], [30, -19]].map(([x, y]) => flat(ell(x, y, 3, 1.6), '#3a8a3a')),
  ], { grip: [0, -4], handPose: 'open', shadow: 40 }),

  prop('pizza_slice', 'Pizza slice', 'fun', [50, 70], [
    solid(path('M -20 -66 Q 0 -74 20 -66 L 2 0 Q 0 4 -2 0 Z'), '#f6cf5a', { k: 3 }),
    solid(path('M -22 -64 Q 0 -76 22 -64 L 20 -58 Q 0 -68 -20 -58 Z'), '#d9913a', { k: 2 }),
    solid(ell(-4, -46, 5, 5), '#c0392b', { k: 1, lw: 2 }),
    solid(ell(6, -30, 4.5, 4.5), '#c0392b', { k: 1, lw: 2 }),
    flat(path('M -6 -24 Q -8 -14 -4 -10 Q -2 -16 -2 -22 Z'), '#f6cf5a'),
  ], { grip: [0, -54], shadow: 12 }),

  prop('cake', 'Birthday cake', 'fun', [110, 130], [
    solid(ell(0, -6, 52, 9), '#e9eef2', { k: 2 }),
    solid(rect(-44, -52, 88, 44, 8), M, { k: 6 }),
    solid(rect(-32, -86, 64, 36, 7), lt(M, 10), { k: 5 }),
    solid(path('M -46 -52 L 46 -52 L 46 -40 Q 38 -32 30 -42 Q 22 -32 14 -42 Q 6 -32 -2 -42 Q -10 -32 -18 -42 Q -26 -32 -34 -42 Q -42 -32 -46 -40 Z'), '#fff6f0', { k: 2, lw: 2.6 }),
    solid(path('M -34 -86 L 34 -86 L 34 -76 Q 26 -68 18 -78 Q 10 -68 2 -78 Q -6 -68 -14 -78 Q -22 -68 -34 -76 Z'), '#fff6f0', { k: 2, lw: 2.6 }),
    ...[-18, 0, 18].flatMap((x, i) => [
      solid(rect(x - 3.5, -108, 7, 22, 2), ['#5aa3e0', GOLD, '#5ab06a'][i], { k: 1, lw: 2.2 }),
      glow(x, -116, 18, '#ffd27a', 0.5),
      solid(path(`M ${x} -122 Q ${x + 5} -114 ${x} -109 Q ${x - 5} -114 ${x} -122 Z`), '#ffb030', { k: 1, lw: 1.8, stroke: '#a8501a' }),
    ]),
    ...[[-30, -24], [-6, -20], [20, -26], [34, -16]].map(([x, y], i) => flat(ell(x, y, 3, 3), ['#ffffff', GOLD, '#5aa3e0', '#ffffff'][i])),
  ], { palette: { main: '#f48fb1' }, grip: [0, -2], handPose: 'open', shadow: 46 }),

  prop('trophy', 'Trophy', 'fun', [96, 130], [
    solid(rect(-34, -20, 68, 20, 3), '#5b3d26', { k: 3 }),
    solid(rect(-24, -32, 48, 14, 3), '#3a3a44', { k: 2 }),
    solid(path('M -8 -32 L 8 -32 L 6 -60 L -6 -60 Z'), M, { k: 2 }),
    line('M -30 -112 Q -56 -112 -50 -90 Q -44 -74 -24 -76 M 30 -112 Q 56 -112 50 -90 Q 44 -74 24 -76', OUT, 10),
    line('M -30 -112 Q -56 -112 -50 -90 Q -44 -74 -24 -76 M 30 -112 Q 56 -112 50 -90 Q 44 -74 24 -76', M, 5),
    solid(path('M -36 -122 L 36 -122 Q 36 -64 0 -60 Q -36 -64 -36 -122 Z'), M, { k: 7, hi: [-20, -108, 5, 10] }),
    flat(ell(0, -122, 36, 6), dk(M, 20)),
    line(ell(0, -122, 36, 6), OUT, 3),
    solid(path('M 0 -104 L 4 -96 L 12 -95 L 6 -89 L 8 -81 L 0 -85 L -8 -81 L -6 -89 L -12 -95 L -4 -96 Z'), lt(M, 25), { k: 1, lw: 2 }),
  ], { palette: { main: GOLD }, grip: [0, -46], shadow: 36 }),

  prop('guitar', 'Guitar', 'fun', [100, 260], [
    solid(rect(-7, -250, 14, 150, 3), '#6a3e22', { k: 2 }),
    solid(path('M -12 -264 L 12 -264 L 9 -236 L -9 -236 Z'), '#4a2a18', { k: 2 }),
    solid(path('M 0 -128 C -30 -128 -38 -108 -30 -90 C -24 -78 -48 -72 -48 -42 C -48 -10 -24 0 0 0 C 24 0 48 -10 48 -42 C 48 -72 24 -78 30 -90 C 38 -108 30 -128 0 -128 Z'), M, { k: 10, hi: [-22, -100, 6, 12] }),
    flat(ell(0, -76, 14, 14), '#3a2216'),
    line(ell(0, -76, 14, 14), dk(M, 30), 3),
    solid(rect(-16, -36, 32, 8, 2), '#4a2a18', { k: 1, lw: 2.2 }),
    line('M -3 -250 L -3 -32 M 3 -250 L 3 -32', '#efe6d0', 1.2),
    ...[-252, -244].flatMap((y) => [flat(ell(-14, y, 3, 2), '#d8d8e0'), flat(ell(14, y, 3, 2), '#d8d8e0')]),
  ], { palette: { main: '#e0913a' }, grip: [0, -196], shadow: 40 }),

  prop('microphone', 'Microphone', 'fun', [30, 74], [
    solid(path('M -7 -46 L 7 -46 L 4 0 L -4 0 Z'), '#3a3a44', { k: 2 }),
    solid(rect(-9, -50, 18, 8, 2), M, { k: 1, lw: 2.4 }),
    solid(ell(0, -60, 14, 14), '#b8bec8', { k: 3, hi: [-5, -66, 4, 3] }),
    line('M -10 -66 L 10 -66 M -13 -60 L 13 -60 M -10 -54 L 10 -54 M -4 -72 L -4 -48 M 4 -72 L 4 -48', '#7a808c', 1.4),
    line(ell(0, -60, 14, 14), OUT, 3),
  ], { palette: { main: '#e5484d' }, grip: [0, -22], hold: 'rotate', holdAngle: 0, shadow: 10 }),

  prop('mic_stand', 'Microphone stand', 'fun', [100, 330], [
    line('M 0 -40 L -40 0 M 0 -40 L 40 0 M 0 -40 L 0 -4', '#3a3a44', 6),
    solid(rect(-5, -280, 10, 244, 3), '#5a5a66', { k: 2 }),
    solid(rect(-8, -170, 16, 14, 3), '#3a3a44', { k: 2 }),
    solid(path('M -7 -306 L 7 -306 L 4 -278 L -4 -278 Z'), '#3a3a44', { k: 2 }),
    solid(ell(0, -316, 13, 13), '#b8bec8', { k: 3 }),
    line('M -9 -322 L 9 -322 M -12 -316 L 12 -316 M -9 -310 L 9 -310', '#7a808c', 1.4),
  ], { shadow: 40 }),

  prop('ice_cream', 'Ice cream', 'fun', [44, 90], [
    solid(path('M -16 -48 L 16 -48 L 0 0 Z'), '#e0a75e', { k: 3 }),
    line('M -10 -40 L 6 -20 M 0 -46 L 10 -30 M 10 -44 L -6 -18', '#b07a3a', 1.6),
    solid(ell(0, -56, 19, 15), '#f6d6e0', { k: 4 }),
    solid(ell(0, -76, 16, 13), M, { k: 4, hi: [-6, -82, 4, 3] }),
    solid(ell(4, -92, 5, 5), '#e5484d', { k: 1, lw: 2 }),
  ], { palette: { main: '#8a5a36' }, grip: [0, -20], shadow: 10 }),

  prop('popcorn', 'Popcorn', 'fun', [70, 96], [
    ...[[-20, -78], [-4, -86], [14, -80], [24, -72], [-26, -70], [4, -74], [-12, -72]].map(([x, y], i) => solid(ell(x, y, 11, 10), i % 3 ? '#fff6dc' : '#f6e0a0', { k: 3, lw: 2.4 })),
    solid(path('M -30 -70 L 30 -70 L 22 0 L -22 0 Z'), '#ffffff', { k: 5 }),
    flat(path('M -20 -70 L -8 -70 L -6 0 L -14 0 Z'), '#e5484d'),
    flat(path('M 8 -70 L 20 -70 L 14 0 L 6 0 Z'), '#e5484d'),
    line(path('M -30 -70 L 30 -70 L 22 0 L -22 0 Z'), OUT, 3.4),
  ], { grip: [0, -30], shadow: 22 }),

  prop('drum', 'Drum', 'fun', [120, 110], [
    solid(rect(-56, -90, 112, 82, 6), M, { k: 8 }),
    line('M -56 -82 L -28 -16 L 0 -82 L 28 -16 L 56 -82', '#f4ead2', 3),
    solid(ell(0, -90, 56, 14), '#f4ead2', { k: 3 }),
    solid(ell(0, -8, 56, 10), dk(M, 10), { k: 2 }),
    line('M 20 -100 L 60 -150 M -20 -100 L -54 -146', '#c8a06a', 5),
  ], { palette: { main: '#3f7fbf' }, shadow: 56 }),
];
