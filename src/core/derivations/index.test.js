import { describe, expect, it } from "vitest";
import {
  bedtimeReminderActive,
  birthdayNeedsGift,
  computeDerivedState,
  emptyRawState,
  hasMorningConflict,
  hasSchoolEventUpcoming,
  hasWorkConflictForPeter,
  needsSchoolActionToday,
  takeoutUndecided,
  tomorrowNeedsPrep,
  wakeLogStatus,
} from "./index";

function at(y, m, d, h, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function iso(date) {
  return date.toISOString();
}

function raw(patch = {}) {
  return { ...emptyRawState(), ...patch };
}

function event(id, start, end, extras = {}) {
  return {
    id,
    title: id,
    start: iso(start),
    end: iso(end),
    allDay: false,
    attendees: [],
    status: "accepted",
    ...extras,
  };
}

const PETER = { isPeter: true, email: "peter@howell.com" };

describe("core derivations", () => {
  it("hasMorningConflict detects overlapping morning events", () => {
    const now = at(2026, 4, 23, 7);
    const result = hasMorningConflict(
      raw({
        calendar: {
          events: [
            event("dropoff", at(2026, 4, 23, 8, 15), at(2026, 4, 23, 8, 45)),
            event("standup", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9)),
          ],
        },
      }),
      { now, user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.conflicts[0].a.id).toBe("dropoff");
  });

  it("hasWorkConflictForPeter flags a weekday 8-9 event for Peter", () => {
    const now = at(2026, 4, 23, 7);
    const result = hasWorkConflictForPeter(
      raw({
        calendar: {
          events: [event("work", at(2026, 4, 23, 8), at(2026, 4, 23, 8, 30))],
        },
      }),
      { now, user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.events).toHaveLength(1);
  });

  it("needsSchoolActionToday flags action items due today", () => {
    const now = at(2026, 4, 23, 10);
    const result = needsSchoolActionToday(
      raw({
        schoolItems: [
          {
            id: "waiver",
            kind: "action",
            title: "Sign waiver",
            summary: "Please sign today.",
            dueDate: iso(at(2026, 4, 23, 17)),
            urgency: 0.2,
          },
        ],
      }),
      { now, user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.todayActionItems[0].id).toBe("waiver");
  });

  it("hasSchoolEventUpcoming flags dated events within seven days", () => {
    const now = at(2026, 4, 23, 10);
    const result = hasSchoolEventUpcoming(
      raw({
        schoolItems: [
          {
            id: "book-fair",
            kind: "event",
            title: "Book fair",
            summary: "Library",
            eventDate: "2026-04-27",
            urgency: 0.3,
          },
        ],
      }),
      { now, user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.items[0].id).toBe("book-fair");
  });

  it("takeoutUndecided flags the 16:00-20:00 window after 3+ days since email-confirmed takeout", () => {
    const result = takeoutUndecided(raw({
      takeout: {
        today: {
          decision: null,
          suggestedVendors: ["El Tarasco", "Thai Dishes"],
          recentVendors: [{ name: "Rascals", lastOrderedDate: "2026-05-20", count: 2 }],
        },
      },
    }), {
      now: at(2026, 5, 23, 16),
      user: PETER,
    });

    expect(result.value).toBe(true);
    expect(result.state.suggestedVendors.slice(0, 2)).toEqual(["El Tarasco", "Thai Dishes"]);
    expect(result.state.daysSinceLastOrder).toBe(3);
  });

  it("takeoutUndecided stays hidden before 3 days since last takeout order", () => {
    const result = takeoutUndecided(raw({
      takeout: {
        today: {
          decision: null,
          suggestedVendors: ["El Tarasco"],
          recentVendors: [{ name: "Rascals", lastOrderedDate: "2026-05-22", count: 2 }],
        },
      },
    }), {
      now: at(2026, 5, 23, 17),
      user: PETER,
    });

    expect(result.value).toBe(false);
  });

  it("bedtimeReminderActive flags the lead window", () => {
    const result = bedtimeReminderActive(
      raw({
        bedtime: [
          {
            childId: "emma",
            childName: "Emma",
            weekday: "20:30",
            weekend: "21:00",
            reminderLeadMin: 30,
          },
        ],
      }),
      { now: at(2026, 4, 23, 20, 5), user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.window.minutesUntil).toBe(25);
  });

  it("wakeLogStatus asks for missing girl wake times", () => {
    const result = wakeLogStatus(
      raw({
        bedtime: [
          { childId: "lucy", childName: "Lucy", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 },
          { childId: "livy", childName: "Livy", weekday: "21:00", weekend: "21:30", reminderLeadMin: 30 },
        ],
        wakeTimes: {
          date: "2026-04-23",
          children: { lucy: { wakeAt: "2026-04-23T06:45:00" } },
        },
      }),
      { now: at(2026, 4, 23, 10), user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.missing.map((child) => child.childId)).toEqual(["livy"]);
    expect(result.children.find((child) => child.childId === "lucy").bedtimeAt).toBe("2026-04-24T03:15:00.000Z");
  });

  it("wake-derived bedtime uses wake time plus 13.5 hours", () => {
    const result = bedtimeReminderActive(
      raw({
        bedtime: [
          { childId: "lucy", childName: "Lucy", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 },
        ],
        wakeTimes: {
          date: "2026-04-23",
          children: { lucy: { wakeAt: "2026-04-23T06:45:00" } },
        },
      }),
      { now: at(2026, 4, 23, 19, 50), user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.window.minutesUntil).toBe(25);
    expect(result.derivedBedtimes[0]).toMatchObject({
      childId: "lucy",
      source: "wake-log",
    });
  });

  it("derived state exposes cleanup one hour before earliest wake-derived bedtime", () => {
    const derived = computeDerivedState(
      raw({
        bedtime: [
          { childId: "lucy", childName: "Lucy", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 },
          { childId: "livy", childName: "Livy", weekday: "21:00", weekend: "21:30", reminderLeadMin: 30 },
        ],
        wakeTimes: {
          date: "2026-04-23",
          children: {
            lucy: { wakeAt: "2026-04-23T06:45:00" },
            livy: { wakeAt: "2026-04-23T07:10:00" },
          },
        },
      }),
      { now: at(2026, 4, 23, 10), user: PETER },
    );

    expect(derived.wakeLogNeeded).toBe(false);
    expect(derived.wakeDerivedBedtimes.map((item) => item.source)).toEqual(["wake-log", "wake-log"]);
    expect(derived.cleanupAt).toBe("2026-04-24T02:15:00.000Z");
  });

  it("birthdayNeedsGift flags upcoming unknown or needed gifts", () => {
    const result = birthdayNeedsGift(
      raw({
        birthdays: [{ id: "mom", name: "Mom", date: "05-01", giftStatus: "unknown" }],
      }),
      { now: at(2026, 4, 23, 10), user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.birthdays[0].daysUntil).toBe(8);
  });

  it("tomorrowNeedsPrep owns the deterministic lunch decision rule", () => {
    const result = tomorrowNeedsPrep(
      raw({
        schoolLunchMenu: [{ date: "2026-04-24", items: ["Pasta"] }],
      }),
      { now: at(2026, 4, 23, 18), user: PETER },
    );

    expect(result.value).toBe(true);
    expect(result.lunchDecisionNeeded).toBe(true);
    expect(result.lunchContext.menu).toEqual(["Pasta"]);
  });
});
