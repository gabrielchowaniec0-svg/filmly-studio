// Turns a compiled film into timeline tracks (pure; the view draws these).
// Block: { t0, t1, type, label, line, actor?, scene, instant? }  — times are global film seconds.

const STAGE_W = 1920;
const pct = (x) => `${Math.round((x / STAGE_W) * 100)}%`;
const short = (s, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function buildTracks(film) {
  const out = { duration: film?.duration || 0, scenes: [], tracks: [] };
  if (!film) return out;
  const sceneTrack = { id: 'scenes', label: 'Scenes', kind: 'scene', lanes: [[]] };
  const camTrack = { id: 'camera', label: 'Camera & text', kind: 'camera', lanes: [[], []] };
  const soundTrack = { id: 'sound', label: 'Sound & effects', kind: 'sound', lanes: [[]] };
  const actors = new Map();
  const actorTrack = (name, char) => {
    if (!actors.has(name)) actors.set(name, { id: 'actor:' + name, label: name, char, actor: name, kind: 'actor', lanes: [[], []] });
    return actors.get(name);
  };

  film.scenes.forEach((sc, si) => {
    const S = sc.start;
    out.scenes.push({ index: si, id: sc.id, bg: sc.bg, start: S, end: S + sc.duration, line: sc.line, transition: sc.transitionIn });
    sceneTrack.lanes[0].push({ t0: S, t1: S + sc.duration, type: 'scene', label: sc.id, sub: sc.bg, line: sc.line, scene: si });
    if (sc.transitionIn) sceneTrack.lanes[0].push({ t0: S, t1: S + sc.transitionIn.dur, type: 'transition', label: sc.transitionIn.type, line: sc.transitionIn.line, scene: si, overlay: true });
    for (const name of sc.castOrder) actorTrack(name, sc.cast[name].char);
    const stances = {};
    for (const e of sc.events) {
      const t0 = S + e.t;
      const base = { t0, line: e.line, scene: si, actor: e.actor };
      switch (e.type) {
        case 'say': actorTrack(e.actor).lanes[0].push({ ...base, t1: t0 + e.dur, type: 'say', label: short(e.text), text: e.text, voice: e.voice?.id || e.voice?.engine }); break;
        case 'move': {
          const verb = e.to.x < -50 || e.to.x > STAGE_W + 50 ? 'exit' : e.clip === 'run' ? 'run' : e.clip ? 'walk' : 'move';
          actorTrack(e.actor).lanes[1].push({ ...base, t1: t0 + e.dur, type: 'move', label: verb === 'exit' ? 'exit' : `${verb} → ${pct(e.to.x)}` });
          break;
        }
        case 'gesture': actorTrack(e.actor).lanes[1].push({ ...base, t1: t0 + e.dur, type: 'gesture', label: e.clip.replace(/_/g, ' ') }); break;
        case 'stance': {
          const prev = stances[e.actor];
          if (prev && prev.clip !== 'idle') prev.block.t1 = t0;
          stances[e.actor] = { clip: e.clip, block: null };
          if (e.clip !== 'idle') {
            const b = { ...base, t1: S + sc.duration, type: 'stance', label: e.clip.replace(/_/g, ' ') };
            stances[e.actor].block = b;
            actorTrack(e.actor).lanes[1].push(b);
          }
          break;
        }
        case 'mood': case 'look': case 'face': case 'show': case 'hide': {
          if (e.type === 'face' && sc.events.some((m) => m.type === 'move' && m.actor === e.actor && m.t === e.t)) break; // implied by the walk
          if (e.type === 'show' && e.x != null) break; // part of "enters"
          const label = e.type === 'mood' ? e.mood : e.type === 'look' ? `look ${e.target}` : e.type === 'face' ? `face ${e.dir}` : e.type;
          actorTrack(e.actor).lanes[1].push({ ...base, t1: t0, instant: true, type: e.type, label });
          break;
        }
        case 'caption': camTrack.lanes[1].push({ ...base, t1: t0 + e.dur, type: e.style === 'title' ? 'title' : 'caption', label: short(e.text, 40) }); break;
        case 'camera': camTrack.lanes[0].push({ ...base, t1: t0 + Math.max(e.dur || 0, 0.001), instant: !e.dur, type: 'camera', label: e.zoom != null ? `zoom ${e.zoom}×` : 'camera' }); break;
        case 'sfx': case 'music': case 'ambience': case 'effect': {
          const name = e.src || e.id || e.name || e.effect || e.type;
          soundTrack.lanes[0].push({ ...base, t1: t0, instant: true, type: e.type, label: `${e.type} ${String(name).replace(/^.*\//, '')}` });
          break;
        }
        default:
          if (e.actor && actors.has(e.actor)) actorTrack(e.actor).lanes[1].push({ ...base, t1: t0 + (e.dur || 0), instant: !e.dur, type: e.type, label: e.type });
      }
    }
  });
  out.tracks.push(sceneTrack);
  if (camTrack.lanes.some((l) => l.length)) out.tracks.push(camTrack);
  for (const t of actors.values()) out.tracks.push(t);
  if (soundTrack.lanes[0].length) out.tracks.push(soundTrack);
  for (const t of out.tracks) for (const l of t.lanes) l.sort((a, b) => a.t0 - b.t0);
  return out;
}

/** Scene index at global time t (the incoming one during a transition). */
export function sceneIndexAt(film, t) {
  if (!film || !film.scenes.length) return -1;
  let idx = 0;
  film.scenes.forEach((s, i) => { if (t >= s.start - 1e-6) idx = i; });
  return idx;
}

/** First compiled event that came from script line `line` -> global time, or null. */
export function timeOfLine(film, line) {
  if (!film) return null;
  for (const sc of film.scenes) {
    if (sc.line === line) return sc.start;
    for (const e of sc.events) if (e.line === line) return sc.start + e.t;
    for (const name of sc.castOrder) if (sc.cast[name].line === line) return sc.start;
  }
  return null;
}

/** The script line of the latest event in scene `si` that starts at or before local time lt (for inserting "now"). */
export function lineAtTime(film, si, lt) {
  const sc = film?.scenes[si];
  if (!sc) return null;
  let best = null;
  // the script runs top to bottom, so the furthest-down statement that has started is "where we are"
  for (const e of sc.events) if (e.line && e.t <= lt + 1e-6 && (!best || e.line > best.line)) best = e;
  return best ? best.line : null;
}
