"""One-shot sound effects (mono, 44.1 kHz). Each function returns a numpy array; generate.py trims, fades and
normalises. Designs are physical-ish: modal resonators for wood/glass/metal, filtered noise for air/water,
envelope-shaped oscillators for cartoon sounds."""
import numpy as np
import dsp as D
import instruments as I

R = D.rng(42)


def nz(sec, r=None):
    return (r or R).standard_normal(D.n_of(sec))


def room(x, wet=0.18, sec=0.6, seed=3, damp=7000):
    return D.reverb(x, wet, sec, seed, damp)


def modal(f0, ratios, amps, decays, sec):
    return D.additive(f0, list(zip(ratios, amps)), sec, decays=decays)


def burst(sec, lo, hi, tau, attack=0.001, r=None):
    return D.bp(nz(sec, r), lo, hi) * D.expdecay(sec, tau, attack)


def seq(events, total=None):
    """events: [(time_s, signal, gain)] -> mixed signal."""
    out = np.zeros(D.n_of(total) if total else 1)
    for t, x, g in events:
        out = D.place(out, x, t, g)
    return out


# ---- doors & household ------------------------------------------------------------------------
def _knock(r, strength=1.0):
    sec = 0.25
    t = D.tvec(sec)
    body = modal(170 * r.uniform(0.97, 1.03), [1, 1.58, 2.4, 3.9], [1, 0.6, 0.35, 0.15], [0.06, 0.04, 0.025, 0.015], sec)
    thud = D.lp(nz(sec, r), 600) * np.exp(-t / 0.012) * 0.8
    tap = D.bp(nz(sec, r), 1500, 5000) * np.exp(-t / 0.003) * 0.25
    return (body + thud + tap) * strength


def door_knock():
    r = D.rng(1)
    hits = [(0.0, 1.0), (0.2, 0.9), (0.4, 1.0)]
    x = seq([(t + r.normal(0, 0.008), _knock(r, s), 1.0) for t, s in hits], 0.8)
    return room(x, 0.22, 0.7)


def door_creak():
    """Stick-slip friction: an irregular pulse train exciting wood resonances."""
    r = D.rng(2)
    sec = 1.8
    n = D.n_of(sec)
    t = np.arange(n) / D.SR
    rate = 55 + 40 * np.sin(2 * np.pi * 0.6 * t + 0.5) + 25 * np.sin(2 * np.pi * 1.7 * t) + np.cumsum(r.normal(0, 0.4, n)) * 0.02
    rate = np.clip(rate, 18, 160)
    ph = np.cumsum(rate) / D.SR
    pulses = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    pulses[idx] = r.uniform(0.5, 1.0, len(idx))
    exc = pulses + D.hp(nz(sec, r), 2000) * 0.02
    y = D.reso(exc, 520, 12) * 1.0 + D.reso(exc, 1150, 14) * 0.7 + D.reso(exc, 2300, 16) * 0.35 + D.reso(exc, 3600, 18) * 0.15
    e = D.env([(0, 0), (0.15, 1), (1.2, 0.9), (1.7, 0.2), (sec, 0)], n=n)
    return room(y * e, 0.2, 0.8)


def door_slam():
    r = D.rng(3)
    sec = 1.2
    t = D.tvec(sec)
    boom = D.sine(90 * (1 + 0.4 * np.exp(-t / 0.02)), n=len(t)) * np.exp(-t / 0.12)
    panel = modal(140, [1, 1.7, 2.9, 4.4], [1, 0.6, 0.4, 0.2], [0.12, 0.08, 0.05, 0.03], sec) * 0.8
    crack = D.bp(nz(sec, r), 400, 6000) * np.exp(-t / 0.018)
    latch = np.zeros_like(t)
    latch = D.place(latch, modal(2400, [1, 1.9, 3.1], [1, 0.5, 0.3], [0.02, 0.012, 0.008], 0.08) * 0.35, 0.03)
    rattle = D.bp(nz(sec, r), 1500, 4000) * (np.abs(np.sin(2 * np.pi * 23 * t)) ** 4) * np.exp(-t / 0.12) * 0.15
    x = boom * 1.1 + panel + crack * 0.9 + latch[: len(t)] + rattle
    return room(D.saturate(x, 1.5), 0.3, 1.1)


def _step(r, kind, s=1.0):
    sec = 0.35
    t = D.tvec(sec)
    if kind == 'wood':
        heel = modal(r.uniform(150, 175), [1, 2.3, 3.7], [1, 0.4, 0.2], [0.05, 0.03, 0.015], sec) + D.lp(nz(sec, r), 900) * np.exp(-t / 0.02) * 0.9
        toe = D.bp(nz(sec, r), 300, 3000) * np.exp(-t / 0.015) * 0.5 + modal(240, [1, 2.1], [0.4, 0.2], [0.03, 0.02], sec)
        creak = D.reso(nz(sec, r) * np.exp(-t / 0.06), r.uniform(700, 900), 25) * 0.15
        toe += creak
    elif kind == 'concrete':
        heel = D.bp(nz(sec, r), 600, 6000) * np.exp(-t / 0.012) + D.lp(nz(sec, r), 300) * np.exp(-t / 0.015) * 1.2
        toe = D.bp(nz(sec, r), 1500, 8000) * np.exp(-t / 0.02) * 0.45
    elif kind == 'grass':
        e = D.env([(0, 0), (0.02, 1), (0.12, 0.3), (0.25, 0)], n=len(t))
        grains = D.bp(nz(sec, r) * (r.uniform(size=len(t)) > 0.7), 1500, 7000)
        heel = D.bp(nz(sec, r), 400, 5000) * e * 0.6 + grains * e * 0.8 + D.lp(nz(sec, r), 200) * np.exp(-t / 0.03) * 0.6
        toe = grains * D.env([(0, 0), (0.03, 1), (0.18, 0)], n=len(t)) * 0.6
    elif kind == 'gravel':
        heel = np.zeros_like(t)
        for k in range(40):  # many small stones
            g = burst(0.02, 1500, 7000, 0.002, r=r) * r.uniform(0.2, 1.0)
            heel = D.place(heel, g, abs(r.normal(0.02, 0.035)))[: len(t)]
        heel += D.lp(nz(sec, r), 250) * np.exp(-t / 0.03) * 0.6
        toe = np.zeros_like(t)
        for k in range(25):
            g = burst(0.02, 2000, 8000, 0.0015, r=r) * r.uniform(0.2, 0.8)
            toe = D.place(toe, g, abs(r.normal(0.03, 0.03)))[: len(t)]
    else:  # snow: soft compressed crunch
        e = D.env([(0, 0), (0.03, 1), (0.16, 0.5), (0.3, 0)], n=len(t))
        crunch = D.bp(nz(sec, r) * (r.uniform(size=len(t)) > 0.85) * 3, 800, 4500)
        heel = crunch * e * 0.7 + D.lp(nz(sec, r), 400) * e * 0.4
        toe = crunch * D.env([(0, 0), (0.02, 0.6), (0.1, 0)], n=len(t)) * 0.4
    return (heel + D.place(np.zeros_like(t), toe, 0.06)[: len(t)] * 0.8) * s


def _footsteps(kind, seed, n=6, gap=0.5):
    r = D.rng(seed)
    ev = []
    for k in range(n):
        ev.append((k * gap + r.normal(0, 0.015), _step(r, kind, r.uniform(0.8, 1.0) * (0.9 if k % 2 else 1.0)), 1.0))
    x = seq(ev, n * gap + 0.4)
    return room(x, 0.12 if kind in ('grass', 'snow') else 0.2, 0.6)


def footsteps_wood(): return _footsteps('wood', 10)
def footsteps_concrete(): return _footsteps('concrete', 11)
def footsteps_grass(): return _footsteps('grass', 12)
def footsteps_gravel(): return _footsteps('gravel', 13)
def footsteps_snow(): return _footsteps('snow', 14, gap=0.55)


def glass_clink():
    r = D.rng(20)
    def clink(f, s):
        sec = 1.2
        x = modal(f, [1, 2.32, 4.25, 6.63], [1, 0.5, 0.3, 0.12], [0.5, 0.25, 0.12, 0.06], sec)
        x += modal(f * 1.004, [1], [0.6], [0.45], sec)  # second glass, beating
        x[: D.n_of(0.003)] += D.hp(nz(0.003, r), 4000) * 0.4
        return x * s
    x = seq([(0, clink(2650, 1.0), 1.0), (0.11, clink(2930, 0.6), 1.0)], 1.4)
    return room(x, 0.15, 0.7)


def splash():
    r = D.rng(21)
    sec = 1.6
    t = D.tvec(sec)
    body = D.sweep(nz(sec, r), 'lp', 6000 * np.exp(-t / 0.35) + 300, 0.8) * D.env([(0, 0), (0.01, 1), (0.25, 0.5), (1.2, 0.05), (sec, 0)], n=len(t))
    plop = D.sine(140 + 300 * np.exp(-t / 0.03), n=len(t)) * np.exp(-t / 0.06) * 0.6
    drops = np.zeros_like(t)
    for k in range(45):
        f = r.uniform(900, 3000)
        d = D.sine(f * (1 + 0.8 * D.tvec(0.04) / 0.04), sec=0.04) * D.expdecay(0.04, 0.01) * r.uniform(0.05, 0.25)
        drops = D.place(drops, d, 0.15 + abs(r.normal(0, 0.35)))[: len(t)]
    return room(body * 0.9 + plop + drops, 0.15, 0.6)


def water_drop():
    sec = 0.4
    t = D.tvec(sec)
    f = 700 * (1 + 1.4 * np.clip(t / 0.06, 0, 1) ** 1.5)
    x = D.sine(f, n=len(t)) * D.env([(0, 0), (0.003, 1), (0.08, 0.3), (0.25, 0)], n=len(t))
    return room(x * 0.8, 0.25, 0.7)


def typing():
    r = D.rng(22)
    sec = 3.2
    out = np.zeros(D.n_of(sec))
    tt = 0.05
    while tt < sec - 0.3:
        space = r.uniform() < 0.12
        s = 0.12
        t = D.tvec(s)
        click = D.bp(nz(s, r), 2500, 7000) * np.exp(-t / 0.004) * r.uniform(0.5, 0.9)
        thock = modal(r.uniform(280, 360) * (0.7 if space else 1), [1, 2.4], [1, 0.4], [0.02, 0.01], s) * (0.9 if space else 0.6)
        bottom = D.place(np.zeros_like(t), D.bp(nz(0.03, r), 1500, 5000) * D.expdecay(0.03, 0.005) * 0.4, 0.035)[: len(t)]
        out = D.place(out, click + thock + bottom, tt)
        tt += r.choice([0.09, 0.11, 0.13, 0.16, 0.2, 0.35], p=[0.25, 0.25, 0.2, 0.15, 0.1, 0.05])
    return room(out[: D.n_of(sec)], 0.1, 0.4)


def camera_shutter():
    r = D.rng(23)
    sec = 0.5
    def clk(f, s):
        t = D.tvec(0.06)
        return (modal(f, [1, 1.8, 2.9], [1, 0.6, 0.4], [0.012, 0.008, 0.005], 0.06) + D.bp(nz(0.06, r), 2000, 9000) * np.exp(-t / 0.004)) * s
    whir = D.bp(nz(0.18, r), 1500, 4000) * D.env([(0, 0), (0.03, 0.15), (0.15, 0.1), (0.18, 0)], sec=0.18)
    return room(seq([(0, clk(1900, 1.0), 1), (0.07, clk(2300, 0.8), 1), (0.12, whir, 1)], sec), 0.1, 0.3)


def clock_tick():
    r = D.rng(24)
    ev = []
    for k in range(8):
        f = 3100 if k % 2 == 0 else 2500
        t = D.tvec(0.08)
        x = modal(f, [1, 1.47, 2.3], [1, 0.5, 0.3], [0.012, 0.008, 0.006], 0.08) + D.bp(nz(0.08, r), 3000, 9000) * np.exp(-t / 0.003) * 0.4
        x += modal(f / 4.5, [1], [0.3], [0.02], 0.08)
        ev.append((k * 0.5, x, 0.9 if k % 2 == 0 else 0.75))
    return room(seq(ev, 4.0), 0.2, 0.5)


def heartbeat():
    def thump(s):
        sec = 0.3
        t = D.tvec(sec)
        x = D.sine(55 * (1 + 0.3 * np.exp(-t / 0.02)), n=len(t)) * np.exp(-t / 0.07)
        x += D.sine(160 * (1 + 0.2 * np.exp(-t / 0.01)), n=len(t)) * np.exp(-t / 0.035) * 0.8  # chest 'thud' for small speakers
        x += D.bp(nz(sec), 120, 700) * np.exp(-t / 0.025) * 0.5
        return D.saturate(x, 1.5) * s
    ev = []
    for k in range(4):
        b = k * 0.86
        ev += [(b, thump(1.0), 1), (b + 0.2, thump(0.7), 1)]
    return D.lp(seq(ev, 3.6), 900)


def phone_ring():
    """Classic two-bell telephone ring (brrring ... brrring)."""
    sec = 3.4
    n = D.n_of(sec)
    t = np.arange(n) / D.SR
    gate = np.zeros(n)
    for start in (0.0, 1.9):
        m = (t >= start) & (t < start + 1.1)
        gate[m] = 1
    out = np.zeros(n)
    strike_t = np.arange(0, sec, 1 / 22.0)
    for k, st in enumerate(strike_t):
        if gate[min(n - 1, D.n_of(st))] == 0:
            continue
        f = 1250 if k % 2 == 0 else 1580
        hit = modal(f, [1, 2.1, 2.9, 4.2], [1, 0.5, 0.3, 0.15], [0.25, 0.12, 0.08, 0.04], 0.6) * 0.5
        out = D.place(out, hit, st)[:n]
    return room(D.lp(out, 6000), 0.12, 0.4)


def doorbell():
    def tone(m, s):
        return D.mixdown(I.bell(D.hz(m), 1, 1, decay=1.4), modal(D.hz(m), [1, 2], [0.6, 0.2], [1.5, 0.6], 3) * 0.4) * s
    x = seq([(0, tone('E5', 1.0), 1), (0.6, tone('C5', 0.95), 1)], 3.2)
    return room(x, 0.25, 1.4)


def alarm_clock():
    """Digital alarm: four quick beeps, repeated."""
    out = np.zeros(D.n_of(2.4))
    for g in range(2):
        for k in range(4):
            st = g * 1.0 + k * 0.12
            b = D.pulse(2050, sec=0.07, width=0.5) * D.env([(0, 0), (0.003, 1), (0.065, 1), (0.07, 0)], sec=0.07)
            out = D.place(out, D.lp(b, 7000) * 0.5, st)
    return room(out, 0.1, 0.3)


def page_turn():
    r = D.rng(26)
    sec = 0.7
    t = D.tvec(sec)
    e = D.env([(0, 0), (0.12, 0.4), (0.3, 1), (0.42, 0.2), (0.6, 0)], n=len(t), curve=1.5)
    crinkle = D.bp(nz(sec, r) * (1 + 3 * (r.uniform(size=len(t)) > 0.97)), 1500, 9000)
    flap = D.lp(nz(sec, r), 500) * D.env([(0, 0), (0.38, 0), (0.42, 1), (0.55, 0)], n=len(t))
    return room(crinkle * e * 0.6 + flap * 0.8, 0.1, 0.3)


def light_switch():
    r = D.rng(27)
    t = D.tvec(0.12)
    x = modal(1700, [1, 2.6, 4.1], [1, 0.5, 0.3], [0.01, 0.006, 0.004], 0.12) + D.bp(nz(0.12, r), 2000, 9000) * np.exp(-t / 0.002) * 0.6
    x += D.lp(nz(0.12, r), 400) * np.exp(-t / 0.008) * 0.5
    return room(x, 0.15, 0.35)


def cash_register():
    r = D.rng(28)
    drawer = D.lp(nz(0.4, r), 800) * D.env([(0, 0), (0.05, 0.6), (0.25, 0.3), (0.32, 1), (0.4, 0)], sec=0.4)
    clunk = _knock(r, 0.8)
    ding = D.mixdown(I.bell(D.hz('A6'), 1, 1, decay=0.9), I.bell(D.hz('E7'), 1, 0.5, decay=0.6))
    return room(seq([(0, drawer, 0.6), (0.33, clunk, 0.7), (0.05, ding, 0.9)], 2.0), 0.2, 0.8)


# ---- cartoon ----------------------------------------------------------------------------------
def whoosh():
    r = D.rng(30)
    sec = 0.9
    t = D.tvec(sec)
    fc = 300 + 1600 * np.sin(np.pi * np.clip(t / 0.75, 0, 1)) ** 2
    x = D.sweep(nz(sec, r), 'bp', fc, 1.4) + D.sweep(nz(sec, r), 'lp', fc * 0.6, 0.7) * 0.4
    e = D.env([(0, 0), (0.42, 1), (0.8, 0.05), (sec, 0)], n=len(t), curve=2.0)
    return x * e


def swoosh():
    r = D.rng(31)
    sec = 0.4
    t = D.tvec(sec)
    fc = 1200 + 3500 * np.sin(np.pi * np.clip(t / 0.35, 0, 1)) ** 2
    x = D.sweep(nz(sec, r), 'bp', fc, 2.0)
    e = D.env([(0, 0), (0.16, 1), (0.36, 0), (sec, 0)], n=len(t), curve=2.0)
    return x * e


def pop():
    sec = 0.18
    t = D.tvec(sec)
    f = 320 + 900 * np.clip(t / 0.03, 0, 1) ** 0.7
    x = D.sine(f, n=len(t)) * D.env([(0, 0), (0.002, 1), (0.04, 0.35), (0.12, 0)], n=len(t))
    x += D.bp(nz(sec), 1000, 6000) * np.exp(-t / 0.003) * 0.3
    return room(x, 0.1, 0.3)


def boing():
    sec = 1.1
    t = D.tvec(sec)
    depth = 0.28 * np.exp(-t / 0.35)
    f = 190 * (1 + 0.2 * np.clip(t / 0.8, 0, 1)) * (1 + depth * np.sin(2 * np.pi * 14 * t))
    x = D.sine(f, n=len(t)) * 0.8 + D.tri(f * 2, n=len(t)) * 0.15 + D.sine(f * 3.02, n=len(t)) * 0.12
    x *= D.env([(0, 0), (0.004, 1), (0.2, 0.7), (sec, 0)], n=len(t), curve=1.3)
    return room(x, 0.1, 0.4)


def bonk():
    r = D.rng(32)
    sec = 0.5
    t = D.tvec(sec)
    block = modal(720, [1, 2.7, 4.6], [1, 0.45, 0.2], [0.07, 0.03, 0.015], sec)
    thud = D.sine(120 * (1 + 0.5 * np.exp(-t / 0.01)), n=len(t)) * np.exp(-t / 0.05)
    tick = D.bp(nz(sec, r), 2000, 8000) * np.exp(-t / 0.002) * 0.4
    return room(block + thud * 0.9 + tick, 0.12, 0.4)


def _slide_whistle(f0, f1):
    r = D.rng(33)
    sec = 1.0
    t = D.tvec(sec)
    k = np.clip(t / 0.85, 0, 1)
    k = k * k * (3 - 2 * k)
    f = f0 * (f1 / f0) ** k * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    x = D.sine(f, n=len(t)) + 0.08 * D.sine(2 * f, n=len(t))
    breath = D.sweep(nz(sec, r), 'bp', f, 4.0) * 0.15
    e = D.env([(0, 0), (0.05, 1), (0.85, 0.9), (sec, 0)], n=len(t))
    return room((x * 0.6 + breath) * e, 0.15, 0.5)


def slide_whistle_up(): return _slide_whistle(480, 1700)
def slide_whistle_down(): return _slide_whistle(1700, 420)


def cartoon_zip():
    """Zip away! fast rising squeal + air."""
    r = D.rng(34)
    sec = 0.45
    t = D.tvec(sec)
    f = 300 * (12 ** np.clip(t / 0.3, 0, 1))
    x = D.sine(f, n=len(t)) * 0.4 + D.sweep(nz(sec, r), 'bp', np.minimum(f * 2, 12000), 3) * 0.6
    e = D.env([(0, 0), (0.02, 1), (0.3, 0.6), (sec, 0)], n=len(t))
    return x * e


def squeak_toy():
    sec = 0.55
    t = D.tvec(sec)
    f = 1050 * (1 + 0.25 * np.sin(np.pi * np.clip(t / 0.45, 0, 1))) * (1 + 0.02 * np.sin(2 * np.pi * 28 * t))
    x = D.pulse(f, n=len(t), width=0.4) * 0.3 + D.sine(f, n=len(t)) * 0.5
    x = D.reso(x, 2200, 2) * 0.6 + D.lp(x, 3500) * 0.5
    e = D.env([(0, 0), (0.03, 1), (0.42, 0.8), (sec, 0)], n=len(t))
    return x * e


def punch():
    r = D.rng(35)
    sec = 0.5
    t = D.tvec(sec)
    thump = D.sine(80 * (1 + 0.8 * np.exp(-t / 0.015)), n=len(t)) * np.exp(-t / 0.09)
    smack = D.bp(nz(sec, r), 400, 5000) * np.exp(-t / 0.02)
    swish = whoosh()[-D.n_of(0.12):] * 0.3
    x = np.zeros(len(t))
    x = D.place(x, swish, 0)[: len(t)]
    hit = D.saturate(thump * 1.2 + smack * 0.9, 2.0)
    x = D.place(x, hit, 0.1)
    return room(x, 0.12, 0.4)


def explosion():
    r = D.rng(36)
    sec = 3.5
    t = D.tvec(sec)
    boom = D.sweep(nz(sec, r), 'lp', 2500 * np.exp(-t / 0.25) + 120, 0.8) * D.env([(0, 0), (0.008, 1), (0.4, 0.55), (3.0, 0.05), (sec, 0)], n=len(t), curve=1.3)
    sub = D.sine(48 * (1 + np.exp(-t / 0.08)), n=len(t)) * np.exp(-t / 0.5)
    crackle = D.hp(nz(sec, r) * (r.uniform(size=len(t)) > 0.995) * 6, 1500) * np.exp(-t / 0.8) * 0.3
    x = D.saturate(boom * 1.6 + sub * 0.9 + crackle, 1.8)
    return room(x, 0.2, 1.8, damp=3000)


def laser():
    sec = 0.35
    t = D.tvec(sec)
    f = 2400 * np.exp(-t / 0.08) + 180
    x = D.saw(f * (1 + 0.15 * D.sine(f * 0.5, n=len(t))), n=len(t)) * 0.35 + D.sine(f, n=len(t)) * 0.6
    x = D.lp(x, 7000)
    return D.delay(x * D.env([(0, 0), (0.003, 1), (0.25, 0.3), (sec, 0)], n=len(t)), 0.07, 0.4, 0.3, 3)


def scifi_beeps():
    r = D.rng(37)
    notes = ['C6', 'G6', 'E6', 'A6', 'D6', 'C7', 'G6']
    out = np.zeros(D.n_of(1.3))
    tt = 0.0
    for k, m in enumerate(notes):
        d = r.choice([0.06, 0.09, 0.12])
        b = D.lp(D.pulse(D.hz(m), sec=d, width=0.5), 5000) * D.env([(0, 0), (0.002, 1), (d - 0.005, 1), (d, 0)], sec=d) * 0.4
        out = D.place(out, b, tt)
        tt += d + r.choice([0.02, 0.05, 0.08])
    return D.delay(out, 0.11, 0.3, 0.25, 3)


def magic_sparkle():
    r = D.rng(38)
    sec = 2.4
    out = np.zeros(D.n_of(sec))
    scale = ['C6', 'E6', 'G6', 'B6', 'D7', 'E7', 'G7', 'B7', 'C8']
    for k, m in enumerate(scale):
        out = D.place(out, I.bell(D.hz(m), 0.2, 0.6, decay=0.5), 0.05 + k * 0.07)
    for k in range(40):
        f = r.uniform(4000, 9500)
        ping = D.sine(f, sec=0.15) * D.expdecay(0.15, 0.03) * r.uniform(0.05, 0.2)
        out = D.place(out, ping, r.uniform(0.0, 1.2))
    shimmer = D.hp(nz(sec, r), 6000) * D.env([(0, 0), (0.3, 0.06), (1.2, 0.03), (sec, 0)], sec=sec)
    out = out[: D.n_of(sec)] + shimmer
    return room(out, 0.4, 1.8, damp=11000)


def chime():
    out = np.zeros(D.n_of(2.5))
    for k, m in enumerate(['C6', 'E6', 'G6', 'C7']):
        out = D.place(out, I.bell(D.hz(m), 1, 0.8, decay=1.0), k * 0.11)
    return room(out, 0.3, 1.5)


def ding():
    """Hotel desk bell."""
    x = modal(2093, [1, 2.03, 2.74, 4.2, 5.45], [1, 0.25, 0.45, 0.2, 0.1], [1.2, 0.6, 0.5, 0.2, 0.12], 3.0)
    x += modal(2097, [1], [0.5], [1.1], 3.0)  # slight beating
    x[: D.n_of(0.002)] += D.hp(nz(0.002), 3000) * 0.5
    return room(x, 0.2, 1.2)


def notification():
    out = np.zeros(D.n_of(1.0))
    out = D.place(out, I.marimba(D.hz('E6'), 0.2, 1.0), 0)
    out = D.place(out, I.marimba(D.hz('B6'), 0.2, 0.9), 0.11)
    out = D.place(out, I.bell(D.hz('B6'), 0.2, 0.15, decay=0.4), 0.11)
    return room(out, 0.2, 0.6)


def coin():
    out = np.zeros(D.n_of(0.6))
    for st, m, d in [(0, 'B5', 0.07), (0.07, 'E6', 0.4)]:
        out = D.place(out, I.pulse_lead(D.hz(m), d, 1.0, width=0.5, vib=False) * D.expdecay(d + 0.05, 0.25 if d > 0.1 else 1), st)
    return out


def powerup():
    out = np.zeros(D.n_of(1.0))
    notes = ['C5', 'E5', 'G5', 'C6', 'D5', 'F#5', 'A5', 'D6', 'E5', 'G#5', 'B5', 'E6']
    for k, m in enumerate(notes):
        out = D.place(out, I.pulse_lead(D.hz(m), 0.06, 1.0, width=0.25, vib=False), k * 0.06)
    return out


def jump_8bit():
    sec = 0.3
    t = D.tvec(sec)
    f = 260 * (1 + 2.0 * np.clip(t / 0.2, 0, 1) ** 0.6)
    x = D.pulse(f, n=len(t), width=0.5, naive=True) * 0.3
    e = np.round(D.env([(0, 1), (0.2, 0.7), (sec, 0)], n=len(t)) * 15) / 15
    return x * e


# ---- comedy / stingers ------------------------------------------------------------------------
def drum_roll():
    r = D.rng(40)
    sec = 4.0
    out = np.zeros(D.n_of(sec))
    tt = 0.0
    k = 0
    while tt < 2.6:
        v = 0.35 + 0.6 * (tt / 2.6) ** 1.5
        out = D.place(out, I.snare(v * r.uniform(0.85, 1.0) * (1 if k % 2 else 0.9), snappy=1.2, decay=0.08), tt)
        tt += 0.045 + r.normal(0, 0.003)
        k += 1
    out = D.place(out, I.snare(1.1, snappy=1.3), 2.68)
    out = D.place(out, I.kick(1.0), 2.68)
    out = D.place(out, I.crash(1.0, decay=1.3) * 1.4, 2.68)
    return room(out[: D.n_of(sec)], 0.2, 1.0)


def rimshot():
    """Ba-dum tss."""
    out = np.zeros(D.n_of(2.2))
    out = D.place(out, I.snare(0.9), 0.0)
    out = D.place(out, I.tom(0.9, f=95, decay=0.2), 0.22)
    out = D.place(out, I.kick(0.9), 0.44)
    out = D.place(out, I.snare(0.8), 0.44)
    out = D.place(out, I.crash(1.0, decay=0.6) * 1.5, 0.44)
    return room(out, 0.2, 0.9)


def sad_trombone():
    """Wah wah wah waaah (with a wobbling last note)."""
    notes = [('D4', 0.0, 0.42), ('C#4', 0.5, 0.42), ('C4', 1.0, 0.42), ('B3', 1.5, 1.6)]
    out = np.zeros(D.n_of(3.4))
    for k, (m, st, d) in enumerate(notes):
        f = D.hz(m)
        sec = d + 0.25
        t = D.tvec(sec)
        wob = (1 + 0.02 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.3) / 0.3, 0, 1)) if k == 3 else 1
        sag = 1 - 0.03 * np.clip(t / d, 0, 1) if k == 3 else 1
        x = D.saw(f * wob * sag, n=len(t)) * 0.7 + D.saw(f * 1.003 * wob * sag, n=len(t)) * 0.3
        wah = D.env([(0, 0.15), (0.12, 1), (d * 0.8, 0.7), (sec, 0.3)], n=len(t))
        if k == 3:
            wah *= 0.75 + 0.25 * np.sin(2 * np.pi * 2.7 * t)
        y = D.sweep(x, 'lp', np.minimum(f * (1.5 + 6 * wah), 9000), 1.4)
        e = D.env([(0, 0), (0.04, 1), (d, 0.85), (d + 0.15, 0)], n=len(t))
        out = D.place(out, D.saturate(y * e, 1.3) * 0.6, st)
    return room(out, 0.2, 0.9)


def success_fanfare():
    out = np.zeros(D.n_of(3.2))
    tr = [('C5', 0.0, 0.12), ('C5', 0.16, 0.12), ('C5', 0.32, 0.12), ('G5', 0.48, 1.6)]
    for m, st, d in tr:
        out = D.place(out, I.brass(D.hz(m), d, 1.0) * 0.8, st)
    for m in ['C4', 'E4', 'G4', 'C5', 'E5']:
        out = D.place(out, I.brass(D.hz(m), 1.5, 0.75) * 0.35, 0.48)
    for k, m in enumerate(['C6', 'E6', 'G6', 'C7']):
        out = D.place(out, I.glock(D.hz(m), 0.5, 0.5), 0.48 + k * 0.05)
    out = D.place(out, I.timpani(D.hz('C3'), 1.0, 1.8) * 0.9, 0.48)
    out = D.place(out, I.crash(0.8, decay=1.4), 0.48)
    return room(out, 0.25, 1.4)


def fail_buzzer():
    sec = 1.0
    t = D.tvec(sec)
    x = D.saw(110, n=len(t)) * 0.5 + D.pulse(116.5, n=len(t), width=0.5) * 0.4 + D.saw(55, n=len(t)) * 0.3
    x = D.lp(x, 2200, 2)
    x = D.saturate(x * 1.4, 2.0)
    e = D.env([(0, 0), (0.01, 1), (0.85, 1), (sec, 0)], n=len(t))
    return x * e


def applause():
    """A crowd of ~30 synthesized clappers: swell, sustain, fade."""
    r = D.rng(41)
    sec = 5.0
    out = np.zeros(D.n_of(sec))
    for p in range(32):
        rate = r.uniform(3.2, 5.2)
        tone_lo, tone_hi = sorted(r.uniform(700, 3200, 2))
        tone_hi = max(tone_hi, tone_lo * 1.6)
        start = abs(r.normal(0.25, 0.25))
        stop = r.uniform(2.8, 4.2)
        dist = r.uniform(0.35, 1.0)
        tt = start
        while tt < stop:
            s = 0.09
            t = D.tvec(s)
            c = D.bp(nz(s, r), tone_lo, tone_hi) * np.exp(-t / r.uniform(0.01, 0.022))
            c[: D.n_of(0.002)] *= np.linspace(0, 1, D.n_of(0.002))
            out = D.place(out, c * dist * r.uniform(0.6, 1.0), tt)
            tt += 1 / rate + r.normal(0, 0.02)
    out = out[: D.n_of(sec)]
    env = D.env([(0, 0.2), (0.6, 1), (2.8, 1), (4.4, 0.05), (sec, 0)], sec=sec)
    out = D.lp(out * env, 9000)
    return room(out, 0.35, 1.6)


def spooky_stinger():
    """Reverse swell into a dissonant string/organ hit with a deep boom (no scream)."""
    r = D.rng(43)
    sec = 4.5
    n = D.n_of(sec)
    t = np.arange(n) / D.SR
    swell = D.hp(nz(1.4, r), 2500) * np.linspace(0, 1, D.n_of(1.4)) ** 3 * 0.5
    out = np.zeros(n)
    out = D.place(out, swell, 0.0)[:n]
    cluster = ['C3', 'F#3', 'B3', 'C4', 'F4', 'F#5', 'G5']
    for k, m in enumerate(cluster):
        out = D.place(out, I.strings(D.hz(m), 2.2, 0.9, attack=0.02, release=1.4, cutoff=6000, voices=4) * 0.5, 1.4 + k * 0.004)[:n]
    out = D.place(out, I.timpani(D.hz('C2'), 1.0, 2.5) * 1.2, 1.4)[:n]
    boom = D.sine(42 * (1 + 0.4 * np.exp(-D.tvec(2.5) / 0.05)), sec=2.5) * D.expdecay(2.5, 0.6) * 0.8
    out = D.place(out, boom, 1.4)[:n]
    return room(out, 0.35, 2.8)


def creepy_organ():
    """Haunted-house pipe organ chord: D minor over a diminished cluster with a slow tremolo."""
    sec = 4.5
    out = np.zeros(D.n_of(sec + 0.5))
    for m in ['D2', 'D3', 'A3', 'D4', 'F4', 'G#4', 'D5']:
        out = D.place(out, I.organ(D.hz(m), 3.6, 0.8, bars=(8, 4, 8, 6, 3, 4, 0, 2, 3), click=0.2), 0)
    t = np.arange(len(out)) / D.SR
    out *= 1 - 0.18 * (0.5 + 0.5 * np.sin(2 * np.pi * 5.8 * t))
    out = D.lp(out, 5000)
    return room(out, 0.45, 3.2, damp=5000)


def gong():
    sec = 6.0
    t = D.tvec(sec)
    x = modal(110, [1, 1.52, 2.0, 2.41, 2.88, 3.3, 4.1, 5.2], [1, 0.7, 0.6, 0.5, 0.45, 0.35, 0.25, 0.15], [3.5, 3.0, 2.6, 2.2, 1.8, 1.4, 1.0, 0.7], sec)
    shimmer = D.bp(nz(sec), 1500, 6000) * D.env([(0, 0), (0.6, 0.2), (2.5, 0.1), (sec, 0)], n=len(t))
    x = x * (1 + 0.15 * np.sin(2 * np.pi * 0.7 * t)) + shimmer
    x += D.lp(nz(sec), 300) * np.exp(-t / 0.05) * 0.8
    return room(x, 0.2, 2.0)


def referee_whistle():
    r = D.rng(44)
    sec = 0.9
    t = D.tvec(sec)
    trill = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 32 * t + r.uniform()))
    f = 2850 * (1 + 0.03 * trill)
    x = D.sine(f, n=len(t)) * (0.75 + 0.25 * trill) + D.bp(nz(sec, r), 2500, 4000) * 0.2
    e = D.env([(0, 0), (0.02, 1), (0.75, 1), (sec, 0)], n=len(t))
    return room(x * e * 0.6, 0.15, 0.6)


def car_horn():
    sec = 0.9
    t = D.tvec(sec)
    x = D.saw(392, n=len(t)) + D.saw(494, n=len(t)) * 0.9
    x = D.reso(x, 1200, 1.2) * 0.6 + D.lp(x, 2500) * 0.4
    e = D.env([(0, 0), (0.02, 1), (0.8, 1), (sec, 0)], n=len(t))
    return room(D.saturate(x * e, 1.5), 0.15, 0.6)


def tire_screech():
    r = D.rng(45)
    sec = 1.6
    t = D.tvec(sec)
    f = 1700 + 300 * np.sin(2 * np.pi * 7 * t + np.cumsum(r.normal(0, 0.02, len(t)))) * 0.5
    x = D.sweep(nz(sec, r), 'bp', f, 14.0) * 2.5 + D.sweep(nz(sec, r), 'bp', f * 2.05, 12.0) * 1.2
    e = D.env([(0, 0), (0.05, 1), (1.2, 0.8), (sec, 0)], n=len(t))
    return room(x * e, 0.1, 0.5)


def button_click():
    r = D.rng(46)
    t = D.tvec(0.08)
    x = modal(3200, [1, 1.9], [1, 0.4], [0.006, 0.004], 0.08) + D.bp(nz(0.08, r), 3000, 10000) * np.exp(-t / 0.0015) * 0.5
    x2 = modal(2600, [1, 1.7], [0.6, 0.3], [0.005, 0.003], 0.08)
    return seq([(0, x, 1), (0.045, x2, 0.6)], 0.15)


# ---- nature / weather -------------------------------------------------------------------------
def thunder():
    r = D.rng(50)
    sec = 6.0
    n = D.n_of(sec)
    t = np.arange(n) / D.SR
    crack = D.hp(nz(sec, r), 800) * D.env([(0, 0), (0.005, 1), (0.08, 0.4), (0.4, 0.1), (1.0, 0)], n=n) * 0.6
    rumble = D.lp(D.brown(n=n, r=r), 220) * 3
    mod = np.zeros(n)
    for k in range(7):
        c = r.uniform(0.2, 3.5)
        w = r.uniform(0.3, 1.0)
        mod += r.uniform(0.4, 1.0) * np.exp(-((t - c) / w) ** 2)
    mod = mod * D.env([(0, 0), (0.05, 1), (3.0, 0.8), (sec, 0)], n=n)
    body = D.lp(nz(sec, r), 900) * mod * 0.5
    x = crack + rumble * mod + body
    return room(D.saturate(x, 1.3), 0.3, 2.5, damp=2500)


def rain_burst():
    r = D.rng(51)
    sec = 4.0
    n = D.n_of(sec)
    bed = D.bp(D.pink(n=n, r=r), 400, 9000)
    drops = np.zeros(n)
    for k in range(600):
        d = D.reso(np.r_[1.0, np.zeros(D.n_of(0.02) - 1)], r.uniform(1800, 6000), 8) * r.uniform(0.05, 0.4)
        drops = D.place(drops, d, r.uniform(0, sec))[:n]
    e = D.env([(0, 0), (0.8, 1), (2.8, 1), (sec, 0)], n=n, curve=1.4)
    return (bed * 0.8 + drops) * e


def wind_gust():
    r = D.rng(52)
    sec = 3.2
    t = D.tvec(sec)
    k = np.clip(t / sec, 0, 1)
    fc = 350 + 900 * np.sin(np.pi * k) ** 2
    x = D.sweep(D.pink(sec, r=r), 'bp', fc, 2.5) * 1.5 + D.sweep(D.pink(sec, r=r), 'bp', fc * 2.3, 6) * 0.4
    e = D.env([(0, 0), (1.3, 1), (2.0, 0.8), (sec, 0)], n=len(t), curve=1.6)
    return x * e


def owl_hoot():
    """Hoo ... hoo-hoo-hooo (tawny-ish), soft sine voice with breath."""
    r = D.rng(53)
    out = np.zeros(D.n_of(3.2))
    for st, d, f0, s in [(0, 0.45, 390, 1.0), (0.85, 0.16, 400, 0.6), (1.1, 0.16, 400, 0.6), (1.38, 0.7, 395, 1.0)]:
        t = D.tvec(d + 0.1)
        f = f0 * (1 + 0.04 * np.exp(-t / 0.05)) * (1 - 0.05 * np.clip(t / d, 0, 1)) * (1 + 0.006 * np.sin(2 * np.pi * 9 * t))
        x = D.sine(f, n=len(t)) + 0.1 * D.sine(2 * f, n=len(t))
        x += D.sweep(nz(d + 0.1, r), 'bp', f * 2, 3) * 0.08
        e = D.env([(0, 0), (0.05, 1), (d * 0.8, 0.8), (d + 0.08, 0)], n=len(t), curve=1.3)
        out = D.place(out, x * e * s, st)
    return D.reverb(out, 0.4, 2.0, damp=4000)


def wolf_howl():
    """Synthesised howl: a formant-filtered voice gliding up, holding with vibrato, then falling."""
    r = D.rng(54)
    sec = 3.6
    t = D.tvec(sec)
    contour = D.env([(0, 330), (0.5, 560), (1.3, 640), (2.4, 600), (3.2, 420), (sec, 380)], n=len(t))
    vib = 1 + 0.012 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.6) / 0.5, 0, 1)
    f = contour * vib
    src = D.saw(f, n=len(t)) * 0.3 + D.sine(f, n=len(t)) * 0.8
    # 'oo' -> 'ah' -> 'oo' vowel morph
    vow = D.env([(0, 0), (0.6, 1), (2.6, 0.8), (sec, 0.1)], n=len(t))
    f1 = 350 + 300 * vow
    f2 = 800 + 400 * vow
    y = D.sweep(src, 'bp', f1, 4.0) * 1.2 + D.sweep(src, 'bp', f2, 6.0) * 0.5 + D.lp(src, 600) * 0.4
    y += D.sweep(nz(sec, r), 'bp', f2, 3.0) * 0.04
    e = D.env([(0, 0), (0.25, 0.8), (0.6, 1), (2.6, 0.9), (3.4, 0)], n=len(t), curve=1.3)
    return D.reverb(y * e, 0.45, 2.5, damp=4000)


SFX = {
    # household
    'door_knock': (door_knock, 'Door Knock', ['door', 'knock', 'wood']),
    'door_creak': (door_creak, 'Door Creak', ['door', 'creak', 'spooky', 'hinge']),
    'door_slam': (door_slam, 'Door Slam', ['door', 'slam', 'impact']),
    'footsteps_wood': (footsteps_wood, 'Footsteps (Wood)', ['footsteps', 'walk', 'wood', 'floor']),
    'footsteps_concrete': (footsteps_concrete, 'Footsteps (Concrete)', ['footsteps', 'walk', 'street', 'hard']),
    'footsteps_grass': (footsteps_grass, 'Footsteps (Grass)', ['footsteps', 'walk', 'grass', 'outdoor']),
    'footsteps_gravel': (footsteps_gravel, 'Footsteps (Gravel)', ['footsteps', 'walk', 'gravel', 'path']),
    'footsteps_snow': (footsteps_snow, 'Footsteps (Snow)', ['footsteps', 'walk', 'snow', 'winter']),
    'glass_clink': (glass_clink, 'Glass Clink', ['glass', 'cheers', 'toast']),
    'splash': (splash, 'Splash', ['water', 'splash']),
    'water_drop': (water_drop, 'Water Drop', ['water', 'drop', 'drip', 'bloop']),
    'typing': (typing, 'Typing', ['keyboard', 'typing', 'computer', 'office']),
    'camera_shutter': (camera_shutter, 'Camera Shutter', ['camera', 'photo', 'click']),
    'clock_tick': (clock_tick, 'Clock Tick', ['clock', 'tick', 'time']),
    'heartbeat': (heartbeat, 'Heartbeat', ['heart', 'tension', 'pulse']),
    'phone_ring': (phone_ring, 'Phone Ring', ['phone', 'ring', 'telephone']),
    'doorbell': (doorbell, 'Doorbell', ['door', 'bell', 'ding dong']),
    'alarm': (alarm_clock, 'Alarm Clock', ['alarm', 'beep', 'wake up']),
    'page_turn': (page_turn, 'Page Turn', ['paper', 'book', 'page']),
    'light_switch': (light_switch, 'Light Switch', ['switch', 'click', 'light']),
    'cash_register': (cash_register, 'Cash Register', ['money', 'ka-ching', 'shop']),
    # cartoon
    'whoosh': (whoosh, 'Whoosh', ['whoosh', 'swing', 'transition', 'air']),
    'swoosh': (swoosh, 'Swoosh', ['swoosh', 'fast', 'transition', 'air']),
    'pop': (pop, 'Pop', ['pop', 'cartoon', 'bubble']),
    'boing': (boing, 'Boing', ['boing', 'spring', 'cartoon', 'bounce']),
    'bonk': (bonk, 'Bonk', ['bonk', 'hit', 'cartoon', 'head']),
    'slide_whistle_up': (slide_whistle_up, 'Slide Whistle Up', ['slide whistle', 'cartoon', 'rise']),
    'slide_whistle_down': (slide_whistle_down, 'Slide Whistle Down', ['slide whistle', 'cartoon', 'fall']),
    'cartoon_zip': (cartoon_zip, 'Cartoon Zip', ['zip', 'run away', 'cartoon', 'fast']),
    'squeak_toy': (squeak_toy, 'Squeak Toy', ['squeak', 'toy', 'cartoon']),
    'punch': (punch, 'Punch', ['punch', 'hit', 'fight', 'impact']),
    'explosion': (explosion, 'Explosion', ['explosion', 'boom', 'blast']),
    'laser': (laser, 'Laser', ['laser', 'sci-fi', 'pew', 'zap']),
    'scifi_beep': (scifi_beeps, 'Sci-fi Beeps', ['sci-fi', 'computer', 'robot', 'beep']),
    'magic_sparkle': (magic_sparkle, 'Magic Sparkle', ['magic', 'sparkle', 'fairy', 'twinkle']),
    'chime': (chime, 'Chime', ['chime', 'bell', 'idea', 'positive']),
    'ding': (ding, 'Ding', ['ding', 'bell', 'service', 'correct']),
    'notification': (notification, 'Notification', ['notification', 'message', 'ui', 'phone']),
    'coin': (coin, 'Coin (8-bit)', ['coin', '8bit', 'game', 'pickup']),
    'powerup': (powerup, 'Power-up (8-bit)', ['powerup', '8bit', 'game', 'level up']),
    'jump_8bit': (jump_8bit, 'Jump (8-bit)', ['jump', '8bit', 'game']),
    'button_click': (button_click, 'Button Click', ['click', 'ui', 'button', 'mouse']),
    # comedy & stingers
    'drum_roll': (drum_roll, 'Drum Roll', ['drum roll', 'reveal', 'suspense']),
    'rimshot': (rimshot, 'Rimshot (Ba-dum Tss)', ['rimshot', 'joke', 'comedy', 'ba-dum tss']),
    'sad_trombone': (sad_trombone, 'Sad Trombone', ['sad', 'fail', 'trombone', 'comedy', 'wah wah']),
    'success_fanfare': (success_fanfare, 'Success Fanfare', ['win', 'success', 'fanfare', 'ta-da']),
    'fail_buzzer': (fail_buzzer, 'Fail Buzzer', ['wrong', 'fail', 'buzzer', 'game show']),
    'applause': (applause, 'Applause', ['applause', 'clapping', 'crowd', 'audience']),
    'spooky_stinger': (spooky_stinger, 'Spooky Stinger', ['spooky', 'horror', 'scare', 'reveal', 'blackthorn']),
    'creepy_organ': (creepy_organ, 'Creepy Organ Chord', ['spooky', 'organ', 'haunted', 'blackthorn']),
    'gong': (gong, 'Gong', ['gong', 'metal', 'announcement']),
    'referee_whistle': (referee_whistle, 'Referee Whistle', ['whistle', 'sport', 'stop']),
    'car_horn': (car_horn, 'Car Horn', ['car', 'horn', 'honk', 'traffic']),
    'tire_screech': (tire_screech, 'Tire Screech', ['car', 'brakes', 'screech', 'chase']),
    # nature
    'thunder': (thunder, 'Thunder', ['thunder', 'storm', 'weather', 'spooky']),
    'rain_burst': (rain_burst, 'Rain Burst', ['rain', 'shower', 'weather']),
    'wind_gust': (wind_gust, 'Wind Gust', ['wind', 'gust', 'weather']),
    'owl_hoot': (owl_hoot, 'Owl Hoot', ['owl', 'night', 'bird', 'spooky']),
    'wolf_howl': (wolf_howl, 'Wolf Howl (synth)', ['wolf', 'howl', 'night', 'spooky']),
}
