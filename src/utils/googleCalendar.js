// Builds a real, working "Add to Google Calendar" link for a scheduled post.
//
// This is NOT a two-way automatic sync — that would require the user to
// grant OAuth access to their Google account and a server-side integration
// with the Google Calendar API, which is a much bigger project on its own.
// What this does instead: generates Google Calendar's own "quick add event"
// URL (calendar.google.com/calendar/render?action=TEMPLATE&...), prefilled
// with the post's title, scheduled time, and caption. Clicking it opens
// Google Calendar with the event ready to save in one click — no login flow
// or API keys needed, and it works today.
function toGCalDateString(date) {
  // Google's TEMPLATE action wants UTC "basic format": YYYYMMDDTHHMMSSZ
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function googleCalendarLink(item) {
  if (!item?.scheduledAt) return null;
  const start = new Date(item.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30-minute reminder block

  const platformLabel = item.kind === 'landing' ? 'landing page' : item.kind?.toUpperCase();
  const details = [
    `Reminder to publish "${item.title}" on ${platformLabel}.`,
    item.post?.caption ? `\nCaption:\n${item.post.caption}` : '',
  ].join('');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Publish: ${item.title}`,
    dates: `${toGCalDateString(start)}/${toGCalDateString(end)}`,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
