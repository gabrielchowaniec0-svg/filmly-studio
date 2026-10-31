import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadAssetsFs, readText } from './helpers.mjs';
import { builders, serialize } from '../scripts/scenes/index.mjs';

const A = loadAssetsFs();
const scenes = Object.values(A.scenes);
const STAGE_W = 1920;
const isColor = (c) => typeof c === 'string' && (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) || /^rgba?\([\d.,\s]+\)$/.test(c));
const isPaint = (f) => f == null || isColor(f) || (typeof f === 'object' && Array.isArray(f.stops) && f.stops.length >= 1 &&
  f.stops.every(([o, c]) => o >= 0 && o <= 1 && isColor(c)) &&
  (f.radial ? ['cx', 'cy', 'r'].every((k) => Number.isFinite(f[k])) : ['x0', 'y0', 'x1', 'y1'].every((k) => Number.isFinite(f[k]))));

function checkShape(id, s, where) {
  const tag = `${id} ${where}`;
  assert.ok(['rect', 'ellipse', 'poly', 'path'].includes(s.type), `${tag}: bad type ${s.type}`);
  if (s.type === 'rect') assert.ok(['x', 'y', 'w', 'h'].every((k) => Number.isFinite(s[k])), `${tag}: rect geometry`);
  if (s.type === 'ellipse') assert.ok(['cx', 'cy', 'rx', 'ry'].every((k) => Number.isFinite(s[k])) && s.rx >= 0 && s.ry >= 0, `${tag}: ellipse geometry`);
  if (s.type === 'poly') assert.ok(Array.isArray(s.points) && s.points.length >= 2 && s.points.every((p) => p.length === 2 && p.every(Number.isFinite)), `${tag}: poly points`);
  if (s.type === 'path') assert.ok(typeof s.d === 'string' && /^M/.test(s.d) && /^[MLHVCSQTAZmlhvcsqtaz\d\s.,-]+$/.test(s.d), `${tag}: path d`);
  assert.ok(s.fill || s.stroke, `${tag}: draws nothing`);
  assert.ok(isPaint(s.fill), `${tag}: bad fill ${JSON.stringify(s.fill)}`);
  assert.ok(isPaint(s.stroke), `${tag}: bad stroke ${JSON.stringify(s.stroke)}`);
  if (s.alpha != null) assert.ok(s.alpha >= 0 && s.alpha <= 1, `${tag}: alpha`);
}

test('scene library: at least 22 backgrounds incl. the classic four', () => {
  assert.ok(scenes.length >= 22, `only ${scenes.length} scenes`);
  for (const id of ['studio', 'living_room', 'street_day', 'night_forest', 'spooky_mansion_hall', 'mansion_exterior_night']) assert.ok(A.scenes[id], `missing ${id}`);
});

test('scenes: snake_case ids matching file names, readable names, valid type and floor', () => {
  const files = readdirSync(join(ROOT, 'src/assets/scenes')).filter((f) => f.endsWith('.json'));
  for (const f of files) assert.ok(A.scenes[f.replace(/\.json$/, '')], `${f}: id must equal the file name`);
  for (const s of scenes) {
    assert.match(s.id, /^[a-z][a-z0-9_]*$/);
    assert.ok(typeof s.name === 'string' && s.name.length >= 3 && /^[A-Z]/.test(s.name), `${s.id}: name`);
    assert.ok(['interior', 'exterior'].includes(s.type), `${s.id}: type`);
    // actors stand at floorY .. floorY+200 (depth 0..100) and are ~400px tall: keep them on stage
    assert.ok(s.floorY >= 700 && s.floorY <= 860, `${s.id}: floorY ${s.floorY}`);
  }
  assert.equal(new Set(scenes.map((s) => s.name)).size, scenes.length, 'scene names are unique');
});

test('scenes: every layer and front shape is drawable', () => {
  for (const s of scenes) {
    assert.ok(Array.isArray(s.layers) && s.layers.length > 0, `${s.id}: layers`);
    s.layers.forEach((l, i) => checkShape(s.id, l, `layers[${i}]`));
    if (s.front !== undefined) {
      assert.ok(Array.isArray(s.front) && s.front.length > 0, `${s.id}: front must be a non-empty array`);
      s.front.forEach((l, i) => checkShape(s.id, l, `front[${i}]`));
    }
  }
});

test('scenes: per-frame budget and an opaque full-frame backdrop', () => {
  for (const s of scenes) {
    const n = s.layers.length + (s.front?.length || 0);
    assert.ok(n <= 140, `${s.id}: ${n} shapes is too many for a per-frame background`);
    const first = s.layers[0];
    assert.ok(first.type === 'rect' && first.x <= 0 && first.y <= 0 && first.w >= STAGE_W && first.fill, `${s.id}: first layer should be a full-width backdrop`);
    assert.ok(readText(`src/assets/scenes/${s.id}.json`).length < 120000, `${s.id}: file too large`);
  }
});

test('scene front layers never blanket the middle of the stage', () => {
  for (const s of scenes.filter((x) => x.front)) {
    for (const [i, f] of s.front.entries()) {
      if (f.type !== 'rect' || (f.alpha ?? 1) < 0.5 || typeof f.fill !== 'string') continue;
      assert.ok(!(f.x < 860 && f.x + f.w > 1060 && f.y < 700 && f.y + f.h > 500), `${s.id} front[${i}] covers the centre of the stage`);
    }
  }
});

test('scene JSON is in sync with the generators (run: node scripts/scenes/index.mjs)', () => {
  for (const [id, make] of Object.entries(builders)) assert.equal(readText(`src/assets/scenes/${id}.json`), serialize(make()), `${id}.json is stale`);
});
