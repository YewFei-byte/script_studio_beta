import { useCallback, useEffect, useRef, useState } from 'react';

// Undo/redo for an editor's document. `commit(next, label)` records a step;
// rapid commits with the same `mergeKey` (e.g. dragging a colour picker,
// several edits to the same field) collapse into one step.
//
// Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes, except while typing
// in an input (where the browser's own undo applies).

const LIMIT = 100;
const MERGE_MS = 800;

export function useUndo(initial) {
  const [state, setState] = useState({ past: [], present: initial, future: [] });
  const last = useRef({ key: null, at: 0 });

  const commit = useCallback((next, { label = 'Edit', mergeKey } = {}) => {
    setState((s) => {
      if (next === s.present) return s;
      const now = Date.now();
      const merge = mergeKey && last.current.key === mergeKey && now - last.current.at < MERGE_MS;
      last.current = { key: mergeKey || null, at: now };
      if (merge) return { ...s, present: next, future: [] };
      return { past: [...s.past, { doc: s.present, label }].slice(-LIMIT), present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      last.current = { key: null, at: 0 };
      return { past: s.past.slice(0, -1), present: prev.doc, future: [{ doc: s.present, label: prev.label }, ...s.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      last.current = { key: null, at: 0 };
      return { past: [...s.past, { doc: s.present, label: next.label }], present: next.doc, future: rest };
    });
  }, []);

  // Replace without recording (e.g. adopting a newer server copy).
  const reset = useCallback((doc) => setState({ past: [], present: doc, future: [] }), []);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    doc: state.present,
    commit,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoLabel: state.past[state.past.length - 1]?.label,
    redoLabel: state.future[0]?.label,
  };
}
