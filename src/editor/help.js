// Help drawer: the FilmScript guide (docs/FILMSCRIPT.md, searchable), "How it works", and keyboard shortcuts.
import { renderMarkdown, sections, esc } from './markdown.js';
import { icon } from './icons.js';
import { openModal, toast } from './ui.js';

export const SHORTCUTS = [
  ['Playback', [['Space', 'Play / pause'], ['K', 'Pause'], ['L', 'Play forward (press again: faster)'], ['J', 'Play backward (press again: faster)'], ['← / →', 'Previous / next frame'], ['Shift + ← / →', 'Back / forward 1 second'], ['Home / End', 'Start / end of film'], ['F', 'Fullscreen preview']]],
  ['Editing', [['Ctrl + Z', 'Undo'], ['Ctrl + Shift + Z  or  Ctrl + Y', 'Redo'], ['Esc', 'Deselect character'], ['Double-click a timeline block', 'Jump to its script line'], ['Drag a character', 'Move it (start position, or a walk from the playhead)']]],
  ['Files', [['Ctrl + S', 'Save .fly file'], ['Ctrl + O', 'Open .fly file'], ['Ctrl + E', 'Export MP4']]],
  ['Help', [['?', 'This list']]],
];

const HOW = `
<div class="how">
  <div class="howStep"><span class="num">1</span><div><h4>Your film is a script</h4><p>Everything — characters, lines, moves, camera — is written in a small language called <b>FilmScript</b>, in the Script panel. You never <i>have</i> to type it: every button writes it for you, and you can always read exactly what happened.</p></div></div>
  <div class="howStep"><span class="num">2</span><div><h4>Add things from the Library</h4><p>Click a character to put it in the scene, or drag it onto the stage. Click a background to change the scene. Moves, moods and transitions work the same way.</p></div></div>
  <div class="howStep"><span class="num">3</span><div><h4>Direct on the stage</h4><p>Click a character to select it. The Inspector then offers <b>Say…</b>, <b>Move…</b>, <b>Gesture…</b>, <b>Mood…</b> and more. Drag a character sideways to move them.</p></div></div>
  <div class="howStep"><span class="num">4</span><div><h4>Read it on the timeline</h4><p>Each line of the script becomes a block. Click to jump there; double-click to open the line in the script.</p></div></div>
  <div class="howStep"><span class="num">5</span><div><h4>Voices</h4><p>New films use your computer's built-in voices: instant, but they can't be recorded, so MP4s are silent. Before exporting, use <b>Switch voices to Kokoro</b> (free, runs in your browser) or pick a cloud voice in <b>Voice Lab</b>.</p></div></div>
  <div class="howStep"><span class="num">6</span><div><h4>Work with Claude</h4><p><b>Copy for Claude</b> puts the language guide, the asset list and your script on the clipboard. Ask Claude for changes and paste the script it returns back into the Script panel.</p></div></div>
  <div class="howStep"><span class="num">7</span><div><h4>Export</h4><p><b>Export</b> renders every frame in your browser — 720p to 8K — and saves an MP4 with sound. Your films autosave in this browser; use <b>File → Save .fly</b> to keep a copy.</p></div></div>
</div>`;

let drawer = null;
let guideMd = null;

export async function openHelp(app, tab = 'guide') {
  if (!drawer) {
    drawer = document.createElement('dialog');
    drawer.className = 'drawer';
    drawer.id = 'helpPanel';
    drawer.innerHTML = `<header class="drawerHead"><h2>${icon('book', 18)} Help</h2><span class="spacer"></span><button class="iconBtn ghost" data-close aria-label="Close help">${icon('x', 18)}</button></header>
      <nav class="drawerTabs"><button data-tab="guide">FilmScript guide</button><button data-tab="how">How it works</button><button data-tab="keys">Shortcuts</button></nav>
      <div class="drawerSearch"><span class="sIcon">${icon('search', 15)}</span><input type="search" id="helpSearch" placeholder="Search the guide… (e.g. camera, voice, walk)"></div>
      <div class="drawerBody" id="helpBody"></div>`;
    document.body.appendChild(drawer);
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) drawer.close();
      const t = e.target.closest('[data-tab]');
      if (t) show(t.dataset.tab);
      const c = e.target.closest('[data-copy]');
      if (c) { navigator.clipboard?.writeText(c.parentElement.querySelector('code').textContent).then(() => toast('Copied', { kind: 'ok', ms: 1200 }), () => {}); }
    });
    drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); drawer.close(); } });
    drawer.querySelector('#helpSearch').addEventListener('input', () => show('guide', true));
  }
  if (guideMd == null) {
    try { guideMd = await (await fetch('docs/FILMSCRIPT.md')).text(); } catch { guideMd = '# FilmScript\n\nThe guide could not be loaded.'; }
  }
  function show(id, keepSearch) {
    drawer.dataset.tab = id;
    drawer.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    drawer.querySelector('.drawerSearch').hidden = id !== 'guide';
    const body = drawer.querySelector('#helpBody');
    if (id === 'how') body.innerHTML = HOW;
    else if (id === 'keys') body.innerHTML = shortcutsHtml();
    else {
      const q = drawer.querySelector('#helpSearch').value.trim().toLowerCase();
      const secs = sections(guideMd);
      const hits = q ? secs.filter((s) => (s.title + '\n' + s.md).toLowerCase().includes(q)) : secs;
      const md = hits.map((s) => (s.level ? `${'#'.repeat(s.level)} ${s.title}\n` : '') + s.md).join('\n');
      body.innerHTML = hits.length ? `<article class="md">${renderMarkdown(md)}</article>` : `<div class="empty">${icon('search', 26)}<p>Nothing in the guide mentions “${esc(q)}”.</p></div>`;
      if (q) highlight(body, q);
      if (!keepSearch) body.scrollTop = 0;
    }
  }
  show(tab);
  if (!drawer.open) { if (document.querySelector('dialog.welcome[open], dialog.modal[open]')) drawer.showModal(); else drawer.show(); }
  if (tab === 'guide') setTimeout(() => drawer.querySelector('#helpSearch').focus(), 50);
}

function highlight(root, q) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.toLowerCase().includes(q)) hits.push(walker.currentNode);
  for (const node of hits) {
    const frag = document.createDocumentFragment();
    const text = node.nodeValue;
    let i = 0, j;
    const lower = text.toLowerCase();
    while ((j = lower.indexOf(q, i)) >= 0) {
      frag.appendChild(document.createTextNode(text.slice(i, j)));
      const m = document.createElement('mark');
      m.textContent = text.slice(j, j + q.length);
      frag.appendChild(m);
      i = j + q.length;
    }
    frag.appendChild(document.createTextNode(text.slice(i)));
    node.parentNode.replaceChild(frag, node);
  }
  root.querySelector('mark')?.scrollIntoView({ block: 'center' });
}

function shortcutsHtml() {
  return `<div class="keys">${SHORTCUTS.map(([g, rows]) => `<section><h4>${esc(g)}</h4>${rows.map(([k, d]) => `<div class="keyRow"><span>${esc(d)}</span><span class="kbds">${k.split(/\s+(\+|or)\s+|\s*\/\s*/).filter((x) => x && x !== '+').map((x) => (x === 'or' ? '<i>or</i>' : `<kbd>${esc(x)}</kbd>`)).join('')}</span></div>`).join('')}</section>`).join('')}</div>`;
}

export function openShortcuts() {
  return openModal({ title: 'Keyboard shortcuts', body: shortcutsHtml(), width: 620, cls: 'keysModal' });
}
