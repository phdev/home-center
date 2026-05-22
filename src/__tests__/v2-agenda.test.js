import { describe, expect, it } from "vitest";
import { buildAgenda, shouldShowWeekdayMorningTasks } from "../App";

describe("buildAgenda", () => {
  it("groups calendar events into the next 7 dashboard days", () => {
    const now = new Date("2026-05-18T09:00:00-07:00");
    const agenda = buildAgenda([
      { id: "today", title: "Today event", start: "2026-05-18T16:30:00-07:00" },
      { id: "today-2", title: "Second today event", start: "2026-05-18T17:00:00-07:00" },
      { id: "today-3", title: "Third today event", start: "2026-05-18T18:00:00-07:00" },
      { id: "today-4", title: "Fourth today event", start: "2026-05-18T19:00:00-07:00" },
      { id: "tomorrow", title: "Tomorrow event", start: "2026-05-19T08:15:00-07:00" },
      { id: "wednesday", title: "Wednesday event", start: "2026-05-20T17:45:00-07:00" },
      { id: "thursday", title: "Thursday event", start: "2026-05-21T09:00:00-07:00" },
      { id: "sunday", title: "Sunday event", start: "2026-05-24T09:00:00-07:00" },
      { id: "too-late", title: "Too late", start: "2026-05-25T09:00:00-07:00" },
    ], now);

    expect(agenda.days.map((day) => day.title)).toEqual([
      "Today",
      "Tomorrow",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(agenda.days.flatMap((day) => day.items.map((item) => item.title))).toEqual([
      "Today event",
      "Second today event",
      "Third today event",
      "Fourth today event",
      "Tomorrow event",
      "Wednesday event",
      "Thursday event",
      "Sunday event",
    ]);
  });

  it("keeps every day section even when a remaining day has no events", () => {
    const now = new Date("2026-05-18T09:00:00-07:00");
    const agenda = buildAgenda([
      { id: "today", title: "Today event", start: "2026-05-18T16:30:00-07:00" },
    ], now);

    expect(agenda.days.map((day) => day.title)).toEqual([
      "Today",
      "Tomorrow",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(agenda.days.map((day) => day.items.length)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });
});

describe("shouldShowWeekdayMorningTasks", () => {
  it("shows the school-runway list from 7:50 through 8:29 on weekdays", () => {
    expect(shouldShowWeekdayMorningTasks(new Date("2026-05-21T07:49:59-07:00"))).toBe(false);
    expect(shouldShowWeekdayMorningTasks(new Date("2026-05-21T07:50:00-07:00"))).toBe(true);
    expect(shouldShowWeekdayMorningTasks(new Date("2026-05-21T08:29:59-07:00"))).toBe(true);
    expect(shouldShowWeekdayMorningTasks(new Date("2026-05-21T08:30:00-07:00"))).toBe(false);
  });

  it("stays hidden on weekends", () => {
    expect(shouldShowWeekdayMorningTasks(new Date("2026-05-23T08:00:00-07:00"))).toBe(false);
  });
});
