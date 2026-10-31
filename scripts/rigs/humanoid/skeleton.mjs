// Skeleton and body builds (scale = part-only, bscale = cascading bone scale, dpos = bone offset).
// Part of the humanoid rig generator (see ./index.mjs). Character faces RIGHT; y down; +rot = clockwise.
export const bones = [
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


const limbs = (sx, sy = 1) => Object.fromEntries(['armN', 'foreN', 'armF', 'foreF'].map((b) => [b, { scale: [sx, sy] }]));
const legs = (sx, sy = 1) => Object.fromEntries(['thighN', 'shinN', 'thighF', 'shinF'].map((b) => [b, { scale: [sx, sy] }]));
export const builds = {
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

