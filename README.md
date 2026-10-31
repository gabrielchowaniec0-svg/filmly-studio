# Filmly Studio

Digital art assets, a browser editor and a tiny language (**FilmScript**) for making 2D short films —
built so a person and Claude can work on the same files. Everything renders from vectors, so a film
exports to MP4 at any resolution (720p … 8K) and frame rate the browser's encoder allows.

- **Live editor:** https://filmly-studio.netlify.app (Netlify, auto-deploys from `main`)
- **Language reference:** [docs/FILMSCRIPT.md](docs/FILMSCRIPT.md) · **Plan:** [docs/PLAN.md](docs/PLAN.md)

## Run it

```
node scripts/serve.mjs      # http://localhost:5173  (no npm install needed)
node --test tests/*.test.mjs          # language, engine, asset and MP4 muxer tests (needs ffmpeg for the muxer test)
```

## What's in the box

| | |
|---|---|
| Rig | `humanoid` — 12 bones, slotted faces/hair/outfits/accessories, 10 animation clips |
| Characters | mira, bo, juno, otto (palette + slot variants of the humanoid rig) |
| Backgrounds | studio, living_room, street_day, night_forest |
| Voices | 4 synthesized blip voices (always exportable), ElevenLabs + browser TTS slots |
| Transitions | cut, fade, dip, wipes, pushes, iris, zoom, blinds |
| Export | WebCodecs → own MP4 muxer (H.264 / HEVC, AAC / Opus), runs in a Web Worker |

## Adding assets

Drop a JSON file in `src/assets/{rigs,characters,scenes}/` (or edit `voices.json`), run
`node scripts/build-manifest.mjs` (Netlify does this on deploy) and it appears in the editor.
`tests/assets.test.mjs` checks every character, palette key, slot option and clip reference.
