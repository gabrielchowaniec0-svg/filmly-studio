// FilmScript (.fly) parser: text -> AST. Line oriented, with { } blocks. See docs/FILMSCRIPT.md.

export class FSError extends Error {
  constructor(message, line, col = 0) {
    super(message);
    this.line = line;
    this.col = col;
  }
}

// ---- lexer ----------------------------------------------------------------------------------
export function lex(src, lineNo) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
    const col = i;
    if (ch === '#' && toks.length && toks[toks.length - 1].t === 'sym' && toks[toks.length - 1].v === '=') {
      const hm = /^#[0-9a-fA-F]{3,8}(?![\w])/.exec(src.slice(i));
      if (hm) { toks.push({ t: 'str', v: hm[0], col }); i += hm[0].length; continue; }
    }
    if (ch === '#' || (ch === '/' && src[i + 1] === '/')) break;
    if (ch === '"') {
      let j = i + 1, v = '';
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\' && j + 1 < n) {
          const e = src[j + 1];
          v += e === 'n' ? '\n' : e;
          j += 2;
        } else v += src[j++];
      }
      if (j >= n) throw new FSError('Unterminated string (missing closing ")', lineNo, col);
      toks.push({ t: 'str', v, col });
      i = j + 1;
      continue;
    }
    let m = /^-?\d+(?:\.\d+)?/.exec(src.slice(i));
    if (m) {
      const rest = src.slice(i + m[0].length);
      const u = /^(ms|s|%)(?![A-Za-z0-9_])/.exec(rest);
      toks.push({ t: 'num', v: parseFloat(m[0]), unit: u ? u[1] : '', col });
      i += m[0].length + (u ? u[1].length : 0);
      continue;
    }
    m = /^\$[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (m) { toks.push({ t: 'var', v: m[0].slice(1), col }); i += m[0].length; continue; }
    m = /^[A-Za-z_][A-Za-z0-9_.\-]*(?::[A-Za-z0-9_][A-Za-z0-9_.\-]*)*/.exec(src.slice(i));
    if (m) { toks.push({ t: 'id', v: m[0], col }); i += m[0].length; continue; }
    if ('{}:=,&@'.includes(ch)) { toks.push({ t: 'sym', v: ch, col }); i++; continue; }
    throw new FSError(`Unexpected character "${ch}"`, lineNo, col);
  }
  return toks;
}

class Toks {
  constructor(toks, line, env) { this.toks = toks; this.i = 0; this.line = line; this.env = env; }
  get done() { return this.i >= this.toks.length; }
  peek(o = 0) { return this.toks[this.i + o]; }
  next() { return this.toks[this.i++]; }
  err(msg, tok = this.peek() || this.toks[this.toks.length - 1]) { return new FSError(msg, this.line, tok ? tok.col : 0); }
  isId(v, o = 0) { const t = this.peek(o); return t && t.t === 'id' && (v === undefined || t.v === v); }
  isSym(v, o = 0) { const t = this.peek(o); return t && t.t === 'sym' && t.v === v; }
  acceptId(v) { if (this.isId(v)) return this.next(); return null; }
  acceptSym(v) { if (this.isSym(v)) return this.next(); return null; }
  expectId(what) {
    const t = this.resolve(this.next());
    if (!t || (t.t !== 'id' && t.t !== 'str')) throw this.err(`Expected ${what}`, t);
    return t.v;
  }
  expectSym(v) { const t = this.next(); if (!t || t.t !== 'sym' || t.v !== v) throw this.err(`Expected "${v}"`, t); return t; }
  resolve(t) {
    if (t && t.t === 'var') {
      if (!(t.v in this.env)) throw this.err(`Unknown variable $${t.v} (declare it with: let ${t.v} = ...)`, t);
      return this.env[t.v];
    }
    return t;
  }
  value(what = 'a value') {
    const t = this.resolve(this.next());
    if (!t) throw this.err(`Expected ${what}`);
    return t;
  }
  string(what = 'a "quoted string"') {
    const t = this.value(what);
    if (t.t !== 'str') throw this.err(`Expected ${what}`, t);
    return t.v;
  }
  number(what = 'a number') {
    const t = this.value(what);
    if (t.t !== 'num') throw this.err(`Expected ${what}`, t);
    return t.v;
  }
  /** duration in seconds: 2s, 500ms, 1.5 */
  duration(what = 'a duration like 2s') {
    const t = this.value(what);
    if (t.t !== 'num') throw this.err(`Expected ${what}`, t);
    return t.unit === 'ms' ? t.v / 1000 : t.v;
  }
  /** key=value pairs until end of line (or &). */
  props() {
    const out = {};
    while (!this.done && this.isId() && this.isSym('=', 1)) {
      const k = this.next().v;
      this.next();
      const v = this.value();
      out[k] = v.t === 'num' ? (v.unit === 'ms' ? v.v / 1000 : v.v) : v.v;
    }
    return out;
  }
  concurrent() { return !!this.acceptSym('&'); }
  end() {
    if (!this.done) throw this.err(`Unexpected "${this.peek().v}" — did you mean something else here?`);
  }
}

// ---- statements -----------------------------------------------------------------------------
const ALIAS = {
  waves: 'wave', jumps: 'jump', shrugs: 'shrug', nods: 'nod', cheers: 'cheer', gestures: 'talk', points: 'point', thinks: 'think',
  claps: 'clap', laughs: 'laugh', bows: 'bow', dances: 'dance', facepalms: 'facepalm', gasps: 'surprised', sulks: 'sad_slump',
};
const ACTOR_VERBS = ['walks', 'runs', 'moves', 'enters', 'exits', 'faces', 'looks', 'plays', 'feels', 'idles', 'shows', 'hides', 'says', ...Object.keys(ALIAS)];

function parseTarget(T) {
  // "60", "60,10", "25%", or an actor name
  const t = T.resolve(T.peek());
  if (t && t.t === 'num') {
    T.next();
    let y;
    if (T.acceptSym(',')) y = T.number('a depth 0-100');
    return { x: t.v, y };
  }
  if (t && t.t === 'id') { T.next(); return { actor: t.v }; }
  throw T.err('Expected a position (like 60 or 60,10) or another actor name');
}

function parseActorStatement(T, actorTok) {
  const actor = actorTok.v;
  const verbTok = T.next();
  if (!verbTok || verbTok.t !== 'id') throw T.err(`Expected what ${actor} does (e.g. walks to 50, plays wave, "says ...")`, verbTok || actorTok);
  const verb = verbTok.v;
  let node;
  switch (verb) {
    case 'says': {
      const text = T.string();
      const props = T.props();
      node = { kind: 'say', actor, text, props, concurrent: T.concurrent() };
      break;
    }
    case 'walks': case 'runs': case 'moves': {
      T.acceptId('to');
      const target = parseTarget(T);
      let dur, speed;
      const props = {};
      while (!T.done && !T.isSym('&')) {
        if (T.acceptId('over') || T.acceptId('in')) dur = T.duration();
        else if (T.isId() && T.isSym('=', 1)) Object.assign(props, T.props());
        else break;
      }
      node = { kind: 'move', actor, mode: verb, target, dur, props, concurrent: T.concurrent() };
      break;
    }
    case 'enters': {
      let from = 'left', dur;
      while (!T.done && !T.isSym('&')) {
        if (T.acceptId('from')) from = T.expectId('left or right');
        else if (T.acceptId('over')) dur = T.duration();
        else break;
      }
      node = { kind: 'enter', actor, from, dur, concurrent: T.concurrent() };
      break;
    }
    case 'exits': {
      let to = 'right', dur;
      while (!T.done && !T.isSym('&')) {
        if (T.acceptId('to')) to = T.expectId('left or right');
        else if (T.acceptId('over')) dur = T.duration();
        else break;
      }
      node = { kind: 'exit', actor, to, dur, concurrent: T.concurrent() };
      break;
    }
    case 'faces': {
      const w = T.expectId('left, right, or an actor name');
      node = { kind: 'face', actor, dir: w };
      break;
    }
    case 'plays': {
      const clip = T.expectId('an animation clip name (e.g. wave, walk)');
      let dur, speed, loop = false;
      const props = {};
      while (!T.done && !T.isSym('&')) {
        if (T.acceptId('for')) dur = T.duration();
        else if (T.acceptId('loop')) loop = true;
        else if (T.isId() && T.isSym('=', 1)) Object.assign(props, T.props());
        else break;
      }
      node = { kind: 'play', actor, clip, dur, loop, props, concurrent: T.concurrent() };
      break;
    }
    case 'looks': {
      T.acceptId('at');
      const w = T.expectId('left, right, up, down, camera, around, away, or an actor name');
      if (w === 'around') { node = { kind: 'play', actor, clip: 'look_around', loop: false, props: {}, concurrent: T.concurrent() }; break; }
      node = { kind: 'look', actor, target: w === 'away' ? 'center' : w === 'forward' ? 'center' : w };
      break;
    }
    case 'feels': {
      node = { kind: 'mood', actor, mood: T.expectId('a mood (neutral, happy, joy, sad, angry, surprised)') };
      break;
    }
    case 'idles': node = { kind: 'play', actor, clip: 'idle', loop: true, props: {}, concurrent: false }; break;
    case 'shows': node = { kind: 'show', actor }; break;
    case 'hides': node = { kind: 'hide', actor }; break;
    default:
      if (ALIAS[verb]) {
        let dur;
        if (T.acceptId('for')) dur = T.duration();
        node = { kind: 'play', actor, clip: ALIAS[verb], dur, loop: false, props: {}, concurrent: T.concurrent() };
      } else {
        throw T.err(`Unknown action "${verb}" for ${actor}. Try: ${ACTOR_VERBS.slice(0, 12).join(', ')}…`, verbTok);
      }
  }
  T.end();
  return node;
}

function parseStatement(T, ctx) {
  const first = T.peek();
  if (first.t !== 'id') throw T.err('A statement must start with a word (e.g. scene, cast, wait) or an actor name', first);

  // dialogue shorthand:  mira: "Hello"  [voice=x] [&]
  if (T.isSym(':', 1) && T.peek(2) && (T.peek(2).t === 'str' || T.peek(2).t === 'var')) {
    const actor = T.next().v;
    T.next();
    const text = T.string();
    const props = T.props();
    const node = { kind: 'say', actor, text, props, concurrent: T.concurrent() };
    T.end();
    return node;
  }

  const kw = first.v;
  switch (kw) {
    case 'let': {
      T.next();
      const name = T.expectId('a variable name');
      T.expectSym('=');
      const v = T.value();
      T.end();
      T.env[name] = v;
      return { kind: 'let', name };
    }
    case 'voice': {
      T.next();
      const name = T.expectId('a voice name');
      T.expectSym('=');
      const spec = T.value('a voice like openai:coral');
      if (spec.t !== 'id' && spec.t !== 'str') throw T.err('Expected a voice like openai:coral or elevenlabs:<voice id>');
      const props = T.props();
      T.end();
      return { kind: 'voicedef', name, spec: spec.v, props };
    }
    case 'character': {
      T.next();
      const name = T.expectId('a new character id');
      if (!T.acceptId('from')) throw T.err('Use: character <new-id> from <existing-character> key=value ...');
      const base = T.expectId('an existing character id');
      const props = T.props();
      T.end();
      return { kind: 'chardef', name, base, props };
    }
    case 'cast': {
      T.next();
      let name = T.expectId('an actor name');
      let char;
      if (name.includes(':')) [name, char] = name.split(':');
      else { T.expectSym(':'); char = T.expectId('a character id'); }
      if (char.startsWith('char.')) char = char.slice(5);
      let at = { x: 50 };
      const props = {};
      let hidden = false;
      while (!T.done) {
        if (T.acceptId('at')) at = parseTarget(T);
        else if (T.acceptId('hidden')) hidden = true;
        else if (T.isId() && T.isSym('=', 1)) Object.assign(props, T.props());
        else throw T.err(`Unexpected "${T.peek().v}" in cast line`);
      }
      if (at.actor) throw T.err('Cast position must be a number like "at 30" (percent of stage width)');
      return { kind: 'cast', name, char, x: at.x, y: at.y ?? 0, hidden, props };
    }
    case 'wait': { T.next(); const dur = T.duration(); T.end(); return { kind: 'wait', dur }; }
    case 'at': { T.next(); const t = T.duration(); T.end(); return { kind: 'at', t }; }
    case 'hold': { T.next(); const dur = T.duration(); T.end(); return { kind: 'hold', dur }; }
    case 'caption': case 'title': {
      T.next();
      const text = T.string();
      let dur;
      if (!T.done && T.peek().t === 'num') dur = T.duration();
      const props = T.props();
      if (kw === 'title') props.style = 'title';
      const node = { kind: 'caption', text, dur, props, concurrent: T.concurrent() };
      T.end();
      return node;
    }
    case 'camera': {
      T.next();
      let dur = 1;
      const props = {};
      while (!T.done && !T.isSym('&')) {
        if (T.acceptId('over')) dur = T.duration();
        else if (T.isId() && T.isSym('=', 1)) Object.assign(props, T.props());
        else throw T.err(`Unexpected "${T.peek().v}" in camera line (use zoom= x= y= over 2s)`);
      }
      const node = { kind: 'camera', dur, props, concurrent: T.concurrent() };
      T.end();
      return node;
    }
    case 'music': case 'sfx': {
      T.next();
      const src = T.string('a "path/to/audio.mp3" string');
      const props = T.props();
      T.end();
      return { kind: kw, src, props };
    }
    case 'transition': {
      T.next();
      const name = T.expectId('a transition name (e.g. fade, wipe_left)');
      const dur = T.done ? 1 : T.duration();
      T.end();
      return { kind: 'transition', name, dur };
    }
    case 'fade': {
      T.next();
      const dir = T.expectId('"in" or "out"');
      if (dir !== 'in' && dir !== 'out') throw T.err('Use "fade in 1s" or "fade out 1s"');
      const dur = T.done ? 1 : T.duration();
      T.end();
      return { kind: 'fade', dir, dur };
    }
    default:
      return parseActorStatement(T, T.next());
  }
}

/** Parse FilmScript source. Returns { ast, errors } where ast = {film, items[]} */
export function parse(source) {
  const errors = [];
  const env = {};
  const root = { kind: 'root', film: null, items: [] };
  const stack = [{ node: root, body: root.items, closer: null }];
  const lines = source.split('\n');

  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1;
    const raw = lines[li];
    try {
      const filmM = /^\s*film\s+"((?:[^"\\]|\\.)*)"\s+(\d+)\s*x\s*(\d+)(?:\s+@\s*(\d+(?:\.\d+)?))?\s*(?:#.*|\/\/.*)?$/.exec(raw);
      if (filmM) {
        if (root.film) throw new FSError('Only one "film" line is allowed', lineNo);
        root.film = { title: filmM[1], width: +filmM[2], height: +filmM[3], fps: filmM[4] ? +filmM[4] : 30, line: lineNo };
        continue;
      }
      if (/^\s*film\b/.test(raw)) throw new FSError('Expected: film "Title" 1920x1080 @60', lineNo);

      const all = lex(raw, lineNo);
      if (!all.length) continue;
      // split at braces so one-liners like `repeat 3 { wait 1s }` work
      const segments = [];
      let curSeg = [];
      for (const tk of all) {
        if (tk.t === 'sym' && tk.v === '{') { curSeg.push(tk); segments.push(curSeg); curSeg = []; }
        else if (tk.t === 'sym' && tk.v === '}') { if (curSeg.length) segments.push(curSeg); segments.push([tk]); curSeg = []; }
        else curSeg.push(tk);
      }
      if (curSeg.length) segments.push(curSeg);

      for (const toks of segments) {
        // close block
        if (toks.length === 1 && toks[0].t === 'sym' && toks[0].v === '}') {
          if (stack.length === 1) throw new FSError('Unexpected "}" with no open block', lineNo, toks[0].col);
          stack.pop();
          continue;
        }
        const opens = toks[toks.length - 1].t === 'sym' && toks[toks.length - 1].v === '{';
        const body = opens ? toks.slice(0, -1) : toks;
        const T = new Toks(body, lineNo, env);
        const top = stack[stack.length - 1];

        if (opens) {
          const kw = body[0] && body[0].t === 'id' ? body[0].v : '';
          let node;
          if (kw === 'scene') {
            if (stack.length > 1) throw new FSError('Scenes cannot be nested', lineNo);
            T.next();
            const id = T.expectId('a scene id');
            const props = T.props();
            T.end();
            node = { kind: 'scene', id, props, body: [], line: lineNo };
          } else if (kw === 'par') {
            T.next(); T.end();
            node = { kind: 'par', body: [], line: lineNo };
          } else if (kw === 'repeat') {
            T.next();
            const count = T.number('a repeat count');
            T.end();
            if (!Number.isInteger(count) || count < 1 || count > 1000) throw new FSError('repeat count must be a whole number 1-1000', lineNo);
            node = { kind: 'repeat', count, body: [], line: lineNo };
          } else throw new FSError(`"${kw}" can't open a { block } (only scene, par, repeat can)`, lineNo);
          top.body.push(node);
          stack.push({ node, body: node.body });
          continue;
        }

        const node = parseStatement(T, stack);
        node.line = lineNo;
        if (node.kind === 'let') continue;
        if (node.kind === 'cast' || node.kind === 'transition' || node.kind === 'fade' || node.kind === 'voicedef' || node.kind === 'chardef') {
          if (node.kind === 'cast' && top.node.kind !== 'scene') throw new FSError('"cast" must be inside a scene { }', lineNo);
          if (node.kind !== 'cast' && stack.length > 1) throw new FSError(`"${node.kind}" must be between scenes, not inside one`, lineNo);
        } else if (stack.length === 1) {
          throw new FSError(`"${raw.trim().split(/\s+/)[0]}" must be inside a scene { }`, lineNo);
        }
        top.body.push(node);
      }
    } catch (e) {
      if (e instanceof FSError) errors.push({ line: e.line || lineNo, col: e.col || 0, message: e.message, severity: 'error' });
      else throw e;
    }
  }
  if (stack.length > 1) {
    const open = stack[stack.length - 1].node;
    errors.push({ line: open.line, col: 0, message: `Missing "}" to close this ${open.kind} block`, severity: 'error' });
  }
  if (!root.film && !errors.length) errors.push({ line: 1, col: 0, message: 'Start your file with: film "Title" 1920x1080 @60', severity: 'error' });
  return { ast: root, errors };
}
