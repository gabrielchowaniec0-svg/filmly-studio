import { rect, ell, poly, path, solid, flat, line, glow, dk, lt, prop, OUT } from './lib.mjs';

const M = '$main';

export default [
  prop('phone', 'Phone', 'everyday', [26, 46], [
    solid(rect(-13, -46, 26, 46, 6), '#2f3440'),
    solid(rect(-10, -41, 20, 34, 3), M, { k: 2, lw: 2 }),
    flat(path('M -10 -41 L 0 -41 L -10 -24 Z'), '#ffffff', { alpha: 0.3 }),
    flat(ell(0, -3.5, 2.5, 1.6), '#8a93a3'),
  ], { palette: { main: '#7fc4f0' }, grip: [0, -18], shadow: 10 }),

  prop('book', 'Book', 'everyday', [46, 58], [
    solid(rect(-20, -56, 42, 54, 3), '#f4f1ea', { k: 2 }),
    solid(rect(-23, -58, 40, 58, 4), M, { hi: [-12, -48, 4, 6] }),
    flat(rect(-23, -58, 7, 58), dk(M, 25)),
    flat(rect(-11, -46, 22, 12, 2), lt(M, 45)),
    line('M -9 -40 L 9 -40', dk(M, 20), 2),
    line(rect(-23, -58, 40, 58, 4), OUT, 3),
  ], { palette: { main: '#3f7fbf' }, grip: [-6, -24], shadow: 18 }),

  prop('laptop', 'Laptop', 'everyday', [96, 70], [
    solid(rect(-42, -68, 84, 56, 5), '#5b6170'),
    solid(rect(-36, -62, 72, 44, 2), M, { k: 3, lw: 2 }),
    flat(path('M -36 -62 L -12 -62 L -36 -34 Z'), '#ffffff', { alpha: 0.22 }),
    solid(path('M -46 -12 L 46 -12 L 52 -2 Q 0 2 -52 -2 Z'), '#9aa1ae', { k: 2 }),
    flat(ell(0, -45, 6, 6), '#ffffff', { alpha: 0.6 }),
  ], { palette: { main: '#6fb3e0' }, grip: [44, -8], shadow: 40 }),

  prop('backpack', 'Backpack', 'everyday', [96, 116], [
    line('M -18 -92 Q 0 -122 18 -92', OUT, 10),
    line('M -18 -92 Q 0 -122 18 -92', dk(M, 25), 5),
    solid(rect(-44, -98, 88, 98, 28), M, { hi: [-24, -82, 8, 12] }),
    solid(rect(-30, -50, 60, 44, 12), lt(M, 8), { k: 4 }),
    line('M -30 -36 L 30 -36', dk(M, 30), 2.6),
    solid(rect(-6, -40, 12, 7, 3), '#f2c14e', { k: 1, lw: 2 }),
    flat(rect(-40, -86, 6, 72, 3), dk(M, 30)),
  ], { palette: { main: '#e07a3f' }, grip: [0, -112], shadow: 40 }),

  prop('umbrella', 'Umbrella (open)', 'everyday', [230, 340], [
    line('M 0 -270 L 0 -18', '#3a3a44', 5),
    line('M 0 -18 Q 0 0 -12 0 Q -22 0 -22 -10', OUT, 8),
    line('M 0 -18 Q 0 0 -12 0 Q -22 0 -22 -10', '#7a4a2a', 4),
    solid(path('M -114 -262 Q -110 -340 0 -340 Q 110 -340 114 -262 Q 95 -278 76 -262 Q 57 -278 38 -262 Q 19 -278 0 -262 Q -19 -278 -38 -262 Q -57 -278 -76 -262 Q -95 -278 -114 -262 Z'), M, { k: 10, hi: [-56, -318, 26, 8, -18] }),
    line('M 0 -340 Q -40 -320 -38 -264 M 0 -340 Q 40 -320 38 -264 M 0 -340 Q -86 -326 -76 -266 M 0 -340 Q 86 -326 76 -266', dk(M, 28), 2.4),
    solid(ell(0, -344, 5, 5), '#3a3a44', { k: 1, lw: 2 }),
  ], { palette: { main: '#d94a5a' }, grip: [0, -22], shadow: 60 }),

  prop('umbrella_closed', 'Umbrella (closed)', 'everyday', [40, 190], [
    line('M 0 -150 L 0 -186', '#3a3a44', 5),
    solid(path('M 0 -160 Q 16 -100 9 -34 L -9 -34 Q -16 -100 0 -160 Z'), M, { k: 4 }),
    line('M 0 -150 Q 6 -100 2 -40', dk(M, 28), 2),
    line('M 0 -34 L 0 -18', '#3a3a44', 5),
    line('M 0 -18 Q 0 0 -12 0 Q -22 0 -22 -10', OUT, 8),
    line('M 0 -18 Q 0 0 -12 0 Q -22 0 -22 -10', '#7a4a2a', 4),
  ], { palette: { main: '#d94a5a' }, grip: [0, -22], shadow: 14 }),

  prop('flashlight', 'Flashlight', 'everyday', [300, 60], [
    { ...path('M 36 -20 L 300 -64 L 300 34 L 36 6 Z'), fill: { stops: [[0, 'rgba(255,245,190,0.75)'], [1, 'rgba(255,245,190,0)']], x0: 36, y0: 0, x1: 300, y1: 0 }, stroke: null },
    solid(rect(-34, -16, 54, 18, 6), M, { hi: [-20, -12, 10, 2] }),
    solid(path('M 18 -20 L 36 -26 L 36 10 L 18 4 Z'), lt(M, 10), { k: 2 }),
    solid(ell(37, -8, 4, 18), '#fff6c8', { k: 1, lw: 2.6 }),
    solid(rect(-8, -20, 10, 6, 2), '#f2c14e', { k: 1, lw: 2 }),
    flat(rect(-30, -4, 46, 3), dk(M, 30)),
  ], { palette: { main: '#3a3a44' }, grip: [-14, -7], hold: 'rotate', holdAngle: 0, shadow: 20 }),

  prop('key', 'Key', 'everyday', [50, 22], [
    solid(path('M -8 -13 L 26 -13 L 26 -9 L 22 -9 L 22 -3 L 18 -3 L 18 -9 L 13 -9 L 13 -5 L 9 -5 L 9 -9 L -8 -9 Z'), M, { k: 1.5, lw: 2.4 }),
    solid(ell(-15, -11, 10, 10), M, { k: 2, lw: 2.6 }),
    flat(ell(-15, -11, 4, 4), '#2a1d1d', { alpha: 0.85 }),
  ], { palette: { main: '#e8b83a' }, grip: [-15, -11], shadow: 12 }),

  prop('letter', 'Letter', 'everyday', [60, 40], [
    solid(rect(-30, -38, 60, 38, 3), M, { k: 3 }),
    line('M -30 -38 L 0 -16 L 30 -38', dk(M, 30), 2.4),
    line('M -30 0 L -8 -18 M 30 0 L 8 -18', dk(M, 18), 2),
    solid(rect(14, -34, 12, 14, 1), '#d94a5a', { k: 1, lw: 1.8 }),
    solid(ell(0, -16, 5, 5), '#c0392b', { k: 1, lw: 1.8 }),
  ], { palette: { main: '#f6ead2' }, grip: [-24, -19], shadow: 22 }),

  prop('gift_box', 'Gift box', 'everyday', [80, 92], [
    solid(rect(-34, -60, 68, 60, 4), M, { hi: [-20, -48, 6, 8] }),
    solid(rect(-38, -70, 76, 16, 4), lt(M, 8), { k: 3 }),
    solid(rect(-7, -70, 14, 70, 1), '#f6d36a', { k: 2, lw: 2.6 }),
    solid(path('M 0 -70 C -30 -96 -36 -70 -2 -70 Z'), '#f6d36a', { k: 2, lw: 2.6 }),
    solid(path('M 0 -70 C 30 -96 36 -70 2 -70 Z'), '#f6d36a', { k: 2, lw: 2.6 }),
    solid(ell(0, -70, 6, 5), '#f6d36a', { k: 1, lw: 2.6 }),
  ], { palette: { main: '#8a5bb8' }, grip: [0, -2], handPose: 'open', shadow: 36 }),

  prop('balloon', 'Balloon', 'everyday', [80, 320], [
    line('M 0 -236 C -14 -180 16 -120 -4 -60 C -14 -30 6 -12 0 0', '#7a7a86', 2),
    solid(path('M 0 -238 L -7 -228 L 7 -228 Z'), M, { k: 1, lw: 2.4 }),
    solid(path('M 0 -238 C -46 -244 -46 -320 0 -320 C 46 -320 46 -244 0 -238 Z'), M, { k: 8, hi: [-14, -298, 8, 12, -20], hiAlpha: 0.5 }),
  ], { palette: { main: '#e84a6f' }, grip: [0, -2], shadow: false }),

  prop('ball', 'Ball', 'everyday', [56, 56], [
    solid(ell(0, -27, 27, 27), M, { hi: [-10, -38, 7, 5] }),
    line('M -26 -22 Q 0 -10 26 -22', '#ffffff', 6),
    line('M -2 -54 Q -14 -27 -2 0', '#f2c14e', 6),
    line(ell(0, -27, 27, 27), OUT, 3.4),
  ], { palette: { main: '#e5484d' }, grip: [0, -14], handPose: 'open', shadow: 22 }),

  prop('sign', 'Sign', 'everyday', [200, 250], [
    solid(rect(-8, -170, 16, 170, 4), '#9a6a43'),
    solid(rect(-96, -250, 192, 100, 8), M, { k: 6 }),
    line(rect(-86, -240, 172, 80, 4), dk(M, 22), 2.4),
    solid(ell(-80, -236, 3, 3), '#6a6a78', { k: 1, lw: 1.5 }),
    solid(ell(80, -236, 3, 3), '#6a6a78', { k: 1, lw: 1.5 }),
  ], { palette: { main: '#f6ead2' }, grip: [0, -96], text: { x: -86, y: -240, w: 172, h: 80, color: '#2a1d1d', default: 'HELLO!' }, shadow: 30 }),

  prop('chalkboard', 'Chalkboard', 'everyday', [230, 280], [
    line('M -80 -200 L -110 0 M 80 -200 L 110 0', '#7a4a2a', 9),
    line('M 0 -200 L 0 -20', '#6a3e22', 7),
    solid(rect(-110, -280, 220, 160, 8), '#9a6a43', { k: 5 }),
    solid(rect(-98, -268, 196, 136, 3), M, { k: 4 }),
    solid(rect(-60, -126, 30, 6, 2), '#ffffff', { k: 1, lw: 1.5 }),
  ], { palette: { main: '#2f5a46' }, text: { x: -92, y: -262, w: 184, h: 124, color: '#f4f1ea', weight: 600, size: 34, default: '' } }),

  prop('suitcase', 'Suitcase', 'everyday', [130, 112], [
    line('M -18 -90 L -18 -104 Q -18 -110 -12 -110 L 12 -110 Q 18 -110 18 -104 L 18 -90', OUT, 9),
    line('M -18 -90 L -18 -104 Q -18 -110 -12 -110 L 12 -110 Q 18 -110 18 -104 L 18 -90', '#5b3d26', 4),
    solid(rect(-62, -92, 124, 86, 12), M, { hi: [-40, -80, 10, 6] }),
    solid(rect(-40, -92, 12, 86, 2), dk(M, 18), { flat: true }),
    solid(rect(28, -92, 12, 86, 2), dk(M, 18), { flat: true }),
    line(rect(-62, -92, 124, 86, 12), OUT, 3.4),
    solid(ell(-46, -4, 6, 6), '#3a3a44', { k: 1, lw: 2 }),
    solid(ell(46, -4, 6, 6), '#3a3a44', { k: 1, lw: 2 }),
  ], { palette: { main: '#b0533c' }, grip: [0, -104], shadow: 56 }),

  prop('newspaper', 'Newspaper', 'everyday', [80, 60], [
    solid(rect(-38, -58, 76, 56, 2), '#efeae0', { k: 3 }),
    line('M 0 -58 L 0 -2', '#b8b0a0', 2),
    line('M -32 -36 L -6 -36 M -32 -29 L -6 -29 M -32 -22 L -6 -22 M -32 -15 L -10 -15 M 6 -24 L 32 -24 M 6 -17 L 32 -17 M 6 -10 L 26 -10', '#9a9488', 2),
    flat(rect(6, -38, 26, 10), '#9ab0c8'),
  ], { grip: [-36, -30], text: { x: -36, y: -56, w: 72, h: 14, color: '#2a1d1d', default: 'DAILY NEWS' }, shadow: 30 }),
];
