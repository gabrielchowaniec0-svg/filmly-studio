// Timeline panel: scene, camera/text, actor and sound tracks built from the compiled film.
// Click = seek · double-click a block = jump to its script line · Ctrl/⌘+wheel = zoom.
import { buildTracks } from './timeline-data.js';
import { icon } from './icons.js';
import { $, esc, prefs } from './ui.js';

const LANE_H = { scene: [30], camera: [22, 22], actor: [30, 22], sound: [22] };
const RULER = 24;

export function createTimeline(app) {
  const labels = $('#tlLabels'), scroll = $('#tlScroll'), content = $('#tlContent'), zoom = $('#tlZoom');
  $('#tlZoomIn').innerHTML = icon('plus', 14);
  $('#tlZoomOut').innerHTML = icon('minus', 14);
  let pps = prefs.get('tl.pps', 60);
  let data = null;
  let fitted = false;
  let blockIndex = 0; // data-b index of each block, in the same order as content._blocks
  zoom.value = String(pps);

  const setZoom = (v, anchorX) => {
    const old = pps;
    pps = Math.max(+zoom.min, Math.min(+zoom.max, v));
    zoom.value = String(Math.round(pps));
    prefs.set('tl.pps', pps);
    const ax = anchorX ?? scroll.clientWidth / 2;
    const tAt = (scroll.scrollLeft + ax) / old;
    render();
    scroll.scrollLeft = Math.max(0, tAt * pps - ax);
  };
  zoom.addEventListener('input', () => setZoom(+zoom.value));
  $('#tlZoomIn').addEventListener('click', () => setZoom(pps * 1.4));
  $('#tlZoomOut').addEventListener('click', () => setZoom(pps / 1.4));
  const fit = () => { if (data?.duration) setZoom((scroll.clientWidth - 30) / data.duration, 0); scroll.scrollLeft = 0; };
  $('#tlFit').addEventListener('click', fit);
  scroll.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - scroll.getBoundingClientRect().left); }
  }, { passive: false });
  scroll.addEventListener('scroll', () => { labels.scrollTop = scroll.scrollTop; });
  labels.addEventListener('wheel', (e) => { scroll.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });

  function laneHeights(tr) { return LANE_H[tr.kind] || tr.lanes.map(() => 22); }

  function render() {
    if (!app.film) return;
    data = buildTracks(app.film);
    blockIndex = 0;
    const W = Math.max(scroll.clientWidth, Math.ceil(data.duration * pps) + 80);
    const sel = app.sel?.actor;
    // labels
    let lh = `<div class="tlCorner" style="height:${RULER}px"></div>`;
    for (const tr of data.tracks) {
      const hs = laneHeights(tr);
      const h = hs.reduce((a, b) => a + b, 0);
      const ic = tr.kind === 'actor' ? 'user' : tr.kind === 'scene' ? 'film' : tr.kind === 'camera' ? 'camera' : 'music';
      lh += `<div class="tlLabel ${tr.kind} ${tr.actor && tr.actor === sel ? 'on' : ''}" style="height:${h}px" ${tr.actor ? `data-actor="${esc(tr.actor)}"` : ''} title="${tr.actor ? `${esc(tr.actor)} (${esc(tr.char || '')}) — click to select` : esc(tr.label)}">${icon(ic, 13)}<span>${esc(tr.label)}</span>${tr.kind === 'actor' && tr.char && tr.char !== tr.actor ? `<small>${esc(tr.char)}</small>` : ''}</div>`;
    }
    labels.innerHTML = lh + '<div class="tlLabelPad"></div>';
    // ruler ticks
    const step = niceStep(80 / pps);
    let ruler = '';
    for (let t = 0; t <= data.duration + step; t += step) {
      ruler += `<div class="tick" style="left:${t * pps}px"><span>${fmt(t, step)}</span></div>`;
      if (step >= 0.5) for (let m = 1; m < 4; m++) ruler += `<div class="tick minor" style="left:${(t + (step * m) / 4) * pps}px"></div>`;
    }
    // scene bands
    let bands = '';
    data.scenes.forEach((s, i) => { bands += `<div class="band ${i % 2 ? 'alt' : ''}" style="left:${s.start * pps}px;width:${(s.end - s.start) * pps}px"></div>`; });
    // rows
    let rows = '';
    for (const tr of data.tracks) {
      const hs = laneHeights(tr);
      rows += `<div class="tlTrack ${tr.kind} ${tr.actor && tr.actor === sel ? 'on' : ''}" ${tr.actor ? `data-actor="${esc(tr.actor)}"` : ''}>`;
      tr.lanes.forEach((lane, li) => {
        rows += `<div class="tlLane" style="height:${hs[li] || 22}px">`;
        for (const b of lane) rows += blockHtml(b);
        rows += '</div>';
      });
      rows += '</div>';
    }
    content.style.width = `${W}px`;
    content.innerHTML = `<div class="ruler" style="height:${RULER}px">${ruler}</div><div class="bands">${bands}</div><div class="rows">${rows}</div><div class="playhead" id="tlPlayhead"><i></i></div><div class="endMark" style="left:${data.duration * pps}px"></div>`;
    content._blocks = data.tracks.flatMap((t) => t.lanes.flat());
    movePlayhead();
  }

  function blockHtml(b) {
    const i = blockIndex++;
    const left = b.t0 * pps;
    const title = `${b.label}${b.line ? ` — line ${b.line} (double-click to open)` : ''}`;
    if (b.instant) return `<div class="blk inst ${b.type}" data-b="${i}" style="left:${left}px" title="${esc(title)}"><i></i>${pps > 70 ? `<span>${esc(b.label)}</span>` : ''}</div>`;
    const w = Math.max(3, (b.t1 - b.t0) * pps - 1);
    return `<div class="blk ${b.type}${b.overlay ? ' over' : ''}" data-b="${i}" style="left:${left}px;width:${w}px" title="${esc(title)}"><span>${w > 26 ? esc(b.type === 'say' ? b.label : b.label) : ''}</span>${b.sub && w > 90 ? `<small>${esc(b.sub)}</small>` : ''}</div>`;
  }

  function movePlayhead() {
    const ph = $('#tlPlayhead');
    if (!ph) return;
    const x = app.t * pps;
    ph.style.transform = `translateX(${x}px)`;
    if (app.playing) {
      const l = scroll.scrollLeft, w = scroll.clientWidth;
      if (x > l + w - 40 || x < l) scroll.scrollLeft = Math.max(0, x - 60);
    }
  }

  const timeAt = (e) => (e.clientX - content.getBoundingClientRect().left) / pps;
  let scrubbing = false;
  content.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const blk = e.target.closest('.blk');
    if (blk) {
      const b = content._blocks[+blk.dataset.b];
      app.seek(b.t0 + 0.01);
      if (b.actor) app.select(b.actor);
      return;
    }
    scrubbing = true;
    content.setPointerCapture(e.pointerId);
    app.seek(Math.max(0, timeAt(e)));
  });
  content.addEventListener('pointermove', (e) => { if (scrubbing) app.seek(Math.max(0, timeAt(e))); });
  content.addEventListener('pointerup', () => { scrubbing = false; });
  content.addEventListener('dblclick', (e) => {
    const blk = e.target.closest('.blk');
    if (!blk) return;
    const b = content._blocks[+blk.dataset.b];
    if (b.line) app.gotoLine(b.line);
  });
  labels.addEventListener('click', (e) => { const l = e.target.closest('[data-actor]'); if (l) app.select(l.dataset.actor === app.sel?.actor ? null : l.dataset.actor); });

  app.on('compile', () => { render(); if (!fitted && data?.duration) { fitted = true; if (data.duration * pps < scroll.clientWidth * 0.5 || data.duration * pps > scroll.clientWidth * 3) fit(); } });
  app.on('time', movePlayhead);
  // selection only restyles (re-rendering would swallow a double-click that started on a block)
  app.on('select', () => {
    const sel = app.sel?.actor;
    document.querySelectorAll('#tlLabels [data-actor], #tlContent .tlTrack[data-actor]').forEach((el) => el.classList.toggle('on', el.dataset.actor === sel));
  });
  app.on('layout', () => render());
  new ResizeObserver(() => render()).observe(scroll);
  return { render, fit };
}

function niceStep(min) {
  for (const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) if (s >= min) return s;
  return 600;
}
function fmt(t, step) {
  const m = Math.floor(t / 60), s = t - m * 60;
  const ss = step < 1 ? s.toFixed(step < 0.5 ? 2 : 1) : String(Math.round(s));
  return m ? `${m}:${ss.padStart(step < 1 ? 4 : 2, '0')}` : `${ss}s`;
}
