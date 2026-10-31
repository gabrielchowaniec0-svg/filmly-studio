// Pure text-editing operations for the code editor. Each takes the full text + a selection and returns a single
// replacement { from, to, insert, selStart, selEnd } (selection offsets are in the NEW text), or null.
import { tokenizeLine } from './highlight.js';

export const INDENT = '  ';

/** Offsets of the first and last line touched by a selection [s, e]. */
export function lineBlock(text, s, e) {
  if (e > s && text[e - 1] === '\n') e--; // a selection ending at a line start doesn't include that line
  const start = text.lastIndexOf('\n', s - 1) + 1;
  let end = text.indexOf('\n', e);
  if (end < 0) end = text.length;
  return { start, end };
}

export function lineColAt(text, off) {
  let line = 0, last = -1;
  for (let i = text.indexOf('\n'); i >= 0 && i < off; i = text.indexOf('\n', i + 1)) { line++; last = i; }
  return { line, col: off - last - 1 };
}

const indentOf = (l) => /^[ \t]*/.exec(l)[0];

export function toggleComment(text, s, e) {
  const { start, end } = lineBlock(text, s, e);
  const lines = text.slice(start, end).split('\n');
  const body = lines.filter((l) => l.trim());
  if (!body.length) return null;
  const allCommented = body.every((l) => /^\s*(#|\/\/)/.test(l));
  let ds = 0, de = 0; // selection shifts
  const minIndent = Math.min(...body.map((l) => indentOf(l).length));
  const out = lines.map((l, i) => {
    if (!l.trim()) return l;
    let r;
    if (allCommented) r = l.replace(/^(\s*)(#|\/\/) ?/, '$1');
    else r = l.slice(0, minIndent) + '# ' + l.slice(minIndent);
    if (i === 0) ds = r.length - l.length;
    de += r.length - l.length;
    return r;
  });
  const insert = out.join('\n');
  const firstLineIndent = indentOf(lines[0]).length;
  const s2 = s - start <= firstLineIndent ? s : Math.max(start, s + ds);
  return { from: start, to: end, insert, selStart: s2, selEnd: Math.max(s2, e + de) };
}

export function indentLines(text, s, e) {
  const { start, end } = lineBlock(text, s, e);
  const lines = text.slice(start, end).split('\n');
  const out = lines.map((l) => (l.length ? INDENT + l : l));
  const added = out.join('\n').length - (end - start);
  return { from: start, to: end, insert: out.join('\n'), selStart: s + (lines[0].length ? INDENT.length : 0), selEnd: e + added };
}

export function outdentLines(text, s, e) {
  const { start, end } = lineBlock(text, s, e);
  const lines = text.slice(start, end).split('\n');
  let first = 0, total = 0;
  const out = lines.map((l, i) => {
    const m = /^( {1,2}|\t)/.exec(l);
    const n = m ? m[0].length : 0;
    if (i === 0) first = Math.min(n, s - start);
    total += n;
    return l.slice(n);
  });
  if (!total) return null;
  return { from: start, to: end, insert: out.join('\n'), selStart: Math.max(start, s - first), selEnd: Math.max(start, e - total) };
}

export function duplicateLines(text, s, e) {
  const { start, end } = lineBlock(text, s, e);
  const block = text.slice(start, end);
  const shift = block.length + 1;
  return { from: end, to: end, insert: '\n' + block, selStart: s + shift, selEnd: e + shift };
}

export function moveLines(text, s, e, dir) {
  const { start, end } = lineBlock(text, s, e);
  const block = text.slice(start, end);
  if (dir < 0) {
    if (start === 0) return null;
    const pStart = text.lastIndexOf('\n', start - 2) + 1;
    const prev = text.slice(pStart, start - 1);
    const shift = -(prev.length + 1);
    return { from: pStart, to: end, insert: block + '\n' + prev, selStart: s + shift, selEnd: e + shift };
  }
  if (end >= text.length) return null;
  let nEnd = text.indexOf('\n', end + 1);
  if (nEnd < 0) nEnd = text.length;
  const next = text.slice(end + 1, nEnd);
  const shift = next.length + 1;
  return { from: start, to: nEnd, insert: next + '\n' + block, selStart: s + shift, selEnd: e + shift };
}

/** Enter: keep indentation, indent after "{", and split "{|}" onto three lines. */
export function newline(text, s, e) {
  const ls = text.lastIndexOf('\n', s - 1) + 1;
  const lineBefore = text.slice(ls, s);
  const ind = indentOf(lineBefore);
  const opens = /\{\s*$/.test(lineBefore.replace(/\s*(#|\/\/).*$/, ''));
  const after = text.slice(e, e + 1);
  if (opens && after === '}') {
    const insert = '\n' + ind + INDENT + '\n' + ind;
    return { from: s, to: e, insert, selStart: s + 1 + ind.length + INDENT.length, selEnd: s + 1 + ind.length + INDENT.length };
  }
  // strip trailing spaces after the caret position so the new line starts cleanly
  let to = e;
  while (text[to] === ' ' && to < text.length) to++;
  const insert = '\n' + ind + (opens ? INDENT : '');
  return { from: s, to, insert, selStart: s + insert.length, selEnd: s + insert.length };
}

/** Typing "}" on a whitespace-only line: dedent that line by one level. */
export function closeBrace(text, s, e) {
  const ls = text.lastIndexOf('\n', s - 1) + 1;
  const lineBefore = text.slice(ls, s);
  if (s !== e || !/^\s+$/.test(lineBefore)) return null;
  const ind = lineBefore.slice(0, Math.max(0, lineBefore.length - INDENT.length));
  return { from: ls, to: s, insert: ind + '}', selStart: ls + ind.length + 1, selEnd: ls + ind.length + 1 };
}

/** Matching brace for a "{" or "}" at (line, col), skipping strings/comments. Returns {line, col} or null. */
export function matchBracket(lines, line, col, maxLines = 20000) {
  const ch = (lines[line] || '')[col];
  if (ch !== '{' && ch !== '}') return null;
  const isBrace = (l, c) => tokenizeLine(lines[l]).some((t) => t.t === 'brace' && t.s === c);
  if (!isBrace(line, col)) return null;
  const dir = ch === '{' ? 1 : -1;
  let depth = 0;
  for (let l = line, n = 0; l >= 0 && l < lines.length && n < maxLines; l += dir, n++) {
    if (lines[l].indexOf('{') < 0 && lines[l].indexOf('}') < 0) continue;
    const braces = tokenizeLine(lines[l]).filter((t) => t.t === 'brace');
    if (dir < 0) braces.reverse();
    for (const t of braces) {
      if (l === line && (dir > 0 ? t.s < col : t.s > col)) continue;
      depth += lines[l][t.s] === ch ? 1 : -1;
      if (depth === 0) return { line: l, col: t.s };
    }
  }
  return null;
}

/** Offset just after the header (film / fade / voice / character / let lines and the comments around them). */
export function headerEnd(text) {
  const lines = text.split('\n');
  let off = 0, last = -1, o = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^(film|fade|voice|character|let)\b/.test(l)) last = i;
    else if (l && !/^(#|\/\/)/.test(l)) break;
  }
  if (last < 0) return { offset: 0, line: 0 };
  for (let i = 0; i <= last; i++) o += lines[i].length + 1;
  off = Math.min(o, text.length);
  return { offset: off, line: last + 1 };
}

/** Find all matches of `q` in text (plain, optionally case-sensitive). Returns [start offsets]. */
export function findAll(text, q, { caseSensitive = false, limit = 100000 } = {}) {
  if (!q) return [];
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? q : q.toLowerCase();
  const out = [];
  for (let i = hay.indexOf(needle); i >= 0 && out.length < limit; i = hay.indexOf(needle, i + needle.length)) out.push(i);
  return out;
}

/** Diff two strings as a single replaced range (common prefix/suffix). */
export function diff(a, b) {
  let p = 0;
  const n = Math.min(a.length, b.length);
  while (p < n && a.charCodeAt(p) === b.charCodeAt(p)) p++;
  let s = 0;
  while (s < n - p && a.charCodeAt(a.length - 1 - s) === b.charCodeAt(b.length - 1 - s)) s++;
  return { from: p, removed: a.slice(p, a.length - s), inserted: b.slice(p, b.length - s) };
}
