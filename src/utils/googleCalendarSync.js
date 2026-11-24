// Real, automatic Google Calendar sync for scheduled posts/landing pages —
// this is what replaced the old "click this link to add it yourself" flow
// (see the removed googleCalendarLink note in git history / the old
// src/utils/googleCalendar.js). Scheduling a post now creates a real event
// on the connected Google account's primary calendar via server.js's
// /api/calendar/event routes, in addition to (not instead of) the app's own
// in-app calendar view — both places update from the same action.
//
// Every function here is best-effort and silent on failure, on purpose:
// Google Calendar sync is a nice-to-have layered on top of scheduling, not a
// requirement for it. If Google Calendar isn't connected (see the "Google
// Calendar" card on the User Setting page), or a request fails for any
// reason, these just resolve to null/no-op — the post still gets scheduled
// and still shows up in the in-app calendar exactly as before.
import { fetchCredentials } from './credentialsApi';

function toISO(dateInput) {
  const d = new Date(dateInput);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function eventFields(item) {
  const start = toISO(item.scheduledAt);
  if (!start) return null;
  const end = new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString(); // 30-minute block
  const platformLabel = item.kind === 'landing' ? 'landing page' : item.kind?.toUpperCase();
  return {
    title: `Publish: ${item.title}`,
    description: [
      `Reminder to publish "${item.title}" on ${platformLabel}.`,
      item.post?.caption ? `\nCaption:\n${item.post.caption}` : '',
    ].join(''),
    startISO: start,
    endISO: end,
  };
}

// Creates a new Google Calendar event for a just-scheduled item, or — if the
// item already has a `gcalEventId` from an earlier schedule — updates that
// same event's time instead of creating a duplicate. Returns the event id to
// store back on the content item (so a later reschedule/unschedule knows
// which event to touch), or null if nothing happened (not connected, item
// has no valid scheduledAt, or the request failed).
export async function syncCalendarEvent(item) {
  try {
    const creds = await fetchCredentials('gcal');
    if (!creds) return null; // not connected — the in-app calendar already shows this either way
    const fields = eventFields(item);
    if (!fields) return null;
    const isUpdate = !!item.gcalEventId;
    const res = await fetch(isUpdate ? `/api/calendar/event/${item.gcalEventId}` : '/api/calendar/event', {
      method: isUpdate ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.eventId || item.gcalEventId || null;
  } catch {
    return null;
  }
}

// Removes a previously-synced event — called when a scheduled item is
// unscheduled/unpublished, so it doesn't linger on Google Calendar.
export async function deleteCalendarEvent(eventId) {
  if (!eventId) return;
  try {
    await fetch(`/api/calendar/event/${eventId}`, { method: 'DELETE' });
  } catch {
    // best-effort only
  }
}
