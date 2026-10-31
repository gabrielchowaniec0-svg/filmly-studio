// FilmScript AST -> film JSON (plain data the renderer and audio mixer consume).
import { FSError } from './parse.js';
import { estimateSpeechDuration } from '../engine/lipsync.js';
import { MOODS, STAGE_W } from '../engine/timeline.js';
import { resolveBuild } from '../engine/rig.js';
import { TRANSITIONS } from '../assets/transitions/index.js';
import { EFFECTS, EFFECT_ALIASES } from '../assets/effects/index.js';
import { PROP_GRAB } from '../engine/timeline.js';
import { PROVIDERS, parseVoiceSpec, needsAudio, DEFAULT_VOICE } from '../tts/catalog.js';

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function suggest(word, options) {
  let best = null, bd = 99;
  for (const o of options) {
    const dist = lev(word.toLowerCase(), o.toLowerCase());
    if (dist < bd) { bd = dist; best = o; }
  }
  return best && bd <= Math.max(2, Math.floor(word.length / 3)) ? ` Did you mean "${best}"?` : '';
}
const list = (xs) => xs.slice(0, 12).join(', ') + (xs.length > 12 ? ', …' : '');

/**
 * assets: { rigs, characters, scenes, voices } (voices keyed by id)
 * opts: { audioDuration?: (path) => seconds | null, lineAudio?: (voice, text) => {duration, env} | null }
 * Result: { film, errors, warnings, lines:[{voice, text, line}] }  (lines = every spoken line, for TTS generation)
 */
export function compile(ast, assets, opts = {}) {
  const errors = [];
  const warnings = [];
  const err = (line, message, col = 0) => errors.push({ line, col, message, severity: 'error' });
  const warn = (line, message) => warnings.push({ line, col: 0, message, severity: 'warning' });
  const uses = { characters: new Set(), scenes: new Set(), voices: new Set(), audio: new Set(), props: new Set() };

  const meta = ast.film;
  if (!meta) return { film: null, errors, warnings };
  const aspect = meta.width / meta.height;
  if (Math.abs(aspect - 16 / 9) > 0.01) err(meta.line, `Only 16:9 films are supported for now (got ${meta.width}x${meta.height}). Try 1920x1080, 2560x1440, 3840x2160, 7680x4320.`);
  if (meta.fps < 1 || meta.fps > 480) err(meta.line, 'fps must be between 1 and 480');

  const film = { meta: { title: meta.title, width: meta.width, height: meta.height, fps: meta.fps }, fadeIn: 0, fadeOut: 0, scenes: [], duration: 0, characters: {} };
  const lines = [];
  const voiceDefs = {};
  let pending = null;
  const rigFor = (charObj) => assets.rigs[charObj.rig];
  const charOf = (id) => film.characters[id] || assets.characters[id];
  const allCharIds = () => [...new Set([...Object.keys(film.characters), ...Object.keys(assets.characters)])];

  for (const item of ast.items) {
    try {
      if (item.kind === 'voicedef') defineVoice(item);
      else if (item.kind === 'chardef') defineCharacter(item);
      else if (item.kind === 'fade') { if (item.dir === 'in') film.fadeIn = item.dur; else film.fadeOut = item.dur; }
      else if (item.kind === 'transition') {
        if (!TRANSITIONS[item.name]) throw new FSError(`Unknown transition "${item.name}".${suggest(item.name, Object.keys(TRANSITIONS))} Available: ${list(Object.keys(TRANSITIONS))}`, item.line);
        if (film.scenes.length === 0) warn(item.line, 'A transition before the first scene is ignored (use "fade in 1s" to fade up from black)');
        pending = item;
      } else if (item.kind === 'scene') {
        film.scenes.push(compileScene(item, pending));
        pending = null;
      }
    } catch (e) {
      if (e instanceof FSError) err(e.line || item.line, e.message, e.col);
      else throw e;
    }
  }
  if (pending) warn(pending.line, 'This transition has no scene after it');
  if (!film.scenes.length && !errors.length) err(meta.line, 'This film has no scenes yet. Add: scene intro bg=studio { ... }');

  // timing: each scene starts when the previous one's last `d` seconds begin to overlap
  let start = 0;
  film.scenes.forEach((s, i) => {
    if (i > 0) {
      const prev = film.scenes[i - 1];
      if (s.transitionIn) s.transitionIn.dur = Math.max(0.05, Math.min(s.transitionIn.dur, prev.duration * 0.9, s.duration * 0.9));
      start = prev.start + prev.duration - (s.transitionIn ? s.transitionIn.dur : 0);
    }
    s.start = start;
  });
  const last = film.scenes[film.scenes.length - 1];
  film.duration = last ? last.start + last.duration : 0;
  film.uses = Object.fromEntries(Object.entries(uses).map(([k, v]) => [k, [...v]]));
  return { film: errors.length ? null : film, errors, warnings, lines };

  // ------------------------------------------------------------------------------------------
  function resolveVoice(ref, line) {
    if (ref && typeof ref === 'object') return ref;
    if (voiceDefs[ref]) return voiceDefs[ref];
    if (assets.voices[ref]) return { id: ref, ...assets.voices[ref] };
    const spec = parseVoiceSpec(ref);
    if (spec) return { id: ref, ...spec };
    const names = [...Object.keys(voiceDefs), ...Object.keys(assets.voices)];
    const provHint = String(ref).includes(':') ? ` Providers: ${list(Object.keys(PROVIDERS))}.` : '';
    throw new FSError(`Unknown voice "${ref}".${suggest(String(ref), names)} Use a provider voice like openai:coral, or one of: ${list(names)}.${provHint}`, line);
  }
  function defineVoice(it) {
    if (voiceDefs[it.name]) throw new FSError(`Voice "${it.name}" is already defined`, it.line);
    const base = resolveVoice(it.spec, it.line);
    const meta = PROVIDERS[base.engine];
    const v = { ...base, id: it.name, name: it.name };
    for (const [k, val] of Object.entries(it.props)) {
      if (meta && !meta.params.some((p) => p.key === k)) {
        throw new FSError(`"${k}" isn't an option for ${meta.label} voices.${suggest(k, meta.params.map((p) => p.key))} Options: ${meta.params.map((p) => p.key).join(', ') || '(none)'}`, it.line);
      }
      v[k] = val;
    }
    voiceDefs[it.name] = v;
  }
  function defineCharacter(it) {
    if (film.characters[it.name] || assets.characters[it.name]) throw new FSError(`Character "${it.name}" already exists — pick a new id`, it.line);
    const base = charOf(it.base);
    if (!base) throw new FSError(`Unknown character "${it.base}".${suggest(it.base, allCharIds())} Available: ${list(allCharIds())}`, it.line);
    const rig = rigFor(base);
    const c = JSON.parse(JSON.stringify(base));
    c.id = it.name;
    c.name = it.props.name || it.name;
    for (const [k, val] of Object.entries(it.props)) {
      if (k === 'name') continue;
      if (k === 'build') {
        if (!rig.builds?.[val]) throw new FSError(`Unknown build "${val}".${suggest(String(val), Object.keys(rig.builds || {}))} Builds: ${list(Object.keys(rig.builds || {}))}`, it.line);
        c.build = val;
      } else if (k === 'scale') c.scale = +val;
      else if (k === 'voice') c.voice = resolveVoice(String(val), it.line);
      else if (k.startsWith('color.')) {
        const key = k.slice(6);
        if (!(rig.palette || []).includes(key)) throw new FSError(`Unknown color "${key}".${suggest(key, rig.palette || [])} Colors: ${list(rig.palette || [])}`, it.line);
        if (!/^#[0-9a-fA-F]{3,8}$/.test(String(val))) throw new FSError(`Colors look like #ff8800 (got "${val}")`, it.line);
        c.palette[key] = val;
      } else if (rig.slots[k]) {
        if (!rig.slots[k].options.includes(val)) throw new FSError(`"${val}" isn't a ${k} option.${suggest(String(val), rig.slots[k].options)} Options: ${list(rig.slots[k].options)}`, it.line);
        c.options[k] = val;
      } else {
        const keys = [...Object.keys(rig.slots), 'build', 'scale', 'voice', 'name', ...(rig.palette || []).map((p) => 'color.' + p)];
        throw new FSError(`Unknown character setting "${k}".${suggest(k, keys)} Try: ${list(keys)}`, it.line);
      }
    }
    film.characters[it.name] = c;
    uses.characters.add(it.base);
  }

  // ------------------------------------------------------------------------------------------
  function compileScene(sc, transition) {
    const bgId = sc.props.bg;
    if (!bgId) throw new FSError(`Scene "${sc.id}" needs a background: scene ${sc.id} bg=studio { ... }`, sc.line);
    const bg = assets.scenes[bgId];
    if (!bg) throw new FSError(`Unknown background "${bgId}".${suggest(String(bgId), Object.keys(assets.scenes))} Available: ${list(Object.keys(assets.scenes))}`, sc.line);
    uses.scenes.add(bgId);

    const cast = {};
    const castOrder = [];
    const touched = new Set();
    const pos = {}; // known x/y per actor (stage px / depth) as authored
    const holding = {}; // prop -> {actor, hand}
    const hands = {}; // actor+hand -> prop
    const events = [];
    let now = 0, maxEnd = 0;

    const sceneProps = {}; // prop name -> placed prop (shares the actor namespace)
    const propOrder = [];
    const need = (name, line, allowProp = false) => {
      if (!cast[name]) {
        if (sceneProps[name]) {
          if (allowProp) return null;
          throw new FSError(`"${name}" is a prop, not an actor. Props can move, show and hide (${name} moves to 60), or be held (<actor> holds ${name}).`, line);
        }
        throw new FSError(`Unknown actor "${name}" in scene "${sc.id}".${suggest(name, [...castOrder, ...propOrder])} Cast them first: cast ${name}: <character> at 50`, line);
      }
      return cast[name];
    };
    const rigOf = (name) => assets.rigs[charOf(cast[name].char).rig];
    // Natural pace (stage px/s) of a movement clip for this actor: clip.speed is for a regular build at scale 1,
    // so scale it by leg length (build), character/cast scale and depth to keep the feet planted.
    const paceOf = (name, clip, y = 0) => {
      const rig = rigOf(name), ch = charOf(cast[name].char);
      let legs = 1;
      const bone = (id) => rig.bones?.find((b) => b.id === id);
      if (bone('shinN') && bone('footN')) {
        const bd = resolveBuild(rig, ch);
        const len = (id) => bone(id).pos[1] + (bd[id]?.dpos?.[1] || 0);
        legs = (len('shinN') + len('footN')) / (bone('shinN').pos[1] + bone('footN').pos[1]);
      }
      return (clip?.speed || 190) * legs * (ch.scale || 1) * (cast[name].scale || 1) * (1 + (y || 0) * 0.002);
    };
    let curLine = 0; // source line of the statement being compiled (events carry it so the editor can jump back)
    const push = (e, end) => { if (e.line == null && curLine) e.line = curLine; events.push(e); maxEnd = Math.max(maxEnd, end ?? e.t); };
    const advance = (it, dur) => { if (!it.concurrent) now += dur; maxEnd = Math.max(maxEnd, now); };

    run(sc.body);

    function run(items) {
      for (const it of items) {
        try { curLine = it.line; exec(it); } catch (e) {
          if (e instanceof FSError) err(e.line || it.line, e.message, e.col); else throw e;
        }
      }
    }

    function exec(it) {
      switch (it.kind) {
        case 'cast': {
          if (sceneProps[it.name]) throw new FSError(`"${it.name}" is already a prop in this scene — pick another name`, it.line);
          if (cast[it.name]) throw new FSError(`Actor "${it.name}" is already cast in this scene`, it.line);
          const char = charOf(it.char);
          if (!char) throw new FSError(`Unknown character "${it.char}".${suggest(it.char, allCharIds())} Available: ${list(allCharIds())}`, it.line);
          if (assets.characters[it.char]) uses.characters.add(it.char);
          const x = (it.x / 100) * STAGE_W;
          const facing = it.props.facing || (it.x > 50 ? 'left' : 'right');
          if (facing !== 'left' && facing !== 'right') throw new FSError('facing must be left or right', it.line);
          cast[it.name] = { char: it.char, x, y: it.y, facing, hidden: it.hidden, scale: it.props.scale, line: it.line };
          castOrder.push(it.name);
          pos[it.name] = { x, y: it.y };
          if (it.props.mood) events.push({ type: 'mood', t: 0, actor: it.name, mood: checkMood(it.props.mood, it.line), line: it.line });
          break;
        }
        case 'say': {
          const a = need(it.actor, it.line);
          const char = charOf(a.char);
          const voice = resolveVoice(it.props.voice || char.voice || DEFAULT_VOICE, it.line);
          uses.voices.add(voice.id || `${voice.engine}:${voice.voice}`);
          const audio = it.props.audio;
          if (audio) uses.audio.add(audio);
          let dur = it.props.for, env = null;
          if (dur == null && audio && opts.audioDuration) dur = opts.audioDuration(audio);
          if (dur == null && !audio && needsAudio(voice) && opts.lineAudio) {
            const info = opts.lineAudio(voice, it.text);
            if (info) { dur = info.duration; env = info.env || null; }
          }
          if (dur == null) dur = estimateSpeechDuration(it.text, +(voice.speed || voice.rate) || 1);
          if (!audio) lines.push({ voice, text: it.text, line: it.line });
          const mood = it.props.mood ? checkMood(it.props.mood, it.line) : null;
          if (mood) push({ type: 'mood', t: now, actor: it.actor, mood });
          if (it.props.gesture && !rigOf(it.actor).clips[it.props.gesture]) throw new FSError(`Unknown gesture "${it.props.gesture}".${suggest(String(it.props.gesture), Object.keys(rigOf(it.actor).clips))}`, it.line);
          push({ type: 'say', t: now, actor: it.actor, text: it.text, dur, voice, env, audio: audio || null, still: !!it.props.still, gesture: it.props.gesture || null, energy: it.props.energy != null ? +it.props.energy : undefined }, now + dur);
          touched.add(it.actor);
          advance(it, dur + (it.props.gap ?? 0.15));
          break;
        }
        case 'look': {
          need(it.actor, it.line);
          const ok = ['left', 'right', 'up', 'down', 'camera', 'center', 'auto'];
          if (!ok.includes(it.target)) need(it.target, it.line, true);
          push({ type: 'look', t: now, actor: it.actor, target: it.target });
          break;
        }
        case 'move': {
          if (sceneProps[it.actor]) { propMove(it); break; }
          const a = need(it.actor, it.line);
          const from = pos[it.actor];
          let tx, ty = it.target.y ?? from.y;
          if (it.target.actor) {
            const o = need(it.target.actor, it.line, true);
            const ox = pos[it.target.actor].x;
            const dir = Math.sign(ox - from.x) || 1;
            tx = ox - dir * (o ? 150 : 70) * (charOf(a.char).scale || 1);
            ty = it.target.y ?? pos[it.target.actor].y;
          } else tx = (it.target.x / 100) * STAGE_W;
          let clipId = it.mode === 'runs' ? 'run' : it.mode === 'walks' ? 'walk' : null;
          if (it.props.style != null) {
            // style=<any base movement clip>: sneak, stroll, march, tiptoe, jog, sprint, ...
            const clips = rigOf(it.actor).clips;
            const style = String(it.props.style);
            const styles = Object.keys(clips).filter((k) => clips[k].speed && !clips[k].overlay);
            if (!clips[style]) throw new FSError(`Unknown walk style "${style}".${suggest(style, styles)} Styles: ${list(styles)}`, it.line);
            if (!clips[style].speed || clips[style].overlay) throw new FSError(`"${style}" isn't a movement style.${suggest(style, styles)} Styles: ${list(styles)}`, it.line);
            clipId = style;
          }
          const clip = clipId ? rigOf(it.actor).clips[clipId] : null;
          const dist = Math.abs(tx - from.x);
          const speed = clip ? paceOf(it.actor, clip, from.y) : 220;
          let dur = it.dur ?? Math.max(0.25, dist / speed);
          if (dur <= 0) dur = 0.25;
          const rate = clip ? Math.max(0.4, Math.min(2.6, dist / dur / speed)) : 1;
          if (dist > 1 && it.props.face !== 'keep') push({ type: 'face', t: now, actor: it.actor, dir: tx > from.x ? 'right' : 'left' });
          push({ type: 'move', t: now, actor: it.actor, to: { x: tx, y: ty }, dur, clip: clipId, rate, ease: it.props.ease || (clip ? 'linear' : 'inout') }, now + dur);
          pos[it.actor] = { x: tx, y: ty };
          touched.add(it.actor);
          advance(it, dur);
          break;
        }
        case 'enter': {
          const a = need(it.actor, it.line);
          if (!touched.has(it.actor)) a.hidden = true;
          const target = { ...pos[it.actor] };
          const edge = it.from === 'right' ? STAGE_W + 160 : -160;
          if (it.from !== 'left' && it.from !== 'right') throw new FSError('enters from left or right', it.line);
          const clip = rigOf(it.actor).clips.walk;
          const pace = paceOf(it.actor, clip, target.y);
          const dur = it.dur ?? Math.max(0.6, Math.abs(target.x - edge) / pace);
          const dist = Math.abs(target.x - edge);
          const rate = clip ? Math.max(0.4, Math.min(2.6, dist / dur / pace)) : 1;
          push({ type: 'show', t: now, actor: it.actor, x: edge, y: target.y });
          push({ type: 'face', t: now, actor: it.actor, dir: it.from === 'left' ? 'right' : 'left' });
          push({ type: 'move', t: now, actor: it.actor, to: target, dur, clip: 'walk', rate, ease: 'linear' }, now + dur);
          touched.add(it.actor);
          advance(it, dur);
          break;
        }
        case 'exit': {
          need(it.actor, it.line);
          if (it.to !== 'left' && it.to !== 'right') throw new FSError('exits to left or right', it.line);
          const from = pos[it.actor];
          const edge = it.to === 'right' ? STAGE_W + 160 : -160;
          const clip = rigOf(it.actor).clips.walk;
          const dist = Math.abs(edge - from.x);
          const pace = paceOf(it.actor, clip, from.y);
          const dur = it.dur ?? Math.max(0.6, dist / pace);
          const rate = clip ? Math.max(0.4, Math.min(2.6, dist / dur / pace)) : 1;
          push({ type: 'face', t: now, actor: it.actor, dir: it.to });
          push({ type: 'move', t: now, actor: it.actor, to: { x: edge, y: from.y }, dur, clip: 'walk', rate, ease: 'linear' }, now + dur);
          push({ type: 'hide', t: now + dur, actor: it.actor });
          pos[it.actor] = { x: edge, y: from.y };
          touched.add(it.actor);
          advance(it, dur);
          break;
        }
        case 'face': {
          need(it.actor, it.line);
          let dir = it.dir;
          if (dir !== 'left' && dir !== 'right') {
            need(dir, it.line, true);
            dir = pos[dir].x >= pos[it.actor].x ? 'right' : 'left';
          }
          push({ type: 'face', t: now, actor: it.actor, dir });
          touched.add(it.actor);
          break;
        }
        case 'play': {
          need(it.actor, it.line);
          const rig = rigOf(it.actor);
          const clip = rig.clips[it.clip];
          if (!clip) throw new FSError(`Unknown animation "${it.clip}".${suggest(it.clip, Object.keys(rig.clips))} Available: ${list(Object.keys(rig.clips))}`, it.line);
          const speed = it.props.speed || 1;
          touched.add(it.actor);
          if (clip.overlay) {
            const dur = it.dur ?? clip.duration / speed;
            push({ type: 'gesture', t: now, actor: it.actor, clip: it.clip, dur, speed }, now + dur);
            advance(it, dur);
          } else {
            push({ type: 'stance', t: now, actor: it.actor, clip: it.clip });
            if (it.dur) {
              push({ type: 'stance', t: now + it.dur, actor: it.actor, clip: 'idle' }, now + it.dur);
              advance(it, it.dur);
            }
          }
          break;
        }
        case 'mood': need(it.actor, it.line); push({ type: 'mood', t: now, actor: it.actor, mood: checkMood(it.mood, it.line) }); break;
        case 'show': if (sceneProps[it.actor]) { push({ type: 'propvis', t: now, prop: it.actor, v: true }); break; } need(it.actor, it.line); push({ type: 'show', t: now, actor: it.actor }); touched.add(it.actor); break;
        case 'hide': if (sceneProps[it.actor]) { push({ type: 'propvis', t: now, prop: it.actor, v: false }); break; } need(it.actor, it.line); push({ type: 'hide', t: now, actor: it.actor }); touched.add(it.actor); break;
        case 'wait': now += it.dur; maxEnd = Math.max(maxEnd, now); break;
        case 'at': now = it.t; break;
        case 'hold': maxEnd = Math.max(maxEnd, now + it.dur); break;
        case 'caption': {
          const words = (it.text.match(/\S+/g) || []).length;
          const dur = it.dur ?? Math.max(1.2, words * 0.32 + 0.8);
          push({ type: 'caption', t: now, text: it.text, dur, pos: it.props.pos || 'bottom', style: it.props.style || 'subtitle' }, now + dur);
          advance(it, dur);
          break;
        }
        case 'camera': {
          const p = it.props;
          if (p.zoom != null && p.zoom < 1) throw new FSError('camera zoom must be 1 or more (1 = full stage)', it.line);
          push({ type: 'camera', t: now, dur: it.dur, zoom: p.zoom, x: p.x, y: p.y, ease: p.ease }, now + it.dur);
          advance(it, it.dur);
          break;
        }
        case 'music': case 'sfx':
          uses.audio.add(it.src);
          push({ type: it.kind, t: now, src: it.src, vol: it.props.vol ?? (it.kind === 'music' ? 0.5 : 1), fade: it.props.fade ?? 0 });
          break;
        case 'par': {
          const t0 = now;
          let end = now;
          for (const child of it.body) {
            now = t0;
            run([child]);
            end = Math.max(end, now);
          }
          now = Math.max(end, now);
          maxEnd = Math.max(maxEnd, now);
          break;
        }
        case 'repeat': for (let k = 0; k < it.count; k++) run(it.body); break;
        case 'prop': case 'holdprop': case 'drop': case 'give': case 'effect': execPropEffect(it); break;
        default: throw new FSError(`Unhandled statement "${it.kind}"`, it.line);
      }
    }

    // ---- props & effects -----------------------------------------------------------------
    function needProp(name, line) {
      if (sceneProps[name]) return sceneProps[name];
      const hint = cast[name] ? ` "${name}" is an actor — only props can be held.` : suggest(name, propOrder);
      throw new FSError(`Unknown prop "${name}" in scene "${sc.id}".${hint} Place it first: prop ${name}: <prop-id> at 50`, line);
    }
    function facingAt(actor) {
      let f = cast[actor].facing, ft = -Infinity;
      for (const e of events) if (e.type === 'face' && e.actor === actor && e.t <= now && e.t >= ft) { f = e.dir; ft = e.t; }
      return f;
    }
    function releaseHand(name) {
      const h = holding[name];
      if (h) delete hands[h.actor + h.hand];
      delete holding[name];
    }
    function propMove(it) {
      const P = sceneProps[it.actor];
      if (it.mode !== 'moves') throw new FSError(`Props can't ${it.mode.replace(/s$/, '')} — use: ${it.actor} moves to 60 over 1s`, it.line);
      if (holding[it.actor]) throw new FSError(`${it.actor} is in ${holding[it.actor].actor}'s hand — "${holding[it.actor].actor} drops ${it.actor}" first`, it.line);
      const from = pos[it.actor];
      let tx, ty = it.target.y ?? from.y;
      if (it.target.actor) {
        need(it.target.actor, it.line, true);
        tx = pos[it.target.actor].x;
        ty = it.target.y ?? pos[it.target.actor].y;
      } else tx = (it.target.x / 100) * STAGE_W;
      const up = it.props.up != null ? +it.props.up : undefined;
      const fromUp = from.up ?? P.up;
      const dist = Math.hypot(tx - from.x, (ty - from.y) * 4, (up ?? fromUp) - fromUp);
      const dur = Math.max(0.05, it.dur ?? Math.max(0.3, dist / 500));
      push({ type: 'propmove', t: now, prop: it.actor, to: { x: tx, y: ty, up }, dur, ease: it.props.ease || 'inout' }, now + dur);
      pos[it.actor] = { x: tx, y: ty, up: up ?? fromUp };
      advance(it, dur);
    }
    function execPropEffect(it) {
      const lib = assets.props || {};
      switch (it.kind) {
        case 'prop': {
          if (cast[it.name] || sceneProps[it.name]) throw new FSError(`"${it.name}" is already used in this scene — pick another name`, it.line);
          const def = lib[it.prop];
          if (!def) {
            const ids = Object.keys(lib);
            throw new FSError(`Unknown prop "${it.prop}".${suggest(it.prop, ids)} Available: ${ids.length ? list(ids) : '(no props loaded)'}`, it.line);
          }
          const P = { prop: it.prop, x: (it.x / 100) * STAGE_W, y: it.y, up: 0, hidden: it.hidden, front: it.front, back: it.back, flip: it.flip };
          for (const [k, v] of Object.entries(it.props)) {
            if (k === 'scale') P.scale = +v;
            else if (k === 'up') P.up = +v;
            else if (k === 'text') {
              if (!def.text) throw new FSError(`"${it.prop}" has no space for text (try sign, board, letter, poster)`, it.line);
              P.text = String(v);
            } else if (k === 'color') {
              if (!/^#[0-9a-fA-F]{3,8}$/.test(String(v))) throw new FSError(`Colors look like #ff8800 (got "${v}")`, it.line);
              if (!def.palette?.main) throw new FSError(`"${it.prop}" can't be recolored`, it.line);
              P.palette = { main: String(v) };
            } else throw new FSError(`Unknown prop setting "${k}".${suggest(k, ['scale', 'up', 'color', 'text'])} Try: scale=1.2 up=100 color=#ff8800 text="…" (and flags hidden front back flip)`, it.line);
          }
          sceneProps[it.name] = P;
          propOrder.push(it.name);
          pos[it.name] = { x: P.x, y: P.y, up: P.up };
          uses.props.add(it.prop);
          break;
        }
        case 'holdprop': case 'give': {
          const giver = it.kind === 'give' ? it.actor : null;
          const who = it.kind === 'give' ? it.to : it.actor;
          need(who, it.line);
          const P = needProp(it.prop, it.line);
          const def = lib[P.prop];
          if (!def.grip) throw new FSError(`"${it.prop}" (${P.prop}) is too big to hold — holdable props have a grip (e.g. mug, phone, book, umbrella, flashlight)`, it.line);
          if (giver) {
            need(giver, it.line);
            if (holding[it.prop]?.actor !== giver) throw new FSError(`${giver} isn't holding ${it.prop} — first: ${giver} holds ${it.prop}`, it.line);
          }
          const hand = it.hand === 'near' ? 'N' : 'F';
          const busy = hands[who + hand];
          if (busy && busy !== it.prop) throw new FSError(`${who} already has ${busy} in the ${hand === 'F' ? 'far' : 'near'} hand — try "${who} holds ${it.prop} in ${hand === 'F' ? 'near' : 'far'}" or "${who} drops ${busy}" first`, it.line);
          releaseHand(it.prop);
          push({ type: 'hold', t: now, prop: it.prop, actor: who, hand });
          holding[it.prop] = { actor: who, hand };
          hands[who + hand] = it.prop;
          touched.add(who);
          advance(it, PROP_GRAB);
          break;
        }
        case 'drop': {
          const a = need(it.actor, it.line);
          if (it.prop) {
            needProp(it.prop, it.line);
            if (holding[it.prop]?.actor !== it.actor) throw new FSError(`${it.actor} isn't holding ${it.prop}`, it.line);
          }
          const names = it.prop ? [it.prop] : Object.keys(holding).filter((n) => holding[n].actor === it.actor);
          const fs = facingAt(it.actor) === 'left' ? -1 : 1;
          const s = (charOf(a.char).scale || 1) * (a.scale || 1);
          for (const n of names) {
            const hand = holding[n].hand;
            const p = pos[it.actor];
            const to = { x: p.x + fs * (hand === 'F' ? 46 : -26) * s, y: Math.min(100, p.y + (hand === 'F' ? 0 : 2)) };
            push({ type: 'drop', t: now, prop: n, actor: it.actor, hand, to });
            pos[n] = { x: to.x, y: to.y, up: 0 };
            releaseHand(n);
          }
          touched.add(it.actor);
          if (names.length) advance(it, 0.3);
          break;
        }
        case 'effect': {
          const fade = it.props.fade != null ? +it.props.fade : undefined;
          if (it.id === 'none') { push({ type: 'effect', t: now, id: '*', amount: 0, fade }); break; }
          const id = EFFECTS[it.id] ? it.id : EFFECT_ALIASES[it.id];
          if (!id) throw new FSError(`Unknown effect "${it.id}".${suggest(it.id, [...Object.keys(EFFECTS), ...Object.keys(EFFECT_ALIASES)])} Available: ${Object.keys(EFFECTS).join(', ')}`, it.line);
          const opts = {};
          let amount = it.amount ?? 1;
          for (const [k, v] of Object.entries(it.props)) {
            if (k === 'fade') continue;
            if (k === 'amount') amount = +v;
            else if (k === 'follow') { need(String(v), it.line); opts.follow = String(v); }
            else opts[k] = v;
          }
          if (!(amount >= 0)) throw new FSError('amount must be a number from 0 to 1', it.line);
          push({ type: 'effect', t: now, id, amount: it.off ? 0 : Math.min(1, amount), fade, opts });
          break;
        }
      }
    }

    const duration = Math.max(0.5, Math.max(maxEnd, now) + (sc.props.tail ?? 0.5));
    return {
      id: sc.id, bg: bgId, start: 0, duration, cast, castOrder, events, props: sceneProps, propOrder, line: sc.line,
      transitionIn: transition ? { type: transition.name, dur: transition.dur, line: transition.line } : null,
    };
  }

  function checkMood(m, line) {
    if (!MOODS[m]) throw new FSError(`Unknown mood "${m}".${suggest(m, Object.keys(MOODS))} Available: ${list(Object.keys(MOODS))}`, line);
    return m;
  }
}
