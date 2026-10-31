// Character Creator: mix slots, colours and builds; insert a `character` line or export a JSON asset.
import { drawRig, poseAt } from '../engine/rig.js';
import { trs } from '../engine/paint.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SKIP_SLOTS = new Set(['eyes', 'brows', 'mouth', 'handF', 'handN']);
const SKIN = ['#f6d3b8', '#f1c3a0', '#e0a982', '#c68a5e', '#a86b45', '#8d5a3b', '#6b4029', '#4f2e1d'];
const HAIR = ['#141012', '#3a2a1e', '#4a2a18', '#8a5a2b', '#b5431f', '#e2b84f', '#cfcfcf', '#7b5cd6', '#2f7d5b'];

export function openCreator(host) {
  const { assets } = host;
  const rig = assets.rigs.humanoid;
  let dlg = document.getElementById('creator');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'creator';
    dlg.className = 'lab';
    document.body.appendChild(dlg);
  }
  const baseId = host.baseId || Object.keys(assets.characters)[0];
  let c = JSON.parse(JSON.stringify(assets.characters[baseId]));
  let base = baseId;
  let id = 'my_' + baseId;
  let clip = 'idle';
  let raf = 0;

  const render = () => {
    dlg.innerHTML = `
      <div class="labHead"><b>🧑‍🎨 Character Creator</b><span class="small">Make a variant of any character. Inserted as one line of FilmScript.</span><span class="spacer"></span>
        <button data-act="random">🎲 Randomize</button><button data-act="close">Close</button></div>
      <div class="creatorBody">
        <div class="creatorPreview"><canvas width="520" height="620"></canvas>
          <div class="row">${['idle', 'walk', 'wave', 'talk_a', 'laugh', 'dance', 'think', 'jump'].map((k) => `<button data-clip="${k}" class="${k === clip ? 'on' : ''}">${k.replace('_a', '')}</button>`).join('')}</div></div>
        <section class="creatorForm">
          <div class="labGrid">
            <label>Start from<select data-act="base">${Object.values(assets.characters).map((x) => `<option value="${x.id}" ${x.id === base ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
            <label>New id<input data-act="id" value="${esc(id)}"></label>
            <label>Build<select data-act="build">${Object.keys(rig.builds).map((b) => `<option ${b === (c.build || 'regular') ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
            <label>Height<input data-act="scale" type="number" step="0.02" min="0.6" max="1.4" value="${c.scale || 1}"></label>
            ${Object.entries(rig.slots).filter(([k]) => !SKIP_SLOTS.has(k)).map(([k, s]) => `<label>${k}<select data-slot="${k}">${s.options.map((o) => `<option ${o === (c.options[k] ?? s.default) ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`).join('')}
          </div>
          <div class="swatches">${rig.palette.filter((k) => k !== 'outline').map((k) => `<label>${k}<input type="color" data-color="${k}" value="${c.palette[k] && c.palette[k].length === 7 ? c.palette[k] : '#888888'}"></label>`).join('')}</div>
          <div class="row small">Skin: ${SKIN.map((s) => `<button class="sw" data-skin="${s}" style="background:${s}"></button>`).join('')} Hair: ${HAIR.map((s) => `<button class="sw" data-hair="${s}" style="background:${s}"></button>`).join('')}</div>
          <pre class="mono small creatorLine">${esc(line())}</pre>
          <div class="row"><button class="primary" data-act="insert">Insert into script</button><button data-act="json">Download as asset JSON</button></div>
        </section>
      </div>`;
    animate();
  };

  function line() {
    const b = assets.characters[base];
    const parts = [];
    for (const [k, v] of Object.entries(c.options)) if (!SKIP_SLOTS.has(k) && v !== (b.options[k] ?? rig.slots[k].default)) parts.push(`${k}=${v}`);
    for (const [k, v] of Object.entries(c.palette)) if (v !== b.palette[k]) parts.push(`color.${k}=${v}`);
    if ((c.build || 'regular') !== (b.build || 'regular')) parts.push(`build=${c.build}`);
    if ((c.scale || 1) !== (b.scale || 1)) parts.push(`scale=${c.scale}`);
    return `character ${id} from ${base}${parts.length ? ' ' + parts.join(' ') : ''}`;
  }
  function animate() {
    cancelAnimationFrame(raf);
    const cv = dlg.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const t0 = performance.now();
    const tick = () => {
      if (!dlg.open) return;
      const t = (performance.now() - t0) / 1000;
      const g = ctx.createLinearGradient(0, 0, 0, cv.height);
      g.addColorStop(0, '#2b3042'); g.addColorStop(1, '#1b1e28');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#343a4c'; ctx.fillRect(0, cv.height - 50, cv.width, 50);
      const k = rig.clips[clip];
      const layers = k.overlay ? [{ clip: rig.clips.idle, t }, { clip: k, t: k.loop ? t : t % (k.duration + 0.6), weight: 1 }] : [{ clip: k, t }];
      const pose = poseAt(layers);
      const blink = (t % 3.2) < 0.12 ? 1 : 0.06;
      pose.lidN = { scale: [1, blink] }; pose.lidF = { scale: [1, blink] };
      const s = 1.15 * (c.scale || 1);
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cv.width / 2, cv.height - 48, 70 * s, 14 * s, 0, 0, 7); ctx.fill(); ctx.restore();
      drawRig(ctx, rig, c, pose, { mouth: clip === 'idle' ? 'smile' : undefined }, trs(cv.width / 2, cv.height - 50, 0, s, s));
      raf = requestAnimationFrame(tick);
    };
    tick();
  }
  const refreshLine = () => { const pre = dlg.querySelector('.creatorLine'); if (pre) pre.textContent = line(); };

  dlg.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.clip) { clip = b.dataset.clip; render(); return; }
    if (b.dataset.skin) { c.palette.skin = b.dataset.skin; render(); return; }
    if (b.dataset.hair) { c.palette.hair = b.dataset.hair; c.palette.brow = b.dataset.hair; render(); return; }
    const act = b.dataset.act;
    if (act === 'close') { cancelAnimationFrame(raf); dlg.close(); }
    else if (act === 'random') {
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      for (const [k, s] of Object.entries(rig.slots)) if (!SKIP_SLOTS.has(k)) c.options[k] = pick(s.options);
      if (c.options.top === 'dress') c.options.bottom = 'bare'; else if (c.options.bottom === 'bare') c.options.bottom = 'pants';
      if (Math.random() < 0.6) c.options.eyewear = 'none';
      if (Math.random() < 0.6) c.options.headwear = 'none';
      if (Math.random() < 0.7) c.options.facial = 'none';
      c.build = pick(Object.keys(rig.builds));
      c.palette.skin = pick(SKIN);
      c.palette.hair = c.palette.brow = pick(HAIR);
      const hue = () => `hsl(${Math.floor(Math.random() * 360)} ${45 + Math.floor(Math.random() * 35)}% ${38 + Math.floor(Math.random() * 25)}%)`;
      const toHex = (css) => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = css; return x.fillStyle; };
      for (const k of ['top', 'top2', 'bottom', 'shoes', 'accent']) c.palette[k] = toHex(hue());
      render();
    } else if (act === 'insert') {
      host.insert(line() + '\n', 'top');
      host.toast && host.toast(`Added "${id}". Cast it with: cast ${id}: ${id} at 50`);
      cancelAnimationFrame(raf);
      dlg.close();
    } else if (act === 'json') {
      const out = { ...c, id, name: id.replace(/(^|_)(\w)/g, (_, a, b2) => (a ? ' ' : '') + b2.toUpperCase()) };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2) + '\n'], { type: 'application/json' }));
      a.download = `${id}.json`;
      a.click();
    }
  };
  dlg.onchange = (e) => {
    const t = e.target;
    if (t.dataset.slot) { c.options[t.dataset.slot] = t.value; if (t.dataset.slot === 'top' && t.value === 'dress') c.options.bottom = 'bare'; render(); }
    else if (t.dataset.color) { c.palette[t.dataset.color] = t.value; refreshLine(); }
    else if (t.dataset.act === 'base') { base = t.value; c = JSON.parse(JSON.stringify(assets.characters[base])); id = 'my_' + base; render(); }
    else if (t.dataset.act === 'id') { id = t.value.replace(/[^A-Za-z0-9_]/g, '_') || 'my_character'; refreshLine(); }
    else if (t.dataset.act === 'build') { c.build = t.value; refreshLine(); }
    else if (t.dataset.act === 'scale') { c.scale = Math.max(0.6, Math.min(1.4, +t.value || 1)); refreshLine(); }
  };
  dlg.oninput = (e) => { if (e.target.dataset.color) { c.palette[e.target.dataset.color] = e.target.value; refreshLine(); } };
  if (!dlg.open) dlg.showModal();
  render();
}
