#!/usr/bin/env python3
"""Filmly Studio procedural sound library generator.

Renders every built-in sound effect, music loop and ambience from code (no samples, no downloads), masters it,
checks it (peak / RMS / DC / loop seam) and encodes it to MP3 with ffmpeg into src/assets/sounds/<kind>/<id>.mp3,
then writes the manifest src/assets/sounds/sounds.json that the app loads as `assets.sounds`.

    python3 scripts/sounds/generate.py                 # everything
    python3 scripts/sounds/generate.py --only door_knock,spooky_mystery
    python3 scripts/sounds/generate.py --kind music --wav /tmp/wavs   # also keep WAVs for inspection
    python3 scripts/sounds/generate.py --list

Needs: Python 3.9+, numpy, scipy, ffmpeg (with libmp3lame) on PATH. Output is deterministic (seeded RNG).
Everything generated here is original synthesis, so the library is free to use in any film (CC0-style).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import wave
import zlib

import numpy as np

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT_DIR = os.path.join(ROOT, 'src', 'assets', 'sounds')
MANIFEST = os.path.join(OUT_DIR, 'sounds.json')

import dsp as D  # noqa: E402

# per kind: sample rate, channels, mp3 bitrate
FORMATS = {
    'sfx': dict(sr=44100, bitrate='96k'),
    'music': dict(sr=32000, bitrate='112k'),
    'ambience': dict(sr=32000, bitrate='64k'),
}
SFX_MAX_RMS = -14.0  # dBFS, loudest 300 ms window of a sound effect (loops set their own level in music/ambience.py)


def catalog():
    import sfx
    import music
    import ambience
    items = []
    for sid, (fn, name, tags) in sfx.SFX.items():
        items.append(dict(id=sid, kind='sfx', fn=fn, name=name, tags=tags, loop=False))
    for sid, (fn, name, tags) in music.SONGS.items():
        items.append(dict(id=sid, kind='music', fn=fn, name=name, tags=tags, loop=True))
    for sid, (fn, name, tags) in ambience.AMBIENCES.items():
        items.append(dict(id=sid, kind='ambience', fn=fn, name=name, tags=tags, loop=True))
    return items


def to_int16(x):
    return np.clip(np.round(x * 32767), -32768, 32767).astype('<i2')


def write_wav(path, x, sr):
    ch = 1 if x.ndim == 1 else x.shape[0]
    data = to_int16(x if x.ndim == 1 else x.T.reshape(-1))
    with wave.open(path, 'wb') as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(data.tobytes())


def stats(x, loop):
    mono = x if x.ndim == 1 else x.mean(axis=0)
    peak = 20 * np.log10(np.max(np.abs(x)) + 1e-12)
    rms = D.rms_db(x)
    dc = float(np.mean(mono))
    clip = int(np.sum(np.abs(x) >= 0.999))
    seam = None
    if loop:
        # loop seam: the jump across the wrap point compared with the largest sample step within 50 ms on
        # either side of it. <= 1 means the wrap is no rougher than the audio around it (i.e. seamless).
        w = D.n_of(0.05)
        around = max(np.max(np.abs(np.diff(mono[-w:]))), np.max(np.abs(np.diff(mono[:w]))))
        seam = float(abs(mono[0] - mono[-1]) / (around + 1e-9))
    return dict(peak=peak, rms=rms, dc=dc, clip=clip, seam=seam)


def render(item):
    import instruments
    import sfx
    fmt = FORMATS[item['kind']]
    D.SR = fmt['sr']
    # reseed the shared noise sources per item so `--only x` renders exactly what a full run renders
    seed = zlib.crc32(item['id'].encode())
    instruments._r = D.rng(seed)
    sfx.R = D.rng(seed + 1)
    x = item['fn']()
    x = np.asarray(x, dtype=float)
    if item['kind'] == 'sfx':
        x = D.remove_dc(x)
        # trim trailing near-silence (< -70 dB) but keep a short natural tail
        mono = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), axis=0)
        thr = np.max(mono) * 10 ** (-70 / 20)
        last = np.nonzero(mono > thr)[0]
        end = min(len(mono), (last[-1] if len(last) else len(mono)) + D.n_of(0.02))
        x = x[..., :end]
        x = D.fade(x, 0.0, 0.015) if x.ndim == 1 else np.vstack([D.fade(c, 0.0, 0.015) for c in x])
        x = D.normalize_peak(x, -1.0)
        # loudness cap: sustained tonal sounds (buzzers, chiptune) would otherwise be far louder than clicks
        # at the same peak. Limit the loudest 300 ms window to SFX_MAX_RMS.
        mono = x if x.ndim == 1 else x.mean(axis=0)
        win = D.n_of(0.3)
        e = np.convolve(mono ** 2, np.ones(win) / win, mode='same')
        st_rms = 10 * np.log10(np.max(e) + 1e-12)
        if st_rms > SFX_MAX_RMS:
            x = x * 10 ** ((SFX_MAX_RMS - st_rms) / 20)
    return x, fmt['sr']


def encode(wav_path, out_path, item):
    fmt = FORMATS[item['kind']]
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', wav_path, '-c:a', 'libmp3lame', '-b:a', fmt['bitrate'],
           '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '1', out_path]
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--only', help='comma separated ids')
    ap.add_argument('--kind', choices=['sfx', 'music', 'ambience'])
    ap.add_argument('--wav', help='also write WAV copies into this directory (for inspection)')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg is required (with libmp3lame)')

    items = catalog()
    if a.list:
        for it in items:
            print(f"{it['kind']:9s} {it['id']:22s} {it['name']}")
        return
    sel = items
    if a.only:
        want = set(a.only.split(','))
        unknown = want - {i['id'] for i in items}
        if unknown:
            sys.exit(f'unknown ids: {", ".join(sorted(unknown))}')
        sel = [i for i in items if i['id'] in want]
    if a.kind:
        sel = [i for i in sel if i['kind'] == a.kind]

    old = {}
    if os.path.exists(MANIFEST):
        for s in json.load(open(MANIFEST))['sounds']:
            old[s['id']] = s
    if a.wav:
        os.makedirs(a.wav, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='filmly-sounds-')
    problems = []
    try:
        for it in sel:
            t0 = time.time()
            x, sr = render(it)
            st = stats(x, it['loop'])
            n = x.shape[-1]
            wav = os.path.join(tmp, it['id'] + '.wav')
            write_wav(wav, x, sr)
            if a.wav:
                shutil.copy(wav, os.path.join(a.wav, it['id'] + '.wav'))
            rel = f"src/assets/sounds/{it['kind']}/{it['id']}.mp3"
            os.makedirs(os.path.dirname(os.path.join(ROOT, rel)), exist_ok=True)
            encode(wav, os.path.join(ROOT, rel), it)
            old[it['id']] = dict(id=it['id'], name=it['name'], kind=it['kind'], file=rel,
                                 duration=round(n / sr, 6), loop=it['loop'], tags=it['tags'])
            flag = []
            if st['clip']:
                flag.append(f"CLIP x{st['clip']}")
            if abs(st['dc']) > 0.002:
                flag.append(f"DC {st['dc']:.4f}")
            if st['seam'] is not None and st['seam'] > 1.0:
                flag.append(f"SEAM {st['seam']:.2f}")
            if flag:
                problems.append((it['id'], flag))
            seam = f" seam {st['seam']:.2f}" if st['seam'] is not None else ''
            kb = os.path.getsize(os.path.join(ROOT, rel)) / 1024
            print(f"{it['kind']:9s} {it['id']:22s} {n / sr:6.2f}s peak {st['peak']:6.1f} dB  rms {st['rms']:6.1f} dB{seam}  "
                  f"{kb:6.0f} KB  {time.time() - t0:5.1f}s {' '.join(flag)}", flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # drop manifest entries whose generator no longer exists
    known = {i['id'] for i in items}
    sounds = sorted((s for s in old.values() if s['id'] in known), key=lambda s: (['sfx', 'music', 'ambience'].index(s['kind']), s['id']))
    with open(MANIFEST, 'w') as f:
        json.dump({'version': 1, 'generator': 'scripts/sounds/generate.py', 'license': 'Procedurally generated by Filmly Studio; free to use in any film (CC0).', 'sounds': sounds}, f, indent=1)
        f.write('\n')
    print(f'manifest: {len(sounds)} sounds -> {os.path.relpath(MANIFEST, ROOT)}')
    if problems:
        print('PROBLEMS:', problems)
        sys.exit(1)


if __name__ == '__main__':
    main()
