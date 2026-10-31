// Generates src/assets/props/*.json from the category modules in this folder.
//   node scripts/props/index.mjs        (then: node scripts/build-manifest.mjs)
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import furniture from './furniture.mjs';
import kitchen from './kitchen.mjs';
import everyday from './everyday.mjs';
import outdoor from './outdoor.mjs';
import spooky from './spooky.mjs';
import fun from './fun.mjs';

// Cartoon proportions: small hand props are drawn a bit larger than life so they read on screen.
const SCALE = {
  mug: 1.35, phone: 1.45, key: 1.5, letter: 1.3, book: 1.3, teapot: 1.2, kettle: 1.15, plate: 1.25, pizza_slice: 1.3,
  ice_cream: 1.3, microphone: 1.35, candle: 1.3, magnifier: 1.25, map: 1.3, laptop: 1.15, flashlight: 1.15, trophy: 1.15,
  popcorn: 1.2, frying_pan: 1.2, newspaper: 1.25, lantern: 1.15, ball: 1.2, pizza: 1.15, cake: 1.1, gift_box: 1.1,
};
export const ALL_PROPS = [...furniture, ...kitchen, ...everyday, ...outdoor, ...spooky, ...fun].map((p) => (SCALE[p.id] ? { ...p, scale: SCALE[p.id] } : p));

const round = (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../src/assets/props');
  mkdirSync(dir, { recursive: true });
  const ids = new Set();
  for (const p of ALL_PROPS) {
    if (ids.has(p.id)) throw new Error(`duplicate prop id ${p.id}`);
    ids.add(p.id);
    writeFileSync(join(dir, p.id + '.json'), JSON.stringify(p, round) + '\n');
  }
  for (const f of readdirSync(dir)) if (f.endsWith('.json') && !ids.has(f.slice(0, -5))) unlinkSync(join(dir, f));
  console.log(`props: wrote ${ALL_PROPS.length} props to src/assets/props/`);
}
