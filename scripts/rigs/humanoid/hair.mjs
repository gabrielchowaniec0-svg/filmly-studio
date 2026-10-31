// Hair (back + front layers, ponytail, bun) and headwear.
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
export const slots = {
  hair: { default: 'short', options: ['short', 'spiky', 'swoop', 'buzz', 'bob', 'long', 'ponytail', 'bun', 'curly', 'bald'] },
  headwear: { default: 'none', options: ['none', 'beanie', 'cap', 'bow', 'headband', 'headphones', 'flower'] },
};

export function addHairBack(ctx) {
  const { P, rect, ell, path, NOSTROKE, bumpy, shiftY } = ctx;
  // ---- hair (behind head) --------------------------------------------------------------------
  const HAIR = { fill: '$hair' };
  // hair bone sits at head (0,-70); back-hair shapes are written in head space then shifted by +70
  const HB = (d) => path(shiftY(d, 70));

  P('hairBackBob', 'hair', 5, HB('M -70 -64 C -78 -120 -36 -150 8 -148 C 56 -146 80 -118 78 -72 C 78 -44 74 -20 66 -4 Q 0 8 -66 -4 C -74 -24 -74 -44 -70 -64 Z'), { ...HAIR, slot: 'hair', option: 'bob' });
  P('hairBackLong', 'hair', 5, HB('M -70 -64 C -78 -120 -36 -150 8 -148 C 56 -146 80 -118 78 -72 C 80 -30 78 10 72 44 Q 52 58 32 46 L -40 46 Q -62 58 -76 44 C -82 4 -76 -30 -70 -64 Z'), { ...HAIR, slot: 'hair', option: 'long' });
  P('hairBackLongShade', 'hair', 5.1, HB('M -90 -40 L -40 -40 Q -48 10 -40 70 L -90 70 Z'), { fill: '$hair-18', ...NOSTROKE, clip: 'hairBackLong', slot: 'hair', option: 'long' });
  P('hairBackCurly', 'hair', 5, HB(bumpy(2, -96, 82, -200, 20, 15, 12) + ' Q 30 -20 2 -16 Q -30 -20 -76 -64 Z'), { ...HAIR, slot: 'hair', option: 'curly' });
  P('ponytail', 'tail', 5, path('M 4 -6 C -20 -2 -36 20 -38 50 C -40 80 -28 102 -14 110 C -20 84 -14 52 0 26 C 8 12 12 2 4 -6 Z'), { ...HAIR, slot: 'hair', option: 'ponytail' });
  P('ponytailTie', 'tail', 5.2, ell(2, -2, 9, 7, -20), { fill: '$accent', slot: 'hair', option: 'ponytail' });
  P('bun', 'head', 65, ell(-24, -138, 25, 22), { ...HAIR, slot: 'hair', option: 'bun' });
  P('bunShade', 'head', 65.1, ell(-30, -132, 22, 14), { fill: '$hair-18', ...NOSTROKE, clip: 'bun', slot: 'hair', option: 'bun' });

}

export function addHairFront(ctx) {
  const { P, rect, ell, path, NOSTROKE, bumpy } = ctx;
  const HAIR = { fill: '$hair' };
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
}
