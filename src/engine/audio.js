// Offline audio mix for preview and export. Main thread only (OfflineAudioContext is not in workers).
import { buildTalk, blipSchedule } from './lipsync.js';

const SR = 48000;

async function defaultLoad(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load audio "${path}" (${r.status})`);
  return r.arrayBuffer();
}

/** Collect sound cues from a compiled film (global times). */
export function collectCues(film) {
  const cues = [];
  for (const sc of film.scenes) {
    for (const e of sc.events) {
      if (e.type === 'say') cues.push({ kind: 'say', t: sc.start + e.t, ...e });
      else if (e.type === 'sfx' || e.type === 'music') cues.push({ kind: e.type, ...e, t: sc.start + e.t });
    }
  }
  return cues.sort((a, b) => a.t - b.t);
}

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
  if (!cues.length) return null;

  const length = Math.ceil(film.duration * sr) + sr; // +1s tail
  const ctx = new OfflineAudioContext(2, length, sr);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  master.connect(lp).connect(ctx.destination);

  const bufferCache = new Map();
  const decode = async (key, getBytes) => {
    if (!bufferCache.has(key)) bufferCache.set(key, getBytes().then((ab) => ctx.decodeAudioData(ab.slice(0))));
    return bufferCache.get(key);
  };
  let any = false;
  const warned = new Set();
  const warnOnce = (m) => { if (!warned.has(m)) { warned.add(m); warn(m); } };

  for (const cue of cues) {
    try {
      if (cue.kind === 'say') {
        const voice = typeof cue.voice === 'object' ? cue.voice : assets.voices[cue.voice] || { engine: 'blip' };
        if (cue.audio) {
          const buf = await decode(cue.audio, () => load(cue.audio));
          playBuffer(ctx, master, buf, cue.t, 1);
          any = true;
        } else if (voice.engine === 'blip') {
          scheduleBlips(ctx, master, voice, cue);
          any = true;
        } else if (voice.engine === 'webspeech') {
          warnOnce(`"${voice.name || voice.id || 'Browser voice'}" uses browser speech, which can't be recorded into a video. Pick a blip, Kokoro or cloud voice for export.`);
        } else {
          const bytes = opts.tts ? await opts.tts(voice, cue.text) : null;
          if (bytes) {
            const buf = await decode(`tts:${voice.engine}:${voice.voice}:${cue.text}:${JSON.stringify(voice)}`, async () => bytes);
            playBuffer(ctx, master, buf, cue.t, 1);
            any = true;
          } else warnOnce(`Some ${voice.engine} lines have no audio yet, so they'll be silent. Click "Generate voices" first.`);
        }
      } else {
        const buf = await decode(cue.src, () => load(cue.src));
        const src = playBuffer(ctx, master, buf, cue.t, cue.vol ?? 1, cue.kind === 'music', cue.fade || 0);
        any = true;
        if (cue.kind === 'music') src.stop(film.duration);
      }
    } catch (e) {
      warnOnce(`Audio problem: ${e.message}`);
    }
  }
  if (!any) return null;
  const rendered = await ctx.startRendering();
  return { sampleRate: sr, channels: [rendered.getChannelData(0), rendered.getChannelData(1)] };
}

function playBuffer(ctx, dest, buf, t, vol = 1, loop = false, fade = 0) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  const g = ctx.createGain();
  if (fade > 0) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + fade);
  } else g.gain.value = vol;
  src.connect(g).connect(dest);
  src.start(t);
  return src;
}

export function scheduleBlips(ctx, dest, voice, cue) {
  const talk = buildTalk(cue.text, cue.dur);
  const blips = blipSchedule(talk, voice);
  for (const b of blips) {
    const t = cue.t + b.t;
    const osc = ctx.createOscillator();
    osc.type = voice.wave || 'triangle';
    osc.frequency.setValueAtTime(b.freq, t);
    osc.frequency.linearRampToValueAtTime(b.freq * 0.96, t + b.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.03, b.dur));
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + Math.max(0.04, b.dur) + 0.02);
  }
}
