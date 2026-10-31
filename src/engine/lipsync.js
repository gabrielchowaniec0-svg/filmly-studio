// Text -> syllable timing. One schedule drives BOTH the mouth shapes and the blip voice audio,
// so animation and sound can never drift apart.

const VOWEL_SHAPE = { a: 'open_a', e: 'open_a', i: 'open_a', y: 'open_a', o: 'open_o', u: 'open_o' };
const VOWEL_PITCH = { a: 1.0, e: 1.12, i: 1.26, y: 1.2, o: 0.9, u: 0.8 };

function hash(str, seed = 0) {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Rough speaking time for a line (seconds). */
export function estimateSpeechDuration(text, rate = 1) {
  const words = (text.match(/[\p{L}\p{N}'’]+/gu) || []).length;
  const pauses = (text.match(/[,;:]/g) || []).length * 0.18 + (text.match(/[.!?…]/g) || []).length * 0.32;
  return Math.max(0.8, (words * 0.34 + pauses + 0.25) / rate);
}

/** Split text into weighted segments: syllables and pauses. */
export function syllabify(text) {
  const segs = [];
  const re = /([\p{L}\p{N}'’]+)|([,;:])|([.!?…]+)|(\s+|[^\s\p{L}\p{N}]+)/gu;
  let m;
  let wi = 0;
  while ((m = re.exec(text))) {
    if (m[1]) {
      const word = m[1].toLowerCase();
      const groups = word.match(/[aeiouy]+/g);
      const count = groups ? groups.length : 1;
      for (let k = 0; k < count; k++) {
        const v = groups ? groups[k][0] : null;
        segs.push({ kind: 'syl', w: 1, vowel: v, shape: v ? VOWEL_SHAPE[v] : 'half', seed: hash(word, wi * 31 + k) });
      }
      segs.push({ kind: 'pause', w: 0.22 });
      wi++;
    } else if (m[2]) segs.push({ kind: 'pause', w: 0.8 });
    else if (m[3]) segs.push({ kind: 'pause', w: 1.5, end: true, question: m[3].includes('?') });
  }
  return segs;
}

/** Lay segments across [0, duration]. Returns {segments:[{t0,t1,...}], duration, text}. */
export function buildTalk(text, duration) {
  const segs = syllabify(text);
  const total = segs.reduce((a, s) => a + s.w, 0) || 1;
  let t = 0;
  const out = segs.map((s) => {
    const len = (s.w / total) * duration;
    const seg = { ...s, t0: t, t1: t + len };
    t += len;
    return seg;
  });
  return { text, duration, segments: out };
}

/** Mouth slot option at local time t (seconds from line start). */
export function mouthAt(talk, t) {
  if (t < 0 || t >= talk.duration) return null;
  // binary search
  const segs = talk.segments;
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].t1 <= t) lo = mid + 1; else hi = mid;
  }
  const s = segs[lo];
  if (!s || s.kind !== 'syl') return 'closed';
  const u = (t - s.t0) / (s.t1 - s.t0);
  if (u < 0.22 || u > 0.8) return 'half';
  return s.shape;
}

/** Blip events for the audio synth: [{t, dur, freq}] relative to line start. */
export function blipSchedule(talk, voice) {
  const base = voice.pitch ?? 260;
  const variation = voice.variation ?? 0.2;
  const out = [];
  const segs = talk.segments;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.kind !== 'syl') continue;
    const vp = s.vowel ? VOWEL_PITCH[s.vowel] : 1;
    const jitter = 1 + (s.seed - 0.5) * 2 * variation;
    let freq = base * vp * jitter;
    // question intonation: raise the last few syllables
    const next = segs.slice(i + 1).find((x) => x.kind === 'pause' && x.end);
    if (next && next.question && segs.length - i < 6) freq *= 1.18;
    const dur = (s.t1 - s.t0) * 0.88;
    out.push({ t: s.t0, dur, freq });
  }
  return out;
}
