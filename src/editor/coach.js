// First-run tour: a few coach marks that point at the main panels.
import { icon } from './icons.js';
import { esc } from './ui.js';

const STEPS = [
  { sel: '#pLibrary', title: 'Library', text: 'Characters, backgrounds, moves, moods and transitions. Click one to add it to your film, or drag a character onto the stage.', side: 'right' },
  { sel: '#screen', title: 'Stage', text: 'Press Space to play. Click a character to select it, then drag it sideways to move it.', side: 'bottom' },
  { sel: '#pInspector', title: 'Inspector', text: 'Quick actions for whatever is selected: make a character talk, walk, wave or change mood. Each one adds a line to the script.', side: 'left' },
  { sel: '#pTimeline', title: 'Timeline', text: 'Every line of the script is a block here. Click to jump in time; double-click a block to open its line.', side: 'top' },
  { sel: '#pScript', title: 'Script', text: 'This text IS your film. Edit it directly, or use “Copy for Claude” and paste Claude’s version back in.', side: 'left' },
  { sel: '#btnOpenExport', title: 'Export', text: 'When it looks good, export an MP4 — up to 8K. Tip: switch browser voices to Kokoro first so they are heard in the video.', side: 'bottom' },
];

export function startCoach(app) {
  document.getElementById('coach')?.remove();
  const steps = STEPS.filter((s) => { const el = document.querySelector(s.sel); return el && el.offsetWidth > 0; });
  if (!steps.length) return;
  const root = document.createElement('div');
  root.id = 'coach';
  root.className = 'coach';
  root.innerHTML = '<div class="coachSpot"></div><div class="coachPop" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(root);
  const spot = root.querySelector('.coachSpot'), pop = root.querySelector('.coachPop');
  let i = 0;
  const done = () => { root.remove(); window.removeEventListener('resize', place); try { localStorage.setItem('filmly.coach.v1', 'done'); } catch { /* blocked */ } };
  function place() {
    const s = steps[i];
    const r = document.querySelector(s.sel).getBoundingClientRect();
    const pad = 6;
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    pop.innerHTML = `<div class="coachStep">${i + 1} / ${steps.length}</div><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p>
      <div class="coachBtns"><button class="ghost sm" data-c="skip">Skip tour</button><span class="spacer"></span>${i ? '<button class="sm" data-c="prev">Back</button>' : ''}<button class="primary sm" data-c="next">${i === steps.length - 1 ? 'Start making' : `Next ${icon('chevronRight', 13)}`}</button></div>`;
    const pw = 300, ph = pop.offsetHeight || 160;
    let x, y;
    if (s.side === 'right') { x = r.right + 16; y = r.top + 40; }
    else if (s.side === 'left') { x = r.left - pw - 16; y = r.top + 30; }
    else if (s.side === 'top') { x = r.left + 40; y = r.top - ph - 16; }
    else { x = r.left + r.width / 2 - pw / 2; y = r.bottom + 16; }
    pop.style.left = `${Math.max(12, Math.min(innerWidth - pw - 12, x))}px`;
    pop.style.top = `${Math.max(12, Math.min(innerHeight - ph - 12, y))}px`;
    pop.querySelector('[data-c=next]').focus();
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    if (b.dataset.c === 'skip') done();
    else if (b.dataset.c === 'prev') { i--; place(); }
    else if (++i >= steps.length) done(); else place();
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(); });
  window.addEventListener('resize', place);
  place();
  void app;
}
