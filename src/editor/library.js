// Library panel: searchable, tabbed asset browser. Clicking or dragging an item writes FilmScript.
import { drawCharacterThumb, drawSceneThumb, drawPoseThumb, drawTransitionThumb } from './thumbs.js';
import { clipStatement, GESTURE_LABELS } from './actions.js';
import { icon } from './icons.js';
import { $, esc, prefs, toast } from './ui.js';
import { PROVIDERS } from '../tts/catalog.js';
import { speakBrowser, stopBrowserSpeech } from '../tts/index.js';
import { lineKind, setProp } from './script-ops.js';

const TABS = [
  { id: 'characters', label: 'Characters', icon: 'users', hint: 'Click to add to the scene · drag onto the stage to place' },
  { id: 'scenes', label: 'Scenes', icon: 'image', hint: 'Click to use as this scene\'s background · ＋ adds a new scene' },
  { id: 'props', label: 'Props', icon: 'box', hint: 'Click to place a prop in the scene' },
  { id: 'effects', label: 'Effects', icon: 'cloud', hint: 'Weather and atmosphere for the current scene' },
  { id: 'sounds', label: 'Sounds', icon: 'music', hint: 'Sound effects, music and ambience' },
  { id: 'voices', label: 'Voices', icon: 'mic', hint: 'Click a dialogue line in the script, then pick a voice for it · ▶ to listen' },
  { id: 'animations', label: 'Moves', icon: 'hand', hint: 'Select a character on the stage, then click a move' },
  { id: 'transitions', label: 'Transitions', icon: 'transition', hint: 'Sets how the current scene begins' },
  { id: 'moods', label: 'Moods', icon: 'smile', hint: 'Select a character, then click a mood' },
];
const SAMPLE = 'Hi! This is how I sound in your film.';

export function createLibrary(app) {
  const tabsEl = $('#libTabs'), list = $('#libList'), search = $('#libSearch'), hint = $('#libHint');
  $('.searchBox .sIcon').innerHTML = icon('search', 15);
  let tab = prefs.get('libTab', 'characters');
  if (!TABS.some((t) => t.id === tab)) tab = 'characters';

  tabsEl.innerHTML = TABS.map((t) => `<button role="tab" data-tab="${t.id}" title="${t.label}">${icon(t.icon, 15)}<span>${t.label}</span></button>`).join('');
  tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
  search.addEventListener('input', () => render());
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { search.value = ''; render(); search.blur(); } });

  // draw thumbnails lazily as they scroll into view
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { const cv = en.target; io.unobserve(cv); try { cv._draw && cv._draw(cv); } catch (err) { console.warn(err); } }
  }, { root: list, rootMargin: '200px' });

  const A = () => app.assets;
  const actor = () => app.sel?.actor || app.actorsIn(app.targetScene())[0]?.name || null;
  const actorChar = () => { const si = app.targetScene(); const n = actor(); return (n && app.film?.scenes[si]?.cast[n]?.char) || Object.keys(A().characters)[0]; };

  function items() {
    const a = A();
    switch (tab) {
      case 'characters': return [
        { id: '__creator', label: 'Create your own', sub: 'hair, outfit, colours, build', cls: 'action', iconName: 'palette', run: () => app.creator() },
        ...Object.values({ ...a.characters, ...(app.film?.characters || {}) }).map((c) => ({
          id: c.id, label: c.name || c.id, sub: c.about || c.build || '', kw: `${c.id} ${Object.values(c.options || {}).join(' ')}`,
          thumb: [120, 136], draw: (cv) => drawCharacterThumb(cv, a, c.id, app.film?.characters), drag: { kind: 'character', id: c.id },
          run: () => app.actions.castCharacter(c.id),
          extra: a.characters[c.id] ? [{ icon: 'palette', title: 'Customize in the Character Creator', run: () => app.creator(c.id) }] : [],
        })),
      ];
      case 'scenes': return [
        { id: '__new', label: 'New scene', sub: 'add a scene at the end', cls: 'action', iconName: 'plus', run: () => app.actions.addScene() },
        ...Object.values(a.scenes).map((s) => ({
          id: s.id, label: s.name || s.id, sub: `bg=${s.id}`, wide: true, thumb: [256, 144], draw: (cv) => drawSceneThumb(cv, a, s.id), drag: { kind: 'scene', id: s.id },
          run: () => app.actions.setBackground(app.targetScene(), s.id),
          extra: [{ icon: 'plus', title: 'Add a new scene with this background', run: () => app.actions.addScene({ bg: s.id }) }],
        })),
      ];
      case 'props': return Object.values(a.props || {}).map((p) => ({
        id: p.id, label: p.name || p.id, sub: p.category || '', iconName: 'box', drag: { kind: 'prop', id: p.id },
        thumb: p.draw || p.layers || p.parts ? [120, 90] : null, draw: p.layers ? (cv) => drawPropLayers(cv, p) : null,
        run: () => app.actions.addProp(p.id),
      }));
      case 'effects': return Object.entries(app.effects || {}).map(([id, e]) => ({ id, label: e.label || id, sub: `effect ${id}`, iconName: 'cloud', drag: { snippet: `effect ${id}` }, run: () => app.insert(`effect ${id}`) }));
      case 'sounds': return Object.values(a.sounds || {}).map((s) => ({
        id: s.id, label: s.name || s.id, sub: `${s.kind || 'sfx'}${s.duration ? ` · ${(+s.duration).toFixed(1)}s` : ''}`, kw: (s.tags || []).join(' '), iconName: s.kind === 'music' ? 'music' : 'wave',
        run: () => app.insert(s.kind === 'music' ? `music ${s.id} vol=0.4 fade=1s` : s.kind === 'ambience' ? `ambience ${s.id} vol=0.5` : `sfx ${s.id}`),
        extra: s.file ? [{ icon: 'play', title: 'Listen', run: () => previewFile(s.file) }] : [],
      }));
      case 'voices': return [
        { id: '__lab', label: 'Voice Lab', sub: `${Object.keys(PROVIDERS).length} engines: Kokoro (free), OpenAI, ElevenLabs, Google…`, cls: 'action', iconName: 'mic', run: () => app.voiceLab() },
        ...Object.values(a.voices).map((v) => ({
          id: v.id, label: v.name.replace(/^Browser · /, ''), group: v.engine === 'webspeech' ? 'Browser voices · preview only' : v.engine === 'kokoro' ? 'Kokoro · free, exports with sound' : 'Cloud voices · need a key', sub: `voice=${v.id}`, iconName: 'mic', kw: v.engine,
          run: () => useVoice(v.id),
          extra: v.engine === 'webspeech' ? [{ icon: 'play', title: 'Listen', run: () => { stopBrowserSpeech(); speakBrowser(SAMPLE, v); } }] : [],
        })),
      ];
      case 'animations': {
        const rig = Object.values(a.rigs)[0];
        const ch = actorChar();
        return Object.entries(rig.clips).filter(([id]) => !/^talk/.test(id)).map(([id, c]) => ({
          id, label: GESTURE_LABELS[id] || id.replace(/_/g, ' '), sub: c.overlay ? 'gesture' : 'stance (loops)', kw: id, thumb: [120, 140],
          draw: (cv) => drawPoseThumb(cv, a, ch, id, null, { extra: app.film?.characters }), anim: { ch, id },
          run: () => { const n = actor(); if (!n) return needActor(); app.insert(c.overlay ? clipStatement(n, id) : `${n} plays ${id}${id === 'idle' ? '' : ' for 2s'}`); },
        }));
      }
      case 'transitions': return Object.entries(app.transitions).map(([id, t]) => ({
        id, label: t.label || id, sub: `transition ${id}`, thumb: [160, 90], draw: (cv) => drawTransitionThumb(cv, a, id, 0.4), trans: id,
        runDirect: () => setTransition(id),
      }));
      case 'moods': {
        const ch = actorChar();
        return Object.keys(app.MOODS).map((m) => ({ id: m, label: m[0].toUpperCase() + m.slice(1), sub: `feels ${m}`, thumb: [100, 100], draw: (cv) => drawPoseThumb(cv, a, ch, 'idle', 0.6, { mood: m, crop: 'head', extra: app.film?.characters }), run: () => { const n = actor(); if (!n) return needActor(); app.insert(`${n} feels ${m}`); } }));
      }
      default: return [];
    }
  }
  const needActor = () => toast('Add a character to the scene first (Characters tab).', { kind: 'info' });
  function setTransition(id) {
    const si = app.targetScene();
    if (!si) { toast('Transitions go between scenes — this is the first scene. Add another scene first.', { kind: 'info' }); return; }
    const src = app.getScript();
    const scan = app.ops.scanBlocks(src);
    const sc = scan.scenes[si], prev = scan.scenes[si - 1];
    const lines = src.split('\n');
    for (let l = sc.line - 1; l > prev.end; l--) if (/^\s*transition\b/.test(lines[l - 1])) { app.replaceLine(l, `transition ${id} 1s`); toast(`Scene "${sc.id}" now opens with: ${app.transitions[id].label}`, { kind: 'ok' }); return; }
    const r = app.ops.insertLines(src, sc.line - 1, `transition ${id} 1s\n`);
    app.setScript(r.src, { line: r.line });
    toast(`Scene "${sc.id}" now opens with: ${app.transitions[id].label}`, { kind: 'ok' });
  }
  function useVoice(id) {
    const line = app.cursorLine;
    const k = lineKind(app.lineText(line));
    if (k.kind === 'say' || k.kind === 'chardef') { app.replaceLine(line, setProp(app.lineText(line), 'voice', id)); toast(`Line ${line} now uses ${A().voices[id]?.name || id}`, { kind: 'ok', action: { label: 'Undo', run: () => app.undo() } }); return; }
    if (app.sel) { app.actions.say(app.sel.actor); return; }
    toast('Click a dialogue line in the script first — then pick its voice here.', { kind: 'info', ms: 4200 });
  }
  let audioEl = null;
  function previewFile(file) { try { audioEl?.pause(); audioEl = new Audio(file); audioEl.play(); } catch { /* unsupported */ } }

  const EMPTY = {
    props: 'No props in this asset library yet. When prop assets are added they appear here.',
    effects: 'No weather or atmosphere effects installed yet.',
    sounds: 'No sounds in this asset library yet. You can still use your own files: sfx "audio/door.wav".',
  };

  function render() {
    tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const t = TABS.find((x) => x.id === tab);
    hint.textContent = t.hint;
    const qy = search.value.trim().toLowerCase();
    const all = items();
    const shown = qy ? all.filter((it) => !it.id.startsWith('__') && `${it.id} ${it.label} ${it.sub} ${it.kw || ''} ${it.group || ''}`.toLowerCase().includes(qy)) : all;
    list.className = `libList tab-${tab}`;
    if (!shown.length) {
      list.innerHTML = `<div class="empty">${icon(t.icon, 28)}<p>${esc(qy ? `Nothing matches "${search.value}".` : EMPTY[tab] || 'Nothing here yet.')}</p></div>`;
      return;
    }
    let lastGroup = null;
    list.innerHTML = shown.map((it, i) => {
      const g = it.group && it.group !== lastGroup ? `<div class="libGroup">${esc(it.group)}</div>` : '';
      lastGroup = it.group || lastGroup;
      const media = it.thumb ? `<canvas width="${it.thumb[0] * 2}" height="${it.thumb[1] * 2}" data-i="${i}"></canvas>` : it.iconName ? `<span class="libIcon">${icon(it.iconName, 20)}</span>` : '';
      return `${g}<div class="libItem ${it.cls || ''} ${it.wide ? 'wide' : ''} ${it.thumb ? 'hasThumb' : 'row'}" data-i="${i}" tabindex="0" ${it.drag ? 'draggable="true"' : ''} title="${esc(it.label)}">
        ${media}<div class="meta"><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</div>
        ${(it.extra || []).map((x, j) => `<button class="iconBtn ghost sm extra" data-x="${j}" title="${esc(x.title)}">${icon(x.icon, 14)}</button>`).join('')}
      </div>`;
    }).join('');
    list.querySelectorAll('canvas[data-i]').forEach((cv) => { cv._draw = shown[+cv.dataset.i].draw; if (cv._draw) io.observe(cv); });
    list._items = shown;
  }

  list.addEventListener('click', (e) => {
    const el = e.target.closest('.libItem');
    if (!el) return;
    const it = list._items[+el.dataset.i];
    const x = e.target.closest('[data-x]');
    if (x) { e.stopPropagation(); it.extra[+x.dataset.x].run(); return; }
    if (it.runDirect) it.runDirect(); else it.run && it.run();
  });
  list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('libItem')) e.target.click(); });
  list.addEventListener('dragstart', (e) => {
    const el = e.target.closest('.libItem');
    const it = el && list._items[+el.dataset.i];
    if (!it?.drag) return;
    e.dataTransfer.setData('application/x-filmly', JSON.stringify(it.drag));
    const text = it.drag.kind === 'character' ? `cast ${it.drag.id}: ${it.drag.id} at 50` : it.drag.kind === 'scene' ? `bg=${it.drag.id}` : it.drag.kind === 'prop' ? `prop ${it.drag.id}: ${it.drag.id} at 50,10` : it.drag.snippet || '';
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  });
  // animate a move's thumbnail while hovering it
  let hoverRaf = 0;
  list.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.libItem');
    cancelAnimationFrame(hoverRaf);
    if (!el || tab !== 'animations' && tab !== 'transitions') return;
    const it = list._items[+el.dataset.i];
    const cv = el.querySelector('canvas');
    if (!cv) return;
    const t0 = performance.now();
    const rig = Object.values(A().rigs)[0];
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      if (it.anim) { const c = rig.clips[it.anim.id]; drawPoseThumb(cv, A(), it.anim.ch, it.anim.id, c.loop || !c.overlay ? t : t % (c.duration + 0.5), { extra: app.film?.characters }); }
      else if (it.trans) drawTransitionThumb(cv, A(), it.trans, (Math.sin(t * 2.2 - Math.PI / 2) + 1) / 2);
      hoverRaf = requestAnimationFrame(tick);
    };
    tick();
    el.addEventListener('pointerleave', () => { cancelAnimationFrame(hoverRaf); it.draw && it.draw(cv); }, { once: true });
  });

  function show(id) { tab = id; prefs.set('libTab', id); search.value = ''; render(); list.scrollTop = 0; }
  // character-dependent tabs follow the selection
  app.on('select', () => { if (tab === 'animations' || tab === 'moods') render(); });
  let lastChars = '';
  app.on('compile', (film) => {
    const key = Object.keys(film?.characters || {}).join();
    if (key !== lastChars && tab === 'characters') { lastChars = key; render(); }
  });
  render();
  return { show, render };
}

function drawPropLayers(cv, p) {
  // generic preview for vector props shaped like scene layers
  import('../engine/paint.js').then(({ drawShape }) => {
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#20232d';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.save();
    const w = p.width || 200, hgt = p.height || 200;
    const s = Math.min(cv.width / w, cv.height / hgt) * 0.8;
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.scale(s, s);
    ctx.translate(-w / 2, -hgt / 2);
    for (const l of p.layers) drawShape(ctx, l, null, null);
    ctx.restore();
  }).catch(() => {});
}
