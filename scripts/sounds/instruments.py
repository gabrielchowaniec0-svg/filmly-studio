"""Synthesised instruments for the music loops. Each returns a mono numpy array (attack..release tail).

Signature for pitched instruments: inst(f_hz, dur_s, vel=1.0) -> np.ndarray
Drums: drum(vel=1.0, ...) -> np.ndarray
"""
import numpy as np
import dsp as D

_r = D.rng(1234)


def _noise(sec):
    return _r.standard_normal(D.n_of(sec))


# ---- drums ------------------------------------------------------------------------------------
def kick(vel=1.0, tone=1.0, decay=0.32, punch=1.0):
    sec = decay * 1.6
    t = D.tvec(sec)
    f = 48 * tone + 120 * tone * np.exp(-t / 0.035)
    body = D.sine(f, n=len(t)) * np.exp(-t / decay)
    click = D.hp(_noise(0.006), 2500) * D.expdecay(0.006, 0.0015) * 0.35 * punch
    out = body
    out[: len(click)] += click
    return D.fade(D.saturate(out * 1.2, 1.3), 0.0005, 0.02) * vel


def snare(vel=1.0, tone=190, snappy=1.0, decay=0.13):
    sec = 0.35
    t = D.tvec(sec)
    body = (D.sine(tone * (1 + 0.5 * np.exp(-t / 0.01)), n=len(t)) * 0.8 + D.sine(tone * 1.6, n=len(t)) * 0.3) * np.exp(-t / 0.05)
    nz = D.bp(_noise(sec), 1200, 9000) * np.exp(-t / decay) * 0.55 * snappy
    return D.fade(body * 0.7 + nz, 0.0005, 0.02) * vel


def brush(vel=1.0, sweep=False):
    sec = 0.45 if sweep else 0.22
    nz = D.bp(_noise(sec), 1800, 9000)
    e = D.env([(0, 0), (0.012 if not sweep else 0.12, 1), (sec, 0)], sec=sec, curve=1.8)
    return nz * e * 0.5 * vel


_HAT_F = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]


def _metal(sec, scale=1.0):
    t = D.tvec(sec)
    x = sum(D.pulse(f * scale * 2.1, n=len(t), naive=True) for f in _HAT_F)
    return x / len(_HAT_F)


def hat(vel=1.0, open_=False, decay=None):
    decay = decay or (0.22 if open_ else 0.035)
    sec = decay * 5
    t = D.tvec(sec)
    x = D.hp(_metal(sec) * 0.6 + _noise(sec) * 0.4, 7000, 2)
    return D.fade(x * np.exp(-t / decay), 0.0003, 0.01) * 0.45 * vel


def ride(vel=1.0, bell=0.3):
    sec = 1.6
    t = D.tvec(sec)
    m = D.hp(_metal(sec, 1.37), 3500, 2) * np.exp(-t / 0.5)
    ping = D.additive(3150, [(1, 1), (1.47, 0.6), (2.09, 0.4)], sec, decays=[0.6, 0.4, 0.3]) * bell * 0.4
    nz = D.hp(_noise(sec), 6000) * np.exp(-t / 0.08) * 0.3
    return D.fade((m * 0.5 + ping + nz), 0.0003, 0.05) * 0.35 * vel


def crash(vel=1.0, decay=1.1):
    sec = decay * 3
    t = D.tvec(sec)
    x = D.hp(_metal(sec, 1.9) * 0.5 + _noise(sec) * 0.7, 3000, 2)
    x = D.lp(x, 12000, 1)
    e = np.exp(-t / decay) * (0.6 + 0.4 * np.exp(-t / 0.05))
    return D.fade(x * e, 0.0005, 0.1) * 0.4 * vel


def clap(vel=1.0):
    sec = 0.4
    t = D.tvec(sec)
    nz = D.bp(_noise(sec), 900, 4200)
    e = np.zeros_like(t)
    for k, off in enumerate([0, 0.009, 0.019, 0.028]):
        tt = t - off
        m = tt >= 0
        e[m] += np.exp(-tt[m] / (0.006 if k < 3 else 0.09)) * (1 if k < 3 else 0.8)
    return D.fade(nz * e * 0.6, 0.0005, 0.02) * vel


def shaker(vel=1.0):
    sec = 0.12
    nz = D.bp(_noise(sec), 4500, 12000)
    e = D.env([(0, 0), (0.025, 1), (0.12, 0)], sec=sec, curve=2)
    return nz * e * 0.35 * vel


def tambourine(vel=1.0):
    sec = 0.3
    t = D.tvec(sec)
    jing = D.additive(5300, [(1, 1), (1.31, 0.8), (1.67, 0.7), (2.13, 0.5)], sec, decays=[0.12, 0.1, 0.08, 0.06])
    nz = D.hp(_noise(sec), 6000) * np.exp(-t / 0.07)
    return (jing * 0.25 + nz * 0.35) * D.env([(0, 0), (0.004, 1), (sec, 1)], sec=sec) * vel * 0.6


def rim(vel=1.0):
    sec = 0.08
    t = D.tvec(sec)
    x = D.additive(1700, [(1, 1), (0.31, 0.6), (2.3, 0.3)], sec, decays=[0.012, 0.03, 0.008])
    return D.fade(x * 0.6, 0.0003, 0.01) * vel


def woodblock(vel=1.0, f=900):
    sec = 0.15
    x = D.additive(f, [(1, 1), (2.7, 0.35), (5.2, 0.1)], sec, decays=[0.04, 0.02, 0.01])
    return D.fade(x * 0.7, 0.0003, 0.01) * vel


def tom(vel=1.0, f=110, decay=0.25):
    sec = decay * 3
    t = D.tvec(sec)
    body = D.sine(f * (1 + 0.6 * np.exp(-t / 0.03)), n=len(t)) * np.exp(-t / decay)
    nz = D.bp(_noise(sec), 300, 3000) * np.exp(-t / 0.02) * 0.3
    return D.fade(D.saturate(body + nz, 1.2), 0.0005, 0.02) * vel


def taiko(vel=1.0, f=62):
    sec = 1.6
    t = D.tvec(sec)
    body = D.sine(f * (1 + 0.35 * np.exp(-t / 0.05)), n=len(t)) * np.exp(-t / 0.45)
    over = D.sine(f * 2.3, n=len(t)) * np.exp(-t / 0.12) * 0.3
    slap = D.bp(_noise(sec), 200, 2500) * np.exp(-t / 0.025) * 0.6
    return D.fade(D.saturate((body + over + slap) * 1.1, 1.4), 0.0005, 0.05) * vel


def timpani(f=73.4, vel=1.0, dur=1.8):
    sec = dur
    t = D.tvec(sec)
    x = D.additive(f, [(1, 1), (1.5, 0.6), (1.98, 0.4), (2.44, 0.25), (2.9, 0.12)], sec, decays=[0.9, 0.6, 0.45, 0.3, 0.2])
    x += D.lp(_noise(sec), 900) * np.exp(-t / 0.03) * 0.8
    return D.fade(x * 0.6, 0.001, 0.1) * vel


def chip_noise(vel=1.0, decay=0.06, bright=True):
    sec = decay * 4
    t = D.tvec(sec)
    # LFSR-ish: sample-and-hold noise
    hold = 2 if bright else 9
    nz = np.repeat(_r.choice([-1.0, 1.0], D.n_of(sec) // hold + 1), hold)[: len(t)]
    return nz * np.exp(-t / decay) * 0.4 * vel


def chip_kick(vel=1.0):
    sec = 0.15
    t = D.tvec(sec)
    f = 50 + 300 * np.exp(-t / 0.02)
    return D.tri(f, n=len(t), steps=16) * np.exp(-t / 0.06) * 0.8 * vel


# ---- pitched ----------------------------------------------------------------------------------
def _rel_env(n_total, dur, a=0.004, rel=0.12, s=1.0):
    t = np.arange(n_total) / D.SR
    e = np.clip(t / a, 0, 1) * s
    off = t > dur
    e[off] *= np.exp(-(t[off] - dur) / (rel / 4))
    return e


def pluck(f, dur, vel=1.0, bright=1.0, decay=0.9, nharm=14):
    """Plucked string (ukulele / guitar / harp-like) via decaying harmonic partials."""
    sec = min(dur, decay * 3) + 0.25
    partials = [(k * (1 + 0.0008 * k * k), (1 / k) ** (1.25 - 0.4 * bright) * (1 + 0.4 * np.sin(k * 1.7))) for k in range(1, nharm + 1)]
    decs = [decay / (1 + 0.35 * (k - 1)) for k in range(1, nharm + 1)]
    x = D.additive(f, partials, sec, decays=decs)
    x *= _rel_env(len(x), dur + 0.05, a=0.002, rel=0.15)
    t = D.tvec(sec)
    x[: D.n_of(0.01)] += D.hp(_noise(0.01), 2000) * 0.15 * bright
    return D.fade(x * 0.35, 0.0005, 0.03) * vel


def harp(f, dur, vel=1.0):
    return pluck(f, max(dur, 1.2), vel, bright=0.5, decay=1.4, nharm=8)


def pizz(f, dur, vel=1.0):
    x = pluck(f, 0.25, vel, bright=0.4, decay=0.22, nharm=10)
    return D.lp(x, 2500, 1)


def upright(f, dur, vel=1.0):
    sec = min(dur, 1.2) + 0.2
    t = D.tvec(sec)
    partials = [(k, (1 / k) ** 1.6) for k in range(1, 9)]
    x = D.additive(f, partials, sec, decays=[0.7 / (1 + 0.5 * (k - 1)) for k in range(1, 9)])
    thump = D.lp(_noise(0.04), 400) * D.expdecay(0.04, 0.01) * 0.25
    x[: len(thump)] += thump
    x *= _rel_env(len(x), dur * 0.95, a=0.003, rel=0.08)
    return D.fade(D.lp(x, 1400, 1) * 0.6, 0.0005, 0.02) * vel


def epiano(f, dur, vel=1.0, trem=0.0):
    """Rhodes-like 2-op FM tine piano."""
    sec = dur + 0.6
    t = D.tvec(sec)
    idx = (0.6 + 1.6 * vel) * np.exp(-t / 0.25) + 0.15
    mod = np.sin(2 * np.pi * f * t)
    car = np.sin(2 * np.pi * f * t + idx * mod)
    bell = np.sin(2 * np.pi * f * 7.02 * t) * np.exp(-t / 0.05) * 0.12 * vel if f * 7 < D.SR * 0.45 else 0
    body = car * np.exp(-t / 1.6) + bell
    if trem:
        body *= 1 - trem * (0.5 + 0.5 * np.sin(2 * np.pi * 4.8 * t))
    x = body * _rel_env(len(t), dur, a=0.002, rel=0.25)
    return D.fade(x * 0.3, 0.0005, 0.02) * vel


def piano(f, dur, vel=1.0):
    sec = min(dur, 3.0) + 0.5
    t = D.tvec(sec)
    B = 0.00035
    n = 12
    x = np.zeros_like(t)
    bright = 0.6 + 0.6 * vel
    for k in range(1, n + 1):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > D.SR * 0.45:
            break
        amp = (1 / k) ** (1.6 - 0.5 * bright)
        dec = (2.8 if f < 300 else 1.8) / (1 + 0.45 * (k - 1)) * (220 / max(f, 110)) ** 0.3
        for det in (-0.6, 0.0, 0.7):  # three unison strings, slightly detuned (cents)
            x += amp / 3 * np.sin(2 * np.pi * fk * (1 + det / 1731) * t + k) * (0.75 * np.exp(-t / (dec * 0.25)) + 0.25 * np.exp(-t / dec))
    ham = D.bp(_noise(0.02), 800, 5000) * D.expdecay(0.02, 0.004) * 0.08 * vel
    x[: len(ham)] += ham
    x *= _rel_env(len(t), dur, a=0.001, rel=0.18)
    return D.fade(x * 0.32, 0.0003, 0.03) * vel


def organ(f, dur, vel=1.0, bars=(8, 8, 6, 0, 3, 0, 2, 0, 1), click=0.3):
    """Hammond-ish drawbars: 16' 5 1/3' 8' 4' 2 2/3' 2' 1 3/5' 1 1/3' 1'."""
    ratios = [0.5, 1.5, 1, 2, 3, 4, 5, 6, 8]
    sec = dur + 0.08
    t = D.tvec(sec)
    x = np.zeros_like(t)
    for r, b in zip(ratios, bars):
        if b and f * r < D.SR * 0.45:
            x += (b / 8) * np.sin(2 * np.pi * f * r * t + r)
    x /= 3.0
    kc = D.bp(_noise(0.006), 1500, 6000) * click * 0.5
    x[: len(kc)] += kc
    x *= _rel_env(len(t), dur, a=0.006, rel=0.05)
    return D.fade(x * 0.35, 0.0005, 0.01) * vel


def strings(f, dur, vel=1.0, attack=0.35, release=0.6, cutoff=3200, voices=5):
    sec = dur + release * 1.5
    t = D.tvec(sec)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t + _r.uniform(0, 6)) * np.clip((t - 0.3) / 0.4, 0, 1)
    x = np.zeros_like(t)
    for i in range(voices):
        det = 1 + (i - (voices - 1) / 2) * 0.0035
        x += D.saw(f * det * vib, n=len(t), phase0=_r.uniform())
    x /= voices
    x = D.lp(x, min(cutoff, f * 10), 2)
    a = min(attack, dur * 0.8 + 0.02)
    e = D.env([(0, 0), (a, 1), (max(dur, a + 0.01), 0.9), (max(dur, a + 0.01) + release, 0)], n=len(t), curve=1.4)
    return D.fade(x * e * 0.4, 0.002, 0.05) * vel


def staccato_strings(f, dur, vel=1.0):
    return strings(f, min(dur, 0.18), vel, attack=0.015, release=0.12, cutoff=4500, voices=4)


def choir(f, dur, vel=1.0, vowel='ah'):
    formants = {'ah': [(700, 1.0, 80), (1220, 0.5, 90), (2600, 0.25, 120)], 'oo': [(330, 1.0, 60), (800, 0.35, 80), (2300, 0.08, 120)]}[vowel]
    sec = dur + 1.0
    t = D.tvec(sec)
    x = np.zeros_like(t)
    for i in range(4):
        vib = 1 + 0.004 * np.sin(2 * np.pi * (4.6 + i * 0.3) * t + i)
        x += D.saw(f * (1 + (i - 1.5) * 0.004) * vib, n=len(t), phase0=_r.uniform())
    y = np.zeros_like(t)
    for fc, g, bw in formants:
        y += D.reso(x, fc, fc / bw) * g
    y += D.bp(_noise(sec), 2000, 6000) * 0.02
    e = D.env([(0, 0), (0.4, 1), (dur, 0.9), (dur + 0.7, 0)], n=len(t), curve=1.5)
    return D.fade(y * e * 0.5, 0.002, 0.05) * vel


def brass(f, dur, vel=1.0, bright=1.0):
    sec = dur + 0.3
    t = D.tvec(sec)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.25) / 0.3, 0, 1)
    scoop = 1 - 0.015 * np.exp(-t / 0.04)
    x = D.saw(f * vib * scoop, n=len(t)) * 0.6 + D.saw(f * 1.004 * vib * scoop, n=len(t), phase0=0.3) * 0.4
    co = f * (1.5 + (4 + 4 * vel * bright) * D.env([(0, 0.2), (0.05, 1), (0.25, 0.7), (sec, 0.6)], n=len(t)))
    y = D.sweep(x, 'lp', np.minimum(co, D.SR * 0.45), q=0.9)
    e = D.env([(0, 0), (0.03, 1), (0.15, 0.85), (max(dur, 0.16), 0.8), (max(dur, 0.16) + 0.12, 0)], n=len(t))
    return D.fade(D.saturate(y * e * 0.6, 1.3) * 0.6, 0.001, 0.03) * vel


def flute(f, dur, vel=1.0):
    sec = dur + 0.25
    t = D.tvec(sec)
    vib = 1 + 0.005 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.2) / 0.4, 0, 1)
    x = D.sine(f * vib, n=len(t)) + 0.18 * D.sine(2 * f * vib, n=len(t)) + 0.06 * D.sine(3 * f * vib, n=len(t))
    breath = D.reso(_noise(sec), f * 2, 3) * 0.08 + D.bp(_noise(sec), 2000, 8000) * 0.015
    e = D.env([(0, 0), (0.06, 1), (max(dur, 0.07), 0.85), (max(dur, 0.07) + 0.15, 0)], n=len(t), curve=1.3)
    return D.fade((x + breath) * e * 0.35, 0.002, 0.02) * vel


def bell(f, dur, vel=1.0, decay=1.2):
    sec = decay * 3
    partials = [(1, 1), (2.0, 0.35), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)]
    x = D.additive(f, partials, sec, decays=[decay, decay * 0.6, decay * 0.5, decay * 0.25, decay * 0.12])
    return D.fade(x * 0.3, 0.0005, 0.05) * vel


def glock(f, dur, vel=1.0):
    return bell(f, dur, vel, decay=0.7)


def marimba(f, dur, vel=1.0):
    sec = 0.9
    x = D.additive(f, [(1, 1), (3.93, 0.35), (9.6, 0.08)], sec, decays=[0.35, 0.08, 0.03])
    t = D.tvec(sec)
    x[: D.n_of(0.004)] += D.bp(_noise(0.004), 1000, 5000) * 0.1
    return D.fade(x * 0.45, 0.0005, 0.03) * vel


def xylo(f, dur, vel=1.0):
    sec = 0.5
    x = D.additive(f, [(1, 1), (3.0, 0.4), (6.2, 0.15)], sec, decays=[0.12, 0.05, 0.02])
    return D.fade(x * 0.5, 0.0003, 0.02) * vel


def vibes(f, dur, vel=1.0):
    sec = max(dur, 0.5) + 1.2
    t = D.tvec(sec)
    x = D.additive(f, [(1, 1), (4.0, 0.25), (10.0, 0.05)], sec, decays=[1.6, 0.3, 0.08])
    x *= 1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * t))
    x *= _rel_env(len(t), dur + 0.3, a=0.001, rel=0.5)
    return D.fade(x * 0.35, 0.0005, 0.05) * vel


def synth_bass(f, dur, vel=1.0, cutoff=6.0, decay=0.18):
    sec = dur + 0.08
    t = D.tvec(sec)
    x = D.saw(f, n=len(t)) * 0.6 + D.sine(f, n=len(t)) * 0.6
    co = f * (1.5 + cutoff * np.exp(-t / decay))
    y = D.sweep(x, 'lp', np.minimum(co, 8000), q=1.1)
    y *= _rel_env(len(t), dur, a=0.002, rel=0.04)
    return D.fade(D.saturate(y, 1.4) * 0.5, 0.0005, 0.01) * vel


def sine_bass(f, dur, vel=1.0):
    sec = dur + 0.1
    t = D.tvec(sec)
    x = D.sine(f, n=len(t)) + 0.15 * D.sine(2 * f, n=len(t))
    x *= _rel_env(len(t), dur, a=0.006, rel=0.06)
    return D.fade(D.saturate(x, 1.6) * 0.55, 0.001, 0.01) * vel


def bassoon(f, dur, vel=1.0):
    sec = dur + 0.1
    t = D.tvec(sec)
    x = D.pulse(f, n=len(t), width=0.32)
    y = D.lp(x, f * 4.5, 2)
    y = y + D.reso(x, 500, 3) * 0.4
    y *= _rel_env(len(t), dur, a=0.015, rel=0.06)
    return D.fade(y * 0.35, 0.001, 0.01) * vel


def theremin_line(notes, total_sec, glide=0.09, vib_rate=6.2, vib_depth=0.012):
    """Continuous gliding sine voice. notes: [(start_s, dur_s, f_hz)] sorted; returns signal of total_sec,
    periodic (the last note glides into the first)."""
    n = D.n_of(total_sec)
    t = np.arange(n) / D.SR
    f = np.zeros(n)
    amp = np.zeros(n)
    notes = sorted(notes)
    for i, (s, d, fr) in enumerate(notes):
        a, b = D.n_of(s), D.n_of(s + d)
        nxt = notes[(i + 1) % len(notes)]
        nstart = nxt[0] if i + 1 < len(notes) else nxt[0] + total_sec
        end = D.n_of(nstart)
        idx = np.arange(a, end)
        f[idx % n] = fr
        ga = min(D.n_of(glide), max(1, end - a))
        g_idx = np.arange(end - ga, end)
        w = 0.5 - 0.5 * np.cos(np.pi * (g_idx - (end - ga)) / ga)
        f[g_idx % n] = fr * (nxt[2] / fr) ** w
        # amplitude: on during the note, a soft dip if there is a rest before the next note
        on = np.arange(a, b)
        amp[on % n] = 1.0
    # smooth amplitude (circular)
    k = D.n_of(0.05)
    ker = np.hanning(2 * k + 1)
    ker /= ker.sum()
    amp = np.real(np.fft.ifft(np.fft.fft(amp) * np.fft.fft(np.roll(np.pad(ker, (0, n - len(ker))), -k))))
    vib = 1 + vib_depth * np.sin(2 * np.pi * vib_rate * t)
    ph = np.cumsum(f * vib) / D.SR
    # make the phase periodic over the loop: tiny frequency correction so total cycles is an integer
    total = ph[-1]
    corr = (np.round(total) - total) / n
    ph = ph + corr * np.arange(n)
    x = np.sin(2 * np.pi * ph) + 0.08 * np.sin(4 * np.pi * ph)
    return x * amp * 0.35


def pulse_lead(f, dur, vel=1.0, width=0.25, vib=True):
    sec = dur + 0.05
    t = D.tvec(sec)
    v = 1 + (0.008 * np.sin(2 * np.pi * 6 * t) * np.clip((t - 0.15) / 0.1, 0, 1) if vib else 0)
    x = D.pulse(f * v, n=len(t), width=width, naive=True)
    e = D.env([(0, 1), (max(dur * 0.9, 0.02), 0.75), (max(dur, 0.03), 0)], n=len(t))
    e = np.round(e * 15) / 15  # 4-bit volume steps
    return x * e * 0.18 * vel


def tri_bass(f, dur, vel=1.0):
    sec = dur
    x = D.tri(f, sec=sec, steps=16)
    return D.fade(x * 0.45, 0.001, 0.005) * vel


def farfisa(f, dur, vel=1.0):
    """Reedy combo organ (60s spooky/garage)."""
    sec = dur + 0.05
    t = D.tvec(sec)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 6.5 * t)
    x = D.pulse(f * vib, n=len(t), width=0.3) * 0.5 + D.saw(2 * f * vib, n=len(t)) * 0.25
    x = D.lp(x, 4500, 2)
    x *= _rel_env(len(t), dur, a=0.004, rel=0.04)
    return D.fade(x * 0.3, 0.0005, 0.01) * vel
