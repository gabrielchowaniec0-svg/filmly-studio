// FilmScript code editor: a transparent <textarea> (native editing, IME, mobile keyboards, a11y) over a
// highlighted layer that renders only the visible lines. Own undo history, autocomplete, hover docs,
// diagnostics, find/replace, bracket matching. Zero dependencies. See createCodeEditor() below for the API.
import { tokenizeLine, renderLine, inStringOrComment, escapeHTML } from './highlight.js';
import { complete, buildVocab, expandInsert, hoverInfo, CURSOR } from './complete.js';
import {
  INDENT, lineColAt, toggleComment, indentLines, outdentLines, duplicateLines, moveLines, newline,
  closeBrace, matchBracket, headerEnd, findAll, diff,
} from './ops.js';

export { CURSOR as SNIPPET_CURSOR };

const OVERSCAN = 8;
const CACHE_MAX = 6000;
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const KIND_ICON = { keyword: 'K', verb: 'V', actor: 'A', prop: 'P', character: 'C', scene: 'B', voice: 'v', provider: 'p', clip: '▶', mood: 'M', transition: 'T', effect: 'E', sound: '♪', snippet: '{}', variable: '$', option: '=', value: '·', build: 'b' };

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  if (document.querySelector('link[data-fce]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.fce = '1';
  link.href = new URL('./code-editor.css', import.meta.url).href;
  document.head.appendChild(link);
}

const h = (tag, cls, attrs = {}) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
};

/**
 * Mount a FilmScript editor into `container`.
 * Lines are 1-based everywhere in this API; diagnostic `col` is 0-based (like FSError.col).
 * onChange(value, {source}) fires on every change (source: 'user' | 'api' | 'undo' | 'redo' | 'set').
 * onCursor(line, col) fires when the caret moves (1-based line, 0-based col).
 */
export function createCodeEditor(container, {
  value = '', getAssets = () => null, getVocabulary = () => ({}), onChange = () => {}, onCursor = () => {}, readOnly = false,
} = {}) {
  injectCSS();
  // ---- DOM ----
  const root = h('div', 'fce');
  const gutter = h('div', 'fce-gutter', { 'aria-hidden': 'true' });
  const gutterInner = h('div', 'fce-gutter-inner');
  gutter.appendChild(gutterInner);
  const main = h('div', 'fce-main');
  const view = h('div', 'fce-view', { 'aria-hidden': 'true' });
  const bands = h('div', 'fce-bands');
  const pre = h('pre', 'fce-text');
  view.append(bands, pre);
  const ta = h('textarea', 'fce-input', {
    spellcheck: 'false', wrap: 'off', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
    'aria-label': 'FilmScript code', 'aria-multiline': 'true', 'aria-autocomplete': 'list',
  });
  main.append(view, ta);
  const popup = h('div', 'fce-popup', { role: 'listbox' });
  popup.hidden = true;
  const tip = h('div', 'fce-tip', { role: 'tooltip' });
  tip.hidden = true;
  const measureEl = h('span', 'fce-measure');
  measureEl.textContent = 'M'.repeat(100);
  const find = buildFindBar();
  root.append(gutter, main, popup, tip, find.el, measureEl);
  container.appendChild(root);

  // ---- state ----
  let text = String(value).replace(/\r\n?/g, '\n');
  ta.value = text;
  let lines = text.split('\n');
  let prevValue = text;
  let LH = 20, CW = 7.8, padT = 10, padL = 12;
  let diags = new Map(); // line(0-based) -> [{col, message, severity}]
  let cur = { line: 0, col: 0 };
  let bracket = null; // [{line,col},{line,col}]
  let composing = false;
  let tabEscape = false;
  let selBeforeInput = null;
  let lastInputType = '';
  let ro = !!readOnly;
  ta.readOnly = ro;
  const cache = new Map();
  const undoStack = [], redoStack = [];
  let flash = null; // {from, to, until}
  let gutterDigits = 0;
  let destroyed = false;
  const findState = { open: false, q: '', cs: false, matches: [], idx: -1, replace: false };
  const pop = { open: false, items: [], sel: 0, from: 0, to: 0, line: 0, navigated: false, explicit: false };

  // ---- measuring ----
  function measure() {
    const cs = getComputedStyle(ta);
    LH = parseFloat(cs.lineHeight) || 20;
    padT = parseFloat(cs.paddingTop) || 0;
    padL = parseFloat(cs.paddingLeft) || 0;
    const w = measureEl.getBoundingClientRect().width;
    if (w > 0) CW = w / 100;
    root.style.setProperty('--fce-lh', LH + 'px');
    updateGutterWidth(true);
  }
  function updateGutterWidth(force) {
    const d = Math.max(2, String(lines.length).length);
    if (d === gutterDigits && !force) return;
    gutterDigits = d;
    root.style.setProperty('--fce-gutter-w', Math.ceil(d * CW + 30) + 'px');
  }

  // ---- rendering ----
  function lineHTML(i) {
    const src = lines[i];
    const decos = lineDecos(i, src);
    if (!decos) {
      let html = cache.get(src);
      if (html === undefined) {
        if (cache.size > CACHE_MAX) cache.clear();
        html = renderLine(src);
        cache.set(src, html);
      }
      return html;
    }
    return renderLine(src, tokenizeLine(src), decos);
  }
  function lineDecos(i, src) {
    let decos = null;
    const add = (s, e, cls) => { (decos || (decos = [])).push({ s, e, cls }); };
    const d = diags.get(i);
    if (d) for (const x of d) {
      const r = squiggleRange(src, x.col);
      add(r.s, r.e, 'fce-sq fce-sq-' + x.severity);
    }
    if (bracket) for (const b of bracket) if (b.line === i) add(b.col, b.col + 1, 'fce-bm');
    if (findState.open && findState.q && findState.matches.length) {
      const q = findState.q;
      const hay = findState.cs ? src : src.toLowerCase();
      const needle = findState.cs ? q : q.toLowerCase();
      const ls = lineStart(i);
      const curOff = findState.idx >= 0 ? findState.matches[findState.idx] : -1;
      for (let k = hay.indexOf(needle); k >= 0; k = hay.indexOf(needle, k + needle.length)) {
        add(k, k + q.length, ls + k === curOff ? 'fce-match fce-match-cur' : 'fce-match');
      }
    }
    return decos;
  }
  function squiggleRange(src, col) {
    const toks = tokenizeLine(src);
    if (col > 0) {
      const t = toks.find((x) => col >= x.s && col < x.e) || toks.find((x) => x.s >= col);
      if (t) return { s: t.s, e: t.e };
    }
    const m = /^\s*/.exec(src)[0].length;
    return { s: m, e: Math.max(m + 1, src.replace(/\s+$/, '').length) };
  }
  let lineStartsCache = null;
  function lineStart(i) {
    if (!lineStartsCache) {
      lineStartsCache = new Array(lines.length);
      let o = 0;
      for (let k = 0; k < lines.length; k++) { lineStartsCache[k] = o; o += lines[k].length + 1; }
    }
    return lineStartsCache[Math.max(0, Math.min(i, lines.length - 1))] || 0;
  }

  // Keyed DOM reuse: only lines whose position/markup changed are touched (keeps typing cheap on big files).
  const textPool = new Map(), gutterPool = new Map();
  let lastBands = null;
  function patch(parent, pool, items) {
    const keep = new Map();
    const fresh = [];
    for (const it of items) {
      const key = it.top + '|' + it.cls + '|' + it.html;
      const el = pool.get(key);
      if (el) { pool.delete(key); keep.set(key, el); } else fresh.push([key, it]);
    }
    const spare = [...pool.values()];
    for (const [key, it] of fresh) {
      const el = spare.pop() || parent.appendChild(document.createElement('div'));
      el.className = it.cls;
      el.style.top = it.top + 'px';
      el.innerHTML = it.html;
      if (it.line != null) el.dataset.line = it.line;
      keep.set(key, el);
    }
    for (const el of spare) el.remove();
    pool.clear();
    for (const [k, el] of keep) pool.set(k, el);
  }

  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; if (!destroyed) render(); });
  }
  function render() {
    const st = ta.scrollTop, sl = ta.scrollLeft, vh = ta.clientHeight || 400;
    const first = Math.max(0, Math.floor((st - padT) / LH) - OVERSCAN);
    const last = Math.min(lines.length - 1, Math.ceil((st + vh - padT) / LH) + OVERSCAN);
    const tItems = [], gItems = [];
    let bHTML = '';
    const focused = document.activeElement === ta;
    for (let i = first; i <= last; i++) {
      const top = padT + i * LH;
      tItems.push({ top, html: lineHTML(i), cls: 'fce-line' });
      const d = diags.get(i);
      const sev = d ? (d.some((x) => x.severity === 'error') ? 'error' : 'warning') : '';
      gItems.push({ top, html: (sev ? '<i></i>' : '') + (i + 1), cls: `fce-ln${i === cur.line ? ' cur' : ''}${sev ? ' ' + sev : ''}`, line: i });
      if (sev) bHTML += `<div class="fce-band ${sev}" style="top:${top}px"></div>`;
    }
    if (cur.line >= first && cur.line <= last) bHTML += `<div class="fce-band cur${focused ? ' focus' : ''}" style="top:${padT + cur.line * LH}px"></div>`;
    if (flash && flash.until > performance.now()) {
      for (let i = Math.max(first, flash.from); i <= Math.min(last, flash.to); i++) bHTML += `<div class="fce-band flash" style="top:${padT + i * LH}px"></div>`;
    }
    patch(pre, textPool, tItems);
    patch(gutterInner, gutterPool, gItems);
    if (bHTML !== lastBands) { bands.innerHTML = bHTML; lastBands = bHTML; }
    pre.style.transform = `translate(${-sl}px,${-st}px)`;
    bands.style.transform = `translateY(${-st}px)`;
    gutterInner.style.transform = `translateY(${-st}px)`;
    if (pop.open) positionPopup();
  }

  // ---- selection / cursor ----
  function updateCursor() {
    const s = ta.selectionDirection === 'backward' ? ta.selectionStart : ta.selectionEnd;
    const lc = lineColAt(text, s);
    const moved = lc.line !== cur.line || lc.col !== cur.col;
    cur = lc;
    // bracket matching next to the caret
    bracket = null;
    if (ta.selectionStart === ta.selectionEnd) {
      const l = lines[lc.line] || '';
      for (const c of [lc.col - 1, lc.col]) {
        if (c >= 0 && (l[c] === '{' || l[c] === '}')) {
          const m = matchBracket(lines, lc.line, c, 5000);
          if (m) { bracket = [{ line: lc.line, col: c }, m]; break; }
        }
      }
    }
    if (moved) {
      if (booted) try { onCursor(lc.line + 1, lc.col); } catch (e) { console.error(e); }
      if (pop.open && (lc.line !== pop.line || s < pop.from || s > pop.to + 40)) closePopup();
    }
    scheduleRender();
  }

  function ensureVisible(off = ta.selectionEnd, center = false) {
    const { line, col } = lineColAt(text, off);
    const top = padT + line * LH;
    const vh = ta.clientHeight;
    if (center && (top < ta.scrollTop || top + LH > ta.scrollTop + vh)) ta.scrollTop = Math.max(0, top - vh / 3);
    else if (top < ta.scrollTop) ta.scrollTop = top - padT;
    else if (top + LH > ta.scrollTop + vh) ta.scrollTop = top + LH - vh + padT;
    const x = padL + visualCol(lines[line] || '', col) * CW;
    const vw = ta.clientWidth;
    if (x < ta.scrollLeft + padL) ta.scrollLeft = Math.max(0, x - padL - 40);
    else if (x > ta.scrollLeft + vw - 30) ta.scrollLeft = x - vw + 60;
  }
  function visualCol(l, col) {
    let v = 0;
    for (let i = 0; i < col && i < l.length; i++) v = l[i] === '\t' ? v + 2 - (v % 2) : v + 1;
    return v + Math.max(0, col - l.length);
  }
  function colFromVisual(l, vx) {
    let v = 0;
    for (let i = 0; i < l.length; i++) {
      const nv = l[i] === '\t' ? v + 2 - (v % 2) : v + 1;
      if (vx < nv) return i;
      v = nv;
    }
    return l.length;
  }

  // ---- edits + history ----
  function afterChange(source) {
    lines = text.split('\n');
    lineStartsCache = null;
    updateGutterWidth(false);
    if (findState.open) recomputeMatches(false);
    updateCursor();
    render();
    try { onChange(text, { source }); } catch (e) { console.error(e); }
  }
  function record(ch) {
    redoStack.length = 0;
    const last = undoStack[undoStack.length - 1];
    const now = performance.now();
    if (last && now - last.t < 900 && ch.kind === last.kind && (ch.kind === 'type' || ch.kind === 'del')) {
      if (ch.kind === 'type' && !ch.removed && !last.removed.includes('\n') && ch.from === last.from + last.inserted.length && !/\s/.test(ch.inserted.slice(-1) || 'x')) {
        last.inserted += ch.inserted; last.selAfter = ch.selAfter; last.t = now; return;
      }
      if (ch.kind === 'del' && !ch.inserted && !last.inserted && ch.from + ch.removed.length === last.from) {
        last.from = ch.from; last.removed = ch.removed + last.removed; last.selAfter = ch.selAfter; last.t = now; return;
      }
    }
    ch.t = now;
    undoStack.push(ch);
    if (undoStack.length > 1000) undoStack.shift();
  }
  /** Replace text[from, to) with `insert`, select [selStart, selEnd] (offsets in the new text). */
  function edit(from, to, insert, selStart = from + insert.length, selEnd = selStart, kind = 'api', source = 'api') {
    if (ro) return false;
    const selBefore = [ta.selectionStart, ta.selectionEnd];
    const removed = text.slice(from, to);
    if (removed === insert && selStart === selBefore[0] && selEnd === selBefore[1]) return false;
    ta.setRangeText(insert, from, to, 'end');
    ta.setSelectionRange(selStart, selEnd);
    text = ta.value;
    prevValue = text;
    record({ from, removed, inserted: insert, selBefore, selAfter: [selStart, selEnd], kind });
    afterChange(source);
    ensureVisible(selEnd);
    return true;
  }
  function applyOp(op, kind = 'op') { if (op) edit(op.from, op.to, op.insert, op.selStart, op.selEnd, kind, 'user'); return !!op; }

  function undo() {
    const ch = undoStack.pop();
    if (!ch) return false;
    ta.setRangeText(ch.removed, ch.from, ch.from + ch.inserted.length, 'end');
    ta.setSelectionRange(ch.selBefore[0], ch.selBefore[1]);
    text = prevValue = ta.value;
    redoStack.push(ch);
    closePopup();
    afterChange('undo');
    ensureVisible(ch.selBefore[1]);
    return true;
  }
  function redo() {
    const ch = redoStack.pop();
    if (!ch) return false;
    ta.setRangeText(ch.inserted, ch.from, ch.from + ch.removed.length, 'end');
    ta.setSelectionRange(ch.selAfter[0], ch.selAfter[1]);
    text = prevValue = ta.value;
    undoStack.push({ ...ch, t: 0 });
    closePopup();
    afterChange('redo');
    ensureVisible(ch.selAfter[1]);
    return true;
  }

  // ---- native input ----
  ta.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'historyUndo') { e.preventDefault(); undo(); return; }
    if (e.inputType === 'historyRedo') { e.preventDefault(); redo(); return; }
    selBeforeInput = [ta.selectionStart, ta.selectionEnd];
    lastInputType = e.inputType;
    if (ro || composing || e.isComposing || e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const next = text[en] || '';
    const prev = text[s - 1] || '';
    const ch = e.data;
    const atBoundary = !next || /[\s}]/.test(next);
    const inside = inStringOrComment(lines[cur.line] || '', cur.col);
    if (ch === '"' && s === en) {
      if (next === '"' && inside === 'string') { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); updateCursor(); return; }
      if (!inside && atBoundary && !/[\w"]/.test(prev)) { e.preventDefault(); edit(s, en, '""', s + 1, s + 1, 'type', 'user'); return; }
    } else if (ch === '"' && s !== en && !inside) {
      e.preventDefault(); edit(s, en, '"' + text.slice(s, en) + '"', s + 1, en + 1, 'op', 'user'); return;
    }
    if (inside) return;
    if (ch === '{' && s === en && atBoundary) { e.preventDefault(); edit(s, en, '{}', s + 1, s + 1, 'type', 'user'); return; }
    if (ch === '}' && s === en) {
      if (next === '}') { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); updateCursor(); return; }
      const op = closeBrace(text, s, en);
      if (op) { e.preventDefault(); applyOp(op, 'type'); }
    }
  });
  ta.addEventListener('input', (e) => {
    const v = ta.value;
    if (v === prevValue) return;
    const d = diff(prevValue, v);
    const it = e.inputType || lastInputType;
    const kind = it === 'insertText' && !composing ? 'type' : /^delete(Content)?(Backward|Forward)$/.test(it) ? 'del' : 'other';
    const selBefore = selBeforeInput || [d.from, d.from + d.removed.length];
    text = prevValue = v;
    record({ from: d.from, removed: d.removed, inserted: d.inserted, selBefore, selAfter: [ta.selectionStart, ta.selectionEnd], kind });
    selBeforeInput = null;
    afterChange('user');
    if (!composing && (kind === 'type' || (kind === 'del' && pop.open))) {
      const ch = d.inserted.slice(-1);
      if (kind === 'del' || /[\w$:=.\- ]/.test(ch)) triggerCompletion(false);
      else closePopup();
    } else if (kind !== 'type') closePopup();
  });
  ta.addEventListener('compositionstart', () => { composing = true; closePopup(); });
  ta.addEventListener('compositionend', () => { composing = false; });

  ta.addEventListener('keydown', (e) => {
    if (e.isComposing || composing) return;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const k = e.key;
    if (pop.open) {
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); movePopup(k === 'ArrowDown' ? 1 : -1); return; }
      if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); movePopup(k === 'PageDown' ? 7 : -7); return; }
      if (k === 'Tab' || (k === 'Enter' && (pop.navigated || text.slice(pop.from, ta.selectionStart).length > 0))) { e.preventDefault(); acceptCompletion(); return; }
      if (k === 'Escape') { e.preventDefault(); closePopup(); return; }
      if (k === 'Enter') closePopup();
    }
    hideTip();
    if (mod && !e.altKey && (k === 'z' || k === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && !e.altKey && (k === 'y' || k === 'Y') && !isMac) { e.preventDefault(); redo(); return; }
    if (mod && (k === 'f' || k === 'F')) { e.preventDefault(); openFind(false); return; }
    if (mod && (k === 'h' || k === 'H') && !isMac) { e.preventDefault(); openFind(true); return; }
    if ((mod && (k === 'g' || k === 'G')) || k === 'F3') { e.preventDefault(); if (!findState.q) openFind(false); else findStep(e.shiftKey ? -1 : 1, true); return; }
    if (k === 'Escape' && findState.open) { e.preventDefault(); closeFind(); return; }
    if ((mod || e.ctrlKey) && (k === ' ' || e.code === 'Space')) { e.preventDefault(); triggerCompletion(true); return; }
    if (ro) return;
    const s = ta.selectionStart, en = ta.selectionEnd;
    if (mod && (k === '/' || e.code === 'Slash')) { e.preventDefault(); applyOp(toggleComment(text, s, en)); return; }
    if (mod && !e.shiftKey && (k === 'd' || k === 'D')) { e.preventDefault(); applyOp(duplicateLines(text, s, en)); return; }
    if (e.altKey && !mod && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); applyOp(moveLines(text, s, en, k === 'ArrowUp' ? -1 : 1)); return; }
    if (k === 'Escape') { tabEscape = true; return; }
    if (k === 'Tab' && tabEscape) { tabEscape = false; return; } // Esc then Tab: let focus leave the editor (a11y)
    if (k !== 'Shift') tabEscape = false;
    if (k === 'Tab' && !mod && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) applyOp(outdentLines(text, s, en));
      else if (s !== en && text.slice(s, en).includes('\n')) applyOp(indentLines(text, s, en));
      else edit(s, en, INDENT, s + INDENT.length, s + INDENT.length, 'type', 'user');
      return;
    }
    if (k === 'Enter' && !mod && !e.altKey && !e.shiftKey) { e.preventDefault(); applyOp(newline(text, s, en), 'other'); return; }
    if (k === 'Backspace' && s === en && s > 0 && !mod && !e.altKey) {
      const pair = text.slice(s - 1, s + 1);
      if (pair === '{}' || pair === '""') { e.preventDefault(); edit(s - 1, s + 1, '', s - 1, s - 1, 'del', 'user'); return; }
      // backspace in leading indentation removes one indent level
      const ls = text.lastIndexOf('\n', s - 1) + 1;
      const before = text.slice(ls, s);
      if (before.length >= 2 && /^ +$/.test(before)) {
        const n = before.length % 2 === 0 ? 2 : 1;
        e.preventDefault(); edit(s - n, s, '', s - n, s - n, 'del', 'user'); return;
      }
    }
  });
  ta.addEventListener('keyup', updateCursor);
  ta.addEventListener('mouseup', updateCursor);
  ta.addEventListener('focus', () => { root.classList.add('focused'); scheduleRender(); });
  ta.addEventListener('blur', () => { root.classList.remove('focused'); setTimeout(() => { if (document.activeElement !== ta && !popup.contains(document.activeElement)) closePopup(); }, 120); scheduleRender(); });
  const onSelChange = () => { if (document.activeElement === ta) updateCursor(); };
  document.addEventListener('selectionchange', onSelChange);
  ta.addEventListener('scroll', () => { hideTip(); render(); });

  // ---- autocomplete ----
  function vocab() {
    let a = null, x = {};
    try { a = getAssets(); } catch { /* ignore */ }
    try { x = getVocabulary() || {}; } catch { /* ignore */ }
    return buildVocab(a, x);
  }
  function triggerCompletion(explicit) {
    if (ro || ta.selectionStart !== ta.selectionEnd) { closePopup(); return; }
    const { line, col } = lineColAt(text, ta.selectionStart);
    const res = complete(lines, line, col, vocab(), { explicit });
    if (!res) { closePopup(); return; }
    const ls = lineStart(line);
    const keepSel = pop.open && pop.navigated && pop.items[pop.sel] ? pop.items[pop.sel].label : null;
    Object.assign(pop, { open: true, items: res.items, from: ls + res.from, to: ls + res.to, line, explicit, prefix: res.prefix });
    const ks = keepSel ? res.items.findIndex((i) => i.label === keepSel) : -1;
    pop.sel = ks >= 0 ? ks : 0;
    pop.navigated = ks >= 0;
    drawPopup();
  }
  function drawPopup() {
    const p = (pop.prefix || '').toLowerCase();
    popup.innerHTML = pop.items.map((it, i) => {
      const l = it.label;
      const hl = p && l.toLowerCase().startsWith(p) ? `<b>${escapeHTML(l.slice(0, p.length))}</b>${escapeHTML(l.slice(p.length))}` : escapeHTML(l);
      return `<div class="fce-item${i === pop.sel ? ' sel' : ''}" role="option" data-i="${i}" aria-selected="${i === pop.sel}">` +
        `<span class="fce-ico k-${it.kind}">${KIND_ICON[it.kind] || '•'}</span><span class="fce-lbl">${hl}</span>` +
        `<span class="fce-det">${escapeHTML(it.detail || '')}</span></div>`;
    }).join('');
    popup.hidden = false;
    positionPopup();
    scrollPopupSel();
  }
  function positionPopup() {
    const { line, col } = lineColAt(text, pop.from);
    const gw = gutter.offsetWidth;
    const x = gw + padL + visualCol(lines[line] || '', col) * CW - ta.scrollLeft - 30;
    const yTop = padT + line * LH - ta.scrollTop;
    const ph = popup.offsetHeight || 200;
    const H = root.clientHeight;
    let y = yTop + LH + 2;
    if (y + ph > H && yTop - ph - 2 > 0) y = yTop - ph - 2;
    const pw = popup.offsetWidth || 300;
    popup.style.left = Math.max(4, Math.min(x, root.clientWidth - pw - 4)) + 'px';
    popup.style.top = y + 'px';
    if (yTop < -LH || yTop > H) popup.style.visibility = 'hidden'; else popup.style.visibility = '';
  }
  function movePopup(d) {
    const n = pop.items.length;
    pop.sel = (pop.sel + d + n * 10) % n;
    if (Math.abs(d) > 1) pop.sel = Math.max(0, Math.min(n - 1, pop.sel));
    pop.navigated = true;
    for (const el of popup.children) { const on = +el.dataset.i === pop.sel; el.classList.toggle('sel', on); el.setAttribute('aria-selected', on); }
    scrollPopupSel();
  }
  function scrollPopupSel() {
    const el = popup.children[pop.sel];
    if (!el) return;
    if (el.offsetTop < popup.scrollTop) popup.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > popup.scrollTop + popup.clientHeight) popup.scrollTop = el.offsetTop + el.offsetHeight - popup.clientHeight;
  }
  function closePopup() { if (!pop.open) return; pop.open = false; popup.hidden = true; }
  function acceptCompletion(i = pop.sel) {
    const it = pop.items[i];
    if (!it) return closePopup();
    const indent = /^[ \t]*/.exec(lines[pop.line] || '')[0];
    const ex = expandInsert(it, indent);
    const from = pop.from, to = Math.max(pop.to, ta.selectionStart);
    closePopup();
    edit(from, to, ex.text, from + ex.selStart, from + ex.selEnd, 'op', 'user');
    if (it.retrigger || /=$/.test(ex.text) || (it.kind === 'keyword' && ex.selStart === ex.text.length && /^(cast|transition|effect|sfx|music|ambience|fade)$/.test(it.label))) {
      if (it.kind === 'keyword' && !/[=:]$/.test(ex.text)) edit(ta.selectionStart, ta.selectionStart, ' ', ta.selectionStart + 1, ta.selectionStart + 1, 'type', 'user');
      triggerCompletion(false);
    }
  }
  popup.addEventListener('pointerdown', (e) => e.preventDefault());
  popup.addEventListener('click', (e) => {
    const el = e.target.closest('.fce-item');
    if (el) { acceptCompletion(+el.dataset.i); ta.focus(); }
  });

  // ---- hover tooltips ----
  let tipTimer = 0, tipKey = '';
  function showTip(html, x, y, cls = '') {
    tip.innerHTML = html;
    tip.className = 'fce-tip ' + cls;
    tip.hidden = false;
    const W = root.clientWidth;
    const tw = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(x, W - tw - 4)) + 'px';
    const th = tip.offsetHeight;
    tip.style.top = (y - th - 4 < 0 ? y + LH + 4 : y - th - 4) + 'px';
  }
  function hideTip() { clearTimeout(tipTimer); tipKey = ''; tip.hidden = true; }
  function diagHTML(list) {
    return list.map((d) => `<div class="fce-tip-${d.severity}"><b>${d.severity === 'error' ? 'Error' : 'Warning'}</b> ${escapeHTML(d.message)}</div>`).join('');
  }
  ta.addEventListener('mousemove', (e) => {
    if (e.buttons) return;
    const r = ta.getBoundingClientRect();
    const y = e.clientY - r.top + ta.scrollTop - padT;
    const line = Math.floor(y / LH);
    if (line < 0 || line >= lines.length) { hideTip(); return; }
    const l = lines[line];
    const vx = (e.clientX - r.left + ta.scrollLeft - padL) / CW;
    const col = colFromVisual(l, Math.floor(vx));
    if (vx < 0 || vx > visualCol(l, l.length) + 0.5) { hideTip(); return; }
    const key = line + ':' + col;
    if (key === tipKey) return;
    clearTimeout(tipTimer);
    tipKey = key;
    tipTimer = setTimeout(() => {
      const d = diags.get(line);
      const info = hoverInfo(l, col, vocab(), lines, line);
      let html = '';
      if (d) {
        const onSq = d.some((x) => { const q = squiggleRange(l, x.col); return col >= q.s && col < q.e; });
        if (onSq || !info) html += diagHTML(d);
      }
      if (info) html += `<div class="fce-tip-doc">${info.color ? `<span class="fce-tip-sw" style="background:${escapeHTML(info.color)}"></span>` : ''}${escapeHTML(info.text)}</div>`;
      if (!html) { tip.hidden = true; return; }
      const fromCol = info ? info.from : col;
      const x = gutter.offsetWidth + padL + visualCol(l, fromCol) * CW - ta.scrollLeft;
      showTip(html, x, padT + line * LH - ta.scrollTop);
    }, 380);
  });
  ta.addEventListener('mouseleave', hideTip);
  gutter.addEventListener('pointermove', (e) => {
    const el = e.target.closest('.fce-ln');
    if (!el || !diags.has(+el.dataset.line)) { if (tipKey.startsWith('g')) hideTip(); return; }
    const line = +el.dataset.line;
    if (tipKey === 'g' + line) return;
    hideTip();
    tipKey = 'g' + line;
    showTip(diagHTML(diags.get(line)), 4, padT + line * LH - ta.scrollTop);
  });
  gutter.addEventListener('pointerleave', () => { if (tipKey.startsWith('g')) hideTip(); });
  gutter.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.fce-ln');
    if (!el) return;
    e.preventDefault();
    const line = +el.dataset.line;
    if (diags.has(line)) {
      tipKey = 'g' + line;
      showTip(diagHTML(diags.get(line)), 4, padT + line * LH - ta.scrollTop);
      clearTimeout(tipTimer);
      if (e.pointerType !== 'mouse') tipTimer = setTimeout(hideTip, 4000);
    }
    goto(line + 1, { select: true });
  });

  // ---- find / replace ----
  function buildFindBar() {
    const el = h('div', 'fce-find', { role: 'search' });
    el.hidden = true;
    el.innerHTML = `
      <div class="fce-find-row">
        <button type="button" class="fce-fb fce-find-tog" title="Toggle replace" aria-label="Toggle replace">›</button>
        <input class="fce-find-q" type="text" placeholder="Find" aria-label="Find" spellcheck="false" autocomplete="off">
        <span class="fce-find-count">No results</span>
        <button type="button" class="fce-fb fce-find-case" title="Match case" aria-pressed="false">Aa</button>
        <button type="button" class="fce-fb fce-find-prev" title="Previous (Shift+Enter)" aria-label="Previous match">↑</button>
        <button type="button" class="fce-fb fce-find-next" title="Next (Enter)" aria-label="Next match">↓</button>
        <button type="button" class="fce-fb fce-find-close" title="Close (Esc)" aria-label="Close find">×</button>
      </div>
      <div class="fce-find-row fce-find-rep">
        <span class="fce-find-pad"></span>
        <input class="fce-find-r" type="text" placeholder="Replace" aria-label="Replace" spellcheck="false" autocomplete="off">
        <button type="button" class="fce-fb fce-wide fce-find-one" title="Replace (Enter)">Replace</button>
        <button type="button" class="fce-fb fce-wide fce-find-all" title="Replace all (Ctrl+Alt+Enter)">All</button>
      </div>`;
    const $ = (c) => el.querySelector(c);
    return { el, q: $('.fce-find-q'), r: $('.fce-find-r'), count: $('.fce-find-count'), cs: $('.fce-find-case'), tog: $('.fce-find-tog'), prev: $('.fce-find-prev'), next: $('.fce-find-next'), close: $('.fce-find-close'), one: $('.fce-find-one'), all: $('.fce-find-all') };
  }
  function openFind(withReplace) {
    findState.open = true;
    find.el.hidden = false;
    setReplaceMode(withReplace || findState.replace);
    const sel = text.slice(ta.selectionStart, ta.selectionEnd);
    if (sel && !sel.includes('\n') && sel.length < 200) find.q.value = sel;
    find.q.focus();
    find.q.select();
    findState.q = find.q.value;
    recomputeMatches(true);
    render();
  }
  function setReplaceMode(on) {
    findState.replace = !!on;
    find.el.classList.toggle('with-replace', findState.replace);
    find.tog.textContent = findState.replace ? '⌄' : '›';
  }
  function closeFind() {
    findState.open = false;
    find.el.hidden = true;
    const m = findState.matches[findState.idx];
    ta.focus();
    if (m != null) ta.setSelectionRange(m, m + findState.q.length);
    render();
  }
  function recomputeMatches(fromCaret) {
    const q = findState.q;
    const prevOff = findState.matches[findState.idx];
    findState.matches = findAll(text, q, { caseSensitive: findState.cs });
    const ms = findState.matches;
    if (!ms.length) findState.idx = -1;
    else {
      const anchor = fromCaret ? ta.selectionStart : prevOff != null ? prevOff : ta.selectionStart;
      let i = ms.findIndex((m) => m >= anchor);
      findState.idx = i < 0 ? 0 : i;
    }
    updateCount();
  }
  function updateCount() {
    const n = findState.matches.length;
    find.count.textContent = !findState.q ? '' : n ? `${findState.idx + 1} of ${n >= 100000 ? '100000+' : n}` : 'No results';
    find.el.classList.toggle('nores', !!findState.q && !n);
  }
  function findStep(d, selectInEditor = false) {
    const ms = findState.matches;
    if (!ms.length) return;
    findState.idx = (findState.idx + d + ms.length) % ms.length;
    revealMatch(selectInEditor);
  }
  function revealMatch(selectInEditor) {
    const m = findState.matches[findState.idx];
    if (m == null) return;
    if (selectInEditor || document.activeElement === ta) ta.setSelectionRange(m, m + findState.q.length);
    ensureVisible(m, true);
    updateCount();
    updateCursorTo(m);
    render();
  }
  function updateCursorTo(off) { cur = lineColAt(text, off); }
  function replaceOne() {
    const m = findState.matches[findState.idx];
    if (m == null || ro) return;
    const rep = find.r.value;
    edit(m, m + findState.q.length, rep, m + rep.length, m + rep.length, 'op', 'user');
    find.q.focus();
    recomputeMatches(false);
    const i = findState.matches.findIndex((x) => x >= m + rep.length);
    findState.idx = findState.matches.length ? (i < 0 ? 0 : i) : -1;
    revealMatch(false);
  }
  function replaceAll() {
    const ms = findState.matches;
    if (!ms.length || ro) return;
    const q = findState.q, rep = find.r.value;
    let out = '', last = 0;
    for (const m of ms) { out += text.slice(last, m) + rep; last = m + q.length; }
    out += text.slice(last);
    const d = diff(text, out);
    edit(d.from, d.from + d.removed.length, d.inserted, ta.selectionStart, ta.selectionStart, 'op', 'user');
    find.q.focus();
    recomputeMatches(false);
    find.count.textContent = `Replaced ${ms.length}`;
    render();
  }
  find.q.addEventListener('input', () => { findState.q = find.q.value; recomputeMatches(true); revealMatch(false); render(); });
  find.q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
    else if ((isMac ? e.metaKey : e.ctrlKey) && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); find.q.select(); }
    else if ((isMac ? e.metaKey : e.ctrlKey) && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); setReplaceMode(!findState.replace); }
  });
  find.r.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); (e.ctrlKey || e.metaKey) && e.altKey ? replaceAll() : replaceOne(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  find.prev.addEventListener('click', () => findStep(-1));
  find.next.addEventListener('click', () => findStep(1));
  find.close.addEventListener('click', closeFind);
  find.tog.addEventListener('click', () => { setReplaceMode(!findState.replace); (findState.replace ? find.r : find.q).focus(); });
  find.cs.addEventListener('click', () => {
    findState.cs = !findState.cs;
    find.cs.setAttribute('aria-pressed', findState.cs);
    find.cs.classList.toggle('on', findState.cs);
    recomputeMatches(true); render();
  });
  find.one.addEventListener('click', replaceOne);
  find.all.addEventListener('click', replaceAll);

  // ---- public API helpers ----
  function goto(line, { select = true, focus = true } = {}) {
    const i = Math.max(0, Math.min(lines.length - 1, (line | 0) - 1));
    const s = lineStart(i);
    const l = lines[i];
    const ind = /^\s*/.exec(l)[0].length;
    if (focus) ta.focus({ preventScroll: true });
    if (select) ta.setSelectionRange(s + ind, s + l.length); else ta.setSelectionRange(s + ind, s + ind);
    ensureVisible(s, true);
    updateCursor();
    render();
  }
  function insert(snippet, mode = 'cursor') {
    if (ro) return null;
    let t = String(snippet).replace(/\r\n?/g, '\n');
    const s = ta.selectionStart, en = ta.selectionEnd;
    const { line } = lineColAt(text, s);
    const l = lines[line] || '';
    const ls = lineStart(line);
    const ind = /^[ \t]*/.exec(l)[0];
    let from, to, prefix = '', suffix = '', indent = ind;
    if (mode === 'top') {
      t = t.replace(/\n+$/, '');
      const he = headerEnd(text);
      from = to = he.offset;
      indent = '';
      if (from >= text.length && text.length && !text.endsWith('\n')) prefix = '\n';
      suffix = '\n';
    } else if (mode === 'line-start' || mode === 'line-end') {
      t = t.replace(/\n+$/, '');
      if (!l.trim()) { from = ls; to = ls + l.length; prefix = ind; }
      else if (mode === 'line-start') { from = to = ls; prefix = ind; suffix = '\n'; }
      else {
        from = to = ls + l.length;
        if (/\{\s*$/.test(l)) indent = ind + INDENT;
        prefix = '\n' + indent;
      }
      if (mode === 'line-start' && !l.trim()) indent = ind;
    } else { from = s; to = en; }
    const ex = expandInsert({ insert: t }, indent);
    const body = prefix + ex.text + suffix;
    const selA = from + prefix.length + ex.selStart, selB = from + prefix.length + ex.selEnd;
    edit(from, to, body, selA, selB, 'op', 'api');
    const a = lineColAt(text, from + prefix.length).line, b = lineColAt(text, from + prefix.length + ex.text.length).line;
    flash = { from: a, to: b, until: performance.now() + 900 };
    setTimeout(scheduleRender, 950);
    ensureVisible(selB, true);
    render();
    return { from: from + prefix.length, to: from + prefix.length + ex.text.length };
  }
  function setValue(v, { keepHistory = false } = {}) {
    v = String(v ?? '').replace(/\r\n?/g, '\n');
    if (keepHistory) {
      const d = diff(text, v);
      const wasRo = ro; ro = false;
      edit(d.from, d.from + d.removed.length, d.inserted, d.from + d.inserted.length, d.from + d.inserted.length, 'api', 'set');
      ro = wasRo;
      return;
    }
    ta.value = text = prevValue = v;
    undoStack.length = redoStack.length = 0;
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0; ta.scrollLeft = 0;
    closePopup();
    afterChange('set');
  }
  function setDiagnostics(list) {
    diags = new Map();
    for (const d of list || []) {
      if (!d || !(d.line >= 1)) continue;
      const i = Math.min(lines.length - 1, (d.line | 0) - 1);
      const arr = diags.get(i) || [];
      arr.push({ col: d.col | 0, message: String(d.message || ''), severity: d.severity === 'warning' ? 'warning' : 'error' });
      diags.set(i, arr);
    }
    render();
  }

  const ro_ = new ResizeObserver(() => { measure(); render(); });
  ro_.observe(root);
  measure();
  let booted = false;
  updateCursor();
  booted = true;
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) { measure(); render(); } });

  return {
    element: root,
    textarea: ta,
    getValue: () => text,
    setValue,
    focus: () => ta.focus(),
    goto,
    getCursorLine: () => cur.line + 1,
    getCursor: () => ({ line: cur.line + 1, col: cur.col }),
    getSelection: () => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const a = lineColAt(text, s), b = lineColAt(text, e);
      return { start: s, end: e, text: text.slice(s, e), startLine: a.line + 1, startCol: a.col, endLine: b.line + 1, endCol: b.col };
    },
    setSelection(start, end = start) { ta.setSelectionRange(start, end); ensureVisible(end); updateCursor(); },
    insert,
    setDiagnostics,
    undo, redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    openFind: (replace = false) => openFind(replace),
    closeFind,
    complete: () => { ta.focus(); triggerCompletion(true); },
    setReadOnly(v) { ro = !!v; ta.readOnly = ro; },
    getLineCount: () => lines.length,
    refresh() { measure(); render(); },
    destroy() {
      destroyed = true;
      ro_.disconnect();
      document.removeEventListener('selectionchange', onSelChange);
      clearTimeout(tipTimer);
      root.remove();
    },
  };
}

