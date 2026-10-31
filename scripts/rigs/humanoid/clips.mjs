// Animation clips. Overlay clips replace only the bones they animate; holdAt = pose to hold for long gestures.
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
//
// Most clips are generated, not hand-keyed:
//   gait()    — walk/run styles. Feet are solved with two-bone IK against a ground that slides back at the clip's
//               natural speed, with heel strike -> flat -> toe roll, so the planted foot never slides or sinks.
//   stand()   — idles: feet stay planted (IK) while the hips shift weight and the chest breathes.
//   gesture() — overlay poses authored as hand targets in torso space (arm IK) plus a few body angles.
// Base movement clips carry `speed` = natural pace in stage px/s for a regular build at scale 1; the compiler
// scales it by leg length (build), character scale and depth so the feet stay planted for every body.
import { bones } from './skeleton.mjs';

const DISPLAY = 0.92; // rig.displayScale (index.mjs) — converts rig units to stage px for `speed`
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const r2 = (v) => Math.round(v * 100) / 100;
const K = (...pairs) => pairs;
const TAU = Math.PI * 2;
const cos = (p) => Math.cos(TAU * p), sin = (p) => Math.sin(TAU * p);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => u * u * (3 - 2 * u);
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const easeIn = (u) => u * u;
const wrap = (p) => ((p % 1) + 1) % 1;

const B = Object.fromEntries(bones.map((b) => [b.id, b]));
const HIPS_Y = B.hips.pos[1];
const LEG = { N: { jx: B.thighN.pos[0], jy: B.thighN.pos[1], l1: B.shinN.pos[1], l2: B.footN.pos[1] }, F: { jx: B.thighF.pos[0], jy: B.thighF.pos[1], l1: B.shinF.pos[1], l2: B.footF.pos[1] } };
const ARM = { N: { s: B.armN.pos, l1: B.foreN.pos[1], l2: B.handN.pos[1] }, F: { s: B.armF.pos, l1: B.foreF.pos[1], l2: B.handF.pos[1] } };
// shoe contact points in foot space (see body.mjs leg()): heel and ball of the foot, sole at y = 10
const HEEL = [-17, 10], BALL = [36, 10];
const rot = (v, deg) => { const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
// the rig's bones point down at rot 0; a +rot is clockwise, so direction = (-sin, cos)
const angOf = (dx, dy) => Math.atan2(-dx, dy) * R2D;

/** Two-bone IK. Returns absolute angles [upper, lower] of the chain. bend: +1 = joint forward (knee), -1 = back (elbow). */
function ik2(dx, dy, l1, l2, bend) {
  let r = Math.hypot(dx, dy);
  r = clamp(r, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.9995);
  const a = angOf(dx, dy);
  const g = Math.acos(clamp((l1 * l1 + r * r - l2 * l2) / (2 * l1 * r), -1, 1)) * R2D;
  const d = Math.acos(clamp((l2 * l2 + r * r - l1 * l1) / (2 * l2 * r), -1, 1)) * R2D;
  return bend > 0 ? [a - g, a + d] : [a + g, a - d];
}

/** Leg angles that put the ankle at `ankle` (root space) with the foot at world angle `fa`. */
function legIK(side, hips, hipsRot, ankle, fa) {
  const L = LEG[side];
  const j = rot([L.jx, L.jy], hipsRot);
  const jx = hips[0] + j[0], jy = HIPS_Y + hips[1] + j[1];
  const [t, s] = ik2(ankle[0] - jx, ankle[1] - jy, L.l1, L.l2, 1);
  return { thigh: t - hipsRot, shin: s - t, foot: fa - s };
}
/** How far down (y+) the hips must sit so the leg can reach the ankle with a soft knee. */
function hipsNeed(side, hipsX, ankle, reach = 0.975) {
  const L = LEG[side];
  const R = (L.l1 + L.l2) * reach, dx = ankle[0] - (hipsX + L.jx);
  const dy = Math.sqrt(Math.max(1, R * R - dx * dx));
  return ankle[1] - dy - L.jy - HIPS_Y;
}

/** Arm angles that put the wrist at `w` (torso space) with the hand at angle `a` (torso space). */
function armIK(side, w, a, elbow = 'back') {
  const A = ARM[side];
  const [u, f] = ik2(w[0] - A.s[0], w[1] - A.s[1], A.l1, A.l2, elbow === 'front' ? 1 : -1);
  return { arm: u, fore: f - u, hand: a - f };
}

// ---- track helpers ----------------------------------------------------------------------------
/** Unwrap a list of angles so neighbours never jump by more than 180 degrees. */
function unwrap(vals) {
  const out = [vals[0]];
  for (let i = 1; i < vals.length; i++) {
    let v = vals[i];
    while (v - out[i - 1] > 180) v -= 360;
    while (v - out[i - 1] < -180) v += 360;
    out.push(v);
  }
  return out;
}
/** Evenly spaced keys over a looping clip; the first value is repeated at t = dur so the loop closes. */
function loopKeys(dur, vals) {
  const n = vals.length;
  const ks = vals.map((v, i) => [r2((dur * i) / n), Array.isArray(v) ? v.map(r2) : r2(v)]);
  ks.push([dur, ks[0][1]]);
  return ks;
}
/** Circular smoothing of a periodic array. */
function circSmooth(a, passes) {
  let x = a.slice();
  for (let k = 0; k < passes; k++) x = x.map((v, i) => (x[(i - 1 + x.length) % x.length] + 2 * v + x[(i + 1) % x.length]) / 4);
  return x;
}
/** Cubic Hermite. */
const herm = (p0, m0, p1, m1, u) => {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
};

export const clips = {};

// ================================================================================================
// GAITS
// ================================================================================================
/**
 * Procedural gait. Phase p in [0,1) of the cycle; p = 0 is the near-foot heel strike. Each leg: stance from
 * its strike for `beta` of the cycle (heel roll -> flat -> toe roll), then a Hermite swing to the next strike.
 */
function gait(o) {
  const D = o.D, S = o.stride, v = S / D; // rig units per second
  const N = o.keys || 32; // keys per cycle
  const legs = {
    N: { off: 0, beta: o.beta, strike: o.strike, toeOff: o.toeOff, lift: o.lift, heel: o.heel ?? 0.16, roll: o.roll ?? 0.62, tiptoe: !!o.tiptoe, bias: o.bias ?? 2, ...(o.legN || {}) },
    F: { off: o.offF ?? 0.5, beta: o.beta, strike: o.strike, toeOff: o.toeOff, lift: o.lift, heel: o.heel ?? 0.16, roll: o.roll ?? 0.62, tiptoe: !!o.tiptoe, bias: o.bias ?? 2, ...(o.legF || {}) },
  };
  for (const [side, g] of Object.entries(legs)) {
    // place the strike so the ankle passes just in front of the hip joint at mid-stance
    // (X = heel position at strike; a flat foot's ankle sits 15 in front of the heel)
    g.X = LEG[side].jx + g.bias + HEEL[0] + (v * g.beta * D) / 2;
  }
  // stance: returns [ankleX, ankleY, footAngle] in root space at stance fraction s (0..1)
  function stance(g, s) {
    const t = s * g.beta * D, back = v * t;
    let fa, pivot, px;
    if (g.tiptoe) {
      fa = g.toeOff * (0.85 + 0.15 * Math.sin(Math.PI * s));
      pivot = BALL; px = g.X + (BALL[0] - HEEL[0]);
    } else if (s < g.heel) {
      fa = g.strike * (1 - easeOut(s / g.heel)); pivot = HEEL; px = g.X;
    } else if (s < g.roll) {
      fa = 0; pivot = HEEL; px = g.X;
    } else {
      fa = g.toeOff * easeIn((s - g.roll) / (1 - g.roll)); pivot = BALL; px = g.X + (BALL[0] - HEEL[0]);
    }
    const pr = rot(pivot, fa);
    return [px - back - pr[0], 0 - pr[1], fa];
  }
  function legAt(g, p) {
    const q = wrap(p - g.off);
    if (q < g.beta) return { a: stance(g, q / g.beta), planted: true };
    const u = (q - g.beta) / (1 - g.beta), Tsw = (1 - g.beta) * D;
    const e = 1e-3;
    const A0 = stance(g, 1), A0b = stance(g, 1 - e), A1 = stance(g, 0), A1b = stance(g, e);
    const k = Tsw / (g.beta * D * e); // convert d/ds (stance) into d/du (swing)
    const m0 = A0.map((x, i) => (x - A0b[i]) * k * (o.swingDrag ?? 1));
    const m1 = A1.map((x, i) => (A1b[i] - x) * k * 0.6);
    // xWarp > 1 keeps the foot behind longer (heel kick) before the knee drives it forward
    const ux = Math.pow(u, g.xWarp ?? 1);
    const x = herm(A0[0], m0[0], A1[0], m1[0], ux);
    let y = herm(A0[1], m0[1] * 0.3, A1[1], m1[1] * 0.3, u);
    const peak = g.peak ?? 0.42; const w = Math.pow(u, Math.log(0.5) / Math.log(peak));
    y -= g.lift * Math.pow(Math.sin(Math.PI * w), 1.3);
    // foot: from toe-off angle, through a relaxed hang, up to the strike angle
    const hang = g.hang ?? 8;
    const fa = u < 0.5 ? A0[2] + (hang - A0[2]) * smooth(u / 0.5) : hang + (A1[2] - hang) * smooth((u - 0.5) / 0.5);
    return { a: [x, y, fa], planted: false };
  }

  // hips height: designed bob, then pushed down wherever a leg could not reach its foot
  const M = 96;
  const hipX = o.hipsX ?? 0;
  const design = [], need = [];
  for (let i = 0; i < M; i++) {
    const p = i / M, q = wrap(2 * p);
    design.push((o.hipsBase ?? 4) + (o.hipBob ?? 4) * cos(q - (o.bobPhase ?? 0.15)) + (o.hipY ? o.hipY(p) : 0));
    let n = -1e9;
    for (const [side, g] of Object.entries(legs)) n = Math.max(n, hipsNeed(side, hipX, legAt(g, p).a, o.reach ?? 0.975));
    need.push(n);
  }
  let hy = design.map((d, i) => Math.max(d, need[i]));
  for (let k = 0; k < 4; k++) hy = circSmooth(hy, 3).map((d, i) => Math.max(d, need[i]));
  const hyAt = (p) => { const f = wrap(p) * M, i = Math.floor(f), u = f - i; return hy[i % M] * (1 - u) + hy[(i + 1) % M] * u; };
  const hyMean = hy.reduce((a, b) => a + b, 0) / M;

  const A = o.arms || {};
  const tracks = {};
  const put = (bone, kind, val) => { ((tracks[bone] ||= {})[kind] ||= []).push(val); };
  for (let i = 0; i < N; i++) {
    const p = i / N, q = wrap(2 * p);
    const hr = (o.hipRot ?? 1) * cos(p - 0.1);
    const hips = [hipX + (o.hipSway ?? 0) * sin(p), hyAt(p)];
    put('hips', 'pos', hips); put('hips', 'rot', hr);
    for (const [side, g] of Object.entries(legs)) {
      const L = legAt(g, p).a;
      const r = legIK(side, hips, hr, [L[0], L[1]], L[2]);
      put('thigh' + side, 'rot', r.thigh); put('shin' + side, 'rot', r.shin); put('foot' + side, 'rot', r.foot);
    }
    const bob = (hyAt(p) - hyMean); // + = lower
    const bobLag = (hyAt(p - 0.06) - hyMean), bobLag2 = (hyAt(p - 0.11) - hyMean);
    put('torso', 'rot', (o.lean ?? 3) + (o.torsoBob ?? 0.25) * bobLag - hr * 0.6 + (o.torsoTwist ?? 0) * cos(p - 0.05));
    put('neck', 'rot', (o.neck ?? -1) - (o.torsoBob ?? 0.25) * bobLag * 0.4);
    put('head', 'rot', (o.head ?? -2) + (o.headBob ?? 0.3) * bobLag2 + (o.headSway ?? 0) * cos(p - 0.15));
    // arms swing opposite the legs, with overlap from shoulder -> elbow -> wrist
    const lag = A.lag ?? 0.04, amp = A.amp ?? 16, fl = A.foreLag ?? 0.07, hl = A.handLag ?? 0.12;
    for (const [side, sg] of [['N', 1], ['F', -1]]) {
      const base = side === 'N' ? (A.baseN ?? 4) : (A.baseF ?? -4);
      const ampS = amp * (side === 'N' ? (A.ampN ?? 1) : (A.ampF ?? 1));
      const fwd = (pp) => -sg * cos(pp - lag); // 1 when this arm is fully forward
      put('arm' + side, 'rot', base - ampS * fwd(p));
      put('fore' + side, 'rot', (A.fore ?? -12) - (A.foreAmp ?? 14) * (side === 'N' ? (A.ampN ?? 1) : (A.ampF ?? 1)) * (0.5 + 0.5 * fwd(p - fl)));
      put('hand' + side, 'rot', (A.hand ?? 0) - (A.handAmp ?? 6) * sg * sin(p - lag - hl));
    }
    put('hair', 'rot', (o.hair ?? 0.35) * bobLag2);
    put('tail', 'rot', (o.tail ?? 1.2) * (hyAt(p - 0.16) - hyMean) + (o.tailSwing ?? 4) * cos(p - 0.2));
  }
  const out = { duration: D, loop: true, ease: 'smooth', speed: r2(v * DISPLAY), stride: r2(S), tracks: {} };
  for (const [bone, tr] of Object.entries(tracks)) {
    out.tracks[bone] = {};
    for (const [kind, vals] of Object.entries(tr)) out.tracks[bone][kind] = loopKeys(D, kind === 'rot' ? vals : vals);
  }
  if (o.slots) out.slots = o.slots;
  return out;
}

// strides are rig units per full cycle (two steps); regular legs are 154 long
clips.walk = gait({ D: 1.0, stride: 204, beta: 0.6, strike: -20, toeOff: 32, lift: 10, reach: 0.985, hipsBase: 3, hipBob: 3, lean: 3, arms: { amp: 17, fore: -12, foreAmp: 14 } });
clips.run = gait({
  D: 0.62, stride: 380, beta: 0.32, strike: -10, toeOff: 48, lift: 62, peak: 0.36, xWarp: 1.5, hang: 54, heel: 0.12, roll: 0.42, bias: 2, swingDrag: 0.5,
  hipsBase: 4, hipBob: 9, bobPhase: 0.18, lean: 12, head: -10, neck: -2, headBob: 0.2, hipRot: 1.5, hair: 0.5, tail: 1.4, tailSwing: 8, reach: 0.97,
  arms: { amp: 48, baseN: -4, baseF: -8, fore: -76, foreAmp: 22, handAmp: 4, lag: 0.03 },
  slots: { handN: K([0, 'fist']), handF: K([0, 'fist']) },
});
clips.jog = gait({
  D: 0.72, stride: 300, beta: 0.4, strike: -14, toeOff: 40, lift: 44, peak: 0.4, xWarp: 1.3, hang: 38, heel: 0.13, roll: 0.5, bias: 3, swingDrag: 0.6,
  hipsBase: 4, hipBob: 6, bobPhase: 0.2, lean: 7, head: -6, headBob: 0.25,
  arms: { amp: 28, fore: -66, foreAmp: 16, handAmp: 4 },
  slots: { handN: K([0, 'fist']), handF: K([0, 'fist']) },
});
clips.sprint = gait({
  D: 0.5, stride: 430, beta: 0.28, strike: -8, toeOff: 52, lift: 74, peak: 0.34, xWarp: 1.6, hang: 64, heel: 0.1, roll: 0.4, bias: 2, swingDrag: 0.4,
  hipsBase: 6, hipBob: 9, bobPhase: 0.22, lean: 18, head: -14, neck: -4, hipRot: 2, hair: 0.6, tail: 1.6, tailSwing: 10, reach: 0.97,
  arms: { amp: 56, baseN: 4, baseF: -4, fore: -80, foreAmp: 26, handAmp: 3, lag: 0.02 },
  slots: { handN: K([0, 'open']), handF: K([0, 'open']) },
});
clips.stroll = gait({
  D: 1.25, stride: 220, beta: 0.62, strike: -18, toeOff: 30, lift: 15, hipsBase: 3, hipBob: 3, lean: -1.5, head: -3, headSway: 1.2, hipRot: 1.6,
  arms: { amp: 11, fore: -10, foreAmp: 8, handAmp: 7, handLag: 0.16 },
});
clips.march = gait({
  D: 0.9, stride: 250, beta: 0.58, strike: -18, toeOff: 26, lift: 46, peak: 0.45, hang: 4, hipsBase: 3, hipBob: 3, lean: -2, head: -4, neck: -3, headBob: 0.15,
  arms: { amp: 34, fore: -6, foreAmp: 8, handAmp: 1.5, foreLag: 0.02, handLag: 0.02 },
  slots: { handN: K([0, 'fist']), handF: K([0, 'fist']) },
});
clips.sneak = gait({
  D: 1.7, stride: 230, beta: 0.66, strike: -26, toeOff: 24, lift: 30, peak: 0.5, hang: 0, heel: 0.24, roll: 0.6,
  hipsBase: 26, hipBob: 4, bobPhase: 0.3, lean: 22, neck: 2, head: -20, headBob: 0.25, hipRot: 1.5, headSway: 2,
  arms: { amp: 10, baseN: -26, baseF: -30, fore: -96, foreAmp: 18, hand: -12, handAmp: 10, handLag: 0.18 },
});
clips.tiptoe = gait({
  D: 0.8, stride: 150, beta: 0.56, tiptoe: true, strike: 0, toeOff: 36, lift: 20, peak: 0.45, hang: 36, bias: -4,
  hipsBase: -2, hipBob: 2.5, bobPhase: 0.25, lean: 2, head: -6, headBob: 0.4, hipRot: 0.8,
  arms: { amp: 6, baseN: -12, baseF: -16, fore: -104, foreAmp: 10, hand: -30, handAmp: 8 },
  slots: { handN: K([0, 'open']), handF: K([0, 'open']) },
});
clips.strut = gait({
  D: 0.92, stride: 250, beta: 0.6, strike: -20, toeOff: 36, lift: 24, hipsBase: 2, hipBob: 5, bobPhase: 0.1, lean: -4, neck: -3, head: -6, headBob: 0.45, headSway: 3,
  hipRot: 2.5, torsoTwist: 2, tailSwing: 7,
  arms: { amp: 24, fore: -16, foreAmp: 22, handAmp: 10, lag: 0.06 },
});
clips.sad_walk = gait({
  D: 1.5, stride: 170, beta: 0.66, strike: -10, toeOff: 20, lift: 9, peak: 0.5, hang: 4, hipsBase: 6, hipBob: 2, lean: 8, neck: 3, head: 9, headBob: 0.2,
  arms: { amp: 6, baseN: 0, baseF: -2, fore: -4, foreAmp: 4, handAmp: 5, handLag: 0.2 },
  slots: { brows: K([0, 'sad']), mouth: K([0, 'sad']) },
});
// limp: the near leg is hurt — short, stiff stance on it with a dip, a quick hop onto the good leg
clips.limp = gait({
  D: 1.3, stride: 200, beta: 0.6, offF: 0.42, strike: -14, toeOff: 24, lift: 16,
  legN: { beta: 0.42, strike: -6, toeOff: 12, lift: 10, roll: 0.7 }, legF: { beta: 0.74 },
  hipsBase: 4, hipBob: 1.5, hipY: (p) => 9 * Math.exp(-Math.pow((wrap(p - 0.16 + 0.5) - 0.5) / 0.1, 2)),
  lean: 6, torsoBob: 0.9, head: -1, headBob: 0.7, hipRot: 2,
  arms: { amp: 10, ampN: 0.4, fore: -20, foreAmp: 10, handAmp: 4 },
  slots: { brows: K([0, 'worried']) },
});

// ================================================================================================
// STANDING LOOPS (feet planted, hips/chest move)
// ================================================================================================
const FOOT = { N: [-21.4, -10], F: [20.7, -10] };
/** Ankle [x, y, angle] for a foot resting at ankle x `ax` rotated by `deg` about its heel (-deg = toes up) or ball. */
function footOn(ax, deg, pivot = deg < 0 ? HEEL : BALL) {
  const pw = [ax + pivot[0], 0], r = rot(pivot, deg);
  return [pw[0] - r[0], pw[1] - r[1], deg];
}
/**
 * Standing loop sampled at `n` keys. f(p, t) returns {hips:[x,y], hipsRot, feet?:{N:[x,y,angle]}, torso, neck,
 * head, chest (breath 0..1), arms:{N:{arm,fore,hand} | {w,a,elbow}}, hair, tail, gaze:[x,y]}.
 */
function stand(dur, n, f, extra = {}) {
  const tracks = {};
  const put = (bone, kind, val) => { ((tracks[bone] ||= {})[kind] ||= []).push(val); };
  for (let i = 0; i < n; i++) {
    const p = i / n, s = f(p, p * dur);
    const hips = s.hips || [0, 2], hr = s.hipsRot || 0;
    put('hips', 'pos', hips); put('hips', 'rot', hr);
    for (const side of ['N', 'F']) {
      const ft = s.feet?.[side] || [...FOOT[side], 0];
      const r = legIK(side, hips, hr, [ft[0], ft[1]], ft[2] ?? 0);
      put('thigh' + side, 'rot', r.thigh); put('shin' + side, 'rot', r.shin); put('foot' + side, 'rot', r.foot);
    }
    put('torso', 'rot', s.torso ?? 0);
    put('torso', 'scale', [1 + (s.chest ?? 0) * 0.006, 1 + (s.chest ?? 0) * 0.016]);
    put('neck', 'rot', s.neck ?? 0);
    put('head', 'rot', s.head ?? 0);
    for (const side of ['N', 'F']) {
      let a = s.arms?.[side];
      if (a && a.w) a = armIK(side, a.w, a.a, a.elbow);
      a ||= side === 'N' ? { arm: 4, fore: -8, hand: 0 } : { arm: -4, fore: -10, hand: 0 };
      put('arm' + side, 'rot', a.arm); put('fore' + side, 'rot', a.fore); put('hand' + side, 'rot', a.hand);
    }
    put('hair', 'rot', s.hair ?? 0); put('tail', 'rot', s.tail ?? 0);
    if (s.gaze) put('gaze', 'pos', s.gaze);
  }
  const out = { duration: dur, loop: true, ease: 'smooth', tracks: {}, ...extra };
  for (const [bone, tr] of Object.entries(tracks)) {
    out.tracks[bone] = {};
    for (const [kind, vals] of Object.entries(tr)) out.tracks[bone][kind] = loopKeys(dur, kind === 'rot' ? unwrap(vals) : vals);
  }
  return out;
}

clips.idle = stand(4, 16, (p) => {
  const br = 0.5 - 0.5 * cos(p * 2); // two breaths per loop
  const sh = sin(p); // slow weight shift
  return {
    hips: [1.6 * sh, 2.5 + 0.8 * br], hipsRot: 0.6 * sh, chest: br,
    torso: 0.6 * sin(p - 0.08) - 0.4 * br, neck: -0.4 * sin(p - 0.12), head: -0.8 * sin(p - 0.2) + 0.6 * br - 0.3 * cos(p * 3),
    arms: { N: { arm: 4 + 1.2 * br, fore: -8 - 1.5 * br, hand: -1.5 * sin(p - 0.25) }, F: { arm: -4 + 1.2 * br, fore: -10 - 1.5 * br, hand: 1.5 * sin(p - 0.25) } },
    hair: 0.8 * sin(p - 0.3), tail: 2 * sin(p - 0.35),
  };
});
clips.idle_bored = stand(6, 24, (p) => {
  // weight sunk onto the far leg, near knee relaxed, toe taps, sighs and glances around
  const br = 0.5 - 0.5 * cos(p * 2);
  const tap = Math.max(0, Math.sin(Math.PI * clamp((p * 6 % 1 - 0.1) / 0.5, 0, 1))) * (p < 0.5 ? 1 : 0);
  const sigh = Math.exp(-Math.pow((p - 0.72) / 0.08, 2));
  return {
    hips: [6, 5 + 2 * sigh], hipsRot: -3, chest: br + sigh * 1.2,
    feet: { N: [-30, -10, 0], F: footOn(FOOT.F[0], -tap * 16) },
    torso: -2 + 1.5 * sigh, neck: 2, head: 6 + 4 * sigh + 2 * sin(p),
    arms: { N: { arm: 2, fore: -3, hand: 2 }, F: { arm: -2, fore: -4, hand: 2 } },
    gaze: [p > 0.25 && p < 0.5 ? -3 : p > 0.5 && p < 0.65 ? 3 : 0, 2 + 2 * sigh],
    hair: 1.2 * sin(p - 0.2), tail: 2 * sin(p - 0.25),
  };
}, { slots: { mouth: K([0, 'rest'], [4.2, 'oh'], [4.8, 'rest']) } });
clips.idle_nervous = stand(2.4, 24, (p) => {
  const br = 0.5 - 0.5 * cos(p * 3); // fast shallow breaths
  const jit = 0.6 * sin(p * 6) + 0.4 * sin(p * 10 + 0.3);
  return {
    hips: [2.2 * sin(p * 2), 4 + 0.6 * br], hipsRot: 1.2 * sin(p * 2), chest: br * 0.8,
    torso: 3 + 0.8 * sin(p * 2 - 0.1), neck: 2, head: 2 + 1.5 * jit + 1.2 * sin(p * 2 - 0.2),
    // fingers fidgeting together in front of the belly
    arms: {
      N: { w: [16 + 3 * sin(p * 4), -52 + 3 * cos(p * 4)], a: -100 + 14 * sin(p * 4), elbow: 'back' },
      F: { w: [24 - 3 * sin(p * 4), -50 - 3 * cos(p * 4)], a: -80 - 14 * sin(p * 4), elbow: 'back' },
    },
    gaze: [[-4, 3, -2, 4, -4, 2][Math.floor(p * 6) % 6], 1],
    hair: 0.8 * jit, tail: 2 * jit,
  };
}, { slots: { brows: K([0, 'worried']), mouth: K([0, 'frown']) } });
clips.idle_confident = stand(4, 16, (p) => {
  const br = 0.5 - 0.5 * cos(p * 2), sh = sin(p);
  return {
    hips: [-2 + 1.2 * sh, 1 + 0.6 * br], hipsRot: 0.5 * sh, chest: 0.6 + br * 0.7,
    feet: { N: [-34, -10, 0], F: [32, -10, 0] }, // wider stance
    torso: -3 + 0.4 * sh - 0.4 * br, neck: -2, head: -5 - 0.8 * sin(p - 0.2),
    arms: hipHands(br),
    hair: 0.6 * sin(p - 0.3), tail: 1.5 * sin(p - 0.35),
  };
}, { slots: { handN: K([0, 'fist']), handF: K([0, 'fist']), mouth: K([0, 'smile']), brows: K([0, 'happy']) } });
clips.idle_tired = stand(5, 20, (p) => {
  const br = Math.pow(0.5 - 0.5 * cos(p * 2), 1.4); // slow, heavy breaths
  return {
    hips: [-2, 9 + 2.5 * br], hipsRot: 1.5, chest: br * 1.4,
    torso: 8 - 3 * br, neck: 2 - br, head: 7 - 4 * br + 1.5 * sin(p - 0.2),
    arms: { N: { arm: -1 + 2 * br, fore: -2 - 2 * br, hand: 3 }, F: { arm: -6 + 2 * br, fore: -3 - 2 * br, hand: 3 } },
    hair: 1.4 * br, tail: 2 * br,
  };
}, { slots: { brows: K([0, 'sad']) } });
function hipHands(br = 0) {
  return {
    N: { w: [-30, -6 - br], a: -36, elbow: 'back' },
    F: { w: [40, -6 - br], a: 24, elbow: 'front' },
  };
}

// ================================================================================================
// GESTURES (overlays)
// ================================================================================================
const REST = { armN: 4, foreN: -8, handN: 0, armF: -4, foreF: -10, handF: 0, torso: 0, neck: 0, head: 0, hair: 0, tail: 0 };
const ARM_BONES = { N: ['armN', 'foreN', 'handN'], F: ['armF', 'foreF', 'handF'] };
/**
 * Overlay gesture from pose keys: [[t, pose], ...]. Pose fields: N / F = {w:[x,y], a, elbow} hand target in torso
 * space (or {arm, fore, hand} angles), torso/neck/head/hair/tail rotations, hips:[x,y] (feet stay planted via IK),
 * root:[x,y], gaze:[x,y], legs:{N:[x,y,angle]} ankle overrides. Every bone a clip touches starts and ends at rest.
 */
function gesture(o) {
  const keys = o.arcs === false ? o.keys : arcKeys(o.keys);
  const use = new Set();
  for (const [, ps] of keys) {
    for (const k of Object.keys(ps)) {
      if (k === 'N' || k === 'F') ARM_BONES[k].forEach((b) => use.add(b));
      else if (k === 'hips' || k === 'legs') ['hips', 'thighN', 'shinN', 'footN', 'thighF', 'shinF', 'footF'].forEach((b) => use.add(b));
      else use.add(k);
    }
  }
  const tracks = {};
  const put = (bone, kind, t, val) => { ((tracks[bone] ||= {})[kind] ||= []).push([t, val]); };
  for (const [t, ps] of keys) {
    for (const side of ['N', 'F']) {
      if (!ARM_BONES[side].some((b) => use.has(b))) continue;
      let a = ps[side];
      if (a && a.w) a = armIK(side, a.w, a.a, a.elbow);
      a ||= { arm: REST['arm' + side], fore: REST['fore' + side], hand: REST['hand' + side] };
      put('arm' + side, 'rot', t, a.arm); put('fore' + side, 'rot', t, a.fore); put('hand' + side, 'rot', t, a.hand);
    }
    for (const b of ['torso', 'neck', 'head', 'hair', 'tail']) if (use.has(b)) put(b, 'rot', t, ps[b] ?? REST[b]);
    if (use.has('hips')) {
      const hips = ps.hips || [0, 2.5], hr = ps.hipsRot || 0;
      put('hips', 'pos', t, hips);
      if (ps.hipsRot != null || keys.some(([, q]) => q.hipsRot != null)) put('hips', 'rot', t, hr);
      for (const side of ['N', 'F']) {
        const ft = ps.legs?.[side] || [...FOOT[side], 0];
        const r = legIK(side, hips, hr, [ft[0], ft[1]], ft[2] ?? 0);
        put('thigh' + side, 'rot', t, r.thigh); put('shin' + side, 'rot', t, r.shin); put('foot' + side, 'rot', t, r.foot);
      }
    }
    if (use.has('root')) put('root', 'pos', t, ps.root || [0, 0]);
    if (use.has('gaze')) put('gaze', 'pos', t, ps.gaze || [0, 0]);
  }
  const out = { loop: !!o.loop, ease: 'smooth', overlay: true, duration: o.duration ?? keys[keys.length - 1][0], tracks: {} };
  if (o.holdAt != null) out.holdAt = o.holdAt;
  for (const [bone, tr] of Object.entries(tracks)) {
    out.tracks[bone] = {};
    for (const [kind, ks] of Object.entries(tr)) {
      const vals = kind === 'rot' ? unwrap(ks.map((k) => k[1])) : ks.map((k) => k[1]);
      out.tracks[bone][kind] = ks.map((k, i) => [r2(k[0]), Array.isArray(vals[i]) ? vals[i].map(r2) : r2(vals[i])]);
    }
  }
  if (o.slots) out.slots = o.slots;
  return out;
}
/** Wrist position + hand angle (torso space) of an arm given as angles. */
function armFK(side, a) {
  const A = ARM[side];
  const dir = (deg) => [-Math.sin(deg * D2R), Math.cos(deg * D2R)];
  const u = dir(a.arm), f = dir(a.arm + a.fore);
  return { w: [A.s[0] + u[0] * A.l1 + f[0] * A.l2, A.s[1] + u[1] * A.l1 + f[1] * A.l2], a: a.arm + a.fore + a.hand };
}
const restArm = (side) => ({ arm: REST['arm' + side], fore: REST['fore' + side], hand: REST['hand' + side] });
const asWrist = (side, a) => (a?.w ? a : { ...armFK(side, a || restArm(side)), elbow: undefined });
const mix = (a, b, u) => a + (b - a) * u;
/** Blend two poses (numbers, [x,y] arrays, legs, and arms as wrist targets). */
function lerpPose(A, B, u, arc) {
  const out = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (k === 'N' || k === 'F') {
      const a = asWrist(k, A[k]), b = asWrist(k, B[k]);
      // let the hand travel on a gentle forward arc rather than a straight line
      const bulge = arc * Math.sin(Math.PI * u);
      let ha = b.a; while (ha - a.a > 180) ha -= 360; while (ha - a.a < -180) ha += 360;
      out[k] = { w: [mix(a.w[0], b.w[0], u) + bulge, mix(a.w[1], b.w[1], u)], a: mix(a.a, ha, u), elbow: B[k]?.elbow || A[k]?.elbow || 'back' };
    } else if (k === 'legs') {
      out.legs = {};
      for (const s of ['N', 'F']) {
        const a = A.legs?.[s] || [...FOOT[s], 0], b = B.legs?.[s] || [...FOOT[s], 0];
        out.legs[s] = a.map((v, i) => mix(v, b[i], u));
      }
    } else {
      const dflt = k === 'hips' ? [0, 2.5] : k === 'root' || k === 'gaze' ? [0, 0] : REST[k] ?? 0;
      const a = A[k] ?? dflt, b = B[k] ?? dflt;
      out[k] = Array.isArray(a) ? a.map((v, i) => mix(v, b[i], u)) : mix(a, b, u);
    }
  }
  return out;
}
/** Insert eased in-between keys wherever a hand travels far, so it moves along a path instead of swinging joints. */
function arcKeys(keys) {
  const out = [keys[0]];
  for (let i = 1; i < keys.length; i++) {
    const [t0, A] = keys[i - 1], [t1, Bp] = keys[i];
    let far = 0;
    for (const s of ['N', 'F']) {
      if (!A[s] && !Bp[s]) continue;
      const a = asWrist(s, A[s]), b = asWrist(s, Bp[s]);
      far = Math.max(far, Math.hypot(a.w[0] - b.w[0], a.w[1] - b.w[1]));
    }
    if (far > 45) {
      const n = 4;
      for (let j = 1; j < n; j++) out.push([t0 + ((t1 - t0) * j) / n, lerpPose(A, Bp, smooth(j / n), Math.min(16, far * 0.12))]);
    }
    out.push(keys[i]);
  }
  return out;
}
const at0 = {}; // empty pose = rest
// torso-space landmarks for the regular build (see face.mjs / body.mjs)
const MOUTH = [36, -150], EAR_N = [-40, -184], BROW = [40, -212], CHEST = [14, -72], HIP_N = [-30, -6], HEAD_TOP = [-6, -246];

clips.thumbs_up = gesture({
  holdAt: 0.5,
  keys: K(
    [0, at0],
    [0.3, { N: { w: [66, -82], a: 196, elbow: 'back' }, torso: 1, head: -2 }],
    [0.42, { N: { w: [70, -94], a: 182, elbow: 'back' }, torso: -1, head: -4 }],
    [0.55, { N: { w: [70, -90], a: 186, elbow: 'back' }, torso: 0, head: -3 }],
    [1.1, { N: { w: [70, -90], a: 186, elbow: 'back' }, torso: 0, head: -3 }],
    [1.45, at0],
  ),
  slots: { handN: K([0, 'open'], [0.16, 'point'], [1.25, 'open']), mouth: K([0, 'grin'], [1.35, null]), eyes: K([0, null], [0.3, 'happy'], [1.2, null]), brows: K([0, 'happy'], [1.35, null]) },
});
clips.beckon = gesture({
  holdAt: 0.9,
  keys: K(
    [0, at0],
    [0.35, { F: { w: [92, -66], a: -150, elbow: 'back' }, torso: 2, head: -4 }],
    [0.6, { F: { w: [70, -78], a: -210, elbow: 'back' }, torso: 0, head: -6 }],
    [0.85, { F: { w: [92, -66], a: -150, elbow: 'back' }, torso: 2, head: -4 }],
    [1.1, { F: { w: [70, -78], a: -210, elbow: 'back' }, torso: 0, head: -6 }],
    [1.35, { F: { w: [92, -66], a: -150, elbow: 'back' }, torso: 2, head: -4 }],
    [1.8, at0],
  ),
  slots: { mouth: K([0, 'smile'], [1.7, null]), brows: K([0, 'happy'], [1.7, null]) },
});
{
  const up = (dx, dy, a) => ({ N: { w: [78 + dx, -138 + dy], a: 200 + a, elbow: 'back' } });
  clips.shake_fist = gesture({
    holdAt: 0.6,
    keys: K(
      [0, at0],
      [0.25, { ...up(0, 6, 0), torso: 4, head: -4, hips: [0, 4] }],
      [0.4, { ...up(6, -4, -14), torso: 6, head: -2, hips: [0, 4] }],
      [0.52, { ...up(-4, 8, 10), torso: 5, head: -4, hips: [0, 4] }],
      [0.64, { ...up(6, -4, -14), torso: 6, head: -2, hips: [0, 4] }],
      [0.76, { ...up(-4, 8, 10), torso: 5, head: -4, hips: [0, 4] }],
      [0.88, { ...up(6, -4, -14), torso: 6, head: -2, hips: [0, 4] }],
      [1.0, { ...up(-2, 6, 6), torso: 5, head: -4, hips: [0, 4] }],
      [1.4, at0],
    ),
    slots: { handN: K([0, 'open'], [0.12, 'fist'], [1.25, 'open']), brows: K([0, 'angry'], [1.3, null]), mouth: K([0, 'frown'], [0.35, 'ah'], [0.95, 'frown'], [1.3, null]) },
  });
}
{
  const s = (dx, dy, a) => ({ N: { w: [-40 + dx, -220 + dy], a: 150 + a, elbow: 'back' }, head: 7, neck: 2, torso: 1, gaze: [2, -4] });
  clips.scratch_head = gesture({
    holdAt: 0.55,
    keys: K([0, at0], [0.4, s(0, 0, 0)], [0.55, s(3, -5, -10)], [0.7, s(-2, 3, 8)], [0.85, s(3, -5, -10)], [1.0, s(-2, 3, 8)], [1.15, s(3, -5, -10)], [1.3, s(0, 0, 0)], [1.75, at0]),
    slots: { brows: K([0, 'worried'], [1.6, null]), mouth: K([0, 'frown'], [1.6, null]) },
  });
}
clips.hands_on_hips = gesture({
  holdAt: 0.5,
  keys: K([0, at0], [0.4, { ...hipHands(), torso: -3, head: -5, neck: -2 }], [0.55, { ...hipHands(1), torso: -2.5, head: -4.5, neck: -2 }], [1.3, { ...hipHands(1), torso: -2.5, head: -4.5, neck: -2 }], [1.7, at0]),
  slots: { handN: K([0, 'open'], [0.25, 'fist'], [1.5, 'open']), handF: K([0, 'open'], [0.25, 'fist'], [1.5, 'open']) },
});
{
  const pr = (dy, a = 0) => ({ N: { w: [40, -100 + dy], a: -170 + a, elbow: 'back' }, F: { w: [48, -102 + dy], a: -164 + a, elbow: 'back' } });
  clips.plead = gesture({
    holdAt: 0.6,
    keys: K([0, at0],
      [0.4, { ...pr(0), torso: 4, head: -9, neck: -2, gaze: [1, -3] }],
      [0.6, { ...pr(6, 6), torso: 6, head: -7, neck: -2, gaze: [1, -3] }],
      [0.8, { ...pr(-2), torso: 4, head: -9, neck: -2, gaze: [1, -3] }],
      [1.0, { ...pr(6, 6), torso: 6, head: -7, neck: -2, gaze: [1, -3] }],
      [1.2, { ...pr(0), torso: 4, head: -9, neck: -2, gaze: [1, -3] }],
      [1.7, at0]),
    slots: { brows: K([0, 'worried'], [1.6, null]), mouth: K([0, 'sad'], [1.6, null]) },
  });
  clips.pray = gesture({
    holdAt: 0.7,
    keys: K([0, at0], [0.6, { ...pr(14), torso: 3, head: 12, neck: 4 }], [1.6, { ...pr(14), torso: 3, head: 12, neck: 4 }], [2.2, at0]),
    slots: { eyes: K([0, null], [0.4, 'closed'], [1.9, null]), mouth: K([0, 'rest'], [2.1, null]) },
  });
}
clips.salute = gesture({
  holdAt: 0.45,
  keys: K([0, at0],
    [0.3, { N: { w: [-30, -190], a: -146, elbow: 'front' }, torso: -2, head: -4, neck: -2 }],
    [0.42, { N: { w: [-34, -198], a: -152, elbow: 'front' }, torso: -2.5, head: -5, neck: -2 }],
    [1.0, { N: { w: [-34, -198], a: -152, elbow: 'front' }, torso: -2.5, head: -5, neck: -2 }],
    [1.25, { N: { w: [10, -178], a: -110, elbow: 'front' }, torso: -1, head: -3 }],
    [1.6, at0]),
  slots: { mouth: K([0, 'rest'], [1.5, null]), brows: K([0, 'angry'], [1.1, null]) },
});
clips.stretch = gesture({
  holdAt: 1.0,
  keys: K([0, at0],
    [0.5, { N: { w: [-20, -150], a: 180, elbow: 'back' }, F: { w: [20, -150], a: 180, elbow: 'back' }, torso: 2, head: 4, hips: [0, 5] }],
    [1.0, { N: { w: [-30, -236], a: 172, elbow: 'back' }, F: { w: [-8, -238], a: 184, elbow: 'back' }, torso: -8, neck: -4, head: -14, hips: [6, -2] }],
    [1.6, { N: { w: [-36, -240], a: 168, elbow: 'back' }, F: { w: [-14, -242], a: 180, elbow: 'back' }, torso: -10, neck: -5, head: -16, hips: [7, -3] }],
    [2.1, { N: { w: [10, -40], a: -40 }, F: { w: [40, -40], a: -40 }, torso: -2, head: -2, hips: [1, 3] }],
    [2.6, at0]),
  slots: { handN: K([0, 'open'], [0.4, 'fist'], [2.0, 'open']), handF: K([0, 'open'], [0.4, 'fist'], [2.0, 'open']), eyes: K([0, null], [0.8, 'closed'], [2.0, null]), mouth: K([0, null], [0.8, 'oh'], [1.9, 'smile'], [2.5, null]) },
});
clips.yawn = gesture({
  holdAt: 0.9,
  keys: K([0, at0],
    [0.5, { N: { w: [44, -128], a: -168, elbow: 'back' }, torso: -3, neck: -3, head: -10 }],
    [0.9, { N: { w: [48, -136], a: -172, elbow: 'back' }, torso: -5, neck: -4, head: -16 }],
    [1.5, { N: { w: [48, -136], a: -172, elbow: 'back' }, torso: -5, neck: -4, head: -16 }],
    [1.9, { torso: 1, head: 3 }],
    [2.4, at0]),
  slots: { eyes: K([0, null], [0.4, 'closed'], [1.9, null]), mouth: K([0, null], [0.3, 'oh'], [0.6, 'ah'], [1.6, 'oh'], [1.85, 'rest'], [2.3, null]), brows: K([0, 'sad'], [2.2, null]) },
});
{
  const sob = (k) => ({ N: { w: [12, -176 + k], a: -176, elbow: 'back' }, F: { w: [30, -172 + k], a: -170, elbow: 'back' }, torso: 7 + k * 0.4, neck: 4, head: 14 + k * 0.5, hips: [0, 5 + k * 0.4] });
  clips.cry = gesture({
    holdAt: 0.55,
    keys: K([0, at0], [0.4, sob(0)], [0.55, sob(4)], [0.7, sob(-1)], [0.85, sob(4)], [1.0, sob(-1)], [1.15, sob(4)], [1.3, sob(-1)], [1.45, sob(4)], [1.6, sob(0)], [2.1, at0]),
    slots: { eyes: K([0, null], [0.3, 'closed'], [1.9, null]), brows: K([0, 'sad'], [2.0, null]), mouth: K([0, 'sad'], [0.5, 'wow'], [1.5, 'sad'], [2.0, null]) },
  });
}
clips.stomp = gesture({
  keys: K([0, at0],
    [0.28, { hips: [0, 0], legs: { N: [-14, -60, -8] }, torso: 3, head: -3, N: { arm: 14, fore: -4, hand: 0 }, F: { arm: 6, fore: -6, hand: 0 } }],
    [0.4, { hips: [0, 12], torso: 8, head: 4, N: { arm: 16, fore: -2, hand: 0 }, F: { arm: 10, fore: -4, hand: 0 } }],
    [0.52, { hips: [0, 6], torso: 5, head: 1, N: { arm: 14, fore: -4, hand: 0 }, F: { arm: 8, fore: -6, hand: 0 } }],
    [1.1, { hips: [0, 4], torso: 4, head: 0, N: { arm: 12, fore: -4, hand: 0 }, F: { arm: 6, fore: -6, hand: 0 } }],
    [1.4, at0]),
  slots: { handN: K([0, 'open'], [0.1, 'fist'], [1.25, 'open']), handF: K([0, 'open'], [0.1, 'fist'], [1.25, 'open']), brows: K([0, 'angry'], [1.3, null]), mouth: K([0, 'frown'], [1.3, null]) },
});
{
  const cw = (k) => ({
    hips: [-6, 34 + k], torso: 18 + k * 0.3, neck: 8, head: 16, gaze: [0, 3],
    N: { w: [36, -150 + k], a: -150, elbow: 'back' }, F: { w: [50, -170 + k], a: -160, elbow: 'back' },
  });
  clips.cower = gesture({
    holdAt: 0.5,
    keys: K([0, at0], [0.3, cw(0)], [0.42, cw(-2)], [0.54, cw(1.5)], [0.66, cw(-2)], [0.78, cw(1.5)], [0.9, cw(-2)], [1.02, cw(1.5)], [1.14, cw(0)], [1.6, at0]),
    slots: { eyes: K([0, null], [0.25, 'closed'], [1.4, null]), brows: K([0, 'worried'], [1.5, null]), mouth: K([0, 'frown'], [1.5, null]) },
  });
}
clips.celebrate = gesture({
  keys: K([0, at0],
    [0.22, { N: { w: [-10, -218], a: 186, elbow: 'back' }, hips: [0, 10], torso: -2, head: -8 }],
    [0.42, { N: { w: [16, -40], a: -40, elbow: 'back' }, hips: [0, 18], legs: { F: [26, -46, -10] }, torso: 8, head: 0 }],
    [0.6, { N: { w: [10, -50], a: -50, elbow: 'back' }, hips: [0, 14], legs: { F: [24, -40, -8] }, torso: 7, head: -2 }],
    [0.8, { N: { w: [-10, -218], a: 186, elbow: 'back' }, F: { w: [16, -216], a: 176, elbow: 'back' }, hips: [0, 2], root: [0, -26], torso: -4, head: -10 }],
    [0.96, { N: { w: [-12, -214], a: 186, elbow: 'back' }, F: { w: [14, -212], a: 176, elbow: 'back' }, hips: [0, 10], root: [0, 0], torso: -2, head: -8 }],
    [1.12, { N: { w: [-10, -218], a: 186, elbow: 'back' }, F: { w: [16, -216], a: 176, elbow: 'back' }, hips: [0, 2], root: [0, -20], torso: -4, head: -10 }],
    [1.28, { N: { w: [-12, -214], a: 186, elbow: 'back' }, F: { w: [14, -212], a: 176, elbow: 'back' }, hips: [0, 8], root: [0, 0], torso: -2, head: -6 }],
    [1.7, at0]),
  slots: { handN: K([0, 'open'], [0.1, 'fist'], [1.5, 'open']), handF: K([0, 'open'], [0.7, 'fist'], [1.5, 'open']), mouth: K([0, 'grin'], [1.6, null]), eyes: K([0, 'happy'], [1.6, null]), brows: K([0, 'happy'], [1.6, null]) },
});
clips.shush = gesture({
  holdAt: 0.45,
  keys: K([0, at0],
    [0.35, { N: { w: [MOUTH[0] + 6, MOUTH[1] + 30], a: 184, elbow: 'back' }, torso: 3, head: 3, neck: 2 }],
    [0.45, { N: { w: [MOUTH[0] + 5, MOUTH[1] + 30], a: 182, elbow: 'back' }, torso: 3.5, head: 4, neck: 2 }],
    [1.1, { N: { w: [MOUTH[0] + 5, MOUTH[1] + 30], a: 182, elbow: 'back' }, torso: 3.5, head: 4, neck: 2 }],
    [1.45, at0]),
  slots: { handN: K([0, 'open'], [0.18, 'point'], [1.25, 'open']), mouth: K([0, 'oo'], [1.3, null]), brows: K([0, 'angry'], [1.3, null]) },
});
clips.peek = gesture({
  holdAt: 0.6,
  keys: K([0, at0],
    [0.5, { N: { w: [BROW[0] + 6, BROW[1] + 16], a: -100, elbow: 'front' }, torso: 16, neck: 2, head: -12, hips: [-12, 6], gaze: [3, -1] }],
    [0.65, { N: { w: [BROW[0] + 8, BROW[1] + 14], a: -98, elbow: 'front' }, torso: 17, neck: 2, head: -13, hips: [-13, 6], gaze: [4, -1] }],
    [1.4, { N: { w: [BROW[0] + 8, BROW[1] + 14], a: -98, elbow: 'front' }, torso: 17, neck: 2, head: -13, hips: [-13, 6], gaze: [4, -1] }],
    [1.9, at0]),
  slots: { brows: K([0, 'surprised'], [1.8, null]) },
});
clips.double_take = gesture({
  keys: K([0, at0],
    [0.3, { head: 4, gaze: [-3, 1] }],
    [0.55, { head: 5, gaze: [-3, 1] }],
    [0.68, { head: -10, neck: -3, torso: -4, gaze: [5, -1], root: [-4, -10], N: { arm: 24, fore: -50, hand: -10 }, F: { arm: -26, fore: -54, hand: -10 } }],
    [0.8, { head: -6, neck: -2, torso: -3, gaze: [4, 0], root: [0, 0], N: { arm: 20, fore: -44, hand: -8 }, F: { arm: -22, fore: -48, hand: -8 } }],
    [1.2, { head: -6, neck: -2, torso: -2, gaze: [4, 0], N: { arm: 16, fore: -36, hand: -6 }, F: { arm: -18, fore: -40, hand: -6 } }],
    [1.6, at0]),
  slots: { brows: K([0, null], [0.62, 'surprised'], [1.5, null]), mouth: K([0, null], [0.62, 'wow'], [1.5, null]) },
});
clips.phone_call = gesture({
  holdAt: 0.5,
  keys: K([0, at0],
    [0.4, { N: { w: [EAR_N[0] + 14, EAR_N[1] + 34], a: 172, elbow: 'back' }, head: -4, neck: -3, torso: 1 }],
    [0.5, { N: { w: [EAR_N[0] + 14, EAR_N[1] + 32], a: 170, elbow: 'back' }, head: -5, neck: -3, torso: 1 }],
    [1.4, { N: { w: [EAR_N[0] + 14, EAR_N[1] + 32], a: 170, elbow: 'back' }, head: -5, neck: -3, torso: 1 }],
    [1.8, at0]),
  slots: { handN: K([0, 'open'], [0.25, 'fist'], [1.6, 'open']) },
});

// ---- original gestures (hand keyed) ------------------------------------------------------------
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

// ================================================================================================
// TALKING GESTURES (looping overlays chosen per line)
// ================================================================================================
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
/** Looping talk overlay from pose keys (first pose is repeated at the end so the loop closes). */
function talkLoop(dur, poses) {
  const n = poses.length;
  const keys = poses.map((ps, i) => [r2((dur * i) / n), ps]);
  keys.push([dur, poses[0]]);
  const c = gesture({ keys, duration: dur });
  c.loop = true;
  return c;
}
// two-handed "explaining": palms open, offering the idea forward, alternating hands
clips.talk_d = talkLoop(3.2, [
  { N: { arm: 4, fore: -8, hand: 0 }, F: { arm: -4, fore: -10, hand: 0 }, head: 0, torso: 0 },
  { N: { w: [30, -70], a: -120, elbow: 'back' }, F: { w: [64, -60], a: -112, elbow: 'back' }, head: -2, torso: 2 },
  { N: { w: [20, -62], a: -110, elbow: 'back' }, F: { w: [56, -54], a: -100, elbow: 'back' }, head: 1.5, torso: 1 },
  { N: { w: [34, -76], a: -128, elbow: 'back' }, F: { w: [52, -64], a: -118, elbow: 'back' }, head: -1.5, torso: 2.5 },
  { N: { w: [18, -56], a: -104, elbow: 'back' }, F: { w: [66, -58], a: -108, elbow: 'back' }, head: 2, torso: 1 },
  { N: { arm: 6, fore: -20, hand: -6 }, F: { arm: -10, fore: -26, hand: -6 }, head: 0.5, torso: 0.5 },
]);
// one hand chopping out the beats of a point
clips.talk_e = talkLoop(2.0, [
  { F: { arm: -4, fore: -10, hand: 0 }, head: 0 },
  { F: { w: [70, -84], a: -96, elbow: 'back' }, head: -2 },
  { F: { w: [74, -62], a: -84, elbow: 'back' }, head: 2 },
  { F: { w: [70, -84], a: -96, elbow: 'back' }, head: -1.5 },
  { F: { w: [74, -60], a: -82, elbow: 'back' }, head: 2.5 },
  { F: { arm: -12, fore: -30, hand: -4 }, head: 0.5 },
]);
// excited: both arms big, bouncing on the toes, head bobbing
clips.talk_excited = talkLoop(1.6, [
  { N: { arm: 10, fore: -40, hand: -10 }, F: { arm: -10, fore: -44, hand: -10 }, head: -2, torso: -1, hips: [0, 2.5] },
  { N: { w: [32, -100], a: -140, elbow: 'back' }, F: { w: [74, -112], a: -140, elbow: 'back' }, head: -6, torso: -3, hips: [0, -1] },
  { N: { w: [10, -84], a: -120, elbow: 'back' }, F: { w: [80, -80], a: -110, elbow: 'back' }, head: -1, torso: 0, hips: [0, 4] },
  { N: { w: [34, -104], a: -150, elbow: 'back' }, F: { w: [70, -118], a: -150, elbow: 'back' }, head: -7, torso: -3, hips: [0, -1] },
  { N: { w: [6, -70], a: -100, elbow: 'back' }, F: { w: [74, -72], a: -100, elbow: 'back' }, head: -2, torso: 0, hips: [0, 4] },
  { N: { arm: 14, fore: -54, hand: -12 }, F: { arm: -14, fore: -60, hand: -12 }, head: -3, torso: -1, hips: [0, 1] },
]);
// calm: one hand resting low and turning gently, a slow sway
clips.talk_calm = talkLoop(4.0, [
  { F: { arm: -4, fore: -10, hand: 0 }, head: 0, torso: 0 },
  { F: { w: [46, -44], a: -80, elbow: 'back' }, head: 1.5, torso: 1 },
  { F: { w: [52, -50], a: -100, elbow: 'back' }, head: -1, torso: 1.5 },
  { F: { w: [44, -42], a: -76, elbow: 'back' }, head: 1, torso: 0.5 },
]);
clips.talk = { ...clips.talk_a };

export const talkClips = ['talk_a', 'talk_b', 'talk_c', 'talk_d', 'talk_e', 'talk_excited', 'talk_calm'];
