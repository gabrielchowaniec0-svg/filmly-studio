# FilmScript reference (`.fly`)

FilmScript is a small line-based language. A **time cursor** moves forward through each scene:
dialogue, walking, gestures, captions and camera moves advance it; add `&` to start something
*without* advancing (so it runs alongside the next line).

```
film "Title" 1920x1080 @30        # required, first. Only 16:9 for now. fps 1-480.
fade in 1s                         # optional: from black at the start
fade out 1s                        # optional: to black at the end

let hero = mira                    # variables: use as $hero
voice narrator = openai:onyx style="warm, slow storyteller" speed=0.95   # named voice (any provider, see Voices)
character pia from priya hair=bob top=hoodie color.top=#ff8800 build=round voice=kokoro:af_bella   # character variant
scene street bg=street_day {       # bg= any background id. tail=1s adds padding at the end.
  cast mira: mira at 25            # name: character-id at X%   (X,Y => Y is depth 0-100)
  cast bo: bo at 80 facing=left hidden   # hidden = not on screen until "enters"/"shows"

  mira: "Hello there!"             # dialogue (also: mira says "…")
                                   #   options: voice=openai:coral | voice=narrator  for=2s  mood=happy  still  gesture=talk_b
                                   #            energy=0.5 (smaller talk gestures)  audio="x.mp3"  gap=0.2
  mira walks to 50 over 2s         # walks | runs | moves (glide). target: number, "60,10", or another actor name
  mira walks to 70 style=sneak     #   style= sneak stroll march tiptoe strut sad_walk limp jog sprint (sets the pace)
  bo enters from right over 2s &   # & = don't wait; the next line starts at the same time
  mira waves                       # shortcuts: waves jumps shrugs nods cheers points thinks claps laughs bows
                                   #   dances facepalms gasps sulks salutes yawns cries beckons stretches stomps
                                   #   cowers celebrates shushes peeks pleads prays
  mira plays cross_arms for 4s     # plays <clip> [for 2s] [speed=1.5]; "hold" clips (point, think, cross_arms,
                                   #   facepalm, bow, shrug, sad_slump, surprised, thumbs_up, hands_on_hips, salute,
                                   #   plead, pray, shush, peek, phone_call, scratch_head, cower, cry, beckon, yawn,
                                   #   stretch) hold their pose for the duration; also shake_fist double_take
  mira looks at bo                 # looks at <actor> | left | right | up | down | camera | around | away
                                   #   (by default everyone watches whoever is talking)
  mira plays idle                  # base clips stay until changed: idle idle_bored idle_nervous idle_confident
                                   #   idle_tired (and any walk style)
  mira feels happy                 # neutral happy joy sad angry surprised worried sleepy
  mira faces left                  # left | right | an actor name
  bo exits to right
  wait 0.5s                        # also: at 3s (jump to absolute scene time), hold 1s (pad scene end)
  caption "Later…" 2s              # pos=top|center|bottom   title "BIG TEXT" 3s
  camera zoom=1.4 x=30 y=60 over 1.5s     # zoom >= 1, x/y are % of the stage; ease=linear|in|out|inout|smooth|back
  music "audio/theme.mp3" vol=0.4 fade=1s
  sfx "audio/door.wav"
  par {                            # every line inside starts at the same moment; scene waits for the longest
    mira walks to 70 over 3s
    bo walks to 30 over 3s
  }
  repeat 3 {                       # repeat a block
    mira nods
    wait 0.3s
  }
}

transition iris 1s                 # between scenes. fade dip_black dip_white wipe_left wipe_right wipe_up wipe_down push_left push_right iris zoom blinds cut
scene next bg=studio { … }
```

## Time
`2s`, `500ms` and bare `1.5` all mean seconds. `25%` and `25` are the same for positions.

## Voices
Write `provider:voice` anywhere a voice is expected, or define a named voice with options.

| provider | example | notes |
|---|---|---|
| `kokoro` | `kokoro:af_heart`, `kokoro:bm_george` | free, runs in the browser, ~90 MB model downloaded once |
| `webspeech` | `voice=browser_bright` (presets) or `webspeech:auto` + `gender=female` `lang=en-GB` `pitch` `rate` | **default**. Your computer's voices, free — preview only, silent in MP4 exports |
| `openai` | `openai:coral` + `style="whisper"` `model=tts-1-hd` `speed=1.1` | |
| `elevenlabs` | `elevenlabs:21m00Tcm4TlvDq8ikWAM` + `model=eleven_v3` `stability=0.4` | "Load my voices" lists your library |
| `google` | `google:en-US-Neural2-F` + `speed` `pitch` | Cloud TTS API key |
| `gemini` | `gemini:Kore` + `style="Say it like a sports announcer"` | AI Studio key |
| `azure` | `azure:en-US-JennyNeural` + `style=cheerful` | key + region |
| `polly` | `polly:Joanna` + `pollyEngine=generative` | AWS access key (SigV4 signed in the browser) |
| `deepgram` | `deepgram:aura-2-thalia-en` | |
| `cartesia` | `cartesia:<voice-uuid>` | "Load my voices" |
| `hume` | `hume:"Ava Song"` + `style="excited, out of breath"` | |
| `fish` | `fish:<reference_id>` | any fish.audio voice model |
| `lmnt` | `lmnt:lily` | |
| `custom` | `custom:af_heart` + `model=kokoro` | any OpenAI-compatible `/v1/audio/speech` server (Kokoro-FastAPI, LocalAI, Groq…) |

Keys are entered in **Voice Lab** and stay in your browser. Generated lines are cached in IndexedDB;
the line is timed to the real audio and the mouth follows its loudness. If a provider blocks browser
requests, tick "Route through site proxy" (uses the Netlify function in `netlify/functions/tts-proxy.mjs`).
`audio="file.mp3"` on a line uses a recorded clip instead.

## Characters
`character <new-id> from <existing> key=value…` — keys: `hair top bottom facial eyewear headwear lashes`
(any option from the rig), `build=regular|slim|broad|round|tall|kid`, `scale=1.1`, `voice=…`,
`color.<skin|hair|brow|eye|blush|top|top2|bottom|shoes|sole|accent|frame>=#rrggbb`.
The editor's **Character Creator** writes this line for you.

## Errors
The editor underlines the problem line with a suggestion ("Did you mean …?"). Unknown actors,
characters, backgrounds, voices, clips and moods all list the valid choices.
