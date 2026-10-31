"""Small offline DSP toolkit for Filmly's procedural sound library (numpy + scipy).

Everything works on float64 numpy arrays in [-1, 1]. `SR` is a module global that generate.py sets
before rendering each category (SFX 44.1 kHz, music 32 kHz stereo, ambience 32 kHz).
All randomness goes through a seeded Generator so regeneration is reproducible.
"""
import numpy as np
from scipy import signal

SR = 44100


def rng(seed):
    return np.random.default_rng(seed)


def n_of(sec):
    return max(1, int(round(sec * SR)))


def tvec(sec):
    return np.arange(n_of(sec)) / SR


def silence(sec):
    return np.zeros(n_of(sec))


# ---- oscillators ------------------------------------------------------------------------------
def _freq_arr(freq, n):
    f = np.asarray(freq, dtype=float)
    return np.full(n, float(f)) if f.ndim == 0 else f[:n]


def phase_of(freq, sec=None, n=None, phase0=0.0):
    """Phase (in cycles) of an oscillator following a (possibly time varying) frequency."""
    n = n or (len(freq) if np.ndim(freq) else n_of(sec))
    f = _freq_arr(freq, n)
    return phase0 + np.cumsum(f) / SR - f[0] / SR


def sine(freq, sec=None, n=None, phase0=0.0):
    return np.sin(2 * np.pi * phase_of(freq, sec, n, phase0))


def _polyblep(t, dt):
    out = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    out[m] = x + x - x * x - 1.0
    m2 = t > 1.0 - dt
    x = (t[m2] - 1.0) / dt[m2]
    out[m2] = x * x + x + x + 1.0
    return out


def saw(freq, sec=None, n=None, phase0=0.0):
    ph = phase_of(freq, sec, n, phase0)
    n = len(ph)
    dt = np.clip(np.abs(_freq_arr(freq, n)) / SR, 1e-9, 0.5)
    t = ph % 1.0
    return (2.0 * t - 1.0) - _polyblep(t, dt)


def pulse(freq, sec=None, n=None, width=0.5, phase0=0.0, naive=False):
    ph = phase_of(freq, sec, n, phase0)
    t = ph % 1.0
    if naive:  # chiptune: deliberately aliased square
        return np.where(t < width, 1.0, -1.0)
    n = len(ph)
    dt = np.clip(np.abs(_freq_arr(freq, n)) / SR, 1e-9, 0.5)
    sq = np.where(t < width, 1.0, -1.0)
    sq += _polyblep(t, dt)
    sq -= _polyblep((t + 1.0 - width) % 1.0, dt)
    return sq


def tri(freq, sec=None, n=None, phase0=0.0, steps=0):
    t = phase_of(freq, sec, n, phase0) % 1.0
    x = 4 * np.abs(t - 0.5) - 1
    if steps:  # NES-style 4-bit triangle
        x = np.round((x + 1) / 2 * (steps - 1)) / (steps - 1) * 2 - 1
    return -x


def additive(f0, partials, sec, decays=None, phases=None, detune=None):
    """Sum of sine partials. partials: [(ratio, amp)], decays: per-partial decay times (s) or None."""
    t = tvec(sec)
    out = np.zeros_like(t)
    for i, (ratio, amp) in enumerate(partials):
        f = f0 * ratio * (1 + (detune[i] if detune is not None else 0))
        if f >= SR * 0.47:
            continue
        p = 0.0 if phases is None else phases[i]
        part = amp * np.sin(2 * np.pi * f * t + p)
        if decays is not None:
            part *= np.exp(-t / decays[i])
        out += part
    return out


# ---- noise ------------------------------------------------------------------------------------
def white(sec=None, n=None, r=None):
    r = r or rng(0)
    return r.standard_normal(n or n_of(sec)) * 0.3


def colored(sec=None, n=None, r=None, slope_db=-3.0):
    """Noise with power slope (dB/octave): -3 pink, -6 brown. Circular (periodic) by construction."""
    n = n or n_of(sec)
    r = r or rng(0)
    spec = np.fft.rfft(r.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    spec *= (f / 1000.0) ** (slope_db / 6.02)  # amplitude exponent: -3 dB/oct power -> f^-0.5
    x = np.fft.irfft(spec, n)
    return x / (np.std(x) + 1e-12) * 0.3


def pink(sec=None, n=None, r=None):
    return colored(sec, n, r, -3.0)


def brown(sec=None, n=None, r=None):
    return colored(sec, n, r, -6.0)


# ---- envelopes --------------------------------------------------------------------------------
def env(points, sec=None, n=None, curve=1.0):
    """Piecewise-linear envelope from [(time_s, level)]; curve>1 makes segments ease-in (exp-like)."""
    n = n or n_of(sec if sec is not None else points[-1][0])
    t = np.arange(n) / SR
    ts = [p[0] for p in points]
    vs = [p[1] for p in points]
    e = np.interp(t, ts, vs)
    return e ** curve if curve != 1.0 else e


def adsr(sec, a=0.005, d=0.1, s=0.7, r=0.1, n=None):
    n = n or n_of(sec)
    total = n / SR
    hold = max(total - r, a + d)
    pts = [(0, 0), (a, 1), (a + d, s), (hold, s), (hold + r, 0)]
    return env(pts, n=n)


def expdecay(sec, tau, attack=0.002, n=None):
    n = n or n_of(sec)
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    if attack > 0:
        e *= np.clip(t / attack, 0, 1)
    return e


def fade(x, fin=0.002, fout=0.01):
    x = x.copy()
    a, b = n_of(fin), n_of(fout)
    if a > 1:
        x[:a] *= np.linspace(0, 1, a)
    if b > 1:
        x[-b:] *= np.linspace(1, 0, b)
    return x


# ---- filters ----------------------------------------------------------------------------------
def _sos(kind, f, order=2, q=None):
    nyq = SR / 2
    if kind in ('bp', 'band'):
        lo, hi = f
        lo = max(lo, 10) / nyq
        hi = min(hi, nyq * 0.98) / nyq
        return signal.butter(order, [lo, hi], 'bandpass', output='sos')
    f = min(max(f, 5), nyq * 0.98) / nyq
    return signal.butter(order, f, 'lowpass' if kind == 'lp' else 'highpass', output='sos')


def lp(x, f, order=2):
    return signal.sosfilt(_sos('lp', f, order), x)


def hp(x, f, order=2):
    return signal.sosfilt(_sos('hp', f, order), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos('bp', (lo, hi), order), x)


def biquad_coef(kind, f, q, gain_db=0.0):
    """RBJ cookbook biquad. Returns b, a (normalised)."""
    f = min(max(f, 10.0), SR * 0.49)
    w = 2 * np.pi * f / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'bp':  # constant 0 dB peak gain
        b = [al, 0, -al]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'peak':
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def reso(x, f, q, kind='bp'):
    b, a = biquad_coef(kind, f, q)
    return signal.lfilter(b, a, x)


def sweep(x, kind, freq, q=0.707, block=64):
    """Time-varying biquad (filter sweep). freq: scalar or per-sample array."""
    n = len(x)
    fr = _freq_arr(freq, n)
    y = np.empty(n)
    zi = np.zeros(2)
    for s in range(0, n, block):
        e = min(n, s + block)
        b, a = biquad_coef(kind, float(fr[(s + e) // 2]), q)
        y[s:e], zi = signal.lfilter(b, a, x[s:e], zi=zi)
    return y


def fft_filter(x, gain_fn):
    """Zero-phase circular filter: gain_fn(freqs) -> amplitude gain. Keeps periodic signals periodic."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(spec * gain_fn(f), len(x))


def band_gain(lo=None, hi=None, order=2):
    def g(f):
        out = np.ones_like(f)
        if lo:
            out *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
        if hi:
            out *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
        return out
    return g


# ---- effects ----------------------------------------------------------------------------------
def reverb_ir(sec=1.6, decay=None, r=None, damp=6000, predelay=0.012, early=True):
    """Synthetic room impulse response: exponentially decaying filtered noise + a few early reflections."""
    r = r or rng(7)
    decay = decay or sec / 6.9  # -60 dB at `sec`
    n = n_of(sec)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / decay)
    # darker tail: progressively lowpassed (blend of bright + dark versions)
    dark = lp(ir, damp * 0.35, 1)
    mix = np.clip(t / sec * 2, 0, 1)
    ir = ir * (1 - mix) + dark * mix * 1.6
    ir = lp(ir, damp, 1)
    pd = n_of(predelay)
    ir = np.concatenate([np.zeros(pd), ir])
    if early:
        for k in range(6):
            pos = pd + int(r.uniform(0.003, 0.04) * SR)
            if pos < len(ir):
                ir[pos] += r.uniform(-1, 1) * 2.5
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-12
    return ir


def reverb(x, wet=0.25, sec=1.6, seed=7, damp=6000, predelay=0.012, tail=True):
    ir = reverb_ir(sec, r=rng(seed), damp=damp, predelay=predelay)
    if tail:
        x = np.concatenate([x, np.zeros(len(ir))])
    w = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - wet * 0.5) + w * wet


def reverb_circular(x, wet=0.25, sec=1.6, seed=7, damp=6000):
    """Reverb for loops: circular convolution, so the tail wraps around the loop point."""
    ir = reverb_ir(sec, r=rng(seed), damp=damp)
    n = len(x)
    L = n
    while L < len(ir):
        L += n
    irw = np.zeros(n)
    for k in range(0, len(ir), n):  # fold IR into one period
        seg = ir[k:k + n]
        irw[: len(seg)] += seg
    w = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(irw), n)
    return x * (1 - wet * 0.5) + w * wet


def delay(x, sec, fb=0.35, mix=0.3, n_taps=6, damp=4000, circular=False):
    d = n_of(sec)
    out = x.copy()
    tap = x.copy()
    for k in range(1, n_taps + 1):
        tap = lp(tap, damp, 1) * fb if k > 1 else tap * fb
        if circular:
            out += np.roll(tap, d * k) * mix / fb
        else:
            sh = np.zeros_like(x)
            if d * k < len(x):
                sh[d * k:] = tap[: len(x) - d * k]
            out += sh * mix / fb
    return out


def saturate(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def bitcrush(x, bits=6):
    q = 2 ** (bits - 1)
    return np.round(x * q) / q


# ---- mixing helpers ---------------------------------------------------------------------------
def place(dst, src, at_sec, gain=1.0, wrap=False):
    """Add src into dst starting at at_sec (grows dst unless wrap=True, which wraps around the loop)."""
    s = int(round(at_sec * SR))
    if wrap:
        n = len(dst)
        s %= n
        idx = (np.arange(len(src)) + s) % n
        np.add.at(dst, idx, src * gain)
        return dst
    if s < 0:
        src = src[-s:]
        s = 0
    end = s + len(src)
    if end > len(dst):
        dst = np.concatenate([dst, np.zeros(end - len(dst))])
    dst[s:end] += src * gain
    return dst


def mixdown(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def pan(x, p):
    """Mono -> stereo (2, n) with equal-power pan p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.vstack([x * np.cos(a), x * np.sin(a)])


def remove_dc(x, f=18):
    return hp(x, f, 2) if x.ndim == 1 else np.vstack([hp(c, f, 2) for c in x])


def limiter(x, ceiling=0.89, release=0.08, look=0.003):
    """Soft look-ahead peak limiter (works on mono or (2, n))."""
    from scipy.ndimage import maximum_filter1d
    mono = np.max(np.abs(x), axis=0) if x.ndim == 2 else np.abs(x)
    w = max(1, n_of(look) * 2 + 1)
    peak = maximum_filter1d(mono, w)
    g = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    # smooth release (one-pole on the gain, taking the minimum so attack stays instant)
    a = np.exp(-1 / (release * SR))
    gs = signal.lfilter([1 - a], [1, -a], g, zi=[g[0] * a])[0]
    g = np.minimum(g, gs)
    y = x * g
    return np.clip(y, -ceiling, ceiling)


def normalize_peak(x, peak_db=-1.0):
    p = np.max(np.abs(x)) + 1e-12
    return x * (10 ** (peak_db / 20) / p)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)


def master(x, rms_target_db=None, peak_db=-1.0):
    x = remove_dc(x)
    if rms_target_db is not None:
        x = x * 10 ** ((rms_target_db - rms_db(x)) / 20)
        x = limiter(x, 10 ** (peak_db / 20))
    else:
        x = normalize_peak(x, peak_db)
    return x


# ---- music theory -----------------------------------------------------------------------------
NOTE_IDX = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(name):
    """'C4' -> 60, 'F#3' -> 54, 'Bb2' -> 46. Integers pass through."""
    if isinstance(name, (int, np.integer, float)):
        return int(name)
    s = name.strip()
    n = NOTE_IDX[s[0].upper()]
    i = 1
    while i < len(s) and s[i] in '#b':
        n += 1 if s[i] == '#' else -1
        i += 1
    octv = int(s[i:]) if i < len(s) else 4
    return n + 12 * (octv + 1)


def hz(m):
    return 440.0 * 2 ** ((midi(m) - 69) / 12)


CHORD_Q = {
    '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
    'dim': [0, 3, 6], 'dim7': [0, 3, 6, 9], 'm7b5': [0, 3, 6, 10], 'aug': [0, 4, 8], 'sus4': [0, 5, 7],
    'sus2': [0, 2, 7], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], 'add9': [0, 4, 7, 14], '9': [0, 4, 7, 10, 14],
    'm9': [0, 3, 7, 10, 14], 'maj9': [0, 4, 7, 11, 14], '7b9': [0, 4, 7, 10, 13], 'madd9': [0, 3, 7, 14],
}


def chord(name, octave=3):
    """'Am7' -> (root_midi, [midi notes]) with the root in `octave`. Slash bass 'C/E' supported."""
    bass = None
    if '/' in name:
        name, bass = name.split('/')
    root = name[0]
    i = 1
    while i < len(name) and name[i] in '#b':
        root += name[i]
        i += 1
    q = name[i:]
    r = midi(f'{root}{octave}')
    notes = [r + iv for iv in CHORD_Q[q]]
    b = midi(f'{bass}{octave}') if bass else r
    if b > r:
        b -= 12
    return b, notes


def voice_lead(prev, notes, lo=55, hi=76):
    """Pick an inversion of `notes` closest to the previous voicing (smooth pads/comping)."""
    pcs = sorted(set(n % 12 for n in notes))
    best, bd = None, 1e9
    cands = []
    for base in range(lo - 12, hi):
        v = []
        for pc in pcs:
            m = base + ((pc - base) % 12)
            v.append(m)
        v = sorted(v)
        if v[0] >= lo and v[-1] <= hi + 4:
            cands.append(v)
    for v in cands:
        d = sum(abs(a - b) for a, b in zip(v, prev)) if prev else abs(np.mean(v) - (lo + hi) / 2)
        if d < bd:
            bd, best = d, v
    return best or sorted(notes)


# ---- loops ------------------------------------------------------------------------------------
def tame_lows(x, share_db=-5.0, fc=130.0):
    """Mastering low shelf: if the energy below ~fc is more than `share_db` of the total, turn it down so that it
    is exactly that (keeps loud kicks/sub-bass from eating the level on small speakers)."""
    spec = np.fft.rfft(x, axis=-1)
    f = np.fft.rfftfreq(x.shape[-1], 1 / SR)
    w = 1 / (1 + (f / fc) ** 4)  # weight of the shelf region (smooth)
    P = np.abs(spec) ** 2 if x.ndim == 1 else np.sum(np.abs(spec) ** 2, axis=0)
    low = np.sum(P * w)
    rest = np.sum(P * (1 - w))
    p = 10 ** (share_db / 10)
    if low / (low + rest) <= p:
        return x
    g = np.sqrt(p * rest / ((1 - p) * low))
    gain = 1 - w + w * g
    return np.fft.irfft(spec * gain, x.shape[-1], axis=-1)


def master_loop(x, rms_db_target, peak_db=-1.0, lo=25.0, low_share_db=None):
    """Master a periodic signal (mono or (2, n)) without breaking its loop point: circular DC/rumble removal,
    level to an RMS target, and a limiter run on a 3x tiled copy so its state wraps around too."""
    x = fft_filter(x, band_gain(lo=lo, order=2)) if x.ndim == 1 else np.vstack([fft_filter(c, band_gain(lo=lo, order=2)) for c in x])
    if low_share_db is not None:
        x = tame_lows(x, low_share_db)
    x = x * 10 ** ((rms_db_target - rms_db(x)) / 20)
    n = x.shape[-1]
    tiled = np.concatenate([x, x, x], axis=-1)
    lim = limiter(tiled, 10 ** (peak_db / 20), release=0.08)
    return lim[..., n:2 * n]


def periodic(fn, x, *arrays, **kw):
    """Run a stateful (causal) process on a periodic signal so the output is periodic too: process two periods
    and keep the second one (filter state has settled into the loop)."""
    n = len(x)
    out = fn(np.concatenate([x, x]), *[np.concatenate([a, a]) if np.ndim(a) else a for a in arrays], **kw)
    return out[n:]


def loop_freq(f, sec):
    """Nearest frequency with a whole number of cycles in `sec` seconds (seamless loops)."""
    return max(1, round(f * sec)) / sec


def loop_lfo(sec, cycles, phase=0.0):
    t = np.arange(n_of(sec)) / SR
    return np.sin(2 * np.pi * cycles * t / (n_of(sec) / SR) + phase)
