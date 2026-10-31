// Head + face: head shape, ears, cheeks, eyes (lids/gaze), nose, mouths, brows, facial hair, eyewear, moods.
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
export const slots = {
  eyes: { default: 'open', options: ['open', 'happy', 'closed'] },
  brows: { default: 'neutral', options: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried'] },
  mouth: { default: 'rest', options: ['rest', 'smile', 'grin', 'sad', 'frown', 'mbp', 'ee', 'ah', 'oh', 'oo', 'fv', 'half', 'wow'] },
  lashes: { default: 'none', options: ['none', 'lashes'] },
  facial: { default: 'none', options: ['none', 'stubble', 'mustache', 'beard'] },
  eyewear: { default: 'none', options: ['none', 'glasses', 'round', 'sunglasses'] },
};

// mood -> face slot options + eyelid weight (lid 0 = wide open, 1 = closed)
export const moods = {
  neutral: { eyes: 'open', brows: 'neutral', mouth: 'rest' },
  happy: { eyes: 'open', brows: 'happy', mouth: 'smile' },
  joy: { eyes: 'happy', brows: 'happy', mouth: 'grin' },
  sad: { eyes: 'open', brows: 'sad', mouth: 'sad', lid: 0.22 },
  angry: { eyes: 'open', brows: 'angry', mouth: 'frown', lid: 0.3 },
  surprised: { eyes: 'open', brows: 'surprised', mouth: 'wow', lid: 0 },
  worried: { eyes: 'open', brows: 'worried', mouth: 'frown', lid: 0.1 },
  sleepy: { eyes: 'open', brows: 'neutral', mouth: 'rest', lid: 0.55 },
};

export function addFace(ctx) {
  const { P, rect, ell, path, NOSTROKE } = ctx;
  const HAIR = { fill: '$hair' };
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
}
