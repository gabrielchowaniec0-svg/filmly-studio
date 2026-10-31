// Hair + headwear asset checks for the humanoid rig (scripts/rigs/humanoid/hair.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partVisible, activeOptions } from '../src/engine/rig.js';
import { COVER } from '../scripts/rigs/humanoid/hair.mjs';

const rig = JSON.parse(readFileSync(new URL('../src/assets/rigs/humanoid.json', import.meta.url)));
const ORIGINAL_HAIR = ['short', 'spiky', 'swoop', 'buzz', 'bob', 'long', 'ponytail', 'bun', 'curly', 'bald'];
const ORIGINAL_HATS = ['none', 'beanie', 'cap', 'bow', 'headband', 'headphones', 'flower'];

const visible = (hair, headwear) => {
  const opts = activeOptions(rig, { options: { hair, headwear } });
  return rig.parts.filter((p) => partVisible(p, opts));
};
const hairParts = (hair, headwear) => visible(hair, headwear).filter((p) => p.slot === 'hair' || p.when?.hair);

test('hair: keeps original ids and offers 20+ styles; headwear keeps ids and offers 12+ hats', () => {
  for (const h of ORIGINAL_HAIR) assert.ok(rig.slots.hair.options.includes(h), h);
  for (const h of ORIGINAL_HATS) assert.ok(rig.slots.headwear.options.includes(h), h);
  assert.ok(rig.slots.hair.options.length >= 20);
  assert.ok(rig.slots.headwear.options.filter((o) => o !== 'none').length >= 12);
});

test('hair: every style draws something with and without a covering hat', () => {
  for (const h of rig.slots.hair.options) {
    if (h === 'bald') continue;
    assert.ok(hairParts(h, 'none').length > 0, `${h} bare`);
    assert.ok(hairParts(h, 'fedora').length > 0, `${h} under fedora`);
  }
});

test('hair: tall pieces hide under covering hats', () => {
  const tall = (hair) => hairParts(hair, 'none').filter((p) => p.unless?.headwear).map((p) => p.id);
  for (const hair of ['spiky', 'bun', 'highpuff', 'twopuffs', 'spacebuns', 'mohawk', 'afro', 'curly', 'manbun', 'undercut']) {
    const t = tall(hair);
    assert.ok(t.length > 0, `${hair} has hat-sensitive parts`);
    for (const hat of COVER) {
      const ids = new Set(hairParts(hair, hat).map((p) => p.id));
      for (const id of t) assert.ok(!ids.has(id), `${hair}/${hat}: ${id} should hide`);
    }
  }
});

test('hair: clip targets exist and share the same slot option; swaying parts use hair/tail bones', () => {
  const byId = Object.fromEntries(rig.parts.map((p) => [p.id, p]));
  for (const p of rig.parts) {
    if (!p.clip || !(p.slot === 'hair' || p.slot === 'headwear')) continue;
    assert.ok(byId[p.clip], `${p.id} clips to missing ${p.clip}`);
  }
  for (const id of ['hairBackLong', 'hairBackWavy', 'braidsBack', 'locsBack', 'hairLockLong', 'braidNear', 'sideBraid']) assert.equal(byId[id].bone, 'hair', id);
  assert.equal(byId.ponytail.bone, 'tail');
});

test('hair: part budget per look stays modest', () => {
  for (const h of rig.slots.hair.options) for (const hw of rig.slots.headwear.options) {
    const n = hairParts(h, hw).length + visible(h, hw).filter((p) => p.slot === 'headwear').length;
    assert.ok(n <= 24, `${h}/${hw}: ${n} parts`);
  }
});
