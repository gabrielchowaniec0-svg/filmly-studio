// Multiple films autosaved in localStorage (or any Storage-like object, for tests).
// Index: filmly.projects.v1 = [{id, name, updated, created}], body: filmly.project.<id> = script text.

const INDEX = 'filmly.projects.v1';
const CURRENT = 'filmly.currentProject.v1';
const LEGACY = 'filmly.script.v1';
const BODY = (id) => `filmly.project.${id}`;

export function createProjectStore(storage = globalThis.localStorage, now = () => Date.now()) {
  const read = (k) => { try { return storage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { storage.setItem(k, v); return true; } catch { return false; } };
  const del = (k) => { try { storage.removeItem(k); } catch { /* ignore */ } };
  const index = () => { try { const j = JSON.parse(read(INDEX) || '[]'); return Array.isArray(j) ? j : []; } catch { return []; } };
  const saveIndex = (xs) => write(INDEX, JSON.stringify(xs));
  const newId = () => now().toString(36) + Math.random().toString(36).slice(2, 7);

  const store = {
    /** Newest first. */
    list() { return index().slice().sort((a, b) => b.updated - a.updated); },
    get(id) { const meta = index().find((p) => p.id === id); return meta ? { ...meta, text: read(BODY(id)) ?? '' } : null; },
    create(name, text) {
      const p = { id: newId(), name: name || 'Untitled', created: now(), updated: now() };
      saveIndex([...index(), p]);
      write(BODY(p.id), text);
      store.setCurrent(p.id);
      return p;
    },
    /** Save text; returns false if storage is full/blocked. `name` is optional (kept unless the user renamed it). */
    save(id, text, name) {
      const xs = index();
      const p = xs.find((x) => x.id === id);
      if (!p) return false;
      p.updated = now();
      if (name && !p.renamed) p.name = name;
      saveIndex(xs);
      return write(BODY(id), text);
    },
    rename(id, name) {
      const xs = index();
      const p = xs.find((x) => x.id === id);
      if (!p) return;
      p.name = name; p.renamed = true; p.updated = now();
      saveIndex(xs);
    },
    duplicate(id) {
      const src = store.get(id);
      if (!src) return null;
      return store.create(`${src.name} (copy)`, src.text);
    },
    remove(id) {
      saveIndex(index().filter((p) => p.id !== id));
      del(BODY(id));
      if (read(CURRENT) === id) del(CURRENT);
    },
    current() { const id = read(CURRENT); return id && index().some((p) => p.id === id) ? id : null; },
    setCurrent(id) { write(CURRENT, id); },
    /** Move the single-script autosave from older versions into a project (once). */
    migrateLegacy(nameOf = () => 'My film') {
      const old = read(LEGACY);
      if (old == null) return null;
      del(LEGACY);
      if (!old.trim()) return null;
      return store.create(nameOf(old), old);
    },
  };
  return store;
}

/** In-memory Storage stand-in (tests, or when localStorage is blocked). */
export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}
