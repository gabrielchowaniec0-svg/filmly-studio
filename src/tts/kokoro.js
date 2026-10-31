// Kokoro-82M running in the browser (WebAssembly / WebGPU) via kokoro-js from a CDN. Loaded lazily on
// first use; the model (~90 MB at q8) is cached by the browser afterwards.
import { floatToWav } from './providers.js';

const CDN = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let loading = null;
let loadedDtype = null;

export async function loadKokoro(dtype = 'q8', onProgress) {
  if (loading && loadedDtype === dtype) return loading;
  loadedDtype = dtype;
  loading = (async () => {
    const mod = await import(/* @vite-ignore */ CDN);
    const device = typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm';
    return mod.KokoroTTS.from_pretrained(MODEL, {
      dtype: device === 'webgpu' && dtype === 'q8' ? 'fp32' : dtype,
      device,
      progress_callback: (p) => onProgress && p.status === 'progress' && onProgress(p),
    });
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

/** Returns WAV bytes. */
export async function kokoroSpeak(text, voice, cfg = {}, onProgress) {
  const tts = await loadKokoro(cfg.dtype || 'q8', onProgress);
  const audio = await tts.generate(text, { voice: voice.voice || 'af_heart', speed: +voice.speed || 1 });
  return floatToWav(audio.audio, audio.sampling_rate);
}
