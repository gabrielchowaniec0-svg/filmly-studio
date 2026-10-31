"""Seamless music loops. Every note is placed with wrap-around into a buffer that is exactly the loop length,
and reverb is circular, so the end of the file flows straight back into its start."""
import numpy as np
import dsp as D
import instruments as I


def wrap_add(dst, src, start):
    """dst (2, L) += src (2, n) starting at sample `start`, wrapping around the end (and folding long sources)."""
    L = dst.shape[1]
    n = src.shape[1]
    pos = start % L
    k = 0
    while k < n:
        take = min(n - k, L - pos)
        dst[:, pos:pos + take] += src[:, k:k + take]
        k += take
        pos = 0


class Mix:
    def __init__(self, bpm, bars, seed=1, swing8=0.0, swing16=0.0, beats_per_bar=4):
        self.bpm, self.bars, self.bpb = bpm, bars, beats_per_bar
        self.spb = 60.0 / bpm
        self.sec = bars * beats_per_bar * self.spb
        self.L = D.n_of(self.sec)
        self.dry = np.zeros((2, self.L))
        self.send = np.zeros((2, self.L))
        self.r = D.rng(seed)
        self.swing8, self.swing16 = swing8, swing16
        self.cache = {}

    def time(self, beat):
        frac = beat % 1.0
        if self.swing8 and abs(frac - 0.5) < 1e-6:
            beat += self.swing8 / 6.0
        if self.swing16 and (abs(frac - 0.25) < 1e-6 or abs(frac - 0.75) < 1e-6):
            beat += self.swing16 / 12.0
        return beat * self.spb

    def add(self, mono, beat, gain=1.0, pan=0.0, rev=0.15, jitter=0.005):
        t = self.time(beat) + (self.r.normal(0, jitter) if jitter else 0)
        s = int(round(t * D.SR)) % self.L
        st = D.pan(mono * gain, pan)
        wrap_add(self.dry, st, s)
        if rev:
            wrap_add(self.send, st * rev, s)

    def note(self, inst, m, beat, beats, vel=1.0, gain=1.0, pan=0.0, rev=0.15, jitter=0.005, humanize=0.06, **kw):
        v = vel * (1 + self.r.normal(0, humanize)) if humanize else vel
        v = float(np.clip(v, 0.2, 1.3))
        dur = beats * self.spb
        f = D.hz(m)
        key = (inst.__name__, round(f, 3), round(dur, 4), round(v, 2), tuple(sorted(kw.items())))
        x = self.cache.get(key)
        if x is None:
            x = inst(f, dur, v, **kw)
            self.cache[key] = x
        self.add(x, beat, gain, pan, rev, jitter)

    def drum(self, fn, beat, gain=1.0, pan=0.0, rev=0.1, vel=1.0, jitter=0.004, humanize=0.08, **kw):
        v = float(np.clip(vel * (1 + self.r.normal(0, humanize)), 0.1, 1.3))
        key = (fn.__name__, round(v, 2), tuple(sorted(kw.items())))
        x = self.cache.get(key)
        if x is None:
            x = fn(v, **kw)
            self.cache[key] = x
        self.add(x, beat, gain, pan, rev, jitter)

    def pattern(self, fn, pat, bars=None, gain=1.0, pan=0.0, rev=0.1, accent=None, start_bar=0, **kw):
        """pat: one bar of steps, e.g. 'x...x...x...x...' (16ths). x=hit X=accent o=ghost. Repeats over bars."""
        bars = bars if bars is not None else self.bars
        steps = len(pat)
        for b in range(start_bar, start_bar + bars):
            for i, ch in enumerate(pat):
                if ch in 'xXo':
                    vel = {'x': 0.8, 'X': 1.0, 'o': 0.4}[ch]
                    self.drum(fn, b * self.bpb + i * self.bpb / steps, gain, pan, rev, vel=vel, **kw)

    def melody(self, inst, text, start_beat=0, octave_shift=0, **kw):
        for beat, beats, m in parse_melody(text, start_beat):
            self.note(inst, m + 12 * octave_shift, beat, beats, **kw)

    def render(self, rev_sec=1.8, rev_mix=0.8, damp=6500, rms=-17.0, width=1.0, extra=None, low_share_db=-5.0):
        wet = np.vstack([D.reverb_circular(self.send[0], 1.0, rev_sec, 11, damp) - self.send[0] * 0.5,
                         D.reverb_circular(self.send[1], 1.0, rev_sec, 23, damp) - self.send[1] * 0.5])
        out = self.dry + wet * rev_mix
        if extra is not None:
            out += extra
        if width != 1.0:
            mid = (out[0] + out[1]) / 2
            side = (out[0] - out[1]) / 2 * width
            out = np.vstack([mid + side, mid - side])
        # remove DC circularly (keeps loop seamless), tame the sub band, then level + limit
        out = np.vstack([D.fft_filter(c, D.band_gain(lo=25, order=2)) for c in out])
        out = D.tame_lows(out, low_share_db)
        out *= 10 ** ((rms - D.rms_db(out)) / 20)
        # limiter on a 3x tiled copy, keep the middle, so the limiter's state is periodic too
        tiled = np.concatenate([out, out, out], axis=1)
        lim = D.limiter(tiled, 10 ** (-1.0 / 20), release=0.06)
        return lim[:, self.L:2 * self.L]


def parse_melody(text, start_beat=0):
    """'E5:1 G5:.5 r:.5 C6:2' -> [(beat, beats, midi)]. '|' separators are ignored. 'C5+E5:1' = dyad."""
    out = []
    beat = start_beat
    for tok in text.replace('|', ' ').split():
        name, _, ln = tok.partition(':')
        beats = float(ln) if ln else 1.0
        if name not in ('r', '-'):
            for nm in name.split('+'):
                out.append((beat, beats, D.midi(nm)))
        beat += beats
    return out


def bars_of(chords, bpb=4):
    """['C', 'Am', 'F:2 G:2'] -> [(beat, beats, name)]"""
    out = []
    for b, spec in enumerate(chords):
        beat = b * bpb
        for part in spec.split():
            name, _, ln = part.partition(':')
            beats = float(ln) if ln else bpb
            out.append((beat, beats, name))
            beat += beats
    return out


def walking_bass(mix, chords, inst=I.upright, octave=2, gain=1.0, vel=0.9, pan=-0.1, rev=0.08):
    seq = bars_of(chords)
    for i, (beat, beats, name) in enumerate(seq):
        root, notes = chord(name, octave)
        nxt_root, _ = chord(seq[(i + 1) % len(seq)][2], octave)
        tones = [root, notes[1] if len(notes) > 1 else root + 7, notes[2], nxt_root + (1 if (i % 2) else -1)]
        if beats < 4:
            tones = [root, nxt_root + (1 if i % 2 else -1)] if beats == 2 else [root]
        for k, m in enumerate(tones[: int(beats)]):
            if m > 52:
                m -= 12
            mix.note(inst, m, beat + k, 0.95, vel=vel * (1.05 if k == 0 else 0.92), gain=gain, pan=pan, rev=rev)


def chord(name, octave=3):
    return D.chord(name, octave)


# =================================================================================================
# Songs
# =================================================================================================
def happy_day():
    m = Mix(116, 16, seed=11)
    ch = ['C', 'G', 'Am', 'F', 'C', 'G', 'F:2 G:2', 'C'] * 2
    prev = None
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 3)
        v = D.voice_lead(prev, notes, 60, 72)
        prev = v
        # ukulele strum: D . D U . U D U
        for off, vel, down in [(0, 1.0, 1), (1, 0.8, 1), (1.5, 0.6, 0), (2.5, 0.65, 0), (3, 0.85, 1), (3.5, 0.6, 0)]:
            if off >= beats:
                continue
            order = v if down else v[::-1]
            for k, n in enumerate(order):
                key = ('uke', n, vel)
                if key not in m.cache:
                    m.cache[key] = I.pluck(D.hz(n), 0.45, vel * 0.8, bright=0.8, decay=0.55)
                m.add(m.cache[key], beat + off + k * 0.012 / m.spb, 0.5, pan=0.25, rev=0.12, jitter=0.002)
        # bass: root on 1, fifth on 3
        m.note(I.sine_bass, root - 12, beat, 1.5 if beats == 4 else 1.0, vel=0.9, rev=0.02)
        if beats == 4:
            m.note(I.sine_bass, root - 12 + 7, beat + 2, 1.0, vel=0.8, rev=0.02)
            m.note(I.sine_bass, root - 12 + 12, beat + 3.5, 0.5, vel=0.6, rev=0.02)
    mel = ('E5:.5 G5:.5 C6:1 B5:.5 A5:.5 G5:1 | D5:.5 G5:.5 B5:1 A5:.5 G5:.5 D5:1 | C5:.5 E5:.5 A5:1 G5:.5 E5:.5 C5:1 | '
           'A4:1 C5:1 F5:1 E5:.5 D5:.5 | E5:.5 G5:.5 C6:1 D6:.5 C6:.5 G5:1 | B5:.5 A5:.5 G5:1 D5:1 G5:1 | '
           'A5:.5 G5:.5 F5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D5:.5 | C5:2 r:2')
    m.melody(I.glock, mel, 0, gain=0.55, pan=-0.2, rev=0.25)
    m.melody(I.glock, mel.replace('C5:2 r:2', 'C5:1 E5:1 G5:1 r:1'), 32, gain=0.5, pan=-0.2, rev=0.25)
    m.melody(I.flute, mel, 32, octave_shift=-1, gain=0.5, pan=0.1, rev=0.25)
    m.pattern(I.kick, 'x.......x.......', gain=0.9)
    m.pattern(I.clap, '....x.......x...', gain=0.5, pan=0.05, rev=0.2)
    m.pattern(I.shaker, 'xoxoxoxoxoxoxoxo', gain=0.5, pan=-0.35)
    m.pattern(I.tambourine, '....x.......x...', gain=0.35, pan=0.4, bars=8, start_bar=8)
    return m.render(rev_sec=1.4, rms=-17)


def calm_breeze():
    m = Mix(76, 8, seed=12)
    ch = ['Fmaj7', 'Am7', 'Bbmaj7', 'C', 'Fmaj7', 'Dm7', 'Gm7', 'Csus4']
    prev = None
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 3)
        v = D.voice_lead(prev, notes, 57, 72)
        prev = v
        arp = v + v[-2:0:-1] if len(v) > 2 else v
        for k in range(8):
            m.note(I.epiano, arp[k % len(arp)], beat + k * 0.5, 0.9, vel=0.55 if k % 2 else 0.7, gain=0.8, pan=-0.25 + 0.5 * ((k % 4) / 3), rev=0.3, trem=0.25)
        for n in v:
            m.note(I.strings, n, beat, 4.0, vel=0.5, gain=0.25, pan=0.3, rev=0.4, attack=1.0, release=1.2, cutoff=1800)
        m.note(I.sine_bass, root - 12, beat, 3.5, vel=0.7, rev=0.03)
    mel = ('C5:1.5 A4:.5 G4:1 F4:1 | E4:2 G4:1 A4:1 | D5:1.5 C5:.5 A4:2 | G4:3 r:1 | C5:1.5 D5:.5 E5:1 F5:1 | '
           'D5:2 A4:2 | Bb4:1 A4:1 G4:1 F4:1 | G4:3 r:1')
    m.melody(I.flute, mel, 0, gain=0.6, pan=0.1, rev=0.35)
    m.pattern(I.shaker, 'x.o.x.o.x.o.x.o.', gain=0.25, pan=-0.4)
    return m.render(rev_sec=2.6, rms=-19)


def sad_rain():
    m = Mix(66, 8, seed=13)
    ch = ['Am', 'F', 'C', 'G', 'Dm', 'Am', 'F', 'E']
    prev = None
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 3)
        for k in range(8):
            n = [root - 12, notes[2] - 12, notes[1], notes[2]][k % 4] if k < 4 else [root - 12, notes[2] - 12, notes[1], notes[2]][(7 - k) % 4]
            m.note(I.piano, n, beat + k * 0.5, 0.9, vel=0.5 if k % 2 else 0.62, gain=0.8, pan=-0.15, rev=0.3)
        v = D.voice_lead(prev, notes, 55, 70)
        prev = v
        for n in v:
            m.note(I.strings, n, beat, 4.0, vel=0.45, gain=0.28, pan=0.25, rev=0.45, attack=1.2, release=1.4, cutoff=1600)
        m.note(I.strings, root - 24, beat, 4.0, vel=0.6, gain=0.35, pan=-0.05, rev=0.3, attack=0.4, release=0.8, cutoff=900, voices=3)
    mel = ('C5:1 B4:.5 A4:.5 E5:2 | F5:1 E5:.5 D5:.5 C5:2 | E5:1 D5:.5 C5:.5 G4:2 | B4:1.5 C5:.5 D5:2 | '
           'F5:1 E5:.5 D5:.5 A5:2 | E5:1.5 C5:.5 A4:2 | A4:1 C5:1 F5:1 E5:1 | D5:1 C5:.5 B4:.5 G#4:2')
    m.melody(I.piano, mel, 0, gain=0.85, pan=0.1, rev=0.35, vel=0.8)
    return m.render(rev_sec=3.0, rms=-19)


def tense_suspense():
    m = Mix(100, 8, seed=14)
    roots = ['D2', 'D2', 'Bb1', 'A1', 'D2', 'D2', 'Eb2', 'A1']
    for b, r in enumerate(roots):
        rm = D.midi(r)
        for k, iv in enumerate([0, 0, 12, 0, 10, 0, 13, 0]):
            m.note(I.staccato_strings, rm + 12 + iv, b * 4 + k * 0.5, 0.4, vel=0.85 if k == 0 else 0.65, gain=0.9, pan=-0.2, rev=0.2)
        m.note(I.synth_bass, rm, b * 4, 1.5, vel=0.7, gain=0.6, rev=0.05, cutoff=2.0)
        if b in (0, 4):
            m.add(I.timpani(D.hz(rm + 12), 1.0, 2.0), b * 4, 0.9, rev=0.35)
        if b == 7:
            for k in range(8):
                m.drum(I.tom, b * 4 + 2 + k * 0.25, gain=0.35 + k * 0.05, f=90 + k * 6, rev=0.25)
    # high tremolo violins: minor second cluster that slowly swells (dread)
    for b in range(0, 8, 2):
        for n, p in ((D.midi('D6'), -0.5), (D.midi('Eb6'), 0.5)):
            x = I.strings(D.hz(n), 8 * m.spb, 0.4, attack=3.0, release=1.5, cutoff=5000, voices=3)
            t = D.tvec(len(x) / D.SR)
            x *= 0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)
            m.add(x, b * 4, 0.32, pan=p, rev=0.5)
    m.pattern(I.hat, 'x.o.x.o.x.o.xooo', gain=0.35, pan=0.35)
    m.pattern(I.kick, 'x..x....x.......', gain=0.7, decay=0.5, tone=0.8)
    return m.render(rev_sec=2.4, rms=-18)


def spooky_mystery():
    """Sneaky minor-blues: walking bass, organ stabs, gliding theremin, swinging brushes."""
    m = Mix(112, 12, seed=15, swing8=0.75)
    ch = ['Em', 'Em', 'Em', 'Em', 'Am', 'Am', 'Em', 'Em', 'C7', 'B7', 'Em', 'B7']
    walking_bass(m, ch, gain=1.0)
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name.replace('Em', 'Em6').replace('Am', 'Am6') if name in ('Em', 'Am') else name, 4)
        v = D.voice_lead(None, notes, 59, 72)
        for off in (1.5, 3.5):
            for n in v:
                m.note(I.organ, n, beat + off, 0.3, vel=0.7, gain=0.32, pan=0.3, rev=0.25, bars=(0, 0, 8, 6, 0, 4, 0, 0, 2), click=0.6)
    mel = ('E5:1.5 G5:.5 B5:2 | Bb5:1 A5:1 G5:1 E5:1 | D5:1 E5:3 | r:2 B4:1 D5:1 | E5:1.5 A5:.5 C6:2 | B5:1 A5:1 G5:1 E5:1 | '
           'G5:1.5 F#5:.5 E5:2 | r:2 E5:.5 G5:.5 B5:1 | C6:2 Bb5:1 G5:1 | A5:1 F#5:1 D#5:2 | E5:4 | r:2 D#5:1 F#5:1')
    notes = [(m.time(b), bb * m.spb * 0.98, D.hz(n)) for b, bb, n in parse_melody(mel)]
    th = I.theremin_line(notes, m.sec, glide=0.12, vib_rate=6.0, vib_depth=0.014)
    m.add(th, 0, 0.75, pan=-0.15, rev=0.45, jitter=0)
    # vibraphone shadows the melody an octave down, sparsely
    m.melody(I.vibes, mel, 0, octave_shift=-1, gain=0.25, pan=0.35, rev=0.35)
    # swing brushes + ride
    for b in range(m.bars):
        for beat in range(4):
            m.drum(I.ride, b * 4 + beat, gain=0.4, pan=0.3, rev=0.1, vel=0.8 if beat % 2 else 0.65)
            if beat in (1, 3):
                m.drum(I.ride, b * 4 + beat + 0.5, gain=0.32, pan=0.3, rev=0.1, vel=0.5)
                m.drum(I.brush, b * 4 + beat, gain=0.7, pan=-0.1, rev=0.15)
            m.drum(I.kick, b * 4 + beat, gain=0.35, vel=0.5, decay=0.25)
        m.drum(I.brush, b * 4, gain=0.4, pan=-0.1, sweep=True)
    return m.render(rev_sec=2.2, rms=-18)


def haunted_chase():
    """Fast 60s garage-organ chase in E minor (cartoon ghost chase)."""
    m = Mix(168, 16, seed=16)
    ch = ['Em', 'Em', 'G', 'A', 'Em', 'Em', 'C', 'B7'] * 2
    riff = [0, 0, 3, 0, 5, 0, 6, 5]  # E E G E A E Bb A
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 2)
        pat = riff if name.startswith('E') else [0, 0, 7, 0, 12, 0, 7, 0]
        for k, iv in enumerate(pat):
            m.note(I.synth_bass, root + iv, beat + k * 0.5, 0.45, vel=0.9 if k % 2 == 0 else 0.75, gain=0.8, rev=0.03, cutoff=4.0, decay=0.1)
        v = D.voice_lead(None, chord(name, 4)[1], 60, 74)
        for off in (0.5, 1.5, 2.5, 3.5):
            for n in v:
                m.note(I.farfisa, n, beat + off, 0.35, vel=0.7, gain=0.18, pan=0.35, rev=0.2)
    mel = ('E5:.5 G5:.5 A5:.5 Bb5:.5 B5:1 r:1 | B5:.5 A5:.5 G5:.5 E5:.5 G5:1 E5:1 | D5:.5 G5:.5 B5:.5 D6:.5 B5:1 G5:1 | '
           'A5:.5 C#6:.5 E6:.5 C#6:.5 A5:2 | E5:.5 G5:.5 A5:.5 Bb5:.5 B5:1 r:1 | B5:.5 D6:.5 E6:1 D6:.5 B5:.5 G5:1 | '
           'G5:.5 E5:.5 C5:.5 E5:.5 G5:1 C6:1 | B5:1 A5:.5 F#5:.5 D#5:2')
    m.melody(I.farfisa, mel, 0, gain=0.55, pan=-0.2, rev=0.25)
    m.melody(I.farfisa, mel, 32, gain=0.5, pan=-0.2, rev=0.25)
    m.melody(I.brass, mel, 32, octave_shift=-1, gain=0.3, pan=0.15, rev=0.2)
    m.pattern(I.kick, 'x.....x.x.......', gain=0.9)
    m.pattern(I.snare, '....x.......x...', gain=0.7, pan=0.05, rev=0.15)
    m.pattern(I.hat, 'x.x.x.x.x.x.x.xx', gain=0.5, pan=0.3)
    m.pattern(I.tambourine, '....x.......x...', gain=0.35, pan=-0.4)
    for b in (7, 15):  # fills into the loop point
        for k in range(4):
            m.drum(I.tom, b * 4 + 3 + k * 0.25, gain=0.5, f=140 - k * 18, rev=0.2)
    m.drum(I.crash, 0, gain=0.5, pan=0.2, rev=0.2)
    m.drum(I.crash, 32, gain=0.5, pan=-0.2, rev=0.2)
    return m.render(rev_sec=1.6, rms=-16.5)


def action_chase():
    m = Mix(150, 16, seed=17)
    ch = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'] * 2
    prev = None
    for bi, (beat, beats, name) in enumerate(bars_of(ch)):
        root, notes = chord(name, 2)
        for k in range(16):
            iv = 12 if k % 4 == 2 else 0
            m.note(I.synth_bass, root + iv, beat + k * 0.25, 0.22, vel=0.95 if k % 4 == 0 else 0.7, gain=0.7, rev=0.02, cutoff=3.0, decay=0.07, jitter=0.002)
        v = D.voice_lead(prev, chord(name, 4)[1], 62, 76)
        prev = v
        for k in range(8):
            for n in v:
                m.note(I.staccato_strings, n, beat + k * 0.5, 0.3, vel=0.8 if k % 2 == 0 else 0.6, gain=0.22, pan=0.3, rev=0.2)
        if bi >= 8:  # brass stabs on the second pass
            for off in (0, 1.5, 3):
                for n in D.voice_lead(None, chord(name, 3)[1], 55, 67):
                    m.note(I.brass, n, beat + off, 0.4, vel=0.9, gain=0.3, pan=-0.25, rev=0.2)
    mel = ('D5:1.5 A4:.5 D5:1 F5:1 | E5:1.5 D5:.5 C5:1 A4:1 | Bb4:1.5 D5:.5 F5:1 Bb5:1 | A5:1.5 G5:.5 E5:2 | '
           'F5:1.5 E5:.5 D5:1 A5:1 | G5:.5 F5:.5 E5:.5 D5:.5 A4:2 | Bb4:1 D5:1 G5:1 Bb5:1 | A5:3 r:1')
    m.melody(I.brass, mel, 0, gain=0.6, pan=-0.1, rev=0.25)
    m.melody(I.strings, mel, 32, octave_shift=0, gain=0.45, pan=0.1, rev=0.3, attack=0.05, release=0.3, cutoff=5000)
    m.pattern(I.kick, 'x.....x...x.....', gain=0.9)
    m.pattern(I.snare, '....x.......x..o', gain=0.75, rev=0.15)
    m.pattern(I.hat, 'xxxxxxxxxxxxxxxx', gain=0.32, pan=0.35)
    for b in (7, 15):
        for k in range(8):
            m.drum(I.tom, b * 4 + 2 + k * 0.25, gain=0.55, f=160 - k * 12, rev=0.2)
    m.drum(I.crash, 0, gain=0.55, pan=0.3)
    m.drum(I.crash, 32, gain=0.55, pan=-0.3)
    for b in range(0, 16, 2):
        m.drum(I.taiko, b * 4, gain=0.5, rev=0.3)
    return m.render(rev_sec=1.8, rms=-16)


def quirky_comedy():
    m = Mix(108, 8, seed=18)
    ch = ['G', 'D7', 'G', 'C', 'G', 'E7', 'A7:2 D7:2', 'G']
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 2)
        if beats == 4:
            seq = [(0, root), (2, root + 7 if root + 7 < 52 else root - 5)]
        else:
            seq = [(0, root)]
        for off, n in seq:
            m.note(I.bassoon, n, beat + off, 0.45, vel=0.9, gain=0.9, pan=-0.15, rev=0.1)
        v = D.voice_lead(None, chord(name, 4)[1], 59, 71)
        for off in ((1, 3) if beats == 4 else (1,)):
            for n in v:
                m.note(I.pizz, n, beat + off, 0.3, vel=0.8, gain=0.45, pan=0.3, rev=0.15)
    mel = ('D5:.5 r:.5 B4:.5 r:.5 G4:.5 A4:.5 B4:.5 D5:.5 | C5:.5 r:.5 A4:.5 r:.5 F#4:.5 G4:.5 A4:.5 C5:.5 | '
           'B4:.5 D5:.5 G5:.5 D5:.5 B4:1 r:1 | E5:.5 r:.5 C5:.5 r:.5 E5:.5 F#5:.5 G5:1 | '
           'D5:.5 B4:.5 D5:.5 B4:.5 G4:1 B4:1 | G#4:.5 B4:.5 D5:.5 E5:.5 D5:1 B4:1 | '
           'C#5:.5 E5:.5 A5:.5 G5:.5 F#5:.5 E5:.5 D5:.5 C5:.5 | B4:.5 r:.5 G4:.5 r:.5 G5:.5 r:1.5')
    m.melody(I.xylo, mel, 0, gain=0.75, pan=0.05, rev=0.15)
    m.melody(I.xylo, mel, 0, octave_shift=1, gain=0.18, pan=0.2, rev=0.15)
    m.pattern(I.woodblock, 'x...o.o.x...o...', gain=0.4, pan=-0.35, f=1100)
    m.pattern(I.kick, 'x.......x.......', gain=0.5, decay=0.2)
    m.pattern(I.snare, '....o.......o...', gain=0.3, snappy=0.6)
    return m.render(rev_sec=1.2, rms=-17.5)


def romantic_evening():
    m = Mix(68, 8, seed=19)
    ch = ['Bbmaj7', 'Gm7', 'Ebmaj7', 'F7', 'Bbmaj7', 'Dm7', 'Ebmaj7', 'F']
    prev = None
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 3)
        pat = [root - 12, root - 5, notes[1], notes[2], notes[-1] if len(notes) > 3 else notes[0] + 12, notes[2], notes[1], root - 5]
        for k, n in enumerate(pat):
            m.note(I.piano, n, beat + k * 0.5, 1.2, vel=0.55 if k else 0.68, gain=0.75, pan=-0.2, rev=0.35)
        v = D.voice_lead(prev, notes, 58, 72)
        prev = v
        for n in v:
            m.note(I.strings, n, beat, 4.0, vel=0.5, gain=0.28, pan=0.25, rev=0.45, attack=0.9, release=1.2, cutoff=2400)
        m.note(I.strings, root - 24, beat, 4.0, vel=0.6, gain=0.3, rev=0.3, attack=0.3, release=0.8, cutoff=800, voices=3)
    mel = ('D5:1.5 C5:.5 Bb4:1 F5:1 | G5:2 F5:1 D5:1 | G5:1.5 F5:.5 Eb5:1 D5:1 | C5:3 r:1 | '
           'D5:1.5 Eb5:.5 F5:1 Bb5:1 | A5:2 F5:1 D5:1 | G5:1 F5:1 Eb5:1 D5:1 | C5:2 A4:1 C5:1')
    m.melody(I.flute, mel, 0, gain=0.7, pan=0.1, rev=0.4)
    return m.render(rev_sec=2.8, rms=-19)


def epic_quest():
    m = Mix(92, 8, seed=20)
    ch = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A']
    prev = None
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 2)
        for k in range(8):
            m.note(I.staccato_strings, root + 12 + (7 if k in (3, 6) else 0), beat + k * 0.5, 0.3, vel=0.9 if k % 2 == 0 else 0.7, gain=0.7, pan=-0.25, rev=0.25)
        m.note(I.strings, root, beat, 4, vel=0.7, gain=0.45, rev=0.3, attack=0.2, release=0.6, cutoff=900, voices=3)
        v = D.voice_lead(prev, chord(name, 4)[1], 60, 74)
        prev = v
        for n in v:
            m.note(I.choir, n, beat, 4, vel=0.6, gain=0.3, pan=0.3, rev=0.5)
        for n in D.voice_lead(None, chord(name, 3)[1], 53, 65):
            m.note(I.brass, n, beat, 1.5, vel=0.7, gain=0.18, pan=-0.3, rev=0.35)
    mel = ('D5:2 A4:1 D5:1 | F5:2 E5:1 D5:1 | C5:2 A4:1 C5:1 | G5:2 E5:1 C5:1 | D5:2 F5:1 A5:1 | Bb5:2 A5:1 F5:1 | '
           'G5:1.5 A5:.5 Bb5:1 G5:1 | A5:3 r:1')
    m.melody(I.brass, mel, 0, gain=0.55, pan=0.05, rev=0.35)
    for b in range(8):
        m.drum(I.taiko, b * 4, gain=0.9, rev=0.35)
        m.drum(I.taiko, b * 4 + 1.5, gain=0.45, rev=0.35, f=80)
        m.drum(I.taiko, b * 4 + 2.5, gain=0.6, rev=0.35, f=70)
        if b % 2 == 1:
            for k in range(4):
                m.drum(I.taiko, b * 4 + 3 + k * 0.25, gain=0.35 + 0.08 * k, rev=0.35, f=95)
    m.add(I.timpani(D.hz('D2'), 1.0, 2.0), 0, 0.7, rev=0.3)
    m.drum(I.crash, 0, gain=0.4, rev=0.4)
    m.add(I.timpani(D.hz('A1'), 1.0, 2.0), 28, 0.7, rev=0.3)
    return m.render(rev_sec=3.0, rms=-16.5)


def lofi_study():
    m = Mix(82, 8, seed=21, swing16=0.55, swing8=0.0)
    ch = ['Dm9', 'G9', 'Cmaj9', 'Am7', 'Dm9', 'G9', 'Cmaj9', 'A7b9']
    prev = None
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 3)
        v = D.voice_lead(prev, [n for n in notes if n != root] + [root], 57, 74)
        prev = v
        for off, dur in ((0, 1.4), (1.75, 0.6), (2.5, 1.4)):
            for k, n in enumerate(v):
                m.note(I.epiano, n, beat + off + k * 0.012, dur, vel=0.55, gain=0.65, pan=-0.15, rev=0.25, jitter=0.008)
        m.note(I.sine_bass, root - 12, beat, 1.5, vel=0.85, rev=0.0)
        m.note(I.sine_bass, root - 12 + 7, beat + 2.5, 1.0, vel=0.7, rev=0.0)
    mel = ('r:.5 E5:.5 F5:.5 A5:1 r:1.5 | r:.5 B5:.5 A5:.5 F5:1 D5:.5 r:1 | E5:1.5 D5:.5 B4:1 r:1 | r:2 C5:.5 E5:.5 G5:1 | '
           'A5:1.5 G5:.5 F5:.5 E5:.5 r:1 | D5:1 F5:.5 A5:.5 r:2 | G5:1 E5:1 D5:.5 B4:.5 r:1 | C#5:2 r:2')
    m.melody(I.bell, mel, 0, gain=0.4, pan=0.25, rev=0.35, decay=0.8)
    m.pattern(I.kick, 'x.....x...x.....', gain=0.9, decay=0.25, punch=0.5)
    m.pattern(I.snare, '....x.......x...', gain=0.5, snappy=0.5, decay=0.09)
    m.pattern(I.hat, 'x.x.x.x.x.x.x.x.', gain=0.3, pan=0.3)
    m.pattern(I.rim, '.......o......o.', gain=0.25, pan=-0.3)
    out = m.render(rev_sec=1.6, rms=-18)
    # lofi character: soft lowpass, a touch of saturation and vinyl crackle (all periodic)
    out = np.vstack([D.fft_filter(c, D.band_gain(lo=35, hi=5500, order=1)) for c in out])
    r = D.rng(99)
    crack = np.zeros(m.L)
    for _ in range(int(m.sec * 9)):
        p = r.integers(0, m.L)
        crack[p] = r.uniform(-1, 1) * (r.uniform() ** 3)
    crack = D.fft_filter(crack, D.band_gain(lo=1500, hi=7000)) * 0.6
    hiss = D.fft_filter(D.white(n=m.L, r=r), D.band_gain(lo=3000, hi=9000)) * 0.012
    out = out + crack + hiss
    out = np.tanh(out * 1.3) / 1.3
    tiled = np.concatenate([out, out, out], axis=1)
    return D.limiter(tiled, 10 ** (-1 / 20))[:, m.L:2 * m.L]


def jazzy_cafe():
    m = Mix(132, 16, seed=22, swing8=0.7)
    ch = ['Fmaj7', 'D7', 'Gm7', 'C7', 'Am7', 'D7', 'Gm7', 'C7', 'Fmaj7', 'F7', 'Bbmaj7', 'Bbm7', 'Am7', 'D7', 'Gm7', 'C7']
    walking_bass(m, ch, gain=1.05)
    prev = None
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 3)
        shell = [n for n in notes[1:]]  # rootless voicing
        v = D.voice_lead(prev, shell, 57, 70)
        prev = v
        for off, dur in ((0, 1.2), (1.5, 0.4)) if (beat // 4) % 2 == 0 else ((0.5, 0.4), (2.5, 1.0)):
            for n in v:
                m.note(I.epiano, n, beat + off, dur, vel=0.5, gain=0.55, pan=-0.3, rev=0.2)
    mel = ('A4:1 C5:1 E5:1.5 F5:.5 | F#5:1.5 E5:.5 D5:1 A4:1 | Bb4:1 D5:1 F5:1.5 E5:.5 | E5:1 G5:1 Bb5:1 G5:1 | '
           'A5:2 G5:1 E5:1 | F#5:1 A5:1 C6:1 A5:1 | Bb5:1.5 A5:.5 G5:1 F5:1 | E5:3 r:1 | '
           'C5:1 F5:1 A5:1.5 G5:.5 | Eb5:2 C5:1 A4:1 | D5:1 F5:1 A5:1.5 Bb5:.5 | Db5:2 F5:1 Ab5:1 | '
           'G5:1.5 E5:.5 C5:1 A4:1 | C5:1 D5:1 F#5:1 A5:1 | G5:1 F5:1 D5:1 Bb4:1 | C5:2 E5:1 G5:1')
    m.melody(I.vibes, mel, 0, gain=0.6, pan=0.25, rev=0.3)
    for b in range(m.bars):
        for beat in range(4):
            m.drum(I.ride, b * 4 + beat, gain=0.38, pan=0.35, rev=0.08, vel=0.85 if beat % 2 else 0.7)
            if beat in (1, 3):
                m.drum(I.ride, b * 4 + beat + 0.5, gain=0.3, pan=0.35, rev=0.08, vel=0.5)
                m.drum(I.hat, b * 4 + beat, gain=0.35, pan=0.2, vel=0.6, decay=0.02)
                m.drum(I.brush, b * 4 + beat, gain=0.45, pan=-0.1)
            m.drum(I.kick, b * 4 + beat, gain=0.25, vel=0.4, decay=0.2)
    return m.render(rev_sec=1.5, rms=-18)


def retro_8bit():
    m = Mix(150, 16, seed=23)
    ch = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F:2 G:2', 'C'] * 2
    for beat, beats, name in bars_of(ch):
        root, notes = chord(name, 4)
        for k in range(int(beats * 4)):
            n = notes[k % 3] + (12 if (k // 3) % 2 else 0)
            m.note(I.pulse_lead, n, beat + k * 0.25, 0.22, vel=0.55, gain=0.45, pan=0.25, rev=0.02, width=0.125, vib=False, humanize=0, jitter=0)
        r2 = root - 24
        for k in range(int(beats * 2)):
            m.note(I.tri_bass, r2 + (12 if k % 2 else 0), beat + k * 0.5, 0.45, vel=0.9, gain=0.9, rev=0.0, humanize=0, jitter=0)
    mel = ('C5:.5 E5:.5 G5:.5 C6:.5 G5:1 E5:1 | A5:.5 G5:.5 E5:.5 C5:.5 E5:1 A4:1 | F5:.5 A5:.5 C6:.5 A5:.5 F5:1 C5:1 | '
           'D5:.5 G5:.5 B5:.5 D6:.5 B5:2 | E6:.5 D6:.5 C6:.5 G5:.5 E5:1 G5:1 | A5:1 C6:.5 A5:.5 E5:2 | '
           'F5:.5 A5:.5 C6:1 B5:.5 G5:.5 D5:1 | C6:2 r:2')
    m.melody(I.pulse_lead, mel, 0, gain=0.65, pan=-0.15, rev=0.05, width=0.5, humanize=0, jitter=0)
    m.melody(I.pulse_lead, mel, 32, gain=0.6, pan=-0.15, rev=0.05, width=0.25, humanize=0, jitter=0)
    m.melody(I.pulse_lead, mel, 32.75, gain=0.18, pan=0.4, rev=0.0, width=0.25, humanize=0, jitter=0)  # echo
    m.pattern(I.chip_kick, 'x.......x.x.....', gain=0.9, rev=0, humanize=0)
    m.pattern(I.chip_noise, '....x.......x...', gain=0.6, rev=0, decay=0.09)
    m.pattern(I.chip_noise, 'x.x.x.x.x.x.x.x.', gain=0.25, rev=0, decay=0.02)
    return m.render(rev_sec=0.6, rev_mix=0.3, rms=-17)


SONGS = {
    'happy_day': (happy_day, 'Happy Day', ['happy', 'upbeat', 'ukulele', 'bright']),
    'calm_breeze': (calm_breeze, 'Calm Breeze', ['calm', 'gentle', 'relaxed', 'electric piano']),
    'sad_rain': (sad_rain, 'Sad Rain', ['sad', 'piano', 'emotional', 'slow']),
    'tense_suspense': (tense_suspense, 'Tense Suspense', ['tense', 'suspense', 'thriller', 'strings']),
    'spooky_mystery': (spooky_mystery, 'Spooky Mystery', ['spooky', 'mystery', 'sneaky', 'haunted', 'blackthorn', 'theremin']),
    'haunted_chase': (haunted_chase, 'Haunted Chase', ['spooky', 'chase', 'cartoon', 'organ', 'fast', 'blackthorn']),
    'action_chase': (action_chase, 'Action Chase', ['action', 'chase', 'fast', 'brass', 'drums']),
    'quirky_comedy': (quirky_comedy, 'Quirky Comedy', ['comedy', 'quirky', 'funny', 'xylophone', 'bouncy']),
    'romantic_evening': (romantic_evening, 'Romantic Evening', ['romantic', 'love', 'tender', 'flute', 'piano']),
    'epic_quest': (epic_quest, 'Epic Quest', ['epic', 'heroic', 'adventure', 'choir', 'drums']),
    'lofi_study': (lofi_study, 'Lofi Study', ['lofi', 'chill', 'study', 'beats']),
    'jazzy_cafe': (jazzy_cafe, 'Jazzy Cafe', ['jazz', 'cafe', 'swing', 'vibraphone', 'walking bass']),
    'retro_8bit': (retro_8bit, 'Retro 8-bit', ['8bit', 'chiptune', 'retro', 'game', 'arcade']),
}
