// Regenerates src/assets/manifest.json (and is the Netlify build command).
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const list = (dir, ext) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => `${dir}/${f}`)
    : [];

export function buildManifest() {
  return {
    rigs: list('src/assets/rigs', '.json'),
    characters: list('src/assets/characters', '.json'),
    scenes: list('src/assets/scenes', '.json'),
    props: list('src/assets/props', '.json'),
    voices: 'src/assets/voices/voices.json',
    sounds: existsSync(join(root, 'src/assets/sounds/sounds.json')) ? 'src/assets/sounds/sounds.json' : null,
    films: list('films', '.fly'),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const m = buildManifest();
  writeFileSync(join(root, 'src/assets/manifest.json'), JSON.stringify(m, null, 2) + '\n');
  console.log(`manifest: ${m.rigs.length} rigs, ${m.characters.length} characters, ${m.scenes.length} scenes, ${m.props.length} props, ${m.films.length} films`);
}
