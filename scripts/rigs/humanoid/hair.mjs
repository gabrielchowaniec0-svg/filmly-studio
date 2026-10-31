// Hair (back layers, skull caps, fringes, ponytails, buns, braids, locs) and headwear.
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
//
// Head-space landmarks (head bone): crown ≈ (6,-130), back of skull ≈ x -62, face front ≈ x 66,
// ear ≈ (-50,-62), eyes ≈ y -66, brows ≈ y -90..-104, nape ≈ (-54,-42), chin ≈ (12,1).
//
// Layering per style:
//   z 5      back hair on bone `hair` (sways; drawn behind body and head) — ponytails on bone `tail`
//   z 70.4   pieces that tuck behind the skull cap (far puff/bun, man bun)
//   z 70.5   skull cap (fill) → 70.52 shade → 70.54 shine → 70.58 outline  (ear at 71 draws over it)
//   z 71.5   caps that cover the top of the ear (bob, bowl, long styles)
//   z 95     fringes and locks in front of the face/shoulder (bone `hair` for long locks so they sway)
//   z 98-99  headwear
// Colours: hair uses $hair with $hair-NN shade / $hair+NN shine; headwear uses $accent (+ shades),
// except iconic fixed-colour hats (crown, chef, police, pilot).
import { bumpy, shiftY } from './common.mjs';

const HAIR_OPTIONS = [
  // original ids (characters use these)
  'short', 'spiky', 'swoop', 'buzz', 'bob', 'long', 'ponytail', 'bun', 'curly', 'bald',
  // added
  'pixie', 'undercut', 'mohawk', 'afro', 'boxbraids', 'cornrows', 'locs', 'highpuff', 'twopuffs', 'pigtails',
  'braids', 'sidebraid', 'longwavy', 'shouldercurls', 'manbun', 'slicked', 'sidepart', 'combover', 'curlytop',
  'bowl', 'spacebuns', 'hijab',
];
const HEADWEAR_OPTIONS = [
  'none', 'beanie', 'cap', 'bow', 'headband', 'headphones', 'flower',
  'fedora', 'tophat', 'cowboy', 'bucket', 'beret', 'hardhat', 'crown', 'wizard', 'witch', 'chef', 'police', 'pilot', 'bandana',
];
export const slots = {
  hair: { default: 'short', options: HAIR_OPTIONS },
  headwear: { default: 'none', options: HEADWEAR_OPTIONS },
};

/** Headwear that covers the crown: tall hair (spikes, puffs, buns, quiffs) is hidden or flattened under these. */
export const COVER = ['beanie', 'cap', 'fedora', 'tophat', 'cowboy', 'bucket', 'beret', 'hardhat', 'wizard', 'witch', 'chef', 'police', 'pilot', 'bandana'];

// ---- geometry helpers ------------------------------------------------------------------------
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const HB = (d) => shiftY(d, 70);
const shiftX = (d, dx) => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${f1(+x + dx)} ${y}`); // head space → hair-bone space (hair bone sits at head (0,-70))

/** Point on a cubic Bézier. */
function bez(p, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
}
const cubicD = (p) => `M ${f1(p[0][0])} ${f1(p[0][1])} C ${p.slice(1).map((q) => `${f1(q[0])} ${f1(q[1])}`).join(' ')}`;

/** Crescent highlight band(s) along an elliptical arc (angles in degrees, canvas convention). */
function shineBand(cx, cy, rx, ry, a0, a1, w, segs = [[0, 0.58], [0.66, 0.84], [0.9, 1]]) {
  let d = '';
  for (const [s0, s1] of segs) {
    const out = [], inn = [];
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = ((a0 + (a1 - a0) * (s0 + (s1 - s0) * u)) * Math.PI) / 180;
      const t = (w / 2) * Math.sin(Math.PI * u) ** 0.7;
      out.push([cx + (rx + t) * Math.cos(a), cy + (ry + t) * Math.sin(a)]);
      inn.push([cx + (rx - t) * Math.cos(a), cy + (ry - t) * Math.sin(a)]);
    }
    const pts = [...out, ...inn.reverse()];
    d += `M ${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(' L ')} Z `;
  }
  return d.trim();
}

/** Frame (point, unit tangent, unit normal) along a cubic. */
function frame(p, t) {
  const a = bez(p, Math.max(0, t - 0.005)), b = bez(p, Math.min(1, t + 0.005));
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return [bez(p, t), [dx / L, dy / L], [-dy / L, dx / L]];
}
/**
 * A plait along a cubic: `tube` is a scalloped outline (bumps where the strands cross), `chev` the
 * chevron lines that read as interlocking strands. Width tapers toward the end.
 */
function plait(p, w, n, taper = 0.7) {
  const L = [], R = [];
  const N = n * 4;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [c, , nn] = frame(p, t);
    const bump = 1 + 0.12 * Math.cos((i % 4) * (Math.PI / 2));
    const h = (w / 2) * (1 - (1 - taper) * t) * bump;
    L.push([c[0] + nn[0] * h, c[1] + nn[1] * h]);
    R.push([c[0] - nn[0] * h, c[1] - nn[1] * h]);
  }
  const [e, te] = frame(p, 1);
  const hw = (w / 2) * taper;
  const tip = [e[0] + te[0] * hw * 0.8, e[1] + te[1] * hw * 0.8];
  const pts = (arr) => arr.map((q) => `${f1(q[0])} ${f1(q[1])}`).join(' L ');
  const tube = `M ${pts(L)} Q ${f1(tip[0])} ${f1(tip[1])} ${f1(R[N][0])} ${f1(R[N][1])} L ${pts(R.slice().reverse())} Z`;
  let chev = '';
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const [c, tg, nn] = frame(p, t);
    const h = (w / 2) * (1 - (1 - taper) * t) * 0.85;
    const a = [c[0] + nn[0] * h - tg[0] * h * 0.7, c[1] + nn[1] * h - tg[1] * h * 0.7];
    const m = [c[0] + tg[0] * h * 0.15, c[1] + tg[1] * h * 0.15];
    const b = [c[0] - nn[0] * h - tg[0] * h * 0.7, c[1] - nn[1] * h - tg[1] * h * 0.7];
    chev += `M ${f1(a[0])} ${f1(a[1])} Q ${f1(m[0] - tg[0] * h * 0.2)} ${f1(m[1] - tg[1] * h * 0.2)} ${f1(m[0])} ${f1(m[1])} Q ${f1(m[0] - tg[0] * h * 0.2)} ${f1(m[1] - tg[1] * h * 0.2)} ${f1(b[0])} ${f1(b[1])} `;
  }
  return { tube, chev: chev.trim(), end: e };
}

/** Short cross-ticks along a cubic (braid / loc texture). */
function ticks(p, w, n, slant = 0.6) {
  let d = '';
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const a = bez(p, t), b = bez(p, Math.min(1, t + 0.01));
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const tx = dx / L, ty = dy / L, nx = -ty, ny = tx;
    const h = w * 0.42;
    d += `M ${f1(a[0] + nx * h - tx * h * slant)} ${f1(a[1] + ny * h - ty * h * slant)} L ${f1(a[0] - nx * h + tx * h * slant)} ${f1(a[1] - ny * h + ty * h * slant)} `;
  }
  return d.trim();
}

/** Small circle as a path (no arcs, so it survives shiftY). */
function circ(cx, cy, r) {
  const k = 0.5523 * r;
  return `M ${f1(cx + r)} ${f1(cy)} C ${f1(cx + r)} ${f1(cy + k)} ${f1(cx + k)} ${f1(cy + r)} ${f1(cx)} ${f1(cy + r)} C ${f1(cx - k)} ${f1(cy + r)} ${f1(cx - r)} ${f1(cy + k)} ${f1(cx - r)} ${f1(cy)} C ${f1(cx - r)} ${f1(cy - k)} ${f1(cx - k)} ${f1(cy - r)} ${f1(cx)} ${f1(cy - r)} C ${f1(cx + k)} ${f1(cy - r)} ${f1(cx + r)} ${f1(cy - k)} ${f1(cx + r)} ${f1(cy)} Z`;
}

// Shared outlines --------------------------------------------------------------------------------
// Back/top contour from the nape over the crown to the front temple; `v` adds volume.
const crown = (v = 0, top = -145) => `M -54 -40 C -64 -52 ${-71 - v} -78 ${-68 - v} -102 C ${-63 - v} ${-130 - v * 0.6} -32 ${top - v * 0.4} 6 ${top - v * 0.2} C ${44 + v * 0.4} ${top + 1} ${68 + v * 0.3} -124 70 -98`;
// Natural hairline: forehead → temple → sideburn in front of the ear → under the ear → nape.
const HAIRLINE = ' C 56 -110 36 -111 20 -110 C 2 -109 -16 -105 -27 -98 C -34 -93 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -48 -46 -54 -40 Z';
// Back third of the head in shadow (shade clip shape)
const SH_BACK = 'M -130 -200 L -18 -200 C -36 -160 -46 -110 -40 -76 C -38 -60 -30 -44 -18 -30 L -130 -30 Z';
const SH_BACK_WIDE = 'M -160 -220 L -8 -220 C -30 -160 -40 -110 -34 -70 C -30 -40 -20 -10 0 10 L -160 140 Z';
const SHINE = shineBand(4, -84, 55, 54, 226, 296, 7, [[0, 0.74], [0.82, 1]]);

export function addHairBack(ctx) {
  const { P, ell, path } = ctx;
  const H = (opt, extra = {}) => ({ slot: 'hair', option: opt, ...extra });
  const back = (id, opt, d, extra = {}) => P(id, 'hair', 5, path(HB(d)), { fill: '$hair-8', ...H(opt), ...extra });
  const backShade = (id, of, opt, d, extra = {}) => P(id, 'hair', 5.05, path(HB(d)), { fill: '$hair-26', stroke: null, clip: of, ...H(opt), ...extra });

  // ---- back layers (behind head and body, sway with bone `hair`) ----------------------------
  back('hairBackBob', 'bob', 'M -70 -64 C -80 -118 -38 -152 8 -150 C 56 -148 82 -118 80 -74 C 80 -46 76 -22 68 -8 Q 34 2 0 -2 Q -40 2 -68 -10 C -76 -28 -74 -46 -70 -64 Z');
  back('hairBackLong', 'long', 'M -70 -64 C -78 -120 -36 -150 8 -148 C 56 -146 80 -118 78 -72 C 82 -30 80 12 76 50 Q 64 66 46 58 Q 30 66 14 56 L -40 56 Q -58 68 -72 56 Q -84 58 -82 40 C -84 0 -78 -30 -70 -64 Z');
  backShade('hairBackLongSh', 'hairBackLong', 'long', 'M -120 -40 L -40 -40 C -50 0 -46 40 -36 80 L -120 80 Z M 50 -20 C 56 10 58 40 52 80 L 120 80 L 120 -20 Z');
  back('hairBackWavy', 'longwavy', 'M -72 -64 C -82 -124 -36 -154 8 -152 C 58 -150 84 -120 82 -74 C 90 -50 76 -30 86 -6 C 96 18 78 34 88 56 Q 74 76 56 64 Q 40 78 22 62 L -36 62 Q -54 78 -70 64 Q -92 64 -84 42 C -96 20 -78 4 -88 -18 C -96 -40 -78 -50 -72 -64 Z');
  backShade('hairBackWavySh', 'hairBackWavy', 'longwavy', 'M -130 -40 L -44 -40 C -54 0 -50 40 -40 90 L -130 90 Z M 54 -20 C 62 10 64 40 58 90 L 130 90 L 130 -20 Z');
  back('hairBackCurly', 'curly', bumpy(2, -96, 84, -200, 20, 15, 12) + ' Q 30 -20 2 -16 Q -30 -20 -78 -64 Z', { unless: { headwear: COVER } });
  back('hairBackCurlyHat', 'curly', bumpy(2, -84, 76, -200, 20, 15, 11) + ' Q 30 -10 2 -6 Q -30 -10 -70 -54 Z', { when: { headwear: COVER } });
  back('hairBackCurls', 'shouldercurls', bumpy(2, -86, 86, -210, 30, 18, 11) + ' Q 82 10 68 20 Q 60 34 44 26 Q 30 36 16 24 L -40 24 Q -56 36 -68 22 Q -86 22 -84 4 Q -96 -10 -88 -30 Q -98 -50 -82 -60 Z');
  backShade('hairBackCurlsSh', 'hairBackCurls', 'shouldercurls', 'M -130 -60 L -48 -60 C -56 -20 -50 10 -40 40 L -130 40 Z');
  back('hairBackBraids', 'boxbraids', 'M -70 -70 C -80 -122 -36 -150 8 -148 C 56 -146 80 -118 78 -74 L 80 -40 L -76 -40 Z');
  back('hairBackLocs', 'locs', 'M -70 -70 C -80 -122 -36 -150 8 -148 C 56 -146 80 -118 78 -74 L 80 -40 L -76 -40 Z');
  back('hairBackHijab', 'hijab', 'M -76 -70 C -84 -124 -36 -154 8 -152 C 58 -150 84 -120 82 -74 C 84 -40 82 -10 86 30 L 96 60 Q 0 76 -100 60 L -94 30 C -86 0 -84 -36 -76 -70 Z', { fill: '$accent-22' });

  // braids and locs hanging behind (one outline pass + one fill pass + texture)
  const ropes = (id, opt, curves, w, extra = {}) => {
    const d = curves.map(cubicD).join(' ');
    P(`${id}Ol`, 'hair', 5.1, path(HB(d)), { fill: null, stroke: '$outline', lw: w + 6, ...H(opt), ...extra });
    P(`${id}`, 'hair', 5.2, path(HB(d)), { fill: null, stroke: extra.color || '$hair-6', lw: w, ...H(opt), ...extra, color: undefined });
    if (extra.tex !== false) P(`${id}Tx`, 'hair', 5.3, path(HB(curves.map((c) => ticks(c, w, Math.round(w > 9 ? 9 : 13))).join(' '))), { fill: null, stroke: '$hair-30', lw: 2, ...H(opt), ...extra, tex: undefined, color: undefined });
  };
  const BOX_BACK = [];
  for (let i = 0; i < 9; i++) {
    const x = -70 + i * 17, sway = (i - 4) * 2;
    BOX_BACK.push([[x * 0.9, -90], [x * 1.05, -40], [x + sway, 20], [x + sway * 1.5, 70 + (i % 3) * 6]]);
  }
  ropes('braidsBack', 'boxbraids', BOX_BACK, 9);
  const LOC_BACK = [];
  for (let i = 0; i < 8; i++) {
    const x = -70 + i * 20, sway = (i - 4) * 2.5;
    LOC_BACK.push([[x * 0.9, -90], [x * 1.05, -50], [x + sway, -10], [x + sway * 1.4, 30 + (i % 3) * 8]]);
  }
  ropes('locsBack', 'locs', LOC_BACK, 13);

  // far pigtail / far braid (behind the head)
  P('pigtailFar', 'hair', 5, path(HB('M 46 -116 C 70 -116 86 -96 92 -72 C 98 -46 94 -22 86 -6 C 84 -26 78 -48 66 -66 C 58 -78 48 -86 40 -92 Z')), { fill: '$hair-8', ...H('pigtails') });
  P('pigtailFarTie', 'hair', 5.2, path(HB(circ(46, -106, 9))), { fill: '$accent-10', ...H('pigtails') });
  const bf = plait([[48, -96], [72, -70], [74, -20], [68, 40]], 24, 8);
  P('braidFar', 'hair', 5.1, path(HB(bf.tube)), { fill: '$hair-8', ...H('braids') });
  P('braidFarCh', 'hair', 5.12, path(HB(bf.chev)), { fill: null, stroke: '$hair-34', lw: 2, clip: 'braidFar', ...H('braids') });
  P('braidFarTie', 'hair', 5.2, path(HB(circ(bf.end[0], bf.end[1] - 4, 7))), { fill: '$accent-10', ...H('braids') });

  // ponytail (bone tail, at head (-54,-96)) — tie hides the root
  P('ponytail', 'tail', 5, path('M 6 -8 C -16 -8 -34 10 -38 38 C -42 70 -32 98 -12 116 C -16 104 -14 90 -10 80 C -6 96 4 104 10 106 C 0 86 -8 58 0 30 C 4 14 12 4 6 -8 Z'), { fill: '$hair-4', ...H('ponytail') });
  P('ponytailSh', 'tail', 5.05, path('M -60 0 L -26 10 C -32 40 -28 80 -14 120 L -60 120 Z'), { fill: '$hair-24', stroke: null, clip: 'ponytail', ...H('ponytail') });
  P('ponytailHi', 'tail', 5.07, path('M -10 20 Q -20 50 -14 84 Q -24 52 -16 22 Z'), { fill: '$hair+30', stroke: null, clip: 'ponytail', ...H('ponytail') });
  P('ponytailTie', 'tail', 5.2, ell(2, -4, 10, 8, -20), { fill: '$accent', ...H('ponytail') });

  // far puff / far space bun / man bun (tucked behind the cap)
  const NOHAT = { unless: { headwear: COVER } };
  P('puffFar', 'head', 70.4, path(bumpy(44, -142, 26, 0, 360, 12, 4)), { fill: '$hair-10', ...H('twopuffs', NOHAT) });
  P('spacebunFar', 'head', 70.4, ell(40, -146, 20, 18), { fill: '$hair-10', ...H('spacebuns', NOHAT) });
  P('manbun', 'head', 70.4, ell(-46, -140, 23, 20, -24), { fill: '$hair', ...H('manbun', NOHAT) });
  P('manbunSh', 'head', 70.42, ell(-54, -132, 20, 13, -24), { fill: '$hair-20', stroke: null, clip: 'manbun', ...H('manbun', NOHAT) });
  P('highpuff', 'head', 70.4, path(bumpy(-8, -160, 36, 0, 360, 15, 5)), { fill: '$hair', ...H('highpuff', NOHAT) });
  P('highpuffSh', 'head', 70.42, path('M -60 -200 L -18 -200 C -30 -180 -34 -160 -20 -120 L -60 -120 Z'), { fill: '$hair-20', stroke: null, clip: 'highpuff', ...H('highpuff', NOHAT) });
  P('highpuffHi', 'head', 70.43, path(shineBand(-8, -160, 22, 22, 225, 300, 6, [[0, 1]])), { fill: '$hair+28', stroke: null, clip: 'highpuff', ...H('highpuff', NOHAT) });
  P('bun', 'head', 70.4, ell(-22, -146, 27, 23, -10), { fill: '$hair', ...H('bun', NOHAT) });
  P('bunSh', 'head', 70.42, ell(-30, -138, 24, 15, -10), { fill: '$hair-20', stroke: null, clip: 'bun', ...H('bun', NOHAT) });
  P('bunSwirl', 'head', 70.43, path('M -36 -150 Q -22 -164 -6 -150 M -38 -140 Q -24 -150 -10 -140'), { fill: null, stroke: '$hair-30', lw: 2.2, ...H('bun', NOHAT) });
}

export function addHairFront(ctx) {
  const { P, rect, ell, path } = ctx;
  const H = (opt, extra = {}) => ({ slot: 'hair', option: opt, ...extra });
  const NOHAT = { unless: { headwear: COVER } };
  const HAT = { when: { headwear: COVER } };

  /** Skull cap with shade, shine and a final outline (so shading never eats the outline). */
  function cap(id, opt, d, o = {}) {
    const z = o.z ?? 70.5;
    const cond = o.cond || {};
    const shape = path(d);
    P(id, 'head', z, shape, { fill: o.fill || '$hair', stroke: null, ...(o.alpha ? { alpha: o.alpha } : {}), ...H(opt, cond) });
    if (o.shade !== false) P(`${id}Sh`, 'head', z + 0.02, path(o.shade || SH_BACK), { fill: o.shadeFill || '$hair-20', stroke: null, clip: id, ...H(opt, cond) });
    if (o.shade2) P(`${id}Sh2`, 'head', z + 0.03, path(o.shade2), { fill: o.shadeFill || '$hair-20', stroke: null, clip: id, ...H(opt, cond) });
    if (o.shine !== false) P(`${id}Hi`, 'head', z + 0.04, path(o.shine || SHINE), { fill: o.shineFill || '$hair+30', stroke: null, alpha: o.shineAlpha ?? 0.9, clip: id, ...H(opt, cond) });
    if (o.lines) P(`${id}Tx`, 'head', z + 0.05, path(o.lines), { fill: null, stroke: o.lineColor || '$hair-28', lw: o.linesLw || 2, clip: id, ...H(opt, cond) });
    if (o.outline !== false) P(`${id}Ln`, 'head', z + 0.08, shape, { fill: null, ...(o.lw ? { lw: o.lw } : {}), ...H(opt, cond) });
  }
  /** Lock / fringe in front (z 95). bone 'hair' for long locks that should sway. */
  function lock(id, opt, d, o = {}) {
    const bone = o.bone || 'head';
    const dd = bone === 'hair' ? HB(d) : d;
    P(id, bone, o.z ?? 95, path(dd), { fill: o.fill || '$hair', ...H(opt, o.cond || {}) });
    if (o.shade) P(`${id}Sh`, bone, (o.z ?? 95) + 0.05, path(bone === 'hair' ? HB(o.shade) : o.shade), { fill: o.shadeFill || '$hair-20', stroke: null, clip: id, ...H(opt, o.cond || {}) });
    if (o.shine) P(`${id}Hi`, bone, (o.z ?? 95) + 0.07, path(bone === 'hair' ? HB(o.shine) : o.shine), { fill: '$hair+30', stroke: null, alpha: 0.85, clip: id, ...H(opt, o.cond || {}) });
  }
  const ropes = (id, opt, bone, z, curves, w, o = {}) => {
    const conv = bone === 'hair' ? HB : (d) => d;
    const d = conv(curves.map(cubicD).join(' '));
    P(`${id}Ol`, bone, z, path(d), { fill: null, stroke: '$outline', lw: w + 6, ...H(opt, o.cond || {}) });
    P(id, bone, z + 0.01, path(d), { fill: null, stroke: o.color || '$hair', lw: w, ...H(opt, o.cond || {}) });
    if (o.tex !== false) P(`${id}Tx`, bone, z + 0.02, path(conv(curves.map((c) => ticks(c, w, o.n || 12)).join(' '))), { fill: null, stroke: '$hair-30', lw: 2, ...H(opt, o.cond || {}) });
    if (o.hi) P(`${id}Hi`, bone, z + 0.03, path(d), { fill: null, stroke: '$hair+30', lw: Math.max(1.5, w * 0.22), alpha: 0.55, ...H(opt, o.cond || {}) });
  };

  /** Plait on bone `hair` (sways) with chevrons, shade and a tie + tuft at the end. */
  function braid(id, opt, p, w, n) {
    const b = plait(p, w, n);
    P(id, 'hair', 95, path(HB(b.tube)), { fill: '$hair', ...H(opt) });
    P(`${id}Sh`, 'hair', 95.02, path(HB(plait(p.map(([x, y]) => [x - w * 0.32, y]), w * 0.55, n).tube)), { fill: '$hair-20', stroke: null, clip: id, ...H(opt) });
    P(`${id}Ch`, 'hair', 95.04, path(HB(b.chev)), { fill: null, stroke: '$hair-34', lw: 2.2, clip: id, ...H(opt) });
    const [ex, ey] = b.end;
    P(`${id}Tuft`, 'hair', 95.06, path(HB(`M ${f1(ex - 7)} ${f1(ey)} Q ${f1(ex - 10)} ${f1(ey + 16)} ${f1(ex - 3)} ${f1(ey + 26)} Q ${f1(ex)} ${f1(ey + 16)} ${f1(ex + 3)} ${f1(ey + 24)} Q ${f1(ex + 8)} ${f1(ey + 12)} ${f1(ex + 7)} ${f1(ey)} Z`)), { fill: '$hair', ...H(opt) });
    P(`${id}Tie`, 'hair', 95.08, path(HB(`M ${f1(ex - 8)} ${f1(ey - 6)} L ${f1(ex + 8)} ${f1(ey - 6)} L ${f1(ex + 7)} ${f1(ey + 3)} L ${f1(ex - 7)} ${f1(ey + 3)} Z`)), { fill: '$accent', lw: 2.5, ...H(opt) });
  }

  // ==== original ten ==============================================================================
  // short: soft crop with little forward tufts and sideburns
  cap('hair_short', 'short', crown(0) + ' Q 62 -100 58 -94 Q 54 -104 46 -108 Q 42 -100 36 -98 Q 34 -108 24 -112 C 4 -112 -16 -106 -27 -98 C -34 -93 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -48 -46 -54 -40 Z');

  // spiky: tall spikes (flattened to a crop under hats)
  const SPIKY = 'M -54 -40 C -64 -52 -72 -74 -70 -96 L -84 -108 L -66 -116 L -80 -138 L -54 -132 L -56 -160 L -30 -144 L -20 -172 L 0 -148 L 16 -174 L 26 -146 L 50 -164 L 50 -134 L 78 -140 L 66 -114 L 84 -110 L 68 -98 Q 60 -100 56 -94 Q 52 -104 44 -108 Q 40 -100 34 -98 Q 32 -108 22 -112 C 4 -112 -16 -106 -27 -98 C -34 -93 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -48 -46 -54 -40 Z';
  cap('hair_spiky', 'spiky', SPIKY, { cond: NOHAT, shine: shineBand(4, -92, 60, 58, 228, 296, 8) });
  cap('hair_spikyHat', 'spiky', crown(2) + ' L 74 -92 L 62 -100 L 56 -92 L 50 -106 L 40 -98 L 34 -110 C 4 -112 -16 -106 -27 -98 C -34 -93 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -48 -46 -54 -40 Z', { cond: HAT });

  // swoop: big side-swept quiff that falls toward the face front
  cap('hair_swoop', 'swoop', 'M -54 -40 C -64 -52 -72 -78 -70 -102 C -66 -134 -30 -154 12 -154 C 54 -154 82 -132 84 -104 C 86 -90 80 -80 72 -76 C 74 -88 68 -98 58 -102 C 46 -108 34 -110 20 -110 C 2 -109 -16 -105 -27 -98 C -34 -93 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -48 -46 -54 -40 Z',
    { cond: NOHAT, shine: shineBand(12, -100, 60, 46, 220, 320, 9), lines: 'M -20 -146 C 20 -150 60 -136 76 -100 M -40 -130 C 0 -140 40 -130 62 -104' });
  cap('hair_swoopHat', 'swoop', crown(0) + ' C 76 -90 74 -82 70 -78 C 70 -90 64 -98 56 -102 C 44 -108 34 -110 20 -110' + HAIRLINE.slice(HAIRLINE.indexOf(' C 2 -109')), { cond: HAT });

  // buzz: close crop that follows the skull; slightly see-through so it reads as short fuzz
  cap('hair_buzz', 'buzz', 'M -54 -42 C -62 -54 -66 -78 -63 -100 C -58 -124 -30 -136 6 -135 C 40 -134 62 -118 66 -100 C 54 -108 36 -112 20 -112 C 2 -111 -16 -107 -27 -100 C -33 -95 -35 -86 -34 -74 L -33 -64 L -40 -60 C -44 -52 -48 -46 -54 -42 Z',
    { alpha: 0.88, lw: 2.5, shadeFill: '$hair-14', shineAlpha: 0.45, shine: shineBand(4, -82, 50, 50, 230, 296, 6) });

  // bob: chin-length with straight bangs; covers the top of the ear
  cap('hair_bob', 'bob', 'M -64 -22 C -74 -50 -76 -84 -70 -108 C -62 -136 -30 -150 8 -149 C 50 -148 76 -126 76 -96 C 76 -86 74 -80 70 -78 C 66 -86 66 -96 64 -102 Q 58 -100 54 -104 Q 46 -101 40 -106 Q 30 -103 24 -108 Q 14 -104 6 -108 Q -4 -104 -10 -106 Q -18 -102 -24 -100 C -32 -94 -38 -82 -38 -66 C -38 -50 -36 -36 -32 -24 Q -46 -16 -64 -22 Z',
    { z: 71.5, shade: 'M -130 -200 L -26 -200 C -40 -160 -48 -110 -46 -70 C -44 -44 -40 -30 -30 -16 L -130 -16 Z', shine: shineBand(4, -92, 60, 52, 226, 296, 7, [[0, 0.74], [0.82, 1]]), lines: 'M -46 -70 C -50 -50 -48 -36 -44 -26 M -58 -80 C -64 -60 -62 -40 -56 -24' });

  // long: centre-ish part, long back layer, a lock over the near shoulder
  cap('hair_long', 'long', 'M -58 -40 C -68 -60 -74 -86 -70 -108 C -62 -136 -30 -150 8 -149 C 50 -148 76 -126 76 -96 C 76 -84 72 -74 68 -66 C 66 -82 60 -94 50 -100 C 36 -106 22 -110 8 -110 C 22 -104 30 -100 36 -96 C 18 -100 -6 -102 -22 -98 C -32 -94 -38 -86 -40 -74 L -50 -54 Z',
    { z: 71.5, shade: 'M -130 -200 L -26 -200 C -40 -160 -48 -110 -46 -70 L -130 -40 Z' });
  lock('hairLockLong', 'long', 'M -24 -98 C -40 -92 -46 -76 -46 -56 C -46 -20 -40 20 -36 50 Q -42 64 -52 70 Q -60 60 -62 44 C -64 10 -66 -30 -64 -60 C -62 -80 -50 -96 -24 -98 Z',
    { bone: 'hair', z: 95, shade: 'M -80 -100 L -54 -100 C -58 -60 -56 0 -48 80 L -80 80 Z' });

  // ponytail: sleek pulled-back cap (tail itself is on bone `tail`)
  cap('hair_ponytail', 'ponytail', 'M -56 -40 C -66 -56 -70 -80 -66 -104 C -60 -130 -30 -144 8 -143 C 46 -142 68 -122 70 -98 C 56 -108 38 -112 20 -111 C 2 -110 -16 -106 -27 -99 C -34 -94 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -50 -46 -56 -40 Z',
    { lines: 'M -14 -106 C -30 -118 -44 -112 -54 -100 M 20 -112 C 0 -128 -30 -132 -52 -110 M 40 -110 C 20 -136 -20 -144 -50 -118' });

  // bun: sleek cap + top bun (bun parts in addHairBack)
  cap('hair_bun', 'bun', 'M -56 -40 C -66 -56 -70 -80 -66 -104 C -60 -130 -30 -144 8 -143 C 46 -142 68 -122 70 -98 C 56 -108 38 -112 20 -111 C 2 -110 -16 -106 -27 -99 C -34 -94 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -50 -46 -56 -40 Z',
    { lines: 'M 10 -110 C 0 -126 -10 -134 -18 -138 M 34 -110 C 20 -128 4 -138 -8 -142 M -14 -104 C -26 -118 -30 -128 -30 -136' });

  // curly: bumpy cloud cap; under hats a tidier version
  cap('hair_curly', 'curly', bumpy(2, -88, 72, -194, 4, 12, 9) + ' Q 66 -88 60 -94 Q 52 -102 42 -100 Q 34 -110 22 -106 Q 10 -114 -2 -106 Q -14 -112 -24 -102 Q -36 -100 -38 -88 Q -36 -76 -40 -64 Q -52 -54 -62 -62 Q -70 -70 -68 -80 Z',
    { cond: NOHAT, shine: shineBand(2, -88, 54, 54, 232, 292, 7, [[0, 0.3], [0.38, 0.62], [0.7, 1]]), lines: 'M -30 -130 q 6 -6 12 0 M 10 -140 q 6 -6 12 0 M -50 -110 q 6 -6 12 0 M 34 -128 q 6 -6 12 0' });
  cap('hair_curlyHat', 'curly', bumpy(2, -80, 68, -194, 4, 12, 8) + ' Q 66 -88 60 -94 Q 52 -102 42 -100 Q 34 -110 22 -106 Q 10 -114 -2 -106 Q -14 -112 -24 -102 Q -36 -100 -38 -88 Q -36 -76 -40 -64 Q -52 -54 -62 -62 Q -70 -70 -68 -80 Z', { cond: HAT, shine: false });

  // bald: a soft scalp shine (head drawn by face.mjs)
  P('baldShine', 'head', 70.3, path(shineBand(6, -82, 50, 46, 226, 290, 9, [[0, 0.7], [0.8, 1]])), { fill: '#ffffff', stroke: null, alpha: 0.28, clip: 'head', when: { hair: ['bald', 'combover'] } });

  // ==== added styles ===============================================================================
  // pixie: cropped with wispy forward fringe and pointed sideburn
  cap('hair_pixie', 'pixie', crown(-1, -143) + ' L 74 -92 Q 66 -96 60 -92 L 62 -100 Q 52 -100 44 -96 L 48 -106 Q 36 -104 28 -102 L 30 -110 C 10 -112 -12 -108 -26 -100 C -32 -94 -34 -86 -33 -76 L -30 -56 L -38 -64 L -40 -58 C -44 -52 -48 -46 -54 -40 Z',
    { lines: 'M -30 -128 C 0 -134 30 -126 56 -104 M -48 -110 C -20 -124 10 -122 36 -108' });

  // undercut: faded sides + voluminous swept-back top
  const FADE = 'M -54 -42 C -62 -54 -66 -78 -63 -100 C -58 -124 -30 -136 6 -135 C 40 -134 62 -118 66 -100 C 54 -108 36 -112 20 -112 C 2 -111 -16 -107 -27 -100 C -33 -95 -35 -86 -34 -74 L -33 -64 L -40 -60 C -44 -52 -48 -46 -54 -42 Z';
  P('hairFade', 'head', 70.45, path(FADE), { fill: '$hair', alpha: 0.42, stroke: null, ...H(['undercut', 'mohawk', 'curlytop']) });
  cap('hair_undercut', 'undercut', 'M -62 -106 C -66 -128 -46 -146 -10 -150 C 20 -154 40 -168 66 -166 C 86 -164 94 -150 88 -136 C 84 -124 78 -112 70 -104 C 62 -110 46 -114 24 -114 C 2 -113 -18 -112 -34 -113 C -46 -112 -56 -108 -62 -106 Z',
    { cond: NOHAT, shade: 'M -100 -200 L -20 -200 C -30 -150 -30 -120 -20 -100 L -100 -100 Z', shine: shineBand(30, -112, 56, 44, 222, 300, 8, [[0, 0.7], [0.8, 1]]), lines: 'M 80 -142 C 50 -160 0 -150 -50 -124 M 70 -118 C 40 -140 0 -138 -44 -114 M 84 -130 C 50 -150 0 -144 -56 -116' });
  cap('hair_undercutHat', 'undercut', 'M -60 -100 C -62 -124 -30 -146 10 -146 C 50 -146 74 -128 72 -106 C 56 -110 38 -112 20 -112 C 2 -111 -16 -108 -30 -104 C -42 -104 -54 -104 -60 -100 Z', { cond: HAT, shine: false });

  // mohawk: shaved sides, tall crest along the midline
  P('hair_mohawk', 'head', 70.5, path('M 34 -112 L 52 -140 L 28 -136 L 34 -172 L 8 -152 L 0 -190 L -16 -156 L -36 -182 L -40 -148 L -64 -162 L -58 -130 L -76 -126 L -60 -104 C -48 -118 -26 -128 -2 -130 C 14 -128 28 -122 34 -112 Z'), { fill: '$hair', ...H('mohawk', NOHAT) });
  P('hair_mohawkSh', 'head', 70.52, path('M -100 -200 L -26 -200 L -16 -130 L -100 -100 Z'), { fill: '$hair-20', stroke: null, clip: 'hair_mohawk', ...H('mohawk', NOHAT) });
  P('hair_mohawkHi', 'head', 70.54, path('M 20 -150 C 6 -146 -12 -150 -26 -156 C -12 -152 6 -150 20 -152 Z M 28 -130 C 14 -136 -6 -140 -30 -138 C -6 -136 12 -134 28 -128 Z'), { fill: '$hair+30', stroke: null, alpha: 0.8, clip: 'hair_mohawk', ...H('mohawk', NOHAT) });
  P('hair_mohawkTx', 'head', 70.56, path('M -40 -136 C -30 -146 -20 -156 -14 -170 M -10 -132 C -2 -146 6 -158 12 -170 M 14 -128 C 22 -136 30 -142 40 -144'), { fill: null, stroke: '$hair-30', lw: 2, clip: 'hair_mohawk', ...H('mohawk', NOHAT) });
  P('hair_mohawkHat', 'head', 70.5, path('M 30 -112 C 24 -122 12 -130 -4 -132 C -30 -130 -50 -118 -62 -108 C -60 -124 -30 -140 0 -140 C 18 -138 28 -126 30 -112 Z'), { fill: '$hair', ...H('mohawk', HAT) });

  // afro: big round volume (squashed under hats)
  const AFRO = (r, cy) => bumpy(2, cy, r, 152, 368, 20, 5) + ' C 80 -92 72 -98 66 -100 C 50 -108 34 -112 18 -112 C 0 -111 -18 -106 -28 -98 C -36 -92 -38 -82 -38 -70 L -38 -56 C -44 -48 -54 -40 -62 -36 Z';
  cap('hair_afro', 'afro', AFRO(90, -104), { cond: NOHAT, shade: 'M -140 -200 L -30 -200 C -54 -150 -56 -100 -46 -50 L -140 -20 Z', shine: shineBand(2, -104, 74, 74, 230, 296, 9, [[0, 0.4], [0.5, 0.76], [0.84, 1]]),
    lines: 'M -40 -150 q 5 -5 10 0 M 0 -160 q 5 -5 10 0 M 36 -150 q 5 -5 10 0 M -62 -118 q 5 -5 10 0 M 56 -126 q 5 -5 10 0 M -20 -128 q 5 -5 10 0 M -66 -80 q 5 -5 10 0' });
  cap('hair_afroHat', 'afro', AFRO(76, -76), { cond: HAT, shine: false });

  // box braids: neat cap with parting grid + many braids (back braids in addHairBack)
  cap('hair_boxbraids', 'boxbraids', 'M -56 -40 C -66 -56 -70 -80 -66 -104 C -60 -130 -30 -144 8 -143 C 46 -142 68 -122 70 -98 C 56 -108 38 -112 20 -111 C 2 -110 -16 -106 -27 -99 C -34 -94 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -50 -46 -56 -40 Z',
    { lines: 'M 30 -112 C 10 -130 -20 -136 -48 -120 M 50 -106 C 30 -132 -10 -146 -60 -110 M 10 -110 C -10 -122 -30 -122 -50 -104 M 0 -142 L 4 -132 M -20 -140 L -16 -128 M -40 -132 L -34 -120 M 20 -138 L 22 -128 M -10 -122 L -8 -114 M -30 -118 L -28 -110' });
  ropes('braidsFront', 'boxbraids', 'hair', 95, [
    [[-34, -100], [-54, -84], [-58, -20], [-52, 62]],
    [[-42, -96], [-64, -74], [-68, -10], [-64, 66]],
  ], 9, { n: 13 });

  // cornrows: rows braided flat to the scalp, short tails at the nape
  P('hair_cornrows', 'head', 70.5, path(FADE), { fill: '$hair', alpha: 0.5, stroke: null, ...H('cornrows') });
  const ROWS = [];
  const STARTS = [[62, -104], [42, -110], [22, -112], [2, -110], [-16, -105], [-28, -96]];
  STARTS.forEach(([sx, sy], i) => {
    const k = i / (STARTS.length - 1);
    // over the skull toward the nape; near-side rows hug the side of the head
    ROWS.push([[sx, sy], [sx - 10 - k * 6, sy - 34 + k * 16], [-48 - k * 10, -138 + k * 54], [-60 + k * 6, -64 + k * 16]]);
  });
  ropes('cornrowRows', 'cornrows', 'head', 70.6, ROWS, 8, { n: 11, hi: true });
  ropes('cornrowTails', 'cornrows', 'hair', 5.4, [[[-58, -60], [-66, -40], [-66, -20], [-62, 4]], [[-50, -50], [-56, -30], [-56, -12], [-52, 10]]], 7, { n: 8 });

  // locs: rope-like locs; some fall in front of the near shoulder
  cap('hair_locs', 'locs', 'M -56 -40 C -66 -56 -72 -80 -68 -104 C -62 -132 -30 -148 8 -147 C 48 -146 70 -124 72 -98 C 58 -106 40 -110 22 -110 C 2 -110 -16 -106 -27 -99 C -34 -94 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -50 -46 -56 -40 Z',
    { lines: 'M 60 -104 C 50 -126 30 -140 0 -144 M 40 -110 C 30 -130 10 -142 -20 -142 M 20 -110 C 6 -128 -14 -138 -40 -134 M 0 -108 C -14 -124 -34 -128 -56 -118' });
  ropes('locsFront', 'locs', 'hair', 95, [
    [[-34, -100], [-54, -84], [-58, -30], [-54, 34]],
    [[-44, -94], [-66, -72], [-70, -20], [-68, 42]],
  ], 12, { n: 9, hi: true });

  // high puff and two puffs: sleek pulled-up caps
  const SLEEK = 'M -56 -40 C -66 -56 -70 -80 -66 -104 C -60 -130 -30 -144 8 -143 C 46 -142 68 -122 70 -98 C 56 -108 38 -112 20 -111 C 2 -110 -16 -106 -27 -99 C -34 -94 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -50 -46 -56 -40 Z';
  cap('hair_highpuff', 'highpuff', SLEEK, { lines: 'M 30 -112 C 20 -130 6 -140 0 -144 M 50 -106 C 36 -128 20 -138 10 -144 M -10 -106 C -20 -120 -24 -132 -26 -140 M -40 -98 C -48 -114 -48 -126 -44 -134' });
  P('highpuffBand', 'head', 70.6, path('M -36 -138 Q -8 -130 20 -140 L 20 -132 Q -8 -122 -36 -130 Z'), { fill: '$accent', ...H('highpuff', NOHAT) });
  cap('hair_twopuffs', 'twopuffs', SLEEK, { lines: 'M 4 -142 L 2 -112 M 30 -112 C 36 -126 40 -136 42 -140 M -14 -106 C -24 -122 -32 -134 -36 -140' });
  P('puffNear', 'head', 70.62, path(bumpy(-38, -140, 29, 0, 360, 12, 4.5)), { fill: '$hair', ...H('twopuffs', NOHAT) });
  P('puffNearSh', 'head', 70.63, path('M -90 -190 L -44 -190 C -54 -160 -54 -140 -40 -100 L -90 -100 Z'), { fill: '$hair-20', stroke: null, clip: 'puffNear', ...H('twopuffs', NOHAT) });
  P('puffNearHi', 'head', 70.64, path(shineBand(-38, -140, 18, 18, 230, 300, 5, [[0, 1]])), { fill: '$hair+28', stroke: null, ...H('twopuffs', NOHAT) });

  // pigtails: centre part, two tails (far one in addHairBack)
  cap('hair_pigtails', 'pigtails', SLEEK, { lines: 'M 6 -143 C 10 -128 14 -118 16 -110 M -8 -110 C -26 -114 -40 -104 -46 -96 M 30 -110 C 40 -114 48 -112 54 -106' });
  lock('pigtailNear', 'pigtails', 'M -50 -104 C -74 -106 -92 -88 -98 -64 C -104 -38 -100 -16 -90 2 C -90 -16 -86 -34 -76 -52 C -70 -66 -62 -78 -50 -88 Z', { bone: 'hair', z: 70.45, shade: 'M -120 -100 L -86 -100 C -94 -60 -92 -30 -86 10 L -120 10 Z', shine: 'M -80 -90 Q -92 -70 -94 -50 Q -86 -70 -76 -86 Z' });
  P('pigtailNearTie', 'hair', 70.6, path(HB(circ(-52, -96, 10))), { fill: '$accent', ...H('pigtails') });

  // braids: two plaits; near one falls over the shoulder
  cap('hair_braids', 'braids', SLEEK, { lines: 'M 6 -143 C 10 -128 14 -118 16 -110 M -8 -110 C -26 -114 -40 -104 -46 -96 M 30 -110 C 40 -114 48 -112 54 -106' });
  braid('braidNear', 'braids', [[-48, -84], [-66, -50], [-64, 10], [-52, 64]], 26, 9);

  // side braid: swept to the near side, one plait over the shoulder
  cap('hair_sidebraid', 'sidebraid', 'M -56 -40 C -66 -56 -72 -80 -68 -104 C -62 -134 -30 -148 8 -147 C 48 -146 72 -124 72 -98 C 66 -100 60 -104 52 -104 C 34 -112 12 -112 -4 -108 C -18 -104 -28 -98 -34 -90 C -38 -84 -40 -76 -40 -66 L -42 -58 C -46 -52 -50 -46 -56 -40 Z',
    { z: 71.5, lines: 'M 60 -104 C 30 -132 -20 -130 -50 -96 M 40 -108 C 10 -126 -24 -118 -44 -90' });
  braid('sideBraid', 'sidebraid', [[-44, -84], [-70, -50], [-52, 10], [-26, 66]], 30, 9);

  // long wavy: side part with a soft wave over the brow, wavy lock over the near shoulder
  cap('hair_longwavy', 'longwavy', 'M -58 -40 C -70 -60 -76 -86 -72 -108 C -64 -138 -30 -152 10 -151 C 52 -150 80 -128 80 -96 C 80 -82 76 -72 70 -64 C 70 -80 64 -92 54 -98 C 40 -106 24 -108 10 -106 C -4 -106 -18 -102 -28 -96 C -36 -90 -40 -82 -42 -72 L -50 -54 Z',
    { z: 71.5, shade: 'M -130 -200 L -26 -200 C -40 -160 -48 -110 -46 -70 L -130 -40 Z', lines: 'M 70 -88 C 60 -116 30 -132 -10 -132 M 54 -100 C 40 -116 20 -122 -6 -120' });
  lock('hairLockWavy', 'longwavy', 'M -28 -96 C -44 -90 -50 -74 -48 -56 C -46 -40 -56 -26 -50 -8 C -44 8 -52 24 -44 40 C -40 50 -46 60 -54 68 Q -64 62 -66 50 C -70 36 -60 22 -66 6 C -72 -10 -62 -24 -66 -42 C -70 -62 -62 -84 -28 -96 Z',
    { bone: 'hair', z: 95, shade: 'M -90 -100 L -58 -100 C -60 -60 -62 0 -58 80 L -90 80 Z' });

  // shoulder curls: medium curly volume
  cap('hair_shouldercurls', 'shouldercurls', bumpy(4, -96, 66, -200, 0, 12, 8) + ' Q 74 -88 66 -92 Q 58 -102 46 -100 Q 38 -110 24 -106 Q 12 -112 0 -104 Q -12 -110 -22 -100 Q -34 -98 -36 -86 Q -34 -74 -40 -62 L -50 -50 Z',
    { z: 71.5, shine: shineBand(4, -96, 50, 50, 232, 296, 7, [[0, 0.4], [0.5, 1]]) });
  lock('curlLock', 'shouldercurls', shiftX('M -30 -98 Q -46 -100 -48 -86 Q -58 -80 -54 -68 Q -62 -60 -58 -48 Q -66 -38 -60 -26 Q -66 -14 -58 -4 Q -62 8 -52 14 Q -50 24 -40 20 Q -30 22 -32 10 Q -24 2 -32 -8 Q -26 -18 -34 -28 Q -28 -40 -38 -50 Q -32 -60 -40 -70 Q -34 -84 -30 -98 Z', -12), { bone: 'hair', z: 95, shade: 'M -100 -100 L -58 -100 C -64 -60 -64 -30 -56 0 L -100 0 Z' });

  // man bun: slicked-back cap (bun in addHairBack)
  cap('hair_manbun', 'manbun', SLEEK, { lines: 'M 40 -110 C 20 -134 -20 -140 -54 -124 M 20 -110 C 0 -128 -30 -130 -56 -114 M 0 -108 C -20 -120 -40 -118 -56 -104' });

  // slicked back: high, glossy, combed lines
  cap('hair_slicked', 'slicked', 'M -56 -40 C -66 -56 -72 -82 -68 -106 C -62 -134 -28 -150 10 -149 C 48 -148 72 -130 74 -108 C 74 -102 70 -100 66 -102 C 52 -114 34 -118 18 -117 C 0 -116 -16 -110 -27 -101 C -34 -95 -36 -84 -35 -72 L -33 -62 L -40 -60 C -44 -52 -50 -46 -56 -40 Z',
    { shine: shineBand(6, -98, 58, 48, 220, 316, 10, [[0, 0.5], [0.6, 0.85], [0.9, 1]]), lines: 'M 66 -110 C 40 -140 -10 -146 -56 -118 M 50 -114 C 26 -134 -10 -138 -50 -110 M 30 -116 C 10 -128 -20 -130 -46 -100 M 70 -122 C 50 -146 10 -152 -36 -140' });

  // side part: classic, part on the near side, swept toward the face
  cap('hair_sidepart', 'sidepart', 'M -56 -40 C -66 -56 -72 -82 -68 -106 C -62 -134 -30 -150 6 -150 C 46 -150 74 -132 76 -106 C 76 -96 72 -90 66 -88 C 62 -98 54 -106 42 -108 C 26 -112 8 -112 -6 -110 C -18 -108 -26 -102 -30 -96 C -34 -90 -35 -82 -35 -72 L -33 -62 L -40 -60 C -44 -52 -50 -46 -56 -40 Z',
    { shine: shineBand(18, -104, 50, 40, 230, 310, 8), lines: 'M -24 -130 C 10 -150 50 -140 70 -110 M -18 -122 C 10 -136 40 -128 60 -104 M -30 -128 L -8 -114' });
  P('sidepartLine', 'head', 70.6, path('M -10 -112 C -18 -124 -26 -132 -32 -142'), { fill: null, stroke: '$hair-36', lw: 2.6, ...H('sidepart') });

  // comb-over: horseshoe of hair round the back and sides, a few strands combed over a bald crown
  cap('hair_combover', 'combover', 'M -56 -40 C -66 -56 -72 -84 -68 -104 C -66 -112 -62 -118 -56 -122 C -54 -110 -50 -100 -42 -96 C -36 -94 -34 -86 -34 -76 L -32 -62 L -40 -60 C -44 -52 -50 -46 -56 -40 Z',
    { shine: false, shade: 'M -120 -200 L -60 -200 C -64 -120 -60 -80 -48 -40 L -120 -40 Z', lines: 'M -60 -110 C -62 -90 -60 -70 -56 -56' });
  P('comboverStrands', 'head', 70.6, path('M -50 -118 C -30 -138 10 -140 44 -122 M -48 -112 C -26 -130 14 -132 50 -114 M -44 -106 C -20 -122 20 -124 54 -108'), { fill: null, stroke: '$hair', lw: 3, alpha: 0.9, ...H('combover') });

  // curly top: faded sides + springy curls on top
  cap('hair_curlytop', 'curlytop', bumpy(4, -112, 60, 190, 352, 13, 8) + ' Q 66 -108 60 -110 C 46 -114 30 -116 16 -114 C -6 -112 -24 -112 -40 -112 Q -54 -110 -56 -104 Z',
    { cond: NOHAT, shade: 'M -100 -200 L -14 -200 C -24 -160 -24 -130 -14 -100 L -100 -100 Z', shine: shineBand(8, -118, 40, 40, 236, 300, 6, [[0, 0.45], [0.55, 1]]),
      lines: 'M -16 -150 q 5 -6 10 0 M 16 -156 q 5 -6 10 0 M 40 -140 q 5 -6 10 0 M -32 -132 q 5 -6 10 0' });
  cap('hair_curlytopHat', 'curlytop', 'M -44 -110 C -40 -128 -10 -140 16 -140 C 40 -140 60 -128 62 -110 C 46 -114 30 -116 16 -114 C -6 -112 -24 -110 -44 -110 Z', { cond: HAT, shine: false });

  // bowl cut (kid): round dome, straight bangs, straight sides over the ear tops
  cap('hair_bowl', 'bowl', 'M -64 -66 C -74 -86 -74 -112 -64 -128 C -50 -146 -22 -154 8 -153 C 46 -152 74 -132 78 -100 L 76 -98 Q 72 -103 66 -102 L 62 -98 Q 56 -103 48 -104 L 44 -100 Q 36 -104 28 -105 L 24 -102 Q 14 -106 4 -106 L 0 -102 Q -10 -104 -20 -102 L -24 -98 Q -32 -96 -36 -88 L -38 -66 Q -50 -62 -64 -66 Z',
    { z: 71.5, shade: 'M -130 -200 L -26 -200 C -40 -160 -48 -110 -46 -60 L -130 -60 Z', shine: shineBand(6, -100, 56, 48, 222, 310, 9), lines: 'M -46 -68 L -46 -96 M -56 -68 L -58 -100 M 40 -104 L 44 -128 M 14 -106 L 14 -134' });

  // space buns: centre part, two twisted buns on top
  cap('hair_spacebuns', 'spacebuns', SLEEK, { lines: 'M 4 -142 L 2 -112 M 30 -112 C 36 -126 40 -136 42 -140 M -14 -106 C -24 -122 -32 -134 -36 -140' });
  P('spacebunNear', 'head', 70.62, ell(-36, -142, 24, 21, -8), { fill: '$hair', ...H('spacebuns', NOHAT) });
  P('spacebunNearSh', 'head', 70.63, ell(-42, -134, 20, 13, -8), { fill: '$hair-20', stroke: null, clip: 'spacebunNear', ...H('spacebuns', NOHAT) });
  P('spacebunSwirl', 'head', 70.64, path('M -52 -146 Q -38 -160 -22 -146 M -50 -138 Q -36 -148 -24 -136 M 26 -152 Q 40 -162 54 -150'), { fill: null, stroke: '$hair-30', lw: 2.2, ...H('spacebuns', NOHAT) });

  // hijab: fabric wrap that covers hair, ears and neck and frames the face (uses $accent)
  const HIJAB = 'M 72 -100 C 74 -132 46 -156 6 -156 C -36 -156 -74 -132 -78 -96 C -82 -60 -78 -24 -70 4 C -68 18 -72 30 -80 44 C -40 54 20 54 64 44 C 60 30 54 14 52 -4 C 48 -12 44 -14 42 -14 C 34 -6 24 -1 12 1 C -8 1 -26 -6 -36 -22 C -42 -36 -42 -56 -40 -72 C -38 -90 -30 -102 -14 -108 C 6 -114 30 -114 50 -108 C 60 -106 68 -102 72 -100 Z';
  P('hijab', 'head', 95, path(HIJAB), { fill: '$accent', ...H('hijab') });
  P('hijabSh', 'head', 95.05, path('M -140 -200 L -34 -200 C -54 -150 -60 -80 -56 -20 C -54 10 -40 30 -20 60 L -140 60 Z'), { fill: '$accent-18', stroke: null, clip: 'hijab', ...H('hijab') });
  P('hijabHi', 'head', 95.07, path(shineBand(4, -100, 60, 50, 232, 300, 7, [[0, 1]])), { fill: '$accent+28', stroke: null, alpha: 0.8, clip: 'hijab', ...H('hijab') });
  P('hijabFolds', 'head', 95.1, path('M -60 -100 C -64 -60 -60 -20 -50 20 M -16 6 C 10 20 40 18 56 6 M -50 -20 C -40 10 -10 26 20 30'), { fill: null, stroke: '$accent-30', lw: 2.2, clip: 'hijab', ...H('hijab') });
  P('hijabEdge', 'head', 95.12, path('M -14 -108 C 6 -114 30 -114 50 -108 C 60 -106 68 -102 72 -100'), { fill: null, stroke: '$accent+20', lw: 3, ...H('hijab') });

  // ==== headwear ===================================================================================
  const W = (opt, extra = {}) => ({ slot: 'headwear', option: opt, ...extra });
  // Lower edge of a crown-hugging hat: back above the ear → over the brows → front of forehead
  const BAND = 'C -40 -104 30 -118 74 -100';

  // beanie: knit dome, ribbed cuff, pom-pom
  P('beanie', 'head', 98, path('M -70 -80 C -76 -136 -34 -164 8 -162 C 52 -160 82 -134 78 -94 Z'), { fill: '$accent', ...W('beanie') });
  P('beanieSh', 'head', 98.02, path('M -100 -200 L -26 -200 C -44 -160 -48 -120 -40 -80 L -100 -80 Z'), { fill: '$accent-16', stroke: null, clip: 'beanie', ...W('beanie') });
  P('beanieRib', 'head', 98.04, path('M -36 -150 C -40 -130 -40 -110 -38 -96 M -10 -158 C -12 -136 -12 -116 -10 -104 M 18 -158 C 18 -136 18 -118 20 -108 M 46 -150 C 48 -132 48 -118 48 -106'), { fill: null, stroke: '$accent-22', lw: 2, clip: 'beanie', ...W('beanie') });
  P('beanieBand', 'head', 98.1, path('M -74 -96 C -40 -116 34 -128 82 -104 L 82 -86 C 34 -110 -40 -98 -72 -78 Z'), { fill: '$accent-12', ...W('beanie') });
  P('beanieBandRib', 'head', 98.12, path('M -60 -102 L -58 -86 M -40 -108 L -38 -92 M -18 -112 L -16 -97 M 4 -114 L 6 -100 M 26 -115 L 28 -102 M 48 -113 L 50 -101 M 68 -108 L 70 -96'), { fill: null, stroke: '$accent-30', lw: 2, ...W('beanie') });
  P('beaniePom', 'head', 98.2, path(bumpy(6, -166, 14, 0, 360, 10, 3)), { fill: '$accent+18', ...W('beanie') });

  // cap: crown, panel seam, brim forward, button
  P('capCrown', 'head', 98, path('M -68 -84 C -72 -136 -28 -156 8 -154 C 46 -152 72 -130 72 -98 ' + 'C 30 -112 -30 -104 -68 -84 Z'), { fill: '$accent', ...W('cap') });
  P('capSh', 'head', 98.02, path('M -100 -200 L -24 -200 C -42 -150 -44 -110 -34 -90 L -100 -80 Z'), { fill: '$accent-16', stroke: null, clip: 'capCrown', ...W('cap') });
  P('capSeam', 'head', 98.04, path('M 8 -154 C 20 -136 26 -120 28 -110 M 8 -154 C -10 -136 -20 -116 -22 -102'), { fill: null, stroke: '$accent-26', lw: 2, ...W('cap') });
  P('capBrim', 'head', 98.1, path('M 30 -112 C 60 -116 96 -108 114 -94 C 104 -86 74 -84 44 -94 C 38 -98 32 -104 30 -112 Z'), { fill: '$accent-14', ...W('cap') });
  P('capBrimSh', 'head', 98.12, path('M 40 -96 C 70 -88 100 -90 112 -94'), { fill: null, stroke: '$accent-30', lw: 2, ...W('cap') });
  P('capButton', 'head', 98.2, ell(8, -155, 7, 4), { fill: '$accent-16', ...W('cap') });

  // bow: ribbon bow on the back-top with tails
  P('bowTails', 'head', 98, path('M -32 -124 L -44 -96 L -36 -98 L -32 -90 L -28 -122 Z M -28 -124 L -14 -98 L -8 -104 L -2 -98 L -24 -124 Z'), { fill: '$accent-12', ...W('bow') });
  P('bowL', 'head', 98.05, path('M -30 -128 C -42 -140 -56 -154 -62 -142 C -66 -132 -60 -114 -30 -122 Z'), { fill: '$accent', ...W('bow') });
  P('bowR', 'head', 98.05, path('M -28 -128 C -14 -146 2 -156 6 -142 C 8 -130 0 -116 -28 -122 Z'), { fill: '$accent', ...W('bow') });
  P('bowFold', 'head', 98.08, path('M -36 -128 C -46 -136 -54 -140 -56 -136 M -22 -128 C -12 -136 -4 -140 0 -136'), { fill: null, stroke: '$accent-22', lw: 2, ...W('bow') });
  P('bowKnot', 'head', 98.1, path('M -36 -132 Q -29 -134 -22 -131 Q -20 -124 -22 -118 Q -29 -116 -36 -119 Q -38 -125 -36 -132 Z'), { fill: '$accent-14', ...W('bow') });

  // headband: across the top of the head, with a highlight
  P('headband', 'head', 98, path('M -64 -84 C -60 -130 -16 -150 20 -146 C 50 -142 70 -122 74 -102 L 64 -98 C 60 -118 44 -134 18 -136 C -14 -138 -50 -120 -54 -80 Z'), { fill: '$accent', ...W('headband') });
  P('headbandHi', 'head', 98.05, path('M -48 -112 C -36 -132 -8 -142 18 -140'), { fill: null, stroke: '$accent+35', lw: 2.5, ...W('headband') });

  // headphones: band over the top, near cup on the ear, far cup peeking at the front
  P('phonesCupF', 'head', 69, rect(58, -96, 16, 34, 7), { fill: '$accent-16', ...W('headphones') });
  P('phonesBand', 'head', 98, path('M -52 -80 C -60 -168 74 -170 66 -92'), { fill: null, stroke: '$outline', lw: 12, ...W('headphones') });
  P('phonesBandIn', 'head', 98.02, path('M -52 -80 C -60 -168 74 -170 66 -92'), { fill: null, stroke: '$accent-24', lw: 6, ...W('headphones') });
  P('phonesCup', 'head', 98.1, rect(-68, -86, 28, 44, 12), { fill: '$accent', ...W('headphones') });
  P('phonesCupHi', 'head', 98.12, rect(-62, -80, 8, 30, 4), { fill: '$accent+28', stroke: null, ...W('headphones') });

  // flower: five petals tucked above the ear
  const petals = [0, 72, 144, 216, 288].map((a) => {
    const r = (a * Math.PI) / 180, x = -36 + 13 * Math.cos(r), y = -122 + 13 * Math.sin(r);
    return circ(x, y, 9.5);
  }).join(' ');
  P('flowerLeaf', 'head', 97.9, path('M -40 -116 Q -60 -106 -66 -92 Q -48 -94 -40 -116 Z'), { fill: '#5fae5a', ...W('flower') });
  P('flowerPetals', 'head', 98, path(petals), { fill: '$accent', lw: 2.5, ...W('flower') });
  P('flowerCenter', 'head', 98.1, ell(-36, -122, 7, 7), { fill: '#ffd166', lw: 2.5, ...W('flower') });

  // fedora: pinched crown, dark band, curved brim
  const brim = (cx, cy, rx, ry, curl = 6) => `M ${cx - rx} ${cy} C ${cx - rx} ${cy - ry - curl} ${cx + rx} ${cy - ry - curl} ${cx + rx} ${cy} C ${cx + rx} ${cy + ry} ${cx - rx} ${cy + ry} ${cx - rx} ${cy} Z`;
  P('fedoraBrim', 'head', 98, path('M -82 -98 C -80 -130 96 -132 104 -104 C 108 -90 90 -86 70 -92 C 30 -100 -20 -96 -60 -84 C -76 -80 -84 -88 -82 -98 Z'), { fill: '$accent-10', ...W('fedora') });
  P('fedoraCrown', 'head', 98.05, path('M -58 -108 C -60 -136 -50 -162 -30 -170 C -14 -166 -4 -160 6 -164 C 20 -170 38 -168 50 -160 C 64 -146 66 -126 66 -108 C 30 -100 -20 -100 -58 -108 Z'), { fill: '$accent', ...W('fedora') });
  P('fedoraSh', 'head', 98.07, path('M -100 -200 L -26 -200 C -40 -160 -40 -130 -30 -100 L -100 -100 Z'), { fill: '$accent-16', stroke: null, clip: 'fedoraCrown', ...W('fedora') });
  P('fedoraDent', 'head', 98.08, path('M -14 -164 C -10 -150 -6 -140 2 -132'), { fill: null, stroke: '$accent-30', lw: 2.4, ...W('fedora') });
  P('fedoraBand', 'head', 98.1, path('M -58 -108 C -20 -100 30 -100 66 -108 L 66 -122 C 30 -114 -20 -114 -58 -122 Z'), { fill: '$accent-40', ...W('fedora') });

  // top hat: tall cylinder, band, brim
  P('tophatBrim', 'head', 98, path(brim(8, -102, 84, 12, 4)), { fill: '$accent-14', ...W('tophat') });
  P('tophat', 'head', 98.05, path('M -48 -110 L -52 -206 C -20 -216 36 -216 66 -206 L 62 -110 C 30 -102 -16 -102 -48 -110 Z'), { fill: '$accent', ...W('tophat') });
  P('tophatSh', 'head', 98.07, path('M -80 -240 L -26 -240 L -24 -100 L -80 -100 Z'), { fill: '$accent-16', stroke: null, clip: 'tophat', ...W('tophat') });
  P('tophatTop', 'head', 98.08, path('M -52 -206 C -20 -196 36 -196 66 -206 C 36 -216 -20 -216 -52 -206 Z'), { fill: '$accent-24', ...W('tophat') });
  P('tophatBand', 'head', 98.1, path('M -49 -132 C -16 -124 30 -124 63 -132 L 62 -112 C 30 -104 -16 -104 -48 -112 Z'), { fill: '$accent-42', ...W('tophat') });
  P('tophatHi', 'head', 98.12, path('M 46 -196 L 44 -140'), { fill: null, stroke: '$accent+30', lw: 4, alpha: 0.7, ...W('tophat') });

  // cowboy hat: dented crown, wide upturned brim
  P('cowboyBrim', 'head', 98, path('M -96 -120 C -90 -104 -70 -92 -40 -92 C 0 -96 60 -100 96 -106 C 118 -110 126 -126 120 -136 C 112 -120 90 -114 60 -116 C 20 -118 -20 -116 -60 -110 C -78 -108 -92 -112 -96 -120 Z'), { fill: '$accent-10', ...W('cowboy') });
  P('cowboyCrown', 'head', 98.05, path('M -52 -112 C -56 -140 -46 -168 -24 -172 C -10 -168 0 -160 12 -164 C 26 -170 46 -168 56 -156 C 68 -142 68 -124 66 -114 C 30 -108 -20 -106 -52 -112 Z'), { fill: '$accent', ...W('cowboy') });
  P('cowboySh', 'head', 98.07, path('M -100 -200 L -24 -200 C -36 -160 -36 -130 -26 -100 L -100 -100 Z'), { fill: '$accent-16', stroke: null, clip: 'cowboyCrown', ...W('cowboy') });
  P('cowboyDent', 'head', 98.08, path('M -8 -166 C -4 -152 0 -142 6 -136'), { fill: null, stroke: '$accent-30', lw: 2.4, ...W('cowboy') });
  P('cowboyBand', 'head', 98.1, path('M -52 -114 C -20 -108 30 -108 66 -116 L 66 -126 C 30 -118 -20 -118 -52 -124 Z'), { fill: '$accent-38', ...W('cowboy') });

  // bucket hat: soft crown, down-sloping brim
  P('bucketBrim', 'head', 98, path('M -80 -90 C -70 -116 -30 -122 8 -122 C 50 -122 88 -116 96 -94 C 98 -82 92 -78 84 -80 C 50 -92 -30 -88 -70 -74 C -80 -72 -84 -80 -80 -90 Z'), { fill: '$accent-10', ...W('bucket') });
  P('bucketCrown', 'head', 98.05, path('M -60 -110 C -62 -140 -32 -156 8 -156 C 48 -156 72 -140 70 -110 C 30 -118 -20 -118 -60 -110 Z'), { fill: '$accent', ...W('bucket') });
  P('bucketSh', 'head', 98.07, path('M -100 -200 L -24 -200 C -36 -160 -36 -130 -26 -100 L -100 -100 Z'), { fill: '$accent-16', stroke: null, clip: 'bucketCrown', ...W('bucket') });
  P('bucketStitch', 'head', 98.1, path('M -70 -86 C -30 -98 50 -102 88 -88 M -56 -118 C -20 -124 40 -124 66 -118'), { fill: null, stroke: '$accent-26', lw: 1.8, ...W('bucket') });

  // beret: flat disc tilted to the back, stem on top
  P('beret', 'head', 98, path('M -84 -110 C -88 -140 -40 -162 10 -160 C 54 -158 76 -140 70 -116 C 66 -102 40 -104 20 -108 C -10 -112 -40 -104 -60 -98 C -74 -94 -82 -100 -84 -110 Z'), { fill: '$accent', ...W('beret') });
  P('beretSh', 'head', 98.02, path('M -120 -120 C -60 -110 0 -116 80 -126 L 80 -90 L -120 -90 Z'), { fill: '$accent-18', stroke: null, clip: 'beret', ...W('beret') });
  P('beretHi', 'head', 98.04, path('M -40 -148 C -10 -158 30 -156 50 -146'), { fill: null, stroke: '$accent+28', lw: 3, ...W('beret') });
  P('beretStem', 'head', 98.1, path('M 6 -160 L 10 -172 L 14 -160 Z'), { fill: '$accent-14', ...W('beret') });

  // hard hat: dome with ridge, short brim all round
  P('hardhat', 'head', 98, path('M -66 -102 C -70 -146 -32 -168 8 -168 C 50 -168 78 -144 76 -106 Z'), { fill: '$accent', ...W('hardhat') });
  P('hardhatSh', 'head', 98.02, path('M -100 -200 L -26 -200 C -44 -160 -46 -130 -40 -100 L -100 -100 Z'), { fill: '$accent-16', stroke: null, clip: 'hardhat', ...W('hardhat') });
  P('hardhatRidge', 'head', 98.04, path('M -2 -166 C 2 -150 4 -130 4 -108 L 18 -108 C 18 -130 16 -150 12 -167 Z'), { fill: '$accent+16', ...W('hardhat') });
  P('hardhatBrim', 'head', 98.1, path('M -76 -98 C -60 -112 40 -116 94 -102 C 98 -96 96 -92 90 -92 C 40 -102 -40 -100 -72 -90 C -78 -90 -80 -94 -76 -98 Z'), { fill: '$accent-10', ...W('hardhat') });
  P('hardhatHi', 'head', 98.12, path('M -40 -146 C -24 -158 -8 -162 4 -163'), { fill: null, stroke: '$accent+40', lw: 3.5, alpha: 0.8, ...W('hardhat') });

  // crown: gold with points and jewels
  P('crown', 'head', 98, path('M -46 -116 L -54 -162 L -30 -136 L -14 -170 L 4 -138 L 24 -172 L 36 -138 L 58 -164 L 54 -116 C 20 -108 -16 -108 -46 -116 Z'), { fill: '#f2c14e', ...W('crown') });
  P('crownSh', 'head', 98.02, path('M -100 -200 L -26 -200 L -22 -100 L -100 -100 Z'), { fill: '#d39a2c', stroke: null, clip: 'crown', ...W('crown') });
  P('crownBand', 'head', 98.04, path('M -47 -118 C -14 -110 22 -110 55 -118 L 55 -130 C 22 -122 -14 -122 -48 -130 Z'), { fill: '#e2aa36', ...W('crown') });
  P('crownJewels', 'head', 98.1, path(circ(4, -124, 5) + ' ' + circ(-24, -124, 4) + ' ' + circ(32, -124, 4)), { fill: '$accent', lw: 2, ...W('crown') });
  P('crownTips', 'head', 98.12, path(circ(-54, -164, 4) + ' ' + circ(-14, -172, 4) + ' ' + circ(24, -174, 4) + ' ' + circ(58, -166, 4)), { fill: '#fff1b8', lw: 2, ...W('crown') });

  // wizard hat: tall bent cone with stars
  P('wizardBrim', 'head', 98, path(brim(6, -104, 92, 14, 6)), { fill: '$accent-14', ...W('wizard') });
  P('wizard', 'head', 98.05, path('M -56 -112 C -40 -150 -20 -200 6 -236 C 20 -250 44 -246 52 -232 C 40 -232 30 -224 26 -206 C 36 -170 52 -140 66 -112 C 30 -102 -20 -102 -56 -112 Z'), { fill: '$accent', ...W('wizard') });
  P('wizardSh', 'head', 98.07, path('M -100 -260 L 0 -260 C -12 -200 -24 -150 -20 -100 L -100 -100 Z'), { fill: '$accent-16', stroke: null, clip: 'wizard', ...W('wizard') });
  P('wizardStars', 'head', 98.1, path('M 20 -170 L 23 -162 L 31 -161 L 25 -156 L 27 -148 L 20 -152 L 13 -148 L 15 -156 L 9 -161 L 17 -162 Z M -14 -140 L -12 -135 L -7 -134 L -11 -131 L -10 -126 L -14 -128 L -18 -126 L -17 -131 L -21 -134 L -16 -135 Z M 40 -130 L 41 -126 L 45 -126 L 42 -123 L 43 -119 L 40 -121 L 37 -119 L 38 -123 L 35 -126 L 39 -126 Z'), { fill: '#ffe08a', lw: 1.8, ...W('wizard') });

  // witch hat: crooked cone, wide brim, buckle band
  P('witchBrim', 'head', 98, path('M -100 -104 C -90 -128 100 -132 112 -108 C 118 -94 90 -90 60 -94 C 20 -100 -30 -98 -70 -90 C -92 -86 -104 -94 -100 -104 Z'), { fill: '$accent-14', ...W('witch') });
  P('witch', 'head', 98.05, path('M -50 -112 C -40 -150 -30 -186 -10 -212 C 0 -226 -16 -240 -40 -244 C -6 -250 16 -232 18 -206 C 30 -170 50 -140 62 -114 C 30 -104 -20 -104 -50 -112 Z'), { fill: '$accent', ...W('witch') });
  P('witchSh', 'head', 98.07, path('M -100 -260 L -14 -260 C -20 -200 -28 -150 -24 -100 L -100 -100 Z'), { fill: '$accent-16', stroke: null, clip: 'witch', ...W('witch') });
  P('witchBand', 'head', 98.1, path('M -50 -114 C -20 -106 30 -106 62 -116 L 58 -130 C 30 -122 -20 -122 -46 -128 Z'), { fill: '$accent-40', ...W('witch') });
  P('witchBuckle', 'head', 98.12, rect(4, -128, 18, 16, 2), { fill: null, stroke: '#ffd166', lw: 3.5, ...W('witch') });

  // chef hat: pleated band and puffy top (fixed white)
  P('chefPuff', 'head', 98, path(bumpy(6, -178, 52, 150, 390, 9, 9) + ' L 56 -126 L -44 -122 Z'), { fill: '#f7f5f0', ...W('chef') });
  P('chefPuffSh', 'head', 98.02, path('M -100 -240 L -20 -240 C -34 -200 -32 -160 -24 -120 L -100 -120 Z'), { fill: '#dedad0', stroke: null, clip: 'chefPuff', ...W('chef') });
  P('chefBand', 'head', 98.05, path('M -60 -100 C -60 -114 -56 -124 -48 -132 C -10 -124 30 -124 64 -132 C 68 -124 70 -114 70 -104 C 30 -116 -20 -114 -60 -100 Z'), { fill: '#fbfaf6', ...W('chef') });
  P('chefPleats', 'head', 98.08, path('M -34 -126 L -36 -110 M -12 -124 L -12 -112 M 12 -124 L 12 -114 M 36 -126 L 38 -114'), { fill: null, stroke: '#cfcabe', lw: 2, ...W('chef') });

  // police / pilot peaked caps (fixed uniform colours)
  P('peakCrown', 'head', 98, path('M -66 -112 C -76 -140 -50 -158 10 -158 C 66 -158 90 -142 82 -120 C 76 -110 64 -108 60 -110 C 20 -116 -30 -114 -66 -112 Z'), { fill: '#27324e', ...W(['police', 'pilot']) });
  P('peakTopPilot', 'head', 98.02, path('M -80 -140 L 100 -140 L 100 -124 C 40 -132 -20 -132 -80 -124 Z'), { fill: '#f4f3ee', stroke: null, clip: 'peakCrown', ...W('pilot') });
  P('peakSh', 'head', 98.03, path('M -100 -200 L -30 -200 C -40 -160 -40 -130 -34 -100 L -100 -100 Z'), { fill: 'rgba(0,0,0,0.22)', stroke: null, clip: 'peakCrown', ...W(['police', 'pilot']) });
  P('peakBand', 'head', 98.05, path('M -62 -96 C -60 -104 -60 -110 -60 -116 C -20 -122 30 -122 66 -114 L 66 -102 C 30 -108 -20 -108 -62 -96 Z'), { fill: '#141a2a', ...W(['police', 'pilot']) });
  P('peakCord', 'head', 98.07, path('M -58 -108 C -20 -114 30 -114 64 -108'), { fill: null, stroke: '#e3b544', lw: 2.4, ...W('pilot') });
  P('peakVisor', 'head', 98.1, path('M 26 -104 C 56 -110 92 -104 100 -94 C 96 -86 70 -84 40 -92 C 32 -94 26 -98 26 -104 Z'), { fill: '#141a2a', ...W(['police', 'pilot']) });
  P('peakVisorHi', 'head', 98.12, path('M 44 -102 C 64 -104 82 -100 92 -96'), { fill: null, stroke: '#ffffff', lw: 2.4, alpha: 0.35, ...W(['police', 'pilot']) });
  P('policeBadge', 'head', 98.15, path('M 22 -142 L 26 -132 L 36 -132 L 28 -126 L 31 -116 L 22 -122 L 13 -116 L 16 -126 L 8 -132 L 18 -132 Z'), { fill: '#e3b544', lw: 2, ...W('police') });
  P('pilotWings', 'head', 98.15, path('M 22 -136 C 16 -142 4 -144 -6 -142 C 2 -138 10 -134 22 -130 C 34 -134 42 -138 50 -142 C 40 -144 28 -142 22 -136 Z'), { fill: '#e3b544', lw: 2, ...W('pilot') });

  // bandana: kerchief over the top, knot and tails at the back
  P('bandanaTails', 'head', 97.9, path('M -64 -98 C -80 -96 -92 -86 -96 -72 C -86 -78 -78 -82 -70 -84 Z M -66 -96 C -80 -86 -84 -72 -82 -60 C -74 -70 -70 -80 -64 -88 Z'), { fill: '$accent-12', ...W('bandana') });
  P('bandana', 'head', 98, path('M -68 -90 C -74 -136 -34 -158 8 -158 C 50 -158 78 -136 76 -100 C 40 -114 -30 -112 -68 -90 Z'), { fill: '$accent', ...W('bandana') });
  P('bandanaSh', 'head', 98.02, path('M -100 -200 L -30 -200 C -46 -160 -48 -120 -40 -90 L -100 -90 Z'), { fill: '$accent-16', stroke: null, clip: 'bandana', ...W('bandana') });
  P('bandanaDots', 'head', 98.04, path(circ(-30, -130, 3.5) + ' ' + circ(-2, -142, 3.5) + ' ' + circ(28, -138, 3.5) + ' ' + circ(52, -122, 3.5) + ' ' + circ(-48, -112, 3.5) + ' ' + circ(10, -120, 3.5) + ' ' + circ(-20, -114, 3.5) + ' ' + circ(40, -108, 3)), { fill: '#ffffff', stroke: null, alpha: 0.85, clip: 'bandana', ...W('bandana') });
  P('bandanaKnot', 'head', 98.1, ell(-66, -92, 9, 8), { fill: '$accent-8', ...W('bandana') });
}
