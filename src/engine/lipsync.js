// Text -> timed mouth shapes (visemes). When real speech audio is available, its loudness envelope
// gates the mouth too, so lips stop when the voice pauses.
//
// Visemes match the rig's mouth slot: rest, mbp, fv, ee, ah, oh, oo, half.

const VOWEL_VISEME = { a: 'ah', e: 'ee', i: 'ee', y: 'ee', o: 'oh', u: 'oo' };
const DIGRAPH_VISEME = { ou: 'oh', ow: 'oh', oo: 'oo', ea: 'ee', ee: 'ee', ai: 'ah', ay: 'ee', oa: 'oh', au: 'ah', ie: 'ee' };

function hash(str, seed = 0) {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function consonantViseme(c) {
  if (/[mbp]/.test(c)) return 'mbp';
  if (/[fv]/.test(c)) return 'fv';
  if (/[wq]/.test(c)) return 'oo';
  if (/(sh|ch|j)/.test(c)) return 'oo';
  return null;
}

/** Rough speaking time for a line (seconds). */
export function estimateSpeechDuration(text, rate = 1) {
  const words = (text.match(/[\p{L}\p{N}'’]+/gu) || []).length;
  const pauses = (text.match(/[,;:]/g) || []).length * 0.18 + (text.match(/[.!?…]/g) || []).length * 0.32;
  return Math.max(0.8, (words * 0.34 + pauses + 0.25) / rate);
}

/** Split text into weighted segments: syllables (with onset + vowel visemes), closures and pauses. */
export function syllabify(text) {
  const segs = [];
  const re = /([\p{L}\p{N}'’]+)|([,;:])|([.!?…]+)|(\s+|[^\s\p{L}\p{N}]+)/gu;
  let m, wi = 0;
  while ((m = re.exec(text))) {
    if (m[1]) {
      const word = m[1].toLowerCase();
      const parts = word.match(/[^aeiouy]*[aeiouy]+/g);
      if (!parts) {
        segs.push({ kind: 'syl', w: 0.8, vis: consonantViseme(word) || 'half', onset: null, seed: hash(word, wi) });
      } else {
        parts.forEach((p, k) => {
          const vg = /[aeiouy]+$/.exec(p)[0];
          const onsetTxt = p.slice(0, p.length - vg.length);
          const vis = DIGRAPH_VISEME[vg.slice(0, 2)] || VOWEL_VISEME[vg[0]] || 'ah';
          segs.push({ kind: 'syl', w: 1, vis, onset: onsetTxt ? consonantViseme(onsetTxt) : null, seed: hash(word, wi * 31 + k) });
        });
        const tail = word.slice(parts.join('').length);
        const close = tail && consonantViseme(tail.slice(-1));
        if (close) segs.push({ kind: 'close', w: 0.3, vis: close });
      }
      segs.push({ kind: 'pause', w: 0.2 });
      wi++;
    } else if (m[2]) segs.push({ kind: 'pause', w: 0.8 });
    else if (m[3]) segs.push({ kind: 'pause', w: 1.5, end: true, question: m[3].includes('?') });
  }
  return segs;
}

/** Lay segments across [0, duration]. env (optional): {rate, data:[0..1]} loudness of the real audio. */
export function buildTalk(text, duration, env = null) {
  const segs = syllabify(text);
  const total = segs.reduce((a, s) => a + s.w, 0) || 1;
  let t = 0;
  const out = segs.map((s) => {
    const len = (s.w / total) * duration;
    const seg = { ...s, t0: t, t1: t + len };
    t += len;
    return seg;
  });
  return { text, duration, segments: out, env };
}

export function envAt(env, t) {
  if (!env || !env.data || !env.data.length) return null;
  const i = t * env.rate;
  const i0 = Math.floor(i);
  if (i0 < 0 || i0 >= env.data.length) return 0;
  const a = env.data[i0], b = env.data[Math.min(env.data.length - 1, i0 + 1)];
  return a + (b - a) * (i - i0);
}

/** Viseme at local time t (seconds from line start), or null outside the line. */
export function mouthAt(talk, t) {
  if (t < 0 || t >= talk.duration) return null;
  const segs = talk.segments;
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].t1 <= t) lo = mid + 1; else hi = mid;
  }
  const s = segs[lo];
  let vis = 'rest';
  if (s && s.kind === 'syl') {
    const u = (t - s.t0) / Math.max(1e-6, s.t1 - s.t0);
    if (u < 0.22) vis = s.onset || 'half';
    else if (u > 0.82) vis = 'half';
    else vis = s.vis;
  } else if (s && s.kind === 'close') vis = s.vis;
  const a = envAt(talk.env, t);
  if (a !== null) {
    if (a < 0.06) return vis === 'mbp' || vis === 'fv' ? vis : 'rest';
    if (a < 0.22 && (vis === 'ah' || vis === 'oh' || vis === 'ee' || vis === 'rest')) return 'half';
    if (vis === 'rest') return 'half';
  }
  return vis;
}
