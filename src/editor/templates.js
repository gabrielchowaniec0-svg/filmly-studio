// Starter films for the New Film wizard. Each build() returns a complete .fly script.
import { q } from './script-ops.js';

const head = (title, extra = '') => `film ${q(title || 'Untitled')} 1920x1080 @30\nfade in 0.6s\n${extra}`;

export const TEMPLATES = [
  {
    id: 'blank', name: 'Blank film', blurb: 'One scene, one character. Build it up from the library.', bg: 'studio', cast: ['mira'],
    build: ({ title }) => `${head(title)}
scene one bg=studio {
  cast mira: mira at 50

  mira: "Hello! Click me on the stage to give me something to do."
}
`,
  },
  {
    id: 'dialogue', name: 'Two-person chat', blurb: 'Two friends meet and talk. Good for learning dialogue, looks and moods.', bg: 'living_room', cast: ['mira', 'bo'],
    build: ({ title }) => `${head(title)}
scene chat bg=living_room {
  cast mira: mira at 28
  cast bo: bo at 76 hidden

  mira feels happy
  bo enters from right over 1.8s &
  wait 1s
  mira waves
  mira: "Bo! You made it."
  bo: "Of course. I wouldn't miss it."
  mira: "So... did you bring the snacks?" mood=surprised
  bo shrugs
  bo: "I brought myself. That counts, right?"
  mira laughs
  mira: "It counts." mood=joy
}

fade out 0.8s
`,
  },
  {
    id: 'explainer', name: 'Explainer with narrator', blurb: 'A voice-over narrator, a presenter, captions and a title card.', bg: 'studio', cast: ['priya'],
    build: ({ title }) => `${head(title)}
scene intro bg=studio {
  cast host: priya at 30
  cast narrator: sam at 50 hidden      # a hidden actor works as an off-screen narrator

  title ${q(title || 'How it works')} 2.2s
  narrator: "Today we'll explain one big idea in three small steps."
  host waves
  host: "Step one: start with a question."
  caption "1. Ask a question" 2s pos=top &
  host points
  host: "Step two: try something simple."
  caption "2. Try it" 2s pos=top &
  host thinks for 1.5s
  host: "Step three: look at what happened, and try again."
  caption "3. Learn and repeat" 2.2s pos=top
  camera zoom=1.35 x=32 y=55 over 1.2s
  host: "That's it. You're doing science!" mood=joy
  camera zoom=1 x=50 y=50 over 0.8s
}

fade out 0.8s
`,
  },
  {
    id: 'spooky', name: 'Spooky mystery', blurb: 'A night forest, a nervous detective and a surprise visitor.', bg: 'night_forest', cast: ['juno', 'otto'],
    build: ({ title }) => `${head(title)}
scene woods bg=night_forest {
  cast juno: juno at 20 mood=worried
  cast otto: otto at 85 facing=left hidden

  caption "Midnight. Somewhere in the woods..." 2.5s pos=top
  juno looks around
  juno: "Hello? Is somebody there?"
  juno walks to 38 over 2s
  camera zoom=1.3 x=35 y=55 over 1.5s &
  wait 0.6s
  otto enters from right over 2.2s &
  juno feels surprised
  juno gasps
  otto: "Relax. It's only me, the night watchman."
  juno: "You nearly scared the socks off me!" mood=angry
  otto laughs
  camera zoom=1 x=50 y=50 over 1s
  otto: "Come on. The real mystery is this way."
  par {
    juno walks to 60 over 2s
    otto exits to right over 2.5s
  }
}

fade out 1s
`,
  },
  {
    id: 'kids', name: 'Kids story', blurb: 'A cheerful story with big gestures, a dance and a happy ending.', bg: 'street_day', cast: ['kai', 'nora'],
    build: ({ title }) => `${head(title)}
scene park bg=street_day {
  cast kai: kai at 25
  cast nora: nora at 75

  title ${q(title || 'The Best Day')} 2s
  kai feels joy
  kai jumps
  kai: "Today is the best day ever!"
  nora: "Why? What happened?"
  kai: "I learned to whistle! Well... almost."
  nora laughs
  nora feels happy
  nora: "Show me!"
  kai thinks for 1.2s
  kai: "Okay, here goes!"
  par {
    kai dances
    nora claps
  }
  caption "And they danced until the sun went down." 3s
}

fade out 1s
`,
  },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
