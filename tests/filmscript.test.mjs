import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAssetsFs } from './helpers.mjs';
import { compileSource } from '../src/filmscript/index.js';
import { parse } from '../src/filmscript/parse.js';
import { actorState, windowsAt, captionsAt, cameraAt, frameCount } from '../src/engine/timeline.js';
import { buildTalk, mouthAt, blipSchedule, estimateSpeechDuration } from '../src/engine/lipsync.js';
import { sampleKeys } from '../src/engine/rig.js';

const A = loadAssetsFs();
const H = 'film "T" 1920x1080 @30\n';
const ok = (src) => { const r = compileSource(src, A); assert.deepEqual(r.errors, [], JSON.stringify(r.errors)); return r.film; };
const bad = (src) => compileSource(src, A).errors;

test('time cursor: dialogue advances, & does not, wait adds', () => {
  const f = ok(H + `scene s bg=studio {
  cast a: mira at 30
  cast b: bo at 70
  a: "Hi" for=1s gap=0
  b: "Yo" for=2s gap=0 &
  wait 0.5s
  a: "Again" for=1s gap=0
}`);
  const ev = f.scenes[0].events.filter((e) => e.type === 'say');
  assert.deepEqual(ev.map((e) => [e.actor, +e.t.toFixed(3), e.dur]), [['a', 0, 1], ['b', 1, 2], ['a', 1.5, 1]]);
  assert.ok(Math.abs(f.scenes[0].duration - (3 + 0.5)) < 1e-9 || Math.abs(f.scenes[0].duration - 3.5) < 1e-9, `duration ${f.scenes[0].duration}`);
});

test('par runs everything at once; repeat loops', () => {
  const f = ok(H + `scene s bg=studio {
  cast a: mira at 20
  cast b: bo at 80
  par {
    a walks to 50 over 2s
    b walks to 50 over 3s
  }
  repeat 3 { wait 1s }
}`);
  const mv = f.scenes[0].events.filter((e) => e.type === 'move');
  assert.equal(mv.length, 2);
  assert.ok(mv.every((m) => m.t === 0));
  assert.ok(Math.abs(f.scenes[0].duration - (3 + 3 + 0.5)) < 1e-9);
});

test('transitions overlap scenes and total duration accounts for them', () => {
  const f = ok(H + `scene a bg=studio { cast x: mira at 50
 wait 4s }
transition fade 1s
scene b bg=studio { cast x: mira at 50
 wait 4s }`);
  const [a, b] = f.scenes;
  assert.equal(a.start, 0);
  assert.ok(Math.abs(b.start - (a.duration - 1)) < 1e-9);
  assert.ok(Math.abs(f.duration - (b.start + b.duration)) < 1e-9);
  const w = windowsAt(f, b.start + 0.5);
  assert.equal(w.length, 2);
  assert.ok(Math.abs(w[1].progress - 0.5) < 1e-9);
  assert.equal(windowsAt(f, 1).length, 1);
});

test('movement: position tweens, facing flips, walk clip + rate during move', () => {
  const f = ok(H + `scene s bg=studio {
  cast a: mira at 10
  a walks to 60 over 4s
}`);
  const sc = f.scenes[0];
  const s0 = actorState(sc, 'a', 0), s2 = actorState(sc, 'a', 2), s5 = actorState(sc, 'a', 5);
  assert.equal(Math.round(s0.x), Math.round(0.1 * 1920));
  assert.ok(s2.x > s0.x && s2.x < s5.x);
  assert.equal(Math.round(s5.x), Math.round(0.6 * 1920));
  assert.equal(s2.baseClip, 'walk');
  assert.equal(s5.baseClip, 'idle');
  assert.equal(s2.facing, 'right');
});

test('enters/exits manage visibility', () => {
  const f = ok(H + `scene s bg=studio {
  cast a: mira at 50
  a enters from left over 1s
  wait 1s
  a exits to right over 1s
}`);
  const sc = f.scenes[0];
  assert.equal(sc.cast.a.hidden, true);
  assert.equal(actorState(sc, 'a', 0.5).visible, true);
  assert.ok(actorState(sc, 'a', 0.1).x < 0);
  assert.equal(actorState(sc, 'a', 2.5).visible, true);
  assert.equal(actorState(sc, 'a', 3.1).visible, false);
});

test('speech drives mouth shapes and talk gesture; captions & camera evaluate', () => {
  const f = ok(H + `scene s bg=studio {
  cast a: mira at 50
  caption "hi" 1s &
  camera zoom=2 x=20 over 2s &
  a: "Hello there my friend" for=2s
}`);
  const sc = f.scenes[0];
  const shapes = new Set();
  for (let t = 0; t < 2; t += 0.02) shapes.add(actorState(sc, 'a', t).face.mouth);
  assert.ok(shapes.has('open_a') || shapes.has('open_o'), [...shapes].join());
  assert.equal(actorState(sc, 'a', 1).overlayClip, 'talk');
  assert.equal(captionsAt(sc, 0.5).length, 1);
  assert.equal(captionsAt(sc, 1.5).length, 0);
  assert.ok(cameraAt(sc, 1).zoom > 1 && cameraAt(sc, 1).zoom < 2);
  assert.equal(cameraAt(sc, 3).zoom, 2);
});

test('variables, mood props, voices', () => {
  const f = ok(H + `let who = bo
scene s bg=studio {
  cast a: $who at 50
  a: "x" mood=sad voice=voice_otto
}`);
  assert.equal(f.scenes[0].cast.a.char, 'bo');
  assert.equal(f.scenes[0].events.find((e) => e.type === 'say').voice, 'voice_otto');
  assert.equal(actorState(f.scenes[0], 'a', 0.1).face.brows, 'sad');
});

test('errors: line numbers, suggestions, lists of valid choices', () => {
  let e = bad(H + 'scene s bg=studo {\n}\n');
  assert.equal(e[0].line, 2);
  assert.match(e[0].message, /Did you mean "studio"/);
  e = bad(H + 'scene s bg=studio {\n cast a: mira at 50\n a wavs\n}');
  assert.equal(e[0].line, 4);
  assert.match(e[0].message, /Unknown action "wavs"/);
  e = bad(H + 'scene s bg=studio {\n cast a: mira at 50\n a plays wavee\n}');
  assert.match(e[0].message, /Did you mean "wave"/);
  e = bad(H + 'scene s bg=studio {\n cast a: mira at 50\n b: "hi"\n}');
  assert.match(e[0].message, /Unknown actor "b"/);
  e = bad(H + 'scene s bg=studio {\n cast a: mira at 50\n a: "hi" voice=nope\n}');
  assert.match(e[0].message, /Unknown voice/);
  e = bad(H + 'scene s bg=studio {\n cast a: mira at 50\n');
  assert.match(e[0].message, /Missing "}"/);
  e = bad(H + 'scene s bg=studio {\n cast a: mira at 50\n a: "oops\n}');
  assert.match(e[0].message, /Unterminated string/);
  e = bad('scene s bg=studio {\n}');
  assert.match(e[0].message, /Start your file with/);
  e = bad('film "x" 1000x1000 @30\nscene s bg=studio {\n}');
  assert.match(e[0].message, /16:9/);
  e = bad(H + 'scene s bg=studio {\n}\ntransition nope 1s\nscene t bg=studio {\n}');
  assert.match(e[0].message, /Unknown transition/);
  e = bad(H + 'scene s bg=studio {\n cast a: mira at 50\n camera zoom=0.5 over 1s\n}');
  assert.match(e[0].message, /zoom must be 1 or more/);
  assert.ok(bad(H + 'scene s bg=studio {\n cast a: mira at 50\n a: "hi" voice=$missing\n}')[0].message.match(/Unknown variable/));
});

test('several errors are reported at once', () => {
  const e = bad(H + 'scene s bg=studio {\n cast a: mira at 50\n a wavs\n a plays nope\n c: "x"\n}');
  assert.equal(e.length, 3);
});

test('frameCount uses fps', () => {
  const f = ok(H + 'scene s bg=studio {\n cast a: mira at 50\n wait 2s\n}');
  assert.equal(frameCount(f), Math.round(f.duration * 30));
});

test('lipsync: deterministic, covers duration, blips match syllables', () => {
  const talk = buildTalk('Hello, world! How are you?', 3);
  assert.equal(talk.segments.at(-1).t1.toFixed(6), '3.000000');
  assert.equal(mouthAt(talk, 3.5), null);
  const blips = blipSchedule(talk, { pitch: 300, variation: 0.2 });
  assert.ok(blips.length >= 6);
  assert.ok(blips.every((b) => b.freq > 150 && b.freq < 700 && b.dur > 0));
  assert.deepEqual(blipSchedule(buildTalk('Hello, world! How are you?', 3), { pitch: 300, variation: 0.2 }), blips);
  assert.ok(estimateSpeechDuration('one two three four five six') > estimateSpeechDuration('one two'));
});

test('keyframe sampling: smooth loops are continuous at the seam', () => {
  const keys = [[0, 10], [0.5, -10], [1, 10]];
  const a = sampleKeys(keys, 0.001, 'smooth', true), b = sampleKeys(keys, 0.999, 'smooth', true);
  assert.ok(Math.abs(a - b) < 0.5, `${a} vs ${b}`);
  assert.equal(sampleKeys(keys, 0.5, 'smooth', true), -10);
  assert.deepEqual(sampleKeys([[0, [0, 0]], [1, [10, 20]]], 0.5, 'linear'), [5, 10]);
});

test('parser alone reports line numbers for stray braces', () => {
  const { errors } = parse(H + '}\n');
  assert.equal(errors[0].line, 2);
});
