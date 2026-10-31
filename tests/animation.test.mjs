import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAssetsFs } from './helpers.mjs';
import { compileSource } from '../src/filmscript/index.js';
import { parse } from '../src/filmscript/parse.js';
import { actorState, TALK_CLIPS } from '../src/engine/timeline.js';
import { poseAt, boneMatrices, resolveBuild } from '../src/engine/rig.js';
import { IDENT } from '../src/engine/paint.js';

const A = loadAssetsFs();
const rig = A.rigs.humanoid;
const H = 'film "T" 1920x1080 @30\n';
const ok = (src) => { const r = compileSource(src, A); assert.deepEqual(r.errors, [], JSON.stringify(r.errors)); return r.film; };
const bad = (src) => compileSource(src, A).errors.map((e) => e.message).join('\n');

const SOLE = [[-17, 10], [0, 10], [20, 10], [36, 10]]; // heel .. ball of the shoe, foot space
const movement = Object.entries(rig.clips).filter(([, c]) => c.speed && !c.overlay);
const sole = (m, side, dx = 0) => SOLE.map(([x, y]) => { const M = m['foot' + side]; return [M[0] * x + M[2] * y + M[4] + dx, M[1] * x + M[3] * y + M[5]]; });

test('movement clips: styles exist, loop, and carry a natural pace', () => {
  const ids = movement.map(([id]) => id);
  for (const id of ['walk', 'run', 'jog', 'sprint', 'sneak', 'stroll', 'march', 'tiptoe', 'limp', 'strut', 'sad_walk']) assert.ok(ids.includes(id), `missing ${id}`);
  for (const [id, c] of movement) {
    assert.ok(c.loop, `${id} loops`);
    assert.ok(c.speed > 60 && c.speed < 1200, `${id} speed ${c.speed}`);
  }
  assert.ok(rig.clips.sneak.speed < rig.clips.walk.speed && rig.clips.walk.speed < rig.clips.jog.speed && rig.clips.jog.speed < rig.clips.run.speed && rig.clips.run.speed < rig.clips.sprint.speed);
});

test('planted feet do not slide or sink at the natural pace (regular build)', () => {
  for (const [id, c] of movement) {
    const v = c.speed / rig.displayScale; // rig units per second
    const n = 240, dt = c.duration / n;
    let sink = 0;
    // a sole point counts as planted while it stays on the ground; measure how far it drifts over that time
    const runs = {};
    for (let i = 0; i <= n; i++) {
      const t = i * dt;
      const m = boneMatrices(rig, poseAt([{ clip: c, t }]), IDENT, {});
      for (const side of ['N', 'F']) {
        sole(m, side, v * t).forEach(([x, y], k) => {
          sink = Math.max(sink, y);
          const key = side + k;
          const r = (runs[key] ||= { start: null, worst: 0 });
          if (y > -0.75) {
            if (r.start == null) r.start = x;
            r.worst = Math.max(r.worst, Math.abs(x - r.start));
          } else r.start = null;
        });
      }
    }
    const worst = Math.max(...Object.values(runs).map((r) => r.worst));
    assert.ok(sink < 3, `${id}: sole sinks ${sink.toFixed(1)} below the floor`);
    assert.ok(worst < 9, `${id}: planted foot slides ${worst.toFixed(1)} units`);
  }
});

test('standing loops keep both feet on the floor', () => {
  for (const id of ['idle', 'idle_bored', 'idle_nervous', 'idle_confident', 'idle_tired']) {
    const c = rig.clips[id];
    assert.ok(c && c.loop && !c.overlay, id);
    for (let i = 0; i < 40; i++) {
      const m = boneMatrices(rig, poseAt([{ clip: c, t: (c.duration * i) / 40 }]), IDENT, {});
      for (const side of ['N', 'F']) {
        const ys = sole(m, side).map((p) => p[1]);
        assert.ok(Math.max(...ys) < 2, `${id}: ${side} foot sinks (${Math.max(...ys).toFixed(1)})`);
        assert.ok(Math.max(...ys) > -2, `${id}: ${side} foot floats (${Math.max(...ys).toFixed(1)})`);
      }
    }
  }
});

test('gestures are overlays that start and end at rest, with sensible holds', () => {
  const NEW = ['thumbs_up', 'beckon', 'shake_fist', 'scratch_head', 'hands_on_hips', 'plead', 'pray', 'salute', 'stretch', 'yawn', 'cry',
    'stomp', 'cower', 'celebrate', 'shush', 'peek', 'double_take', 'phone_call'];
  const idle0 = poseAt([{ clip: rig.clips.idle, t: 0 }]);
  for (const id of NEW) {
    const c = rig.clips[id];
    assert.ok(c && c.overlay && !c.loop, id);
    if (c.holdAt != null) assert.ok(c.holdAt > 0 && c.holdAt < c.duration, `${id}: holdAt`);
    for (const [bone, tr] of Object.entries(c.tracks)) {
      for (const kind of ['rot', 'pos']) {
        const k = tr[kind];
        if (!k) continue;
        assert.deepEqual(k[0][1], k[k.length - 1][1], `${id}.${bone}.${kind} returns to its start`);
        if (kind === 'rot' && ['armN', 'foreN', 'armF', 'foreF'].includes(bone)) {
          assert.ok(Math.abs(k[0][1] - (idle0[bone]?.rot ?? 0)) < 3, `${id}.${bone} starts near the idle pose`);
        }
      }
    }
  }
});

test('talk variants loop, are registered on the rig and used by dialogue', () => {
  assert.deepEqual(TALK_CLIPS, rig.talkClips);
  for (const id of ['talk_d', 'talk_e', 'talk_excited', 'talk_calm']) assert.ok(rig.talkClips.includes(id), id);
  for (const id of rig.talkClips) assert.ok(rig.clips[id]?.loop && rig.clips[id].overlay, id);
  const f = ok(H + `scene s bg=studio {
  cast a: mira at 30
${Array.from({ length: 24 }, (_, i) => `  a: "Line number ${i} is here" for=1s`).join('\n')}
}`);
  const used = new Set();
  for (let i = 0; i < 24; i++) used.add(actorState(f.scenes[0], 'a', i * 1.15 + 0.5).layers.at(-1).clip);
  assert.ok(used.size >= 4, `only ${[...used]} used`);
});

test('style= picks the movement clip and its natural pace', () => {
  const f = ok(H + `scene s bg=studio {
  cast a: bo at 10
  a walks to 60 style=sneak
  a walks to 20 style=march over 2s
  a runs to 80 style=sprint
}`);
  const mv = f.scenes[0].events.filter((e) => e.type === 'move');
  assert.deepEqual(mv.map((e) => e.clip), ['sneak', 'march', 'sprint']);
  const dist = 0.5 * 1920;
  assert.ok(Math.abs(mv[0].dur - dist / rig.clips.sneak.speed) < 1e-6, `sneak dur ${mv[0].dur}`);
  assert.equal(mv[1].dur, 2);
  assert.equal(actorState(f.scenes[0], 'a', mv[0].t + 1).layers.at(-1).clip, 'sneak');
});

test('style= errors suggest a real style', () => {
  assert.match(bad(H + 'scene s bg=studio {\n  cast a: bo at 10\n  a walks to 60 style=snek\n}'), /Unknown walk style "snek"\. Did you mean "sneak"\?/);
  assert.match(bad(H + 'scene s bg=studio {\n  cast a: bo at 10\n  a walks to 60 style=wave\n}'), /"wave" isn't a movement style/);
  assert.match(bad(H + 'scene s bg=studio {\n  cast a: bo at 10\n  a walks to 60 style=idle_bored\n}'), /isn't a movement style/);
});

test('natural pace scales with the legs and size of the character', () => {
  const f = ok(H + `scene s bg=studio {
  cast a: bo at 10
  cast k: juno at 10,0
  cast t: dex at 10,0
  a walks to 60 &
  k walks to 60 &
  t walks to 60
}`);
  const dur = Object.fromEntries(f.scenes[0].events.filter((e) => e.type === 'move').map((e) => [e.actor, e.dur]));
  assert.ok(dur.k > dur.a * 1.2, `kid should take longer (${dur.k} vs ${dur.a})`);
  assert.ok(dur.t < dur.a, `tall should be quicker (${dur.t} vs ${dur.a})`);
  // with the scaled pace the clip plays at rate 1, so feet stay planted
  for (const e of f.scenes[0].events.filter((x) => x.type === 'move')) assert.ok(Math.abs(e.rate - 1) < 1e-9, `${e.actor} rate ${e.rate}`);
  const legs = (id) => { const b = resolveBuild(rig, A.characters[id]); return (78 + (b.shinN?.dpos?.[1] || 0)) + (76 + (b.footN?.dpos?.[1] || 0)); };
  assert.ok(legs('juno') < legs('bo') && legs('dex') > legs('bo'));
});

test('new verb shortcuts map to gestures', () => {
  const { ast, errors } = parse(H + `scene s bg=studio {
  cast a: bo at 50
  a salutes
  a yawns for 3s
  a cries
  a beckons
  a stretches
  a cowers
}`);
  assert.deepEqual(errors, []);
  assert.deepEqual(ast.items[0].body.filter((n) => n.kind === 'play').map((n) => n.clip), ['salute', 'yawn', 'cry', 'beckon', 'stretch', 'cower']);
  const f = ok(H + 'scene s bg=studio {\n  cast a: bo at 50\n  a celebrates\n  a plays hands_on_hips for 3s\n}');
  const g = f.scenes[0].events.filter((e) => e.type === 'gesture');
  assert.deepEqual(g.map((e) => [e.clip, e.dur]), [['celebrate', rig.clips.celebrate.duration], ['hands_on_hips', 3]]);
});
