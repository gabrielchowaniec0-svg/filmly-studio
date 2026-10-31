// App bar: menus (File / Edit / Insert / View / Help) and toolbar buttons.
import { icon } from './icons.js';
import { $, showMenu } from './ui.js';
import { PANELS } from './layout.js';
import { openShortcuts } from './help.js';

export function buildMenus(app) {
  $('#btnCreator').innerHTML = `${icon('palette', 16)}<span>Characters</span>`;
  $('#btnLab').innerHTML = `${icon('mic', 16)}<span>Voice Lab</span>`;
  $('#btnClaude').innerHTML = `${icon('sparkles', 16)}<span>Copy for Claude</span>`;
  $('#btnOpenExport').innerHTML = `${icon('download', 16)}<span>Export</span>`;
  $('#btnUndo').innerHTML = icon('undo', 15);
  $('#btnRedo').innerHTML = icon('redo', 15);

  const sel = () => app.sel?.actor;
  const si = () => app.targetScene();
  const needSel = (fn) => () => (sel() ? fn(sel(), si()) : app.toast('Select a character on the stage first.', { kind: 'info' }));
  const X = () => app.actions;
  const menus = {
    file: () => [
      { label: 'New film…', icon: 'plus', run: () => app.welcome() },
      { label: 'Open .fly file…', icon: 'upload', kbd: 'Ctrl+O', run: () => app.openFile() },
      { label: 'Save .fly file', icon: 'save', kbd: 'Ctrl+S', run: () => app.saveFile() },
      '-',
      { header: 'This film' },
      { label: 'Rename…', icon: 'edit', run: () => app.renameProject(), disabled: !app.projectId },
      { label: 'Duplicate', icon: 'copy', run: () => app.duplicateProject(), disabled: !app.projectId },
      { label: 'All my films…', icon: 'folder', run: () => app.welcome() },
      '-',
      ...app.assets.manifest.films.map((p) => ({ label: `Example: ${p.replace(/^films\//, '').replace(/\.fly$/, '')}`, icon: 'film', run: () => app.openExample(p) })),
      '-',
      { label: 'Copy context for Claude', icon: 'sparkles', run: () => app.copyForClaude() },
      { label: 'Export MP4…', icon: 'download', kbd: 'Ctrl+E', run: () => app.exportDialog() },
    ],
    edit: () => [
      { label: 'Undo', icon: 'undo', kbd: 'Ctrl+Z', run: () => app.undo() },
      { label: 'Redo', icon: 'redo', kbd: 'Ctrl+Shift+Z', run: () => app.redo() },
      '-',
      { label: 'Go to first problem', icon: 'alert', disabled: !app.errors.length, run: () => app.gotoLine(app.errors[0].line) },
      { label: 'Switch browser voices to Kokoro…', icon: 'mic', run: () => app.switchToKokoro() },
      '-',
      { header: 'Quick actions add lines at' },
      { label: 'The end of the scene', checked: app.insertMode === 'scene-end', run: () => app.setInsertMode('scene-end') },
      { label: 'The script cursor', checked: app.insertMode === 'cursor', run: () => app.setInsertMode('cursor') },
    ],
    insert: () => [
      { header: sel() ? `For ${sel()}` : 'For the selected character' },
      { label: 'Dialogue line…', icon: 'message', run: needSel((a, s) => X().say(a, s)) },
      { label: 'Move…', icon: 'walk', run: needSel((a, s) => X().walk(a, s)) },
      { label: 'Gesture…', icon: 'hand', run: needSel((a, s) => X().gesture(a, s)) },
      { label: 'Mood…', icon: 'smile', run: needSel((a, s) => X().mood(a, s)) },
      '-',
      { header: 'In this scene' },
      { label: 'Character…', icon: 'user', run: () => X().addCharacter(si()) },
      { label: 'Caption…', icon: 'caption', run: () => X().caption(si(), 'caption') },
      { label: 'Title card…', icon: 'text', run: () => X().caption(si(), 'title') },
      { label: 'Camera move…', icon: 'camera', run: () => X().camera(si()) },
      { label: 'Pause…', icon: 'clock', run: () => X().wait(si()) },
      ...(Object.keys(app.effects || {}).length ? [{ label: 'Effect…', icon: 'cloud', run: () => X().effect(si()) }] : []),
      ...(Object.keys(app.assets.sounds || {}).length ? [{ label: 'Sound or music…', icon: 'music', run: () => X().sound(si()) }] : []),
      '-',
      { label: 'New scene…', icon: 'plus', run: () => X().addScene() },
      { label: 'Transition into this scene…', icon: 'transition', run: () => X().transition(si()) },
      { label: 'New character variant…', icon: 'palette', run: () => app.creator() },
      { label: 'Voice…', icon: 'mic', run: () => app.voiceLab() },
    ],
    view: () => [
      ...PANELS.map((p) => ({ label: p.label, checked: app.panelVisible(p.id), run: () => app.togglePanel(p.id) })),
      { label: 'Reset layout', run: () => app.resetLayout() },
      '-',
      { label: document.documentElement.dataset.theme === 'dark' ? 'Light theme' : 'Dark theme', icon: document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', run: () => app.toggleTheme() },
      { label: 'Fullscreen preview', icon: 'fullscreen', kbd: 'F', run: () => app.stage.fullscreen() },
      { label: 'Loop playback', checked: app.loop, run: () => $('#btnLoop').click() },
    ],
    help: () => [
      { label: 'FilmScript guide', icon: 'book', run: () => app.help('guide') },
      { label: 'How Filmly works', icon: 'info', run: () => app.help('how') },
      { label: 'Keyboard shortcuts', icon: 'keyboard', kbd: '?', run: () => openShortcuts(app) },
      '-',
      { label: 'Show the tour again', icon: 'sparkles', run: () => app.startCoach() },
      { label: 'Welcome screen', icon: 'home', run: () => app.welcome() },
    ],
  };
  $('#menubar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-menu]');
    if (b) showMenu(b, menus[b.dataset.menu]());
  });
  // hovering across the menubar while one is open switches menus, like a desktop app
  $('#menubar').addEventListener('pointerover', (e) => {
    const b = e.target.closest('[data-menu]');
    const open = $('#menubar .mbtn.open');
    if (b && open && open !== b) showMenu(b, menus[b.dataset.menu]());
  });
}
