// Frame-exact MP4 export: renderFrame() -> OffscreenCanvas -> VideoFrame -> VideoEncoder -> Mp4Muxer.
// Runs on the main thread or inside export.worker.js (it uses no DOM APIs).
import { renderFrame } from '../engine/renderer.js';
import { STAGE_W, frameCount } from '../engine/timeline.js';
import { Mp4Muxer } from './mp4mux.js';

// H.264 levels: [level_idc, maxFrameMBs, maxMBsPerSec]
const AVC_LEVELS = [[0x1f, 3600, 108000], [0x28, 8192, 245760], [0x2a, 8704, 522240], [0x32, 22080, 589824], [0x33, 36864, 983040], [0x34, 36864, 2073600], [0x3c, 139264, 4177920], [0x3d, 139264, 8355840], [0x3e, 139264, 16711680]];
// HEVC main tier: [level_idc, maxLumaPs, maxLumaSr]
const HEVC_LEVELS = [[93, 552960, 33177600], [120, 2228224, 66846720], [123, 2228224, 133693440], [150, 8912896, 267386880], [153, 8912896, 534773760], [156, 8912896, 1069547520], [180, 35651584, 1069547520], [183, 35651584, 2139095040], [186, 35651584, 4278190080]];

export function avcLevelFor(w, h, fps) {
  const mbs = Math.ceil(w / 16) * Math.ceil(h / 16);
  return AVC_LEVELS.find(([, fs, sr]) => mbs <= fs && mbs * fps <= sr) || null;
}
export function hevcLevelFor(w, h, fps) {
  return HEVC_LEVELS.find(([, ps, sr]) => w * h <= ps && w * h * fps <= sr) || null;
}

export const QUALITY_BPP = { draft: 0.05, high: 0.12, max: 0.25 };

export function defaultBitrate(w, h, fps, quality = 'high') {
  return Math.round(w * h * fps * (QUALITY_BPP[quality] ?? QUALITY_BPP.high));
}

const hex = (n) => n.toString(16).toUpperCase().padStart(2, '0');

/** Candidate encoder configs in preference order. */
export function videoCandidates({ width, height, fps, bitrate, codec = 'auto' }) {
  const out = [];
  const avc = avcLevelFor(width, height, fps);
  const hevc = hevcLevelFor(width, height, fps);
  const mkAvc = (lv) => ({ family: 'avc', codec: `avc1.6400${hex(lv)}`, avc: { format: 'avc' } });
  const mkHevc = (idc) => ({ family: 'hevc', codec: `hvc1.1.6.L${idc}.B0`, hevc: { format: 'hevc' } });
  const order = codec === 'hevc' ? ['hevc', 'avc'] : codec === 'avc' ? ['avc'] : avc ? ['avc', 'hevc'] : ['hevc', 'avc'];
  for (const fam of order) {
    if (fam === 'avc') out.push({ ...mkAvc(avc ? avc[0] : 0x3e), outOfSpec: !avc });
    else out.push({ ...mkHevc(hevc ? hevc[0] : 186), outOfSpec: !hevc });
  }
  return out.map((c) => ({ ...c, width, height, framerate: fps, bitrate, latencyMode: 'quality', bitrateMode: 'variable' }));
}

export async function pickVideoConfig(o) {
  const tried = [];
  for (const cand of videoCandidates(o)) {
    for (const hw of ['prefer-hardware', 'prefer-software']) {
      const { family, outOfSpec, ...cfg } = cand;
      const full = { ...cfg, hardwareAcceleration: hw };
      let r;
      try { r = await VideoEncoder.isConfigSupported(full); } catch { r = { supported: false }; }
      tried.push(`${cand.codec}/${hw}${outOfSpec ? '(out of spec)' : ''}`);
      if (r.supported) return { config: full, family, hw, outOfSpec, tried };
    }
  }
  throw new Error(`No supported video encoder for ${o.width}x${o.height}@${o.fps}. Tried: ${tried.join(', ')}. Try a lower resolution or frame rate.`);
}

async function pickAudioConfig(sampleRate, channels, bitrate) {
  for (const [fam, codec] of [['aac', 'mp4a.40.2'], ['opus', 'opus']]) {
    const cfg = { codec, sampleRate, numberOfChannels: channels, bitrate };
    try {
      const r = await AudioEncoder.isConfigSupported(cfg);
      if (r.supported) return { family: fam, config: cfg };
    } catch { /* try next */ }
  }
  return null;
}

/**
 * @param {object} o
 * @param {object} o.film compiled film     @param {object} o.assets renderer assets
 * @param {{sampleRate:number, channels:Float32Array[]}|null} o.audio full-film mix
 * @param {number} o.width output pixel width (16:9, even)
 * @param {number} [o.fps]  default film fps   @param {'draft'|'high'|'max'} [o.quality]
 * @param {number} [o.bitrate] bits/s override  @param {'auto'|'avc'|'hevc'} [o.codec]
 * @param {[number,number]} [o.range] seconds [start,end] (for quick tests)
 * @param {(p:object)=>void} [o.onProgress]     @param {AbortSignal} [o.signal]
 */
export async function exportFilm(o) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('WebCodecs is not available in this browser. Use a recent Chrome, Edge, or Safari 16.4+.');
  }
  const { film, assets, audio } = o;
  const fps = o.fps || film.meta.fps;
  const width = Math.max(2, Math.floor(o.width / 2) * 2);
  const height = Math.max(2, Math.round((width * 9) / 16 / 2) * 2);
  const totalFilmFrames = Math.max(1, Math.round(film.duration * fps));
  const startT = o.range ? o.range[0] : 0;
  const endT = o.range ? Math.min(o.range[1], film.duration) : film.duration;
  const first = Math.round(startT * fps);
  const last = Math.min(totalFilmFrames, Math.round(endT * fps));
  const total = Math.max(1, last - first);
  const bitrate = o.bitrate || defaultBitrate(width, height, fps, o.quality || 'high');

  const picked = await pickVideoConfig({ width, height, fps, bitrate, codec: o.codec || 'auto' });
  const warnings = [];
  if (picked.outOfSpec) warnings.push(`${width}x${height}@${fps} exceeds the ${picked.family.toUpperCase()} spec levels; the encoder accepted it but players may not.`);

  let audioPick = null;
  if (audio && audio.channels.length && typeof AudioEncoder !== 'undefined') {
    audioPick = await pickAudioConfig(audio.sampleRate, audio.channels.length, 192000);
    if (!audioPick) warnings.push('No AAC/Opus audio encoder available: exporting without sound.');
  }

  const mux = new Mp4Muxer({
    video: { codec: picked.family, width, height },
    audio: audioPick ? { codec: audioPick.family, sampleRate: audio.sampleRate, channels: audio.channels.length } : null,
  });

  let encError = null;
  const venc = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: (e) => { encError = e; } });
  venc.configure(picked.config);

  const aenc = audioPick ? new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: (e) => { encError = e; } }) : null;
  if (aenc) aenc.configure(audioPick.config);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false });
  const scale = width / STAGE_W;
  const gop = Math.max(1, Math.round(fps * 2));
  const frameDur = Math.round(1e6 / fps);
  const t0 = performance.now();

  for (let n = 0; n < total; n++) {
    if (o.signal && o.signal.aborted) { venc.close(); aenc && aenc.close(); throw new DOMException('Export cancelled', 'AbortError'); }
    if (encError) throw encError;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    renderFrame(ctx, film, assets, (first + n) / fps);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((n * 1e6) / fps), duration: frameDur });
    venc.encode(frame, { keyFrame: n % gop === 0 });
    frame.close();
    if (venc.encodeQueueSize > 10) await new Promise((r) => venc.addEventListener('dequeue', r, { once: true }));
    if (o.onProgress && (n % Math.max(1, Math.floor(fps / 4)) === 0 || n === total - 1)) {
      const el = (performance.now() - t0) / 1000;
      const rate = (n + 1) / Math.max(0.001, el);
      o.onProgress({ phase: 'video', frame: n + 1, total, renderFps: rate, etaSeconds: (total - n - 1) / rate });
    }
    if (n % 8 === 7) await new Promise((r) => setTimeout(r, 0)); // keep the UI/worker responsive
  }
  await venc.flush();
  venc.close();

  if (aenc) {
    const sr = audio.sampleRate, ch = audio.channels.length;
    const from = Math.round(startT * sr);
    const to = Math.min(audio.channels[0].length, Math.round((first + total) / fps * sr));
    const block = 4096;
    for (let p = from; p < to; p += block) {
      const len = Math.min(block, to - p);
      const data = new Float32Array(len * ch);
      for (let c = 0; c < ch; c++) data.set(audio.channels[c].subarray(p, p + len), c * len);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: ch, timestamp: Math.round(((p - from) / sr) * 1e6), data });
      aenc.encode(ad);
      ad.close();
      if (aenc.encodeQueueSize > 40) await new Promise((r) => aenc.addEventListener('dequeue', r, { once: true }));
    }
    await aenc.flush();
    aenc.close();
  }
  if (encError) throw encError;

  o.onProgress && o.onProgress({ phase: 'mux', frame: total, total });
  const blob = mux.finalize();
  return {
    blob,
    info: {
      codec: picked.config.codec, family: picked.family, hardware: picked.hw === 'prefer-hardware', width, height, fps, bitrate, frames: total,
      seconds: total / fps, audio: audioPick ? audioPick.family : null, bytes: blob.size, elapsed: (performance.now() - t0) / 1000, warnings,
    },
  };
}
