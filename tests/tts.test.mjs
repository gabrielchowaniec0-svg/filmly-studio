import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, parseVoiceSpec, lineKey, needsAudio } from '../src/tts/catalog.js';
import { buildRequest, synthesizeHttp, listVoicesHttp, pcm16ToWav, viaProxy, TTSError } from '../src/tts/providers.js';
import { signV4 } from '../src/tts/sigv4.js';

const CFG = {
  openai: { apiKey: 'sk-test' }, elevenlabs: { apiKey: 'xi' }, google: { apiKey: 'AIza' }, gemini: { apiKey: 'AIzaG' },
  azure: { apiKey: 'az', region: 'westeurope' }, polly: { accessKeyId: 'AKID', secretAccessKey: 'SECRET', region: 'us-west-2' },
  deepgram: { apiKey: 'dg' }, cartesia: { apiKey: 'ca', version: '2025-04-16' }, hume: { apiKey: 'hu' }, fish: { apiKey: 'fi' },
  lmnt: { apiKey: 'lm' }, custom: { baseUrl: 'http://localhost:8880/v1/' },
};
const VOICE = { cartesia: 'a0e99841-438c-4a64-b679-ae501e7d6091', fish: '7f92f8afb8ec43bf81429cc1c9199cb1' };

test('every HTTP provider builds a well-formed request', async () => {
  for (const engine of Object.keys(CFG)) {
    const v = { engine, voice: VOICE[engine] || PROVIDERS[engine].voices[0]?.id || 'x' };
    const r = await buildRequest(engine, 'Hello & <world>', v, CFG[engine]);
    assert.equal(r.method, 'POST', engine);
    assert.ok(/^https?:\/\//.test(r.url), `${engine}: ${r.url}`);
    assert.ok(typeof r.body === 'string' && r.body.length > 5, engine);
    if (r.headers['Content-Type'] === 'application/json') JSON.parse(r.body);
  }
});

test('request details: auth headers, models, styles, SSML escaping', async () => {
  let r = await buildRequest('openai', 'Hi', { engine: 'openai', voice: 'coral', style: 'whisper', speed: 1.2 }, CFG.openai);
  assert.equal(r.url, 'https://api.openai.com/v1/audio/speech');
  assert.equal(r.headers.Authorization, 'Bearer sk-test');
  assert.deepEqual(JSON.parse(r.body), { model: 'gpt-4o-mini-tts', voice: 'coral', input: 'Hi', response_format: 'mp3', speed: 1.2, instructions: 'whisper' });
  r = await buildRequest('openai', 'Hi', { engine: 'openai', voice: 'coral', model: 'tts-1', style: 'x' }, CFG.openai);
  assert.equal(JSON.parse(r.body).instructions, undefined, 'tts-1 has no instructions');
  r = await buildRequest('custom', 'Hi', { engine: 'custom', voice: 'af_heart' }, CFG.custom);
  assert.equal(r.url, 'http://localhost:8880/v1/audio/speech');
  assert.equal(r.local, true);
  r = await buildRequest('elevenlabs', 'Hi', { engine: 'elevenlabs', voice: '21m00Tcm4TlvDq8ikWAM' }, CFG.elevenlabs);
  assert.match(r.url, /text-to-speech\/21m00Tcm4TlvDq8ikWAM\?output_format=mp3_44100_128/);
  assert.equal(r.headers['xi-api-key'], 'xi');
  r = await buildRequest('azure', 'Tom & "Jerry" <3', { engine: 'azure', voice: 'en-US-JennyNeural', style: 'cheerful', speed: 1.1 }, CFG.azure);
  assert.equal(r.url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.match(r.body, /Tom &amp; &quot;Jerry&quot; &lt;3/);
  assert.match(r.body, /<mstts:express-as style="cheerful">/);
  assert.match(r.body, /rate="\+10%"/);
  assert.match(r.body, /xml:lang="en-US"/);
  r = await buildRequest('google', 'Hi', { engine: 'google', voice: 'en-GB-Neural2-A' }, CFG.google);
  assert.equal(JSON.parse(r.body).voice.languageCode, 'en-GB');
  r = await buildRequest('gemini', 'Hi', { engine: 'gemini', voice: 'Kore', style: 'Say cheerfully' }, CFG.gemini);
  const gb = JSON.parse(r.body);
  assert.equal(gb.contents[0].parts[0].text, 'Say cheerfully: Hi');
  assert.equal(gb.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
  r = await buildRequest('polly', 'Hi', { engine: 'polly', voice: 'Joanna', pollyEngine: 'generative' }, CFG.polly);
  assert.equal(r.url, 'https://polly.us-west-2.amazonaws.com/v1/speech');
  assert.equal(JSON.parse(r.body).Engine, 'generative');
  assert.match(r.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKID\/\d{8}\/us-west-2\/polly\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/);
  r = await buildRequest('deepgram', 'Hi', { engine: 'deepgram', voice: 'aura-2-thalia-en' }, CFG.deepgram);
  assert.equal(r.headers.Authorization, 'Token dg');
});

test('missing keys give a friendly error', async () => {
  await assert.rejects(buildRequest('openai', 'Hi', { engine: 'openai', voice: 'coral' }, {}), /OpenAI: missing API key/);
  await assert.rejects(buildRequest('azure', 'Hi', { engine: 'azure', voice: 'x' }, { apiKey: 'k' }), /missing Region/);
});

const fakeFetch = (handler) => async (url, init) => handler(url, init);
const resp = (body, { status = 200, json } = {}) => ({
  ok: status < 400, status,
  arrayBuffer: async () => (body instanceof ArrayBuffer ? body : new Uint8Array(body).buffer),
  json: async () => json, text: async () => (json ? JSON.stringify(json) : String(body)),
});

test('synthesize: binary, google base64, gemini PCM->WAV, HTTP errors', async () => {
  const mp3 = new Uint8Array(400).fill(7);
  let got = await synthesizeHttp('openai', 'Hi', { engine: 'openai', voice: 'coral' }, CFG.openai, { fetch: fakeFetch(() => resp(mp3)) });
  assert.equal(got.byteLength, 400);
  const b64 = Buffer.from(mp3).toString('base64');
  got = await synthesizeHttp('google', 'Hi', { engine: 'google', voice: 'en-US-Neural2-F' }, CFG.google, { fetch: fakeFetch(() => resp(null, { json: { audioContent: b64 } })) });
  assert.equal(got.byteLength, 400);
  const pcm = Buffer.from(new Int16Array(2400).buffer).toString('base64');
  got = await synthesizeHttp('gemini', 'Hi', { engine: 'gemini', voice: 'Kore' }, CFG.gemini, {
    fetch: fakeFetch(() => resp(null, { json: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm } }] } }] } })),
  });
  const dv = new DataView(got);
  assert.equal(String.fromCharCode(...new Uint8Array(got, 0, 4)), 'RIFF');
  assert.equal(dv.getUint32(24, true), 24000);
  assert.equal(got.byteLength, 44 + 4800);
  await assert.rejects(
    synthesizeHttp('elevenlabs', 'Hi', { engine: 'elevenlabs', voice: 'x' }, CFG.elevenlabs, { fetch: fakeFetch(() => resp('', { status: 401, json: { detail: { message: 'Invalid API key' } } })) }),
    (e) => e instanceof TTSError && e.status === 401 && /Invalid API key/.test(e.message) && /check the API key/.test(e.message),
  );
  await assert.rejects(synthesizeHttp('openai', 'Hi', { engine: 'openai', voice: 'coral' }, CFG.openai, { fetch: async () => { throw new TypeError('Failed to fetch'); } }), /site proxy/);
});

test('proxy wraps cloud URLs but never local servers', async () => {
  let seen;
  const f = fakeFetch((url) => { seen = url; return resp(new Uint8Array(200)); });
  await synthesizeHttp('deepgram', 'Hi', { engine: 'deepgram', voice: 'aura-2-thalia-en' }, CFG.deepgram, { fetch: f, proxy: true });
  assert.match(seen, /^\/\.netlify\/functions\/tts-proxy\?url=https%3A%2F%2Fapi\.deepgram\.com/);
  await synthesizeHttp('custom', 'Hi', { engine: 'custom', voice: 'af_heart' }, CFG.custom, { fetch: f, proxy: true });
  assert.equal(seen, 'http://localhost:8880/v1/audio/speech');
  assert.equal(viaProxy({ url: 'https://a.b/c?d=1' }, '/p').url, '/p?url=https%3A%2F%2Fa.b%2Fc%3Fd%3D1');
});

test('voice lists are normalised', async () => {
  const v = await listVoicesHttp('elevenlabs', CFG.elevenlabs, { fetch: fakeFetch(() => resp(null, { json: { voices: [{ voice_id: 'abc', name: 'Zed', labels: { gender: 'male' }, category: 'premade' }] } })) });
  assert.deepEqual(v, [{ id: 'abc', name: 'Zed', info: 'male · premade' }]);
  const a = await listVoicesHttp('azure', CFG.azure, { fetch: fakeFetch(() => resp(null, { json: [{ ShortName: 'en-US-X', DisplayName: 'X', Locale: 'en-US', Gender: 'Female', StyleList: ['cheerful'] }] })) });
  assert.equal(a[0].id, 'en-US-X');
  assert.match(a[0].info, /cheerful/);
  const c = await listVoicesHttp('cartesia', CFG.cartesia, { fetch: fakeFetch(() => resp(null, { json: { data: [{ id: 'u1', name: 'Barb', language: 'en' }] } })) });
  assert.equal(c[0].id, 'u1');
  assert.deepEqual(await listVoicesHttp('deepgram', {}), PROVIDERS.deepgram.voices);
});

test('SigV4 matches the AWS documentation example', async () => {
  const r = await signV4({
    method: 'GET', url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    service: 'iam', region: 'us-east-1', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    date: new Date(Date.UTC(2015, 7, 30, 12, 36, 0)),
  });
  assert.equal(r.signature, '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7');
});

test('catalog helpers', () => {
  assert.deepEqual(parseVoiceSpec('openai:coral'), { engine: 'openai', voice: 'coral' });
  assert.equal(parseVoiceSpec('nope:x'), null);
  assert.equal(parseVoiceSpec('kokoro').voice, 'af_heart');
  assert.notEqual(lineKey({ engine: 'openai', voice: 'coral' }, 'a'), lineKey({ engine: 'openai', voice: 'coral', style: 'sad' }, 'a'));
  assert.equal(lineKey({ engine: 'openai', voice: 'coral', id: 'x', name: 'y' }, 'a'), lineKey({ engine: 'openai', voice: 'coral' }, 'a'));
  assert.equal(needsAudio({ engine: 'blip' }), false);
  assert.equal(needsAudio({ engine: 'webspeech' }), false);
  assert.equal(needsAudio({ engine: 'kokoro' }), true);
  for (const [id, p] of Object.entries(PROVIDERS)) {
    assert.ok(p.label && p.blurb && Array.isArray(p.fields) && Array.isArray(p.params) && Array.isArray(p.voices), id);
    assert.equal(typeof p.exportable, 'boolean', id);
  }
  assert.ok(Object.keys(PROVIDERS).length >= 15);
});

test('pcm16ToWav header', () => {
  const w = pcm16ToWav(new Int16Array(10), 22050, 1);
  assert.equal(w.byteLength, 64);
  assert.equal(new DataView(w).getUint32(40, true), 20);
});
