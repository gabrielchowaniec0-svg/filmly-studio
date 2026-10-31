"""Seamless ambience loops (mono, 32 kHz). Beds are made from circular (FFT-shaped) noise, modulations use
whole-number cycles per loop, and every event is placed with wrap-around, so each file loops without a seam."""
import numpy as np
import dsp as D
import instruments as I

RMS = -24.0  # ambiences sit under dialogue and music


def bed(sec, r, lo=None, hi=None, slope=-3.0):
    return D.fft_filter(D.colored(sec, r=r, slope_db=slope), D.band_gain(lo, hi))


def lfo(sec, cycles, phase=0.0):
    return D.loop_lfo(sec, cycles, phase)


def gusts(sec, r, n=4, depth=0.5):
    """Smooth periodic amplitude modulation from a few loop-aligned sines."""
    out = np.zeros(D.n_of(sec))
    for k in range(1, n + 1):
        out += r.uniform(0.3, 1.0) / k * lfo(sec, k + r.integers(0, 2), r.uniform(0, 6.28))
    out /= np.max(np.abs(out)) + 1e-9
    return 1 + depth * out


def place(dst, x, t, g=1.0):
    return D.place(dst, x, t, g, wrap=True)


def finish(x):
    return D.master_loop(x, RMS, low_share_db=-6.0)


# ---- weather ----------------------------------------------------------------------------------
def rain(sec=24.0, seed=60, heavy=1.0):
    r = D.rng(seed)
    n = D.n_of(sec)
    x = bed(sec, r, 500, 9000) * 0.9 * heavy * gusts(sec, r, 3, 0.15)
    x += bed(sec, r, 80, 500, -6) * 0.5  # distant roar
    drops = np.zeros(n)
    imp = np.zeros(D.n_of(0.03)); imp[0] = 1
    for k in range(int(sec * 140 * heavy)):
        f = r.uniform(1500, 7000)
        d = D.reso(imp, f, r.uniform(5, 15)) * r.uniform(0.02, 0.25) ** 1.5 * 4
        drops = place(drops, d, r.uniform(0, sec))
    # a few heavier drips off a gutter
    for k in range(int(sec * 0.8)):
        t = D.tvec(0.08)
        f = r.uniform(600, 1400) * (1 + 0.6 * t / 0.08)
        drip = D.sine(f, n=len(t)) * np.exp(-t / 0.02) * r.uniform(0.1, 0.25)
        drops = place(drops, drip, r.uniform(0, sec))
    return finish(x + drops * 0.8)


def wind(sec=24.0, seed=61):
    r = D.rng(seed)
    n = D.n_of(sec)
    base = D.colored(sec, r=r, slope_db=-4.5)
    fc = 420 * (1 + 0.6 * lfo(sec, 2, 0.3) + 0.25 * lfo(sec, 5, 1.1))
    x = D.periodic(lambda a, f: D.sweep(a, 'bp', f, 1.6), base, fc) * 1.2
    whistle = D.periodic(lambda a, f: D.sweep(a, 'bp', f, 9.0), D.colored(sec, r=r), fc * 2.4) * 0.25
    low = bed(sec, r, 40, 250, -6) * 0.6
    amp = gusts(sec, r, 4, 0.6)
    return finish((x + whistle) * amp + low * (0.6 + 0.4 * amp))


def thunderstorm(sec=30.0, seed=62):
    import sfx
    r = D.rng(seed)
    x = rain(sec, seed + 1, heavy=1.4) * 1.0
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.3
    th = sfx.thunder()
    th = th / np.max(np.abs(th))
    x = place(x, th * 0.9, 3.0)
    x = place(x, D.lp(th, 400) * 0.6, 18.5)  # a more distant one
    return finish(x)


# ---- nature -----------------------------------------------------------------------------------
def _chirp(r, kind):
    if kind == 'tweet':  # quick descending whistles
        out = np.zeros(1)
        f0 = r.uniform(3500, 5500)
        for k in range(r.integers(4, 9)):
            d = r.uniform(0.04, 0.07)
            t = D.tvec(d)
            f = f0 * (1.25 - 0.4 * t / d)
            s = D.sine(f, n=len(t)) * np.sin(np.pi * t / d) ** 2
            out = D.place(out, s, k * r.uniform(0.08, 0.11))
        return out
    if kind == 'trill':
        d = r.uniform(0.8, 1.4)
        t = D.tvec(d)
        f = r.uniform(4000, 6000) * (1 + 0.12 * np.sin(2 * np.pi * r.uniform(18, 28) * t))
        e = np.sin(np.pi * t / d) ** 0.7 * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t))
        return D.sine(f, n=len(t)) * e
    if kind == 'feebee':  # two clear notes
        out = np.zeros(1)
        f = r.uniform(3600, 4200)
        for k, (ff, d) in enumerate([(f, 0.3), (f * 0.86, 0.32)]):
            t = D.tvec(d)
            s = D.sine(ff * (1 - 0.02 * t / d), n=len(t)) * np.sin(np.pi * t / d) ** 1.5
            out = D.place(out, s, k * 0.4)
        return out
    if kind == 'warble':
        d = r.uniform(1.2, 1.8)
        t = D.tvec(d)
        ph = np.cumsum(r.uniform(-1, 1, 12))
        contour = np.interp(t, np.linspace(0, d, 12), ph)
        f = 3200 * 2 ** (contour * 0.12) * (1 + 0.05 * np.sin(2 * np.pi * 35 * t))
        e = np.clip(np.sin(np.pi * t / d), 0, 1) ** 0.5 * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * t)))
        return D.sine(f, n=len(t)) * e
    # dove: soft low coos
    out = np.zeros(1)
    for k, (d, ff) in enumerate([(0.35, 520), (0.6, 560), (0.35, 500)]):
        t = D.tvec(d)
        s = (D.sine(ff * (1 - 0.06 * t / d), n=len(t)) + 0.2 * D.sine(2 * ff, n=len(t))) * np.sin(np.pi * t / d) ** 2
        out = D.place(out, s, [0, 0.45, 1.15][k])
    return out * 1.5


def park_birds(sec=28.0, seed=63):
    r = D.rng(seed)
    x = bed(sec, r, 200, 3000) * 0.18 * gusts(sec, r, 3, 0.5)  # leaves/air
    x += bed(sec, r, 60, 400, -6) * 0.15  # distant town
    birds = np.zeros(D.n_of(sec))
    kinds = ['tweet', 'tweet', 'trill', 'feebee', 'warble', 'warble', 'dove']
    for k in range(int(sec * 0.9)):
        kind = kinds[r.integers(0, len(kinds))]
        c = _chirp(r, kind)
        dist = r.uniform(0.15, 1.0)
        c = D.lp(c, 5000 + 4000 * dist) * dist
        birds = place(birds, c, r.uniform(0, sec), 0.6)
    birds = D.reverb_circular(birds, 0.35, 1.2, seed=5)
    return finish(x + birds)


def night_crickets(sec=24.0, seed=64):
    r = D.rng(seed)
    n = D.n_of(sec)
    x = bed(sec, r, 60, 1500, -6) * 0.6 + bed(sec, r, 300, 2500) * 0.08
    cr = np.zeros(n)
    for c in range(5):
        f = r.uniform(3900, 5200)
        period = r.uniform(0.7, 1.3)
        period = sec / round(sec / period)  # whole number of chirps per loop
        npulse = r.integers(2, 5)
        dist = r.uniform(0.25, 1.0)
        off = r.uniform(0, period)
        for k in range(int(round(sec / period))):
            t0 = off + k * period + r.normal(0, 0.01)
            for p in range(npulse):
                d = 0.018
                t = D.tvec(d)
                s = D.sine(f * (1 + 0.01 * np.sin(2 * np.pi * 300 * t)), n=len(t)) * np.sin(np.pi * t / d) ** 2
                cr = place(cr, s * dist * r.uniform(0.8, 1.0), t0 + p * 0.032)
    # a katydid-ish raspy layer far away
    kat = D.fft_filter(D.white(n=n, r=r), D.band_gain(6000, 9000)) * (0.5 + 0.5 * np.sign(lfo(sec, int(sec * 3)))) * 0.15
    cr = D.reverb_circular(cr + kat, 0.3, 1.0, seed=8)
    return finish(x + cr * 0.35)


def ocean_waves(sec=28.0, seed=65):
    r = D.rng(seed)
    n = D.n_of(sec)
    surf = bed(sec, r, 80, 2000, -4) * 0.25
    hiss = np.zeros(n)
    # 4 waves of varying length that add up to the loop
    lens = np.array([7.6, 6.4, 7.8, 6.2])
    lens = lens / lens.sum() * sec
    t0 = 0.0
    for L in lens:
        w = D.n_of(L + 2.0)
        t = np.arange(w) / D.SR
        swell = np.clip(t / (L * 0.45), 0, 1) ** 2 * (t < L * 0.45)
        crash_t = L * 0.45
        after = np.clip(t - crash_t, 0, None)
        crash = (t >= crash_t) * np.exp(-after / 0.6)
        wash = (t >= crash_t) * np.exp(-after / (L * 0.35)) * np.clip(after / 0.3, 0, 1)
        nz = r.standard_normal(w)
        body = D.lp(nz, 1100) * (swell * 0.7 + crash * 1.2 + wash * 0.6)
        foam = D.bp(nz, 1200, 6000) * (crash * 0.5 + wash * 0.35 * (1 + 0.3 * np.sin(2 * np.pi * 3 * t)))
        hiss = place(hiss, body + foam, t0)
        t0 += L
    return finish(surf + hiss)


def forest_stream(sec=24.0, seed=66):
    r = D.rng(seed)
    n = D.n_of(sec)
    x = bed(sec, r, 300, 6000) * 0.35 * gusts(sec, r, 5, 0.15)
    bub = np.zeros(n)
    for k in range(int(sec * 60)):
        d = r.uniform(0.01, 0.04)
        t = D.tvec(d)
        f0 = r.uniform(400, 2200)
        s = D.sine(f0 * (1 + 0.9 * t / d), n=len(t)) * np.sin(np.pi * t / d) * r.uniform(0.05, 0.3)
        bub = place(bub, s, r.uniform(0, sec))
    for k in range(int(sec * 0.5)):  # occasional bird far away
        bub = place(bub, D.lp(_chirp(r, 'tweet'), 6000) * 0.12, r.uniform(0, sec))
    return finish(x + D.reverb_circular(bub, 0.25, 0.8))


# ---- places -----------------------------------------------------------------------------------
def city_traffic(sec=30.0, seed=67):
    r = D.rng(seed)
    n = D.n_of(sec)
    x = bed(sec, r, 30, 300, -6) * 0.8 + bed(sec, r, 300, 3000) * 0.12
    for k in range(9):  # passing cars with doppler engine tone
        L = r.uniform(3.5, 6.0)
        t = D.tvec(L)
        mid = L / 2
        v = r.uniform(0.6, 1.0)
        doppler = 1 + 0.06 * np.tanh(-(t - mid) * 3)
        eng = r.uniform(70, 120) * doppler
        tone = (D.saw(eng, n=len(t)) * 0.4 + D.sine(eng * 2, n=len(t)) * 0.3)
        tone = D.lp(tone, 600)
        tyre = D.bp(r.standard_normal(len(t)), 400, 4000) * 0.6
        amp = 1 / (1 + ((t - mid) / (0.6 * v + 0.2)) ** 2)
        car = (tone + tyre) * amp * r.uniform(0.3, 1.0)
        x = place(x, car, r.uniform(0, sec))
    for k in range(2):  # distant horns
        h = D.lp(D.saw(r.choice([330, 370, 415]), sec=0.35) + D.saw(415, sec=0.35) * 0.7, 1200)
        h *= D.env([(0, 0), (0.02, 1), (0.3, 1), (0.35, 0)], sec=0.35)
        x = place(x, h * 0.06, r.uniform(0, sec))
    x = D.reverb_circular(x, 0.25, 1.5, seed=9, damp=4000)
    return finish(x)


def cafe_murmur(sec=28.0, seed=68):
    """Babble from synthetic syllables (formant-filtered glottal pulses), blurred into a murmur, plus cups."""
    r = D.rng(seed)
    n = D.n_of(sec)
    vowels = [(730, 1090), (530, 1840), (270, 2290), (570, 840), (300, 870), (640, 1190), (490, 1350)]
    voices = np.zeros(n)
    for v in range(10):
        f0 = r.uniform(95, 230)
        dist = r.uniform(0.3, 1.0)
        t = r.uniform(0, sec)
        talk_left = r.uniform(sec * 0.3, sec * 0.8)
        while talk_left > 0:
            d = r.uniform(0.09, 0.26)
            tt = D.tvec(d)
            pitch = f0 * (1 + 0.08 * np.sin(np.pi * tt / d + r.uniform(-1, 1))) * r.uniform(0.92, 1.1)
            src = D.saw(pitch, n=len(tt))
            F1, F2 = vowels[r.integers(0, len(vowels))]
            s = D.reso(src, F1, 6) + D.reso(src, F2, 9) * 0.5
            s *= np.sin(np.pi * tt / d) ** 1.5
            voices = place(voices, s * dist, t)
            gap = r.choice([0.0, 0.0, 0.02, 0.05, 0.3, 0.7], p=[0.35, 0.25, 0.2, 0.1, 0.07, 0.03])
            t += d + gap
            talk_left -= d + gap
    voices = D.fft_filter(voices, D.band_gain(150, 2200))
    voices = D.reverb_circular(voices, 0.55, 1.4, seed=12, damp=3000)
    x = voices + bed(sec, r, 100, 2500) * 0.05
    for k in range(int(sec * 0.6)):  # cups, spoons
        f = r.uniform(2500, 4200)
        c = D.additive(f, [(1, 1), (2.3, 0.4), (3.9, 0.2)], 0.4, decays=[0.12, 0.06, 0.03]) * r.uniform(0.05, 0.18)
        x = place(x, c, r.uniform(0, sec))
    return finish(x)


def spaceship_hum(sec=24.0, seed=69):
    r = D.rng(seed)
    n = D.n_of(sec)
    t = np.arange(n) / D.SR
    x = np.zeros(n)
    for f, a in [(55, 1.0), (55.25, 0.7), (110, 0.5), (165, 0.3), (220.5, 0.25), (330, 0.15), (440, 0.08), (660, 0.04)]:
        ff = D.loop_freq(f, sec)
        x += a * np.sin(2 * np.pi * ff * t + r.uniform(0, 6))
    x *= 1 + 0.15 * lfo(sec, 3)
    air = bed(sec, r, 200, 3000) * 0.35 * (1 + 0.2 * lfo(sec, 2, 1.0))
    vent = bed(sec, r, 2000, 7000) * 0.06
    x = x * 0.35 + air + vent
    for k in range(int(sec * 0.3)):  # soft computer blips
        m = r.choice(['E6', 'B6', 'G6', 'D7'])
        b = D.lp(D.pulse(D.hz(m), sec=0.07, width=0.5), 4000) * D.env([(0, 0), (0.003, 1), (0.06, 1), (0.07, 0)], sec=0.07)
        x = place(x, b * 0.05, r.uniform(0, sec))
    return finish(D.reverb_circular(x, 0.2, 1.2))


def fireplace(sec=24.0, seed=70):
    r = D.rng(seed)
    n = D.n_of(sec)
    roar = bed(sec, r, 40, 350, -6) * 0.6 * gusts(sec, r, 5, 0.35)
    hiss = bed(sec, r, 1500, 7000) * 0.04 * gusts(sec, r, 7, 0.5)
    cr = np.zeros(n)
    imp = np.zeros(D.n_of(0.02)); imp[0] = 1
    for k in range(int(sec * 25)):
        a = min(0.45, r.pareto(2.2) * 0.06)
        f = r.uniform(1200, 6000)
        c = D.reso(imp, f, r.uniform(2, 6)) * a * 3
        t0 = r.uniform(0, sec)
        cr = place(cr, c, t0)
        if r.uniform() < 0.25:  # crackles come in little bursts
            for j in range(r.integers(2, 6)):
                cr = place(cr, c * r.uniform(0.3, 0.8), t0 + r.uniform(0.005, 0.08))
    for k in range(int(sec * 0.4)):  # bigger pops with a woody thump
        t = D.tvec(0.15)
        p = D.reso(np.r_[1.0, np.zeros(len(t) - 1)], r.uniform(250, 500), 8) * 1.5 + D.bp(r.standard_normal(len(t)), 1000, 6000) * np.exp(-t / 0.006)
        cr = place(cr, p * r.uniform(0.3, 0.7), r.uniform(0, sec))
    return finish(roar + hiss + D.reverb_circular(cr, 0.15, 0.5))


def haunted_house(sec=30.0, seed=71):
    """Drafts howling through cracks, a low uneasy drone, distant creaks and a faint music-box chime."""
    import sfx
    r = D.rng(seed)
    n = D.n_of(sec)
    t = np.arange(n) / D.SR
    base = D.colored(sec, r=r, slope_db=-4.0)
    fc = 520 * (1 + 0.35 * lfo(sec, 3, 0.2) + 0.2 * lfo(sec, 7, 2.0))
    howl = D.periodic(lambda a, f: D.sweep(a, 'bp', f, 14.0), base, fc) * 1.6
    howl2 = D.periodic(lambda a, f: D.sweep(a, 'bp', f, 10.0), D.colored(sec, r=r, slope_db=-4.0), fc * 1.49) * 0.8
    amp = gusts(sec, r, 3, 0.8)
    draft = (howl + howl2) * np.clip(amp, 0.1, None) + bed(sec, r, 60, 600, -6) * 0.4
    drone = np.zeros(n)
    for f, a in [(D.hz('D2'), 1.0), (D.hz('A2'), 0.5), (D.hz('Eb3'), 0.25)]:
        drone += a * np.sin(2 * np.pi * D.loop_freq(f, sec) * t)
    drone *= 0.08 * (1 + 0.3 * lfo(sec, 2))
    x = draft + drone
    creak = sfx.door_creak()
    creak = creak / np.max(np.abs(creak))
    x = place(x, D.lp(creak, 3000) * 0.25, 9.0)
    x = place(x, D.lp(creak[::-1].copy(), 2500) * 0.15, 22.0)
    for k, m in enumerate(['A5', 'C6', 'E6', 'D#6', 'E6']):  # distant, slightly out-of-tune music box
        x = place(x, D.lp(I.bell(D.hz(m) * 0.995, 0.3, 0.06, decay=0.8), 4000), 15.0 + k * 0.42)
    return finish(D.reverb_circular(x, 0.35, 2.4, seed=13, damp=4000))


AMBIENCES = {
    'rain': (rain, 'Rain', ['rain', 'weather', 'wet', 'calm']),
    'thunderstorm': (thunderstorm, 'Thunderstorm', ['rain', 'thunder', 'storm', 'spooky', 'blackthorn']),
    'wind': (wind, 'Wind', ['wind', 'weather', 'outdoor', 'cold']),
    'park_birds': (park_birds, 'Park Birds', ['birds', 'park', 'morning', 'outdoor', 'nature']),
    'forest_stream': (forest_stream, 'Forest Stream', ['water', 'stream', 'forest', 'nature']),
    'ocean_waves': (ocean_waves, 'Ocean Waves', ['ocean', 'sea', 'beach', 'waves']),
    'night_crickets': (night_crickets, 'Night Crickets', ['night', 'crickets', 'summer', 'outdoor']),
    'city_traffic': (city_traffic, 'City Traffic', ['city', 'traffic', 'street', 'cars']),
    'cafe_murmur': (cafe_murmur, 'Cafe Murmur', ['cafe', 'crowd', 'restaurant', 'people', 'indoor']),
    'spaceship_hum': (spaceship_hum, 'Spaceship Hum', ['sci-fi', 'space', 'hum', 'engine']),
    'fireplace': (fireplace, 'Fireplace', ['fire', 'crackle', 'cozy', 'indoor']),
    'haunted_house': (haunted_house, 'Haunted House Drafts', ['spooky', 'haunted', 'wind', 'drafts', 'blackthorn']),
}
