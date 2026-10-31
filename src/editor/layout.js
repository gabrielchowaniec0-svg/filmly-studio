// Resizable, collapsible panels; sizes and visibility are remembered in localStorage.
import { icon } from './icons.js';
import { prefs, $, $$ } from './ui.js';

const DEFAULTS = { library: 268, right: 440, timeline: 220, inspector: 300 };
const LIMITS = { library: [200, 440], right: [320, 760], timeline: [110, 520], inspector: [150, 640] };
export const PANELS = [
  { id: 'library', label: 'Library', icon: 'panelLeft' },
  { id: 'timeline', label: 'Timeline', icon: 'panelBottom' },
  { id: 'inspector', label: 'Inspector', icon: 'panelRight' },
  { id: 'script', label: 'Script', icon: 'code' },
];

export function initLayout(app) {
  const ws = $('#workspace');
  // only sizes the user dragged are stored (and set inline); the rest come from the stylesheet so small screens get smaller defaults
  const state = { sizes: { ...prefs.get('layout.sizes', {}) }, hidden: prefs.get('layout.hidden', {}) };
  const apply = () => {
    for (const k of Object.keys(DEFAULTS)) { if (state.sizes[k]) ws.style.setProperty(`--${k}-size`, `${state.sizes[k]}px`); else ws.style.removeProperty(`--${k}-size`); }
    for (const p of PANELS) ws.classList.toggle(`hide-${p.id}`, !!state.hidden[p.id]);
    ws.classList.toggle('hide-right', !!(state.hidden.inspector && state.hidden.script));
    $$('#panelToggles button').forEach((b) => { b.classList.toggle('on', !state.hidden[b.dataset.panel]); b.setAttribute('aria-pressed', String(!state.hidden[b.dataset.panel])); });
    requestAnimationFrame(() => app.draw && app.draw());
  };
  const save = () => { prefs.set('layout.sizes', state.sizes); prefs.set('layout.hidden', state.hidden); };

  $('#panelToggles').innerHTML = PANELS.map((p) => `<button class="iconBtn ghost toggle" data-panel="${p.id}" title="Show/hide ${p.label}">${icon(p.icon, 17)}</button>`).join('');
  $('#panelToggles').addEventListener('click', (e) => { const b = e.target.closest('[data-panel]'); if (b) app.togglePanel(b.dataset.panel); });
  $$('[data-collapse]').forEach((b) => { b.innerHTML = icon('x', 14); b.addEventListener('click', () => app.togglePanel(b.dataset.collapse, false)); });

  app.togglePanel = (id, show) => {
    state.hidden[id] = show === undefined ? !state.hidden[id] : !show;
    save(); apply();
    app.emit('layout');
  };
  app.panelVisible = (id) => !state.hidden[id];
  app.resetLayout = () => { state.sizes = {}; state.hidden = {}; save(); apply(); app.emit('layout'); };

  // drag splitters
  for (const sp of $$('.split')) {
    const key = sp.dataset.split;
    sp.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sp.setPointerCapture(e.pointerId);
      sp.classList.add('drag');
      const cur = parseFloat(getComputedStyle(ws).getPropertyValue(`--${key}-size`)) || DEFAULTS[key];
      const start = { x: e.clientX, y: e.clientY, v: state.sizes[key] || cur };
      const move = (ev) => {
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        const d = key === 'library' ? dx : key === 'right' ? -dx : key === 'timeline' ? -dy : dy;
        const [lo, hi] = LIMITS[key];
        state.sizes[key] = Math.round(Math.max(lo, Math.min(hi, start.v + d)));
        apply();
      };
      const up = () => { sp.classList.remove('drag'); sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', up); save(); app.emit('layout'); };
      sp.addEventListener('pointermove', move);
      sp.addEventListener('pointerup', up);
    });
    sp.addEventListener('dblclick', () => { delete state.sizes[key]; save(); apply(); });
  }
  apply();
}
