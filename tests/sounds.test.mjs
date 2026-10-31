import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, readJSON, readText, loadAssetsFs } from './helpers.mjs';
import { compileSource } from '../src/filmscript/index.js';
import { parse } from '../src/filmscript/parse.js';
import { soundsById } from '../src/assets/loader.js';
import { planSounds, gainCurve, collectCues } from '../src/engine/audio.js';

const manifest = readJSON('src/assets/manifest.json');
const lib = readJSON('src/assets/sounds/sounds.json');
const A = { ...loadAssetsFs(), sounds: soundsById(lib) };
const film = (body) => `film "T" 1920x1080 @30\n${body}\n`;
const compileOk = (src) => {
  const r = compileSource(film(src), A);
  assert.deepEqual(r.errors, [], JSON.stringify(r.errors));
  return r.film;
};
const compileErr = (src) => {
  const r = compileSource(film(src), A);
  assert.ok(r.errors.length, 'expected an error');
  return r.errors.map((e) => e.message).join('\n');
};

// ---- library ------------------------------------------------------------------------------
test('sound library manifest is listed and well formed', () => {
  assert.equal(manifest.sounds, 'src/assets/sounds/sounds.json');
  const ids = new Set();
  for (const s of lib.sounds) {
    assert.match(s.id, /^[a-z][a-z0-9_]*$/, `${s.id}: ids must be FilmScript identifiers`);
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.ok(['sfx', 'music', 'ambience'].includes(s.kind), s.id);
    assert.equal(typeof s.name, 'string');
    assert.ok(Array.isArray(s.tags) && s.tags.length, `${s.id} needs tags`);
    assert.equal(s.loop, s.kind !== 'sfx', `${s.id} loop flag`);
    assert.equal(s.file, `src/assets/sounds/${s.kind}/${s.id}.mp3`);
    assert.ok(existsSync(join(ROOT, s.file)), `missing ${s.file}`);
    assert.ok(s.duration > 0.05, s.id);
    if (s.kind === 'music') assert.ok(s.duration >= 15 && s.duration <= 40, `${s.id} music loops are 15-40 s (${s.duration})`);
    if (s.kind === 'ambience') assert.ok(s.duration >= 15, `${s.id} ambience loops are >= 15 s`);
    if (s.kind === 'sfx') assert.ok(s.duration <= 10, `${s.id} sfx are short`);
  }
});

test('sound library has enough of each kind and stays small', () => {
  const count = (k) => lib.sounds.filter((s) => s.kind === k).length;
  assert.ok(count('sfx') >= 40, `sfx: ${count('sfx')}`);
  assert.ok(count('music') >= 10, `music: ${count('music')}`);
  assert.ok(count('ambience') >= 8, `ambience: ${count('ambience')}`);
  const bytes = lib.sounds.reduce((n, s) => n + statSync(join(ROOT, s.file)).size, 0);
  assert.ok(bytes < 15 * 1024 * 1024, `library is ${(bytes / 1048576).toFixed(1)} MB`);
  for (const id of ['door_knock', 'door_creak', 'footsteps_wood', 'applause', 'thunder', 'rimshot', 'sad_trombone', 'spooky_stinger', 'spooky_mystery', 'haunted_chase', 'rain', 'haunted_house']) {
    assert.ok(A.sounds[id], `expected ${id}`);
  }
});

test('mp3 durations match the manifest (needs ffprobe; skipped otherwise)', (t) => {
  if (spawnSync('ffprobe', ['-version']).status !== 0) { t.skip('ffprobe not installed'); return; }
  for (const s of lib.sounds.filter((x) => x.kind !== 'sfx' || x.id === 'door_knock')) {
    const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=duration,sample_rate', '-of', 'json', join(ROOT, s.file)], { encoding: 'utf8' });
    const st = JSON.parse(r.stdout).streams[0];
    // ffprobe reports the padded MP3 length; the LAME header lets browsers trim it to the exact sample count
    assert.ok(Math.abs(+st.duration - s.duration) < 0.08, `${s.id}: ${st.duration} vs ${s.duration}`);
  }
});

// ---- language -----------------------------------------------------------------------------
test('parse sound statements', () => {
  const { ast, errors } = parse(film(`scene a bg=studio {
  sfx door_knock vol=0.8
  sfx "audio/x.wav"
  music spooky_mystery vol=0.4 fade=1s
  music stop fade=2s
  music off
  ambience rain vol=0.5
  ambience rain off fade=500ms
  ambience off
}`));
  assert.deepEqual(errors, []);
  const b = ast.items[0].body;
  assert.deepEqual(b.map((n) => [n.kind, n.sound, n.src, n.stop]), [
    ['sfx', 'door_knock', null, false], ['sfx', null, 'audio/x.wav', false], ['music', 'spooky_mystery', null, false],
    ['music', null, null, true], ['music', null, null, true], ['ambience', 'rain', null, false], ['ambience', 'rain', null, true], ['ambience', null, null, true],
  ]);
  assert.deepEqual(b[2].props, { vol: 0.4, fade: 1 });
  assert.deepEqual(b[6].props, { fade: 0.5 });
  assert.match(parse(film('scene a bg=studio {\n  sfx stop\n}')).errors[0].message, /play once/);
  assert.match(parse(film('scene a bg=studio {\n  music\n}')).errors[0].message, /music id/);
});

test('compile library ids to sound events', () => {
  const f = compileOk(`scene a bg=studio {
  music spooky_mystery vol=0.4 fade=1s
  wait 1s
  sfx door_knock vol=0.8 pan=-0.5
  ambience rain
  sfx "audio/own.wav" rate=1.5
  wait 1s
  ambience rain off
}`);
  const ev = f.scenes[0].events;
  const m = ev.find((e) => e.type === 'music');
  assert.equal(m.src, 'src/assets/sounds/music/spooky_mystery.mp3');
  assert.equal(m.sound, 'spooky_mystery');
  assert.equal(m.vol, 0.4);
  assert.equal(m.fade, 1);
  const s = ev.filter((e) => e.type === 'sfx');
  assert.deepEqual([s[0].t, s[0].src, s[0].vol, s[0].pan], [1, 'src/assets/sounds/sfx/door_knock.mp3', 0.8, -0.5]);
  assert.deepEqual([s[1].src, s[1].sound, s[1].rate, s[1].vol], ['audio/own.wav', null, 1.5, 1]);
  const amb = ev.filter((e) => e.type === 'ambience');
  assert.equal(amb[0].vol, 0.8, 'ambience default volume');
  assert.deepEqual([amb[1].stop, amb[1].src, amb[1].t], [true, 'src/assets/sounds/ambience/rain.mp3', 2]);
  assert.ok(f.uses.sounds.includes('door_knock') && f.uses.audio.includes('audio/own.wav'));
  // sounds don't take time: the scene is 2 s of waits + the default tail
  assert.equal(f.scenes[0].duration, 2.5);
});

test('helpful errors for sound statements', () => {
  let m = compileErr('scene a bg=studio {\n  sfx door_knok\n}');
  assert.match(m, /Unknown sound effect "door_knok"\. Did you mean "door_knock"\?/);
  assert.match(m, /Sound effects: .*door_creak/);
  m = compileErr('scene a bg=studio {\n  music spooky\n}');
  assert.match(m, /Unknown music "spooky"/);
  assert.match(m, /Music: .*spooky_mystery/);
  assert.match(compileErr('scene a bg=studio {\n  ambience rian\n}'), /Did you mean "rain"/);
  assert.match(compileErr('scene a bg=studio {\n  sfx pop volume=2\n}'), /"volume" isn't an option here\. Did you mean "vol"\?/);
  assert.match(compileErr('scene a bg=studio {\n  sfx pop vol=80\n}'), /vol must be a number from 0 to 4/);
  assert.match(compileErr('scene a bg=studio {\n  music stop vol=1\n}'), /Options: fade/);
  // without a loaded library, ids fail clearly but quoted files still work
  const r = compileSource(film('scene a bg=studio {\n  sfx pop\n}'), { ...A, sounds: undefined });
  assert.match(r.errors[0].message, /library isn't loaded/);
  assert.deepEqual(compileSource(film('scene a bg=studio {\n  sfx "a.wav"\n}'), { ...A, sounds: undefined }).errors, []);
});

test('ids from another kind are accepted (e.g. an ambience as music)', () => {
  const f = compileOk('scene a bg=studio {\n  music rain\n  hold 1s\n}');
  assert.equal(f.scenes[0].events[0].src, 'src/assets/sounds/ambience/rain.mp3');
});

// ---- planning (shared by preview and export) ------------------------------------------------
const plan = (src) => planSounds(compileOk(src));

test('music continues across scenes until stopped, and fades at the film end', () => {
  const f = compileOk(`scene a bg=studio {
  music happy_day
  wait 3s
}
scene b bg=studio {
  wait 3s
}`);
  const p = planSounds(f).filter((x) => x.kind === 'music');
  assert.equal(p.length, 1);
  assert.deepEqual([p[0].t0, p[0].t1, p[0].loop, p[0].fadeIn], [0, f.duration, true, 0]);
  assert.equal(p[0].fadeOut, 0.75);
});

test('new music crossfades; music stop fades out; repeating the track only changes volume', () => {
  const p = plan(`scene a bg=studio {
  music happy_day vol=0.5
  wait 2s
  music happy_day vol=0.2 fade=1s
  wait 2s
  music sad_rain fade=2s
  wait 4s
  music stop
  wait 3s
}`).filter((x) => x.kind === 'music');
  assert.equal(p.length, 2);
  const [a, b] = p;
  assert.deepEqual([a.t0, a.t1, a.fadeOut], [0, 6, 2]);
  assert.deepEqual(a.ramps, [{ t: 2, vol: 0.2, dur: 1 }]);
  assert.deepEqual([b.t0, b.fadeIn, b.t1, b.fadeOut], [4, 2, 9, 1]);
  const g = gainCurve(a);
  assert.deepEqual(g, [[0, 0.5, 'set'], [2, 0.5, 'set'], [3, 0.2, 'ramp'], [4, 0.2, 'set'], [6, 0, 'ramp']]);
  for (let i = 1; i < g.length; i++) assert.ok(g[i][0] >= g[i - 1][0]);
});

test('ambience stacks, ends with its scene, and carries over when the next scene restarts it', () => {
  const f = compileOk(`scene a bg=studio {
  ambience rain
  ambience wind vol=0.3
  wait 2s
  ambience wind off
  wait 2s
}
transition fade 1s
scene b bg=studio {
  ambience rain
  ambience fireplace
  wait 3s
}
scene c bg=studio {
  wait 2s
}`);
  const [a, b, c] = f.scenes;
  const p = planSounds(f).filter((x) => x.kind === 'ambience');
  const rain = p.filter((x) => x.src.endsWith('rain.mp3'));
  assert.equal(rain.length, 1, 'rain keeps playing into scene b');
  assert.deepEqual([rain[0].t0, rain[0].t1], [0, b.start + b.duration]);
  const wind = p.find((x) => x.src.endsWith('wind.mp3'));
  assert.deepEqual([wind.t0, wind.t1, wind.fadeOut, wind.vol], [0, 3, 1, 0.3]);
  const fire = p.find((x) => x.src.endsWith('fireplace.mp3'));
  assert.deepEqual([fire.t0, fire.t1], [b.start, b.start + b.duration]);
  assert.ok(c.start >= fire.t1 - 1e-9);
  // ambience ending before a transition fades over it
  const f2 = compileOk(`scene a bg=studio {\n  ambience rain\n  wait 3s\n}\ntransition fade 1.5s\nscene b bg=studio {\n  wait 3s\n}`);
  const r2 = planSounds(f2).find((x) => x.kind === 'ambience');
  assert.equal(r2.fadeOut, 1.5);
  assert.equal(r2.t1, f2.scenes[0].duration);
});

test('ambience off with no id stops all; sfx plan has rate/pan; quoted music loops', () => {
  const p = plan(`scene a bg=studio {
  music "audio/theme.mp3" vol=0.3
  ambience rain
  ambience city_traffic
  wait 1s
  ambience off fade=0.5s
  sfx pop rate=2 pan=0.5
  wait 2s
}`);
  const amb = p.filter((x) => x.kind === 'ambience');
  assert.equal(amb.length, 2);
  for (const a of amb) assert.deepEqual([a.t1, a.fadeOut], [1.5, 0.5]);
  const s = p.find((x) => x.kind === 'sfx');
  assert.deepEqual([s.t0, s.t1, s.loop, s.rate, s.pan], [1, null, false, 2, 0.5]);
  const m = p.find((x) => x.kind === 'music');
  assert.deepEqual([m.src, m.loop, m.vol], ['audio/theme.mp3', true, 0.3]);
});

test('fades never exceed the playback length', () => {
  const p = plan('scene a bg=studio {\n  ambience rain fade=5s\n  wait 1s\n  ambience rain off fade=5s\n  wait 1s\n}');
  const a = p[0];
  assert.ok(a.fadeIn + a.fadeOut <= a.t1 - a.t0 + 1e-9);
});

test('docs/FILMSCRIPT.md lists every sound id', () => {
  const doc = readText('docs/FILMSCRIPT.md');
  const section = doc.slice(doc.indexOf('## Sound library'), doc.indexOf('## Voices'));
  const words = new Set(section.match(/[a-z0-9_]+/g));
  for (const s of lib.sounds) assert.ok(words.has(s.id), `${s.id} missing from the Sound library section`);
});

test('spoken lines are still collected for the mix', () => {
  const f = compileOk('scene a bg=studio {\n  cast m: mira at 50\n  wait 1s\n  m: "Hi."\n}');
  const cues = collectCues(f);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].t, 1);
});
