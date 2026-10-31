// Body + clothing: arms, hands, legs, shoes, hips/bottoms, torso/tops.
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
//
// Tops are described by the TOPS table below (sleeve kind/colour, torso colour, neckline, cuffs, collar...) and
// the generic parts are generated per group of tops that share a look, so adding a top is mostly one table row
// plus its own details. Colour tokens: $top (main garment), $top2 (secondary / inner shirt / trim), $accent
// (small details: buttons, badges), $bottom (legs), $shoes/$sole (footwear). Fixed colours only for things that
// are always that colour (shirt-white, lab-coat white, gold badge).
//
// Joints: elbows and knees get a stroke-less "cap" (same fill as the limb, plus its shade) drawn over the seam
// where the upper and lower segments overlap, so bent limbs read as one continuous shape. Big silhouettes that
// get detail painted over them (torso) are re-stroked at the end of their stack ("...Edge" parts).
import { shade } from '../../../src/engine/paint.js';

const WHITE = '#f4f3ef'; // shirt cuffs / collars
const LAB = '#f2f4f5'; // lab coat
const GOLD = '#e8c25a';
const dk = (c, a) => (c[0] === '$' ? `${c}-${a}` : shade(c, -a));
const lt = (c, a) => (c[0] === '$' ? `${c}+${a}` : shade(c, a));

// sl: sleeve kind (none | short | long | puffy | wide) · sc: sleeve colour · base: torso colour (inner shirt for open tops)
// neck: crew | scoop | vee | none · cuff: rib | band | shirt · collar: shirt collar · belt: tucked in (belt shows)
// tails: garment continues over the hips (see hips section)
const TOPS = {
  tee: { sl: 'short', neck: 'crew' },
  longsleeve: { sl: 'long', neck: 'crew' },
  hoodie: { sl: 'long', neck: 'none', cuff: 'rib' },
  sweater: { sl: 'long', neck: 'crew', cuff: 'rib' },
  suit: { sl: 'long', neck: 'none', cuff: 'shirt' },
  overalls: { sl: 'short', sc: '$top2', base: '$top2', neck: 'crew' },
  dress: { sl: 'short', neck: 'crew' },
  graphictee: { sl: 'short', neck: 'crew' },
  polo: { sl: 'short', neck: 'vee', collar: true, cuff: 'band', belt: true },
  tank: { sl: 'none', neck: 'scoop' },
  buttonup: { sl: 'long', neck: 'vee', collar: true, cuff: 'band', belt: true },
  jacket: { sl: 'long', neck: 'none', cuff: 'rib' },
  denim: { sl: 'long', neck: 'none', cuff: 'band', collar: true },
  blazer: { sl: 'long', neck: 'none', cuff: 'shirt' },
  cardigan: { sl: 'long', neck: 'none', cuff: 'rib' },
  varsity: { sl: 'long', sc: '$top2', neck: 'none', cuff: 'rib' },
  puffer: { sl: 'puffy', neck: 'none', cuff: 'rib' },
  coat: { sl: 'long', neck: 'vee', collar: true, cuff: 'band' },
  labcoat: { sl: 'long', sc: LAB, base: LAB, neck: 'none' },
  uniform: { sl: 'long', neck: 'vee', collar: true, cuff: 'band', belt: true },
  apron: { sl: 'short', neck: 'crew' },
  robe: { sl: 'wide', neck: 'none' },
  sundress: { sl: 'none', neck: 'none' },
  gown: { sl: 'none', neck: 'none' },
};
for (const t of Object.values(TOPS)) { t.sc ??= '$top'; t.base ??= '$top'; }
const TOP_IDS = Object.keys(TOPS);
const tops = (pred) => TOP_IDS.filter((id) => pred(TOPS[id], id));
/** Group top ids by a key function → [[key, [ids]]] (skips null keys). */
function groupBy(fn) {
  const m = new Map();
  for (const id of TOP_IDS) { const k = fn(TOPS[id], id); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(id); }
  return [...m];
}

// Bottoms: legwear shapes. 'bare' draws nothing (for dresses and gowns).
const LONG_LEGS = ['pants', 'jeans', 'cargo', 'sweatpants']; // full-length trousers sharing one cut
const PELVIS = [...LONG_LEGS, 'shorts', 'leggings'];
const BELTED = ['pants', 'jeans', 'cargo'];
const HAND_OPTS = ['open', 'fist', 'point', 'wave', 'thumbsup', 'peace'];
const SHOES = ['sneakers', 'boots', 'dress', 'heels', 'flats', 'sandals', 'rainboots'];

export const slots = {
  top: { default: 'tee', options: TOP_IDS },
  bottom: { default: 'pants', options: ['pants', 'jeans', 'shorts', 'skirt', 'longskirt', 'leggings', 'cargo', 'sweatpants', 'bare'] },
  shoes: { default: 'sneakers', options: SHOES },
  handF: { default: 'open', options: HAND_OPTS },
  handN: { default: 'open', options: HAND_OPTS },
};

/** Tops whose own skirt/coat covers the hips (handy for UIs choosing bottom=bare). */
export const DRESS_TOPS = ['dress', 'sundress', 'gown'];

/** Limb segment: domed top (half-width a at y0), straight taper to half-width b, softly rounded bottom at y1. */
function taper(a, b, y0, y1, r = 6) {
  const f = (n) => +n.toFixed(2);
  return `M ${f(-a)} ${f(y0 + a)} C ${f(-a)} ${f(y0 - a / 3)} ${f(a)} ${f(y0 - a / 3)} ${f(a)} ${f(y0 + a)} L ${f(b)} ${f(y1 - r)} Q ${f(b)} ${f(y1)} ${f(b - r)} ${f(y1)} L ${f(-b + r)} ${f(y1)} Q ${f(-b)} ${f(y1)} ${f(-b)} ${f(y1 - r)} Z`;
}

/** Open outline for a lower limb segment drawn by taper(): sides + bottom only, so the joint has no seam. */
function sides(a, b, y0, y1, r = 6) {
  const f = (n) => +n.toFixed(2);
  return `M ${f(-a)} ${f(y0 + a)} L ${f(-b)} ${f(y1 - r)} Q ${f(-b)} ${f(y1)} ${f(-b + r)} ${f(y1)} L ${f(b - r)} ${f(y1)} Q ${f(b)} ${f(y1)} ${f(b)} ${f(y1 - r)} L ${f(a)} ${f(y0 + a)}`;
}

export function addBody(ctx, { near = false } = {}) {
  const { P, rect, ell, path, NOSTROKE } = ctx;
  const shadeStrip = (x0, w, y0 = -30, h = 140) => rect(x0, y0, w, h);
  // Lower limb segment (forearm, shin): stroke-less fill + shade + an open side/hem outline. The upper segment's
  // end is hidden under the fill, so straight and bent joints read as one continuous limb.
  function lower(id, bone, z, fillD, lineD, fill, shade, cond = {}) {
    P(id, bone, z, path(fillD), { fill, ...NOSTROKE, ...cond });
    P(`${id}Sh`, bone, z + 0.02, shade, { fill: dk(fill, fill === '$skin' ? 14 : 16), ...NOSTROKE, clip: id, ...cond });
    P(`${id}Line`, bone, z + 0.04, path(lineD), { fill: null, ...cond });
  }

  // ---- arms ------------------------------------------------------------------------------------
  function arm(side, z) {
    const A = 'arm' + side, F = 'fore' + side, H = 'hand' + side;
    P(`${A}Skin`, A, z, path(taper(13, 11.2, -12, 66, 7)), { fill: '$skin' });
    P(`${A}SkinShade`, A, z + 0.02, shadeStrip(-20, 13), { fill: '$skin-14', ...NOSTROKE, clip: `${A}Skin` });

    // upper sleeves, per sleeve kind + colour
    const SHORT_D = 'M -17 30 L -16 -2 C -16 -19 16 -19 16 -2 L 17 30 Q 0 35 -17 30 Z';
    let gi = 0;
    for (const [key, ids] of groupBy((t) => (t.sl === 'none' ? null : `${t.sl}|${t.sc}`))) {
      const [kind, c] = key.split('|');
      const k = `${kind}${gi++}`;
      const up = { short: path(SHORT_D), long: path(taper(15, 13.2, -16, 69)), puffy: path(taper(18, 16.2, -18, 70)), wide: path(taper(17, 15, -17, 70)) }[kind];
      P(`${A}Sl_${k}`, A, z + 0.1, up, { fill: c, when: { top: ids } });
      P(`${A}Sl_${k}Sh`, A, z + 0.12, shadeStrip(-26, kind === 'short' ? 17 : 18), { fill: dk(c, 16), ...NOSTROKE, clip: `${A}Sl_${k}`, when: { top: ids } });
      if (kind === 'short') continue;
      const [fa, fb, fy0, fy1, fr] = { long: [13, 13, -8, 50, 7], puffy: [16, 16, -10, 52, 9], wide: [15, 23, -8, 52, 6] }[kind];
      lower(`${F}Sl_${k}`, F, z + 0.3, taper(fa, fb, fy0, fy1, fr), sides(fa, fb, fy0, fy1, fr), c, shadeStrip(-30, 22), { when: { top: ids } });
      if (kind === 'puffy') {
        P(`${A}Quilt`, A, z + 0.15, path('M -20 18 Q 0 24 20 18 M -20 44 Q 0 50 20 44'), { stroke: dk(c, 24), lw: 2.4, clip: `${A}Sl_${k}`, when: { top: ids } });
        P(`${F}Quilt`, F, z + 0.35, path('M -20 22 Q 0 28 20 22'), { stroke: dk(c, 24), lw: 2.4, clip: `${F}Sl_${k}`, when: { top: ids } });
      }
    }
    // forearm skin (above the upper sleeve end) + elbow cap for bare elbows
    lower(`${F}Skin`, F, z + 0.2, taper(11, 10.5, -6, 58, 8), sides(11, 10.5, -6, 58, 8), '$skin', shadeStrip(-18, 11));

    // sleeve details
    const LONGISH = tops((t) => t.sl === 'long');
    P(`${A}SleeveStripe`, A, z + 0.14, path('M -20 18 L 20 18 L 20 28 L -20 28 Z M -20 44 L 20 44 L 20 54 L -20 54 Z'), { fill: '$top2', ...NOSTROKE, clip: `${A}Sl_long${slIndex('long', '$top')}`, when: { top: 'sweater' } });
    P(`${F}SleeveStripe`, F, z + 0.34, path('M -20 12 L 20 12 L 20 22 L -20 22 Z'), { fill: '$top2', ...NOSTROKE, clip: `${F}Sl_long${slIndex('long', '$top')}`, when: { top: 'sweater' } });
    P(`${A}SleeveBand`, A, z + 0.14, path('M -20 20 L 20 20 L 20 40 L -20 40 Z'), { fill: '$top2', ...NOSTROKE, clip: `${A}Sl_short${slIndex('short', '$top')}`, when: { top: 'graphictee' } });
    P(`${A}SleeveRib`, A, z + 0.14, path('M -20 24 L 20 24 L 20 40 L -20 40 Z'), { fill: '$top-12', ...NOSTROKE, clip: `${A}Sl_short${slIndex('short', '$top')}`, when: { top: 'polo' } });
    P(`${A}SleeveRibLine`, A, z + 0.15, path('M -17 24.5 Q 0 28 17 24.5'), { lw: 2, when: { top: 'polo' } });
    if (side === 'N') {
      P(`${A}Patch`, A, z + 0.16, path('M -6 8 L 8 8 L 8 22 Q 1 30 -6 22 Z'), { fill: '$accent', lw: 2.2, when: { top: 'uniform' } });
      P(`${A}Stitch`, A, z + 0.16, path('M -8 -2 C -4 -10 8 -10 12 -4'), { stroke: '$top+30', lw: 1.6, when: { top: 'denim' } });
    }
    // cuffs
    const cuffs = { rib: [], band: [], shirt: [] };
    for (const id of LONGISH.concat(tops((t) => t.sl === 'puffy'))) if (TOPS[id].cuff) cuffs[TOPS[id].cuff].push(id);
    for (const [c, ids] of groupBy((t) => (t.cuff === 'rib' && t.sl === 'long' ? t.sc : null))) {
      P(`${F}CuffRib_${c.replace(/\W/g, '')}`, F, z + 0.4, rect(-14, 41, 28, 12, 5), { fill: dk(c, 10), when: { top: ids.filter((i) => i !== 'varsity') } });
    }
    P(`${F}CuffVarsity`, F, z + 0.4, rect(-14, 39, 28, 14, 5), { fill: '$top', when: { top: 'varsity' } });
    P(`${F}CuffVarsityStripe`, F, z + 0.41, path('M -16 44 L 16 44 L 16 48 L -16 48 Z'), { fill: '$top2', ...NOSTROKE, clip: `${F}CuffVarsity`, when: { top: 'varsity' } });
    P(`${F}CuffPuffy`, F, z + 0.4, rect(-14, 44, 28, 10, 4), { fill: '$top-14', when: { top: 'puffer' } });
    P(`${F}CuffBand`, F, z + 0.4, path('M -14 38 L 14 38 L 14 50 Q 14 52 12 52 L -12 52 Q -14 52 -14 50 Z'), { fill: '$top-6', when: { top: cuffs.band } });
    P(`${F}CuffShirt`, F, z + 0.38, rect(-12, 44, 24, 10, 3), { fill: WHITE, when: { top: cuffs.shirt } });
    P(`${F}CuffButton`, F, z + 0.42, ell(8, 45, 2.2, 2.2), { fill: '$accent', ...NOSTROKE, when: { top: ['denim', 'uniform', 'buttonup'] } });

    // hands (thumb toward the front = +x; fingers along +y)
    const HO = (o) => ({ slot: H, option: o });
    // behind the palm/fist: fingers that stick out
    P(`${H}PointFinger`, H, z + 0.6, rect(1.5, 8, 9, 30, 4.5), { fill: '$skin', ...HO('point') });
    P(`${H}PeaceIndex`, H, z + 0.6, ell(6.5, 27, 4.4, 12, -12), { fill: '$skin', ...HO('peace') });
    P(`${H}PeaceMiddle`, H, z + 0.61, ell(-1.5, 28, 4.4, 12.5, 9), { fill: '$skin', ...HO('peace') });
    P(`${H}UpThumb`, H, z + 0.6, ell(13, 3, 10, 5, -12), { fill: '$skin', ...HO('thumbsup') });
    P(`${H}WaveF1`, H, z + 0.6, ell(9, 26, 4.4, 10, -22), { fill: '$skin', ...HO('wave') });
    P(`${H}WaveF2`, H, z + 0.61, ell(3.2, 30, 4.6, 11, -7), { fill: '$skin', ...HO('wave') });
    P(`${H}WaveF3`, H, z + 0.62, ell(-3, 29.5, 4.5, 10.5, 7), { fill: '$skin', ...HO('wave') });
    P(`${H}WaveF4`, H, z + 0.63, ell(-8.5, 25, 4, 9, 22), { fill: '$skin', ...HO('wave') });
    P(`${H}WaveThumb`, H, z + 0.64, ell(13, 7, 4.8, 9.5, -55), { fill: '$skin', ...HO('wave') });
    // palm / fist
    P(`${H}Open`, H, z + 0.7, path('M -10 -4 C -13.5 6 -13.5 19 -9.5 26 C -6 31.5 3 32.5 7 28.5 C 11 24.5 12 14 11 6 C 10 0 7 -5 0 -5.5 C -5 -5.5 -8 -5.5 -10 -4 Z'), { fill: '$skin', ...HO('open') });
    P(`${H}WavePalm`, H, z + 0.7, ell(0, 11, 11.5, 12.5), { fill: '$skin', ...HO('wave') });
    P(`${H}Fist`, H, z + 0.7, rect(-11, -4, 23, 24, 10), { fill: '$skin', ...HO(['fist', 'point', 'thumbsup', 'peace']) });
    P(`${H}OpenSh`, H, z + 0.72, rect(-20, -10, 10, 50), { fill: '$skin-14', ...NOSTROKE, clip: `${H}Open`, ...HO('open') });
    P(`${H}FistSh`, H, z + 0.72, rect(-20, -10, 10, 50), { fill: '$skin-14', ...NOSTROKE, clip: `${H}Fist`, ...HO(['fist', 'point', 'thumbsup', 'peace']) });
    P(`${H}WaveSh`, H, z + 0.72, rect(-20, -10, 10, 50), { fill: '$skin-14', ...NOSTROKE, clip: `${H}WavePalm`, ...HO('wave') });
    // details on top
    P(`${H}OpenLines`, H, z + 0.8, path('M -3.5 19 Q -3 24 -4 29 M 2.5 19 Q 3 24 2 29.5'), { lw: 1.7, ...HO('open') });
    P(`${H}Thumb`, H, z + 0.82, ell(10, 6, 5.5, 9.5, -26), { fill: '$skin', ...HO('open') });
    P(`${H}Knuckles`, H, z + 0.8, path('M -4 9 L -4 17 M 2.5 9 L 2.5 17'), { lw: 1.8, ...HO('fist') });
    P(`${H}FistThumb`, H, z + 0.82, path('M 12.5 1 C 5 2 1 6 1.5 10.5 C 2 14 8 14.5 12.5 12'), { fill: '$skin', lw: 2.4, ...HO(['fist', 'point', 'peace']) });
  }
  // index of the generated sleeve group for (kind, colour) — used for clip references
  function slIndex(kind, c) {
    const keys = groupBy((t) => (t.sl === 'none' ? null : `${t.sl}|${t.sc}`)).map(([k]) => k);
    return keys.indexOf(`${kind}|${c}`);
  }

  // ---- legs ------------------------------------------------------------------------------------
  function leg(side, z) {
    const T = 'thigh' + side, S = 'shin' + side, Ft = 'foot' + side;
    P(`${T}Skin`, T, z, path(taper(15, 13.2, -8, 86, 7)), { fill: '$skin' });
    P(`${T}SkinShade`, T, z + 0.02, shadeStrip(-22, 13), { fill: '$skin-14', ...NOSTROKE, clip: `${T}Skin` });
    lower(`${S}Skin`, S, z + 0.1, taper(13.2, 12.5, -7, 78, 9), sides(13.2, 12.5, -7, 78, 9), '$skin', shadeStrip(-20, 11));

    // trousers: thigh / shin shapes per cut
    const cut = [
      // [id, bottoms, thigh shape, shin shape, cap radius]
      ['Pants', ['pants', 'jeans'], path(taper(17, 15.2, -10, 88)), [15.2, 17, -10, 76, 4]],
      ['Cargo', ['cargo'], path(taper(19, 17.2, -10, 88)), [17.2, 17, -10, 76, 4]],
      ['Sweats', ['sweatpants'], path(taper(18, 16.2, -10, 88)), [16.2, 14, -10, 66, 3]],
      ['Leggings', ['leggings'], path(taper(15.5, 13.7, -9, 86)), [13.7, 13, -9, 72, 8]],
    ];
    for (const [id, bs, th, [a, b, y0, y1, r]] of cut) {
      P(`${T}${id}`, T, z + 0.2, th, { fill: '$bottom', when: { bottom: bs } });
      P(`${T}${id}Sh`, T, z + 0.22, shadeStrip(-26, 15), { fill: '$bottom-16', ...NOSTROKE, clip: `${T}${id}`, when: { bottom: bs } });
      lower(`${S}${id}`, S, z + 0.3, taper(a, b, y0, y1, r), sides(a, b, y0, y1, r), '$bottom', shadeStrip(-26, 14), { when: { bottom: bs } });
    }
    P(`${T}Shorts`, T, z + 0.2, path('M -18 -10 L 18 -10 L 20 46 Q 0 50 -20 46 Z'), { fill: '$bottom', when: { bottom: 'shorts' } });
    P(`${T}ShortsSh`, T, z + 0.22, shadeStrip(-26, 15), { fill: '$bottom-16', ...NOSTROKE, clip: `${T}Shorts`, when: { bottom: 'shorts' } });
    P(`${T}ShortsHem`, T, z + 0.24, path('M -19 38 Q 0 42 19 38'), { stroke: '$bottom-30', lw: 2, when: { bottom: 'shorts' } });
    // jeans: outseam stitching + rolled cuff
    P(`${T}JeanSeam`, T, z + 0.25, path('M 11 -6 L 12 84'), { stroke: '$bottom+30', lw: 1.6, when: { bottom: 'jeans' } });
    P(`${S}JeanSeam`, S, z + 0.35, path('M 10 -14 L 12 60'), { stroke: '$bottom+30', lw: 1.6, when: { bottom: 'jeans' } });
    P(`${S}JeanCuff`, S, z + 0.37, path('M -17 60 L 17 60 L 17.5 74 Q 0 78 -17.5 74 Z'), { fill: '$bottom+14', when: { bottom: 'jeans' } });
    // cargo: side pocket with flap, gathered ankle
    P(`${T}CargoPocket`, T, z + 0.25, path('M -20 34 L -2 34 L -2 60 Q -2 64 -6 64 L -16 64 Q -20 64 -20 60 Z'), { fill: '$bottom-6', when: { bottom: 'cargo' } });
    P(`${T}CargoFlap`, T, z + 0.26, path('M -21 32 L -1 32 L -1 40 L -21 40 Z'), { fill: '$bottom-12', when: { bottom: 'cargo' } });
    P(`${S}CargoHem`, S, z + 0.37, path('M -17 66 L 17 66 L 17 74 Q 0 78 -17 74 Z'), { fill: '$bottom-10', when: { bottom: 'cargo' } });
    // sweatpants: rib cuff + side stripe
    P(`${T}SweatStripe`, T, z + 0.25, path('M 11 -10 L 16 -10 L 16 90 L 11 90 Z'), { fill: '$top2', ...NOSTROKE, clip: `${T}Sweats`, when: { bottom: 'sweatpants' } });
    P(`${S}SweatStripe`, S, z + 0.35, path('M 10 -24 L 15 -24 L 15 70 L 10 70 Z'), { fill: '$top2', ...NOSTROKE, clip: `${S}Sweats`, when: { bottom: 'sweatpants' } });
    P(`${S}SweatCuff`, S, z + 0.37, rect(-13, 62, 26, 14, 5), { fill: '$bottom-12', when: { bottom: 'sweatpants' } });

    // ---- shoes (foot bone at the ankle; toe toward +x; ground ≈ y 14) ----
    const SO = (o) => ({ slot: 'shoes', option: o });
    // shafts live on the shin so they bend with it
    P(`${S}Boot`, S, z + 0.45, path('M -17 40 L 17 40 L 17 86 L -17 86 Z'), { fill: '$shoes', ...SO('boots') });
    P(`${S}BootSh`, S, z + 0.46, shadeStrip(-26, 13), { fill: '$shoes-16', ...NOSTROKE, clip: `${S}Boot`, ...SO('boots') });
    P(`${S}BootCuff`, S, z + 0.47, rect(-18.5, 36, 37, 10, 3), { fill: '$shoes-12', ...SO('boots') });
    P(`${S}Rain`, S, z + 0.45, path('M -18 24 C -8 20 8 20 18 24 L 17 86 L -17 86 Z'), { fill: '$shoes', ...SO('rainboots') });
    P(`${S}RainSh`, S, z + 0.46, shadeStrip(-26, 13), { fill: '$shoes-16', ...NOSTROKE, clip: `${S}Rain`, ...SO('rainboots') });
    P(`${S}RainGloss`, S, z + 0.47, rect(6, 30, 5, 34, 2.5), { fill: '#ffffff', alpha: 0.35, ...NOSTROKE, ...SO('rainboots') });
    // bare foot (sandals, flats, heels)
    P(`${Ft}Bare`, Ft, z + 0.5, path('M -13 -14 C -6 -16 8 -12 20 -5 C 30 0 38 1 40 6 L 40 10 L -15 10 C -17 2 -17 -9 -13 -14 Z'), { fill: '$skin', ...SO(['sandals', 'flats']) });
    P(`${Ft}BareSh`, Ft, z + 0.51, rect(-30, -20, 18, 40), { fill: '$skin-14', ...NOSTROKE, clip: `${Ft}Bare`, ...SO(['sandals', 'flats']) });
    P(`${Ft}Toes`, Ft, z + 0.52, path('M 31 2 L 32 8 M 36 3 L 37 8'), { lw: 1.5, ...SO('sandals') });
    P(`${Ft}HeelFoot`, Ft, z + 0.5, path('M -12 -14 C -4 -15 8 -9 18 -3 C 26 1 30 2 32 4 L 22 6 C 10 3 -2 -1 -12 -2 Z'), { fill: '$skin', ...SO('heels') });
    // sneakers (the classic look)
    const SNEAK = 'M -15 -12 C -10 -16 8 -16 13 -11 C 28 -9 40 -2 41 6 L 41 10 L -18 10 C -21 3 -20 -8 -15 -12 Z';
    P(`${Ft}Shoe`, Ft, z + 0.55, path(SNEAK), { fill: '$shoes', ...SO('sneakers') });
    P(`${Ft}ShoeSh`, Ft, z + 0.56, rect(-30, -20, 17, 30), { fill: '$shoes-12', ...NOSTROKE, clip: `${Ft}Shoe`, ...SO('sneakers') });
    P(`${Ft}Sole`, Ft, z + 0.57, rect(-24, 4, 70, 10), { fill: '$sole', ...NOSTROKE, clip: `${Ft}Shoe`, ...SO('sneakers') });
    P(`${Ft}Lace`, Ft, z + 0.6, path('M 6 -10 L 14 -4 M 12 -8 L 19 -2'), { lw: 2.2, ...SO('sneakers') });
    // boots + rain boots (foot part)
    P(`${Ft}Boot`, Ft, z + 0.55, path('M -17 -16 L 13 -16 C 15 -10 22 -7 33 -4 C 42 -1 44 4 43 10 L -19 10 C -21 0 -20 -10 -17 -16 Z'), { fill: '$shoes', ...SO(['boots', 'rainboots']) });
    P(`${Ft}BootSh`, Ft, z + 0.56, rect(-30, -20, 17, 30), { fill: '$shoes-16', ...NOSTROKE, clip: `${Ft}Boot`, ...SO(['boots', 'rainboots']) });
    P(`${Ft}BootSole`, Ft, z + 0.57, rect(-24, 2, 72, 12), { fill: '$sole', ...NOSTROKE, clip: `${Ft}Boot`, ...SO(['boots', 'rainboots']) });
    P(`${Ft}BootCap`, Ft, z + 0.58, ell(-2, -14, 14, 7), { fill: '$shoes', ...NOSTROKE, ...SO(['boots', 'rainboots']) });
    P(`${Ft}BootLace`, Ft, z + 0.6, path('M 8 -12 L 16 -7 M 14 -10 L 21 -5'), { lw: 2, ...SO('boots') });
    P(`${Ft}RainGloss`, Ft, z + 0.6, ell(26, -2, 8, 2.6, 18), { fill: '#ffffff', alpha: 0.4, ...NOSTROKE, ...SO('rainboots') });
    // dress shoes
    P(`${Ft}Dress`, Ft, z + 0.55, path('M -15 -10 C -8 -13 10 -12 18 -8 C 30 -5 40 -1 41 5 L 41 10 L -17 10 C -19 2 -19 -6 -15 -10 Z'), { fill: '$shoes', ...SO('dress') });
    P(`${Ft}DressSh`, Ft, z + 0.56, rect(-30, -20, 17, 30), { fill: '$shoes-14', ...NOSTROKE, clip: `${Ft}Dress`, ...SO('dress') });
    P(`${Ft}DressSole`, Ft, z + 0.57, rect(-24, 6, 72, 8), { fill: '$sole', ...NOSTROKE, clip: `${Ft}Dress`, ...SO('dress') });
    P(`${Ft}DressHeel`, Ft, z + 0.58, rect(-17, 6, 15, 8, 1), { fill: '$sole', ...SO('dress') });
    P(`${Ft}DressGloss`, Ft, z + 0.6, ell(24, -3, 9, 2.4, 14), { fill: '#ffffff', alpha: 0.35, ...NOSTROKE, ...SO('dress') });
    P(`${Ft}DressSeam`, Ft, z + 0.6, path('M 14 -8 Q 20 -2 26 -4'), { lw: 1.6, ...SO('dress') });
    // heels (pump + stiletto)
    P(`${Ft}HeelSpike`, Ft, z + 0.54, path('M -14 0 L -4 0 L -7 14 L -11.5 14 Z'), { fill: '$shoes-25', ...SO('heels') });
    P(`${Ft}Pump`, Ft, z + 0.55, path('M -14 -11 C -10 -2 4 0 16 2 C 24 3 32 3 36 6 C 40 8 41 11 40 13 L 20 13 C 10 9 0 5 -8 4 L -14 4 C -16 -2 -16 -7 -14 -11 Z'), { fill: '$shoes', ...SO('heels') });
    P(`${Ft}PumpSh`, Ft, z + 0.56, rect(-30, -20, 18, 40), { fill: '$shoes-16', ...NOSTROKE, clip: `${Ft}Pump`, ...SO('heels') });
    // flats
    P(`${Ft}Flat`, Ft, z + 0.55, path('M -17 -4 C -4 -5 14 -2 26 -1 C 36 0 41 3 41 8 L 41 11 L -18 11 C -19 6 -19 0 -17 -4 Z'), { fill: '$shoes', ...SO('flats') });
    P(`${Ft}FlatSh`, Ft, z + 0.56, rect(-30, -20, 16, 40), { fill: '$shoes-16', ...NOSTROKE, clip: `${Ft}Flat`, ...SO('flats') });
    P(`${Ft}FlatBow`, Ft, z + 0.6, path('M 22 -2 L 28 -5 L 28 1 Z M 22 -2 L 16 -5 L 16 1 Z'), { fill: '$accent', lw: 1.6, ...SO('flats') });
    // sandals
    P(`${Ft}SandalSole`, Ft, z + 0.55, rect(-18, 8, 60, 6, 3), { fill: '$sole', ...SO('sandals') });
    P(`${Ft}SandalStraps`, Ft, z + 0.56, path('M -12 -4 C -4 -6 4 -6 10 -10 M 20 -4 C 24 0 26 6 25 9'), { stroke: '$shoes', lw: 5, ...SO('sandals') });
  }

  // Draw order (facing right): far arm, far leg, near leg, hips, torso, head, near arm.
  if (near) { arm('N', 100); return; }
  arm('F', 10);
  leg('F', 20);
  leg('N', 30);

  // ---- hips / bottoms --------------------------------------------------------------------------
  const PELVIS_D = 'M -42 -10 C -20 -16 20 -16 40 -10 L 42 26 C 20 33 -20 33 -44 26 Z';
  P('pelvis', 'hips', 40, path(PELVIS_D), { fill: '$bottom', when: { bottom: PELVIS } });
  P('pelvisShade', 'hips', 40.1, rect(-60, -20, 26, 60), { fill: '$bottom-16', ...NOSTROKE, clip: 'pelvis', when: { bottom: PELVIS } });
  P('belt', 'hips', 40.2, path('M -44 -10 C -20 -15 20 -15 42 -10 L 42 -2 C 20 -7 -20 -7 -44 -2 Z'), { fill: '$bottom-30', when: { bottom: 'pants' }, unless: { top: ['overalls', 'dress'] } });
  P('jeansFly', 'hips', 40.3, path('M 14 4 Q 16 18 10 26'), { stroke: '$bottom+30', lw: 1.6, when: { bottom: 'jeans' } });
  P('jeansPocket', 'hips', 40.3, path('M 26 6 Q 30 14 40 14'), { stroke: '$bottom+30', lw: 1.6, when: { bottom: 'jeans' } });
  P('sweatsString', 'hips', 40.3, path('M 8 6 L 6 22 M 14 6 L 15 21'), { stroke: '$top2', lw: 2.4, when: { bottom: 'sweatpants' } });
  P('skirt', 'hips', 42, path('M -42 -12 L 40 -12 C 50 12 56 34 60 54 Q 0 66 -62 54 C -58 34 -52 12 -42 -12 Z'), { fill: '$bottom', when: { bottom: 'skirt' }, unless: { top: DRESS_TOPS } });
  P('skirtShade', 'hips', 42.1, rect(-80, -20, 30, 100), { fill: '$bottom-16', ...NOSTROKE, clip: 'skirt', when: { bottom: 'skirt' }, unless: { top: DRESS_TOPS } });
  P('longskirt', 'hips', 42, path('M -42 -12 L 40 -12 C 52 30 60 84 66 128 Q 0 140 -68 128 C -62 84 -54 30 -42 -12 Z'), { fill: '$bottom', when: { bottom: 'longskirt' }, unless: { top: DRESS_TOPS } });
  P('longskirtShade', 'hips', 42.1, path('M -90 -20 L -36 -20 Q -40 60 -44 150 L -90 150 Z'), { fill: '$bottom-16', ...NOSTROKE, clip: 'longskirt', when: { bottom: 'longskirt' }, unless: { top: DRESS_TOPS } });
  P('longskirtFolds', 'hips', 42.2, path('M 8 40 Q 12 90 10 132 M 36 60 Q 42 100 46 130'), { stroke: '$bottom-22', lw: 2.2, clip: 'longskirt', when: { bottom: 'longskirt' }, unless: { top: DRESS_TOPS } });
  // dresses (skirt part of the top)
  P('dressSkirt', 'hips', 42, path('M -42 -14 L 40 -14 C 54 22 62 52 66 84 Q 0 98 -68 84 C -64 52 -56 22 -42 -14 Z'), { fill: '$top', when: { top: 'dress' } });
  P('dressSkirtShade', 'hips', 42.1, rect(-90, -20, 34, 130), { fill: '$top-16', ...NOSTROKE, clip: 'dressSkirt', when: { top: 'dress' } });
  P('dressHem', 'hips', 42.2, path('M -70 74 Q 0 88 70 74 L 70 100 L -70 100 Z'), { fill: '$top2', ...NOSTROKE, clip: 'dressSkirt', when: { top: 'dress' } });
  P('sundressSkirt', 'hips', 42, path('M -42 -14 L 40 -14 C 56 18 64 46 70 74 Q 0 90 -72 74 C -66 46 -58 18 -42 -14 Z'), { fill: '$top', when: { top: 'sundress' } });
  P('sundressShade', 'hips', 42.1, rect(-90, -20, 36, 130), { fill: '$top-16', ...NOSTROKE, clip: 'sundressSkirt', when: { top: 'sundress' } });
  P('sundressDots', 'hips', 42.15, path(dots([[-20, 10], [12, 4], [34, 22], [-38, 36], [-8, 40], [24, 52], [52, 56], [-56, 64], [-22, 70], [8, 76], [40, 78]], 4.2)), { fill: '$top2', ...NOSTROKE, clip: 'sundressSkirt', when: { top: 'sundress' } });
  P('sundressFolds', 'hips', 42.2, path('M -14 30 Q -18 56 -22 80 M 22 34 Q 28 58 32 82'), { stroke: '$top-22', lw: 2, clip: 'sundressSkirt', when: { top: 'sundress' } });
  P('gownSkirt', 'hips', 42, path('M -42 -14 L 40 -14 C 54 30 66 100 74 146 Q 0 160 -76 146 C -68 100 -56 30 -42 -14 Z'), { fill: '$top', when: { top: 'gown' } });
  P('gownShade', 'hips', 42.1, path('M -100 -20 L -34 -20 Q -40 70 -40 170 L -100 170 Z'), { fill: '$top-16', ...NOSTROKE, clip: 'gownSkirt', when: { top: 'gown' } });
  P('gownSheen', 'hips', 42.15, path('M 20 10 Q 34 70 46 150 L 56 150 Q 44 70 28 10 Z'), { fill: '#ffffff', alpha: 0.14, ...NOSTROKE, clip: 'gownSkirt', when: { top: 'gown' } });
  P('gownFolds', 'hips', 42.2, path('M -10 40 Q -14 100 -18 156 M 12 50 Q 16 100 18 156 M -46 80 Q -52 120 -56 152'), { stroke: '$top-20', lw: 2.2, clip: 'gownSkirt', when: { top: 'gown' } });

  // belt shown over a tucked-in shirt (drawn above the torso hem)
  P('beltTucked', 'hips', 51, path('M -45 0 C -20 -4 20 -4 43 0 L 43 10 C 20 6 -20 6 -45 10 Z'), { fill: '$bottom-30', when: { top: tops((t) => t.belt), bottom: BELTED } });
  P('beltBuckle', 'hips', 51.1, rect(18, -2, 12, 11, 2), { fill: GOLD, lw: 2.2, when: { top: tops((t) => t.belt), bottom: BELTED } });
  // coat tails / robe / apron skirt: drawn above the torso so the hem line doesn't cut across them
  P('labTailN', 'hips', 43, path('M -46 -14 L 2 -14 L 6 98 Q -22 104 -52 98 Z'), { fill: LAB, when: { top: 'labcoat' } });
  P('labTailNSh', 'hips', 43.02, rect(-70, -20, 26, 130), { fill: dk(LAB, 14), ...NOSTROKE, clip: 'labTailN', when: { top: 'labcoat' } });
  P('labTailF', 'hips', 43, path('M 16 -14 L 44 -14 L 52 96 Q 36 100 20 98 Z'), { fill: LAB, when: { top: 'labcoat' } });
  P('labPocket', 'hips', 43.05, path('M 24 30 L 46 30 L 47 52 L 25 52 Z'), { fill: dk(LAB, 5), lw: 2.4, when: { top: 'labcoat' } });
  P('coatTail', 'hips', 43, path('M -46 -14 L 44 -14 C 48 30 52 70 56 104 Q 0 114 -58 104 C -54 70 -50 30 -46 -14 Z'), { fill: '$top', when: { top: 'coat' } });
  P('coatTailSh', 'hips', 43.02, path('M -80 -20 L -32 -20 Q -36 50 -36 120 L -80 120 Z'), { fill: '$top-16', ...NOSTROKE, clip: 'coatTail', when: { top: 'coat' } });
  P('coatTailEdge', 'hips', 43.04, path('M 30 -14 L 36 110'), { lw: 2.6, clip: 'coatTail', when: { top: 'coat' } });
  P('coatTailButtons', 'hips', 43.05, path(dots([[24, 10], [24, 32]], 3)), { fill: '$top-35', ...NOSTROKE, when: { top: 'coat' } });
  P('robeTail', 'hips', 43, path('M -46 -14 L 44 -14 C 46 40 48 80 52 116 Q 0 126 -54 116 C -52 80 -50 40 -46 -14 Z'), { fill: '$top', when: { top: 'robe' } });
  P('robeTailSh', 'hips', 43.02, path('M -80 -20 L -32 -20 Q -36 50 -36 130 L -80 130 Z'), { fill: '$top-16', ...NOSTROKE, clip: 'robeTail', when: { top: 'robe' } });
  P('robeTrim', 'hips', 43.04, path('M 24 -14 L 34 -14 L 42 130 L 32 130 Z'), { fill: '$top2', clip: 'robeTail', when: { top: 'robe' } });
  P('apronSkirt', 'hips', 51.1, path('M -30 -18 L 38 -18 C 40 10 42 40 44 68 Q 6 76 -34 68 C -32 40 -31 10 -30 -18 Z'), { fill: '$top2', when: { top: 'apron' } });
  P('apronSkirtSh', 'hips', 51.12, rect(-60, -20, 40, 100), { fill: '$top2-14', ...NOSTROKE, clip: 'apronSkirt', when: { top: 'apron' } });
  P('apronPocket', 'hips', 51.14, path('M -12 24 L 28 24 L 28 44 Q 8 48 -12 44 Z M 8 24 L 8 46'), { fill: '$top2-6', lw: 2.4, when: { top: 'apron' } });

  // ---- torso / tops ----------------------------------------------------------------------------
  P('neck', 'neck', 48, rect(-11, -18, 24, 30, 6), { fill: '$skin' });
  P('neckShade', 'neck', 48.1, path('M -14 -20 L 16 -20 L 16 -6 Q 0 0 -14 -10 Z'), { fill: '$skin-18', ...NOSTROKE, clip: 'neck' });
  // collar band behind the neck (shirt collars / stand collars)
  const COLLARED = tops((t) => t.collar);
  P('collarBack', 'torso', 47.5, path('M -13 -114 C -14 -134 24 -136 24 -114 Z'), { fill: '$top-12', when: { top: COLLARED.filter((t) => t !== 'denim') } });
  P('collarBackDenim', 'torso', 47.5, path('M -15 -114 C -16 -136 26 -138 26 -114 Z'), { fill: '$top-12', when: { top: 'denim' } });
  P('standCollarBack', 'torso', 47.5, path('M -13 -114 C -14 -132 24 -134 24 -114 Z'), { fill: '$top-12', when: { top: ['jacket', 'varsity'] } });

  const TORSO = path('M -38 -116 C -16 -122 18 -122 38 -114 C 48 -108 50 -94 48 -78 L 42 -10 C 40 2 30 8 18 8 L -26 8 C -38 8 -44 0 -44 -12 L -50 -82 C -52 -100 -50 -112 -38 -116 Z');
  const PUFF = path('M -42 -118 C -18 -126 20 -126 42 -116 C 54 -110 56 -94 54 -76 L 49 -4 C 47 10 34 16 20 16 L -28 16 C -42 16 -50 8 -50 -6 L -56 -80 C -58 -100 -56 -114 -42 -118 Z');
  const SHADE_D = path('M -70 -130 L -26 -130 Q -34 -60 -22 20 L -70 20 Z');
  // torso fill by colour (clip shape is always 'torso'); puffer has its own bigger silhouette
  P('torso', 'torso', 50, TORSO, { fill: '$top', when: { top: tops((t, id) => t.base === '$top' && id !== 'puffer') } });
  P('torsoShade', 'torso', 50.1, SHADE_D, { fill: '$top-16', ...NOSTROKE, clip: 'torso', when: { top: tops((t, id) => t.base === '$top' && id !== 'puffer') } });
  P('torsoTee2', 'torso', 50, TORSO, { fill: '$top2', when: { top: tops((t) => t.base === '$top2') } });
  P('torsoTee2Shade', 'torso', 50.1, SHADE_D, { fill: '$top2-16', ...NOSTROKE, clip: 'torso', when: { top: tops((t) => t.base === '$top2') } });
  P('torsoLab', 'torso', 50, TORSO, { fill: LAB, when: { top: 'labcoat' } });
  P('torsoLabShade', 'torso', 50.1, SHADE_D, { fill: dk(LAB, 14), ...NOSTROKE, clip: 'torso', when: { top: 'labcoat' } });
  P('torsoPuff', 'torso', 50, PUFF, { fill: '$top', when: { top: 'puffer' } });
  P('torsoPuffShade', 'torso', 50.1, path('M -80 -130 L -30 -130 Q -38 -60 -26 30 L -80 30 Z'), { fill: '$top-16', ...NOSTROKE, clip: 'torsoPuff', when: { top: 'puffer' } });
  P('torsoLight', 'torso', 50.15, ell(26, -88, 12, 26, -8), { fill: '#ffffff', alpha: 0.12, ...NOSTROKE, clip: 'torso', when: { top: ['tee', 'longsleeve', 'hoodie', 'sweater', 'suit', 'dress', 'graphictee', 'tank', 'polo', 'sundress', 'gown', 'varsity', 'coat'] } });

  // necklines
  P('neckline', 'torso', 50.3, ell(5, -119, 17, 11), { fill: '$skin', clip: 'torso', when: { top: tops((t) => t.neck === 'crew') } });
  P('necklineScoop', 'torso', 50.3, ell(5, -116, 22, 16), { fill: '$skin', clip: 'torso', when: { top: 'tank' } });
  P('necklineVee', 'torso', 50.3, path('M -6 -126 L 18 -126 L 7 -104 Z'), { fill: '$skin', clip: 'torso', when: { top: tops((t) => t.neck === 'vee') } });
  P('collarRib', 'torso', 50.35, path('M -13 -117 Q 5 -102 23 -117'), { stroke: '$top-22', lw: 4, when: { top: ['sweater', 'longsleeve'] } });
  // sleeveless: armholes + bodices
  P('armholeF', 'torso', 50.32, ell(43, -101, 8, 15, -8), { fill: '$skin', clip: 'torso', when: { top: 'tank' } });
  P('armholeN', 'torso', 50.32, ell(-48, -104, 9, 15, 8), { fill: '$skin', clip: 'torso', when: { top: 'tank' } });
  P('bodiceSkin', 'torso', 50.3, path('M -80 -160 L 80 -160 L 80 -98 C 40 -90 -30 -90 -80 -98 Z'), { fill: '$skin', clip: 'torso', when: { top: ['sundress', 'gown'] } });
  P('bodiceSkinShade', 'torso', 50.31, path('M -80 -160 L -30 -160 L -32 -95 C -50 -96 -66 -97 -80 -98 Z'), { fill: '$skin-14', ...NOSTROKE, clip: 'torso', when: { top: ['sundress', 'gown'] } });
  P('straps', 'torso', 50.36, path('M -24 -119 L -20 -94 M 32 -117 L 30 -94'), { stroke: '$top', lw: 5.5, when: { top: ['sundress', 'gown'] } });
  P('bodiceTrim', 'torso', 50.37, path('M -60 -97 C -20 -90 30 -90 60 -97 L 60 -92 C 30 -85 -20 -85 -60 -92 Z'), { fill: '$top2', ...NOSTROKE, clip: 'torso', when: { top: 'sundress' } });

  // waistbands / hems
  P('waistband', 'torso', 50.4, path('M -48 -6 L 46 -6 L 46 10 L -48 10 Z'), { fill: '$top-10', ...NOSTROKE, clip: 'torso', when: { top: ['sweater', 'hoodie', 'jacket', 'cardigan'] } });
  P('waistbandVarsity', 'torso', 50.4, path('M -48 -10 L 46 -10 L 46 10 L -48 10 Z M -48 -4 L 46 -4 L 46 0 L -48 0 Z'), { fill: '$top2', ...NOSTROKE, clip: 'torso', when: { top: 'varsity' } });
  P('waistbandDenim', 'torso', 50.4, path('M -48 -8 L 46 -8 L 46 10 L -48 10 Z'), { fill: '$top-8', clip: 'torso', when: { top: 'denim' } });
  P('waistbandPuff', 'torso', 50.4, path('M -60 4 L 60 4 L 60 20 L -60 20 Z'), { fill: '$top-12', ...NOSTROKE, clip: 'torsoPuff', when: { top: 'puffer' } });

  // graphic tee
  P('graphicBand', 'torso', 50.45, path('M -60 -88 L 60 -88 L 60 -64 L -60 -64 Z'), { fill: '$top2', ...NOSTROKE, clip: 'torso', when: { top: 'graphictee' } });
  P('graphicStripe', 'torso', 50.46, path('M -60 -79 L 60 -79 L 60 -73 L -60 -73 Z'), { fill: '$accent', ...NOSTROKE, clip: 'torso', when: { top: 'graphictee' } });
  P('graphicStar', 'torso', 50.47, path(star(22, -44, 10, 4.4)), { fill: '$accent', lw: 2.2, when: { top: 'graphictee' } });
  // sweater stripes
  P('sweaterStripes', 'torso', 50.45, path('M -60 -84 L 60 -84 L 60 -72 L -60 -72 Z M -60 -54 L 60 -54 L 60 -42 L -60 -42 Z'), { fill: '$top2', ...NOSTROKE, clip: 'torso', when: { top: 'sweater' } });
  // hoodie
  P('hood', 'torso', 58, path('M -48 -110 C -54 -134 30 -140 42 -112 C 30 -104 -32 -100 -48 -110 Z'), { fill: '$top2', when: { top: 'hoodie' } });
  P('hoodieStrings', 'torso', 50.5, path('M -2 -108 L -4 -80 M 14 -108 L 15 -82'), { stroke: '$top2', lw: 3, when: { top: 'hoodie' } });
  P('hoodiePocket', 'torso', 50.5, path('M -26 -40 L 30 -40 L 36 -8 L -30 -8 Z'), { fill: '$top-8', when: { top: 'hoodie' } });
  // suit
  P('suitShirt', 'torso', 50.5, path('M -12 -122 L 24 -122 L 8 -60 Z'), { fill: WHITE, clip: 'torso', when: { top: 'suit' } });
  P('suitTie', 'torso', 50.6, path('M 3 -114 L 13 -114 L 15 -104 L 18 -70 L 8 -60 L 0 -70 L 2 -104 Z'), { fill: '$top2', when: { top: 'suit' } });
  P('suitLapels', 'torso', 50.7, path('M -14 -118 L 6 -60 M 26 -118 L 9 -60'), { lw: 3, when: { top: 'suit' } });
  P('suitButtons', 'torso', 50.7, path('M 8 -44 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 M 9 -26 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'), { fill: '$top-30', ...NOSTROKE, when: { top: 'suit' } });
  // overalls
  P('overallsBib', 'torso', 50.5, path('M -28 -76 L 34 -76 L 38 10 L -34 10 Z'), { fill: '$bottom', when: { top: 'overalls' } });
  P('overallsStraps', 'torso', 50.6, path('M -34 -116 L -24 -76 M 32 -114 L 28 -76'), { stroke: '$bottom', lw: 9, when: { top: 'overalls' } });
  P('overallsButtons', 'torso', 50.7, path('M -24 -72 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 M 28 -72 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0'), { fill: '$accent', when: { top: 'overalls' } });
  P('overallsPocket', 'torso', 50.6, rect(-8, -62, 26, 22, 4), { fill: '$bottom-10', when: { top: 'overalls' } });
  // dress waist
  P('dressSash', 'torso', 50.6, path('M -48 -18 L 46 -18 L 46 -4 L -48 -4 Z'), { fill: '$top2', ...NOSTROKE, clip: 'torso', when: { top: ['dress', 'gown'] } });

  // open fronts: the inner shirt is a strip painted over the garment (its outline = the garment's edges)
  const GAPS = {
    jacket: ['$top2', 'M -4 -130 L 16 -130 L 21 14 L -1 14 Z'],
    denim: ['$top2', 'M -3 -130 L 15 -130 L 19 14 L 1 14 Z'],
    cardigan: ['$top2', 'M -10 -130 L 22 -130 L 7 -38 Z'],
    blazer: ['$top2', 'M -12 -130 L 24 -130 L 8 -46 Z M 8 -26 L 15 14 L 0 14 Z'],
    labcoat: ['$top', 'M -10 -130 L 22 -130 L 13 -50 L 17 14 L 2 14 L 6 -50 Z'],
  };
  for (const [id, [c, d]] of Object.entries(GAPS)) {
    P(`gap_${id}`, 'torso', 50.5, path(d), { fill: c, clip: 'torso', when: { top: id } });
    P(`gap_${id}Neck`, 'torso', 50.52, ell(5, -120, 16, 10), { fill: '$skin', clip: `gap_${id}`, when: { top: id } });
  }
  // zip jacket
  P('jacketZip', 'torso', 50.55, path('M -2 -114 L 1 6 M 18 -114 L 20 6'), { stroke: '$top-32', lw: 2, when: { top: 'jacket' } });
  P('jacketCollar', 'torso', 56, path('M -14 -114 C -16 -126 -8 -128 -4 -124 L -2 -112 Z M 24 -114 C 26 -126 20 -128 16 -124 L 16 -112 Z'), { fill: '$top-8', when: { top: 'jacket' } });
  // cardigan
  P('cardiganButtons', 'torso', 50.6, path(dots([[7, -28], [8, -12]], 3.2)), { fill: '$accent', lw: 1.8, when: { top: 'cardigan' } });
  P('cardiganLine', 'torso', 50.55, path('M 7 -38 L 9 10'), { lw: 2.2, when: { top: 'cardigan' } });
  P('cardiganPocket', 'torso', 50.56, path('M 18 -40 L 38 -40 L 37 -20 L 19 -20 Z'), { fill: '$top-6', lw: 2.2, when: { top: 'cardigan' } });
  // blazer
  P('blazerLapelN', 'torso', 50.6, path('M -12 -122 L -20 -100 L -12 -97 L 6 -48 L 8 -48 L -6 -122 Z'), { fill: '$top-10', when: { top: 'blazer' } });
  P('blazerLapelF', 'torso', 50.6, path('M 24 -122 L 28 -102 L 22 -99 L 10 -48 L 8 -48 L 18 -122 Z'), { fill: '$top-10', when: { top: 'blazer' } });
  P('blazerButton', 'torso', 50.65, path(dots([[8, -36]], 3.4)), { fill: '$top-30', ...NOSTROKE, when: { top: 'blazer' } });
  P('blazerSquare', 'torso', 50.62, path('M 24 -82 L 30 -90 L 34 -84 L 38 -88 L 38 -80 L 24 -80 Z'), { fill: '$accent', lw: 2, when: { top: 'blazer' } });
  P('blazerPocket', 'torso', 50.63, path('M 22 -80 L 40 -80'), { lw: 2.4, when: { top: 'blazer' } });
  // denim jacket
  P('denimYoke', 'torso', 50.55, path('M -50 -94 Q -20 -88 -2 -92 M 20 -92 Q 36 -88 50 -94'), { stroke: '$top+30', lw: 1.6, clip: 'torso', when: { top: 'denim' } });
  P('denimPockets', 'torso', 50.56, path('M -30 -86 L -10 -86 L -10 -70 L -20 -66 L -30 -70 Z M 24 -86 L 40 -86 L 40 -70 L 32 -66 L 24 -70 Z'), { fill: '$top-8', lw: 2.2, when: { top: 'denim' } });
  P('denimSeams', 'torso', 50.57, path('M -20 -66 L -22 -10 M 32 -66 L 33 -10'), { stroke: '$top+30', lw: 1.6, when: { top: 'denim' } });
  P('denimButtons', 'torso', 50.58, path(dots([[-20, -76], [32, -76], [-3, -60], [-3, -30]], 2.6)), { fill: '#c58a3a', ...NOSTROKE, when: { top: 'denim' } });
  // lab coat
  P('labLapelN', 'torso', 50.6, path('M -10 -124 L -18 -100 L -10 -96 L 6 -50 L 7 -50 L -4 -124 Z'), { fill: dk(LAB, 8), when: { top: 'labcoat' } });
  P('labLapelF', 'torso', 50.6, path('M 22 -124 L 26 -102 L 20 -98 L 12 -50 L 13 -50 L 18 -124 Z'), { fill: dk(LAB, 8), when: { top: 'labcoat' } });
  P('labPen', 'torso', 50.62, path('M 28 -88 L 31 -88 L 31 -74 L 28 -74 Z'), { fill: '$accent', lw: 1.8, when: { top: 'labcoat' } });
  P('labBreast', 'torso', 50.63, path('M 24 -78 L 42 -78 L 41 -62 L 25 -62 Z'), { fill: dk(LAB, 5), lw: 2.2, when: { top: 'labcoat' } });
  // shirt collars (front flaps; the band behind the neck is collarBack)
  const COLLAR_FLAPS = 'M -12 -122 C -14 -114 -10 -108 -4 -102 L 7 -110 C 3 -114 -2 -118 -4 -126 Z M 23 -124 C 25 -116 23 -110 19 -104 L 7 -110 C 11 -114 14 -118 15 -126 Z';
  P('collar', 'torso', 56, path(COLLAR_FLAPS), { fill: '$top', when: { top: ['polo', 'buttonup', 'uniform'] } });
  P('collarDenim', 'torso', 56, path('M -14 -122 C -18 -112 -14 -104 -6 -96 L 2 -112 C -1 -116 -4 -120 -5 -126 Z M 24 -124 C 28 -114 26 -106 20 -98 L 14 -112 C 16 -116 16 -120 16 -126 Z'), { fill: '$top-6', when: { top: 'denim' } });
  P('collarCoat', 'torso', 56, path('M -16 -122 C -22 -110 -18 -96 -8 -84 L 7 -104 C 2 -110 -2 -118 -4 -126 Z M 24 -124 C 30 -112 30 -100 24 -88 L 7 -104 C 11 -110 14 -118 16 -126 Z'), { fill: '$top-8', when: { top: 'coat' } });
  P('poloPlacket', 'torso', 50.6, path('M 3 -108 L 11 -108 L 11 -84 L 3 -84 Z'), { fill: '$top-6', lw: 2.2, when: { top: 'polo' } });
  P('poloButtons', 'torso', 50.65, path(dots([[7, -100], [7, -90]], 2)), { fill: '$top2', ...NOSTROKE, when: { top: 'polo' } });
  P('shirtPlacket', 'torso', 50.55, path('M 7 -104 L 9 8'), { lw: 2, when: { top: ['buttonup', 'uniform'] } });
  P('shirtButtons', 'torso', 50.6, path(dots([[7.5, -90], [8, -64], [8.5, -38], [9, -14]], 2.2)), { fill: '$top-30', ...NOSTROKE, when: { top: 'buttonup' } });
  P('shirtPocket', 'torso', 50.6, path('M 18 -86 L 34 -86 L 34 -70 L 26 -66 L 18 -70 Z'), { fill: '$top-4', lw: 2.2, when: { top: 'buttonup' } });
  // uniform
  P('uniformPockets', 'torso', 50.6, path('M -32 -84 L -14 -84 L -14 -64 L -32 -64 Z M 22 -84 L 40 -84 L 40 -64 L 22 -64 Z'), { fill: '$top-4', lw: 2.2, when: { top: 'uniform' } });
  P('uniformFlaps', 'torso', 50.62, path('M -33 -86 L -13 -86 L -13 -78 L -23 -75 L -33 -78 Z M 21 -86 L 41 -86 L 41 -78 L 31 -75 L 21 -78 Z'), { fill: '$top-10', lw: 2.2, when: { top: 'uniform' } });
  P('uniformBadge', 'torso', 50.66, path('M 31 -102 L 37 -98 L 37 -91 Q 31 -86 31 -86 Q 25 -90 25 -91 L 25 -98 Z'), { fill: GOLD, lw: 2, when: { top: 'uniform' } });
  P('uniformTie', 'torso', 50.64, path('M 4 -106 L 11 -106 L 12 -100 L 14 -64 L 8 -56 L 2 -64 L 3 -100 Z'), { fill: '$top-38', lw: 2.2, when: { top: 'uniform' } });
  P('uniformEpaulet', 'torso', 50.67, path('M 24 -116 L 44 -112 L 44 -105 L 24 -109 Z'), { fill: '$top-14', lw: 2, when: { top: 'uniform' } });
  // varsity jacket: rib collar, snaps, letter patch
  P('varsityRibCollar', 'torso', 56, path('M -14 -114 C -10 -104 20 -104 24 -114 L 24 -108 C 20 -98 -10 -98 -14 -108 Z'), { fill: '$top2', when: { top: 'varsity' } });
  P('varsitySnaps', 'torso', 50.6, path(dots([[7, -90], [7.5, -66], [8, -42], [8.5, -18]], 3)), { fill: '$accent', lw: 1.6, when: { top: 'varsity' } });
  P('varsityLine', 'torso', 50.55, path('M 6 -104 L 9 8'), { lw: 2, when: { top: 'varsity' } });
  P('varsityPatch', 'torso', 50.62, path('M 20 -88 L 40 -88 L 40 -64 L 20 -64 Z'), { fill: '$accent', lw: 2.4, when: { top: 'varsity' } });
  P('varsityLetter', 'torso', 50.64, path('M 24 -84 L 30 -68 L 36 -84'), { stroke: '$top', lw: 3.4, when: { top: 'varsity' } });
  // puffer: quilt lines, zip and a high collar
  P('puffQuilt', 'torso', 50.45, path('M -60 -90 Q 0 -84 60 -90 M -60 -60 Q 0 -54 60 -60 M -60 -30 Q 0 -24 60 -30'), { stroke: '$top-24', lw: 2.6, clip: 'torsoPuff', when: { top: 'puffer' } });
  P('puffZip', 'torso', 50.55, path('M 7 -116 L 9 14'), { stroke: '$top-32', lw: 2.4, when: { top: 'puffer' } });
  P('puffCollar', 'torso', 56, path('M -16 -110 C -18 -134 30 -138 30 -110 L 28 -104 C 16 -98 -4 -98 -14 -104 Z'), { fill: '$top', when: { top: 'puffer' } });
  P('puffCollarSh', 'torso', 56.1, rect(-40, -140, 30, 50), { fill: '$top-16', ...NOSTROKE, clip: 'puffCollar', when: { top: 'puffer' } });
  // coat: double-breasted buttons + belt
  P('coatButtons', 'torso', 50.6, path(dots([[14, -76], [30, -74], [16, -50], [32, -48]], 3)), { fill: '$top-35', ...NOSTROKE, when: { top: 'coat' } });
  P('coatEdge', 'torso', 50.55, path('M 7 -104 Q 22 -96 24 -84 L 30 10'), { lw: 2.4, clip: 'torso', when: { top: 'coat' } });
  P('coatBelt', 'torso', 51.2, path('M -50 -8 L 50 -8 L 50 12 L -50 12 Z'), { fill: '$top-18', clip: 'torso', when: { top: 'coat' } });
  P('coatBuckle', 'torso', 51.3, rect(20, -11, 14, 20, 2), { fill: null, stroke: '$top-40', lw: 3, when: { top: 'coat' } });
  // apron bib + ties
  P('apronStraps', 'torso', 50.55, path('M -12 -86 L -16 -118 M 30 -86 L 30 -116'), { stroke: '$top2', lw: 4.5, when: { top: 'apron' } });
  P('apronBib', 'torso', 50.6, path('M -16 -88 L 34 -88 L 36 10 L -20 10 Z'), { fill: '$top2', when: { top: 'apron' } });
  P('apronBibSh', 'torso', 50.62, rect(-40, -100, 30, 120), { fill: '$top2-14', ...NOSTROKE, clip: 'apronBib', when: { top: 'apron' } });
  P('apronTie', 'torso', 51.3, path('M -48 -22 L 46 -22 L 46 -12 L -48 -12 Z'), { fill: '$top2-10', clip: 'torso', when: { top: 'apron' } });
  // robe / kimono wrap
  P('robeVee', 'torso', 50.3, path('M -8 -128 L 20 -128 L 12 -98 Z'), { fill: '$skin', clip: 'torso', when: { top: 'robe' } });
  P('robeCollar', 'torso', 50.6, path('M -10 -124 L -2 -124 L 30 -20 L 20 -20 Z M 20 -124 L 26 -124 L 16 -96 L 12 -98 Z'), { fill: '$top2', clip: 'torso', when: { top: 'robe' } });
  P('robeSash', 'torso', 51.3, path('M -50 -22 L 50 -22 L 50 12 L -50 12 Z'), { fill: '$top2', clip: 'torso', when: { top: 'robe' } });
  P('robeSashSh', 'torso', 51.31, rect(-70, -30, 26, 50), { fill: '$top2-16', ...NOSTROKE, clip: 'robeSash', when: { top: 'robe' } });
  P('robeKnot', 'torso', 51.35, path('M 26 -16 L 38 2 L 32 26 L 25 24 L 28 4 Z'), { fill: '$top2-8', lw: 2.4, when: { top: 'robe' } });

  // re-stroke the silhouette over everything painted inside it
  P('torsoEdge', 'torso', 50.95, TORSO, { fill: null, unless: { top: 'puffer' } });
  P('torsoPuffEdge', 'torso', 50.95, PUFF, { fill: null, when: { top: 'puffer' } });
}

/** Circles as one path (buttons, polka dots). */
function dots(list, r) {
  return list.map(([x, y]) => `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`).join(' ');
}
/** Five-point star path. */
function star(cx, cy, R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'} ${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
}
