import { rect, ell, poly, path, solid, flat, line, dk, lt, prop, OUT } from './lib.mjs';

const M = '$main';

export default [
  prop('mug', 'Mug', 'kitchen', [46, 44], [
    line('M 12 -32 C 30 -34 30 -8 12 -10', OUT, 11),
    line('M 12 -32 C 30 -34 30 -8 12 -10', M, 5),
    solid(path('M -16 -40 L 16 -40 L 14 -4 Q 0 2 -14 -4 Z'), M, { hi: [-8, -28, 3, 8] }),
    flat(ell(0, -39, 15, 3.5), '#5a3420'),
    line(ell(0, -40, 16, 4), OUT, 2.6),
    line('M -4 -48 Q -8 -56 -3 -62 M 5 -50 Q 1 -58 6 -66', '#ffffff', 2.6, { alpha: 0.7 }),
  ], { palette: { main: '#e8564f' }, grip: [22, -21], hold: 'upright', shadow: 14 }),

  prop('plate', 'Plate', 'kitchen', [80, 20], [
    solid(ell(0, -9, 40, 9), M, { k: 3 }),
    flat(ell(0, -11, 27, 5.5), dk(M, 8)),
    line(ell(0, -11, 27, 5.5), dk(M, 25), 1.6),
    solid(ell(-6, -15, 13, 6), '#e2a14a', { k: 2, lw: 2.4 }),
    solid(ell(8, -14, 9, 5), '#6ab04c', { k: 2, lw: 2.4 }),
  ], { palette: { main: '#f4f1ea' }, grip: [0, -4], handPose: 'open', shadow: 30 }),

  prop('kettle', 'Kettle', 'kitchen', [90, 92], [
    line('M -22 -58 Q 0 -98 22 -58', OUT, 10),
    line('M -22 -58 Q 0 -98 22 -58', '#3a3a44', 5),
    solid(path('M 26 -34 L 46 -52 L 50 -48 L 34 -22 Z'), M, { k: 3 }),
    solid(path('M -34 -2 Q -42 -40 -18 -58 L 18 -58 Q 42 -40 34 -2 Q 0 4 -34 -2 Z'), M, { hi: [-18, -40, 7, 12] }),
    solid(ell(0, -58, 20, 5), lt(M, 10), { k: 2 }),
    solid(ell(0, -64, 6, 5), '#3a3a44', { k: 2 }),
  ], { palette: { main: '#d94f4f' }, grip: [0, -80], shadow: 34 }),

  prop('fridge', 'Fridge', 'kitchen', [180, 420], [
    solid(rect(-88, -420, 176, 412, 18), M, { hi: [-50, -380, 20, 40] }),
    line('M -88 -290 L 88 -290', dk(M, 30), 3.4),
    solid(rect(-72, -380, 10, 64, 5), '#9aa3ad', { k: 2 }),
    solid(rect(-72, -268, 10, 96, 5), '#9aa3ad', { k: 2 }),
    solid(rect(-80, -10, 160, 10, 3), dk(M, 30)),
    solid(ell(30, -356, 9, 9), '#e8564f', { k: 2, lw: 2.4 }),
    solid(rect(46, -344, 18, 14, 3), '#f2c14e', { k: 2, lw: 2.4 }),
    solid(rect(14, -236, 46, 58, 2), '#ffffff', { k: 2, lw: 2.4 }),
    line('M 20 -224 L 52 -224 M 20 -212 L 46 -212 M 20 -200 L 50 -200', '#7a8a9a', 2),
  ], { palette: { main: '#e9eef2' } }),

  prop('frying_pan', 'Frying pan', 'kitchen', [110, 30], [
    solid(rect(28, -20, 56, 10, 5), '#4a3226', { k: 2 }),
    solid(path('M -36 -24 L 36 -24 Q 34 -4 0 -4 Q -34 -4 -36 -24 Z'), '#3a3a44', { k: 3 }),
    flat(ell(0, -24, 36, 6), '#5a5a66'),
    line(ell(0, -24, 36, 6), OUT, 2.6),
    solid(ell(-6, -25, 13, 4), '#ffffff', { k: 1, lw: 2 }),
    solid(ell(-6, -25.5, 5, 2.2), '#f6c33a', { k: 1, lw: 1.6 }),
  ], { grip: [76, -15], hold: 'upright', shadow: 30 }),

  prop('teapot', 'Teapot', 'kitchen', [100, 76], [
    line('M 26 -44 C 50 -50 52 -14 28 -16', OUT, 10),
    line('M 26 -44 C 50 -50 52 -14 28 -16', M, 5),
    solid(path('M -30 -30 Q -46 -36 -50 -54 L -44 -56 Q -38 -42 -26 -40 Z'), M, { k: 2 }),
    solid(ell(0, -30, 34, 28), M, { hi: [-14, -42, 8, 7] }),
    solid(ell(0, -58, 16, 5), lt(M, 10), { k: 2 }),
    solid(ell(0, -65, 5, 5), lt(M, 10), { k: 2 }),
    line('M -24 -24 Q 0 -14 24 -24', lt(M, 45), 3),
  ], { palette: { main: '#7bb2d9' }, grip: [40, -32], shadow: 30 }),
];
