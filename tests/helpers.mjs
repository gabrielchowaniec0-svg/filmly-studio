import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const readJSON = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
export function loadAssetsFs() {
  const m = readJSON('src/assets/manifest.json');
  const A = { rigs: {}, characters: {}, scenes: {}, voices: {}, manifest: m };
  for (const p of m.rigs) { const j = readJSON(p); A.rigs[j.id] = j; }
  for (const p of m.characters) { const j = readJSON(p); A.characters[j.id] = j; }
  for (const p of m.scenes) { const j = readJSON(p); A.scenes[j.id] = j; }
  for (const v of readJSON(m.voices).voices) A.voices[v.id] = v;
  return A;
}
export const readText = (p) => readFileSync(join(ROOT, p), 'utf8');
