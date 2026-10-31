// Body + clothing: arms, hands, legs, shoes, hips/bottoms, torso/tops.
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
export const slots = {
  top: { default: 'tee', options: ['tee', 'longsleeve', 'hoodie', 'sweater', 'suit', 'overalls', 'dress'] },
  bottom: { default: 'pants', options: ['pants', 'shorts', 'skirt', 'bare'] },
  handF: { default: 'open', options: ['open', 'fist', 'point'] },
  handN: { default: 'open', options: ['open', 'fist', 'point'] },
};

const LONG_SLEEVES = ['longsleeve', 'hoodie', 'sweater', 'suit'];
const SHORT_SLEEVES = ['tee', 'overalls', 'dress'];

export function addBody(ctx, { near = false } = {}) {
  const { P, rect, ell, path, NOSTROKE } = ctx;
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
  if (near) { arm('N', 100); return; }
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
  P('hood', 'torso', 58, path('M -48 -110 C -54 -134 30 -140 42 -112 C 30 -104 -32 -100 -48 -110 Z'), { fill: '$top2', when: { top: 'hoodie' } });
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

}
