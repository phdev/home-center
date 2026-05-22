import { describe, it, expect } from "vitest";
import { normalizeCalendar } from "./calendar";

describe("normalizeCalendar", () => {
  it("returns empty array when hookResult is nullish", () => {
    expect(normalizeCalendar(null)).toEqual([]);
    expect(normalizeCalendar(undefined)).toEqual([]);
    expect(normalizeCalendar({})).toEqual([]);
  });

  it("passes through a well-formed event verbatim", () => {
    const result = normalizeCalendar({
      events: [
        {
          id: "ev1",
          title: "Standup",
          start: "2026-04-20T15:00:00Z",
          end: "2026-04-20T15:30:00Z",
          allDay: false,
          attendees: ["peter@example.com"],
          calendarOwner: "peter",
          status: "accepted",
        },
      ],
    });
    expect(result).toEqual([
      {
        id: "ev1",
        title: "Standup",
        start: "2026-04-20T15:00:00.000Z",
        end: "2026-04-20T15:30:00.000Z",
        allDay: false,
        attendees: ["peter@example.com"],
        calendarOwner: "peter",
        status: "accepted",
      },
    ]);
  });

  it("generates a stable-ish id when the source has none", () => {
    const result = normalizeCalendar({
      events: [{ summary: "x", start: "2026-04-20T15:00:00Z" }],
    });
    expect(result[0].id).toContain("cal-0-2026");
  });

  it("accepts `summary` as a title alias", () => {
    const r = normalizeCalendar({ events: [{ summary: "Dentist", start: "2026-04-20T15:00:00Z", end: "2026-04-20T16:00:00Z" }] });
    expect(r[0].title).toBe("Dentist");
  });

  it("defaults missing status to accepted", () => {
    const r = normalizeCalendar({ events: [{ title: "x", start: "2026-04-20T15:00:00Z" }] });
    expect(r[0].status).toBe("accepted");
  });

  it("coerces Date objects to ISO strings", () => {
    const d = new Date("2026-04-20T15:00:00Z");
    const r = normalizeCalendar({ events: [{ title: "x", start: d, end: d }] });
    expect(r[0].start).toBe("2026-04-20T15:00:00.000Z");
  });

  it("falls back to now for invalid date inputs (non-throwing)", () => {
    const r = normalizeCalendar({ events: [{ title: "x", start: "not-a-date" }] });
    expect(typeof r[0].start).toBe("string");
    expect(r[0].start).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
