# Filmly Studio — Plan

Filmly Studio is a library of reusable 2D film assets, a browser editor, and a small language
(**FilmScript**, `.fly`) for making short films that Claude and a human can both edit.
Everything is vector + HTML, so output is resolution independent and exports straight to MP4.

## Principles

1. **Data first.** Characters, rigs, scenes, voices, transitions are plain JSON/JS files in `src/assets/`.
   Claude can add or change them by editing files; the editor picks them up through `manifest.json`.
2. **Deterministic frames.** `renderFrame(film, t)` is a pure function of time. The same film renders
   identically in preview and export, at any resolution or fps.
3. **No bundler, no runtime dependencies.** Plain ES modules served statically (Netlify, any host).
   The MP4 muxer is our own (`src/export/mp4mux.js`).
4. **Honest audio.** Voices declare whether they are exportable (`kokoro`, `file`, cloud engines) or
   preview-only (`webspeech`). Export only mixes what can actually be captured.

## Layout

| Path | What |
|---|---|
| `src/assets/rigs/` | Skeleton + parts + clips (animations). `humanoid.json` is the first rig. |
| `src/assets/characters/` | Variants of a rig: palette + slot options (hair, outfit, accessory). |
| `src/assets/scenes/` | Backgrounds / scene types (floor line, layered vector props). |
| `src/assets/voices/` | Voice presets (browser voices by default, Kokoro, cloud engines). |
| `src/assets/transitions/` | Transition functions (fade, wipe, iris, push, dip...). |
| `src/engine/` | paint, rig/FK, timeline evaluation, lip-sync, renderer, audio mixer. |
| `src/filmscript/` | Parser + compiler: `.fly` text -> film JSON. |
| `src/export/` | MP4 muxer, WebCodecs exporter, worker. |
| `src/editor/` | The editor UI. |
| `films/` | Example and real films (`.fly`). |
| `tests/` | `node --test` suites (language, engine, muxer vs ffprobe, asset integrity). |

## FilmScript at a glance

A time cursor walks forward; statements either advance it (`wait`, dialogue) or run beside it (`&`).
`par {}` runs children together, `repeat n {}` loops, `let` stores values, `transition` joins scenes.
See `docs/FILMSCRIPT.md` for the reference.

## Export

`Film -> frame loop -> OffscreenCanvas -> VideoFrame -> VideoEncoder (H.264/HEVC) -> mp4mux -> Blob`,
plus an offline-mixed audio track through `AudioEncoder` (AAC, Opus fallback).
Codec level is chosen from resolution x fps; the exporter probes `isConfigSupported` and falls back
(hardware -> software, HEVC -> H.264) and reports what it used.

Spec reality check: H.264 tops out around 8K@~128fps (level 6.2) and HEVC around 8K@120 (6.2),
so 8K@240 is outside both specs. 4K@240 (HEVC 6.1) and 8K@120 are in range. The exporter warns
instead of silently failing.

## Roadmap

- [x] M0 scaffold, assets, language, renderer, MP4 export
- [x] M0.5 3/4-view people + Character Creator, animation polish (blending, holds, blinks, gaze, turns, visemes), 15 TTS engines + Voice Lab
- [ ] M1 streaming/fragmented MP4 for very large outputs (File System Access API)
- [ ] M2 more rigs (animals, props with rigs), side/3-4 view characters, speech-to-viseme from audio
- [ ] M3 camera moves + parallax layers, particle/FX assets
- [ ] M4 AV1 / ProRes-ish intermediates, image-sequence export, node CLI renderer
- [ ] M5 timeline GUI that round-trips with `.fly`
