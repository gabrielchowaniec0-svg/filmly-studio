# FilmScript reference (`.fly`)

FilmScript is a small line-based language. A **time cursor** moves forward through each scene:
dialogue, walking, gestures, captions and camera moves advance it; add `&` to start something
*without* advancing (so it runs alongside the next line).

```
film "Title" 1920x1080 @30        # required, first. Only 16:9 for now. fps 1-480.
fade in 1s                         # optional: from black at the start
fade out 1s                        # optional: to black at the end

let hero = mira                    # variables: use as $hero
scene street bg=street_day {       # bg= any background id. tail=1s adds padding at the end.
  cast mira: mira at 25            # name: character-id at X%   (X,Y => Y is depth 0-100)
  cast bo: bo at 80 facing=left hidden   # hidden = not on screen until "enters"/"shows"

  mira: "Hello there!"             # dialogue (also: mira says "…")  options: voice=id for=2s mood=happy still audio="x.mp3" gap=0.2
  mira walks to 50 over 2s         # walks | runs | moves (glide). target: number, "60,10", or another actor name
  bo enters from right over 2s &   # & = don't wait; the next line starts at the same time
  mira waves                       # shortcuts: waves jumps shrugs nods cheers gestures
  mira plays shake_head            # plays <clip> [for 2s] [loop] [speed=1.5]
  mira plays idle                  # base clips (idle, walk, run) stay until changed
  mira feels happy                 # neutral happy joy sad angry surprised
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
`engine: blip` voices are synthesized and always export. `elevenlabs` voices need an API key
(Assets → Voices) and are cached once generated. `webspeech` is preview-only. `audio="file.mp3"`
on a line uses a recorded clip and sizes the line to its length.

## Errors
The editor underlines the problem line with a suggestion ("Did you mean …?"). Unknown actors,
characters, backgrounds, voices, clips and moods all list the valid choices.
