import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadAssetsFs, readJSON } from './helpers.mjs';
import { buildManifest } from '../scripts/build-manifest.mjs';
import { TRANSITIONS } from '../src/assets/transitions/index.js';

const A = loadAssetsFs();

test('manifest.json is in sync with the files on disk (run: node scripts/build-manifest.mjs)', () => {
  assert.deepEqual(readJSON('src/assets/manifest.json'), buildManifest());
});

test('rig: bones are parent-first, parts reference real bones and slots', () => {
  for (const rig of Object.values(A.rigs)) {
    const seen = new Set();
    for (const b of rig.bones) {
      assert.ok(b.parent === null || seen.has(b.parent), `${rig.id}: bone ${b.id} parent ${b.parent} must be defined earlier`);
      seen.add(b.id);
    }
    const ids = new Set();
    for (const p of rig.parts) {
      assert.ok(!ids.has(p.id), `duplicate part id ${p.id}`);
      ids.add(p.id);
      assert.ok(seen.has(p.bone), `part ${p.id} uses unknown bone ${p.bone}`);
      if (p.slot) {
        assert.ok(rig.slots[p.slot], `part ${p.id} uses unknown slot ${p.slot}`);
        assert.ok(rig.slots[p.slot].options.includes(p.option), `part ${p.id}: option ${p.option} not in slot ${p.slot}`);
      }
    }
    // every non-"none" slot option should draw something, except hair "bald", outfit "tee", accessory "none"
    const exempt = new Set(['hair:bald', 'outfit:tee', 'accessory:none']);
    for (const [slot, def] of Object.entries(rig.slots))
      for (const o of def.options) if (!exempt.has(`${slot}:${o}`)) assert.ok(rig.parts.some((p) => p.slot === slot && p.option === o), `slot ${slot} option ${o} has no parts`);
  }
});

test('rig clips only animate real bones, keys ascend, loops close their cycle', () => {
  for (const rig of Object.values(A.rigs)) {
    const bones = new Set(rig.bones.map((b) => b.id));
    for (const [cid, clip] of Object.entries(rig.clips)) {
      for (const [bone, tr] of Object.entries(clip.tracks)) {
        assert.ok(bones.has(bone), `${cid}: unknown bone ${bone}`);
        for (const kind of ['rot', 'pos']) {
          const keys = tr[kind];
          if (!keys) continue;
          for (let i = 1; i < keys.length; i++) assert.ok(keys[i][0] > keys[i - 1][0], `${cid}.${bone}.${kind}: key times must increase`);
          assert.ok(keys[keys.length - 1][0] <= clip.duration + 1e-9, `${cid}.${bone}: key beyond duration`);
          if (clip.loop && keys.length > 2) {
            assert.equal(JSON.stringify(keys[0][1]), JSON.stringify(keys[keys.length - 1][1]), `${cid}.${bone}.${kind}: loop must end where it starts`);
            assert.equal(keys[keys.length - 1][0], clip.duration, `${cid}.${bone}.${kind}: loop last key must be at duration`);
          }
        }
      }
    }
    assert.ok(rig.clips.idle && rig.clips.walk, 'rig needs idle and walk');
  }
});

test('characters: valid rig, slot options, complete palette, real voice', () => {
  for (const c of Object.values(A.characters)) {
    const rig = A.rigs[c.rig];
    assert.ok(rig, `${c.id}: unknown rig ${c.rig}`);
    for (const [slot, opt] of Object.entries(c.options)) assert.ok(rig.slots[slot]?.options.includes(opt), `${c.id}: bad ${slot}=${opt}`);
    const used = new Set();
    const scan = (v) => { if (typeof v === 'string' && v[0] === '$') used.add(v.slice(1)); else if (v && typeof v === 'object') Object.values(v).forEach(scan); };
    scan(rig);
    for (const k of used) assert.ok(c.palette[k], `${c.id}: palette missing "${k}"`);
    assert.ok(A.voices[c.voice], `${c.id}: unknown voice ${c.voice}`);
  }
});

test('scenes: floorY on stage, shapes valid', () => {
  for (const s of Object.values(A.scenes)) {
    assert.ok(s.floorY > 300 && s.floorY < 1080, `${s.id} floorY`);
    for (const l of s.layers) assert.ok(['rect', 'ellipse', 'poly', 'path'].includes(l.type), `${s.id}: bad layer type ${l.type}`);
  }
});

test('transitions are functions', () => {
  for (const [id, t] of Object.entries(TRANSITIONS)) assert.equal(typeof t.draw, 'function', id);
  assert.ok(TRANSITIONS.cut && TRANSITIONS.fade);
});

test('every .fly in /films compiles without errors', async () => {
  const { compileSource } = await import('../src/filmscript/index.js');
  const { readText } = await import('./helpers.mjs');
  for (const f of readdirSync(join(ROOT, 'films')).filter((x) => x.endsWith('.fly'))) {
    const r = compileSource(readText('films/' + f), A);
    assert.deepEqual(r.errors, [], `${f}: ${JSON.stringify(r.errors)}`);
  }
});
