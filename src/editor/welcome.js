// Welcome screen: start a film from a template (two-step wizard) or reopen one of your films.
import { TEMPLATES, templateById } from './templates.js';
import { compileSource } from '../filmscript/index.js';
import { STAGE_W } from '../engine/timeline.js';
import { icon } from './icons.js';
import { esc, confirmDialog, ask, toast } from './ui.js';
import * as ops from './script-ops.js';

const ago = (ms) => {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ms).toLocaleDateString();
};

export function openWelcome(app) {
  document.getElementById('welcome')?.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'welcome';
  dlg.className = 'welcome';
  document.body.appendChild(dlg);
  const hasProject = () => !!app.projectId && !!app.store.get(app.projectId);
  let step = { id: null };

  function render() {
    const projects = app.store.list();
    dlg.innerHTML = `
      <div class="wInner">
        <header class="wHead">
          <div class="brand big"><span class="logo"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg></span><span>Filmly <b>Studio</b></span></div>
          <span class="spacer"></span>
          ${hasProject() ? `<button class="ghost" data-act="close">${icon('x', 16)} Back to my film</button>` : ''}
        </header>
        <div class="wGrid">
          <section class="wMain">
            ${step.id ? stepTwo() : `
              <h1>Make a cartoon short, one line at a time.</h1>
              <p class="lead">Pick a starting point. You can change everything later — every click writes a line of script you can read, tweak, or hand to Claude.</p>
              <div class="tplGrid">${TEMPLATES.map((t) => `<button class="tpl" data-tpl="${t.id}"><canvas width="480" height="270" data-prev="${t.id}"></canvas><div class="tplMeta"><b>${esc(t.name)}</b><small>${esc(t.blurb)}</small></div></button>`).join('')}</div>
              <div class="wAlt">
                <button class="ghost" data-act="demo">${icon('film', 16)} Open the demo film</button>
                <button class="ghost" data-act="open">${icon('upload', 16)} Open a .fly file…</button>
                <button class="ghost" data-act="how">${icon('info', 16)} How it works</button>
              </div>`}
          </section>
          <aside class="wSide">
            <h3>Your films</h3>
            ${projects.length ? `<ul class="projList">${projects.map((p) => `<li class="${p.id === app.projectId ? 'current' : ''}"><button class="projOpen" data-open="${p.id}">${icon('film', 16)}<span><b>${esc(p.name)}</b><small>${p.id === app.projectId ? 'open now · ' : ''}edited ${ago(p.updated)}</small></span></button>
              <button class="iconBtn ghost sm" data-menu="${p.id}" title="More">${icon('dots', 16)}</button></li>`).join('')}</ul>`
              : `<div class="empty small">${icon('folder', 24)}<p>Films you make are saved here automatically, in this browser.</p></div>`}
          </aside>
        </div>
      </div>`;
    dlg.querySelectorAll('canvas[data-prev]').forEach((cv) => requestAnimationFrame(() => preview(cv, cv.dataset.prev)));
    if (step.id) setTimeout(() => dlg.querySelector('#wTitle')?.focus(), 30);
  }

  function stepTwo() {
    const t = templateById(step.id);
    return `<button class="ghost back" data-act="back">${icon('chevronLeft', 16)} All templates</button>
      <div class="stepTwo">
        <canvas width="640" height="360" data-prev="${t.id}" class="bigPrev"></canvas>
        <form class="form" id="wForm">
          <h2>${esc(t.name)}</h2>
          <p class="small">${esc(t.blurb)}</p>
          <label class="field"><span>Film title</span><input id="wTitle" name="title" value="${esc(step.title || (t.id === 'blank' ? 'My first film' : t.name))}" autocomplete="off"></label>
          <div class="field"><span>Voices</span>
            <label class="radioCard"><input type="radio" name="voices" value="browser" checked><span><b>Browser voices</b><small>Instant and free. Great for drafting — but silent in MP4 exports.</small></span></label>
            <label class="radioCard"><input type="radio" name="voices" value="kokoro"><span><b>Kokoro voices</b><small>Free and natural, made in your browser (one-time ~90 MB download). Included in exports.</small></span></label>
          </div>
          <button class="primary big" type="submit">${icon('sparkles', 16)} Create film</button>
        </form>
      </div>`;
  }

  function preview(cv, id) {
    try {
      const r = compileSource(templateById(id).build({ title: templateById(id).name }), app.assets);
      if (!r.film) return;
      const ctx = cv.getContext('2d', { alpha: false });
      ctx.setTransform(cv.width / STAGE_W, 0, 0, cv.width / STAGE_W, 0, 0);
      const sc = r.film.scenes[0];
      app.renderFrame(ctx, r.film, app.renderAssets(), Math.min(sc.duration - 0.1, id === 'dialogue' ? 4.2 : id === 'spooky' ? 9.5 : id === 'explainer' ? 5.6 : 3.2));
    } catch (e) { console.warn(e); }
  }

  async function create(form) {
    const t = templateById(step.id);
    const title = form.title.value.trim() || t.name;
    let text = t.build({ title });
    if (form.voices.value === 'kokoro') {
      const r = compileSource(text, app.assets);
      text = ops.switchToKokoro(text, app.assets, r.lines || []).src;
    }
    app.newProject(title, text);
    dlg.close();
    dlg.remove();
    toast(`Created “${title}”. Press Space to play.`, { kind: 'ok' });
    let seen = false;
    try { seen = localStorage.getItem('filmly.coach.v1') === 'done'; } catch { /* blocked */ }
    if (!seen) setTimeout(() => app.startCoach(), 400);
  }

  dlg.addEventListener('submit', (e) => { e.preventDefault(); create(e.target); });
  dlg.addEventListener('click', async (e) => {
    const tpl = e.target.closest('[data-tpl]');
    if (tpl) { step = { id: tpl.dataset.tpl }; render(); return; }
    const open = e.target.closest('[data-open]');
    if (open) { app.openProject(open.dataset.open); dlg.close(); dlg.remove(); return; }
    const more = e.target.closest('[data-menu]');
    if (more) {
      const id = more.dataset.menu;
      const p = app.store.get(id);
      app.showMenu(more, [
        { label: 'Open', icon: 'film', run: () => { app.openProject(id); dlg.close(); dlg.remove(); } },
        { label: 'Rename…', icon: 'edit', run: async () => { const r = await ask({ title: 'Rename film', fields: [{ key: 'name', label: 'Name', value: p.name }], ok: 'Rename' }); if (r?.name.trim()) { app.store.rename(id, r.name.trim()); if (id === app.projectId) document.getElementById('projName').textContent = r.name.trim(); render(); } } },
        { label: 'Duplicate', icon: 'copy', run: () => { app.store.duplicate(id); if (app.projectId) app.store.setCurrent(app.projectId); render(); } },
        '-',
        { label: 'Delete…', icon: 'trash', run: async () => {
          if (!(await confirmDialog('Delete this film?', `“${esc(p.name)}” will be removed from this browser. This can't be undone (save a .fly copy first if you want to keep it).`, { ok: 'Delete', danger: true }))) return;
          app.store.remove(id);
          if (id === app.projectId) app.projectId = null;
          render();
        } },
      ], { align: 'right' });
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') { dlg.close(); dlg.remove(); }
    else if (act === 'back') { step = { id: null }; render(); }
    else if (act === 'demo') { const f = app.assets.manifest.films[0]; if (f) { await app.openExample(f); dlg.close(); dlg.remove(); } }
    else if (act === 'open') { app.openFile(); const input = document.getElementById('fileInput'); input.addEventListener('change', () => { if (dlg.isConnected) { dlg.close(); dlg.remove(); } }, { once: true }); }
    else if (act === 'how') app.help('how');
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (step.id) { step = { id: null }; render(); } else if (hasProject()) { dlg.close(); dlg.remove(); } });
  render();
  dlg.showModal();
}
