// Pure (DOM-free) parts of the FilmScript code editor: tokenizer, completion, hover, edit operations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeLine, renderLine, inStringOrComment } from '../src/editor/code/highlight.js';
import { complete, buildVocab, scanDocument, expandInsert, hoverInfo, rank, CURSOR } from '../src/editor/code/complete.js';
import {
  toggleComment, indentLines, outdentLines, duplicateLines, moveLines, newline, closeBrace, matchBracket, headerEnd, findAll, diff,
} from '../src/editor/code/ops.js';
import { loadAssetsFs, readText } from './helpers.mjs';

const types = (line) => tokenizeLine(line).map((t) => `${t.t}:${line.slice(t.s, t.e)}`);
const apply = (text, op) => text.slice(0, op.from) + op.insert + text.slice(op.to);

test('tokenizer: keywords, actors, verbs, dialogue, props, voices, colors, units', () => {
  assert.deepEqual(types('  mira walks to 50 over 2s &'), ['actor:mira', 'verb:walks', 'kw2:to', 'number:50', 'kw2:over', 'number:2', 'unit:s', 'op:&']);
  assert.deepEqual(types('bo: "Hi # not a comment" voice=openai:coral # real'), ['actor:bo', 'punct::', 'string:"Hi # not a comment"', 'key:voice', 'op:=', 'voice:openai:coral', 'comment:# real']);
  assert.deepEqual(types('cast mira: mira at 25%'), ['keyword:cast', 'decl:mira', 'punct::', 'ref:mira', 'kw2:at', 'number:25', 'unit:%']);
  assert.deepEqual(types('character pia from priya color.top=#ff8800 build=round'),
    ['keyword:character', 'decl:pia', 'kw2:from', 'ref:priya', 'key:color.top', 'op:=', 'color:#ff8800', 'key:build', 'op:=', 'value:round']);
  assert.deepEqual(types('wait 500ms // later'), ['keyword:wait', 'number:500', 'unit:ms', 'comment:// later']);
  assert.deepEqual(types('$hero waves'), ['var:$hero', 'verb:waves']);
  assert.deepEqual(types('film "T" 1920x1080 @30'), ['keyword:film', 'string:"T"', 'number:1920x1080', 'op:@', 'number:30']);
  assert.deepEqual(types('voice host = browser_bright'), ['keyword:voice', 'decl:host', 'op:=', 'voice:browser_bright']);
  assert.equal(tokenizeLine('mira: "unterminated')[2].t, 'string bad');
  assert.equal(tokenizeLine('# just a comment')[0].t, 'comment');
});

test('renderLine escapes HTML, preserves text and adds swatches/decorations without changing text', () => {
  const src = 'mira: "<b>&" color.top=#abc x';
  const html = renderLine(src);
  assert.ok(html.includes('&lt;b&gt;&amp;'));
  assert.ok(html.includes('tk-swatch') && html.includes('--sw:#abc'));
  const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  assert.equal(strip(html), src);
  const deco = renderLine(src, tokenizeLine(src), [{ s: 0, e: 4, cls: 'fce-match' }]);
  assert.ok(/class="tk-actor fce-match"/.test(deco));
  assert.equal(strip(deco), src);
});

test('inStringOrComment', () => {
  const l = 'mira: "hi there" # c';
  assert.equal(inStringOrComment(l, 3), null);
  assert.equal(inStringOrComment(l, 9), 'string');
  assert.equal(inStringOrComment(l, 16), null);
  assert.equal(inStringOrComment(l, 19), 'comment');
});

const A = loadAssetsFs();
const V = buildVocab({ ...A, sounds: { knock: { kind: 'sfx', name: 'Knock' }, theme: { kind: 'music' }, birds: { kind: 'ambience' } }, props: { mug: { name: 'Mug' } } },
  { effects: ['rain', 'snow'], transitions: ['iris', 'fade'] });
const DOC = [
  'film "T" 1920x1080 @30',
  'voice nar = openai:onyx',
  'let hero = mira',
  'character pia from priya',
  'scene a bg=studio {',
  '  cast mira: mira at 20',
  '  prop cup: mug at 40',
  '  ',
  '}',
];
const at = (line, opts) => {
  const lines = [...DOC];
  lines[7] = line;
  const r = complete(lines, 7, line.length, V, opts);
  return r ? r.items.map((i) => i.label) : null;
};

test('completion: context-aware suggestions', () => {
  assert.ok(at('  cast bo: ').includes('bo') && at('  cast bo: ').includes('pia'));
  assert.ok(at('  scene x bg=').includes('studio'));
  const voices = at('  mira: "x" voice=');
  assert.ok(voices.includes('nar') && voices.includes('kokoro:') && voices.some((v) => v.startsWith('browser_')));
  assert.ok(at('  mira ').includes('walks') && at('  mira ').includes('says'));
  assert.equal(at('  mira wa')[0], 'walks');
  assert.ok(at('  mira plays ').includes('wave'));
  assert.ok(at('  mira feels ').includes('happy'));
  assert.deepEqual(at('  transition '), ['iris', 'fade', 'dip_black', 'dip_white', 'wipe_left', 'wipe_right', 'wipe_up', 'wipe_down', 'push_left', 'push_right', 'zoom', 'blinds', 'cut']);
  assert.ok(at('  effect ').includes('rain'));
  assert.deepEqual(at('  sfx '), ['knock']);
  assert.deepEqual(at('  music '), ['theme', 'stop']);
  assert.deepEqual(at('  ambience '), ['birds', 'stop']);
  assert.deepEqual(at('  mira holds '), ['cup']);
  assert.ok(at('  mira looks at ').includes('mira'));
  assert.ok(at('  mira walks to ').includes('cup'));
  assert.deepEqual(at('  $he'), ['$hero']);
  assert.ok(at('  hair=').length > 2);
  const start = at('  ');
  assert.ok(start.includes('mira') && start.includes('par') && start.includes('caption') && !start.includes('film'));
  assert.equal(at('  mira: "hello'), null, 'no completion inside strings');
  assert.equal(at('  # mira '), null, 'no completion inside comments');
  assert.equal(at('  mira walks'), null, 'exact single match closes the popup');
});

test('completion: top level vs scene keywords and snippets', () => {
  const lines = ['film "T" 1920x1080 @30', ''];
  const r = complete(lines, 1, 0, V, { explicit: true }).items.map((i) => i.label);
  assert.ok(r.includes('scene') && r.includes('character') && !r.includes('wait'));
  const sc = complete(['scene a {', '  par', '}'], 1, 5, V).items.find((i) => i.kind === 'snippet');
  assert.equal(sc.label, 'par');
  const ex = expandInsert(sc, '  ');
  assert.equal(ex.text, 'par {\n    \n  }');
  assert.equal(ex.selStart, 'par {\n    '.length);
  const s2 = expandInsert({ insert: `scene ${CURSOR}name${CURSOR} {` });
  assert.deepEqual([s2.text, s2.selStart, s2.selEnd], ['scene name {', 6, 10]);
});

test('vocab tolerates missing assets', () => {
  const v = buildVocab(null, null);
  assert.ok(v.moods.length && v.transitions.length && v.clips.length);
  assert.deepEqual(v.sounds, []);
  assert.ok(complete(['scene a {', '  x feels ', '}'], 1, 10, v));
});

test('scanDocument + rank + hover', () => {
  const d = scanDocument(DOC, 7);
  assert.deepEqual(d.actors.map((a) => a.id), ['mira']);
  assert.deepEqual(d.props.map((a) => a.id), ['cup']);
  assert.deepEqual(d.vars.map((a) => a.id), ['hero']);
  assert.deepEqual(rank([{ label: 'facepalms' }, { label: 'plays' }], 'pl').map((x) => x.label), ['plays', 'facepalms']);
  assert.match(hoverInfo('  mira plays wave', 7, V).text, /animation clip/);
  assert.match(hoverInfo('scene a bg=studio {', 13, V).text, /^Background studio/);
  assert.match(hoverInfo('  mira waves', 3, V, DOC, 7).text, /actor \(mira\)/);
  assert.equal(hoverInfo('  mira: "plays"', 10, V), null);
});

test('ops: comment, indent, duplicate, move, newline, braces', () => {
  const t = 'scene a {\n  mira waves\n  bo nods\n}';
  const s = t.indexOf('mira'), e = t.indexOf('nods');
  let r = apply(t, toggleComment(t, s, e));
  assert.equal(r, 'scene a {\n  # mira waves\n  # bo nods\n}');
  assert.equal(apply(r, toggleComment(r, s, e + 2)), t);
  assert.equal(apply(t, indentLines(t, s, e)), 'scene a {\n    mira waves\n    bo nods\n}');
  assert.equal(apply(t, outdentLines(t, s, e)), 'scene a {\nmira waves\nbo nods\n}');
  assert.equal(outdentLines('x', 0, 0), null);
  assert.equal(apply(t, duplicateLines(t, s, s)), 'scene a {\n  mira waves\n  mira waves\n  bo nods\n}');
  const up = moveLines(t, e, e, -1);
  assert.equal(apply(t, up), 'scene a {\n  bo nods\n  mira waves\n}');
  assert.equal(up.selStart, e - '  mira waves\n'.length);
  assert.equal(apply(t, moveLines(t, s, s, 1)), 'scene a {\n  bo nods\n  mira waves\n}');
  assert.equal(moveLines(t, 0, 0, -1), null);
  const nl = 'scene a {}';
  const op = newline(nl, 9, 9);
  assert.equal(apply(nl, op), 'scene a {\n  \n}');
  assert.equal(op.selStart, 12);
  assert.equal(apply('  mira waves', newline('  mira waves', 12, 12)), '  mira waves\n  ');
  const cb = '  {\n    ';
  assert.equal(apply(cb, closeBrace(cb, cb.length, cb.length)), '  {\n  }');
});

test('ops: bracket matching skips strings and comments', () => {
  const lines = ['scene a {', '  mira: "{ not }"  # }', '  par {', '  }', '}'];
  assert.deepEqual(matchBracket(lines, 0, 8), { line: 4, col: 0 });
  assert.deepEqual(matchBracket(lines, 4, 0), { line: 0, col: 8 });
  assert.deepEqual(matchBracket(lines, 2, 6), { line: 3, col: 2 });
  assert.equal(matchBracket(lines, 1, 9), null);
});

test('ops: headerEnd, findAll, diff', () => {
  const src = readText('films/hello-filmly.fly');
  const he = headerEnd(src);
  const lines = src.split('\n');
  assert.match(lines[he.line - 1], /^character /);
  assert.equal(src.slice(0, he.offset).split('\n').length - 1, he.line);
  assert.deepEqual(headerEnd('scene a {\n}'), { offset: 0, line: 0 });
  assert.deepEqual(findAll('Mira mira MIRA', 'mira'), [0, 5, 10]);
  assert.deepEqual(findAll('Mira mira MIRA', 'mira', { caseSensitive: true }), [5]);
  assert.deepEqual(diff('hello world', 'hello brave world'), { from: 6, removed: '', inserted: 'brave ' });
  assert.deepEqual(diff('aaa', 'aa'), { from: 2, removed: 'a', inserted: '' });
});

test('performance: tokenizing 3,000 lines is fast', () => {
  const lines = [];
  for (let i = 0; i < 3000; i++) lines.push(i % 2 ? `  mira: "Line ${i} keeps going" voice=openai:coral mood=happy` : `  bo walks to ${i % 100} over 1.5s & # c`);
  const t0 = performance.now();
  for (const l of lines) renderLine(l);
  const ms = performance.now() - t0;
  assert.ok(ms < 400, `render took ${ms.toFixed(1)}ms`);
  const t1 = performance.now();
  complete(lines, 1500, 8, V);
  assert.ok(performance.now() - t1 < 50);
});
