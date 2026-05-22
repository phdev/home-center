import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCalendarEvents } from "./calendar";

const originalFetch = global.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe("fetchCalendarEvents", () => {
  it("returns iCal events from today through the next 7 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T09:00:00-07:00"));
    global.fetch = vi.fn(async () => new Response(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Today event
DTSTART:20260518T163000
DTEND:20260518T170000
LOCATION:Kitchen
END:VEVENT
BEGIN:VEVENT
SUMMARY:Tomorrow event
DTSTART:20260519T081500
DTEND:20260519T084500
LOCATION:School
END:VEVENT
BEGIN:VEVENT
SUMMARY:Day after event
DTSTART:20260520T174500
DTEND:20260520T181500
LOCATION:Home
END:VEVENT
BEGIN:VEVENT
SUMMARY:Thursday event
DTSTART:20260521T090000
DTEND:20260521T100000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Sunday event
DTSTART:20260524T090000
DTEND:20260524T100000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Outside window
DTSTART:20260525T090000
DTEND:20260525T100000
END:VEVENT
END:VCALENDAR`));

    const events = await fetchCalendarEvents(["webcal://calendar.test/feed.ics"]);

    expect(events.map((event) => event.title)).toEqual([
      "Today event",
      "Tomorrow event",
      "Day after event",
      "Thursday event",
      "Sunday event",
    ]);
    expect(events[1]).toMatchObject({
      start: "2026-05-19T15:15:00.000Z",
      location: "School",
      who: "School",
    });
  });
});
