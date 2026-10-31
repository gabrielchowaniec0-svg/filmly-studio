// HTTP implementations for each TTS provider. Pure functions of (text, voice, settings, fetch) so they run
// in the browser, in a worker, or in Node tests with a mocked fetch. All return encoded audio bytes (mp3/wav).
import { PROVIDERS } from './catalog.js';
import { signV4 } from './sigv4.js';

export class TTSError extends Error {
  constructor(provider, message, status) {
    super(`${PROVIDERS[provider]?.label || provider}: ${message}`);
    this.provider = provider;
    this.status = status;
  }
}

const num = (v, d) => (v === undefined || v === '' || v === null || Number.isNaN(+v) ? d : +v);
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const b64ToBytes = (b64) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

/** Wrap 16-bit little-endian PCM in a WAV container. */
export function pcm16ToWav(pcm, sampleRate, channels = 1) {
  const data = pcm instanceof ArrayBuffer ? new Uint8Array(pcm) : new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const buf = new ArrayBuffer(44 + data.length);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + data.length, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true); v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, data.length, true);
  new Uint8Array(buf, 44).set(data);
  return buf;
}
export function floatToWav(samples, sampleRate) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
  return pcm16ToWav(pcm, sampleRate, 1);
}

function need(provider, cfg, ...keys) {
  for (const k of keys) if (!cfg[k]) throw new TTSError(provider, `missing ${PROVIDERS[provider].fields.find((f) => f.key === k)?.label || k} — add it in Voice Lab`);
}
const json = (url, headers, body) => ({ url, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

/** Build the HTTP request for one line. Returns {url, method, headers, body, decode:'binary'|'google'|'gemini'}. */
export async function buildRequest(engine, text, voice, cfg = {}) {
  const v = voice.voice;
  switch (engine) {
    case 'openai':
    case 'custom': {
      if (engine === 'openai') need(engine, cfg, 'apiKey');
      const base = engine === 'openai' ? 'https://api.openai.com/v1' : String(cfg.baseUrl || '').replace(/\/+$/, '');
      if (!base) throw new TTSError(engine, 'missing Base URL');
      const model = voice.model || (engine === 'openai' ? 'gpt-4o-mini-tts' : 'kokoro');
      const body = { model, voice: v, input: text, response_format: 'mp3' };
      if (num(voice.speed, 1) !== 1) body.speed = num(voice.speed, 1);
      if (voice.style && /gpt-4o/.test(model)) body.instructions = voice.style;
      return { ...json(`${base}/audio/speech`, cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}, body), decode: 'binary', local: engine === 'custom' };
    }
    case 'elevenlabs': {
      need(engine, cfg, 'apiKey');
      const body = { text, model_id: voice.model || 'eleven_multilingual_v2', voice_settings: { stability: num(voice.stability, 0.5), similarity_boost: num(voice.similarity, 0.75) } };
      if (num(voice.speed, 1) !== 1) body.voice_settings.speed = num(voice.speed, 1);
      return { ...json(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v)}?output_format=mp3_44100_128`, { 'xi-api-key': cfg.apiKey, Accept: 'audio/mpeg' }, body), decode: 'binary' };
    }
    case 'google': {
      need(engine, cfg, 'apiKey');
      const languageCode = v.split('-').slice(0, 2).join('-');
      const audioConfig = { audioEncoding: 'MP3', speakingRate: num(voice.speed, 1) };
      if (num(voice.pitch, 0) !== 0) audioConfig.pitch = num(voice.pitch, 0);
      return { ...json(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(cfg.apiKey)}`, {}, { input: { text }, voice: { languageCode, name: v }, audioConfig }), decode: 'google' };
    }
    case 'gemini': {
      need(engine, cfg, 'apiKey');
      const model = voice.model || 'gemini-2.5-flash-preview-tts';
      const prompt = voice.style ? `${voice.style}: ${text}` : text;
      return {
        ...json(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': cfg.apiKey }, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v } } } },
        }),
        decode: 'gemini',
      };
    }
    case 'azure': {
      need(engine, cfg, 'apiKey', 'region');
      const lang = v.split('-').slice(0, 2).join('-');
      const rate = Math.round((num(voice.speed, 1) - 1) * 100);
      const pitch = Math.round(num(voice.pitch, 0));
      let inner = `<prosody rate="${rate >= 0 ? '+' : ''}${rate}%" pitch="${pitch >= 0 ? '+' : ''}${pitch}%">${xml(text)}</prosody>`;
      if (voice.style) inner = `<mstts:express-as style="${xml(voice.style)}">${inner}</mstts:express-as>`;
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}"><voice name="${xml(v)}">${inner}</voice></speak>`;
      return {
        url: `https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`, method: 'POST', body: ssml, decode: 'binary',
        headers: { 'Ocp-Apim-Subscription-Key': cfg.apiKey, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3' },
      };
    }
    case 'polly': {
      need(engine, cfg, 'accessKeyId', 'secretAccessKey');
      const region = cfg.region || 'us-east-1';
      const url = `https://polly.${region}.amazonaws.com/v1/speech`;
      const b = JSON.stringify({ Engine: voice.pollyEngine || 'neural', OutputFormat: 'mp3', Text: text, TextType: 'text', VoiceId: v });
      const { headers } = await signV4({ method: 'POST', url, body: b, headers: { 'content-type': 'application/json' }, service: 'polly', region, accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, sessionToken: cfg.sessionToken });
      return { url, method: 'POST', headers, body: b, decode: 'binary' };
    }
    case 'deepgram':
      need(engine, cfg, 'apiKey');
      return { ...json(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(v)}&encoding=mp3`, { Authorization: `Token ${cfg.apiKey}` }, { text }), decode: 'binary' };
    case 'cartesia':
      need(engine, cfg, 'apiKey');
      if (!v || v === 'default') throw new TTSError(engine, 'pick a voice id (Voice Lab → Load my voices)');
      return {
        ...json('https://api.cartesia.ai/tts/bytes', { 'X-API-Key': cfg.apiKey, 'Cartesia-Version': cfg.version || '2025-04-16' }, {
          model_id: voice.model || 'sonic-2', transcript: text, voice: { mode: 'id', id: v },
          output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 }, language: voice.language || 'en',
        }),
        decode: 'binary',
      };
    case 'hume': {
      need(engine, cfg, 'apiKey');
      const utt = { text };
      if (voice.style) utt.description = voice.style;
      if (v && v !== 'default') utt.voice = { name: v, provider: 'HUME_AI' };
      return { ...json('https://api.hume.ai/v0/tts/file', { 'X-Hume-Api-Key': cfg.apiKey }, { utterances: [utt], format: { type: 'mp3' } }), decode: 'binary' };
    }
    case 'fish': {
      need(engine, cfg, 'apiKey');
      const body = { text, format: 'mp3' };
      if (v && v !== 'default') body.reference_id = v;
      return { ...json('https://api.fish.audio/v1/tts', { Authorization: `Bearer ${cfg.apiKey}`, model: voice.model || 's1' }, body), decode: 'binary' };
    }
    case 'lmnt': {
      need(engine, cfg, 'apiKey');
      const body = { voice: v, text, format: 'mp3' };
      if (num(voice.speed, 1) !== 1) body.speed = num(voice.speed, 1);
      return { ...json('https://api.lmnt.com/v1/ai/speech/bytes', { 'X-API-Key': cfg.apiKey }, body), decode: 'binary' };
    }
    default:
      throw new TTSError(engine, 'this voice is not generated over HTTP');
  }
}

async function errorText(res) {
  try {
    const t = await res.text();
    try { const j = JSON.parse(t); return j.error?.message || j.detail?.message || j.detail || j.message || j.error || t.slice(0, 200); } catch { return t.slice(0, 200); }
  } catch { return ''; }
}

/** Route a request through the site's Netlify function (for providers that block browser CORS). */
export function viaProxy(req, proxyBase = '/.netlify/functions/tts-proxy') {
  return { ...req, url: `${proxyBase}?url=${encodeURIComponent(req.url)}` };
}

/**
 * Synthesize one line. Returns an ArrayBuffer of encoded audio (mp3 or wav).
 * opts: { fetch, proxy: boolean | string }
 */
export async function synthesizeHttp(engine, text, voice, cfg = {}, opts = {}) {
  const f = opts.fetch || fetch;
  let req = await buildRequest(engine, text, voice, cfg);
  if (opts.proxy && !req.local) req = viaProxy(req, typeof opts.proxy === 'string' ? opts.proxy : undefined);
  let res;
  try {
    res = await f(req.url, { method: req.method, headers: req.headers, body: req.body });
  } catch (e) {
    throw new TTSError(engine, `network error (${e.message}). If this provider blocks browser requests, turn on "Route through site proxy" in Voice Lab.`);
  }
  if (!res.ok) {
    const msg = await errorText(res);
    const hint = res.status === 401 || res.status === 403 ? ' — check the API key/permissions' : res.status === 429 ? ' — rate limited or out of credits' : '';
    throw new TTSError(engine, `HTTP ${res.status}${msg ? `: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}` : ''}${hint}`, res.status);
  }
  if (req.decode === 'google') {
    const j = await res.json();
    if (!j.audioContent) throw new TTSError(engine, 'response had no audio');
    return b64ToBytes(j.audioContent);
  }
  if (req.decode === 'gemini') {
    const j = await res.json();
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new TTSError(engine, 'response had no audio' + (j.promptFeedback ? ` (${JSON.stringify(j.promptFeedback)})` : ''));
    const rate = +(/rate=(\d+)/.exec(part.inlineData.mimeType || '') || [0, 24000])[1];
    return pcm16ToWav(b64ToBytes(part.inlineData.data), rate, 1);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 100) throw new TTSError(engine, 'response was too small to be audio');
  return buf;
}

/** Fetch the voices available to this account, where the provider supports it. Returns [{id, name, info}] */
export async function listVoicesHttp(engine, cfg = {}, opts = {}) {
  const f = opts.fetch || fetch;
  const wrap = (url, headers) => {
    let req = { url, method: 'GET', headers };
    if (opts.proxy) req = viaProxy(req, typeof opts.proxy === 'string' ? opts.proxy : undefined);
    return f(req.url, { method: 'GET', headers: req.headers }).then(async (r) => {
      if (!r.ok) throw new TTSError(engine, `HTTP ${r.status}: ${await errorText(r)}`, r.status);
      return r.json();
    });
  };
  switch (engine) {
    case 'elevenlabs': {
      need(engine, cfg, 'apiKey');
      const j = await wrap('https://api.elevenlabs.io/v1/voices', { 'xi-api-key': cfg.apiKey });
      return (j.voices || []).map((x) => ({ id: x.voice_id, name: x.name, info: [x.labels?.gender, x.labels?.accent, x.labels?.age, x.category].filter(Boolean).join(' · ') }));
    }
    case 'google': {
      need(engine, cfg, 'apiKey');
      const j = await wrap(`https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(cfg.apiKey)}`, {});
      return (j.voices || []).map((x) => ({ id: x.name, name: x.name, info: `${(x.languageCodes || []).join(',')} · ${String(x.ssmlGender || '').toLowerCase()}` })).sort((a, b) => a.id.localeCompare(b.id));
    }
    case 'azure': {
      need(engine, cfg, 'apiKey', 'region');
      const j = await wrap(`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, { 'Ocp-Apim-Subscription-Key': cfg.apiKey });
      return (j || []).map((x) => ({ id: x.ShortName, name: `${x.DisplayName || x.LocalName} (${x.Locale})`, info: [x.Gender, (x.StyleList || []).length ? 'styles: ' + x.StyleList.join(', ') : ''].filter(Boolean).join(' · ') }));
    }
    case 'cartesia': {
      need(engine, cfg, 'apiKey');
      const j = await wrap('https://api.cartesia.ai/voices?limit=100', { 'X-API-Key': cfg.apiKey, 'Cartesia-Version': cfg.version || '2025-04-16' });
      const arr = Array.isArray(j) ? j : j.data || [];
      return arr.map((x) => ({ id: x.id, name: x.name, info: [x.language, x.description].filter(Boolean).join(' · ').slice(0, 80) }));
    }
    case 'lmnt': {
      need(engine, cfg, 'apiKey');
      const j = await wrap('https://api.lmnt.com/v1/ai/voice/list', { 'X-API-Key': cfg.apiKey });
      return (Array.isArray(j) ? j : j.voices || []).map((x) => ({ id: x.id, name: x.name || x.id, info: [x.gender, x.description].filter(Boolean).join(' · ').slice(0, 80) }));
    }
    default:
      return PROVIDERS[engine]?.voices || [];
  }
}
