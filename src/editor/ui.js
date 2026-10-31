// Small DOM toolkit for the editor: toasts, modals, forms, pickers and drop-down menus.
import { icon } from './icons.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// ---- toasts ------------------------------------------------------------------------------------
export function toast(msg, { kind = 'info', ms = 3200, action } = {}) {
  let box = document.getElementById('toasts');
  if (!box) { box = h('<div id="toasts" class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(box); }
  const ic = kind === 'error' ? 'alert' : kind === 'ok' ? 'check' : 'info';
  const el = h(`<div class="toast ${kind}">${icon(ic, 16)}<span></span>${action ? `<button class="link">${esc(action.label)}</button>` : ''}</div>`);
  el.querySelector('span').textContent = msg;
  if (action) el.querySelector('button').onclick = () => { action.run(); el.remove(); };
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, ms);
  return el;
}

// ---- modal -------------------------------------------------------------------------------------
/** openModal({title, body: html|Node, actions:[{label, primary, value, danger}], width, onOpen}) -> {el, close, done:Promise} */
export function openModal({ title, sub = '', body = '', actions = [], width = 520, cls = '', onOpen, dismissable = true, canClose } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = `modal ${cls}`;
  dlg.style.width = `min(${width}px, 94vw)`;
  dlg.innerHTML = `<header class="modalHead"><div><h2>${esc(title)}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${dismissable ? `<button class="iconBtn ghost" data-close aria-label="Close">${icon('x', 18)}</button>` : ''}</header>
    <div class="modalBody"></div>${actions.length ? `<footer class="modalFoot">${actions.map((a, i) => `<button data-i="${i}" class="${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''} ${a.left ? 'left' : ''}">${esc(a.label)}</button>`).join('')}</footer>` : ''}`;
  const bodyEl = dlg.querySelector('.modalBody');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  document.body.appendChild(dlg);
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const close = (v = null) => { if (!dlg.isConnected) return; if (v === null && canClose && !canClose()) return; dlg.close(); dlg.remove(); resolve(v); };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (dismissable) close(null); });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg && dismissable) close(null);
    if (e.target.closest('[data-close]')) close(null);
    const b = e.target.closest('.modalFoot button[data-i]');
    if (b) { const a = actions[+b.dataset.i]; if (a.run) { const r = a.run(dlg); if (r !== false) close(r ?? a.value ?? true); } else close(a.value ?? true); }
  });
  dlg.showModal();
  onOpen && onOpen(dlg, close);
  return { el: dlg, close, done };
}

export function confirmDialog(title, message, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return openModal({ title, body: `<p class="lead">${message}</p>`, width: 440, actions: [{ label: cancel, value: false }, { label: ok, primary: !danger, danger, value: true }] }).done.then((v) => !!v);
}

/**
 * ask({title, fields:[{key,label,type:'text'|'textarea'|'select'|'number'|'range'|'segmented'|'check',options,value,min,max,step,hint,placeholder}], ok})
 * Resolves to {key: value} or null.
 */
export function ask({ title, sub, fields, ok = 'Insert', width = 480, preview }) {
  const form = document.createElement('form');
  form.className = 'form';
  form.innerHTML = fields.map((f) => fieldHtml(f)).join('') + (preview ? '<pre class="previewLine mono"></pre>' : '');
  const read = () => {
    const out = {};
    for (const f of fields) {
      const el = form.elements[f.key];
      if (!el) continue;
      if (f.type === 'check') out[f.key] = el.checked;
      else if (f.type === 'segmented') out[f.key] = form.querySelector(`[name="${f.key}"]:checked`)?.value ?? f.value;
      else if (f.type === 'number' || f.type === 'range') out[f.key] = el.value === '' ? null : +el.value;
      else out[f.key] = el.value;
    }
    return out;
  };
  const upd = () => {
    form.querySelectorAll('output[data-for]').forEach((o) => { o.textContent = form.elements[o.dataset.for].value + (o.dataset.unit || ''); });
    if (preview) form.querySelector('.previewLine').textContent = preview(read());
  };
  form.addEventListener('input', upd);
  form.addEventListener('change', upd);
  const m = openModal({ title, sub, body: form, width, actions: [{ label: 'Cancel', value: null }, { label: ok, primary: true, run: () => read() }] });
  form.addEventListener('submit', (e) => { e.preventDefault(); m.close(read()); });
  setTimeout(() => { upd(); const first = form.querySelector('input:not([type=radio]):not([type=checkbox]),textarea,select'); first && first.focus(); first?.select?.(); }, 30);
  return m.done;
}

function fieldHtml(f) {
  const hint = f.hint ? `<span class="hint">${f.hint}</span>` : '';
  const v = f.value ?? '';
  switch (f.type) {
    case 'textarea': return `<label class="field"><span>${esc(f.label)}</span><textarea name="${f.key}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>${hint}</label>`;
    case 'select': return `<label class="field"><span>${esc(f.label)}</span><select name="${f.key}">${selectOptions(f.options, v)}</select>${hint}</label>`;
    case 'range': return `<label class="field"><span>${esc(f.label)} <output data-for="${f.key}" data-unit="${f.unit || ''}"></output></span><input type="range" name="${f.key}" min="${f.min ?? 0}" max="${f.max ?? 100}" step="${f.step ?? 1}" value="${v}">${hint}</label>`;
    case 'number': return `<label class="field"><span>${esc(f.label)}</span><input type="number" name="${f.key}" min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step ?? 'any'}" value="${v}" placeholder="${esc(f.placeholder || '')}">${hint}</label>`;
    case 'check': return `<label class="check"><input type="checkbox" name="${f.key}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    case 'segmented': return `<div class="field"><span>${esc(f.label)}</span><div class="seg">${f.options.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<label><input type="radio" name="${f.key}" value="${esc(val)}" ${String(val) === String(v) ? 'checked' : ''}><span>${esc(lab)}</span></label>`; }).join('')}</div>${hint}</div>`;
    case 'html': return f.html;
    default: return `<label class="field"><span>${esc(f.label)}</span><input type="text" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">${hint}</label>`;
  }
}
/** options: ['a', ['value','Label'], {group:'Name', options:[…]}] */
export function selectOptions(options, value) {
  return options.map((o) => {
    if (o && o.group) return `<optgroup label="${esc(o.group)}">${selectOptions(o.options, value)}</optgroup>`;
    const [val, lab] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(val)}" ${String(val) === String(value) ? 'selected' : ''}>${esc(lab)}</option>`;
  }).join('');
}

/** A grid of tiles to choose from: items [{value, label, sub, draw?(canvas), html?}] -> value | null */
export function pick({ title, sub, items, width = 640, tile = 'md', empty = 'Nothing to choose from yet.' }) {
  const grid = document.createElement('div');
  grid.className = `pickGrid ${tile}`;
  grid.innerHTML = items.length ? items.map((it, i) => `<button type="button" class="pickTile" data-i="${i}">${it.draw ? `<canvas width="${it.w || 240}" height="${it.h || 135}"></canvas>` : it.html || ''}<b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('') : `<p class="empty">${esc(empty)}</p>`;
  const m = openModal({ title, sub, body: grid, width });
  items.forEach((it, i) => { if (it.draw) { try { it.draw(grid.querySelector(`[data-i="${i}"] canvas`)); } catch (e) { console.warn(e); } } });
  grid.addEventListener('click', (e) => { const b = e.target.closest('.pickTile'); if (b) m.close(items[+b.dataset.i].value); });
  return m.done;
}

// ---- menus -------------------------------------------------------------------------------------
let openMenu = null;
export function closeMenus() { if (openMenu) { openMenu.el.remove(); openMenu.btn.classList.remove('open'); openMenu = null; } }
/** items: [{label, kbd, icon, run, disabled, checked}, '-' , {label, sub:[…]}] */
export function showMenu(btn, items, { align = 'left' } = {}) {
  if (openMenu && openMenu.btn === btn) { closeMenus(); return; }
  closeMenus();
  const el = h('<div class="menu" role="menu"></div>');
  const render = (list) => list.map((it, i) => (it === '-' ? '<div class="sep"></div>'
    : it.header ? `<div class="mhead">${esc(it.header)}</div>`
      : `<button role="menuitem" data-i="${i}" ${it.disabled ? 'disabled' : ''}>${it.checked != null ? `<span class="tick">${it.checked ? icon('check', 14) : ''}</span>` : it.icon ? icon(it.icon, 15) : '<span class="tick"></span>'}<span class="ml">${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}</button>`)).join('');
  el.innerHTML = render(items);
  document.body.appendChild(el);
  const r = btn.getBoundingClientRect();
  el.style.top = `${r.bottom + 4}px`;
  el.style.left = align === 'right' ? `${Math.max(8, r.right - el.offsetWidth)}px` : `${Math.min(r.left, innerWidth - el.offsetWidth - 8)}px`;
  if (r.bottom + 4 + el.offsetHeight > innerHeight) el.style.top = `${Math.max(8, r.top - el.offsetHeight - 4)}px`;
  btn.classList.add('open');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const it = items[+b.dataset.i];
    closeMenus();
    it.run && it.run();
  });
  openMenu = { el, btn };
  return el;
}
if (typeof document !== 'undefined') document.addEventListener('pointerdown', (e) => { if (openMenu && !openMenu.el.contains(e.target) && !openMenu.btn.contains(e.target)) closeMenus(); }, true);
if (typeof document !== 'undefined') document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openMenu) { closeMenus(); e.stopPropagation(); e.preventDefault(); } }, true);

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

/** Load/save small UI prefs safely. */
export const prefs = {
  get(k, d) { try { const v = localStorage.getItem('filmly.ui.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('filmly.ui.' + k, JSON.stringify(v)); } catch { /* blocked */ } },
};
