// Pure helpers that read and rewrite FilmScript text. Every UI action in the editor goes through
// these so the script stays the single source of truth. No DOM here (unit-tested in tests/editor-shell.test.mjs).

export const splitLines = (src) => src.split('\n');

/** Strip a trailing comment / string-aware. Returns the code part of a line (keeps hex colours after "="). */
export function codePart(line) {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '#') {
      const prev = line.slice(0, i).trimEnd();
      if (prev.endsWith('=') && /^#[0-9a-fA-F]{3,8}(?![\w])/.test(line.slice(i))) continue;
      return line.slice(0, i);
    } else if (ch === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

/**
 * Find scene / par / repeat blocks. Lines are 1-based.
 * Returns { scenes: [{id, line, end, props, index}], blocks: [{kind, line, end, depth, parent}] }
 * `end` is the line holding the closing brace (or the last line if it is missing).
 */
export function scanBlocks(src) {
  const lines = splitLines(src);
  const blocks = [];
  const stack = [];
  lines.forEach((raw, li) => {
    const code = codePart(raw);
    let inStr = false;
    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') {
        const head = code.slice(0, i).trim();
        const kw = (/^(scene|par|repeat)\b/.exec(head) || [])[1] || 'block';
        const b = { kind: kw, line: li + 1, end: lines.length, depth: stack.length, parent: stack.length ? stack[stack.length - 1] : null, head };
        blocks.push(b);
        stack.push(b);
      } else if (ch === '}') {
        const b = stack.pop();
        if (b) b.end = li + 1;
      }
    }
  });
  const scenes = blocks.filter((b) => b.kind === 'scene' && b.depth === 0).map((b, index) => {
    const m = /^scene\s+([A-Za-z_][\w.-]*)\s*(.*)$/.exec(b.head) || [];
    const props = {};
    for (const [, k, v] of (m[2] || '').matchAll(/([A-Za-z_][\w.]*)=("[^"]*"|\S+)/g)) props[k] = v.replace(/^"|"$/g, '');
    return { id: m[1] || `scene${index + 1}`, line: b.line, end: b.end, props, index, block: b };
  });
  return { scenes, blocks };
}

/** Scene (from scanBlocks) containing the 1-based line, or null. */
export function sceneAtLine(scan, line) {
  return scan.scenes.find((s) => line >= s.line && line <= s.end) || null;
}

/** If `line` is inside a par/repeat (nested) block, the closing line of the outermost such block, else `line`. */
export function topLevelLine(scan, line) {
  let out = line;
  for (const b of scan.blocks) if (b.depth >= 1 && line >= b.line && line <= b.end) {
    let top = b;
    while (top.parent && top.parent.depth >= 1) top = top.parent;
    out = Math.max(out, top.end);
  }
  return out;
}

const indentOf = (s) => /^\s*/.exec(s)[0];

/** Insert `text` (one or more lines) after 1-based line `after` (0 = very top). Returns { src, line, count }. */
export function insertLines(src, after, text) {
  const lines = splitLines(src);
  const add = text.replace(/\n$/, '').split('\n');
  const at = Math.max(0, Math.min(lines.length, after));
  lines.splice(at, 0, ...add);
  return { src: lines.join('\n'), line: at + 1, count: add.length };
}

/** Indent every line of a snippet with `pad` (snippets are written without indentation). */
export const indent = (text, pad = '  ') => text.replace(/\n$/, '').split('\n').map((l) => (l.trim() ? pad + l : l)).join('\n');

/** Insert statements just before the closing brace of scene #index. */
export function insertAtSceneEnd(src, index, text) {
  const scan = scanBlocks(src);
  const sc = scan.scenes[index];
  if (!sc) return insertLines(src, splitLines(src).length, text);
  const lines = splitLines(src);
  let after = sc.end - 1; // line before "}"
  if (sc.end === sc.line) after = sc.line; // one-line scene: put it after (best effort)
  // skip back over trailing blank lines so new lines sit with the others
  while (after > sc.line && !lines[after - 1].trim()) after--;
  const pad = guessIndent(lines, sc);
  return insertLines(src, after, indent(text, pad));
}

/** Insert statements after the last `cast` (or `prop`) line of scene #index (or right after the scene opens). */
export function insertAfterCasts(src, index, text) {
  const scan = scanBlocks(src);
  const sc = scan.scenes[index];
  if (!sc) return insertLines(src, splitLines(src).length, text);
  const lines = splitLines(src);
  let after = sc.line;
  for (let l = sc.line + 1; l < sc.end; l++) if (/^\s*(cast|prop)\b/.test(lines[l - 1])) after = l;
  return insertLines(src, after, indent(text, guessIndent(lines, sc)));
}

/** Insert after 1-based `line`, matching that line's indentation (used for "at the cursor" mode). */
export function insertAfterLine(src, line, text) {
  const lines = splitLines(src);
  const ref = lines[line - 1] ?? '';
  let pad = indentOf(ref);
  if (/\{\s*$/.test(codePart(ref))) pad += '  ';
  return insertLines(src, line, indent(text, pad));
}

function guessIndent(lines, sc) {
  for (let l = sc.line + 1; l < sc.end; l++) { const s = lines[l - 1]; if (s.trim()) return indentOf(s) || '  '; }
  return '  ';
}

/** Put top-level definitions (voice, character, let) after the film/fade header. */
export function insertAfterHeader(src, text) {
  const lines = splitLines(src);
  let i = lines.findIndex((l) => /^\s*film\s+"/.test(l));
  i = i < 0 ? 0 : i + 1;
  while (i < lines.length && /^\s*(fade|voice|character|let)\b/.test(lines[i])) i++;
  return insertLines(src, i, text);
}

/** Add a new scene at the end of the film (optionally with a transition before it). */
export function appendScene(src, { id, bg, body = '', transition }) {
  let s = src.replace(/\s*$/, '');
  const fadeOut = /\n(fade out [^\n]*)$/.exec(s);
  if (fadeOut) s = s.slice(0, fadeOut.index);
  const t = transition ? `\n\ntransition ${transition}` : '\n';
  const block = `scene ${id} bg=${bg} {\n${body ? indent(body) + '\n' : '  \n'}}`;
  const out = `${s}${t}\n${transition ? '\n' : ''}${block}\n${fadeOut ? '\n' + fadeOut[1] + '\n' : ''}`;
  const line = splitLines(out).findIndex((l) => l.startsWith(`scene ${id} `)) + 1;
  return { src: out, line };
}

/** Quote a string for FilmScript. */
export const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

/** Set or replace key=value on one line (before any trailing "&" or comment). value null removes it. */
export function setProp(line, key, value) {
  const code = codePart(line);
  const comment = line.slice(code.length);
  let body = code.replace(/\s+$/, '');
  let amp = '';
  if (/\s&$/.test(body) || body === '&') { amp = ' &'; body = body.replace(/\s*&$/, ''); }
  const re = new RegExp(`(\\s)${key.replace(/\./g, '\\.')}=("(?:[^"\\\\]|\\\\.)*"|\\S+)`);
  const val = value == null ? null : /^[\w.:#%+-]+$/.test(String(value)) ? String(value) : q(value);
  if (re.test(body)) body = val == null ? body.replace(re, '') : body.replace(re, `$1${key}=${val}`);
  else if (val != null) body += ` ${key}=${val}`;
  return body + amp + (comment ? ' ' + comment.trimStart() : '');
}

/** Rewrite the `at X[,Y]` of a cast line. */
export function setCastAt(line, x, y) {
  const pos = y ? `${round(x)},${round(y)}` : `${round(x)}`;
  if (/\bat\s+-?[\d.]+%?(\s*,\s*-?[\d.]+%?)?/.test(line)) return line.replace(/\bat\s+-?[\d.]+%?(\s*,\s*-?[\d.]+%?)?/, `at ${pos}`);
  const code = codePart(line).replace(/\s+$/, '');
  return `${code} at ${pos}${line.slice(codePart(line).length)}`;
}
const round = (v) => Math.round(v * 10) / 10;

/** Replace one 1-based line. */
export function replaceLine(src, line, text) {
  const lines = splitLines(src);
  if (line < 1 || line > lines.length) return src;
  lines[line - 1] = text;
  return lines.join('\n');
}
export function deleteLine(src, line) {
  const lines = splitLines(src);
  lines.splice(line - 1, 1);
  return lines.join('\n');
}

/** Very small statement classifier for the Inspector. */
export function lineKind(text) {
  const c = codePart(text).trim();
  if (!c) return { kind: text.trim().startsWith('#') || text.trim().startsWith('//') ? 'comment' : 'blank' };
  let m;
  if ((m = /^film\s+"((?:[^"\\]|\\.)*)"/.exec(c))) return { kind: 'film', title: m[1] };
  if ((m = /^scene\s+([\w.-]+)/.exec(c))) return { kind: 'scene', id: m[1] };
  if ((m = /^cast\s+([\w-]+)\s*:\s*([\w-]+)/.exec(c))) return { kind: 'cast', actor: m[1], char: m[2] };
  if ((m = /^([\w-]+)\s*(?::|\s+says)\s*"((?:[^"\\]|\\.)*)"/.exec(c))) return { kind: 'say', actor: m[1], text: m[2].replace(/\\(.)/g, '$1') };
  if ((m = /^(caption|title)\s+"((?:[^"\\]|\\.)*)"/.exec(c))) return { kind: m[1], text: m[2] };
  if ((m = /^transition\s+(\w+)/.exec(c))) return { kind: 'transition', name: m[1] };
  if ((m = /^voice\s+(\w+)\s*=/.exec(c))) return { kind: 'voicedef', name: m[1] };
  if ((m = /^character\s+(\w+)\s+from\s+(\w+)/.exec(c))) return { kind: 'chardef', name: m[1], base: m[2] };
  if (/^camera\b/.test(c)) return { kind: 'camera' };
  if ((m = /^(sfx|music|ambience|effect|wait|at|hold|par|repeat|fade|let|prop)\b/.exec(c))) return { kind: m[1] };
  if ((m = /^([\w-]+)\s+(walks|runs|moves|enters|exits|plays|feels|looks|faces|shows|hides|holds|drops|\w+)\b/.exec(c))) return { kind: 'action', actor: m[1], verb: m[2] };
  return { kind: 'other' };
}

export function filmTitle(src) {
  const m = /^\s*film\s+"((?:[^"\\]|\\.)*)"/m.exec(src);
  return m ? m[1].replace(/\\(.)/g, '$1') : '';
}
export function setFilmTitle(src, title) {
  if (/^\s*film\s+"(?:[^"\\]|\\.)*"/m.test(src)) return src.replace(/^(\s*film\s+)"(?:[^"\\]|\\.)*"/m, `$1${q(title)}`);
  return `film ${q(title)} 1920x1080 @30\n` + src;
}
export const slug = (s) => String(s || 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'film';
export const ident = (s, fallback = 'x') => (String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, '_$1') || fallback);

export function formatTime(t, frac = 2) {
  const s = Math.max(0, t || 0);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(frac).padStart(frac ? 3 + frac : 2, '0')}`;
}

/** A stage position (percent) well away from the ones already used. */
export function freeX(used) {
  const xs = used.slice().sort((a, b) => a - b);
  if (!xs.length) return 50;
  let best = 50, bd = -1;
  for (let x = 15; x <= 85; x += 5) {
    const d = Math.min(...xs.map((u) => Math.abs(u - x)));
    if (d > bd) { bd = d; best = x; }
  }
  return best;
}

/** Unique actor name for a character within a scene. */
export function uniqueName(base, taken) {
  const b = ident(base, 'actor');
  if (!taken.includes(b)) return b;
  for (let i = 2; ; i++) if (!taken.includes(`${b}${i}`)) return `${b}${i}`;
}

// ---- browser voices -> Kokoro ------------------------------------------------------------------

/** Pick a Kokoro voice that matches a browser voice preset (gender / accent / pitch). */
export function kokoroFor(v = {}) {
  const uk = /^en-gb/i.test(v.lang || '');
  const pitch = +v.pitch || 1;
  const rate = +v.rate || 1;
  if (v.gender === 'male') {
    if (uk) return rate < 0.92 ? 'bm_lewis' : 'bm_george';
    if (pitch <= 0.85 && rate < 0.92) return 'bm_daniel';
    if (pitch <= 0.85) return 'am_onyx';
    if (pitch >= 1.1) return 'am_puck';
    return 'am_michael';
  }
  if (v.gender === 'female') {
    if (uk) return rate < 0.92 ? 'bf_alice' : 'bf_emma';
    if (pitch >= 1.4) return 'af_sky';
    if (pitch >= 1.1) return 'af_bella';
    if (rate < 0.92) return 'af_sarah';
    return 'af_heart';
  }
  return uk ? 'bf_emma' : 'af_heart';
}

/**
 * Plan a rewrite of every browser (webspeech) voice in the script to a Kokoro equivalent.
 * assets.voices = presets by id. lines = compile result lines [{voice, text, line}] (optional; used to find
 * dialogue that inherits a character's browser voice). Returns { src, changes: [{line, before, after}] }.
 */
export function switchToKokoro(src, assets, lines = []) {
  const presets = assets.voices || {};
  const L = splitLines(src);
  const defs = {};
  L.forEach((raw, i) => {
    const m = /^(\s*)voice\s+(\w+)\s*=\s*("[^"]*"|\S+)/.exec(codePart(raw));
    if (m) defs[m[2]] = { line: i + 1, spec: m[3].replace(/^"|"$/g, ''), pad: m[1] };
  });
  const browserVoice = (tok, seen = new Set()) => {
    if (!tok) return null;
    if (defs[tok] && !seen.has(tok)) {
      seen.add(tok);
      const base = browserVoice(defs[tok].spec, seen);
      if (!base) return null;
      const props = {};
      for (const [, k, val] of codePart(L[defs[tok].line - 1]).matchAll(/(\w+)=("[^"]*"|\S+)/g)) props[k] = val.replace(/^"|"$/g, '');
      return { ...base, ...props };
    }
    if (presets[tok]) return presets[tok].engine === 'webspeech' ? presets[tok] : null;
    if (/^webspeech(:|$)/.test(tok)) return { engine: 'webspeech', voice: tok.split(':')[1] || 'auto' };
    return null;
  };
  const changes = [];
  const out = L.slice();
  const touch = (i, text) => { if (out[i] !== text) { changes.push({ line: i + 1, before: L[i], after: text }); out[i] = text; } };
  // 1) named voice definitions that are browser voices
  for (const [name, d] of Object.entries(defs)) {
    const v = browserVoice(name);
    if (v) touch(d.line - 1, `${d.pad}voice ${name} = kokoro:${kokoroFor(v)}${+v.rate && +v.rate !== 1 ? ` speed=${v.rate}` : ''}`);
  }
  // 2) inline voice=… that point at browser voices (not at named definitions — those are handled above)
  out.forEach((raw, i) => {
    if (defs[Object.keys(defs).find((k) => defs[k].line === i + 1)]) return;
    const code = codePart(raw);
    const rewritten = code.replace(/(\bvoice=)("[^"]*"|[^\s&]+)/g, (all, pre, tok) => {
      const t = tok.replace(/^"|"$/g, '');
      if (defs[t]) return all;
      const v = browserVoice(t);
      return v ? `${pre}kokoro:${kokoroFor(v)}` : all;
    });
    if (rewritten !== code) touch(i, rewritten + raw.slice(code.length));
  });
  // 3) dialogue that inherits a browser voice from its character: add voice=… to the line
  for (const ln of lines) {
    if (!ln.voice || ln.voice.engine !== 'webspeech') continue;
    const i = ln.line - 1;
    if (i < 0 || i >= out.length || /\bvoice=/.test(codePart(out[i]))) continue;
    touch(i, setProp(out[i], 'voice', `kokoro:${kokoroFor(ln.voice)}`));
  }
  changes.sort((a, b) => a.line - b.line);
  return { src: out.join('\n'), changes };
}
