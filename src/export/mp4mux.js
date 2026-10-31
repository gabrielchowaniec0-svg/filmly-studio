// Minimal, dependency-free MP4 muxer for WebCodecs output.
//   video: H.264 ("avc1", avcC) or HEVC ("hvc1", hvcC)    audio: AAC-LC ("mp4a") or Opus ("Opus")
// Layout: ftyp | moov | mdat  (moov first => "faststart", streams from any web server).
// Samples are buffered in memory (see docs/PLAN.md M1 for the fragmented / streaming variant).

const te = new TextEncoder();
const u8 = (...n) => Uint8Array.from(n);
const be16 = (n) => u8((n >> 8) & 255, n & 255);
const be32 = (n) => u8((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const be64 = (n) => { const hi = Math.floor(n / 4294967296); return concat([be32(hi), be32(n >>> 0)]); };
const str = (s) => te.encode(s);

function concat(parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function box(type, ...payload) {
  const body = concat(payload);
  return concat([be32(body.length + 8), str(type), body]);
}
function fullBox(type, version, flags, ...payload) {
  return box(type, u8(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...payload);
}
const zeros = (n) => new Uint8Array(n);
const fixed1616 = (n) => be32(Math.round(n * 65536));

const MATRIX = concat([be32(0x00010000), be32(0), be32(0), be32(0), be32(0x00010000), be32(0), be32(0), be32(0), be32(0x40000000)]);

function tableBox(type, entries /* Uint32Array */, extra = []) {
  const buf = new Uint8Array(entries.length * 4);
  const dv = new DataView(buf.buffer);
  entries.forEach((v, i) => dv.setUint32(i * 4, v >>> 0));
  return fullBox(type, 0, 0, ...extra, buf);
}

function descriptor(tag, ...payload) {
  const body = concat(payload);
  const n = body.length;
  return concat([u8(tag, 0x80 | ((n >> 21) & 0x7f), 0x80 | ((n >> 14) & 0x7f), 0x80 | ((n >> 7) & 0x7f), n & 0x7f), body]);
}

export class Mp4Muxer {
  /**
   * @param {object} o
   * @param {{codec:'avc'|'hevc', width:number, height:number, colr?:[number,number,number,boolean]}} o.video
   * @param {{codec:'aac'|'opus', sampleRate:number, channels:number}} [o.audio]
   */
  constructor({ video, audio = null, videoTimescale = 90000 }) {
    this.video = video;
    this.audio = audio;
    this.vts = videoTimescale;
    this.tracks = [];
    this.vtrack = { kind: 'video', id: 1, timescale: videoTimescale, samples: [], config: null };
    this.tracks.push(this.vtrack);
    if (audio) {
      this.atrack = { kind: 'audio', id: 2, timescale: audio.sampleRate, samples: [], config: null };
      this.tracks.push(this.atrack);
    }
    this.finalized = false;
  }

  /** @param {EncodedVideoChunk} chunk @param {EncodedVideoChunkMetadata} [meta] */
  addVideoChunk(chunk, meta) {
    this._add(this.vtrack, chunk, meta);
  }
  /** @param {EncodedAudioChunk} chunk @param {EncodedAudioChunkMetadata} [meta] */
  addAudioChunk(chunk, meta) {
    if (!this.atrack) throw new Error('Muxer was created without an audio track');
    this._add(this.atrack, chunk, meta);
  }
  _add(track, chunk, meta) {
    if (this.finalized) throw new Error('Muxer already finalized');
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const d = meta && meta.decoderConfig && meta.decoderConfig.description;
    if (d && !track.config) track.config = d instanceof ArrayBuffer ? new Uint8Array(d) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
    track.samples.push({ data, ts: chunk.timestamp, dur: chunk.duration || 0, sync: chunk.type === 'key' });
  }
  /** Lower-level: add raw bytes (used by tests). */
  addRaw(kind, data, tsMicros, durMicros, sync, description) {
    const track = kind === 'video' ? this.vtrack : this.atrack;
    if (description && !track.config) track.config = description;
    track.samples.push({ data, ts: tsMicros, dur: durMicros, sync });
  }

  finalize() {
    if (this.finalized) throw new Error('Muxer already finalized');
    this.finalized = true;
    for (const t of this.tracks) {
      if (!t.samples.length) throw new Error(`No ${t.kind} samples were added`);
      if (!t.config) throw new Error(`Missing ${t.kind} decoder description (pass the metadata from the encoder's output callback)`);
      t.samples.sort((a, b) => a.ts - b.ts);
      // integer tick timeline: durations are differences of rounded timestamps => no drift, exact at 240 fps
      const ticks = t.samples.map((s) => Math.round((s.ts * t.timescale) / 1e6));
      t.samples.forEach((s, i) => {
        s.dtsTicks = ticks[i];
        s.durTicks = i + 1 < ticks.length ? ticks[i + 1] - ticks[i] : Math.max(1, Math.round(((s.dur || (t.samples[i - 1] ? t.samples[i - 1].dur : 0) || 1e6 / 30) * t.timescale) / 1e6));
      });
      t.totalTicks = ticks[ticks.length - 1] + t.samples[t.samples.length - 1].durTicks - ticks[0];
      t.startTicks = ticks[0];
    }

    // interleave into chunks (~0.5 s each) ordered by time
    const order = [];
    for (const t of this.tracks) t.samples.forEach((s) => order.push({ t, s, at: s.dtsTicks / t.timescale }));
    order.sort((a, b) => a.at - b.at || a.t.id - b.t.id);
    const chunks = [];
    let cur = null;
    for (const o of order) {
      if (!cur || cur.track !== o.t || o.at - cur.startAt >= 0.5) {
        cur = { track: o.t, samples: [], startAt: o.at, size: 0 };
        chunks.push(cur);
      }
      cur.samples.push(o.s);
      cur.size += o.s.data.length;
    }

    const ftyp = box('ftyp', str('isom'), be32(512), str('isom'), str('iso2'), str(this.video.codec === 'hevc' ? 'hvc1' : 'avc1'), str('mp41'));
    let mdatBytes = 0;
    for (const c of chunks) mdatBytes += c.size;
    const big = mdatBytes + 16 > 0xffffffff;
    const mdatHeader = big ? concat([be32(1), str('mdat'), be64(mdatBytes + 16)]) : concat([be32(mdatBytes + 8), str('mdat')]);

    // moov size does not depend on offsets, so build twice
    let moov = this._moov(chunks, 0, big);
    const dataStart = ftyp.length + moov.length + mdatHeader.length;
    moov = this._moov(chunks, dataStart, big);

    const parts = [ftyp, moov, mdatHeader];
    for (const c of chunks) for (const s of c.samples) parts.push(s.data);
    return new Blob(parts, { type: 'video/mp4' });
  }

  _moov(chunks, dataStart, big) {
    // assign chunk offsets
    let off = dataStart;
    for (const c of chunks) { c.offset = off; off += c.size; }
    const movieTs = 1000;
    const durMs = Math.max(...this.tracks.map((t) => Math.round((t.totalTicks / t.timescale) * movieTs)));
    const mvhd = fullBox('mvhd', 0, 0, be32(0), be32(0), be32(movieTs), be32(durMs), fixed1616(1), be16(0x0100), zeros(10), MATRIX, zeros(24), be32(this.tracks.length + 1));
    return box('moov', mvhd, ...this.tracks.map((t) => this._trak(t, chunks.filter((c) => c.track === t), movieTs, big)));
  }

  _trak(t, chunks, movieTs, big) {
    const isV = t.kind === 'video';
    const durMovie = Math.round((t.totalTicks / t.timescale) * movieTs);
    const tkhd = fullBox('tkhd', 0, 3, be32(0), be32(0), be32(t.id), be32(0), be32(durMovie), zeros(8), be16(0), be16(0), be16(isV ? 0 : 0x0100), be16(0), MATRIX, isV ? fixed1616(this.video.width) : be32(0), isV ? fixed1616(this.video.height) : be32(0));
    const mdhd = fullBox('mdhd', 0, 0, be32(0), be32(0), be32(t.timescale), be32(t.totalTicks), be16(0x55c4), be16(0));
    const hdlr = fullBox('hdlr', 0, 0, be32(0), str(isV ? 'vide' : 'soun'), zeros(12), str(isV ? 'VideoHandler\0' : 'SoundHandler\0'));
    const mhd = isV ? fullBox('vmhd', 0, 1, zeros(8)) : fullBox('smhd', 0, 0, be16(0), be16(0));
    const dinf = box('dinf', fullBox('dref', 0, 0, be32(1), fullBox('url ', 0, 1)));

    // stts (run-length of durations)
    const stts = [];
    for (const s of t.samples) {
      const last = stts[stts.length - 1];
      if (last && last[1] === s.durTicks) last[0]++; else stts.push([1, s.durTicks]);
    }
    const sttsBox = tableBox('stts', Uint32Array.from(stts.flat()), [be32(stts.length)]);
    // stsz
    const stszBuf = new Uint8Array(t.samples.length * 4);
    const dvz = new DataView(stszBuf.buffer);
    t.samples.forEach((s, i) => dvz.setUint32(i * 4, s.data.length));
    const stsz = fullBox('stsz', 0, 0, be32(0), be32(t.samples.length), stszBuf);
    // stsc (run-length of samples per chunk)
    const stscRuns = [];
    chunks.forEach((c, i) => {
      const last = stscRuns[stscRuns.length - 1];
      if (!last || last[1] !== c.samples.length) stscRuns.push([i + 1, c.samples.length, 1]);
    });
    const stsc = tableBox('stsc', Uint32Array.from(stscRuns.flat()), [be32(stscRuns.length)]);
    // chunk offsets
    let stco;
    if (big) {
      const b = new Uint8Array(chunks.length * 8);
      const dv = new DataView(b.buffer);
      chunks.forEach((c, i) => { dv.setUint32(i * 8, Math.floor(c.offset / 4294967296)); dv.setUint32(i * 8 + 4, c.offset >>> 0); });
      stco = fullBox('co64', 0, 0, be32(chunks.length), b);
    } else stco = tableBox('stco', Uint32Array.from(chunks.map((c) => c.offset)), [be32(chunks.length)]);

    const stbl = [this._stsd(t), sttsBox, stsc, stsz, stco];
    if (isV) {
      const syncs = [];
      t.samples.forEach((s, i) => { if (s.sync) syncs.push(i + 1); });
      if (syncs.length !== t.samples.length) stbl.push(tableBox('stss', Uint32Array.from(syncs), [be32(syncs.length)]));
    }
    // elst: shift so the first sample plays at time 0 (also trims nothing else)
    const mdia = box('mdia', mdhd, hdlr, box('minf', mhd, dinf, box('stbl', ...stbl)));
    return box('trak', tkhd, mdia);
  }

  _stsd(t) {
    if (t.kind === 'video') {
      const hevc = this.video.codec === 'hevc';
      const colr = this.video.colr || [1, 13, 1, true]; // matches what Chrome writes into the H.264 VUI: BT.709 primaries, sRGB transfer, BT.709 matrix, full range
      const entry = box(
        hevc ? 'hvc1' : 'avc1',
        zeros(6), be16(1), zeros(16), be16(this.video.width), be16(this.video.height),
        be32(0x00480000), be32(0x00480000), be32(0), be16(1), zeros(32), be16(0x18), be16(0xffff),
        box(hevc ? 'hvcC' : 'avcC', t.config),
        box('colr', str('nclx'), be16(colr[0]), be16(colr[1]), be16(colr[2]), u8(colr[3] ? 0x80 : 0)),
      );
      return fullBox('stsd', 0, 0, be32(1), entry);
    }
    const a = this.audio;
    let entry;
    const head = [zeros(6), be16(1), zeros(8), be16(a.channels), be16(16), be16(0), be16(0), be32(a.sampleRate * 65536)];
    if (a.codec === 'opus') {
      // t.config = OpusHead identification header (little endian) -> dOps (big endian)
      const h = t.config;
      const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
      const ch = h[9], pre = dv.getUint16(10, true), rate = dv.getUint32(12, true), gain = dv.getInt16(16, true), map = h[18];
      const dops = box('dOps', u8(0, ch), be16(pre), be32(rate), be16(gain & 0xffff), u8(map));
      entry = box('Opus', ...head, dops);
    } else {
      const esds = fullBox('esds', 0, 0, descriptor(0x03, be16(t.id), u8(0),
        descriptor(0x04, u8(0x40, 0x15), zeros(3), be32(0), be32(0), descriptor(0x05, t.config)),
        descriptor(0x06, u8(2))));
      entry = box('mp4a', ...head, esds);
    }
    return fullBox('stsd', 0, 0, be32(1), entry);
  }
}
