// Text-to-speech providers. Only providers whose audio can be captured are exportable:
//   blip (synth, see audio.js), file (pre-recorded), elevenlabs (API; result cached in IndexedDB).
// webspeech is preview-only: browsers do not let pages record it.

const KEY_NAME = 'filmly.elevenlabs.key';
export const loadTtsKey = () => { try { return localStorage.getItem(KEY_NAME) || ''; } catch { return ''; } };
export const saveTtsKey = (k) => { try { localStorage.setItem(KEY_NAME, k); } catch { /* ignore */ } };

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('filmly-tts', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('audio');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function cacheGet(key) {
  try {
    const db = await idb();
    return await new Promise((res) => { const q = db.transaction('audio').objectStore('audio').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
  } catch { return null; }
}
async function cachePut(key, val) {
  try {
    const db = await idb();
    await new Promise((res) => { const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').put(val, key); tx.oncomplete = res; tx.onerror = res; });
  } catch { /* cache is best-effort */ }
}
async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns audio bytes (ArrayBuffer) for a say-cue, or null if this voice can't produce exportable audio right now. */
export async function getTtsAudio(cue, voice) {
  if (voice.engine !== 'elevenlabs') return null;
  const key = `${voice.voiceId}|${voice.model || ''}|${cue.text}`;
  const id = await sha(key);
  const hit = await cacheGet(id);
  if (hit) return hit;
  const apiKey = loadTtsKey();
  if (!apiKey || !voice.voiceId || voice.voiceId.startsWith('REPLACE')) return null;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: cue.text, model_id: voice.model || 'eleven_multilingual_v2' }),
  });
  if (!r.ok) throw new Error(`ElevenLabs returned ${r.status} for "${cue.text.slice(0, 30)}…"`);
  const bytes = await r.arrayBuffer();
  await cachePut(id, bytes);
  return bytes;
}

/** Preview-only browser speech. */
export function speakPreview(text, voice) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = voice.pitch || 1;
  u.rate = voice.rate || 1;
  u.lang = voice.lang || 'en-US';
  speechSynthesis.speak(u);
}
