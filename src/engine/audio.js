// Offline audio mix for preview and export. Main thread only (OfflineAudioContext is not in workers).
//
// Sound rules (see docs/FILMSCRIPT.md "Sound library"):
// - sfx plays once from its cue.
// - music loops and carries on across scenes until `music stop` or the film ends; a new `music` replaces the
//   current one with a crossfade (fade=, default 1 s). Repeating the playing track just changes its volume.
// - ambience loops until `ambience <id> off` / `ambience off` or the end of its scene (fading out over the next
//   scene's transition). Several ambiences can play at once. If the next scene starts the same ambience right
//   away it simply keeps going.

const SR = 48000;
export const SOUND_DEFAULTS = {
  musicCrossfade: 1.0, // s, when a new music cue replaces the playing one
  musicStopFade: 1.0, // s, `music stop` without fade=
  musicEndFade: 0.75, // s, at the end of the film (or the film's fade out, if longer)
  ambienceFadeIn: 0.5,
  ambienceOffFade: 1.0,
  ambienceSceneEndFade: 0.3, // or the next scene's transition, if longer
  volumeRamp: 0.5, // s, re-issuing a playing music/ambience with a new vol=
};

async function defaultLoad(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load audio "${path}" (${r.status})`);
  return r.arrayBuffer();
}

/** Collect spoken-line cues from a compiled film (global times). */
export function collectCues(film) {
  const cues = [];
  for (const sc of film.scenes) {
    for (const e of sc.events) if (e.type === 'say') cues.push({ kind: 'say', ...e, t: sc.start + e.t });
  }
  return cues.sort((a, b) => a.t - b.t);
}

const byTime = (a, b) => a.t - b.t;

/**
 * Turn the film's sfx / music / ambience events into concrete playbacks on the film timeline.
 * Pure function (no Web Audio), so it is unit-tested.
 * Returns [{kind, src, t0, t1|null, vol, fadeIn, fadeOut, loop, rate, pan, ramps:[{t, vol, dur}]}]
 */
export function planSounds(film) {
  const D = SOUND_DEFAULTS;
  const plays = [];
  const end = film.duration;
  const scenes = [...film.scenes].sort((a, b) => a.start - b.start);

  // ---- music: one global track -----------------------------------------------------------
  const music = [];
  scenes.forEach((sc) => sc.events.forEach((e, i) => { if (e.type === 'music') music.push({ ...e, t: sc.start + e.t, i }); }));
  music.sort((a, b) => a.t - b.t || a.i - b.i);
  let cur = null;
  const stopMusic = (t, fade) => { cur.t1 = Math.min(end, t + fade); cur.fadeOut = Math.max(0, cur.t1 - t); cur = null; };
  for (const e of music) {
    if (e.stop) { if (cur) stopMusic(e.t, e.fade ?? D.musicStopFade); continue; }
    if (cur && cur.src === e.src) { // same track again: keep playing, just change the level
      if (e.vol !== cur.lastVol) cur.ramps.push({ t: e.t, vol: e.vol, dur: e.fade ?? D.volumeRamp });
      cur.lastVol = e.vol;
      continue;
    }
    let fadeIn = e.fade ?? 0;
    if (cur) { const x = e.fade ?? D.musicCrossfade; fadeIn = x; stopMusic(e.t, x); }
    cur = { kind: 'music', src: e.src, sound: e.sound || null, t0: e.t, t1: null, vol: e.vol, lastVol: e.vol, fadeIn, fadeOut: 0, loop: true, rate: 1, pan: null, ramps: [] };
    plays.push(cur);
  }
  if (cur) { cur.t1 = end; cur.fadeOut = Math.max(D.musicEndFade, film.fadeOut || 0); }

  // ---- ambience: per scene, can stack, may carry into the next scene ---------------------
  let carry = new Map(); // src -> play, offered to the next scene
  scenes.forEach((sc, si) => {
    const active = new Map();
    const evs = sc.events.filter((e) => e.type === 'ambience').map((e, i) => ({ ...e, i })).sort((a, b) => a.t - b.t || a.i - b.i);
    const off = (p, t, fade) => { p.t1 = sc.start + t + fade; p.fadeOut = fade; };
    for (const e of evs) {
      if (e.stop) {
        const fade = e.fade ?? D.ambienceOffFade;
        if (e.src) { const p = active.get(e.src); if (p) { off(p, e.t, fade); active.delete(e.src); } } else { for (const p of active.values()) off(p, e.t, fade); active.clear(); }
        continue;
      }
      let p = active.get(e.src);
      if (!p && e.t <= 0.05 && e.fade == null && carry.has(e.src)) { p = carry.get(e.src); active.set(e.src, p); carry.delete(e.src); }
      if (p) {
        if (e.vol !== p.lastVol) p.ramps.push({ t: sc.start + e.t, vol: e.vol, dur: e.fade ?? D.volumeRamp });
        p.lastVol = e.vol;
        continue;
      }
      p = { kind: 'ambience', src: e.src, sound: e.sound || null, t0: sc.start + e.t, t1: null, vol: e.vol, lastVol: e.vol, fadeIn: e.fade ?? D.ambienceFadeIn, fadeOut: 0, loop: true, rate: 1, pan: e.pan ?? null, ramps: [] };
      active.set(e.src, p);
      plays.push(p);
    }
    // whatever was carried but not picked up by this scene ends where the previous scene ended (already set)
    for (const p of carry.values()) if (p.t1 == null) { p.t1 = p.pendingEnd; p.fadeOut = p.pendingFade; }
    carry = new Map();
    const next = scenes[si + 1];
    const sceneEnd = sc.start + sc.duration;
    const endFade = Math.max(D.ambienceSceneEndFade, next?.transitionIn?.dur || 0);
    const continues = new Set((next?.events || []).filter((e) => e.type === 'ambience' && !e.stop && e.t <= 0.05 && e.fade == null).map((e) => e.src));
    for (const [src, p] of active) {
      if (continues.has(src)) { p.pendingEnd = sceneEnd; p.pendingFade = endFade; carry.set(src, p); } else { p.t1 = sceneEnd; p.fadeOut = endFade; }
    }
  });
  for (const p of carry.values()) if (p.t1 == null) { p.t1 = p.pendingEnd; p.fadeOut = p.pendingFade; }

  // ---- sfx --------------------------------------------------------------------------------
  for (const sc of scenes) {
    for (const e of sc.events) {
      if (e.type !== 'sfx') continue;
      plays.push({ kind: 'sfx', src: e.src, sound: e.sound || null, t0: sc.start + e.t, t1: null, vol: e.vol ?? 1, fadeIn: 0, fadeOut: 0, loop: false, rate: e.rate || 1, pan: e.pan ?? null, ramps: [] });
    }
  }

  for (const p of plays) {
    delete p.lastVol; delete p.pendingEnd; delete p.pendingFade;
    if (p.t1 != null) {
      p.t1 = Math.min(p.t1, Math.max(end, p.t0));
      const len = Math.max(0, p.t1 - p.t0);
      if (p.fadeIn + p.fadeOut > len) { const k = len / (p.fadeIn + p.fadeOut || 1); p.fadeIn *= k; p.fadeOut *= k; }
    }
  }
  return plays.filter((p) => p.t1 == null || p.t1 > p.t0).sort((a, b) => a.t0 - b.t0);
}

/**
 * Gain automation for one playback as [[time, value, 'set'|'ramp']] with non-decreasing times.
 * Exported for tests.
 */
export function gainCurve(p) {
  const pts = [];
  let lastT = p.t0;
  const at = (t, v, how) => { t = Math.max(t, lastT); pts.push([t, v, how]); lastT = t; };
  at(p.t0, p.fadeIn > 0 ? 0 : p.vol, 'set');
  if (p.fadeIn > 0) at(p.t0 + p.fadeIn, p.vol, 'ramp');
  let level = p.vol;
  const fadeStart = p.t1 != null ? p.t1 - p.fadeOut : Infinity;
  for (const r of [...(p.ramps || [])].sort(byTime)) {
    if (r.t >= fadeStart) break;
    at(r.t, level, 'set');
    at(Math.min(r.t + r.dur, fadeStart), r.vol, 'ramp');
    level = r.vol;
  }
  if (p.t1 != null) {
    at(fadeStart, level, 'set');
    at(p.t1, 0, p.fadeOut > 0 ? 'ramp' : 'set');
  }
  return pts;
}

// decoded library/file audio, shared between mixes (AudioBuffers are context independent)
const decodedCache = new Map();

/**
 * Mix everything that CAN be exported into a stereo buffer.
 * opts: { sampleRate, loadAudio(path)->ArrayBuffer, tts(voice, text)->ArrayBuffer|null, onWarning(msg) }
 * Returns { sampleRate, channels:[L,R] } or null when the film has no exportable audio.
 */
export async function mixAudio(film, assets, opts = {}) {
  const sr = opts.sampleRate || SR;
  const warn = opts.onWarning || (() => {});
  const load = opts.loadAudio || defaultLoad;
  const cues = collectCues(film);
  const plays = planSounds(film);
  if (!cues.length && !plays.length) return null;

  const length = Math.ceil(film.duration * sr) + sr; // +1s tail
  const ctx = new OfflineAudioContext(2, length, sr);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  // gentle safety limiter so stacked music + ambience + sfx + voices never clip the export
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -4;
  comp.knee.value = 4;
  comp.ratio.value = 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);

  const localCache = new Map();
  const decodeBytes = async (key, getBytes) => {
    if (!localCache.has(key)) localCache.set(key, getBytes().then((ab) => ctx.decodeAudioData(ab.slice(0))));
    return localCache.get(key);
  };
  const decodeFile = (path) => {
    const key = `${sr}|${path}`;
    if (!decodedCache.has(key) || opts.loadAudio) {
      const pr = Promise.resolve().then(() => load(path)).then((ab) => ctx.decodeAudioData(ab.slice(0)));
      if (opts.loadAudio) return pr; // custom loaders (tests, workers) are not cached globally
      decodedCache.set(key, pr);
      pr.catch(() => decodedCache.delete(key));
    }
    return decodedCache.get(key);
  };
  let any = false;
  const warned = new Set();
  const warnOnce = (m) => { if (!warned.has(m)) { warned.add(m); warn(m); } };

  for (const cue of cues) {
    try {
      const voice = typeof cue.voice === 'object' ? cue.voice : assets.voices[cue.voice] || { engine: 'webspeech' };
      if (cue.audio) {
        const buf = await decodeFile(cue.audio);
        schedule(ctx, master, buf, { t0: cue.t, t1: null, vol: 1, fadeIn: 0, fadeOut: 0, loop: false });
        any = true;
      } else if (voice.engine === 'webspeech') {
        warnOnce('Lines using browser voices are silent in the MP4 (browsers don\'t allow recording them). For sound, switch those voices to Kokoro (free) or a cloud voice in Voice Lab.');
      } else {
        const bytes = opts.tts ? await opts.tts(voice, cue.text) : null;
        if (bytes) {
          const buf = await decodeBytes(`tts:${voice.engine}:${voice.voice}:${cue.text}:${JSON.stringify(voice)}`, async () => bytes);
          schedule(ctx, master, buf, { t0: cue.t, t1: null, vol: 1, fadeIn: 0, fadeOut: 0, loop: false });
          any = true;
        } else warnOnce(`Some ${voice.engine} lines have no audio yet, so they'll be silent. Click "Generate voices" first.`);
      }
    } catch (e) {
      warnOnce(`Audio problem: ${e.message}`);
    }
  }
  const bufs = await Promise.all(plays.map((p) => decodeFile(p.src).catch((e) => { warnOnce(`Audio problem: ${e.message}`); return null; })));
  plays.forEach((p, i) => {
    if (!bufs[i]) return;
    try { schedule(ctx, master, bufs[i], p); any = true; } catch (e) { warnOnce(`Audio problem: ${e.message}`); }
  });
  if (!any) return null;
  const rendered = await ctx.startRendering();
  return { sampleRate: sr, channels: [rendered.getChannelData(0), rendered.getChannelData(1)] };
}

function schedule(ctx, dest, buf, p) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = !!p.loop;
  if (p.rate && p.rate !== 1) src.playbackRate.value = p.rate;
  const g = ctx.createGain();
  for (const [t, v, how] of gainCurve(p)) {
    if (how === 'ramp') g.gain.linearRampToValueAtTime(v, t);
    else g.gain.setValueAtTime(v, t);
  }
  let out = src.connect(g);
  if (p.pan != null && p.pan !== 0 && ctx.createStereoPanner) {
    const pn = ctx.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, p.pan));
    out = out.connect(pn);
  }
  out.connect(dest);
  src.start(p.t0);
  if (p.t1 != null) src.stop(p.t1 + 0.02);
  return src;
}
