// Clothing & body: slots, outfits, shoes, hands and builds of the humanoid rig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { partVisible, activeOptions } from '../src/engine/rig.js';

const rig = JSON.parse(readFileSync(new URL('../src/assets/rigs/humanoid.json', import.meta.url)));
const chars = readdirSync(new URL('../src/assets/characters/', import.meta.url))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(`../src/assets/characters/${f}`, import.meta.url))));

test('wardrobe size and stable ids/defaults', () => {
  const { top, bottom, shoes, handN, handF } = rig.slots;
  assert.ok(top.options.length >= 15 && bottom.options.length >= 8 && shoes.options.length >= 6);
  for (const id of ['tee', 'longsleeve', 'hoodie', 'sweater', 'suit', 'overalls', 'dress']) assert.ok(top.options.includes(id), id);
  for (const id of ['pants', 'shorts', 'skirt', 'bare']) assert.ok(bottom.options.includes(id), id);
  for (const h of [handN, handF]) for (const id of ['open', 'fist', 'point', 'wave', 'thumbsup', 'peace']) assert.ok(h.options.includes(id), id);
  assert.equal(top.default, 'tee');
  assert.equal(bottom.default, 'pants');
  assert.equal(shoes.default, 'sneakers');
  assert.equal(handN.default, 'open');
  for (const b of ['regular', 'slim', 'broad', 'round', 'tall', 'kid', 'elder', 'athletic']) assert.ok(rig.builds[b], b);
});

test('clip references point at real parts; part ids are unique; colours use palette tokens', () => {
  const ids = new Set();
  for (const p of rig.parts) {
    assert.ok(!ids.has(p.id), `duplicate part id ${p.id}`);
    ids.add(p.id);
  }
  const tokens = new Set(rig.palette);
  for (const p of rig.parts) {
    if (p.clip) assert.ok(ids.has(p.clip), `${p.id}: clip ${p.clip} missing`);
    for (const c of [p.fill, p.stroke]) {
      if (typeof c !== 'string' || c[0] !== '$') continue;
      assert.ok(tokens.has(/^\$(\w+)/.exec(c)[1]), `${p.id}: unknown colour token ${c}`);
    }
    for (const cond of [p.when, p.unless]) for (const [slot, v] of Object.entries(cond || {}))
      for (const o of [].concat(v)) assert.ok(rig.slots[slot]?.options.includes(o), `${p.id}: ${slot}=${o} is not an option`);
  }
});

test('every outfit combination shows a torso, two legs, two feet and two hands', () => {
  const visible = (opts) => rig.parts.filter((p) => partVisible(p, opts));
  const bones = (parts) => new Set(parts.map((p) => p.bone));
  for (const top of rig.slots.top.options)
    for (const bottom of rig.slots.bottom.options)
      for (const shoes of rig.slots.shoes.options) {
        const opts = activeOptions(rig, { options: { top, bottom, shoes } });
        const b = bones(visible(opts));
        for (const need of ['torso', 'armN', 'foreN', 'handN', 'armF', 'handF', 'thighN', 'shinN', 'footN', 'footF'])
          assert.ok(b.has(need), `${top}/${bottom}/${shoes}: nothing drawn on ${need}`);
      }
});

test('existing characters keep their look: default shoes and every option they use is drawn', () => {
  for (const c of chars) {
    const opts = activeOptions(rig, c);
    assert.equal(opts.shoes, c.options.shoes ?? 'sneakers');
    const shown = rig.parts.filter((p) => partVisible(p, opts));
    assert.ok(shown.length > 40, `${c.id}: only ${shown.length} parts visible`);
    if ((c.options.shoes ?? 'sneakers') === 'sneakers') assert.ok(shown.some((p) => p.id === 'footNShoe'), `${c.id}: sneakers missing`);
    else assert.ok(shown.some((p) => p.bone === 'footN'), `${c.id}: shoes missing`);
  }
});

test('every build stands with its feet exactly on the floor (rest pose)', async () => {
  const { boneMatrices } = await import('../src/engine/rig.js');
  const ref = boneMatrices(rig, {}, undefined, {});
  for (const [name, build] of Object.entries(rig.builds)) {
    const m = boneMatrices(rig, {}, undefined, build);
    for (const f of ['footN', 'footF']) assert.ok(Math.abs(m[f][5] - ref[f][5]) < 1e-6, `${name}: ${f} at y=${m[f][5]} (regular ${ref[f][5]})`);
  }
});

test('part count stays reasonable', () => {
  assert.ok(rig.parts.length < 1200, `${rig.parts.length} parts`);
  // what is actually drawn for one character is much smaller
  const opts = activeOptions(rig, { options: { top: 'labcoat', bottom: 'jeans', shoes: 'boots' } });
  assert.ok(rig.parts.filter((p) => partVisible(p, opts)).length < 200);
});
