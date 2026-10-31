// Head + face: head shape, ears, cheeks, eyes (lids/gaze), nose, mouths, brows, facial hair, eyewear, moods.
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
//
// 3/4-view layout in head-bone space (origin = top of neck):
//   cranium top y -130 · back of head x -62 · cheek front x 66 · chin (≈18, 0)
//   near eye centre (-10,-66) · far eye centre (30,-65.5) · nose tip (≈39,-42) · mouth centre (≈22,-28)
//   ear on the back side, centre (≈-50,-62), front edge tucked into the head at x ≈ -40
// Light comes from the front (screen-right): the back of the head and the near side of the nose are shaded.
export const slots = {
  eyes: { default: 'open', options: ['open', 'happy', 'closed'] },
  brows: { default: 'neutral', options: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried'] },
  mouth: { default: 'rest', options: ['rest', 'smile', 'grin', 'sad', 'frown', 'mbp', 'ee', 'ah', 'oh', 'oo', 'fv', 'half', 'wow'] },
  lashes: { default: 'none', options: ['none', 'lashes'] },
  facial: { default: 'none', options: ['none', 'stubble', 'mustache', 'beard'] },
  eyewear: { default: 'none', options: ['none', 'glasses', 'round', 'sunglasses'] },
  browStyle: { default: 'medium', options: ['medium', 'thin', 'thick'] },
  freckles: { default: 'none', options: ['none', 'freckles'] },
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

const f1 = (v) => (Math.round(v * 10) / 10).toString();

/**
 * Tapered upper lash line hugging the top of an eye ellipse: thick at the outer corner, thin at the inner one.
 * outerLeft = true when the outer corner is at -x (near eye).
 */
function lashLine(cx, cy, rx, ry, tOuter, tInner, outerLeft) {
  const N = 12, a = [], b = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N; // 0 = outer corner, 1 = inner corner
    const ang = Math.PI + (outerLeft ? u : 1 - u) * Math.PI; // top half of the ellipse (canvas angles)
    const t = tOuter + (tInner - tOuter) * u;
    // inner edge sits slightly inside the eye outline so the line reads as one with it
    const x = cx + rx * Math.cos(ang), y = cy + ry * Math.sin(ang);
    const nx = Math.cos(ang) / rx, ny = Math.sin(ang) / ry, nl = Math.hypot(nx, ny);
    a.push([x - (nx / nl) * 0.8, y - (ny / nl) * 0.8]);
    b.push([x + (nx / nl) * t, y + (ny / nl) * t]);
  }
  const pts = a.concat(b.reverse());
  return 'M ' + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L ') + ' Z';
}

/** Small filled circles (freckles) as one path. */
const dots = (list) => list.map(([x, y, r]) => `M ${f1(x - r)} ${f1(y)} a ${r} ${r} 0 1 0 ${f1(2 * r)} 0 a ${r} ${r} 0 1 0 ${f1(-2 * r)} 0`).join(' ');

export function addFace(ctx) {
  const { P, rect, ell, path, NOSTROKE } = ctx;
  const HAIR = { fill: '$hair' };
  // ---- head ----------------------------------------------------------------------------------
  // Round cranium, soft cheek on the forward side, jaw tapering to a small chin slightly forward of centre.
  const HEAD = path('M 4 -130 C 42 -130 66 -106 66 -76 C 66 -60 64 -48 59 -36 C 52 -18 38 -3 18 0 C 8 1.5 -2 0 -12 -3 C -32 -9 -47 -22 -55 -38 C -61 -52 -63 -68 -60 -84 C -55 -113 -30 -130 4 -130 Z');
  P('head', 'head', 70, HEAD, { fill: '$skin' });
  P('headShade', 'head', 70.1, path('M -80 -140 L -38 -140 C -50 -104 -50 -50 -26 10 L -80 10 Z'), { fill: '$skin-9', ...NOSTROKE, clip: 'head' });
  P('jawShade', 'head', 70.15, path('M -46 -20 C -20 0 24 4 58 -26 L 70 10 L -60 10 Z'), { fill: '$skin-11', ...NOSTROKE, clip: 'head' });
  // ear: helix curls out past the back of the head, front edge tucked in; inner ear is a shaded "C" (concha)
  P('ear', 'head', 71, path('M -41 -77 C -47 -84 -59 -82 -62 -72 C -65 -62 -61 -51 -54 -46 C -49 -42.5 -43 -44 -41 -49 C -38.5 -57 -38.5 -69 -41 -77 Z'), { fill: '$skin' });
  P('earInner', 'head', 71.1, path('M -45 -72 C -52 -75.5 -57.5 -68 -56 -60.5 C -55 -56 -51.5 -53.5 -48 -54.5 C -50.5 -58 -50.5 -63 -46.5 -64.5 Z'), { fill: '$skin-16', lw: 2.2 });
  P('stubble', 'head', 72, path('M -46 -46 C -40 -16 -6 6 20 6 C 44 6 62 -14 70 -48 C 58 -40 50 -40 44 -37 C 34 -41 22 -41 14 -37 C 0 -41 -30 -44 -46 -46 Z'), { fill: '$hair', alpha: 0.26, ...NOSTROKE, clip: 'head', slot: 'facial', option: 'stubble' });
  P('cheekN', 'head', 73, ell(-23, -43, 11, 7), { fill: '$blush', alpha: 0.32, ...NOSTROKE });
  P('cheekF', 'head', 73, ell(52, -44, 8, 6), { fill: '$blush', alpha: 0.32, ...NOSTROKE, clip: 'head' });
  P('freckles', 'head', 73.1, path(dots([[-30, -48, 1.6], [-24, -51, 1.4], [-18, -47, 1.5], [-25, -44, 1.3], [-13, -51, 1.2], [44, -50, 1.3], [50, -47, 1.4], [55, -51, 1.2], [47, -43, 1.2], [26, -52, 1.1]])), { fill: '$skin-32', alpha: 0.75, ...NOSTROKE, clip: 'head', slot: 'freckles', option: 'freckles' });

  // ---- eyes ----------------------------------------------------------------------------------
  // near eye (screen-left) is wider; far eye is foreshortened. Lids hang from bones lidN/lidF (y -84 / -82).
  const EN = [-10, -66, 13.5, 16.5], EF = [30, -65.5, 10.5, 15.5];
  const EYE_N = ell(...EN), EYE_F = ell(...EF);
  const OPEN = { slot: 'eyes', option: 'open' };
  const iris = (cx, cy, r) => ({ radial: true, cx, cy: cy + r * 0.45, r0: 0, r: r * 1.35, stops: [[0, '$eye+38'], [0.5, '$eye'], [1, '$eye-35']] });
  P('eyeWhiteN', 'head', 80, EYE_N, { fill: '#ffffff', ...NOSTROKE, ...OPEN });
  P('eyeWhiteF', 'head', 80, EYE_F, { fill: '#ffffff', ...NOSTROKE, ...OPEN });
  P('eyeShadeN', 'head', 80.5, path('M -26 -90 L 6 -90 L 6 -72 C -2 -78 -18 -78 -26 -70 Z'), { fill: '#d9dbe6', ...NOSTROKE, clip: 'eyeWhiteN', ...OPEN });
  P('eyeShadeF', 'head', 80.5, path('M 18 -90 L 44 -90 L 44 -71 C 38 -77 24 -77 18 -70 Z'), { fill: '#d9dbe6', ...NOSTROKE, clip: 'eyeWhiteF', ...OPEN });
  P('irisN', 'gaze', 81, ell(-7, -64, 9, 10.5), { fill: iris(-7, -64, 10), ...NOSTROKE, clip: 'eyeWhiteN', ...OPEN });
  P('irisF', 'gaze', 81, ell(33, -64, 7, 10), { fill: iris(33, -64, 9.5), ...NOSTROKE, clip: 'eyeWhiteF', ...OPEN });
  P('pupilN', 'gaze', 82, ell(-6.5, -64, 4.6, 5.6), { fill: '#121218', ...NOSTROKE, clip: 'eyeWhiteN', ...OPEN });
  P('pupilF', 'gaze', 82, ell(33.5, -64, 3.6, 5.3), { fill: '#121218', ...NOSTROKE, clip: 'eyeWhiteF', ...OPEN });
  // one big catch-light up-left + a small bounce light low-right, per eye (one path each)
  P('glintN', 'gaze', 83, path(dots([[-10.5, -68.5, 3], [-3, -59.5, 1.4]])), { fill: '#ffffff', ...NOSTROKE, clip: 'eyeWhiteN', ...OPEN });
  P('glintF', 'gaze', 83, path(dots([[30.5, -68.5, 2.4], [36, -59.5, 1.1]])), { fill: '#ffffff', ...NOSTROKE, clip: 'eyeWhiteF', ...OPEN });
  P('lidN', 'lidN', 84, rect(-17, -1, 34, 38), { fill: '$skin-5', lw: 3, clip: 'eyeWhiteN', ...OPEN });
  P('lidF', 'lidF', 84, rect(-13, -1, 26, 36), { fill: '$skin-5', lw: 3, clip: 'eyeWhiteF', ...OPEN });
  P('eyeLineN', 'head', 85, EYE_N, { fill: null, lw: 2.4, ...OPEN });
  P('eyeLineF', 'head', 85, EYE_F, { fill: null, lw: 2.2, ...OPEN });
  P('lashTopN', 'head', 85.5, path(lashLine(...EN, 3.6, 1.2, true)), { fill: '$outline', ...NOSTROKE, ...OPEN });
  P('lashTopF', 'head', 85.5, path(lashLine(...EF, 3.2, 1.1, false)), { fill: '$outline', ...NOSTROKE, ...OPEN });
  // lashes option: two swept flicks at each outer corner
  P('lashesN', 'head', 85.6, path('M -21 -73 C -26 -75 -29 -78 -31 -83 C -27 -80 -24 -79 -19.5 -78 Z M -16.5 -78.5 C -20 -82 -22 -85 -22.5 -89.5 C -19.5 -86 -17 -84.5 -13.5 -82 Z'), { fill: '$outline', ...NOSTROKE, when: { lashes: 'lashes', eyes: 'open' } });
  P('lashesF', 'head', 85.6, path('M 38.5 -72 C 42 -74 44.5 -77 46 -82 C 43 -79 40.5 -78 37 -77 Z M 35.5 -77.5 C 38 -81 39.5 -84 40 -88.5 C 37.5 -85 35.5 -83.5 33 -81 Z'), { fill: '$outline', ...NOSTROKE, when: { lashes: 'lashes', eyes: 'open' } });
  // happy (^ ^) and closed (‿ ‿) eyes: tapered crescents
  P('eyeHappyN', 'head', 85, path('M -24 -61 Q -10 -82 4 -61 Q -10 -76 -24 -61 Z'), { fill: '$outline', lw: 3, slot: 'eyes', option: 'happy' });
  P('eyeHappyF', 'head', 85, path('M 19.5 -61 Q 30 -80 41 -61 Q 30 -74 19.5 -61 Z'), { fill: '$outline', lw: 2.8, slot: 'eyes', option: 'happy' });
  P('eyeClosedN', 'head', 85, path('M -24 -65 Q -10 -52 4 -65 Q -10 -56 -24 -65 Z'), { fill: '$outline', lw: 3, slot: 'eyes', option: 'closed' });
  P('eyeClosedF', 'head', 85, path('M 19.5 -65 Q 30 -53 41 -65 Q 30 -57 19.5 -65 Z'), { fill: '$outline', lw: 2.8, slot: 'eyes', option: 'closed' });

  // ---- nose ----------------------------------------------------------------------------------
  // A soft button nose between the eyes, pointing forward: shaded near side, small underside line, tip highlight.
  P('nose', 'head', 79.5, path('M 23 -56 C 27 -51 33 -48.5 37 -47 C 41 -45.5 41.5 -40.5 38 -39 C 34.5 -37.5 28 -38 24.5 -39.5 C 20.5 -41.5 19.5 -48 23 -56 Z'), { fill: '$skin-14', ...NOSTROKE });
  P('noseLine', 'head', 87.1, path('M 27 -40.5 C 30 -38.6 35 -38.6 38 -41'), { fill: null, lw: 2.5 });
  P('noseGlint', 'head', 87.2, ell(34.5, -44, 2.6, 1.7, 25), { fill: '#ffffff', alpha: 0.4, ...NOSTROKE });

  // ---- facial hair (under the mouth so lips stay readable) ----------------------------------------
  P('beard', 'head', 88, path('M -45 -52 C -46 -20 -20 10 12 13 C 40 15 60 -8 63 -44 C 58 -34 52 -26 44 -21 C 40 -30 32 -35 22 -35 C 12 -35 6 -29 4 -21 C -14 -24 -34 -34 -45 -52 Z'), { ...HAIR, slot: 'facial', option: 'beard' });
  P('beardShade', 'head', 88.1, path('M -60 -60 C -50 -30 -30 0 0 10 L -60 20 Z'), { fill: '$hair-25', ...NOSTROKE, clip: 'beard', slot: 'facial', option: 'beard' });
  P('mustache', 'head', 89, path('M 3 -35.5 C 5 -43.5 14 -48 23 -45 C 32 -48 41 -43.5 44 -35.5 C 45 -32 43 -29.5 40 -30 C 36 -34 28 -34.5 23 -32 C 18 -34.5 10 -34 6 -30 C 3 -29.5 1.5 -32.5 3 -35.5 Z'), { ...HAIR, slot: 'facial', option: ['mustache', 'beard'] });

  // ---- mouths --------------------------------------------------------------------------------
  const MOUTH = { fill: '#5a2130' };
  function openMouth(id, d, opts = {}) {
    const option = id.replace('mouth_', '');
    P(id, 'head', 90, path(d), { ...MOUTH, slot: 'mouth', option });
    if (opts.teethTop) P(`${id}TeethT`, 'head', 90.1, rect(0, -42, 50, opts.teethTop), { fill: '#ffffff', ...NOSTROKE, clip: id, slot: 'mouth', option });
    if (opts.teethBot) P(`${id}TeethB`, 'head', 90.1, rect(0, opts.teethBot, 50, 20), { fill: '#ffffff', ...NOSTROKE, clip: id, slot: 'mouth', option });
    if (opts.tongue) P(`${id}Tongue`, 'head', 90.2, ell(opts.tongue[0], opts.tongue[1], opts.tongue[2], opts.tongue[3]), { fill: '#e0717d', ...NOSTROKE, clip: id, slot: 'mouth', option });
  }
  const lineMouth = (opt, d, lw = 3.4) => P(`mouth_${opt}`, 'head', 90, path(d), { fill: null, lw, slot: 'mouth', option: opt });
  lineMouth('rest', 'M 12 -28.5 Q 22 -25.5 32 -29.5');
  lineMouth('smile', 'M 7 -34 C 8 -32 9 -31 10 -30.5 Q 22 -20 35 -31 C 36 -32 37 -33 38 -35', 3.8);
  lineMouth('sad', 'M 9 -21 Q 22 -33 35 -22', 3.6);
  lineMouth('frown', 'M 10 -25 Q 22 -31.5 34 -24.5', 3.8);
  lineMouth('mbp', 'M 10 -28 Q 22 -26.5 33 -29', 4.6);
  openMouth('mouth_grin', 'M 5 -35 Q 22 -31 38 -36 Q 35 -14 21 -13 Q 7 -14 5 -35 Z', { teethTop: 8, tongue: [21, -14, 10, 6] });
  openMouth('mouth_ee', 'M 7 -33 Q 22 -35 36 -33 Q 33 -21 22 -21 Q 10 -21 7 -33 Z', { teethTop: 6, teethBot: -25 });
  openMouth('mouth_ah', 'M 10 -35 Q 22 -38 34 -35 Q 35 -15 22 -11 Q 9 -15 10 -35 Z', { teethTop: 5, tongue: [22, -13, 9, 6] });
  openMouth('mouth_oh', 'M 22 -37 C 30 -37 32 -30 32 -26 C 32 -20 28 -15 22 -15 C 15 -15 12 -20 12 -26 C 12 -31 15 -37 22 -37 Z', { tongue: [22, -16, 7, 4] });
  openMouth('mouth_oo', 'M 23 -33 C 28 -33 30 -30 30 -27 C 30 -23 27 -20 23 -20 C 19 -20 16 -23 16 -27 C 16 -30 18 -33 23 -33 Z');
  openMouth('mouth_fv', 'M 9 -32 Q 22 -34 34 -32 Q 32 -23 22 -23 Q 12 -23 9 -32 Z', { teethTop: 7 });
  openMouth('mouth_half', 'M 11 -31 Q 22 -33 33 -31 Q 31 -24 22 -24 Q 13 -24 11 -31 Z', { teethTop: 3 });
  openMouth('mouth_wow', 'M 22 -40 C 31 -40 34 -32 34 -25 C 34 -17 29 -11 22 -11 C 14 -11 10 -17 10 -25 C 10 -32 13 -40 22 -40 Z', { tongue: [22, -12, 8, 5] });

  // ---- brows: generated tapered shapes; inner end is toward the nose (+x for N, -x for F) -------------
  // rounded inner end, tapered outer tail
  function brow(outer, inner, arch, tIn, tOut) {
    const mx = (outer[0] + inner[0]) / 2, my = (outer[1] + inner[1]) / 2 + arch;
    const dir = Math.sign(inner[0] - outer[0]);
    return `M ${outer[0]} ${outer[1]} Q ${mx} ${my} ${inner[0]} ${inner[1]} Q ${f1(inner[0] + dir * tIn * 0.75)} ${f1(inner[1] + tIn * 0.5)} ${inner[0]} ${f1(inner[1] + tIn)} Q ${mx} ${f1(my + (tIn + tOut) / 2 + 1)} ${f1(outer[0] - dir * 1.5)} ${f1(outer[1] + tOut * 0.7)} Z`;
  }
  const BROWS = {
    neutral: { o: -90, i: -93, a: -5 },
    happy: { o: -93, i: -97, a: -9 },
    sad: { o: -86, i: -99, a: -2 },
    angry: { o: -97, i: -84, a: 2 },
    surprised: { o: -101, i: -104, a: -9 },
    worried: { o: -89, i: -100, a: -4 },
  };
  // browStyle: thickness at the inner/outer end (medium is the original look)
  const BW = { medium: [6.5, 4, 5.5, 3.5, 0], thin: [3.6, 2.2, 3.2, 2, 1], thick: [9, 6, 7.5, 5, -1.5] };
  for (const [st, [nIn, nOut, fIn, fOut, dy]] of Object.entries(BW)) {
    for (const [k, b] of Object.entries(BROWS)) {
      P(`browN_${k}${st === 'medium' ? '' : '_' + st}`, 'head', 93, path(brow([-26, b.o + dy], [4, b.i + dy], b.a, nIn, nOut)), { fill: '$brow', ...NOSTROKE, slot: 'brows', option: k, when: { browStyle: st } });
      P(`browF_${k}${st === 'medium' ? '' : '_' + st}`, 'head', 93, path(brow([42, b.o + 1 + dy], [20, b.i + 1 + dy], b.a * 0.8, fIn, fOut)), { fill: '$brow', ...NOSTROKE, slot: 'brows', option: k, when: { browStyle: st } });
    }
  }

  // ---- eyewear -------------------------------------------------------------------------------
  // Lenses frame the eyes with a little margin; the far lens is foreshortened; the arm runs back to the ear.
  const FRAME = { stroke: '$frame', lw: 4 };
  const LENS = 'rgba(255,255,255,0.16)';
  P('glassesLensN', 'head', 97, rect(-30, -84.5, 40, 37, 11), { fill: LENS, ...FRAME, slot: 'eyewear', option: 'glasses' });
  P('glassesLensF', 'head', 97, rect(16, -83.5, 29, 35, 9), { fill: LENS, ...FRAME, slot: 'eyewear', option: 'glasses' });
  P('roundLensN', 'head', 97, ell(-10, -66, 19.5, 19.5), { fill: LENS, ...FRAME, slot: 'eyewear', option: 'round' });
  P('roundLensF', 'head', 97, ell(30.5, -66, 13.5, 18.5), { fill: LENS, ...FRAME, slot: 'eyewear', option: 'round' });
  P('sunLensN', 'head', 97, path('M -31 -83 L 10 -83 C 11 -66 4 -53 -10 -53 C -25 -53 -32 -66 -31 -83 Z'), { fill: { stops: [[0, '#2a3144'], [1, '#121620']], x0: 0, y0: -83, x1: 0, y1: -53 }, stroke: '$frame', lw: 4, slot: 'eyewear', option: 'sunglasses' });
  P('sunLensF', 'head', 97, path('M 16 -82 L 45 -82 C 46 -66 41 -54 30.5 -54 C 20 -54 15.5 -66 16 -82 Z'), { fill: { stops: [[0, '#2a3144'], [1, '#121620']], x0: 0, y0: -82, x1: 0, y1: -54 }, stroke: '$frame', lw: 4, slot: 'eyewear', option: 'sunglasses' });
  P('sunGlint', 'head', 97.1, path('M -23 -76 L -13 -76 M 22 -75.5 L 29 -75.5'), { stroke: '#ffffff', lw: 3, alpha: 0.55, slot: 'eyewear', option: 'sunglasses' });
  P('glassesBridge', 'head', 97.2, path('M 9.5 -70 Q 13 -74 16.5 -70'), { ...FRAME, slot: 'eyewear', option: ['glasses', 'round', 'sunglasses'] });
  P('glassesArm', 'head', 97.2, path('M -29.5 -73 L -44 -71'), { ...FRAME, slot: 'eyewear', option: ['glasses', 'round', 'sunglasses'] });
}
