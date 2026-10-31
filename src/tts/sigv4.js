// Minimal AWS Signature Version 4 signer (WebCrypto; works in browsers, workers and Node 18+).
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(data) {
  return hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}
const uriEncode = (s, keepSlash) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(keepSlash ? /%2F/g : /$^/, '/');

/**
 * Sign a request. Returns the headers to send (including Authorization and X-Amz-Date).
 * @param {{method:string, url:string, headers?:object, body?:string, service:string, region:string,
 *          accessKeyId:string, secretAccessKey:string, sessionToken?:string, date?:Date}} o
 */
export async function signV4(o) {
  const u = new URL(o.url);
  const d = o.date || new Date();
  const amzDate = d.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers = { ...(o.headers || {}), host: u.host, 'x-amz-date': amzDate };
  if (o.sessionToken) headers['x-amz-security-token'] = o.sessionToken;
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')]));
  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const query = [...u.searchParams.entries()].map(([k, v]) => [uriEncode(k), uriEncode(v)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('&');
  const payloadHash = await sha256(o.body || '');
  const canonical = [o.method.toUpperCase(), uriEncode(decodeURIComponent(u.pathname), true) || '/', query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${o.region}/${o.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n');
  let k = await hmac('AWS4' + o.secretAccessKey, day);
  k = await hmac(k, o.region);
  k = await hmac(k, o.service);
  k = await hmac(k, 'aws4_request');
  const signature = hex(await hmac(k, toSign));
  const out = { ...(o.headers || {}), 'X-Amz-Date': amzDate, Authorization: `AWS4-HMAC-SHA256 Credential=${o.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
  if (o.sessionToken) out['X-Amz-Security-Token'] = o.sessionToken;
  return { headers: out, signature, canonical, toSign };
}
