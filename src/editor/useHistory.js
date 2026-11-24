import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchData, saveData } from '../utils/dataApi';

// Saved checkpoints of a landing page or post ("History" in the editors):
// created, every AI change, publish, restore, and editing sessions. Unlike
// undo (this session only), history is saved and shared, so anyone on the
// team can go back to an earlier version.
//
// Stored under an app_data key such as `lpHistory:<itemId>` (not inside the
// item, which autosaves on every keystroke). Each entry's `page` is the
// saved state: the landing page, or a post's { design, caption }.

const MAX_ENTRIES = 40;
const SESSION_MS = 3 * 60 * 1000; // an editing session becomes a checkpoint after 3 minutes

const hashOf = (page) => {
  const s = JSON.stringify(page || {});
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
};

export function useHistory(key, { page, userName }) {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const entriesRef = useRef([]);
  const lastHash = useRef(null);
  const pageRef = useRef(page);
  pageRef.current = page;

  const persist = useCallback((list) => {
    entriesRef.current = list;
    setEntries(list);
    saveData(key, list).catch(() => {});
  }, [key]);

  const checkpoint = useCallback((label, snapshot = pageRef.current) => {
    const hash = hashOf(snapshot);
    const entry = { id: `${Date.now()}`, at: new Date().toISOString(), label, by: userName || '', hash, page: snapshot };
    lastHash.current = hash;
    persist([entry, ...entriesRef.current].slice(0, MAX_ENTRIES));
  }, [persist, userName]);

  // Load; a page with no history yet gets its starting point recorded.
  useEffect(() => {
    let cancelled = false;
    fetchData(key).then((value) => {
      if (cancelled) return;
      const list = Array.isArray(value) ? value : [];
      entriesRef.current = list;
      setEntries(list);
      setLoaded(true);
      lastHash.current = list[0]?.hash || null;
      if (!list.length) checkpoint('Created');
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Manual edits become an "Edits" checkpoint every few minutes, and when
  // the editor closes.
  const flushEdits = useCallback(() => {
    if (!loaded) return;
    if (hashOf(pageRef.current) !== lastHash.current) checkpoint('Edits');
  }, [checkpoint, loaded]);

  useEffect(() => {
    const id = setInterval(flushEdits, SESSION_MS);
    return () => clearInterval(id);
  }, [flushEdits]);

  return { entries, loaded, checkpoint, flushEdits };
}
