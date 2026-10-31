// Pure logic behind the editor shell: script rewriting, templates, projects, timeline tracks, hit-testing, markdown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAssetsFs, readText } from './helpers.mjs';
import { compileSource } from '../src/filmscript/index.js';
import {
  codePart, scanBlocks, sceneAtLine, topLevelLine, insertAtSceneEnd, insertAfterCasts, insertAfterLine, insertAfterHeader, appendScene,
  setProp, setCastAt, lineKind, filmTitle, setFilmTitle, q, freeX, uniqueName, kokoroFor, switchToKokoro, formatTime,
} from '../src/editor/script-ops.js';
import { TEMPLATES } from '../src/editor/templates.js';
import { createProjectStore, memoryStorage } from '../src/editor/projects.js';
import { buildTracks, timeOfLine, lineAtTime, sceneIndexAt } from '../src/editor/timeline-data.js';
import { actorBoxes, hitActor, actorTouchedBefore } from '../src/editor/stage-hit.js';
import { renderMarkdown, sections, highlightFly } from '../src/editor/markdown.js';

const A = loadAssetsFs();
const ok = (src) => { const r = compileSource(src, A); assert.deepEqual(r.errors, [], JSON.stringify(r.errors) + '\n' + src); return r; };
const SRC = `film "T" 1920x1080 @30
voice nar = browser_deep
scene a bg=studio {   # first
  cast mira: mira at 30
  cast bo: bo at 70
  mira: "Hi { there }"   # braces in strings are ignored
  par {
    mira walks to 40
    bo walks to 60
  }
  bo: "Yo" voice=nar
}

transition fade 1s

scene b bg=street_day {
  cast kai: kai at 50 color=#ff0000
  kai waves
}
`;

test('codePart keeps strings and hex colours, drops comments', () => {
  assert.equal(codePart('mira: "a # b" # note'), 'mira: "a # b" ');
  assert.equal(codePart('character x from y color.top=#ff8800 # c'), 'character x from y color.top=#ff8800 ');
  assert.equal(codePart('wait 1s // later'), 'wait 1s ');
});

test('scanBlocks finds scenes, nesting and ends', () => {
  const s = scanBlocks(SRC);
  assert.deepEqual(s.scenes.map((x) => [x.id, x.line, x.end, x.props.bg]), [['a', 3, 12], ['b', 16, 19]].map(([a, b, c], i) => [a, b, c, i ? 'street_day' : 'studio']));
  assert.equal(sceneAtLine(s, 8).id, 'a');
  assert.equal(sceneAtLine(s, 13), null);
  assert.equal(topLevelLine(s, 8), 10);
  assert.equal(topLevelLine(s, 6), 6);
});

test('insert helpers put lines where a person would', () => {
  let r = insertAtSceneEnd(SRC, 0, 'mira nods');
  assert.equal(r.src.split('\n')[r.line - 1], '  mira nods');
  assert.equal(r.src.split('\n')[r.line], '}');
  r = insertAfterCasts(SRC, 0, 'cast kai: kai at 50');
  assert.equal(r.line, 6);
  r = insertAfterLine(SRC, 7, 'mira nods');
  assert.equal(r.src.split('\n')[7], '    mira nods');
  r = insertAfterHeader(SRC, 'voice x = kokoro:af_heart');
  assert.equal(r.src.split('\n')[2], 'voice x = kokoro:af_heart');
  ok(insertAtSceneEnd(SRC, 1, 'kai: "new"').src);
  const ap = appendScene('film "T" 1920x1080\nscene a bg=studio {\n  cast m: mira at 50\n}\n\nfade out 1s\n', { id: 'two', bg: 'studio', body: 'cast k: kai at 40', transition: 'fade 1s' });
  assert.match(ap.src, /transition fade 1s\n\nscene two bg=studio \{\n {2}cast k: kai at 40\n\}\n\nfade out 1s\n$/);
  ok(ap.src);
});

test('setProp / setCastAt edit a single line safely', () => {
  assert.equal(setProp('  a: "hi" &', 'voice', 'kokoro:af_heart'), '  a: "hi" voice=kokoro:af_heart &');
  assert.equal(setProp('  a: "hi" voice=x # c', 'voice', 'y'), '  a: "hi" voice=y # c');
  assert.equal(setProp('  a: "hi" mood=sad', 'mood', null), '  a: "hi"');
  assert.equal(setProp('scene s bg=studio {', 'bg', 'street_day'), 'scene s bg=street_day {');
  assert.equal(setProp('a: "x"', 'style', 'with space'), 'a: "x" style="with space"');
  assert.equal(setCastAt('  cast mira: mira at 30 hidden', 62.345), '  cast mira: mira at 62.3 hidden');
  assert.equal(setCastAt('  cast mira: mira at 30,10', 40, 10), '  cast mira: mira at 40,10');
  assert.equal(setCastAt('  cast mira: mira # c', 40), '  cast mira: mira at 40# c');
});

test('lineKind classifies statements', () => {
  assert.deepEqual(lineKind('  mira: "Hello \\"you\\""'), { kind: 'say', actor: 'mira', text: 'Hello "you"' });
  assert.equal(lineKind('  cast bo: bo at 3').kind, 'cast');
  assert.equal(lineKind('scene a bg=studio {').kind, 'scene');
  assert.equal(lineKind('  bo walks to 30').verb, 'walks');
  assert.equal(lineKind('# hi').kind, 'comment');
  assert.equal(filmTitle(SRC), 'T');
  assert.equal(filmTitle(setFilmTitle(SRC, 'A "big" one')), 'A "big" one');
  assert.equal(q('a"b'), '"a\\"b"');
});

test('small helpers', () => {
  assert.equal(freeX([]), 50);
  assert.ok(Math.abs(freeX([30, 70]) - 50) > 15 || freeX([30, 70]) === 50);
  assert.equal(uniqueName('Mira', ['mira']), 'mira2');
  assert.equal(formatTime(75.5), '1:15.50');
});

test('every template compiles', () => {
  for (const t of TEMPLATES) {
    const f = ok(t.build({ title: `Test ${t.name}` })).film;
    assert.ok(f.duration > 2, t.id);
  }
});

test('switchToKokoro rewrites browser voices (named, inline, inherited) and compiles', () => {
  const src = 'film "K" 1920x1080\nvoice host = browser_bright\ncharacter rosie from priya voice=browser_kid\nscene a bg=studio {\n  cast m: mira at 30\n  cast r: rosie at 60\n  cast k: kai at 80\n  m: "one" voice=host\n  r: "two"\n  k: "three" voice=webspeech:auto &\n  m: "four"\n  k: "five" voice=kokoro:am_echo\n}\n';
  const r0 = ok(src);
  const { src: out, changes } = switchToKokoro(src, A, r0.lines);
  const r1 = ok(out);
  assert.ok(changes.length >= 4);
  assert.match(out, /voice host = kokoro:af_bella speed=1.05/);
  assert.match(out, /character rosie from priya voice=kokoro:af_sky/);
  assert.match(out, /k: "three" voice=kokoro:af_heart &/);
  assert.match(out, /m: "four" voice=kokoro:/);
  assert.match(out, /k: "five" voice=kokoro:am_echo/);
  assert.equal(r1.lines.filter((l) => l.voice.engine === 'webspeech').length, 0);
  assert.equal(switchToKokoro(out, A, r1.lines).changes.length, 0);
  assert.equal(kokoroFor({ gender: 'male', lang: 'en-GB' }), 'bm_george');
});

test('the demo film switches to Kokoro cleanly', () => {
  const demo = readText('films/hello-filmly.fly');
  const r = switchToKokoro(demo, A, ok(demo).lines);
  assert.equal(ok(r.src).lines.filter((l) => l.voice.engine === 'webspeech').length, 0);
});

test('project store: create, save, rename, duplicate, remove, migrate', () => {
  let t = 1000;
  const st = createProjectStore(memoryStorage(), () => (t += 10));
  const a = st.create('One', 'film "One" 1920x1080');
  const b = st.create('Two', 'x');
  assert.equal(st.current(), b.id);
  assert.deepEqual(st.list().map((p) => p.name), ['Two', 'One']);
  st.save(a.id, 'changed', 'One v2');
  assert.equal(st.get(a.id).text, 'changed');
  assert.equal(st.list()[0].name, 'One v2');
  st.rename(a.id, 'Mine');
  st.save(a.id, 'again', 'Auto name');
  assert.equal(st.get(a.id).name, 'Mine');
  const c = st.duplicate(a.id);
  assert.equal(st.get(c.id).text, 'again');
  assert.equal(st.get(c.id).name, 'Mine (copy)');
  st.remove(c.id);
  assert.equal(st.get(c.id), null);
  assert.equal(st.current(), null);
  const mem = memoryStorage();
  mem.setItem('filmly.script.v1', 'film "Old" 1920x1080');
  const st2 = createProjectStore(mem);
  const m = st2.migrateLegacy(() => 'Old');
  assert.equal(st2.get(m.id).text, 'film "Old" 1920x1080');
  assert.equal(st2.migrateLegacy(), null);
});

test('timeline tracks carry script lines and timing', () => {
  const f = ok(SRC).film;
  const tr = buildTracks(f);
  assert.deepEqual(tr.tracks.map((t) => t.id), ['scenes', 'actor:mira', 'actor:bo', 'actor:kai']);
  const say = tr.tracks[1].lanes[0][0];
  assert.equal(say.type, 'say');
  assert.equal(say.line, 6);
  assert.equal(say.label, 'Hi { there }');
  const walks = tr.tracks[1].lanes[1].filter((b) => b.type === 'move');
  assert.equal(walks[0].line, 8);
  assert.ok(walks[0].t1 > walks[0].t0);
  assert.equal(tr.scenes[1].transition.type, 'fade');
  assert.ok(tr.tracks[0].lanes[0].some((b) => b.type === 'transition' && b.line === 14));
  assert.equal(timeOfLine(f, 6), 0);
  assert.ok(timeOfLine(f, 11) > 0);
  assert.equal(timeOfLine(f, 10), null);
  assert.equal(timeOfLine(f, 16), f.scenes[1].start);
  assert.equal(lineAtTime(f, 0, timeOfLine(f, 11) + 0.01), 11);
  assert.equal(sceneIndexAt(f, f.duration - 0.1), 1);
});

test('actor boxes follow cast positions and the camera', () => {
  const f = ok('film "H" 1920x1080\nscene a bg=studio {\n  cast m: mira at 25\n  cast b: bo at 75\n  m: "hi"\n  camera zoom=2 x=25 y=50 over 1s\n  wait 1s\n}\n').film;
  const info = actorBoxes(f, A, 0.1);
  assert.equal(info.boxes.length, 2);
  const m = info.boxes.find((b) => b.name === 'm');
  assert.ok(Math.abs(m.footX - 480) < 1);
  assert.equal(hitActor(info, m.footX, m.footY - 100).name, 'm');
  assert.equal(hitActor(info, 960, 100), null);
  const zoomed = actorBoxes(f, A, 2);
  const mz = zoomed.boxes.find((b) => b.name === 'm');
  assert.ok(mz.h > m.h * 1.8, 'zoom scales boxes');
  assert.ok(Math.abs(mz.xPct - 25) < 0.01);
  assert.equal(actorTouchedBefore(f.scenes[0], 'm', 1), false);
});

test('quick-action lines compile', async () => {
  const { sayLine, walkLine, captionLine, cameraLine, clipStatement } = await import('../src/editor/actions.js');
  const rig = Object.values(A.rigs)[0];
  const body = [
    sayLine('m', { text: 'He said "hi"', voice: 'kokoro:af_bella', mood: 'happy', together: true }),
    sayLine('m', { text: 'Plain' }),
    walkLine('m', { mode: 'runs', x: 70.4, over: 1.5 }),
    walkLine('m', { mode: 'walks', target: 'b', together: true }),
    captionLine('caption', { text: 'Later…', dur: 2, pos: 'top', together: true }),
    captionLine('title', { text: 'Big', dur: 2.5 }),
    cameraLine({ zoom: 1.4, x: 30, y: 55, over: 1.2, ease: 'back', together: true }),
    cameraLine({ zoom: 1, x: 50, y: 50, over: 0.8, ease: 'inout' }),
    ...Object.keys(rig.clips).filter((c) => rig.clips[c].overlay).map((c) => clipStatement('m', c)),
  ];
  ok(`film "Q" 1920x1080\nscene s bg=studio {\n  cast m: mira at 30\n  cast b: bo at 70\n${body.map((l) => '  ' + l).join('\n')}\n}\n`);
});

test('markdown renders the language guide', () => {
  const md = readText('docs/FILMSCRIPT.md');
  const html = renderMarkdown(md);
  assert.match(html, /<h1 id="h-filmscript-reference-fly">/);
  assert.match(html, /<table>/);
  assert.match(html, /<pre class="code">/);
  assert.ok(sections(md).length >= 4);
  assert.match(highlightFly('scene a bg=studio { # hi'), /<span class="k">scene<\/span>.*<span class="p">bg<\/span>.*<span class="c"># hi<\/span>/);
  assert.equal(renderMarkdown('a **b** `<c>` [d](http://e)'), '<p>a <b>b</b> <code>&lt;c&gt;</code> <a href="http://e" target="_blank" rel="noopener">d</a></p>');
});
