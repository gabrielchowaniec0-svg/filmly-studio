// Browser-side TTS orchestration: settings, caching, generation, analysis (duration + loudness envelope).
import { PROVIDERS, lineKey, needsAudio } from './catalog.js';
import { synthesizeHttp, listVoicesHttp, TTSError } from './providers.js';
import { kokoroSpeak } from './kokoro.js';

// ---- settings (kept only in this browser) ----------------------------------------------------
const SETTINGS_KEY = 'filmly.tts.settings.v1';
export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    // migrate the old single ElevenLabs key
    const old = localStorage.getItem('filmly.elevenlabs.key');
    if (old && !s.providers?.elevenlabs?.apiKey) s.providers = { ...(s.providers || {}), elevenlabs: { apiKey: old } };
    return { providers: {}, proxy: {}, ...s };
  } catch { return { providers: {}, proxy: {} }; }
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}
export function providerConfig(engine, settings = loadSettings()) {
  const cfg = {};
  for (const f of PROVIDERS[engine]?.fields || []) if (f.default !== undefined) cfg[f.key] = f.default;
  return { ...cfg, ...(settings.providers?.[engine] || {}) };
}
export function isConfigured(engine, settings = loadSettings()) {
  const meta = PROVIDERS[engine];
  if (!meta) return false;
  const cfg = providerConfig(engine, settings);
  return meta.fields.filter((f) => f.secret && !/optional/i.test(f.label)).every((f) => cfg[f.key]);
}

// ---- cache: IndexedDB (persistent) + memory ---------------------------------------------------
const mem = new Map(); // lineKey -> {bytes, duration, env}
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open('filmly-tts', 2);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('lines')) r.result.createObjectStore('lines'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }).catch(() => null);
  return dbp;
}
async function idbGet(key) {
  const d = await db();
  if (!d) return null;
  return new Promise((res) => { const q = d.transaction('lines').objectStore('lines').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
}
async function idbPut(key, val) {
  const d = await db();
  if (!d) return;
  await new Promise((res) => { const tx = d.transaction('lines', 'readwrite'); tx.objectStore('lines').put(val, key); tx.oncomplete = res; tx.onerror = res; });
}
export async function clearCache() {
  mem.clear();
  const d = await db();
  if (d) await new Promise((res) => { const tx = d.transaction('lines', 'readwrite'); tx.objectStore('lines').clear(); tx.oncomplete = res; tx.onerror = res; });
}

/** Synchronous lookup used by the compiler: {duration, env} if this line's audio is ready. */
export function lineInfo(voice, text) {
  const e = mem.get(lineKey(voice, text));
  return e ? { duration: e.duration, env: e.env } : null;
}
/** Encoded audio bytes for the mixer (null if not generated yet). */
export async function lineBytes(voice, text) {
  const k = lineKey(voice, text);
  if (mem.has(k)) return mem.get(k).bytes;
  const hit = await idbGet(k);
  if (hit) { mem.set(k, hit); return hit.bytes; }
  return null;
}

// ---- analysis ----------------------------------------------------------------------------------
let decodeCtx = null;
/** Decode audio -> duration + 100 Hz loudness envelope (0..1), trimmed of trailing silence. */
export async function analyze(bytes) {
  decodeCtx = decodeCtx || new OfflineAudioContext(1, 1, 48000);
  const buf = await decodeCtx.decodeAudioData(bytes.slice(0));
  const ch = buf.getChannelData(0);
  const rate = 100, hop = Math.round(buf.sampleRate / rate);
  const env = [];
  let peak = 1e-6;
  for (let i = 0; i < ch.length; i += hop) {
    let s = 0;
    const end = Math.min(ch.length, i + hop);
    for (let j = i; j < end; j++) s += ch[j] * ch[j];
    const v = Math.sqrt(s / Math.max(1, end - i));
    env.push(v);
    if (v > peak) peak = v;
  }
  const data = env.map((v) => Math.round(Math.min(1, v / peak) * 100) / 100);
  let last = data.length - 1;
  while (last > 0 && data[last] < 0.03) last--;
  const duration = Math.max(0.3, Math.min(buf.duration, (last + 6) / rate));
  return { duration, env: { rate, data: data.slice(0, last + 6) } };
}

// ---- generation ------------------------------------------------------------------------------
/** Produce audio bytes for one line with the right engine (no cache). */
export async function synthesize(voice, text, { settings = loadSettings(), onProgress } = {}) {
  const engine = voice.engine;
  if (engine === 'kokoro') return kokoroSpeak(text, voice, providerConfig('kokoro', settings), onProgress);
  if (!needsAudio(voice)) throw new TTSError(engine, 'this voice is synthesized live, not generated');
  return synthesizeHttp(engine, text, voice, providerConfig(engine, settings), { proxy: !!settings.proxy?.[engine] });
}

/** Get (cached or new) audio for a line, analyzed. */
export async function ensureLine(voice, text, opts = {}) {
  const k = lineKey(voice, text);
  if (mem.has(k)) return mem.get(k);
  const hit = await idbGet(k);
  if (hit) { mem.set(k, hit); return hit; }
  const bytes = await synthesize(voice, text, opts);
  const info = await analyze(bytes);
  const entry = { bytes, ...info, at: Date.now() };
  mem.set(k, entry);
  await idbPut(k, entry);
  return entry;
}

/**
 * Generate every line that needs audio. lines: [{voice, text}] (from compile result .lines).
 * Returns {done, failed:[{voice,text,error}], cached}
 */
export async function generateLines(lines, { onProgress, concurrency = 3 } = {}) {
  const todo = lines.filter((l) => needsAudio(l.voice));
  const uniq = [...new Map(todo.map((l) => [lineKey(l.voice, l.text), l])).values()];
  let done = 0, cached = 0;
  const failed = [];
  const queue = [...uniq];
  const worker = async () => {
    while (queue.length) {
      const l = queue.shift();
      const k = lineKey(l.voice, l.text);
      try {
        if (mem.has(k) || (await idbGet(k))) cached++;
        await ensureLine(l.voice, l.text, { onProgress: (p) => onProgress && onProgress({ done, total: uniq.length, model: p }) });
      } catch (e) {
        failed.push({ ...l, error: e.message || String(e) });
      }
      done++;
      onProgress && onProgress({ done, total: uniq.length, line: l.text });
    }
  };
  // Kokoro runs on this thread; keep it sequential
  const n = uniq.some((l) => l.voice.engine === 'kokoro') ? 1 : concurrency;
  await Promise.all(Array.from({ length: Math.min(n, uniq.length) }, worker));
  return { done, failed, cached, total: uniq.length };
}

export async function listVoices(engine, settings = loadSettings()) {
  if (engine === 'webspeech') return browserVoices();
  return listVoicesHttp(engine, providerConfig(engine, settings), { proxy: !!settings.proxy?.[engine] });
}

// ---- browser speech (default; preview only) --------------------------------------------------
// Voice names differ per OS/browser, so "auto" picks the best match for language + gender.
const FEMALE = /(female|woman|samantha|victoria|karen|moira|tessa|fiona|veena|zira|aria|jenny|emma|ava|allison|susan|serena|kate|libby|sonia|natasha|hazel|catherine|nicky|joanna|salli|kimberly|ivy|amy|olivia|google uk english female|google us english)/i;
const MALE = /(male|\bman\b|daniel|alex|fred|david|mark|guy|ryan|george|james|arthur|oliver|thomas|aaron|rishi|tom|matthew|brian|joey|justin|davis|andrew|christopher|eric|roger|steffan|google uk english male)/i;
export function browserVoices() {
  if (typeof speechSynthesis === 'undefined') return [];
  return [{ id: 'auto', name: 'Automatic (best match)', info: '' }].concat(speechSynthesis.getVoices().map((v) => ({ id: v.name, name: v.name, info: `${v.lang}${v.localService ? ' · local' : ' · online'}` })));
}
export function pickBrowserVoice(voice, all = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : []) {
  if (!all.length) return null;
  if (voice.voice && voice.voice !== 'auto' && voice.voice !== 'default') {
    const exact = all.find((v) => v.name === voice.voice);
    if (exact) return exact;
  }
  const lang = (voice.lang || 'en-US').toLowerCase();
  const g = voice.gender || 'any';
  const score = (v) => {
    const vl = v.lang.toLowerCase().replace('_', '-');
    let s = vl === lang ? 40 : vl.slice(0, 2) === lang.slice(0, 2) ? 20 : 0;
    const isF = FEMALE.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/i, '')), isM = MALE.test(v.name) && !/female/i.test(v.name);
    if (g === 'female') s += isF ? 25 : isM ? -25 : 0;
    if (g === 'male') s += isM ? 25 : isF ? -25 : 0;
    if (/natural|neural|enhanced|premium|google/i.test(v.name)) s += 6;
    if (v.default) s += 2;
    return s;
  };
  return [...all].sort((a, b) => score(b) - score(a))[0];
}
export function speakBrowser(text, voice) {
  if (typeof speechSynthesis === 'undefined') return;
  const u = new SpeechSynthesisUtterance(text);
  const match = pickBrowserVoice(voice);
  if (match) u.voice = match;
  u.rate = +voice.rate || 1;
  u.pitch = +voice.pitch || 1;
  u.lang = match?.lang || voice.lang || 'en-US';
  speechSynthesis.speak(u);
}
export function stopBrowserSpeech() { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }
