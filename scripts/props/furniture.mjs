import { rect, ell, poly, path, solid, flat, line, glow, dk, lt, prop, OUT } from './lib.mjs';

const WOOD = '#b77a45';
const M = '$main';

export default [
  prop('chair', 'Chair', 'furniture', [130, 250], [
    // back posts + legs (back pair darker, slightly inset)
    solid(rect(-50, -112, 11, 108, 4), dk(M, 22), { flat: true }),
    solid(rect(39, -112, 11, 108, 4), dk(M, 22), { flat: true }),
    solid(rect(-58, -250, 14, 140, 6), M),
    solid(rect(44, -250, 14, 140, 6), M),
    solid(rect(-48, -236, 96, 32, 10), M),
    solid(rect(-48, -186, 96, 14, 6), M),
    solid(rect(-44, -170, 10, 52, 4), dk(M, 8)),
    solid(rect(-5, -170, 10, 52, 4), dk(M, 8)),
    solid(rect(34, -170, 10, 52, 4), dk(M, 8)),
    // seat with a perspective top
    solid(poly([[-66, -112], [66, -112], [56, -134], [-56, -134]]), lt(M, 14), { k: 4 }),
    solid(rect(-68, -114, 136, 20, 7), M),
    solid(rect(-62, -96, 14, 96, 5), M),
    solid(rect(48, -96, 14, 96, 5), M),
  ], { palette: { main: WOOD } }),

  prop('armchair', 'Armchair', 'furniture', [230, 230], [
    solid(rect(-88, -24, 18, 24, 5), '#5b3d26'),
    solid(rect(70, -24, 18, 24, 5), '#5b3d26'),
    solid(rect(-86, -226, 172, 150, 46), M, { hi: [-40, -196, 26, 10] }),
    line('M -40 -200 Q 0 -182 40 -200', dk(M, 30), 3),
    solid(rect(-100, -110, 200, 90, 22), M),
    solid(rect(-72, -124, 144, 46, 18), lt(M, 10), { hi: [-30, -114, 24, 6] }),
    solid(rect(-116, -152, 50, 132, 24), M, { hi: [-100, -140, 8, 6] }),
    solid(rect(66, -152, 50, 132, 24), M, { hi: [84, -140, 8, 6] }),
  ], { palette: { main: '#c0504d' } }),

  prop('sofa', 'Sofa', 'furniture', [420, 220], [
    solid(rect(-180, -24, 18, 24, 5), '#5b3d26'),
    solid(rect(162, -24, 18, 24, 5), '#5b3d26'),
    solid(rect(-180, -214, 360, 140, 44), M, { hi: [-110, -186, 40, 10] }),
    line('M 0 -206 L 0 -110', dk(M, 26), 3),
    solid(rect(-196, -108, 392, 86, 22), M),
    solid(rect(-160, -124, 158, 44, 18), lt(M, 10), { hi: [-110, -114, 30, 6] }),
    solid(rect(2, -124, 158, 44, 18), lt(M, 10), { hi: [52, -114, 30, 6] }),
    solid(rect(-212, -150, 54, 128, 26), M, { hi: [-196, -138, 8, 6] }),
    solid(rect(158, -150, 54, 128, 26), M, { hi: [176, -138, 8, 6] }),
    solid(rect(-120, -186, 70, 56, 18), '#f2c14e', { hi: true }),
  ], { palette: { main: '#5a7bb0' } }),

  prop('table', 'Table', 'furniture', [270, 170], [
    solid(rect(-108, -136, 13, 130, 4), dk(M, 22), { flat: true }),
    solid(rect(95, -136, 13, 130, 4), dk(M, 22), { flat: true }),
    solid(poly([[-134, -150], [134, -150], [116, -170], [-116, -170]]), lt(M, 14), { k: 4 }),
    solid(rect(-136, -152, 272, 20, 6), M),
    solid(rect(-122, -132, 16, 132, 5), M),
    solid(rect(106, -132, 16, 132, 5), M),
    solid(rect(-106, -132, 212, 12, 3), dk(M, 10)),
  ], { palette: { main: WOOD } }),

  prop('desk', 'Desk', 'furniture', [300, 160], [
    solid(poly([[-150, -146], [150, -146], [134, -164], [-134, -164]]), lt(M, 14), { k: 4 }),
    solid(rect(-152, -148, 304, 20, 6), M),
    solid(rect(-146, -128, 96, 128, 6), M),
    solid(rect(-138, -120, 80, 34, 6), lt(M, 8), { k: 3 }),
    solid(rect(-138, -80, 80, 34, 6), lt(M, 8), { k: 3 }),
    solid(rect(-138, -40, 80, 34, 6), lt(M, 8), { k: 3 }),
    solid(rect(-106, -107, 16, 8, 4), '#e8c66a', { k: 2 }),
    solid(rect(-106, -67, 16, 8, 4), '#e8c66a', { k: 2 }),
    solid(rect(-106, -27, 16, 8, 4), '#e8c66a', { k: 2 }),
    solid(rect(126, -128, 16, 128, 5), M),
  ], { palette: { main: '#9a6a43' } }),

  prop('bed', 'Bed', 'furniture', [470, 210], [
    solid(rect(-236, -206, 34, 206, 14), WOOD, { hi: [-224, -190, 6, 10] }),
    solid(rect(204, -132, 30, 132, 12), WOOD),
    solid(rect(-210, -64, 420, 30, 6), dk(WOOD, 8)),
    solid(rect(-206, -40, 14, 40, 4), dk(WOOD, 20)),
    solid(rect(190, -40, 14, 40, 4), dk(WOOD, 20)),
    solid(rect(-206, -108, 410, 48, 16), '#f4f1ea'),
    solid(ell(-148, -116, 50, 22), '#ffffff', { hi: true }),
    solid(path('M -96 -122 Q 60 -134 208 -118 L 208 -54 Q 60 -46 -96 -54 Z'), M, { k: 10 }),
    flat(path('M -96 -122 Q 60 -134 208 -118 L 208 -100 Q 60 -112 -96 -102 Z'), lt(M, 22)),
    line('M -96 -122 Q 60 -134 208 -118', OUT, 3),
    line('M -60 -96 Q 40 -88 120 -98', dk(M, 26), 3),
  ], { palette: { main: '#6aa0d8' } }),

  prop('bookshelf', 'Bookshelf', 'furniture', [200, 390], (() => {
    const out = [solid(rect(-100, -390, 200, 390, 8), M), flat(rect(-86, -376, 172, 364), dk(M, 34))];
    const cols = ['#c0504d', '#3f7fbf', '#f2c14e', '#5aa36b', '#8a5bb8', '#e07a3f', '#2f4f6f', '#d96c9a'];
    const shelves = [-288, -196, -104, -12];
    let k = 0;
    for (const sy of shelves) {
      let x = -82;
      while (x < 70) {
        const w = 12 + ((k * 7) % 4) * 4;
        const h = 58 + ((k * 13) % 5) * 5;
        if (x + w > 82) break;
        const tilt = k % 9 === 4;
        const c = cols[k % cols.length];
        if (tilt) out.push(solid(poly([[x, sy], [x + w, sy], [x + w + 18, sy - h + 4], [x + 18 - w * 0.2, sy - h]]), c, { k: 3, lw: 2.6 }));
        else out.push(solid(rect(x, sy - h, w, h, 2), c, { k: 3, lw: 2.6 }), flat(rect(x + 3, sy - h + 10, w - 6, 4), lt(c, 40)));
        x += w + (tilt ? 20 : 1);
        k++;
      }
    }
    for (const sy of [-376, ...shelves.slice(0, 3)]) out.push(solid(rect(-90, sy, 180, 12, 3), lt(M, 8), { k: 3 }));
    out.push(solid(rect(-100, -14, 200, 14, 4), M, { k: 3 }));
    return out;
  })(), { palette: { main: WOOD } }),

  prop('floor_lamp', 'Floor lamp', 'furniture', [130, 390], [
    glow(0, -290, 150, '#ffe7a0', 0.45),
    solid(ell(0, -8, 44, 11), '#4a4a55'),
    solid(rect(-5, -310, 10, 300, 4), '#6a6a78', { k: 2 }),
    solid(poly([[-64, -296], [64, -296], [40, -386], [-40, -386]]), M, { hi: [-26, -360, 10, 18, 12] }),
    flat(ell(0, -296, 64, 9), lt(M, 30)),
    line(ell(0, -296, 64, 9), OUT, 3),
  ], { palette: { main: '#f2d27a' } }),

  prop('table_lamp', 'Table lamp', 'furniture', [90, 130], [
    glow(0, -88, 80, '#ffe7a0', 0.45),
    solid(ell(0, -4, 28, 7), '#6a5040'),
    solid(path('M -18 -6 Q -30 -36 -8 -52 L 8 -52 Q 30 -36 18 -6 Z'), '#5aa3a0', { hi: [-10, -34, 5, 9] }),
    solid(rect(-3, -76, 6, 26, 2), '#d8c27a', { k: 1.5 }),
    solid(poly([[-44, -70], [44, -70], [28, -126], [-28, -126]]), M, { hi: [-16, -108, 7, 12, 12] }),
  ], { palette: { main: '#f6e3b0' } }),

  prop('plant', 'Potted plant', 'furniture', [150, 200], (() => {
    const leaves = [];
    const L = (ang, len, w, c) => {
      const a = (ang * Math.PI) / 180;
      const tx = Math.sin(a) * len, ty = -76 - Math.cos(a) * len;
      const nx = Math.cos(a) * w, ny = Math.sin(a) * w;
      const mx = tx * 0.5, my = -76 + (ty + 76) * 0.5;
      leaves.push(solid(path(`M 0 -76 Q ${(mx + nx).toFixed(1)} ${(my + ny).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} Q ${(mx - nx).toFixed(1)} ${(my - ny).toFixed(1)} 0 -76 Z`), c, { k: 4, lw: 2.8 }));
      leaves.push(line(`M 0 -76 Q ${(mx + nx * 0.2).toFixed(1)} ${(my + ny * 0.2).toFixed(1)} ${(tx * 0.85).toFixed(1)} ${(-76 + (ty + 76) * 0.85).toFixed(1)}`, dk(c, 30), 2));
    };
    [[-62, 92, 20, '#4f9a55'], [62, 96, 20, '#4f9a55'], [-30, 118, 22, '#5cae5f'], [30, 112, 22, '#5cae5f'], [-4, 128, 20, '#68bd69'], [-80, 70, 16, '#468a4c'], [82, 72, 16, '#468a4c']].forEach((l) => L(...l));
    return [
      ...leaves,
      solid(path('M -44 -82 L 44 -82 L 34 -4 Q 0 4 -34 -4 Z'), M, { hi: [-22, -60, 6, 14] }),
      solid(rect(-50, -96, 100, 20, 6), lt(M, 8), { k: 4 }),
    ];
  })(), { palette: { main: '#c8693e' } }),

  prop('tv', 'Television', 'furniture', [240, 260], [
    solid(rect(-80, -20, 160, 20, 5), '#5b3d26'),
    solid(rect(-14, -60, 28, 42, 4), '#34343e'),
    solid(rect(-118, -250, 236, 160, 12), '#34343e'),
    solid(rect(-104, -238, 208, 132, 6), M, { k: 6 }),
    flat(path('M -96 -230 L -40 -230 L -96 -150 Z'), '#ffffff', { alpha: 0.18 }),
    solid(ell(96, -98, 4, 4), '#ff5a5a', { k: 1, lw: 1.5 }),
  ], { palette: { main: '#5b8fc9' }, text: { x: -100, y: -232, w: 200, h: 120, color: '#ffffff', size: 40 } }),

  prop('rug', 'Rug', 'furniture', [440, 70], [
    solid(ell(0, -20, 220, 34), M, { k: 6 }),
    line(ell(0, -20, 186, 26), lt(M, 40), 6),
    line(ell(0, -20, 150, 19), dk(M, 25), 4),
    flat(ell(0, -20, 90, 11), lt(M, 25)),
  ], { palette: { main: '#b84a5e' }, shadow: false }),

  prop('clock', 'Wall clock', 'furniture', [90, 90], [
    solid(ell(0, -45, 45, 45), M),
    solid(ell(0, -45, 36, 36), '#fbf6ea', { k: 3 }),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
      const a = (i / 12) * Math.PI * 2;
      const r1 = i % 3 ? 30 : 26;
      return line(`M ${(Math.sin(a) * r1).toFixed(1)} ${(-45 - Math.cos(a) * r1).toFixed(1)} L ${(Math.sin(a) * 33).toFixed(1)} ${(-45 - Math.cos(a) * 33).toFixed(1)}`, OUT, i % 3 ? 2 : 3.4);
    }),
    line('M 0 -45 L 0 -68', OUT, 4),
    line('M 0 -45 L 16 -38', OUT, 4),
    solid(ell(0, -45, 4, 4), '#c0504d', { k: 1, lw: 2 }),
  ], { palette: { main: '#7a4a2a' }, shadow: false }),
];
