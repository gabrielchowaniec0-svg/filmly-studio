// FilmScript AST -> film JSON (plain data the renderer and audio mixer consume).
import { FSError } from './parse.js';
import { estimateSpeechDuration } from '../engine/lipsync.js';
import { MOODS, STAGE_W } from '../engine/timeline.js';
import { TRANSITIONS } from '../assets/transitions/index.js';

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
 * opts: { audioDuration?: (path) => seconds | null }
 */
export function compile(ast, assets, opts = {}) {
  const errors = [];
  const warnings = [];
  const err = (line, message, col = 0) => errors.push({ line, col, message, severity: 'error' });
  const warn = (line, message) => warnings.push({ line, col: 0, message, severity: 'warning' });
  const uses = { characters: new Set(), scenes: new Set(), voices: new Set(), audio: new Set() };

  const meta = ast.film;
  if (!meta) return { film: null, errors, warnings };
  const aspect = meta.width / meta.height;
  if (Math.abs(aspect - 16 / 9) > 0.01) err(meta.line, `Only 16:9 films are supported for now (got ${meta.width}x${meta.height}). Try 1920x1080, 2560x1440, 3840x2160, 7680x4320.`);
  if (meta.fps < 1 || meta.fps > 480) err(meta.line, 'fps must be between 1 and 480');

  const film = { meta: { title: meta.title, width: meta.width, height: meta.height, fps: meta.fps }, fadeIn: 0, fadeOut: 0, scenes: [], duration: 0 };
  let pending = null;

  for (const item of ast.items) {
    try {
      if (item.kind === 'fade') { if (item.dir === 'in') film.fadeIn = item.dur; else film.fadeOut = item.dur; }
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
  return { film: errors.length ? null : film, errors, warnings };

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
    const events = [];
    let now = 0, maxEnd = 0;

    const need = (name, line) => {
      if (!cast[name]) throw new FSError(`Unknown actor "${name}" in scene "${sc.id}".${suggest(name, castOrder)} Cast them first: cast ${name}: <character> at 50`, line);
      return cast[name];
    };
    const rigOf = (name) => assets.rigs[assets.characters[cast[name].char].rig];
    const push = (e, end) => { events.push(e); maxEnd = Math.max(maxEnd, end ?? e.t); };
    const advance = (it, dur) => { if (!it.concurrent) now += dur; maxEnd = Math.max(maxEnd, now); };

    run(sc.body);

    function run(items) {
      for (const it of items) {
        try { exec(it); } catch (e) {
          if (e instanceof FSError) err(e.line || it.line, e.message, e.col); else throw e;
        }
      }
    }

    function exec(it) {
      switch (it.kind) {
        case 'cast': {
          if (cast[it.name]) throw new FSError(`Actor "${it.name}" is already cast in this scene`, it.line);
          const char = assets.characters[it.char];
          if (!char) throw new FSError(`Unknown character "${it.char}".${suggest(it.char, Object.keys(assets.characters))} Available: ${list(Object.keys(assets.characters))}`, it.line);
          uses.characters.add(it.char);
          const x = (it.x / 100) * STAGE_W;
          const facing = it.props.facing || (it.x > 50 ? 'left' : 'right');
          if (facing !== 'left' && facing !== 'right') throw new FSError('facing must be left or right', it.line);
          cast[it.name] = { char: it.char, x, y: it.y, facing, hidden: it.hidden, scale: it.props.scale };
          castOrder.push(it.name);
          pos[it.name] = { x, y: it.y };
          if (it.props.mood) events.push({ type: 'mood', t: 0, actor: it.name, mood: checkMood(it.props.mood, it.line) });
          break;
        }
        case 'say': {
          const a = need(it.actor, it.line);
          const char = assets.characters[a.char];
          const voiceId = it.props.voice || char.voice;
          const voice = assets.voices[voiceId];
          if (!voice) throw new FSError(`Unknown voice "${voiceId}".${suggest(String(voiceId), Object.keys(assets.voices))} Available: ${list(Object.keys(assets.voices))}`, it.line);
          uses.voices.add(voiceId);
          let audio = it.props.audio;
          if (audio) uses.audio.add(audio);
          let dur = it.props.for;
          if (dur == null && audio && opts.audioDuration) dur = opts.audioDuration(audio);
          if (dur == null) dur = estimateSpeechDuration(it.text, voice.rate || 1);
          const mood = it.props.mood ? checkMood(it.props.mood, it.line) : null;
          if (mood) push({ type: 'mood', t: now, actor: it.actor, mood });
          push({ type: 'say', t: now, actor: it.actor, text: it.text, dur, voice: voiceId, audio: audio || null, still: !!it.props.still }, now + dur);
          touched.add(it.actor);
          advance(it, dur + (it.props.gap ?? 0.15));
          break;
        }
        case 'move': {
          const a = need(it.actor, it.line);
          const from = pos[it.actor];
          let tx, ty = it.target.y ?? from.y;
          if (it.target.actor) {
            const o = need(it.target.actor, it.line);
            const ox = pos[it.target.actor].x;
            const dir = Math.sign(ox - from.x) || 1;
            tx = ox - dir * 150 * (assets.characters[a.char].scale || 1);
            ty = it.target.y ?? pos[it.target.actor].y;
          } else tx = (it.target.x / 100) * STAGE_W;
          const clipId = it.mode === 'runs' ? 'run' : it.mode === 'walks' ? 'walk' : null;
          const clip = clipId ? rigOf(it.actor).clips[clipId] : null;
          const dist = Math.abs(tx - from.x);
          const speed = (clip && clip.speed) || 220;
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
          const dur = it.dur ?? Math.max(0.6, Math.abs(target.x - edge) / (rigOf(it.actor).clips.walk?.speed || 190));
          const dist = Math.abs(target.x - edge);
          const clip = rigOf(it.actor).clips.walk;
          const rate = clip ? Math.max(0.4, Math.min(2.6, dist / dur / (clip.speed || 190))) : 1;
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
          const dur = it.dur ?? Math.max(0.6, dist / (clip?.speed || 190));
          const rate = clip ? Math.max(0.4, Math.min(2.6, dist / dur / (clip.speed || 190))) : 1;
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
            need(dir, it.line);
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
        case 'show': need(it.actor, it.line); push({ type: 'show', t: now, actor: it.actor }); touched.add(it.actor); break;
        case 'hide': need(it.actor, it.line); push({ type: 'hide', t: now, actor: it.actor }); touched.add(it.actor); break;
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
        default: throw new FSError(`Unhandled statement "${it.kind}"`, it.line);
      }
    }

    const duration = Math.max(0.5, Math.max(maxEnd, now) + (sc.props.tail ?? 0.5));
    return {
      id: sc.id, bg: bgId, start: 0, duration, cast, castOrder, events,
      transitionIn: transition ? { type: transition.name, dur: transition.dur } : null,
    };
  }

  function checkMood(m, line) {
    if (!MOODS[m]) throw new FSError(`Unknown mood "${m}".${suggest(m, Object.keys(MOODS))} Available: ${list(Object.keys(MOODS))}`, line);
    return m;
  }
}
