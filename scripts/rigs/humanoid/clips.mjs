// Animation clips. Overlay clips replace only the bones they animate; holdAt = pose to hold for long gestures.
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
const K = (...pairs) => pairs; // readability helper: K([t,v],[t,v])
// Build cyclic tracks from a list of values over evenly spaced keys (first value repeated at the end).
const cyc = (dur, vals) => { const n = vals.length; return [...vals.map((v, i) => [+(dur * i / n).toFixed(4), v]), [dur, vals[0]]]; };
// Shift a cyclic value list by half (for the opposite leg/arm).
const half = (vals) => [...vals.slice(vals.length / 2), ...vals.slice(0, vals.length / 2)];

export const clips = {};

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

export const talkClips = ['talk_a', 'talk_b', 'talk_c'];
