// Same-origin relay for TTS providers whose APIs block direct browser (CORS) requests.
// Only forwards to the allow-listed provider hosts below; keys pass through and are never stored or logged.
const ALLOW = [
  /^api\.openai\.com$/, /^api\.elevenlabs\.io$/, /^texttospeech\.googleapis\.com$/, /^generativelanguage\.googleapis\.com$/,
  /^[a-z0-9-]+\.tts\.speech\.microsoft\.com$/, /^polly\.[a-z0-9-]+\.amazonaws\.com$/, /^api\.deepgram\.com$/, /^api\.cartesia\.ai$/,
  /^api\.hume\.ai$/, /^api\.fish\.audio$/, /^api\.lmnt\.com$/, /^api\.groq\.com$/,
];
const PASS_HEADERS = ['authorization', 'content-type', 'accept', 'xi-api-key', 'x-goog-api-key', 'ocp-apim-subscription-key', 'x-microsoft-outputformat',
  'x-amz-date', 'x-amz-security-token', 'x-api-key', 'cartesia-version', 'x-hume-api-key', 'model'];

export default async (req) => {
  const target = new URL(req.url).searchParams.get('url');
  let u;
  try { u = new URL(target); } catch { return new Response('Missing or bad ?url=', { status: 400 }); }
  if (u.protocol !== 'https:' || !ALLOW.some((re) => re.test(u.hostname))) return new Response(`Host not allowed: ${u.hostname}`, { status: 403 });
  const headers = {};
  for (const h of PASS_HEADERS) { const v = req.headers.get(h); if (v) headers[h] = v; }
  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await req.arrayBuffer();
  const res = await fetch(u, init);
  const out = new Headers();
  for (const h of ['content-type', 'content-length']) { const v = res.headers.get(h); if (v) out.set(h, v); }
  out.set('cache-control', 'no-store');
  return new Response(res.body, { status: res.status, headers: out });
};

