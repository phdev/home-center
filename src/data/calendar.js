/**
 * Normalize whatever `useCalendar` returns into CalendarEvent[] per
 * src/state/types.js.
 *
 * `useCalendar` currently returns `{events, loading, error, reload}` where
 * each event is `{id?, title, start, end, allDay?, attendees?, calendar?}` —
 * fields vary by source (CalDAV vs iCal vs worker). This normalizer flattens
 * whatever shape is present and fills defaults.
 */

/** @param {any} hookResult */
export function normalizeCalendar(hookResult) {
  const src = hookResult?.events ?? [];
  return src.map((e, i) => ({
    id: e.id || e.uid || `cal-${i}-${e.start}`,
    title: e.title ?? e.summary ?? "(no title)",
    start: toISO(e.start),
    end: toISO(e.end ?? e.start),
    allDay: !!(e.allDay ?? e.all_day ?? false),
    attendees: Array.isArray(e.attendees) ? e.attendees : [],
    calendarOwner: e.calendarOwner ?? e.calendar ?? undefined,
    status: e.status ?? "accepted",
  }));
}

function toISO(v) {
  if (!v) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
