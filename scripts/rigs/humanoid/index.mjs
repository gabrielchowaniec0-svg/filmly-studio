// Generator for src/assets/rigs/humanoid.json — a 3/4-view cartoon person, assembled from modules:
//   skeleton.mjs (bones, builds) · body.mjs (limbs, clothing) · face.mjs (head, face, eyewear, moods)
//   hair.mjs (hair, headwear) · clips.mjs (animations) · common.mjs (helpers, z ranges)
//   node scripts/rigs/humanoid/index.mjs     (writes the JSON; tests check it is up to date)
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCtx } from './common.mjs';
import { bones, builds } from './skeleton.mjs';
import { addBody, slots as bodySlots } from './body.mjs';
import { addFace, slots as faceSlots, moods } from './face.mjs';
import { addHairBack, addHairFront, slots as hairSlots } from './hair.mjs';
import { clips, talkClips } from './clips.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../src/assets/rigs/humanoid.json');

const ctx = makeCtx();
addBody(ctx); // far arm, legs, hips, torso
addHairBack(ctx); // hair behind the head
addFace(ctx); // head, face, eyewear
addHairFront(ctx); // fringe, headwear
addBody(ctx, { near: true }); // near arm, in front of the body
const parts = ctx.parts;
const slots = { ...faceSlots, ...hairSlots, ...bodySlots };

// ------------------------------------------------------------------------------------------
const rig = {
  id: 'humanoid',
  name: 'Person (3/4 view)',
  generatedBy: 'scripts/rigs/humanoid/index.mjs',
  height: 424,
  displayScale: 0.92,
  style: { stroke: '$outline', lw: 3.5 },
  palette: ['skin', 'hair', 'brow', 'eye', 'blush', 'top', 'top2', 'bottom', 'shoes', 'sole', 'accent', 'frame', 'outline'],
  bones, slots, parts, builds, clips, talkClips,
  moods,
};

export default rig;
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUT, JSON.stringify(rig) + '\n');
  console.log(`humanoid: ${bones.length} bones, ${parts.length} parts, ${Object.keys(clips).length} clips`);
}
