// Fallback script editor: a <textarea> with a line gutter, diagnostics and its own undo history.
// Same API as src/editor/code/code-editor.js so the shell can use either.

export function createPlainEditor(container, { value = '', onChange, onCursor, readOnly = false } = {}) {
  const root = document.createElement('div');
  root.className = 'plainEditor';
  root.innerHTML = '<div class="pe-gutter mono" aria-hidden="true"></div><textarea class="pe-text mono" spellcheck="false" wrap="off" aria-label="FilmScript"></textarea>';
  container.appendChild(root);
  const ta = root.querySelector('textarea');
  const gutter = root.querySelector('.pe-gutter');
  ta.id = 'editor';
  ta.value = value;
  ta.readOnly = !!readOnly;
  let diags = [];
  const LH = 20;

  // history: snapshots of {text, a, b}; typing within 700 ms coalesces
  const hist = [{ text: value, a: 0, b: 0 }];
  let hi = 0, lastPush = 0;
  const snap = (force) => {
    const now = performance.now();
    const s = { text: ta.value, a: ta.selectionStart, b: ta.selectionEnd };
    if (s.text === hist[hi].text) return;
    if (!force && now - lastPush < 700 && hi === hist.length - 1 && hi > 0) hist[hi] = s;
    else { hist.splice(hi + 1); hist.push(s); hi = hist.length - 1; if (hist.length > 300) { hist.shift(); hi--; } }
    lastPush = force ? 0 : now;
  };
  const restore = (s) => { ta.value = s.text; ta.setSelectionRange(s.a, s.b); renderGutter(); onChange && onChange(ta.value); cursor(); };

  const lineOf = (pos) => ta.value.slice(0, pos).split('\n').length;
  const cursor = () => onCursor && onCursor(lineOf(ta.selectionStart));
  function renderGutter() {
    const n = ta.value.split('\n').length;
    const by = new Map();
    for (const d of diags) if (!by.has(d.line) || d.severity === 'error') by.set(d.line, d);
    let html = '';
    for (let i = 1; i <= n; i++) {
      const d = by.get(i);
      html += d ? `<div class="ln ${d.severity}" title="${d.message.replace(/"/g, '&quot;')}">${i}</div>` : `<div class="ln">${i}</div>`;
    }
    gutter.innerHTML = html;
    gutter.scrollTop = ta.scrollTop;
  }
  ta.addEventListener('input', () => { snap(false); renderGutter(); onChange && onChange(ta.value); cursor(); });
  ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
  ['click', 'keyup', 'select'].forEach((ev) => ta.addEventListener(ev, cursor));
  ta.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? api.redo() : api.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); api.redo(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      snap(true);
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // keep indentation (and indent after "{")
      const pos = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
      const cur = ta.value.slice(lineStart, pos);
      let pad = /^\s*/.exec(cur)[0];
      if (/\{\s*$/.test(cur)) pad += '  ';
      e.preventDefault();
      snap(true);
      ta.setRangeText('\n' + pad, pos, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });

  const posOfLine = (n) => { const ls = ta.value.split('\n'); let p = 0; for (let i = 0; i < n - 1 && i < ls.length; i++) p += ls[i].length + 1; return { p, len: (ls[n - 1] || '').length }; };
  const api = {
    element: root,
    getValue: () => ta.value,
    setValue(text, { keepHistory = true } = {}) {
      if (text === ta.value) return;
      const a = ta.selectionStart;
      if (keepHistory) snap(true);
      ta.value = text;
      ta.setSelectionRange(Math.min(a, text.length), Math.min(a, text.length));
      if (keepHistory) snap(true);
      else { hist.length = 0; hist.push({ text, a: 0, b: 0 }); hi = 0; }
      renderGutter();
    },
    focus: () => ta.focus(),
    goto(line, { select = true, focus = true } = {}) {
      const { p, len } = posOfLine(line);
      if (focus) ta.focus({ preventScroll: true });
      ta.setSelectionRange(p, select ? p + len : p);
      const top = (line - 1) * LH;
      if (top < ta.scrollTop + LH || top > ta.scrollTop + ta.clientHeight - 3 * LH) ta.scrollTop = Math.max(0, top - ta.clientHeight / 3);
      cursor();
    },
    getCursorLine: () => lineOf(ta.selectionStart),
    getSelection: () => ta.value.slice(ta.selectionStart, ta.selectionEnd),
    insert(text, mode = 'cursor') {
      snap(true);
      let pos = ta.selectionStart, end = ta.selectionEnd;
      const v = ta.value;
      if (mode === 'line-start') { pos = end = v.lastIndexOf('\n', pos - 1) + 1; }
      else if (mode === 'line-end') { const e2 = v.indexOf('\n', pos); pos = end = e2 < 0 ? v.length : e2; }
      else if (mode === 'top') { pos = end = 0; }
      ta.setRangeText(text, pos, end, 'end');
      snap(true);
      renderGutter();
      onChange && onChange(ta.value);
    },
    setDiagnostics(list) { diags = list || []; renderGutter(); },
    undo() { snap(true); if (hi > 0) { hi--; restore(hist[hi]); } },
    redo() { if (hi < hist.length - 1) { hi++; restore(hist[hi]); } },
    destroy() { root.remove(); },
  };
  renderGutter();
  return api;
}
