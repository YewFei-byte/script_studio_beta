// "It's live" announcements. Publishing happens in several places (the
// publish modal, the landing editor's "Publish changes"); each calls
// announcePublished and AdminPanel shows one dialog with the link.

const EVENT = 'ss-published';

// item: the published item (with its new `link`). republished: true when an
// already-live landing page was updated.
export function announcePublished(item, { republished = false } = {}) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { item, republished } }));
}

export function onPublished(handler) {
  const listener = (e) => handler(e.detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
