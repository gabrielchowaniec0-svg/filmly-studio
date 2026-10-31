// Inspector: context for the selected actor, the current scene and the script line under the cursor,
// with quick actions that insert FilmScript.
import { drawCharacterThumb, drawSceneThumb } from './thumbs.js';
import { actorState } from '../engine/timeline.js';
import { sceneIndexAt, timeOfLine } from './timeline-data.js';
import { icon } from './icons.js';
import { $, esc, ask, toast } from './ui.js';
import * as ops from './script-ops.js';

const KIND_LABEL = { say: 'Dialogue', cast: 'Cast', scene: 'Scene', caption: 'Caption', title: 'Title card', camera: 'Camera move', transition: 'Transition', action: 'Action', voicedef: 'Voice definition', chardef: 'Character variant', film: 'Film settings', wait: 'Pause', par: 'Together block', repeat: 'Repeat block', comment: 'Comment', fade: 'Fade', sfx: 'Sound effect', music: 'Music', effect: 'Effect', prop: 'Prop', other: 'Statement' };

export function createInspector(app) {
  const body = $('#inspBody');
  const modeEl = $('#insertMode');
  const renderMode = () => {
    modeEl.innerHTML = `<div class="seg mini" title="Where quick actions add new lines"><label><input type="radio" name="imode" value="scene-end" ${app.insertMode === 'scene-end' ? 'checked' : ''}><span>End of scene</span></label><label><input type="radio" name="imode" value="cursor" ${app.insertMode === 'cursor' ? 'checked' : ''}><span>At cursor</span></label></div>`;
  };
  modeEl.addEventListener('change', (e) => { if (e.target.name === 'imode') app.setInsertMode(e.target.value); });
  renderMode();
  app.on('insertMode', renderMode);

  let lastKey = '';
  const btn = (act, ic, label, title = '') => `<button class="qa" data-act="${act}" title="${esc(title || label)}">${icon(ic, 16)}<span>${esc(label)}</span></button>`;

  function render(force) {
    const film = app.film;
    const si = film ? (app.lastFocus === 'script' ? app.targetScene() : sceneIndexAt(film, app.t)) : -1;
    const sc = film?.scenes[si];
    const sel = app.sel && sc?.cast[app.sel.actor] ? app.sel.actor : null;
    const line = app.cursorLine;
    const lineTxt = app.lineText(line);
    const key = [si, sel, line, lineTxt, film && film.duration, app.errors.length, Object.keys(film?.characters || {}).join()].join('|');
    if (!force && key === lastKey) { updateLive(sc, sel); return; }
    lastKey = key;
    let html = '';
    if (!film) {
      html = `<div class="empty">${icon('alert', 26)}<p>Fix the script errors to see the film here.</p></div>`;
      body.innerHTML = html;
      return;
    }
    if (sel) {
      const c = sc.cast[sel];
      const ch = film.characters?.[c.char] || app.assets.characters[c.char];
      html += `<section class="card actorCard">
        <div class="cardHead"><canvas class="avatar" width="120" height="156" data-char="${esc(c.char)}"></canvas>
          <div class="who"><h4>${esc(sel)}</h4><p class="small">${esc(ch?.name || c.char)}${ch?.about ? ` · ${esc(ch.about)}` : ''}</p><p class="small live" id="actorLive"></p></div>
          <button class="iconBtn ghost sm" data-act="deselect" title="Deselect (Esc)">${icon('x', 14)}</button></div>
        <div class="qaGrid">
          ${btn('say', 'message', 'Say…', 'Add a line of dialogue')}${btn('walk', 'walk', 'Move…', 'Walk, run or glide somewhere')}${btn('gesture', 'hand', 'Gesture…')}
          ${btn('mood', 'smile', 'Mood…')}${btn('look', 'eye', 'Look at…')}${btn('enter', 'enter', 'Enter / exit…')}
          ${btn('face', 'chevronRight', 'Face…', 'Turn left, right or towards someone')}${btn('hide', 'eyeOff', 'Hide / show')}${btn('look-char', 'palette', 'Customize…', 'Make a variant in the Character Creator')}
        </div>
        <div class="cardFoot"><button class="link" data-act="castline">Go to cast line ${c.line || ''}</button><span class="small dim">Tip: drag them on the stage to move</span></div>
      </section>`;
    }
    const scan = app.scan;
    const sline = sc.line;
    html += `<section class="card sceneCard">
      <div class="cardHead"><canvas class="sceneThumb" width="192" height="108" data-bg="${esc(sc.bg)}"></canvas>
        <div class="who"><p class="eyebrow">Scene ${si + 1} of ${film.scenes.length}</p><h4>${esc(sc.id)}</h4><p class="small">${esc(app.assets.scenes[sc.bg]?.name || sc.bg)} · ${ops.formatTime(sc.start, 1)}–${ops.formatTime(sc.start + sc.duration, 1)}</p></div></div>
      <div class="chips">${sc.castOrder.map((n) => `<button class="chip ${n === sel ? 'on' : ''}" data-select="${esc(n)}">${esc(n)}</button>`).join('')}<button class="chip add" data-act="addchar">${icon('plus', 12)} Add character</button></div>
      <div class="qaGrid">
        ${btn('bg', 'image', 'Background…')}${btn('caption', 'caption', 'Caption…')}${btn('title', 'text', 'Title card…')}
        ${btn('camera', 'camera', 'Camera…', 'Zoom and pan')}${btn('wait', 'clock', 'Pause…')}${btn('transition', 'transition', 'Transition…', si ? 'How this scene begins' : 'Add a second scene to use transitions')}
        ${Object.keys(app.effects || {}).length ? btn('effect', 'cloud', 'Effect…') : ''}${Object.keys(app.assets.sounds || {}).length ? btn('sound', 'music', 'Sound…') : ''}${btn('newscene', 'plus', 'New scene…')}
      </div>
      <div class="cardFoot"><button class="link" data-act="sceneline" data-line="${sline || ''}">Go to scene line ${sline || ''}</button></div>
    </section>`;

    const k = ops.lineKind(lineTxt);
    if (lineTxt.trim() && scan) {
      const t = timeOfLine(film, line);
      html += `<section class="card lineCard">
        <div class="cardHead slim"><p class="eyebrow">Script line ${line}</p><span class="pill">${esc(KIND_LABEL[k.kind] || 'Statement')}</span></div>
        <pre class="mono linePreview">${esc(lineTxt.trim())}</pre>
        <div class="rowBtns">
          ${t != null ? `<button class="sm" data-act="playline">${icon('play', 12)} Play from here</button>` : ''}
          ${k.kind === 'say' ? `<button class="sm" data-act="editsay">${icon('edit', 12)} Edit…</button>` : ''}
          ${k.kind === 'cast' ? `<button class="sm" data-act="selectcast">${icon('target', 12)} Select</button>` : ''}
          <button class="sm" data-act="dup" title="Duplicate line">${icon('copy', 12)} Duplicate</button>
          <button class="sm danger" data-act="del" title="Delete line">${icon('trash', 12)} Delete</button>
        </div>
      </section>`;
    } else if (!sel) {
      html += `<p class="hintCard">${icon('info', 14)} Click a character on the stage to direct them, or click any line of the script to edit it here.</p>`;
    }
    body.innerHTML = html;
    body.querySelectorAll('canvas[data-char]').forEach((cv) => drawCharacterThumb(cv, app.assets, cv.dataset.char, film.characters));
    body.querySelectorAll('canvas[data-bg]').forEach((cv) => drawSceneThumb(cv, app.assets, cv.dataset.bg));
    updateLive(sc, sel);
  }

  function updateLive(sc, sel) {
    const el = $('#actorLive');
    if (!el || !sc || !sel) return;
    const lt = app.t - sc.start;
    if (lt < 0 || lt > sc.duration) { el.textContent = ''; return; }
    const st = actorState(sc, sel, lt);
    el.innerHTML = `${st.visible ? `at ${Math.round((st.x / app.STAGE_W) * 100)}%` : 'off stage'} · ${esc(st.mood || 'neutral')}${st.say ? ` · <i>“${esc(st.say.text.slice(0, 40))}${st.say.text.length > 40 ? '…' : ''}”</i>` : st.moving ? ' · moving' : ''}`;
  }

  body.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-select]');
    if (chip) { app.select(chip.dataset.select); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const film = app.film;
    const si = app.lastFocus === 'script' ? app.targetScene() : sceneIndexAt(film, app.t);
    const sc = film.scenes[si];
    const a = app.sel?.actor;
    const X = app.actions;
    switch (b.dataset.act) {
      case 'deselect': app.select(null); break;
      case 'say': X.say(a, si); break;
      case 'walk': X.walk(a, si); break;
      case 'gesture': X.gesture(a, si); break;
      case 'mood': X.mood(a, si); break;
      case 'look': X.look(a, si); break;
      case 'enter': X.enterExit(a, si); break;
      case 'face': X.face(a, si); break;
      case 'hide': {
        const st = actorState(sc, a, Math.max(0, app.t - sc.start));
        X.showHide(a, si, !st.visible);
        break;
      }
      case 'look-char': app.creator(app.assets.characters[sc.cast[a].char] ? sc.cast[a].char : undefined); break;
      case 'castline': if (sc.cast[a]?.line) app.gotoLine(sc.cast[a].line); break;
      case 'sceneline': if (+b.dataset.line) app.gotoLine(+b.dataset.line); break;
      case 'addchar': X.addCharacter(si); break;
      case 'bg': X.pickBackground(si); break;
      case 'caption': X.caption(si, 'caption'); break;
      case 'title': X.caption(si, 'title'); break;
      case 'camera': X.camera(si); break;
      case 'wait': X.wait(si); break;
      case 'transition': X.transition(si); break;
      case 'effect': X.effect(si); break;
      case 'sound': X.sound(si); break;
      case 'newscene': X.addScene(); break;
      case 'playline': { const t = timeOfLine(film, app.cursorLine); if (t != null) { app.seek(t); app.play(); } break; }
      case 'selectcast': { const k = ops.lineKind(app.lineText(app.cursorLine)); app.select(k.actor); break; }
      case 'dup': { const ln = app.cursorLine; const r = ops.insertLines(app.getScript(), ln, app.lineText(ln)); app.setScript(r.src, { line: r.line }); break; }
      case 'del': {
        const ln = app.cursorLine;
        app.setScript(ops.deleteLine(app.getScript(), ln));
        app.gotoLine(Math.max(1, ln - 1));
        toast(`Deleted line ${ln}`, { action: { label: 'Undo', run: () => app.undo() } });
        break;
      }
      case 'editsay': editSay(); break;
      default: break;
    }
  });

  async function editSay() {
    const ln = app.cursorLine;
    const txt = app.lineText(ln);
    const k = ops.lineKind(txt);
    const cur = (p) => (new RegExp(`\\b${p}=("[^"]*"|[^\\s&]+)`).exec(ops.codePart(txt)) || [])[1]?.replace(/^"|"$/g, '') || '';
    const r = await ask({
      title: `Edit ${k.actor}'s line`, ok: 'Save',
      fields: [
        { key: 'text', label: 'Line', type: 'textarea', value: k.text },
        { key: 'voice', label: 'Voice', type: 'select', value: cur('voice'), options: app.actions.voiceOptions() },
        { key: 'mood', label: 'Mood', type: 'select', value: cur('mood'), options: [['', 'Keep current mood'], ...Object.keys(app.MOODS)] },
      ],
    });
    if (!r) return;
    let out = txt.replace(/("(?:[^"\\]|\\.)*")/, ops.q(r.text.trim()));
    out = ops.setProp(out, 'voice', r.voice || null);
    out = ops.setProp(out, 'mood', r.mood || null);
    app.replaceLine(ln, out);
  }

  app.on('select', () => render(true));
  app.on('compile', () => render(true));
  app.on('cursor', () => render());
  let raf = 0;
  app.on('time', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); });
  render(true);
  return { render };
}
