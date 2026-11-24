import { useCallback, useEffect, useRef } from 'react';
import { fetchContent, putContentItem, deleteContentItem } from '../utils/contentApi';

// Keeps AdminPanel's in-memory `content` list in sync with the server's
// per-item storage (server/content.js), saving only what actually changed.
//
// - `synced` remembers, per id, the JSON + rev the server last confirmed.
//   Anything in `content` that differs from it gets PUT; anything in
//   `synced` that's gone from `content` gets DELETEd.
// - A PUT carries the rev it was based on. If the row changed on the server
//   since (another device, or the auto-publish scheduler marking it
//   published), the server answers 409 with its copy; we keep the user's
//   edits but take SERVER_OWNED fields from the server, then save again.
// - Every POLL_MS it adopts other devices' changes (including deletes) for
//   items this browser isn't in the middle of saving, then retries anything
//   that still hasn't saved.

const POLL_MS = 15000;

// Written by the server (scheduler / publish) — never let a stale local copy
// overwrite them during a conflict merge.
const SERVER_OWNED = ['status', 'link', 'netlifySiteId', 'autoPublishError', 'autoPublishLastAttempt'];

// Same union-by-id rule the old blob sync used: keep everything from both
// sides; when an id exists on both, the newer updatedAt/createdAt wins.
function mergeById(a, b) {
  const byId = new Map();
  const timeOf = (item) => new Date(item.updatedAt || item.createdAt || 0).getTime() || 0;
  [...a, ...b].forEach((item) => {
    if (!item?.id) return;
    const existing = byId.get(item.id);
    if (!existing || timeOf(item) >= timeOf(existing)) byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

// YouTube drafts hold a real File object that can't be serialized (see
// UploadPostModal.jsx); it's dropped before saving, same as before.
export function serializableItem(item) {
  return item.post?.videoFile ? { ...item, post: { ...item.post, videoFile: undefined } } : item;
}

export function useContentSync(content, setContent, { onSaveError, onSaveOk } = {}) {
  const contentRef = useRef(content);
  contentRef.current = content;
  const ready = useRef(false);
  const synced = useRef(new Map()); // id -> { json, rev }
  const pending = useRef(new Set()); // ids with a request in flight
  const callbacks = useRef({ onSaveError, onSaveOk });
  callbacks.current = { onSaveError, onSaveOk };

  const flush = useCallback(() => {
    if (!ready.current) return;
    const list = contentRef.current;
    const ids = new Set();

    for (const raw of list) {
      if (!raw?.id) continue;
      ids.add(raw.id);
      if (pending.current.has(raw.id)) continue; // re-checked when that request finishes
      const item = serializableItem(raw);
      const json = JSON.stringify(item);
      const known = synced.current.get(raw.id);
      if (known?.json === json) continue;

      pending.current.add(raw.id);
      putContentItem(item, known?.rev)
        .then((result) => {
          if (result.ok) {
            synced.current.set(raw.id, { json, rev: result.rev });
            callbacks.current.onSaveOk?.();
            return;
          }
          const { current } = result;
          if (current.deleted || !current.item) {
            // Deleted on another device while this one still had it.
            synced.current.delete(raw.id);
            setContent((prev) => prev.filter((c) => c.id !== raw.id));
            return;
          }
          synced.current.set(raw.id, { json: JSON.stringify(current.item), rev: current.rev });
          setContent((prev) =>
            prev.map((c) => {
              if (c.id !== raw.id) return c;
              const merged = { ...current.item, ...c };
              for (const k of SERVER_OWNED) {
                if (k in current.item) merged[k] = current.item[k];
                else delete merged[k];
              }
              return merged;
            })
          );
        })
        .catch((err) => callbacks.current.onSaveError?.(err))
        .finally(() => {
          pending.current.delete(raw.id);
          // Edits made while this request was in flight are picked up here.
          queueMicrotask(() => flush());
        });
    }

    for (const id of Array.from(synced.current.keys())) {
      if (ids.has(id) || pending.current.has(id)) continue;
      pending.current.add(id);
      deleteContentItem(id)
        .then(() => synced.current.delete(id))
        .catch((err) => callbacks.current.onSaveError?.(err))
        .finally(() => pending.current.delete(id));
    }
  }, [setContent]);

  // Adopt the server's state for every item this browser has no unsaved
  // change to. `initial` = first load: union with local instead, so a
  // browser with items the server never saw (e.g. offline edits) uploads
  // them rather than losing them.
  const pull = useCallback(
    async (initial) => {
      const server = await fetchContent();
      if (!server) return false;
      const deleted = new Set(server.deletedIds);
      const serverIds = new Set(server.items.map((i) => i.id));

      // Items with an unsaved local change (or a save in flight) keep their
      // local copy AND their old rev, so their next save still goes through
      // the 409 conflict merge instead of overwriting the server's change.
      const dirty = new Set();
      if (!initial) {
        for (const c of contentRef.current) {
          const known = synced.current.get(c.id);
          if (pending.current.has(c.id) || !known || known.json !== JSON.stringify(serializableItem(c))) dirty.add(c.id);
        }
      }

      setContent((prev) => {
        const local = prev.filter((c) => !deleted.has(c.id));
        if (initial) return mergeById(server.items, local);

        const localById = new Map(local.map((c) => [c.id, c]));
        const next = server.items.map((s) => {
          const mine = localById.get(s.id);
          return mine && dirty.has(s.id) ? mine : s;
        });
        // Local items the server doesn't have yet (just created / not saved).
        const newLocal = local.filter((c) => !serverIds.has(c.id) && !synced.current.has(c.id));
        const result = [...newLocal, ...next];
        return JSON.stringify(result) === JSON.stringify(prev) ? prev : result;
      });

      for (const s of server.items) {
        if (!pending.current.has(s.id) && !dirty.has(s.id)) {
          synced.current.set(s.id, { json: JSON.stringify(s), rev: server.revs[s.id] });
        }
      }
      for (const id of deleted) synced.current.delete(id);
      return true;
    },
    [setContent]
  );

  // Initial load, retried by the poll below until the server answers.
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (await pull(true)) {
        if (cancelled) return;
        ready.current = true;
        flush();
      }
    };
    start();
    const id = setInterval(async () => {
      if (!ready.current) return start();
      await pull(false);
      flush();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pull, flush]);

  // Save whatever changed, on every change.
  useEffect(() => {
    flush();
  }, [content, flush]);
}
