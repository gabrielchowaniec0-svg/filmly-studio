// Stage: the preview canvas, transport controls, selecting and dragging actors, and drops from the Library.
import { STAGE_W, STAGE_H } from '../engine/timeline.js';
import { actorBoxes, hitActor } from './stage-hit.js';
import { formatTime, setCastAt } from './script-ops.js';
import { icon } from './icons.js';
import { $, esc, prefs } from './ui.js';
import { sceneIndexAt } from './timeline-data.js';

export function createStage(app) {
  const canvas = $('#preview'), screen = $('#screen'), wrap = $('#stageWrap'), overlay = $('#overlay');
  const scrub = $('#scrub');
  let info = null; // latest actor boxes
  let hover = null;
  let drag = null;

  // ---- transport ----
  $('#btnStart').innerHTML = icon('toStart', 17);
  $('#btnPrev').innerHTML = icon('stepBack', 17);
  $('#btnNext').innerHTML = icon('stepFwd', 17);
  $('#btnLoop').innerHTML = icon('loop', 17);
  $('#btnFull').innerHTML = icon('fullscreen', 17);
  const playBtn = $('#btnPlay');
  const setPlayIcon = () => { playBtn.innerHTML = app.playing ? icon('pause', 20) : icon('play', 20); playBtn.classList.toggle('on', app.playing); playBtn.setAttribute('aria-label', app.playing ? 'Pause' : 'Play'); };
  setPlayIcon();
  app.on('play', setPlayIcon);
  playBtn.addEventListener('click', () => app.toggle());
  $('#btnStart').addEventListener('click', () => app.seek(0));
  $('#btnPrev').addEventListener('click', () => app.step(-1));
  $('#btnNext').addEventListener('click', () => app.step(1));
  const loopBtn = $('#btnLoop');
  loopBtn.classList.toggle('on', app.loop);
  loopBtn.addEventListener('click', () => { app.loop = !app.loop; prefs.set('loop', app.loop); loopBtn.classList.toggle('on', app.loop); app.toast(app.loop ? 'Loop on' : 'Loop off', { ms: 1200 }); });
  $('#speed').addEventListener('change', (e) => app.setRate(+e.target.value));
  app.on('rate', (r) => { const s = $('#speed'); if ([...s.options].some((o) => +o.value === r)) s.value = String(r); });
  $('#btnFull').addEventListener('click', () => api.fullscreen());
  scrub.addEventListener('input', () => app.seek(+scrub.value / 1000));

  // ---- sizing ----
  const fit = () => {
    const cs = getComputedStyle(wrap);
    const aw = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const w = Math.max(160, Math.floor(Math.min(aw, (ah * 16) / 9)));
    screen.style.width = `${w}px`;
    screen.style.height = `${Math.round((w * 9) / 16)}px`;
  };
  new ResizeObserver(() => { fit(); app.draw(); }).observe(wrap);
  fit();

  const toStage = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * STAGE_W, ((e.clientY - r.top) / r.height) * STAGE_H];
  };
  const k = () => canvas.getBoundingClientRect().width / STAGE_W;

  function boxEl(cls, b, label) {
    const s = k();
    return `<div class="${cls}" style="left:${b.x * s}px;top:${b.y * s}px;width:${b.w * s}px;height:${b.h * s}px">${label ? `<span class="tag">${label}</span>` : ''}${cls.includes('sel') ? '<i class="handle l"></i><i class="handle r"></i>' : ''}</div>`;
  }
  function drawOverlay() {
    let html = '';
    if (!info) { overlay.innerHTML = ''; return; }
    const sel = app.sel && info.boxes.find((b) => b.name === app.sel.actor);
    if (hover && (!sel || hover.name !== sel.name) && !drag) html += boxEl('hoverBox', hover, esc(hover.name));
    if (sel) {
      const b = drag?.moved ? { ...sel, x: sel.x + drag.dx, footX: sel.footX + drag.dx } : sel;
      html += boxEl('selBox' + (drag?.moved ? ' dragging' : ''), b, esc(sel.name) + (drag?.moved ? ` → ${Math.round(newPct(sel, drag.dx))}%` : ''));
    }
    if (app.film && app.result && !app.result.film && app.errors.some((e) => e.severity === 'error')) {
      const first = app.errors.find((e) => e.severity === 'error');
      html += `<button class="staleNote" data-line="${first.line}">${icon('alert', 14)} Showing the last working version · fix line ${first.line}</button>`;
    }
    overlay.innerHTML = html;
  }
  overlay.addEventListener('click', (e) => { const b = e.target.closest('.staleNote'); if (b) app.gotoLine(+b.dataset.line); });

  const newPct = (b, dx) => {
    const [sx] = info.cam.toScene(b.footX + dx, b.footY);
    return Math.max(-5, Math.min(105, (sx / STAGE_W) * 100));
  };

  // ---- select + drag ----
  screen.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !info || e.target.closest('.staleNote')) return;
    const [px, py] = toStage(e);
    const hit = hitActor(info, px, py);
    if (!hit) { app.select(null); return; }
    if (app.playing) app.pause();
    app.select(hit.name);
    drag = { name: hit.name, x0: px, dx: 0, moved: false, id: e.pointerId };
    screen.setPointerCapture(e.pointerId);
  });
  screen.addEventListener('pointermove', (e) => {
    if (!info) return;
    const [px, py] = toStage(e);
    if (drag) {
      drag.dx = px - drag.x0;
      if (Math.abs(drag.dx) > 6) drag.moved = true;
      drawOverlay();
      return;
    }
    const h = hitActor(info, px, py);
    if ((h && h.name) !== (hover && hover.name)) { hover = h; drawOverlay(); }
    screen.style.cursor = h ? 'grab' : 'default';
  });
  screen.addEventListener('pointerleave', () => { if (!drag && hover) { hover = null; drawOverlay(); } });
  screen.addEventListener('pointerup', () => {
    const d = drag;
    drag = null;
    if (!d || !d.moved || !info) { drawOverlay(); return; }
    const b = info.boxes.find((x) => x.name === d.name);
    if (!b) return;
    moveActor(d.name, newPct(b, d.dx), info);
  });
  screen.addEventListener('dblclick', (e) => {
    if (!info) return;
    const hit = hitActor(info, ...toStage(e));
    const sc = app.film?.scenes[info.sceneIndex];
    if (hit && sc?.cast[hit.name]?.line) app.gotoLine(sc.cast[hit.name].line);
  });

  /** Script edit for a drag: before anything happens in the scene → change the cast line; later → add a walk. */
  function moveActor(name, pct, inf) {
    const sc = app.film.scenes[inf.sceneIndex];
    const cast = sc.cast[name];
    const x = Math.round(pct);
    const atStart = inf.lt <= 0.25;
    const setStart = () => {
      const line = app.lineText(cast.line);
      app.replaceLine(cast.line, setCastAt(line, x, cast.y || 0));
      app.toast(`${name} now starts at ${x}%`, { kind: 'ok', action: { label: 'Undo', run: () => app.undo() } });
    };
    if (atStart && cast.line) { setStart(); return; }
    app.insert(`${name} walks to ${x}`, { where: 'now', scene: inf.sceneIndex, quiet: true });
    app.toast(`${name} walks to ${x}% from here`, { kind: 'ok', action: { label: 'Undo', run: () => app.undo() } });
  }

  // ---- drops from the Library ----
  screen.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('application/x-filmly')) { e.preventDefault(); screen.classList.add('dropping'); } });
  screen.addEventListener('dragleave', () => screen.classList.remove('dropping'));
  screen.addEventListener('drop', (e) => {
    screen.classList.remove('dropping');
    const raw = e.dataTransfer.getData('application/x-filmly');
    if (!raw) return;
    e.preventDefault();
    const item = JSON.parse(raw);
    const [px] = toStage(e);
    let x = Math.round((px / STAGE_W) * 100);
    if (info?.cam) x = Math.round((info.cam.toScene(px, 0)[0] / STAGE_W) * 100);
    app.actions.dropItem(item, { x, scene: info?.sceneIndex ?? sceneIndexAt(app.film, app.t) });
  });

  const api = {
    render(film, assets, t) {
      const r = screen.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, Math.round(r.width * dpr));
      if (canvas.width !== w) { canvas.width = w; canvas.height = Math.round((w * 9) / 16); }
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(canvas.width / STAGE_W, 0, 0, canvas.width / STAGE_W, 0, 0);
      try { app.renderFrame(ctx, film, assets, t); } catch (e) { console.error(e); }
      try { info = actorBoxes(film, app.assets, t); } catch { info = null; }
      if (hover && info && !info.boxes.some((b) => b.name === hover.name)) hover = null;
      drawOverlay();
      const fps = film.meta.fps;
      $('#timeLabel').textContent = `${formatTime(t)} / ${formatTime(film.duration)}`;
      $('#frameLabel').textContent = `frame ${Math.round(t * fps)} · ${fps} fps`;
      scrub.max = String(Math.round(film.duration * 1000));
      scrub.value = String(Math.round(t * 1000));
      scrub.style.setProperty('--p', `${(t / film.duration) * 100}%`);
    },
    drawEmpty() {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d0e12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      info = null;
      drawOverlay();
    },
    fullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else screen.requestFullscreen?.().catch(() => {}); },
    get info() { return info; },
  };
  return api;
}
