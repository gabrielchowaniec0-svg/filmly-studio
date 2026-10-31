// Runs exportFilm() off the main thread so the editor stays responsive during long exports.
import { exportFilm } from './exporter.js';

let controller = null;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'cancel') { controller && controller.abort(); return; }
  if (msg.type !== 'start') return;
  controller = new AbortController();
  try {
    const { blob, info } = await exportFilm({
      ...msg.options,
      film: msg.film,
      assets: msg.assets,
      audio: msg.audio,
      signal: controller.signal,
      onProgress: (p) => self.postMessage({ type: 'progress', ...p }),
    });
    self.postMessage({ type: 'done', blob, info });
  } catch (err) {
    self.postMessage({ type: 'error', name: err.name, message: err.message || String(err) });
  }
};
