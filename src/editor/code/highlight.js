// FilmScript syntax tokenizer + HTML renderer for the code editor. Pure (no DOM) so it runs in Node tests.
// Tokenization is strictly per line (FilmScript has no multi-line tokens), so the editor can highlight only
// the visible lines and cache results by line text.

export const KEYWORDS = new Set([
  'film', 'scene', 'cast', 'voice', 'character', 'prop', 'effect', 'transition', 'fade', 'wait', 'at', 'hold', 'par',
  'repeat', 'let', 'caption', 'title', 'camera', 'music', 'sfx', 'ambience',
]);
/** Secondary words that read as keywords when they appear later in a line. */
export const SOFT_KEYWORDS = new Set(['to', 'from', 'over', 'for', 'in', 'out', 'off', 'none', 'stop', 'with']);
export const VERBS = new Set([
  'says', 'walks', 'runs', 'moves', 'enters', 'exits', 'faces', 'looks', 'plays', 'feels', 'idles', 'shows', 'hides',
  'holds', 'drops', 'waves', 'jumps', 'shrugs', 'nods', 'cheers', 'gestures', 'points', 'thinks', 'claps', 'laughs',
  'bows', 'dances', 'facepalms', 'gasps', 'sulks',
]);

const RX_NUM = /^-?\d+(?:\.\d+)?(?:x\d+)?/;
const RX_UNIT = /^(ms|s|%)(?![A-Za-z0-9_])/;
const RX_VAR = /^\$[A-Za-z_][A-Za-z0-9_]*/;
const RX_ID = /^[A-Za-z_][A-Za-z0-9_.\-]*(?::[A-Za-z0-9_][A-Za-z0-9_.\-]*)*/;
const RX_HEX = /^#[0-9a-fA-F]{3,8}(?![\w])/;

/**
 * Tokenize one line. Returns [{t, s, e}] covering every non-space character, in order.
 * Types: comment string number unit keyword kw2 verb actor decl ref key value voice color var brace punct op ident bad
 */
export function tokenizeLine(src) {
  const toks = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
    const prev = toks[toks.length - 1];
    if (ch === '#' && prev && prev.t === 'op' && src[prev.s] === '=') {
      const hm = RX_HEX.exec(src.slice(i));
      if (hm) { toks.push({ t: 'color', s: i, e: i + hm[0].length }); i += hm[0].length; continue; }
    }
    if (ch === '#' || (ch === '/' && src[i + 1] === '/')) { toks.push({ t: 'comment', s: i, e: n }); break; }
    if (ch === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      const closed = j < n;
      toks.push({ t: closed ? 'string' : 'string bad', s: i, e: Math.min(n, j + 1) });
      i = Math.min(n, j + 1);
      continue;
    }
    const rest = src.slice(i);
    let m = RX_NUM.exec(rest);
    if (m && !(ch === '-' && prev && (prev.t === 'ident' || prev.t === 'value') && prev.e === i)) {
      toks.push({ t: 'number', s: i, e: i + m[0].length });
      i += m[0].length;
      const u = RX_UNIT.exec(src.slice(i));
      if (u) { toks.push({ t: 'unit', s: i, e: i + u[1].length }); i += u[1].length; }
      continue;
    }
    m = RX_VAR.exec(rest);
    if (m) { toks.push({ t: 'var', s: i, e: i + m[0].length }); i += m[0].length; continue; }
    m = RX_ID.exec(rest);
    if (m) { toks.push({ t: 'ident', s: i, e: i + m[0].length }); i += m[0].length; continue; }
    if (ch === '{' || ch === '}') { toks.push({ t: 'brace', s: i, e: i + 1 }); i++; continue; }
    if (ch === '=' || ch === '&' || ch === '@') { toks.push({ t: 'op', s: i, e: i + 1 }); i++; continue; }
    if (ch === ':' || ch === ',') { toks.push({ t: 'punct', s: i, e: i + 1 }); i++; continue; }
    toks.push({ t: 'bad', s: i, e: i + 1 });
    i++;
  }
  classify(src, toks);
  return toks;
}

function classify(src, toks) {
  const word = (k) => (toks[k] && toks[k].t === 'ident' ? src.slice(toks[k].s, toks[k].e) : null);
  const isSym = (k, c) => toks[k] && src.slice(toks[k].s, toks[k].e) === c;
  const first = word(0);
  let start = 0;
  if (first !== null) {
    if (KEYWORDS.has(first)) {
      toks[0].t = 'keyword';
      start = 1;
      if ((first === 'cast' || first === 'prop') && word(1) !== null) {
        toks[1].t = 'decl';
        if (isSym(2, ':') && word(3) !== null) toks[3].t = 'ref';
        start = 4;
      } else if ((first === 'scene' || first === 'let' || first === 'voice' || first === 'character') && word(1) !== null) {
        toks[1].t = 'decl';
        start = 2;
        if (first === 'voice' && isSym(2, '=') && word(3) !== null) { toks[3].t = 'voice'; start = 4; }
        if (first === 'character' && word(2) === 'from') { toks[2].t = 'kw2'; if (word(3) !== null) toks[3].t = 'ref'; start = 4; }
      } else if ((first === 'transition' || first === 'effect' || first === 'sfx' || first === 'music' || first === 'ambience') && word(1) !== null) {
        const w = word(1);
        toks[1].t = SOFT_KEYWORDS.has(w) ? 'kw2' : 'ref';
        start = 2;
      }
    } else if (isSym(1, ':') && toks[1].s === toks[0].e) {
      toks[0].t = 'actor';
      start = 2;
    } else if (word(1) !== null && VERBS.has(word(1))) {
      toks[0].t = 'actor';
      toks[1].t = 'verb';
      start = 2;
    }
  } else if (toks[0] && toks[0].t === 'var' && word(1) !== null && VERBS.has(word(1))) {
    toks[1].t = 'verb';
    start = 2;
  }
  for (let k = start; k < toks.length; k++) {
    const t = toks[k];
    if (t.t !== 'ident') continue;
    if (isSym(k + 1, '=') && toks[k + 1].s === t.e) { t.t = 'key'; continue; }
    if (k > 0 && isSym(k - 1, '=') && toks[k - 1].e === t.s) { t.t = src.slice(t.s, t.e).includes(':') ? 'voice' : 'value'; continue; }
    const w = src.slice(t.s, t.e);
    if (w.includes(':')) t.t = 'voice';
    else if (SOFT_KEYWORDS.has(w) || w === 'at') t.t = 'kw2';
  }
}

// ---- HTML rendering ---------------------------------------------------------------------------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const escapeHTML = (s) => s.replace(/[&<>"]/g, (c) => ESC[c]);

/**
 * Render a line to HTML. `decos` are extra ranges [{s, e, cls}] (find matches, squiggles, bracket match) that are
 * merged with tokens into flat spans, so no element changes the text's width.
 */
export function renderLine(src, toks = tokenizeLine(src), decos = null) {
  if (!src.length) return '';
  const pts = new Set([0, src.length]);
  for (const t of toks) { pts.add(t.s); pts.add(t.e); }
  if (decos) for (const d of decos) { pts.add(Math.max(0, Math.min(src.length, d.s))); pts.add(Math.max(0, Math.min(src.length, d.e))); }
  const cuts = [...pts].sort((a, b) => a - b);
  let out = '';
  let ti = 0;
  for (let c = 0; c < cuts.length - 1; c++) {
    const a = cuts[c], b = cuts[c + 1];
    if (a === b) continue;
    while (ti < toks.length && toks[ti].e <= a) ti++;
    const tok = toks[ti] && toks[ti].s <= a && toks[ti].e >= b ? toks[ti] : null;
    let cls = tok ? 'tk-' + tok.t.replace(' ', ' tk-') : '';
    let style = '';
    if (decos) for (const d of decos) if (d.s <= a && d.e >= b && d.e > d.s) cls += ' ' + d.cls;
    if (tok && tok.t === 'color') {
      style = ` style="--sw:${src.slice(tok.s, tok.e)}"`;
      const nx = src[tok.e];
      if (b === tok.e && (nx === undefined || nx === ' ' || nx === '\t')) cls += ' tk-swatch';
    }
    const text = escapeHTML(src.slice(a, b));
    out += cls || style ? `<span class="${cls.trim()}"${style}>${text}</span>` : text;
  }
  return out;
}

/** Which token is at column `col` (0-based)? */
export function tokenAt(src, col, toks = tokenizeLine(src)) {
  for (const t of toks) if (col >= t.s && col < t.e) return t;
  return null;
}

/** Is a column inside a string or comment (so brackets/completions there are ignored)? */
export function inStringOrComment(src, col, toks = tokenizeLine(src)) {
  for (const t of toks) {
    if (t.t === 'comment' && col > t.s) return 'comment';
    if (t.t.startsWith('string') && col > t.s && (col < t.e || t.t.includes('bad'))) return 'string';
  }
  return null;
}
