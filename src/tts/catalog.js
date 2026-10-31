// Text-to-speech provider catalog: pure data (no network, no DOM) so the compiler, editor and tests share it.
//
// FilmScript voice specs:   provider:voice            e.g.  openai:coral   elevenlabs:21m00Tcm4TlvDq8ikWAM
//   named voices:           voice narrator = azure:en-US-AndrewNeural style=cheerful speed=1.1
//
// fields  = account settings stored in the browser (keys, regions, URLs). secret fields are never written to files.
// params  = per-voice options usable in FilmScript (voice x = openai:nova speed=1.1 style="whisper").
// voices  = starter list; providers with listVoices=true can fetch the full catalogue from your account.

const KEY = (label = 'API key', placeholder = '') => ({ key: 'apiKey', label, secret: true, placeholder });

export const PROVIDERS = {
  kokoro: {
    label: 'Kokoro (free, runs in your browser)', kind: 'local', exportable: true, free: true,
    blurb: 'Open-weight 82M model running fully in the browser via WebAssembly. No key; first use downloads ~90 MB once.',
    site: 'https://huggingface.co/hexgrad/Kokoro-82M',
    fields: [{ key: 'dtype', label: 'Precision', default: 'q8', options: ['q8', 'fp16', 'fp32'] }],
    params: [{ key: 'speed', label: 'Speed', default: 1 }],
    voices: ['af_heart', 'af_bella', 'af_nicole', 'af_aoede', 'af_kore', 'af_sarah', 'af_nova', 'af_sky', 'af_alloy', 'af_jessica', 'af_river',
      'am_michael', 'am_fenrir', 'am_puck', 'am_echo', 'am_eric', 'am_liam', 'am_onyx', 'am_adam', 'am_santa',
      'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily', 'bm_george', 'bm_fable', 'bm_lewis', 'bm_daniel'].map((id) => ({
      id, name: `${id.slice(3)} (${{ af: 'US female', am: 'US male', bf: 'UK female', bm: 'UK male' }[id.slice(0, 2)]})`,
    })),
  },
  webspeech: {
    label: 'Browser voices (default)', kind: 'browser', exportable: false, free: true,
    blurb: "Your computer's built-in voices — free, instant, no setup. They play in the preview; browsers don't let pages record them, so MP4 exports are silent for these lines (switch to Kokoro or a cloud voice before exporting with sound).",
    fields: [],
    params: [
      { key: 'gender', label: 'Prefer', default: 'any', options: ['any', 'female', 'male'] },
      { key: 'lang', label: 'Language', default: 'en-US' },
      { key: 'rate', label: 'Rate', default: 1 },
      { key: 'pitch', label: 'Pitch', default: 1 },
    ],
    voices: [{ id: 'auto', name: 'Automatic (best match for language + gender)' }],
    listVoices: true,
  },
  openai: {
    label: 'OpenAI', kind: 'cloud', exportable: true, site: 'https://platform.openai.com/api-keys',
    blurb: 'gpt-4o-mini-tts takes free-form "style" instructions (e.g. "whisper nervously").',
    fields: [KEY('API key', 'sk-...')],
    params: [
      { key: 'model', label: 'Model', default: 'gpt-4o-mini-tts', options: ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1'] },
      { key: 'style', label: 'Style instructions', default: '' },
      { key: 'speed', label: 'Speed', default: 1 },
    ],
    voices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'].map((id) => ({ id, name: id })),
  },
  elevenlabs: {
    label: 'ElevenLabs', kind: 'cloud', exportable: true, site: 'https://elevenlabs.io/app/settings/api-keys', listVoices: true,
    blurb: 'Very expressive voices, plus any voices you cloned or added to your library.',
    fields: [KEY('API key', 'xi-...')],
    params: [
      { key: 'model', label: 'Model', default: 'eleven_multilingual_v2', options: ['eleven_multilingual_v2', 'eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'] },
      { key: 'stability', label: 'Stability', default: 0.5 },
      { key: 'similarity', label: 'Similarity', default: 0.75 },
      { key: 'speed', label: 'Speed', default: 1 },
    ],
    voices: [
      ['21m00Tcm4TlvDq8ikWAM', 'Rachel'], ['EXAVITQu4vr4xnSDxMaL', 'Sarah'], ['AZnzlk1XvdvUeBnXmlld', 'Domi'], ['MF3mGyEYCl7XYWbV9V6O', 'Elli'],
      ['pNInz6obpgDQGcFmaJgB', 'Adam'], ['ErXwobaYiN019PkySvjV', 'Antoni'], ['TxGEqnHWrfWFTfGW9XjX', 'Josh'], ['VR6AewLTigWG4xSOukaG', 'Arnold'], ['yoZ06aMxZJJ28mfd3POQ', 'Sam'],
    ].map(([id, name]) => ({ id, name })),
  },
  google: {
    label: 'Google Cloud Text-to-Speech', kind: 'cloud', exportable: true, site: 'https://console.cloud.google.com/apis/library/texttospeech.googleapis.com', listVoices: true,
    blurb: 'Hundreds of voices in 50+ languages (Neural2, Studio, Chirp HD). Use an API key restricted to Text-to-Speech.',
    fields: [KEY('API key', 'AIza...')],
    params: [{ key: 'speed', label: 'Speaking rate', default: 1 }, { key: 'pitch', label: 'Pitch (semitones)', default: 0 }],
    voices: ['en-US-Neural2-C', 'en-US-Neural2-D', 'en-US-Neural2-F', 'en-US-Neural2-J', 'en-US-Studio-O', 'en-US-Studio-Q', 'en-GB-Neural2-A', 'en-GB-Neural2-B', 'en-AU-Neural2-A'].map((id) => ({ id, name: id })),
  },
  gemini: {
    label: 'Google Gemini TTS', kind: 'cloud', exportable: true, site: 'https://aistudio.google.com/apikey',
    blurb: 'Gemini speech generation with natural-language direction ("say cheerfully", "spooky whisper").',
    fields: [KEY('Gemini API key', 'AIza...')],
    params: [
      { key: 'model', label: 'Model', default: 'gemini-2.5-flash-preview-tts', options: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'] },
      { key: 'style', label: 'Direction', default: '' },
    ],
    voices: ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
      'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'].map((id) => ({ id, name: id })),
  },
  azure: {
    label: 'Microsoft Azure AI Speech', kind: 'cloud', exportable: true, site: 'https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices', listVoices: true,
    blurb: '400+ neural voices; many support speaking styles (cheerful, sad, whispering, shouting...).',
    fields: [KEY('Speech key'), { key: 'region', label: 'Region', placeholder: 'eastus', default: 'eastus' }],
    params: [{ key: 'style', label: 'Style', default: '' }, { key: 'speed', label: 'Rate', default: 1 }, { key: 'pitch', label: 'Pitch (%)', default: 0 }],
    voices: ['en-US-AndrewNeural', 'en-US-AvaNeural', 'en-US-JennyNeural', 'en-US-GuyNeural', 'en-US-AriaNeural', 'en-US-DavisNeural', 'en-US-EmmaNeural', 'en-US-BrianNeural', 'en-GB-SoniaNeural', 'en-GB-RyanNeural'].map((id) => ({ id, name: id })),
  },
  polly: {
    label: 'Amazon Polly', kind: 'cloud', exportable: true, site: 'https://console.aws.amazon.com/iam/home#/users',
    blurb: 'AWS neural/generative voices. Use an IAM user that only has polly:SynthesizeSpeech.',
    fields: [{ key: 'accessKeyId', label: 'Access key ID', secret: true }, { key: 'secretAccessKey', label: 'Secret access key', secret: true }, { key: 'region', label: 'Region', default: 'us-east-1' }],
    params: [{ key: 'pollyEngine', label: 'Engine', default: 'neural', options: ['neural', 'generative', 'long-form', 'standard'] }],
    voices: ['Joanna', 'Matthew', 'Ruth', 'Stephen', 'Danielle', 'Gregory', 'Ivy', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Justin', 'Kevin', 'Amy', 'Brian', 'Emma', 'Arthur', 'Olivia'].map((id) => ({ id, name: id })),
  },
  deepgram: {
    label: 'Deepgram Aura', kind: 'cloud', exportable: true, site: 'https://console.deepgram.com/',
    blurb: 'Fast, natural conversational voices.',
    fields: [KEY()],
    params: [],
    voices: ['thalia', 'andromeda', 'helena', 'apollo', 'arcas', 'aries', 'asteria', 'athena', 'orion', 'zeus', 'hera', 'luna'].map((n) => ({ id: `aura-2-${n}-en`, name: n })),
  },
  cartesia: {
    label: 'Cartesia Sonic', kind: 'cloud', exportable: true, site: 'https://play.cartesia.ai/keys', listVoices: true,
    blurb: 'Low-latency, emotive voices. Load your voice list to pick one.',
    fields: [KEY(), { key: 'version', label: 'API version', default: '2025-04-16' }],
    params: [{ key: 'model', label: 'Model', default: 'sonic-2', options: ['sonic-2', 'sonic-turbo'] }, { key: 'language', label: 'Language', default: 'en' }],
    voices: [],
  },
  hume: {
    label: 'Hume Octave', kind: 'cloud', exportable: true, site: 'https://platform.hume.ai/settings/keys',
    blurb: 'Acting-aware TTS: describe the delivery ("excited, out of breath") and it performs it.',
    fields: [KEY()],
    params: [{ key: 'style', label: 'Acting direction', default: '' }],
    voices: [{ id: 'Ava Song', name: 'Ava Song' }, { id: 'Colton Rivers', name: 'Colton Rivers' }, { id: 'Vince Douglas', name: 'Vince Douglas' }, { id: 'Sitcom Girl', name: 'Sitcom Girl' }],
  },
  fish: {
    label: 'Fish Audio', kind: 'cloud', exportable: true, site: 'https://fish.audio/app/api-keys/',
    blurb: 'Huge community voice library; paste a voice model id (reference_id) from fish.audio.',
    fields: [KEY()],
    params: [{ key: 'model', label: 'Model', default: 's1' }],
    voices: [],
  },
  lmnt: {
    label: 'LMNT', kind: 'cloud', exportable: true, site: 'https://app.lmnt.com/account', listVoices: true,
    blurb: 'Lifelike voices with fast synthesis.',
    fields: [KEY()],
    params: [{ key: 'speed', label: 'Speed', default: 1 }],
    voices: ['lily', 'morgan', 'ava', 'daniel', 'brandon', 'natalie'].map((id) => ({ id, name: id })),
  },
  custom: {
    label: 'OpenAI-compatible server', kind: 'cloud', exportable: true,
    blurb: 'Any /v1/audio/speech endpoint: Kokoro-FastAPI or LocalAI on your PC (http://localhost:8880/v1), Groq, and others.',
    fields: [{ key: 'baseUrl', label: 'Base URL', default: 'http://localhost:8880/v1' }, { key: 'apiKey', label: 'API key (optional)', secret: true }],
    params: [{ key: 'model', label: 'Model', default: 'kokoro' }, { key: 'speed', label: 'Speed', default: 1 }],
    voices: [{ id: 'af_heart', name: 'af_heart (Kokoro)' }, { id: 'am_michael', name: 'am_michael (Kokoro)' }],
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

/** Parse "provider:voice" into {engine, voice}. Returns null if it isn't a provider spec. */
export function parseVoiceSpec(spec) {
  if (typeof spec !== 'string') return null;
  const i = spec.indexOf(':');
  const engine = i < 0 ? spec : spec.slice(0, i);
  if (!PROVIDERS[engine]) return null;
  return { engine, voice: i < 0 ? (PROVIDERS[engine].voices[0]?.id || 'default') : spec.slice(i + 1) };
}

/** Stable cache key for one spoken line. Only includes what changes the audio. */
export function lineKey(voice, text) {
  const meta = PROVIDERS[voice.engine];
  const p = {};
  for (const { key } of meta?.params || []) if (voice[key] !== undefined && voice[key] !== '') p[key] = voice[key];
  return `${voice.engine}|${voice.voice || ''}|${JSON.stringify(p)}|${text}`;
}

/** Does this voice need generated audio (as opposed to synth/browser)? */
export const needsAudio = (voice) => !!voice && !!PROVIDERS[voice.engine] && voice.engine !== 'webspeech';
export const DEFAULT_VOICE = 'browser_auto';
