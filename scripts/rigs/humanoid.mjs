// Generator for src/assets/rigs/humanoid.json — a 3/4-view cartoon person.
//   node scripts/rigs/humanoid.mjs        (writes the JSON; tests check it is up to date)
//
// Conventions (character faces RIGHT; the renderer mirrors for left):
//   * y grows downward, rotation is in degrees, positive = clockwise.
//   * "N" = near side (closer to camera, screen-left), "F" = far side (forward, screen-right).
//   * Limbs point down (+y) at rest. For a down-pointing limb, negative rotation swings it FORWARD.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../src/assets/rigs/humanoid.json');

// ------------------------------------------------------------------------------------------
// Skeleton
// ------------------------------------------------------------------------------------------
const bones = [
  { id: 'root', parent: null, pos: [0, 0] },
  { id: 'hips', parent: 'root', pos: [0, -168] },
  { id: 'thighF', parent: 'hips', pos: [14, 4] },
  { id: 'shinF', parent: 'thighF', pos: [0, 78] },
  { id: 'footF', parent: 'shinF', pos: [0, 76] },
  { id: 'thighN', parent: 'hips', pos: [-16, 4] },
  { id: 'shinN', parent: 'thighN', pos: [0, 78] },
  { id: 'footN', parent: 'shinN', pos: [0, 76] },
  { id: 'torso', parent: 'hips', pos: [0, -4] },
  { id: 'armF', parent: 'torso', pos: [30, -104] },
  { id: 'foreF', parent: 'armF', pos: [0, 62] },
  { id: 'handF', parent: 'foreF', pos: [0, 56] },
  { id: 'armN', parent: 'torso', pos: [-34, -104] },
  { id: 'foreN', parent: 'armN', pos: [0, 64] },
  { id: 'handN', parent: 'foreN', pos: [0, 58] },
  { id: 'neck', parent: 'torso', pos: [4, -112] },
  { id: 'head', parent: 'neck', pos: [0, -12] },
  { id: 'gaze', parent: 'head', pos: [0, 0] },
  { id: 'lidN', parent: 'head', pos: [-10, -84], scale: [1, 0.06] },
  { id: 'lidF', parent: 'head', pos: [30, -82], scale: [1, 0.06] },
  { id: 'hair', parent: 'head', pos: [0, -70] },
  { id: 'tail', parent: 'head', pos: [-54, -96] },
];

// ------------------------------------------------------------------------------------------
// Slots (swappable parts). Characters pick options; moods and clips can override some.
// ------------------------------------------------------------------------------------------
const slots = {
  eyes: { default: 'open', options: ['open', 'happy', 'closed'] },
  brows: { default: 'neutral', options: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried'] },
  mouth: { default: 'rest', options: ['rest', 'smile', 'grin', 'sad', 'frown', 'mbp', 'ee', 'ah', 'oh', 'oo', 'fv', 'half', 'wow'] },
  lashes: { default: 'none', options: ['none', 'lashes'] },
  hair: { default: 'short', options: ['short', 'spiky', 'swoop', 'buzz', 'bob', 'long', 'ponytail', 'bun', 'curly', 'bald'] },
  facial: { default: 'none', options: ['none', 'stubble', 'mustache', 'beard'] },
  top: { default: 'tee', options: ['tee', 'longsleeve', 'hoodie', 'sweater', 'suit', 'overalls', 'dress'] },
  bottom: { default: 'pants', options: ['pants', 'shorts', 'skirt', 'bare'] },
  eyewear: { default: 'none', options: ['none', 'glasses', 'round', 'sunglasses'] },
  headwear: { default: 'none', options: ['none', 'beanie', 'cap', 'bow', 'headband', 'headphones', 'flower'] },
  handF: { default: 'open', options: ['open', 'fist', 'point'] },
  handN: { default: 'open', options: ['open', 'fist', 'point'] },
};

// ------------------------------------------------------------------------------------------
// Parts
// ------------------------------------------------------------------------------------------
const parts = [];
const P = (id, bone, z, shape, extra = {}) => parts.push({ id, bone, z, shape, ...extra });
const rect = (x, y, w, h, r = 0) => ({ type: 'rect', x, y, w, h, ...(r ? { r } : {}) });
const ell = (cx, cy, rx, ry, rot) => ({ type: 'ellipse', cx, cy, rx, ry, ...(rot ? { rot } : {}) });
const path = (d) => ({ type: 'path', d });
const NOSTROKE = { stroke: null };

const LONG_SLEEVES = ['longsleeve', 'hoodie', 'sweater', 'suit'];
const SHORT_SLEEVES = ['tee', 'overalls', 'dress'];

// ---- limbs ---------------------------------------------------------------------------------
function arm(side, z) {
  const A = 'arm' + side, F = 'fore' + side, H = 'hand' + side;
  P(`${A}Skin`, A, z, rect(-13, -12, 26, 78, 13), { fill: '$skin' });
  P(`${A}SkinShade`, A, z + 0.1, rect(-20, -20, 13, 100), { fill: '$skin-14', ...NOSTROKE, clip: `${A}Skin` });
  P(`${F}Skin`, F, z + 0.2, rect(-11, -6, 22, 64, 11), { fill: '$skin' });
  P(`${F}SkinShade`, F, z + 0.3, rect(-18, -10, 11, 80), { fill: '$skin-14', ...NOSTROKE, clip: `${F}Skin` });
  // sleeves
  P(`${A}SleeveShort`, A, z + 0.4, path('M -16 -14 L 16 -14 L 17 30 Q 0 35 -17 30 Z'), { fill: '$top', when: { top: SHORT_SLEEVES.filter((t) => t !== 'overalls') } });
  P(`${A}SleeveTee2`, A, z + 0.4, path('M -16 -14 L 16 -14 L 17 30 Q 0 35 -17 30 Z'), { fill: '$top2', when: { top: 'overalls' } });
  P(`${A}SleeveLong`, A, z + 0.4, rect(-15, -14, 30, 82, 14), { fill: '$top', when: { top: LONG_SLEEVES } });
  P(`${A}SleeveShade`, A, z + 0.45, rect(-22, -20, 14, 100), { fill: '$top-16', ...NOSTROKE, clip: `${A}SleeveLong`, when: { top: LONG_SLEEVES } });
  P(`${A}SleeveStripe`, A, z + 0.46, path('M -20 18 L 20 18 L 20 28 L -20 28 Z M -20 44 L 20 44 L 20 54 L -20 54 Z'), { fill: '$top2', ...NOSTROKE, clip: `${A}SleeveLong`, when: { top: 'sweater' } });
  P(`${F}SleeveLong`, F, z + 0.5, rect(-13, -8, 26, 58, 12), { fill: '$top', when: { top: LONG_SLEEVES } });
  P(`${F}SleeveShade`, F, z + 0.55, rect(-20, -12, 12, 80), { fill: '$top-16', ...NOSTROKE, clip: `${F}SleeveLong`, when: { top: LONG_SLEEVES } });
  P(`${F}SleeveStripe`, F, z + 0.56, path('M -20 12 L 20 12 L 20 22 L -20 22 Z'), { fill: '$top2', ...NOSTROKE, clip: `${F}SleeveLong`, when: { top: 'sweater' } });
  P(`${F}Cuff`, F, z + 0.6, rect(-14, 42, 28, 11, 5), { fill: '$top-10', when: { top: ['hoodie', 'sweater'] } });
  P(`${F}CuffShirt`, F, z + 0.6, rect(-13, 44, 26, 9, 3), { fill: '#f4f4f0', when: { top: 'suit' } });
  // hands (thumb toward the front = +x)
  P(`${H}Open`, H, z + 0.8, path('M -11 -4 C -14 6 -14 20 -6 26 C 0 30 8 28 11 20 C 14 10 12 0 8 -5 C 2 -8 -6 -8 -11 -4 Z'), { fill: '$skin', slot: H, option: 'open' });
  P(`${H}Thumb`, H, z + 0.85, ell(10, 6, 5.5, 9, -28), { fill: '$skin', slot: H, option: 'open' });
  P(`${H}Fist`, H, z + 0.8, rect(-11, -4, 23, 24, 10), { fill: '$skin', slot: H, option: ['fist', 'point'] });
  P(`${H}FistLine`, H, z + 0.82, path('M -3 4 L -3 14 M 4 4 L 4 14'), { lw: 2, slot: H, option: 'fist' });
  P(`${H}Finger`, H, z + 0.85, rect(2, 12, 9, 26, 4.5), { fill: '$skin', slot: H, option: 'point' });
}

function leg(side, z) {
  const T = 'thigh' + side, S = 'shin' + side, Ft = 'foot' + side;
  P(`${T}Skin`, T, z, rect(-15, -8, 30, 92, 15), { fill: '$skin' });
  P(`${S}Skin`, S, z + 0.1, rect(-13, -6, 26, 84, 12), { fill: '$skin' });
  P(`${S}SkinShade`, S, z + 0.15, rect(-20, -10, 11, 100), { fill: '$skin-14', ...NOSTROKE, clip: `${S}Skin` });
  P(`${T}Pants`, T, z + 0.2, rect(-17, -10, 34, 96, 15), { fill: '$bottom', when: { bottom: 'pants' } });
  P(`${T}PantsShade`, T, z + 0.25, rect(-24, -12, 14, 110), { fill: '$bottom-16', ...NOSTROKE, clip: `${T}Pants`, when: { bottom: 'pants' } });
  P(`${T}Shorts`, T, z + 0.2, path('M -18 -10 L 18 -10 L 20 46 Q 0 50 -20 46 Z'), { fill: '$bottom', when: { bottom: 'shorts' } });
  P(`${S}Pants`, S, z + 0.3, path('M -15 -8 L 15 -8 L 17 74 Q 0 78 -17 74 Z'), { fill: '$bottom', when: { bottom: 'pants' } });
  P(`${S}PantsShade`, S, z + 0.35, rect(-24, -12, 13, 100), { fill: '$bottom-16', ...NOSTROKE, clip: `${S}Pants`, when: { bottom: 'pants' } });
  P(`${Ft}Shoe`, Ft, z + 0.5, path('M -15 -12 C -10 -16 8 -16 13 -11 C 28 -9 40 -2 41 6 L 41 10 L -18 10 C -21 3 -20 -8 -15 -12 Z'), { fill: '$shoes' });
  P(`${Ft}Sole`, Ft, z + 0.55, rect(-24, 4, 70, 10), { fill: '$sole', ...NOSTROKE, clip: `${Ft}Shoe` });
  P(`${Ft}Lace`, Ft, z + 0.6, path('M 6 -10 L 14 -4 M 12 -8 L 19 -2'), { lw: 2.2 });
}

// Draw order (facing right): far arm, far leg, near leg, hips, torso, head, near arm.
arm('F', 10);
leg('F', 20);
leg('N', 30);

// ---- hips / bottoms ------------------------------------------------------------------------
P('pelvis', 'hips', 40, path('M -42 -10 C -20 -16 20 -16 40 -10 L 42 26 C 20 33 -20 33 -44 26 Z'), { fill: '$bottom', when: { bottom: ['pants', 'shorts'] } });
P('pelvisShade', 'hips', 40.1, rect(-60, -20, 26, 60), { fill: '$bottom-16', ...NOSTROKE, clip: 'pelvis', when: { bottom: ['pants', 'shorts'] } });
P('belt', 'hips', 40.2, path('M -44 -10 C -20 -15 20 -15 42 -10 L 42 -2 C 20 -7 -20 -7 -44 -2 Z'), { fill: '$bottom-30', when: { bottom: 'pants' }, unless: { top: ['overalls', 'dress'] } });
P('skirt', 'hips', 42, path('M -42 -12 L 40 -12 C 50 12 56 34 60 54 Q 0 66 -62 54 C -58 34 -52 12 -42 -12 Z'), { fill: '$bottom', when: { bottom: 'skirt' }, unless: { top: 'dress' } });
P('skirtShade', 'hips', 42.1, rect(-80, -20, 30, 100), { fill: '$bottom-16', ...NOSTROKE, clip: 'skirt', when: { bottom: 'skirt' }, unless: { top: 'dress' } });
P('dressSkirt', 'hips', 42, path('M -42 -14 L 40 -14 C 54 22 62 52 66 84 Q 0 98 -68 84 C -64 52 -56 22 -42 -14 Z'), { fill: '$top', when: { top: 'dress' } });
P('dressSkirtShade', 'hips', 42.1, rect(-90, -20, 34, 130), { fill: '$top-16', ...NOSTROKE, clip: 'dressSkirt', when: { top: 'dress' } });
P('dressHem', 'hips', 42.2, path('M -70 74 Q 0 88 70 74 L 70 100 L -70 100 Z'), { fill: '$top2', ...NOSTROKE, clip: 'dressSkirt', when: { top: 'dress' } });

// ---- torso / tops --------------------------------------------------------------------------
P('neck', 'neck', 48, rect(-11, -18, 24, 30, 6), { fill: '$skin' });
P('neckShade', 'neck', 48.1, path('M -14 -20 L 16 -20 L 16 -6 Q 0 0 -14 -10 Z'), { fill: '$skin-18', ...NOSTROKE, clip: 'neck' });
const TORSO = path('M -38 -116 C -16 -122 18 -122 38 -114 C 48 -108 50 -94 48 -78 L 42 -10 C 40 2 30 8 18 8 L -26 8 C -38 8 -44 0 -44 -12 L -50 -82 C -52 -100 -50 -112 -38 -116 Z');
P('torso', 'torso', 50, TORSO, { fill: '$top', unless: { top: 'overalls' } });
P('torsoTee2', 'torso', 50, TORSO, { fill: '$top2', when: { top: 'overalls' } });
P('torsoShade', 'torso', 50.1, path('M -70 -130 L -26 -130 Q -34 -60 -22 20 L -70 20 Z'), { fill: '$top-16', ...NOSTROKE, clip: 'torso', unless: { top: 'overalls' } });
P('torsoLight', 'torso', 50.15, ell(26, -88, 12, 26, -8), { fill: '#ffffff', alpha: 0.12, ...NOSTROKE, clip: 'torso', unless: { top: 'overalls' } });
P('neckline', 'torso', 50.3, ell(5, -119, 17, 11), { fill: '$skin', clip: 'torso', when: { top: ['tee', 'longsleeve', 'sweater', 'dress', 'overalls'] } });
P('necklineOveralls', 'torso', 50.3, ell(5, -119, 17, 11), { fill: '$skin', clip: 'torsoTee2', when: { top: 'overalls' } });
P('collarRib', 'torso', 50.35, path('M -13 -117 Q 5 -102 23 -117'), { stroke: '$top-22', lw: 4, when: { top: ['sweater', 'longsleeve'] } });
P('waistband', 'torso', 50.4, path('M -48 -6 L 46 -6 L 46 10 L -48 10 Z'), { fill: '$top-10', ...NOSTROKE, clip: 'torso', when: { top: ['sweater', 'hoodie'] } });
// sweater stripes
P('sweaterStripes', 'torso', 50.45, path('M -60 -84 L 60 -84 L 60 -72 L -60 -72 Z M -60 -54 L 60 -54 L 60 -42 L -60 -42 Z'), { fill: '$top2', ...NOSTROKE, clip: 'torso', when: { top: 'sweater' } });
// hoodie
P('hood', 'torso', 58, path('M -48 -110 C -54 -134 30 -140 42 -112 C 30 -104 -32 -100 -48 -110 Z'), { fill: '$top2' });
parts[parts.length - 1].when = { top: 'hoodie' };
P('hoodieStrings', 'torso', 50.5, path('M -2 -108 L -4 -80 M 14 -108 L 15 -82'), { stroke: '$top2', lw: 3, when: { top: 'hoodie' } });
P('hoodiePocket', 'torso', 50.5, path('M -26 -40 L 30 -40 L 36 -8 L -30 -8 Z'), { fill: '$top-8', when: { top: 'hoodie' } });
// suit
P('suitShirt', 'torso', 50.5, path('M -12 -122 L 24 -122 L 8 -60 Z'), { fill: '#f4f4f0', clip: 'torso', when: { top: 'suit' } });
P('suitTie', 'torso', 50.6, path('M 3 -114 L 13 -114 L 15 -104 L 18 -70 L 8 -60 L 0 -70 L 2 -104 Z'), { fill: '$top2', when: { top: 'suit' } });
P('suitLapels', 'torso', 50.7, path('M -14 -118 L 6 -60 M 26 -118 L 9 -60'), { lw: 3, when: { top: 'suit' } });
P('suitButtons', 'torso', 50.7, path('M 8 -44 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 M 9 -26 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'), { fill: '$top-30', ...NOSTROKE, when: { top: 'suit' } });
// overalls
P('overallsBib', 'torso', 50.5, path('M -28 -76 L 34 -76 L 38 10 L -34 10 Z'), { fill: '$bottom', when: { top: 'overalls' } });
P('overallsStraps', 'torso', 50.6, path('M -34 -116 L -24 -76 M 32 -114 L 28 -76'), { stroke: '$bottom', lw: 9, when: { top: 'overalls' } });
P('overallsButtons', 'torso', 50.7, path('M -24 -72 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 M 28 -72 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0'), { fill: '$accent', when: { top: 'overalls' } });
P('overallsPocket', 'torso', 50.6, rect(-8, -62, 26, 22, 4), { fill: '$bottom-10', when: { top: 'overalls' } });
// dress waist
P('dressSash', 'torso', 50.6, path('M -48 -18 L 46 -18 L 46 -4 L -48 -4 Z'), { fill: '$top2', ...NOSTROKE, clip: 'torso', when: { top: 'dress' } });

// ---- hair (behind head) --------------------------------------------------------------------
function bumpy(cx, cy, r, a0, a1, n, bump) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const am = ((a0 + ((a1 - a0) * (i - 0.5)) / n) * Math.PI) / 180;
    const c = [cx + (r + bump) * Math.cos(am), cy + (r + bump) * Math.sin(am)];
    d += ` Q ${c[0].toFixed(1)} ${c[1].toFixed(1)} ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  }
  return d;
}
const HAIR = { fill: '$hair' };
// hair bone sits at head (0,-70); back-hair shapes are written in head space then shifted by +70
const shiftY = (d, dy) => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${x} ${(+y + dy).toFixed(1).replace(/\.0$/, '')}`);
const HB = (d) => path(shiftY(d, 70));

P('hairBackBob', 'hair', 5, HB('M -70 -64 C -78 -120 -36 -150 8 -148 C 56 -146 80 -118 78 -72 C 78 -44 74 -20 66 -4 Q 0 8 -66 -4 C -74 -24 -74 -44 -70 -64 Z'), { ...HAIR, slot: 'hair', option: 'bob' });
P('hairBackLong', 'hair', 5, HB('M -70 -64 C -78 -120 -36 -150 8 -148 C 56 -146 80 -118 78 -72 C 80 -30 78 10 72 44 Q 52 58 32 46 L -40 46 Q -62 58 -76 44 C -82 4 -76 -30 -70 -64 Z'), { ...HAIR, slot: 'hair', option: 'long' });
P('hairBackLongShade', 'hair', 5.1, HB('M -90 -40 L -40 -40 Q -48 10 -40 70 L -90 70 Z'), { fill: '$hair-18', ...NOSTROKE, clip: 'hairBackLong', slot: 'hair', option: 'long' });
P('hairBackCurly', 'hair', 5, HB(bumpy(2, -96, 82, -200, 20, 15, 12) + ' Q 30 -20 2 -16 Q -30 -20 -76 -64 Z'), { ...HAIR, slot: 'hair', option: 'curly' });
P('ponytail', 'tail', 5, path('M 4 -6 C -20 -2 -36 20 -38 50 C -40 80 -28 102 -14 110 C -20 84 -14 52 0 26 C 8 12 12 2 4 -6 Z'), { ...HAIR, slot: 'hair', option: 'ponytail' });
P('ponytailTie', 'tail', 5.2, ell(2, -2, 9, 7, -20), { fill: '$accent', slot: 'hair', option: 'ponytail' });
P('bun', 'head', 65, ell(-24, -138, 25, 22), { ...HAIR, slot: 'hair', option: 'bun' });
P('bunShade', 'head', 65.1, ell(-30, -132, 22, 14), { fill: '$hair-18', ...NOSTROKE, clip: 'bun', slot: 'hair', option: 'bun' });

// ---- head ----------------------------------------------------------------------------------
const HEAD = path('M 6 -130 C 46 -130 66 -104 66 -70 C 66 -46 60 -28 46 -14 C 36 -4 24 1 12 1 C -14 1 -40 -10 -52 -30 C -62 -46 -62 -60 -60 -76 C -56 -108 -32 -130 6 -130 Z');
P('head', 'head', 70, HEAD, { fill: '$skin' });
P('headShade', 'head', 70.1, path('M -80 -140 L -36 -140 C -48 -100 -46 -40 -20 10 L -80 10 Z'), { fill: '$skin-10', ...NOSTROKE, clip: 'head' });
P('jawShade', 'head', 70.15, path('M -40 -12 C -10 6 30 8 60 -20 L 70 10 L -60 10 Z'), { fill: '$skin-12', ...NOSTROKE, clip: 'head' });
P('ear', 'head', 71, ell(-50, -62, 11, 15, -8), { fill: '$skin' });
P('earInner', 'head', 71.1, path('M -47 -70 Q -55 -62 -48 -54'), { lw: 2.5 });
P('stubble', 'head', 72, path('M -44 -40 C -34 -8 0 6 16 4 C 34 2 54 -10 64 -38 L 64 -50 C 44 -38 34 -42 24 -42 C 12 -42 0 -40 -16 -42 C -28 -44 -38 -46 -44 -40 Z'), { fill: '$hair', alpha: 0.28, ...NOSTROKE, clip: 'head', slot: 'facial', option: 'stubble' });
P('cheekN', 'head', 73, ell(-22, -42, 11, 7), { fill: '$blush', alpha: 0.35, ...NOSTROKE });
P('cheekF', 'head', 73, ell(46, -43, 7, 6), { fill: '$blush', alpha: 0.35, ...NOSTROKE, clip: 'head' });

// eyes
const EYE_N = ell(-10, -66, 13.5, 16.5), EYE_F = ell(30, -65.5, 10.5, 15.5);
P('eyeWhiteN', 'head', 80, EYE_N, { fill: '#ffffff', ...NOSTROKE, slot: 'eyes', option: 'open' });
P('eyeWhiteF', 'head', 80, EYE_F, { fill: '#ffffff', ...NOSTROKE, slot: 'eyes', option: 'open' });
P('irisN', 'gaze', 81, ell(-7, -64, 8.5, 10), { fill: '$eye', ...NOSTROKE, clip: 'eyeWhiteN', slot: 'eyes', option: 'open' });
P('irisF', 'gaze', 81, ell(33, -64, 6.5, 9.5), { fill: '$eye', ...NOSTROKE, clip: 'eyeWhiteF', slot: 'eyes', option: 'open' });
P('pupilN', 'gaze', 82, ell(-6.5, -64, 4.5, 5.5), { fill: '#16161c', ...NOSTROKE, clip: 'eyeWhiteN', slot: 'eyes', option: 'open' });
P('pupilF', 'gaze', 82, ell(33.5, -64, 3.5, 5.2), { fill: '#16161c', ...NOSTROKE, clip: 'eyeWhiteF', slot: 'eyes', option: 'open' });
P('glintN', 'gaze', 83, ell(-10, -68.5, 2.8, 2.8), { fill: '#ffffff', ...NOSTROKE, clip: 'eyeWhiteN', slot: 'eyes', option: 'open' });
P('glintF', 'gaze', 83, ell(30.5, -68.5, 2.2, 2.4), { fill: '#ffffff', ...NOSTROKE, clip: 'eyeWhiteF', slot: 'eyes', option: 'open' });
P('lidN', 'lidN', 84, rect(-17, -1, 34, 38), { fill: '$skin-6', lw: 3, clip: 'eyeWhiteN', slot: 'eyes', option: 'open' });
P('lidF', 'lidF', 84, rect(-13, -1, 26, 36), { fill: '$skin-6', lw: 3, clip: 'eyeWhiteF', slot: 'eyes', option: 'open' });
P('eyeLineN', 'head', 85, EYE_N, { fill: null, lw: 3, slot: 'eyes', option: 'open' });
P('eyeLineF', 'head', 85, EYE_F, { fill: null, lw: 3, slot: 'eyes', option: 'open' });
P('lashTopN', 'head', 85.5, path('M -23.5 -66 A 13.5 16.5 0 0 1 3.5 -66'), { lw: 4.6, slot: 'eyes', option: 'open' });
P('lashTopF', 'head', 85.5, path('M 19.5 -65.5 A 10.5 15.5 0 0 1 40.5 -65.5'), { lw: 4.2, slot: 'eyes', option: 'open' });
P('lashesN', 'head', 85.6, path('M -22 -74 L -30 -79 M -19 -79 L -26 -86'), { lw: 3, when: { lashes: 'lashes', eyes: 'open' } });
P('lashesF', 'head', 85.6, path('M 39 -74 L 45 -79 M 37 -79 L 42 -85'), { lw: 2.6, when: { lashes: 'lashes', eyes: 'open' } });
P('eyeHappyN', 'head', 85, path('M -23 -62 Q -10 -80 3 -62'), { lw: 4.5, slot: 'eyes', option: 'happy' });
P('eyeHappyF', 'head', 85, path('M 20 -62 Q 30 -78 40 -62'), { lw: 4.2, slot: 'eyes', option: 'happy' });
P('eyeClosedN', 'head', 85, path('M -23 -64 Q -10 -54 3 -64'), { lw: 4.5, slot: 'eyes', option: 'closed' });
P('eyeClosedF', 'head', 85, path('M 20 -64 Q 30 -55 40 -64'), { lw: 4.2, slot: 'eyes', option: 'closed' });

// nose
P('nose', 'head', 87, path('M 44 -60 C 54 -50 54 -44 46 -40 C 43 -38 40 -39 38 -41'), { fill: '$skin-8', lw: 3 });

// facial hair (under the mouth so lips stay readable)
P('beard', 'head', 88, path('M -46 -48 C -44 -12 -12 14 16 12 C 42 10 60 -12 64 -46 C 58 -36 50 -24 42 -20 C 38 -32 30 -36 22 -36 C 12 -36 6 -30 4 -20 C -14 -22 -34 -32 -46 -48 Z'), { ...HAIR, slot: 'facial', option: 'beard' });
P('mustache', 'head', 89, path('M 6 -36 Q 22 -45 39 -36 Q 42 -29 34 -30 Q 22 -35 12 -30 Q 3 -29 6 -36 Z'), { ...HAIR, slot: 'facial', option: ['mustache', 'beard'] });

// mouths
const MOUTH = { fill: '#5b2330' };
function openMouth(id, d, opts = {}) {
  P(id, 'head', 90, path(d), { ...MOUTH, slot: 'mouth', option: id.replace('mouth_', '') });
  if (opts.teethTop) P(`${id}TeethT`, 'head', 90.1, rect(0, -42, 50, opts.teethTop), { fill: '#ffffff', ...NOSTROKE, clip: id, slot: 'mouth', option: id.replace('mouth_', '') });
  if (opts.teethBot) P(`${id}TeethB`, 'head', 90.1, rect(0, opts.teethBot, 50, 20), { fill: '#ffffff', ...NOSTROKE, clip: id, slot: 'mouth', option: id.replace('mouth_', '') });
  if (opts.tongue) P(`${id}Tongue`, 'head', 90.2, ell(opts.tongue[0], opts.tongue[1], opts.tongue[2], opts.tongue[3]), { fill: '#e0717d', ...NOSTROKE, clip: id, slot: 'mouth', option: id.replace('mouth_', '') });
}
const lineMouth = (opt, d, lw = 3.6) => P(`mouth_${opt}`, 'head', 90, path(d), { lw, slot: 'mouth', option: opt });
lineMouth('rest', 'M 11 -28 Q 22 -25 33 -29');
lineMouth('smile', 'M 7 -33 Q 21 -17 37 -34', 4);
lineMouth('sad', 'M 9 -21 Q 22 -33 35 -22', 3.8);
lineMouth('frown', 'M 10 -25 Q 22 -31 34 -24', 4.2);
lineMouth('mbp', 'M 10 -28 Q 22 -27 33 -29', 4.8);
openMouth('mouth_grin', 'M 5 -35 Q 22 -31 38 -36 Q 35 -14 21 -13 Q 7 -14 5 -35 Z', { teethTop: 8, tongue: [21, -14, 10, 6] });
openMouth('mouth_ee', 'M 7 -33 Q 22 -35 36 -33 Q 33 -21 22 -21 Q 10 -21 7 -33 Z', { teethTop: 6, teethBot: -25 });
openMouth('mouth_ah', 'M 10 -35 Q 22 -38 34 -35 Q 35 -15 22 -11 Q 9 -15 10 -35 Z', { teethTop: 5, tongue: [22, -13, 9, 6] });
openMouth('mouth_oh', 'M 22 -37 C 30 -37 32 -30 32 -26 C 32 -20 28 -15 22 -15 C 15 -15 12 -20 12 -26 C 12 -31 15 -37 22 -37 Z', { tongue: [22, -16, 7, 4] });
openMouth('mouth_oo', 'M 23 -33 C 28 -33 30 -30 30 -27 C 30 -23 27 -20 23 -20 C 19 -20 16 -23 16 -27 C 16 -30 18 -33 23 -33 Z');
openMouth('mouth_fv', 'M 9 -32 Q 22 -34 34 -32 Q 32 -23 22 -23 Q 12 -23 9 -32 Z', { teethTop: 7 });
openMouth('mouth_half', 'M 11 -31 Q 22 -33 33 -31 Q 31 -24 22 -24 Q 13 -24 11 -31 Z', { teethTop: 3 });
openMouth('mouth_wow', 'M 22 -40 C 31 -40 34 -32 34 -25 C 34 -17 29 -11 22 -11 C 14 -11 10 -17 10 -25 C 10 -32 13 -40 22 -40 Z', { tongue: [22, -12, 8, 5] });

// brows: generated tapered shapes; inner end is toward the nose (+x for N, -x for F)
function brow(outer, inner, arch, tIn, tOut) {
  const mx = (outer[0] + inner[0]) / 2, my = (outer[1] + inner[1]) / 2 + arch;
  return `M ${outer[0]} ${outer[1]} Q ${mx} ${my} ${inner[0]} ${inner[1]} L ${inner[0]} ${inner[1] + tIn} Q ${mx} ${my + (tIn + tOut) / 2 + 1} ${outer[0]} ${outer[1] + tOut} Z`;
}
const BROWS = {
  neutral: { o: -90, i: -93, a: -5 },
  happy: { o: -93, i: -97, a: -9 },
  sad: { o: -86, i: -99, a: -2 },
  angry: { o: -97, i: -84, a: 2 },
  surprised: { o: -101, i: -104, a: -9 },
  worried: { o: -89, i: -100, a: -4 },
};
for (const [k, b] of Object.entries(BROWS)) {
  P(`browN_${k}`, 'head', 93, path(brow([-26, b.o], [4, b.i], b.a, 6.5, 4)), { fill: '$brow', ...NOSTROKE, slot: 'brows', option: k });
  P(`browF_${k}`, 'head', 93, path(brow([42, b.o + 1], [20, b.i + 1], b.a * 0.8, 5.5, 3.5)), { fill: '$brow', ...NOSTROKE, slot: 'brows', option: k });
}

// ---- hair (front) --------------------------------------------------------------------------
const HF = (opt, d, extra = {}) => P(`hair_${opt}`, 'head', 95, path(d), { ...HAIR, slot: 'hair', option: opt, ...extra });
const SHORT = 'M -62 -70 C -66 -118 -30 -142 10 -140 C 48 -138 70 -112 68 -86 C 56 -100 40 -104 26 -100 C 18 -110 0 -112 -14 -104 C -30 -100 -42 -96 -48 -78 C -52 -80 -58 -76 -62 -70 Z';
HF('short', SHORT);
HF('spiky', 'M -62 -70 L -72 -104 L -52 -108 L -58 -138 L -32 -126 L -24 -154 L -2 -134 L 14 -156 L 26 -134 L 50 -148 L 50 -120 L 74 -122 L 66 -96 L 74 -86 C 56 -98 40 -102 26 -98 C 12 -108 -20 -106 -36 -96 C -44 -90 -48 -84 -50 -76 Z');
HF('swoop', 'M -62 -68 C -68 -122 -26 -146 16 -142 C 56 -138 76 -110 72 -78 C 66 -72 58 -74 52 -80 C 42 -96 20 -104 -6 -100 C -24 -98 -40 -92 -50 -76 Z');
HF('buzz', 'M -60 -72 C -64 -116 -30 -136 8 -134 C 44 -132 64 -110 64 -88 C 50 -98 30 -102 10 -102 C -20 -100 -40 -96 -50 -80 Z', { alpha: 0.82, lw: 2.5 });
HF('bob', 'M -60 -76 C -64 -122 -28 -144 12 -142 C 52 -140 72 -114 72 -82 C 62 -92 50 -94 44 -92 C 40 -100 30 -104 22 -102 C 14 -106 2 -106 -6 -100 C -20 -104 -40 -98 -52 -80 Z');
HF('long', 'M -60 -76 C -64 -122 -28 -144 12 -142 C 52 -140 74 -114 72 -80 C 66 -88 58 -96 46 -98 C 30 -102 20 -108 4 -106 C -14 -104 -36 -98 -52 -80 Z');
HF('ponytail', 'M -64 -72 C -68 -120 -30 -142 10 -140 C 50 -138 70 -112 68 -88 C 54 -100 36 -104 18 -104 C -6 -104 -30 -100 -48 -84 C -54 -82 -60 -78 -64 -72 Z');
HF('bun', 'M -62 -74 C -66 -120 -30 -140 10 -138 C 50 -136 70 -112 68 -88 C 54 -100 36 -104 18 -104 C -6 -104 -30 -100 -48 -86 C -54 -82 -60 -80 -62 -74 Z');
HF('curly', bumpy(2, -84, 70, -192, 2, 11, 9) + ' Q 66 -86 58 -92 Q 50 -100 40 -98 Q 32 -108 20 -104 Q 10 -112 -2 -104 Q -14 -110 -24 -100 Q -38 -104 -44 -92 Q -56 -90 -62 -76 Z');
P('hairShine', 'head', 95.5, path('M -20 -128 Q 8 -138 34 -128'), { stroke: '#ffffff', lw: 5, alpha: 0.22, when: { hair: ['short', 'swoop', 'bob', 'long', 'ponytail', 'bun'] } });
P('sideburn', 'head', 95.2, path('M -50 -82 L -44 -82 L -46 -58 L -52 -60 Z'), { ...HAIR, ...NOSTROKE, when: { hair: ['short', 'spiky', 'swoop', 'buzz'] } });

// ---- eyewear / headwear ---------------------------------------------------------------------
const FRAME = { stroke: '$frame', lw: 4.2 };
P('glassesLensN', 'head', 97, rect(-28, -79, 36, 27, 9), { fill: 'rgba(255,255,255,0.18)', ...FRAME, slot: 'eyewear', option: 'glasses' });
P('glassesLensF', 'head', 97, rect(17, -78, 26, 26, 8), { fill: 'rgba(255,255,255,0.18)', ...FRAME, slot: 'eyewear', option: 'glasses' });
P('roundLensN', 'head', 97, ell(-10, -66, 18, 17), { fill: 'rgba(255,255,255,0.18)', ...FRAME, slot: 'eyewear', option: 'round' });
P('roundLensF', 'head', 97, ell(30, -66, 13, 16), { fill: 'rgba(255,255,255,0.18)', ...FRAME, slot: 'eyewear', option: 'round' });
P('sunLensN', 'head', 97, path('M -30 -80 L 9 -80 Q 9 -54 -10 -54 Q -30 -54 -30 -80 Z'), { fill: '#1d2230', stroke: '$frame', lw: 4, slot: 'eyewear', option: 'sunglasses' });
P('sunLensF', 'head', 97, path('M 17 -79 L 44 -79 Q 44 -55 30 -55 Q 17 -55 17 -79 Z'), { fill: '#1d2230', stroke: '$frame', lw: 4, slot: 'eyewear', option: 'sunglasses' });
P('sunGlint', 'head', 97.1, path('M -22 -74 L -14 -74 M 22 -74 L 28 -74'), { stroke: '#ffffff', lw: 3, alpha: 0.6, slot: 'eyewear', option: 'sunglasses' });
P('glassesBridge', 'head', 97.2, path('M 8 -68 Q 13 -72 17 -68'), { ...FRAME, slot: 'eyewear', option: ['glasses', 'round', 'sunglasses'] });
P('glassesArm', 'head', 97.2, path('M -28 -70 L -48 -66'), { ...FRAME, slot: 'eyewear', option: ['glasses', 'round', 'sunglasses'] });

P('beanie', 'head', 98, path('M -66 -84 C -70 -138 -30 -160 8 -158 C 48 -156 78 -134 74 -90 Z'), { fill: '$accent', slot: 'headwear', option: 'beanie' });
P('beanieBand', 'head', 98.1, path('M -70 -98 Q 4 -110 78 -96 L 78 -78 Q 4 -92 -70 -80 Z'), { fill: '$accent-14', slot: 'headwear', option: 'beanie' });
P('beaniePom', 'head', 98.2, ell(4, -162, 14, 13), { fill: '$accent+18', slot: 'headwear', option: 'beanie' });
P('capCrown', 'head', 98, path('M -64 -86 C -66 -138 -24 -152 10 -150 C 46 -148 70 -126 70 -92 Z'), { fill: '$accent', slot: 'headwear', option: 'cap' });
P('capBrim', 'head', 98.1, path('M 38 -96 Q 86 -98 108 -86 Q 88 -78 38 -84 Z'), { fill: '$accent-16', slot: 'headwear', option: 'cap' });
P('capButton', 'head', 98.2, ell(6, -150, 6, 4), { fill: '$accent-16', slot: 'headwear', option: 'cap' });
P('bowL', 'head', 98, path('M -30 -126 L -58 -146 L -56 -108 Z'), { fill: '$accent', slot: 'headwear', option: 'bow' });
P('bowR', 'head', 98, path('M -30 -126 L -4 -148 L -6 -108 Z'), { fill: '$accent', slot: 'headwear', option: 'bow' });
P('bowKnot', 'head', 98.1, ell(-30, -127, 8, 8), { fill: '$accent-12', slot: 'headwear', option: 'bow' });
P('headband', 'head', 98, path('M -62 -86 Q 4 -146 70 -96 L 68 -84 Q 4 -132 -60 -74 Z'), { fill: '$accent', slot: 'headwear', option: 'headband' });
P('phonesBand', 'head', 98, path('M -54 -84 C -58 -158 64 -160 64 -92'), { stroke: '$accent-20', lw: 9, slot: 'headwear', option: 'headphones' });
P('phonesCup', 'head', 98.1, rect(-66, -82, 24, 38, 10), { fill: '$accent', slot: 'headwear', option: 'headphones' });
P('flowerPetals', 'head', 98, path('M -34 -128 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 M -34 -146 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 M -18 -134 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 M -50 -134 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 M -24 -116 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 M -44 -116 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0'), { fill: '$accent', slot: 'headwear', option: 'flower', lw: 2.5 });
P('flowerCenter', 'head', 98.1, ell(-34, -130, 7, 7), { fill: '#ffd166', slot: 'headwear', option: 'flower', lw: 2.5 });

// near arm last (in front of the body)
arm('N', 100);

// ------------------------------------------------------------------------------------------
// Body builds. scale = part-only scale (does not affect children); bscale = bone scale (cascades);
// dpos = bone offset.
// ------------------------------------------------------------------------------------------
const limbs = (sx, sy = 1) => Object.fromEntries(['armN', 'foreN', 'armF', 'foreF'].map((b) => [b, { scale: [sx, sy] }]));
const legs = (sx, sy = 1) => Object.fromEntries(['thighN', 'shinN', 'thighF', 'shinF'].map((b) => [b, { scale: [sx, sy] }]));
const builds = {
  regular: {},
  slim: { torso: { scale: [0.88, 1] }, hips: { scale: [0.88, 1] }, ...limbs(0.86), ...legs(0.86), armN: { scale: [0.86, 1], dpos: [4, 0] }, armF: { scale: [0.86, 1], dpos: [-3, 0] } },
  broad: { torso: { scale: [1.16, 1] }, hips: { scale: [1.06, 1] }, ...limbs(1.14), ...legs(1.08), armN: { scale: [1.14, 1], dpos: [-6, 0] }, armF: { scale: [1.14, 1], dpos: [5, 0] }, neck: { scale: [1.2, 1] } },
  round: { torso: { scale: [1.28, 1] }, hips: { scale: [1.22, 1] }, ...limbs(1.12), ...legs(1.16), armN: { scale: [1.12, 1], dpos: [-9, 2] }, armF: { scale: [1.12, 1], dpos: [8, 2] }, thighN: { scale: [1.16, 1], dpos: [-4, 0] }, thighF: { scale: [1.16, 1], dpos: [3, 0] }, neck: { scale: [1.15, 1] } },
  tall: { ...legs(0.95, 1.1), shinN: { scale: [0.95, 1.1], dpos: [0, 8] }, shinF: { scale: [0.95, 1.1], dpos: [0, 8] }, footN: { dpos: [0, 8] }, footF: { dpos: [0, 8] }, hips: { dpos: [0, -16] }, torso: { scale: [0.96, 1.05], dpos: [0, 0] }, neck: { dpos: [0, -5] } },
  kid: {
    hips: { dpos: [0, 38], scale: [0.86, 0.9] }, ...legs(0.86, 0.78),
    shinN: { scale: [0.86, 0.78], dpos: [0, -17] }, shinF: { scale: [0.86, 0.78], dpos: [0, -17] },
    footN: { dpos: [0, -17] }, footF: { dpos: [0, -17] },
    torso: { scale: [0.86, 0.84] }, neck: { dpos: [0, 18] },
    armN: { scale: [0.84, 0.82], dpos: [5, 18] }, armF: { scale: [0.84, 0.82], dpos: [-4, 18] },
    foreN: { scale: [0.84, 0.82], dpos: [0, -11] }, foreF: { scale: [0.84, 0.82], dpos: [0, -11] },
    handN: { dpos: [0, -10] }, handF: { dpos: [0, -10] },
    head: { bscale: [1.1, 1.1] },
  },
};

// ------------------------------------------------------------------------------------------
// Animation clips
// ------------------------------------------------------------------------------------------
const K = (...pairs) => pairs; // readability helper: K([t,v],[t,v])
// Build cyclic tracks from a list of values over evenly spaced keys (first value repeated at the end).
const cyc = (dur, vals) => { const n = vals.length; return [...vals.map((v, i) => [+(dur * i / n).toFixed(4), v]), [dur, vals[0]]]; };
// Shift a cyclic value list by half (for the opposite leg/arm).
const half = (vals) => [...vals.slice(vals.length / 2), ...vals.slice(0, vals.length / 2)];

const clips = {};

clips.idle = {
  duration: 4, loop: true, ease: 'smooth',
  tracks: {
    hips: { pos: K([0, [0, 0]], [2, [1.5, 1]], [4, [0, 0]]) },
    torso: { rot: K([0, 0], [2, 0.8], [4, 0]), scale: K([0, [1, 1]], [1, [1, 1.013]], [2, [1, 1]], [3, [1, 1.013]], [4, [1, 1]]) },
    neck: { rot: K([0, 0], [2, -0.6], [4, 0]) },
    head: { rot: K([0, 0], [1.3, -1.2], [2.7, 1], [4, 0]) },
    armN: { rot: K([0, 4], [2, 5.5], [4, 4]) }, foreN: { rot: K([0, -8], [2, -10], [4, -8]) }, handN: { rot: K([0, 0], [2, -3], [4, 0]) },
    armF: { rot: K([0, -4], [2, -2.5], [4, -4]) }, foreF: { rot: K([0, -10], [2, -12], [4, -10]) }, handF: { rot: K([0, 0], [2, 2], [4, 0]) },
    thighN: { rot: K([0, 2]) }, shinN: { rot: K([0, 0]) }, footN: { rot: K([0, -2]) },
    thighF: { rot: K([0, -3]) }, shinF: { rot: K([0, 1]) }, footF: { rot: K([0, 2]) },
    hair: { rot: K([0, 0], [2, 1], [4, 0]) }, tail: { rot: K([0, 0], [2, 3], [4, 0]) },
  },
};

{ // walk: 8 evenly spaced keys per cycle (contact, down, passing, up) x 2
  const D = 1.0;
  const thigh = [-26, -14, -2, 12, 22, 10, -14, -28];
  const shin = [4, 12, 4, 6, 16, 56, 44, 12];
  const foot = [-14, 0, 0, -2, 18, 16, -6, -12];
  const arm = [20, 12, 2, -10, -20, -12, 2, 12];
  const fore = [-8, -10, -14, -22, -30, -22, -14, -10];
  clips.walk = {
    duration: D, loop: true, ease: 'smooth', speed: 175,
    tracks: {
      hips: { pos: cyc(D, [[0, 3], [0, 5], [0, -4], [0, 0], [0, 3], [0, 5], [0, -4], [0, 0]]), rot: cyc(D, [1, 0, -1, 0, 1, 0, -1, 0]) },
      torso: { rot: cyc(D, [4, 4, 3, 3, 4, 4, 3, 3]) },
      neck: { rot: cyc(D, [-1, -1, -1, -1, -1, -1, -1, -1]) },
      head: { rot: cyc(D, [-3, -3, -2, -2, -3, -3, -2, -2]) },
      thighN: { rot: cyc(D, thigh) }, shinN: { rot: cyc(D, shin) }, footN: { rot: cyc(D, foot) },
      thighF: { rot: cyc(D, half(thigh)) }, shinF: { rot: cyc(D, half(shin)) }, footF: { rot: cyc(D, half(foot)) },
      armN: { rot: cyc(D, arm) }, foreN: { rot: cyc(D, fore) },
      armF: { rot: cyc(D, half(arm).map((v) => v - 2)) }, foreF: { rot: cyc(D, half(fore)) },
      handN: { rot: cyc(D, [4, 2, 0, -2, -4, -2, 0, 2]) }, handF: { rot: cyc(D, [-4, -2, 0, 2, 4, 2, 0, -2]) },
      hair: { rot: cyc(D, [-1.5, 0, 1.5, 0, -1.5, 0, 1.5, 0]) }, tail: { rot: cyc(D, [6, 2, -4, -2, 6, 2, -4, -2]) },
    },
  };
}

{ // run: 4 phases per leg (contact, mid-stance, toe-off, swing); far leg offset by half a cycle
  const D = 0.62;
  const thigh = [-36, 0, 34, -52];
  const shin = [14, 26, 36, 104];
  const foot = [-10, 0, 28, 14];
  const arm = [42, 0, -48, 0];
  const fore = [-78, -84, -96, -84];
  clips.run = {
    duration: D, loop: true, ease: 'smooth', speed: 400,
    tracks: {
      hips: { pos: cyc(D, [[0, 8], [0, -12], [0, 8], [0, -12]]) },
      torso: { rot: cyc(D, [11, 12, 11, 12]) },
      head: { rot: cyc(D, [-9, -10, -9, -10]) },
      thighN: { rot: cyc(D, thigh) }, shinN: { rot: cyc(D, shin) }, footN: { rot: cyc(D, foot) },
      thighF: { rot: cyc(D, half(thigh)) }, shinF: { rot: cyc(D, half(shin)) }, footF: { rot: cyc(D, half(foot)) },
      armN: { rot: cyc(D, arm) }, foreN: { rot: cyc(D, fore) },
      armF: { rot: cyc(D, half(arm)) }, foreF: { rot: cyc(D, half(fore)) },
      handN: { rot: K([0, 0]) }, handF: { rot: K([0, 0]) },
      hair: { rot: cyc(D, [-3, 3, -3, 3]) }, tail: { rot: cyc(D, [14, 4, 14, 4]) },
    },
    slots: { handN: K([0, 'fist']), handF: K([0, 'fist']) },
  };
}

// ---- gestures (overlay: only the bones they animate are replaced) ----------------------------
const G = (o) => ({ loop: false, ease: 'smooth', overlay: true, ...o });

clips.wave = G({
  duration: 1.8,
  tracks: {
    armN: { rot: K([0, 4], [0.3, 152], [0.55, 164], [0.8, 150], [1.05, 164], [1.3, 150], [1.8, 4]) },
    foreN: { rot: K([0, -8], [0.3, 18], [0.55, 40], [0.8, -6], [1.05, 40], [1.3, -6], [1.8, -8]) },
    handN: { rot: K([0, 0], [0.55, 12], [0.8, -14], [1.05, 12], [1.3, -14], [1.8, 0]) },
    head: { rot: K([0, 0], [0.4, -4], [1.4, -4], [1.8, 0]) },
    torso: { rot: K([0, 0], [0.4, -2], [1.4, -2], [1.8, 0]) },
  },
  slots: { mouth: K([0, 'smile'], [1.7, null]) },
});
clips.point = G({
  duration: 1.4, holdAt: 0.55,
  tracks: {
    armF: { rot: K([0, -4], [0.35, -86], [0.55, -82], [1.0, -82], [1.4, -4]) },
    foreF: { rot: K([0, -10], [0.35, -4], [1.0, -4], [1.4, -10]) },
    handF: { rot: K([0, 0], [0.35, -4], [1.0, -4], [1.4, 0]) },
    torso: { rot: K([0, 0], [0.4, 3], [1.0, 3], [1.4, 0]) },
    head: { rot: K([0, 0], [0.4, 2], [1.0, 2], [1.4, 0]) },
  },
  slots: { handF: K([0, 'open'], [0.2, 'point'], [1.2, 'open']) },
});
clips.shrug = G({
  duration: 1.3, holdAt: 0.45,
  tracks: {
    armN: { rot: K([0, 4], [0.3, 16], [1.0, 16], [1.3, 4]), pos: K([0, [0, 0]], [0.3, [0, -6]], [1.0, [0, -6]], [1.3, [0, 0]]) },
    foreN: { rot: K([0, -8], [0.3, -78], [1.0, -78], [1.3, -8]) },
    handN: { rot: K([0, 0], [0.3, -26], [1.0, -26], [1.3, 0]) },
    armF: { rot: K([0, -4], [0.3, -14], [1.0, -14], [1.3, -4]), pos: K([0, [0, 0]], [0.3, [0, -6]], [1.0, [0, -6]], [1.3, [0, 0]]) },
    foreF: { rot: K([0, -10], [0.3, -82], [1.0, -82], [1.3, -10]) },
    handF: { rot: K([0, 0], [0.3, -20], [1.0, -20], [1.3, 0]) },
    head: { rot: K([0, 0], [0.3, 8], [1.0, 8], [1.3, 0]) },
    neck: { pos: K([0, [0, 0]], [0.3, [0, 3]], [1.0, [0, 3]], [1.3, [0, 0]]) },
  },
  slots: { brows: K([0, 'surprised'], [1.15, null]), mouth: K([0, 'frown'], [1.15, null]) },
});
clips.nod = G({
  duration: 0.9,
  tracks: {
    head: { rot: K([0, 0], [0.2, 9], [0.4, -1], [0.6, 7], [0.9, 0]) },
    neck: { rot: K([0, 0], [0.2, 3], [0.4, 0], [0.6, 2], [0.9, 0]) },
  },
});
clips.shake_head = G({
  duration: 1.0,
  tracks: {
    head: { rot: K([0, 0], [0.15, -4], [0.35, 4], [0.55, -4], [0.75, 3], [1.0, 0]) },
    gaze: { pos: K([0, [0, 0]], [0.15, [-4, 0]], [0.35, [3, 0]], [0.55, [-4, 0]], [0.75, [3, 0]], [1.0, [0, 0]]) },
  },
});
clips.jump = G({
  duration: 1.05,
  tracks: {
    root: { pos: K([0, [0, 0]], [0.22, [0, 0]], [0.32, [0, -60]], [0.48, [0, -112]], [0.66, [0, -40]], [0.74, [0, 0]], [1.05, [0, 0]]) },
    hips: { pos: K([0, [0, 0]], [0.22, [0, 26]], [0.32, [0, -4]], [0.48, [0, 0]], [0.74, [0, 24]], [0.88, [0, -3]], [1.05, [0, 0]]) },
    torso: { rot: K([0, 0], [0.22, 16], [0.36, -4], [0.6, 0], [0.74, 14], [1.05, 0]) },
    head: { rot: K([0, 0], [0.22, -8], [0.4, -4], [0.74, -6], [1.05, 0]) },
    thighN: { rot: K([0, 2], [0.22, -40], [0.36, -6], [0.5, -24], [0.74, -40], [1.05, 2]) },
    shinN: { rot: K([0, 0], [0.22, 72], [0.36, 10], [0.5, 50], [0.74, 72], [1.05, 0]) },
    footN: { rot: K([0, -2], [0.22, -32], [0.36, 24], [0.5, -10], [0.74, -32], [1.05, -2]) },
    thighF: { rot: K([0, -3], [0.22, -36], [0.36, 2], [0.5, -16], [0.74, -36], [1.05, -3]) },
    shinF: { rot: K([0, 1], [0.22, 70], [0.36, 12], [0.5, 40], [0.74, 70], [1.05, 1]) },
    footF: { rot: K([0, 2], [0.22, -34], [0.36, 28], [0.5, -8], [0.74, -34], [1.05, 2]) },
    armN: { rot: K([0, 4], [0.22, 46], [0.4, 160], [0.62, 120], [0.74, 30], [1.05, 4]) },
    armF: { rot: K([0, -4], [0.22, 34], [0.4, -160], [0.62, -120], [0.74, -30], [1.05, -4]) },
    foreN: { rot: K([0, -8], [0.22, -10], [0.4, 10], [0.74, -30], [1.05, -8]) },
    foreF: { rot: K([0, -10], [0.22, -12], [0.4, -10], [0.74, -30], [1.05, -10]) },
    tail: { rot: K([0, 0], [0.32, -20], [0.66, 22], [0.9, -6], [1.05, 0]) },
    hair: { rot: K([0, 0], [0.32, -4], [0.66, 5], [1.05, 0]) },
  },
  slots: { mouth: K([0, null], [0.3, 'grin'], [0.8, null]) },
});
clips.cheer = G({
  duration: 1.7,
  tracks: {
    armN: { rot: K([0, 4], [0.25, 162], [0.5, 146], [0.75, 162], [1.0, 146], [1.25, 160], [1.7, 4]) },
    foreN: { rot: K([0, -8], [0.25, 8], [0.5, 24], [0.75, 8], [1.0, 24], [1.7, -8]) },
    armF: { rot: K([0, -4], [0.25, -162], [0.5, -146], [0.75, -162], [1.0, -146], [1.25, -160], [1.7, -4]) },
    foreF: { rot: K([0, -10], [0.25, -8], [0.5, -24], [0.75, -8], [1.0, -24], [1.7, -10]) },
    hips: { pos: K([0, [0, 0]], [0.25, [0, -8]], [0.5, [0, 5]], [0.75, [0, -8]], [1.0, [0, 5]], [1.25, [0, -8]], [1.7, [0, 0]]) },
    head: { rot: K([0, 0], [0.3, -7], [1.3, -7], [1.7, 0]) },
  },
  slots: { handN: K([0, 'open'], [0.2, 'fist'], [1.5, 'open']), handF: K([0, 'open'], [0.2, 'fist'], [1.5, 'open']), mouth: K([0, 'grin'], [1.55, null]), eyes: K([0, 'happy'], [1.55, null]) },
});
clips.clap = G({
  duration: 1.7,
  tracks: {
    armN: { rot: K([0, 4], [0.3, -86], [1.4, -86], [1.7, 4]) },
    foreN: { rot: K([0, -8], [0.3, 30], [0.45, 44], [0.6, 26], [0.75, 44], [0.9, 26], [1.05, 44], [1.2, 26], [1.4, 30], [1.7, -8]) },
    armF: { rot: K([0, -4], [0.3, -15], [1.4, -15], [1.7, -4]) },
    foreF: { rot: K([0, -10], [0.3, -112], [0.45, -98], [0.6, -114], [0.75, -98], [0.9, -114], [1.05, -98], [1.2, -114], [1.4, -112], [1.7, -10]) },
    head: { rot: K([0, 0], [0.4, -3], [1.3, -3], [1.7, 0]) },
  },
  slots: { mouth: K([0, 'smile'], [1.6, null]), eyes: K([0, 'happy'], [1.6, null]) },
});
clips.laugh = G({
  duration: 1.8,
  tracks: {
    head: { rot: K([0, 0], [0.2, -12], [0.4, -7], [0.6, -12], [0.8, -7], [1.0, -12], [1.2, -7], [1.8, 0]) },
    torso: { rot: K([0, 0], [0.2, -4], [0.4, -1], [0.6, -4], [0.8, -1], [1.0, -4], [1.8, 0]) },
    hips: { pos: K([0, [0, 0]], [0.3, [0, 3]], [0.5, [0, 0]], [0.7, [0, 3]], [0.9, [0, 0]], [1.8, [0, 0]]) },
    armN: { rot: K([0, 4], [0.3, -22], [1.4, -22], [1.8, 4]) },
    foreN: { rot: K([0, -8], [0.3, -70], [1.4, -70], [1.8, -8]) },
  },
  slots: { mouth: K([0, 'grin'], [1.7, null]), eyes: K([0, 'happy'], [1.7, null]), brows: K([0, 'happy'], [1.7, null]) },
});
clips.facepalm = G({
  duration: 2.0, holdAt: 0.7,
  tracks: {
    armN: { rot: K([0, 4], [0.5, -95], [1.5, -95], [2.0, 4]) },
    foreN: { rot: K([0, -8], [0.5, -100], [1.5, -100], [2.0, -8]) },
    handN: { rot: K([0, 0], [0.5, -10], [1.5, -10], [2.0, 0]) },
    head: { rot: K([0, 0], [0.5, 10], [1.5, 10], [2.0, 0]) },
    neck: { rot: K([0, 0], [0.5, 4], [1.5, 4], [2.0, 0]) },
  },
  slots: { eyes: K([0, null], [0.4, 'closed'], [1.7, null]), mouth: K([0, null], [0.4, 'frown'], [1.7, null]) },
});
clips.think = G({
  duration: 2.2, holdAt: 0.7,
  tracks: {
    armN: { rot: K([0, 4], [0.5, -45], [1.7, -45], [2.2, 4]) },
    foreN: { rot: K([0, -8], [0.5, -128], [1.7, -128], [2.2, -8]) },
    handN: { rot: K([0, 0], [0.5, -20], [1.7, -20], [2.2, 0]) },
    armF: { rot: K([0, -4], [0.5, -8], [1.7, -8], [2.2, -4]) },
    foreF: { rot: K([0, -10], [0.5, -96], [1.7, -96], [2.2, -10]) },
    head: { rot: K([0, 0], [0.5, -6], [1.7, -6], [2.2, 0]) },
    gaze: { pos: K([0, [0, 0]], [0.5, [2, -4]], [1.7, [2, -4]], [2.2, [0, 0]]) },
  },
  slots: { handN: K([0, 'open'], [0.3, 'fist'], [1.9, 'open']), brows: K([0, 'worried'], [2.0, null]), mouth: K([0, 'frown'], [2.0, null]) },
});
clips.cross_arms = G({
  duration: 2.0, holdAt: 0.5,
  tracks: {
    armN: { rot: K([0, 4], [0.4, -4], [1.6, -4], [2.0, 4]) },
    foreN: { rot: K([0, -8], [0.4, -96], [1.6, -96], [2.0, -8]) },
    handN: { rot: K([0, 0], [0.4, 10], [1.6, 10], [2.0, 0]) },
    armF: { rot: K([0, -4], [0.4, -6], [1.6, -6], [2.0, -4]) },
    foreF: { rot: K([0, -10], [0.4, 92], [1.6, 92], [2.0, -10]) },
    head: { rot: K([0, 0], [0.4, -3], [1.6, -3], [2.0, 0]) },
  },
  slots: { handN: K([0, 'open'], [0.25, 'fist'], [1.75, 'open']), handF: K([0, 'open'], [0.25, 'fist'], [1.75, 'open']) },
});
clips.bow = G({
  duration: 1.8, holdAt: 0.7,
  tracks: {
    torso: { rot: K([0, 0], [0.6, 34], [1.2, 34], [1.8, 0]) },
    hips: { pos: K([0, [0, 0]], [0.6, [-8, 2]], [1.2, [-8, 2]], [1.8, [0, 0]]) },
    head: { rot: K([0, 0], [0.6, 10], [1.2, 10], [1.8, 0]) },
    armN: { rot: K([0, 4], [0.6, -30], [1.2, -30], [1.8, 4]) },
    armF: { rot: K([0, -4], [0.6, -36], [1.2, -36], [1.8, -4]) },
    foreN: { rot: K([0, -8], [0.6, -4], [1.2, -4], [1.8, -8]) },
    foreF: { rot: K([0, -10], [0.6, -6], [1.2, -6], [1.8, -10]) },
  },
  slots: { eyes: K([0, null], [0.4, 'closed'], [1.4, null]) },
});
clips.look_around = G({
  duration: 2.6,
  tracks: {
    head: { rot: K([0, 0], [0.4, -5], [1.0, -5], [1.4, 4], [2.0, 4], [2.6, 0]) },
    gaze: { pos: K([0, [0, 0]], [0.35, [-6, -1]], [1.0, [-6, -1]], [1.35, [5, 0]], [2.0, [5, 0]], [2.6, [0, 0]]) },
  },
});
clips.surprised = G({
  duration: 1.1, holdAt: 0.45,
  tracks: {
    root: { pos: K([0, [0, 0]], [0.14, [-6, -16]], [0.3, [0, 0]], [1.1, [0, 0]]) },
    torso: { rot: K([0, 0], [0.15, -6], [0.8, -3], [1.1, 0]) },
    head: { rot: K([0, 0], [0.15, -8], [0.8, -4], [1.1, 0]) },
    armN: { rot: K([0, 4], [0.15, 34], [0.8, 26], [1.1, 4]) },
    foreN: { rot: K([0, -8], [0.15, -56], [0.8, -50], [1.1, -8]) },
    armF: { rot: K([0, -4], [0.15, -34], [0.8, -28], [1.1, -4]) },
    foreF: { rot: K([0, -10], [0.15, -60], [0.8, -50], [1.1, -10]) },
  },
  slots: { mouth: K([0, 'wow'], [1.0, null]), brows: K([0, 'surprised'], [1.0, null]) },
});
clips.dance = G({
  duration: 2.0,
  tracks: {
    hips: { pos: K([0, [0, 0]], [0.25, [-7, 5]], [0.5, [0, 0]], [0.75, [7, 5]], [1.0, [0, 0]], [1.25, [-7, 5]], [1.5, [0, 0]], [1.75, [7, 5]], [2.0, [0, 0]]) },
    torso: { rot: K([0, 0], [0.25, -6], [0.75, 6], [1.25, -6], [1.75, 6], [2.0, 0]) },
    head: { rot: K([0, 0], [0.25, 6], [0.75, -6], [1.25, 6], [1.75, -6], [2.0, 0]) },
    armN: { rot: K([0, 4], [0.5, 140], [1.0, 30], [1.5, 140], [2.0, 4]) },
    foreN: { rot: K([0, -8], [0.5, 30], [1.0, -60], [1.5, 30], [2.0, -8]) },
    armF: { rot: K([0, -4], [0.5, -30], [1.0, -140], [1.5, -30], [2.0, -4]) },
    foreF: { rot: K([0, -10], [0.5, -60], [1.0, -30], [1.5, -60], [2.0, -10]) },
    shinN: { rot: K([0, 0], [0.25, 14], [0.5, 0], [0.75, 4], [1.0, 0], [1.25, 14], [1.5, 0], [1.75, 4], [2.0, 0]) },
    shinF: { rot: K([0, 1], [0.25, 4], [0.5, 1], [0.75, 14], [1.0, 1], [1.25, 4], [1.5, 1], [1.75, 14], [2.0, 1]) },
  },
  slots: { mouth: K([0, 'smile'], [1.9, null]) },
});
clips.sad_slump = G({
  duration: 2.0, holdAt: 0.6,
  tracks: {
    torso: { rot: K([0, 0], [0.5, 8], [1.5, 8], [2.0, 0]) },
    neck: { rot: K([0, 0], [0.5, 6], [1.5, 6], [2.0, 0]) },
    head: { rot: K([0, 0], [0.5, 14], [1.5, 14], [2.0, 0]) },
    armN: { rot: K([0, 4], [0.5, -6], [1.5, -6], [2.0, 4]) },
    armF: { rot: K([0, -4], [0.5, -10], [1.5, -10], [2.0, -4]) },
    foreN: { rot: K([0, -8], [0.5, -2], [1.5, -2], [2.0, -8]) },
    foreF: { rot: K([0, -10], [0.5, -2], [1.5, -2], [2.0, -10]) },
  },
  slots: { brows: K([0, 'sad'], [1.9, null]), mouth: K([0, 'sad'], [1.9, null]) },
});
// talking gestures (looping overlays chosen per line)
clips.talk_a = G({
  duration: 2.4, loop: true,
  tracks: {
    armF: { rot: K([0, -4], [0.5, -36], [1.0, -22], [1.5, -46], [2.0, -18], [2.4, -4]) },
    foreF: { rot: K([0, -10], [0.5, -56], [1.0, -40], [1.5, -64], [2.0, -34], [2.4, -10]) },
    handF: { rot: K([0, 0], [0.5, -16], [1.0, 6], [1.5, -18], [2.0, 4], [2.4, 0]) },
    head: { rot: K([0, 0], [0.4, -2], [0.9, 2], [1.5, -1.5], [2.0, 1.5], [2.4, 0]) },
  },
});
clips.talk_b = G({
  duration: 2.4, loop: true,
  tracks: {
    armN: { rot: K([0, 4], [0.6, -10], [1.2, 0], [1.8, -12], [2.4, 4]) },
    foreN: { rot: K([0, -8], [0.6, -60], [1.2, -32], [1.8, -66], [2.4, -8]) },
    armF: { rot: K([0, -4], [0.6, -12], [1.2, -6], [1.8, -16], [2.4, -4]) },
    foreF: { rot: K([0, -10], [0.6, -26], [1.2, -14], [1.8, -34], [2.4, -10]) },
    head: { rot: K([0, 0], [0.6, 2.5], [1.2, -2], [1.8, 2], [2.4, 0]) },
  },
});
clips.talk_c = G({
  duration: 2.4, loop: true,
  tracks: {
    torso: { rot: K([0, 0], [1.2, 2], [2.4, 0]) },
    head: { rot: K([0, 0], [0.6, 3], [1.2, -2], [1.8, 2], [2.4, 0]) },
    armF: { rot: K([0, -4], [0.8, -14], [1.6, -8], [2.4, -4]) },
    foreF: { rot: K([0, -10], [0.8, -44], [1.6, -26], [2.4, -10]) },
  },
});
clips.talk = { ...clips.talk_a };

// ------------------------------------------------------------------------------------------
const rig = {
  id: 'humanoid',
  name: 'Person (3/4 view)',
  generatedBy: 'scripts/rigs/humanoid.mjs',
  height: 424,
  displayScale: 0.92,
  style: { stroke: '$outline', lw: 3.5 },
  palette: ['skin', 'hair', 'brow', 'eye', 'blush', 'top', 'top2', 'bottom', 'shoes', 'sole', 'accent', 'frame', 'outline'],
  bones, slots, parts, builds, clips,
  talkClips: ['talk_a', 'talk_b', 'talk_c'],
  moods: {
    neutral: { eyes: 'open', brows: 'neutral', mouth: 'rest' },
    happy: { eyes: 'open', brows: 'happy', mouth: 'smile' },
    joy: { eyes: 'happy', brows: 'happy', mouth: 'grin' },
    sad: { eyes: 'open', brows: 'sad', mouth: 'sad', lid: 0.22 },
    angry: { eyes: 'open', brows: 'angry', mouth: 'frown', lid: 0.3 },
    surprised: { eyes: 'open', brows: 'surprised', mouth: 'wow', lid: 0 },
    worried: { eyes: 'open', brows: 'worried', mouth: 'frown', lid: 0.1 },
    sleepy: { eyes: 'open', brows: 'neutral', mouth: 'rest', lid: 0.55 },
  },
};

export default rig;
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUT, JSON.stringify(rig) + '\n');
  console.log(`humanoid: ${bones.length} bones, ${parts.length} parts, ${Object.keys(clips).length} clips`);
}
