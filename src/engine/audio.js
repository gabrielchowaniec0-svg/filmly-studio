// Offline audio mix for preview and export. Main thread only (OfflineAudioContext is not in workers).

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
        const voice = typeof cue.voice === 'object' ? cue.voice : assets.voices[cue.voice] || { engine: 'webspeech' };
        if (cue.audio) {
          const buf = await decode(cue.audio, () => load(cue.audio));
          playBuffer(ctx, master, buf, cue.t, 1);
          any = true;
        } else if (voice.engine === 'webspeech') {
          warnOnce('Lines using browser voices are silent in the MP4 (browsers don\'t allow recording them). For sound, switch those voices to Kokoro (free) or a cloud voice in Voice Lab.');
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
