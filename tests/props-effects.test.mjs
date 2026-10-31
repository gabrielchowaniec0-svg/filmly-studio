import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadAssetsFs, readJSON } from './helpers.mjs';
import { compileSource } from '../src/filmscript/index.js';
import { EFFECTS, EFFECT_ALIASES } from '../src/assets/effects/index.js';
import { propState, heldBy, effectsAt } from '../src/engine/timeline.js';
import { ALL_PROPS } from '../scripts/props/index.mjs';

const A = loadAssetsFs();
A.props = {};
for (const p of readJSON('src/assets/manifest.json').props || []) { const j = readJSON(p); A.props[j.id] = j; }

const film = (body, head = '') => `film "T" 1920x1080 @30\n${head}scene s bg=living_room {\n  cast mira: mira at 30\n  cast bo: bo at 70\n${body}\n}\n`;
const ok = (src) => {
  const r = compileSource(src, A);
  assert.deepEqual(r.errors, [], JSON.stringify(r.errors));
  return r.film.scenes[0];
};
const fails = (src, re) => {
  const r = compileSource(src, A);
  assert.ok(r.errors.some((e) => re.test(e.message)), `expected ${re} in ${JSON.stringify(r.errors)}`);
};

test('props: 40+ prop assets, generated files are current, shapes are valid', () => {
  const ids = Object.keys(A.props);
  assert.ok(ids.length >= 40, `only ${ids.length} props`);
  const onDisk = readdirSync(join(ROOT, 'src/assets/props')).filter((f) => f.endsWith('.json'));
  assert.equal(onDisk.length, ALL_PROPS.length, 'run: node scripts/props/index.mjs');
  for (const p of ALL_PROPS) assert.deepEqual(A.props[p.id], JSON.parse(JSON.stringify(p, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))), `${p.id}.json is stale — run node scripts/props/index.mjs`);
  const types = new Set(['rect', 'ellipse', 'poly', 'path']);
  for (const p of Object.values(A.props)) {
    assert.ok(p.name && p.category && Array.isArray(p.size) && p.shapes.length, p.id);
    for (const s of p.shapes) assert.ok(types.has(s.type), `${p.id}: bad shape ${s.type}`);
    if (p.grip) assert.equal(p.grip.length, 2);
    // every $token colour must exist in the prop palette
    const json = JSON.stringify(p.shapes);
    for (const m of json.matchAll(/"\$([A-Za-z_]\w*)([+-]\d+(?:\.\d+)?)?"/g)) assert.ok(p.palette?.[m[1]], `${p.id} uses $${m[1]} without a palette`);
    assert.ok(!/\$\w+[+-]\d+[+-]/.test(json), `${p.id}: malformed colour token`);
  }
  for (const id of ['mug', 'phone', 'book', 'umbrella', 'flashlight', 'key', 'letter', 'magnifier', 'map', 'microphone', 'guitar'])
    assert.ok(A.props[id]?.grip, `${id} should be holdable`);
});

test('props: placing, moving, show/hide', () => {
  const sc = ok(film('  prop cup: mug at 50,10 scale=1.2 hidden front\n  prop s: sign at 20 text="Hi there" flip\n  prop c: chair at 80 color=#3366ff up=20\n  wait 0.3s\n  cup shows\n  cup moves to 60,5 over 1s\n  cup hides'));
  assert.deepEqual(sc.propOrder, ['cup', 's', 'c']);
  assert.equal(sc.props.cup.x, 960);
  assert.equal(sc.props.cup.scale, 1.2);
  assert.ok(sc.props.cup.hidden && sc.props.cup.front);
  assert.equal(sc.props.s.text, 'Hi there');
  assert.deepEqual(sc.props.c.palette, { main: '#3366ff' });
  assert.equal(propState(sc, 'cup', 0).visible, false);
  assert.equal(propState(sc, 'cup', 0.8).visible, true);
  assert.equal(propState(sc, 'cup', 0.8).x, 960 + (1152 - 960) * 0.5);
  assert.equal(propState(sc, 'cup', 2).x, 1152);
  assert.equal(propState(sc, 'cup', 2).visible, false);
  assert.equal(propState(sc, 'c', 0).up, 20);
});

test('props: holds / gives / drops', () => {
  const sc = ok(film('  prop cup: mug at 40\n  mira walks to cup\n  mira holds cup\n  wait 1s\n  mira gives cup to bo in near\n  wait 1s\n  bo drops cup\n  mira looks at cup\n  bo faces cup'));
  const hold = sc.events.find((e) => e.type === 'hold');
  assert.equal(hold.actor, 'mira');
  assert.equal(hold.hand, 'F');
  assert.deepEqual(heldBy(sc, 'mira', hold.t + 0.1), { F: 'cup', N: null });
  const give = sc.events.filter((e) => e.type === 'hold')[1];
  assert.equal(give.actor, 'bo');
  assert.equal(give.hand, 'N');
  assert.deepEqual(heldBy(sc, 'mira', give.t + 0.1), { F: null, N: null });
  assert.deepEqual(heldBy(sc, 'bo', give.t + 0.1), { F: null, N: 'cup' });
  const drop = sc.events.find((e) => e.type === 'drop');
  const after = propState(sc, 'cup', drop.t + 1);
  assert.equal(after.attach.actor, null);
  assert.equal(after.x, drop.to.x);
  // `mira walks to cup` stops beside it, not on it
  const mv = sc.events.find((e) => e.type === 'move' && e.actor === 'mira');
  assert.ok(Math.abs(mv.to.x - 768) > 40 && Math.abs(mv.to.x - 768) < 100);
  // drop with no prop name drops everything held
  const sc2 = ok(film('  prop a: mug at 40\n  prop b: phone at 40\n  mira holds a\n  mira holds b in near\n  mira drops'));
  assert.equal(sc2.events.filter((e) => e.type === 'drop').length, 2);
});

test('props: helpful errors', () => {
  fails(film('  prop cup: mugg at 40'), /Unknown prop "mugg".*Did you mean "mug"/);
  fails(film('  prop cup: mug at 40\n  mira holds cpu'), /Unknown prop "cpu".*Did you mean "cup"/);
  fails(film('  prop cup: mug at 40\n  cup waves'), /"cup" is a prop/);
  fails(film('  prop cup: mug at 40\n  cup walks to 50'), /Props can't walk/);
  fails(film('  prop car: car at 40\n  mira holds car'), /too big to hold/);
  fails(film('  prop cup: mug at 40\n  mira drops cup'), /isn't holding cup/);
  fails(film('  prop cup: mug at 40\n  mira holds cup\n  cup moves to 60'), /mira drops cup/);
  fails(film('  prop a: mug at 40\n  prop b: book at 40\n  mira holds a\n  mira holds b'), /already has a/);
  fails(film('  prop mira: mug at 40'), /already used/);
  fails(film('  prop cup: mug at 40 colour=#ff0000'), /Unknown prop setting "colour".*Did you mean "color"/);
  fails(film('  prop cup: mug at 40 text="x"'), /no space for text/);
  fails(film('  prop cup: mug at 40\n  mira gives cup to bo'), /isn't holding cup/);
  fails('film "T" 1920x1080 @30\nprop cup: mug at 40\n', /inside a scene/);
});

test('effects: 10+ effects, start/stop/fade, errors', () => {
  assert.ok(Object.keys(EFFECTS).length >= 10);
  for (const [id, fx] of Object.entries(EFFECTS)) assert.ok(fx.label && typeof fx.draw === 'function', id);
  for (const v of Object.values(EFFECT_ALIASES)) assert.ok(EFFECTS[v]);
  const sc = ok(film('  effect rain amount=0.6\n  effect fog\n  wait 2s\n  effect rain off fade=1s\n  wait 2s\n  effect snow 0.5\n  wait 1s\n  effect none\n  wait 1s\n  effect spotlight follow=mira'));
  const at = (t) => Object.fromEntries(effectsAt(sc, t).map((e) => [e.id, +e.amount.toFixed(3)]));
  assert.deepEqual(at(0.25), { rain: 0.3, fog: 0.5 });
  assert.deepEqual(at(1), { rain: 0.6, fog: 1 });
  assert.deepEqual(at(2.5), { rain: 0.3, fog: 1 });
  assert.deepEqual(at(3.5), { fog: 1 });
  assert.deepEqual(at(5), { fog: 1, snow: 0.5 });
  assert.deepEqual(at(6), {});
  assert.equal(effectsAt(sc, 7.6)[0].opts.follow, 'mira');
  fails(film('  effect rian'), /Unknown effect "rian".*Did you mean "rain"/);
  fails(film('  effect spotlight follow=zed'), /Unknown actor "zed"/);
  ok(film('  effect motes\n  effect grain'));
});

// A recording 2D context: effects must be pure functions of (t, opts, seed).
function recorder() {
  const log = [];
  const grad = { addColorStop: (...a) => log.push(['stop', ...a]) };
  return new Proxy({ log }, {
    get(target, k) {
      if (k === 'log') return log;
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => (log.push([k, ...a]), grad);
      if (k === 'createPattern') return () => null;
      if (k === 'canvas') return { width: 1920, height: 1080 };
      if (k in target) return target[k];
      return (...a) => log.push([k, ...a.map((x) => (typeof x === 'number' ? +x.toFixed(4) : x))]);
    },
    set(target, k, v) { log.push(['set', k, typeof v === 'object' ? 'obj' : v]); target[k] = v; return true; },
  });
}

test('effects: deterministic in t (frame-exact exports) and they draw something', () => {
  const real = Math.random;
  Math.random = () => { throw new Error('Math.random used at draw time'); };
  try {
    for (const [id, fx] of Object.entries(EFFECTS)) {
      for (const t of [0.4, 3.217]) {
        const a = recorder(), b = recorder();
        fx.draw(a, 1920, 1080, t, { amount: 0.8 }, 1234);
        fx.draw(b, 1920, 1080, t, { amount: 0.8 }, 1234);
        assert.deepEqual(a.log, b.log, `${id} differs between identical calls`);
      }
      const z = recorder();
      fx.draw(z, 1920, 1080, 1, { amount: 0 }, 1);
      assert.equal(z.log.filter((l) => /^(fill|stroke)/.test(l[0])).length, 0, `${id} should draw nothing at amount 0`);
    }
    const r = recorder();
    EFFECTS.rain.draw(r, 1920, 1080, 1, { amount: 1 }, 7);
    assert.ok(r.log.filter((l) => l[0] === 'lineTo').length > 100, 'rain should draw lots of streaks');
  } finally {
    Math.random = real;
  }
});

test('docs mention props and effects', async () => {
  const { readText } = await import('./helpers.mjs');
  const d = readText('docs/FILMSCRIPT.md');
  assert.match(d, /prop cup: mug/);
  assert.match(d, /effect rain/);
});
