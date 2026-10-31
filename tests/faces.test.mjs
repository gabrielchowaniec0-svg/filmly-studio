// Face contracts other parts of the rig (hair, renderer, lip-sync, creator) depend on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rig = JSON.parse(readFileSync(new URL('../src/assets/rigs/humanoid.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(rig.parts.map((p) => [p.id, p]));

test('faces: key part ids and bones are kept', () => {
  for (const id of ['head', 'ear', 'earInner', 'nose', 'eyeWhiteN', 'eyeWhiteF', 'irisN', 'irisF', 'pupilN', 'pupilF', 'lidN', 'lidF', 'cheekN', 'cheekF', 'beard', 'mustache', 'stubble'])
    assert.ok(byId[id], `missing part ${id}`);
  assert.equal(byId.lidN.bone, 'lidN');
  assert.equal(byId.lidF.bone, 'lidF');
  for (const id of ['irisN', 'irisF', 'pupilN', 'pupilF', 'glintN', 'glintF']) assert.equal(byId[id].bone, 'gaze', id);
  assert.equal(byId.irisN.clip, 'eyeWhiteN');
  assert.equal(byId.irisF.clip, 'eyeWhiteF');
});

test('faces: slots keep every original option; new options have defaults', () => {
  const want = {
    eyes: ['open', 'happy', 'closed'],
    brows: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried'],
    mouth: ['rest', 'smile', 'grin', 'sad', 'frown', 'mbp', 'ee', 'ah', 'oh', 'oo', 'fv', 'half', 'wow'],
    lashes: ['none', 'lashes'],
    facial: ['none', 'stubble', 'mustache', 'beard'],
    eyewear: ['none', 'glasses', 'round', 'sunglasses'],
  };
  for (const [slot, opts] of Object.entries(want)) for (const o of opts) assert.ok(rig.slots[slot].options.includes(o), `${slot}=${o}`);
  assert.equal(rig.slots.browStyle.default, 'medium');
  assert.equal(rig.slots.freckles.default, 'none');
});

test('faces: every mouth, brow and brow style combination has a drawable part', () => {
  for (const m of rig.slots.mouth.options) assert.ok(rig.parts.some((p) => p.slot === 'mouth' && [].concat(p.option).includes(m)), `mouth ${m}`);
  for (const b of rig.slots.brows.options) for (const st of rig.slots.browStyle.options) {
    const n = rig.parts.filter((p) => p.slot === 'brows' && p.option === b && p.when?.browStyle === st).length;
    assert.equal(n, 2, `brows ${b}/${st}`);
  }
});

test('faces: head silhouette stays inside the bounds hairstyles are drawn against', () => {
  const nums = byId.head.shape.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...ys) >= -132 && Math.min(...ys) <= -128, 'top ≈ -130');
  assert.ok(Math.min(...xs) >= -64 && Math.min(...xs) <= -60, 'back ≈ -62');
  assert.ok(Math.max(...xs) >= 64 && Math.max(...xs) <= 68, 'front ≈ 66');
  assert.ok(Math.max(...ys) >= -2 && Math.max(...ys) <= 3, 'chin ≈ 0');
});
