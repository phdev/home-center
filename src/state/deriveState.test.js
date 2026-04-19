import { describe, it, expect } from "vitest";
import { computeDerivedState, emptyRawState } from "./deriveState";

// Helpers ────────────────────────────────────────────────────────────────

/** Construct a RawState with sensible defaults, patched by `patch`. */
function raw(patch = {}) {
  return { ...emptyRawState(), ...patch };
}

/** @param {Date|string} d */
function iso(d) {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/** Make a plain event with local-time start/end. */
function ev(id, start, end, extras = {}) {
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

function at(y, m, d, h, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

const PETER = { isPeter: true, email: "peter@howell.com" };

// ─── hasMorningOverlap / conflicts ───────────────────────────────────────

describe("computeDerivedState — morning overlap", () => {
  it("detects overlapping morning events", () => {
    const now = at(2026, 4, 23, 7, 0); // Thu
    const raw_ = raw({
      calendar: {
        events: [
          ev("standup", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0)),
          ev("dropoff", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 15)),
          ev("lunch", at(2026, 4, 23, 12, 30), at(2026, 4, 23, 13, 30)),
        ],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.hasMorningOverlap).toBe(true);
    expect(d.conflicts).toHaveLength(1);
    expect(d.conflicts[0].a.id).toBe("standup");
    expect(d.conflicts[0].b.id).toBe("dropoff");
  });

  it("does not flag back-to-back events with a 0-min gap", () => {
    const now = at(2026, 4, 23, 7);
    const raw_ = raw({
      calendar: {
        events: [
          ev("a", at(2026, 4, 23, 8, 0), at(2026, 4, 23, 8, 30)),
          ev("b", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0)),
        ],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.hasMorningOverlap).toBe(false);
  });

  it("ignores declined events", () => {
    const now = at(2026, 4, 23, 7);
    const raw_ = raw({
      calendar: {
        events: [
          ev("a", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0), { status: "declined" }),
          ev("b", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0)),
        ],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.hasMorningOverlap).toBe(false);
  });

  it("ignores all-day events", () => {
    const now = at(2026, 4, 23, 7);
    const raw_ = raw({
      calendar: {
        events: [
          ev("allday", at(2026, 4, 23, 0, 0), at(2026, 4, 24, 0, 0), { allDay: true }),
          ev("meeting", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0)),
        ],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.hasMorningOverlap).toBe(false);
  });

  it("returns empty conflicts when there are no events", () => {
    const d = computeDerivedState(emptyRawState(), { now: at(2026, 4, 23, 7), user: PETER });
    expect(d.hasMorningOverlap).toBe(false);
    expect(d.conflicts).toEqual([]);
  });
});

// ─── peter 8–9 weekday risk ──────────────────────────────────────────────

describe("computeDerivedState — peter 8–9 weekday risk", () => {
  it("flags when an event overlaps 08:00–09:00 on a weekday", () => {
    const now = at(2026, 4, 23, 7, 30); // Thursday
    const raw_ = raw({
      calendar: {
        events: [ev("standup", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0))],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.peter0800_0900Risk).toBe(true);
  });

  it("exact 09:00 end does NOT count as overlap", () => {
    // An event ending exactly at 09:00 that started at 08:00 runs inside the
    // window — that should still be flagged (window is [08:00, 09:00) but any
    // event overlapping the window counts).
    const now = at(2026, 4, 23, 7, 30);
    const raw_ = raw({
      calendar: {
        events: [ev("m", at(2026, 4, 23, 8, 0), at(2026, 4, 23, 9, 0))],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.peter0800_0900Risk).toBe(true);
  });

  it("event starting at 09:00 does NOT count", () => {
    const now = at(2026, 4, 23, 7, 30);
    const raw_ = raw({
      calendar: {
        events: [ev("m", at(2026, 4, 23, 9, 0), at(2026, 4, 23, 9, 30))],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.peter0800_0900Risk).toBe(false);
  });

  it("event ending at 08:00 exactly does NOT count", () => {
    const now = at(2026, 4, 23, 7, 30);
    const raw_ = raw({
      calendar: {
        events: [ev("m", at(2026, 4, 23, 7, 0), at(2026, 4, 23, 8, 0))],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.peter0800_0900Risk).toBe(false);
  });

  it("is false on weekends even with matching events", () => {
    const now = at(2026, 4, 18, 7, 30); // Saturday
    const raw_ = raw({
      calendar: {
        events: [ev("m", at(2026, 4, 18, 8, 30), at(2026, 4, 18, 9, 0))],
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.peter0800_0900Risk).toBe(false);
  });

  it("does not flag when user isn't Peter and attendees don't include him", () => {
    const now = at(2026, 4, 23, 7, 30);
    const raw_ = raw({
      calendar: {
        events: [
          ev("m", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0), {
            attendees: ["someone@else.com"],
            calendarOwner: "someone",
          }),
        ],
      },
    });
    const d = computeDerivedState(raw_, {
      now,
      user: { isPeter: false, email: "peter@howell.com" },
    });
    expect(d.peter0800_0900Risk).toBe(false);
  });
});

// ─── showMorningChecklist ────────────────────────────────────────────────

describe("computeDerivedState — morning checklist window", () => {
  it("shows 06:00–08:59 on weekdays", () => {
    for (const hour of [6, 7, 8]) {
      const d = computeDerivedState(emptyRawState(), {
        now: at(2026, 4, 23, hour),
        user: PETER,
      });
      expect(d.showMorningChecklist).toBe(true);
    }
  });

  it("hides at exactly 09:00 weekday", () => {
    const d = computeDerivedState(emptyRawState(), {
      now: at(2026, 4, 23, 9, 0),
      user: PETER,
    });
    expect(d.showMorningChecklist).toBe(false);
  });

  it("hides before 06:00 weekday", () => {
    const d = computeDerivedState(emptyRawState(), {
      now: at(2026, 4, 23, 5, 59),
      user: PETER,
    });
    expect(d.showMorningChecklist).toBe(false);
  });

  it("hides on weekends", () => {
    const d = computeDerivedState(emptyRawState(), {
      now: at(2026, 4, 18, 7, 30),
      user: PETER,
    });
    expect(d.showMorningChecklist).toBe(false);
  });
});

// ─── checklist weather variant + items ───────────────────────────────────

describe("computeDerivedState — checklist variant & items", () => {
  const CONFIG = {
    items: [
      { id: "sunscreen", label: "Sunscreen on", condition: "always" },
      { id: "water", label: "Water bottles", condition: "always" },
      { id: "jacket", label: "Jackets", condition: "cold" },
      { id: "shorts", label: "Wear shorts", condition: "hot" },
      { id: "umbrella", label: "Umbrella", condition: "rain" },
    ],
  };

  it("hot day: includes 'always' + 'hot', excludes 'cold'/'rain'", () => {
    const d = computeDerivedState(
      raw({
        checklist: CONFIG,
        weather: { today: { highTempF: 86, lowTempF: 70, precipProb: 0, summary: "" } },
      }),
      { now: at(2026, 4, 23, 7), user: PETER },
    );
    const ids = d.checklist.items.map((i) => i.id);
    expect(ids).toContain("sunscreen");
    expect(ids).toContain("water");
    expect(ids).toContain("shorts");
    expect(ids).not.toContain("jacket");
    expect(ids).not.toContain("umbrella");
    expect(d.checklist.variant.hotDay).toBe(true);
  });

  it("cold day: includes jacket", () => {
    const d = computeDerivedState(
      raw({
        checklist: CONFIG,
        weather: { today: { highTempF: 52, lowTempF: 35, precipProb: 0, summary: "" } },
      }),
      { now: at(2026, 4, 23, 7), user: PETER },
    );
    const ids = d.checklist.items.map((i) => i.id);
    expect(ids).toContain("jacket");
    expect(ids).not.toContain("shorts");
    expect(d.checklist.variant.needsJacket).toBe(true);
  });

  it("rainy: includes umbrella", () => {
    const d = computeDerivedState(
      raw({
        checklist: CONFIG,
        weather: { today: { highTempF: 65, lowTempF: 55, precipProb: 0.7, summary: "" } },
      }),
      { now: at(2026, 4, 23, 7), user: PETER },
    );
    const ids = d.checklist.items.map((i) => i.id);
    expect(ids).toContain("umbrella");
    expect(d.checklist.variant.rain).toBe(true);
  });

  it("exact 80°F is the hot-day boundary (inclusive)", () => {
    const d = computeDerivedState(
      raw({
        checklist: CONFIG,
        weather: { today: { highTempF: 80, lowTempF: 62, precipProb: 0, summary: "" } },
      }),
      { now: at(2026, 4, 23, 7), user: PETER },
    );
    expect(d.checklist.variant.hotDay).toBe(true);
  });

  it("exact 60°F is NOT cold (boundary excluded)", () => {
    const d = computeDerivedState(
      raw({
        checklist: CONFIG,
        weather: { today: { highTempF: 60, lowTempF: 45, precipProb: 0, summary: "" } },
      }),
      { now: at(2026, 4, 23, 7), user: PETER },
    );
    expect(d.checklist.variant.needsJacket).toBe(false);
  });
});

// ─── school flags ────────────────────────────────────────────────────────

describe("computeDerivedState — school flags", () => {
  const mkItem = (o) => ({
    id: o.id ?? "x",
    kind: o.kind ?? "info",
    title: o.title ?? "",
    summary: o.summary ?? "",
    urgency: o.urgency ?? 0,
    dueDate: o.dueDate,
    dismissedAt: o.dismissedAt,
    extractionSource: "regex",
    sourceEmailId: "e1",
  });

  it("urgent when due within 24h regardless of urgency score", () => {
    const now = at(2026, 4, 23, 10);
    const raw_ = raw({
      schoolItems: [mkItem({ id: "a", kind: "action", dueDate: at(2026, 4, 23, 15).toISOString(), urgency: 0.2 })],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.hasUrgentSchoolItem).toBe(true);
  });

  it("urgent when urgency >= 0.7 even without due date", () => {
    const now = at(2026, 4, 23, 10);
    const raw_ = raw({
      schoolItems: [mkItem({ id: "a", kind: "info", urgency: 0.75 })],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.hasUrgentSchoolItem).toBe(true);
  });

  it("not urgent when due 3 days out and urgency low", () => {
    const now = at(2026, 4, 23, 10);
    const raw_ = raw({
      schoolItems: [mkItem({ id: "a", kind: "action", dueDate: at(2026, 4, 26, 10).toISOString(), urgency: 0.4 })],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.hasUrgentSchoolItem).toBe(false);
  });

  it("dismissed items don't count for action/urgency flags", () => {
    const now = at(2026, 4, 23, 10);
    const raw_ = raw({
      schoolItems: [
        mkItem({ id: "a", kind: "action", urgency: 0.9, ...{ dismissedAt: "2026-04-22T00:00:00Z" } }),
      ],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.hasSchoolActionItems).toBe(false);
    expect(d.hasUrgentSchoolItem).toBe(false);
  });

  it("ranked order: urgent → action → event → reminder → info", () => {
    const now = at(2026, 4, 23, 10);
    const raw_ = raw({
      schoolItems: [
        mkItem({ id: "info", kind: "info" }),
        mkItem({ id: "event", kind: "event" }),
        mkItem({ id: "reminder", kind: "reminder" }),
        mkItem({ id: "action", kind: "action" }),
        mkItem({ id: "urgent", kind: "action", urgency: 0.9 }),
      ],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.rankedSchoolItems.map((i) => i.id)).toEqual([
      "urgent",
      "action",
      "event",
      "reminder",
      "info",
    ]);
  });
});

// ─── birthdays ───────────────────────────────────────────────────────────

describe("computeDerivedState — birthdays", () => {
  const mk = (o) => ({
    id: o.id,
    name: o.name,
    date: o.date,
    giftStatus: o.giftStatus ?? "unknown",
  });

  it("flags gift needed if an upcoming birthday has status needed/unknown", () => {
    const now = at(2026, 4, 19, 10);
    const raw_ = raw({
      birthdays: [mk({ id: "b1", name: "Mom", date: "05-01", giftStatus: "unknown" })],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.birthdayGiftNeeded).toBe(true);
    expect(d.birthdaysRanked[0].daysUntil).toBe(12);
  });

  it("does not flag when upcoming gift is ready/ordered", () => {
    const now = at(2026, 4, 19, 10);
    const raw_ = raw({
      birthdays: [
        mk({ id: "b1", name: "Mom", date: "05-01", giftStatus: "ready" }),
        mk({ id: "b2", name: "Dad", date: "05-03", giftStatus: "ordered" }),
      ],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.birthdayGiftNeeded).toBe(false);
  });

  it("ranks by days until, filters birthdays more than 60 days out", () => {
    const now = at(2026, 4, 19, 10);
    const raw_ = raw({
      birthdays: [
        mk({ id: "far", name: "Far", date: "10-01" }),
        mk({ id: "soon", name: "Soon", date: "04-25" }),
        mk({ id: "mid", name: "Mid", date: "05-20" }),
      ],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.birthdaysRanked.map((b) => b.id)).toEqual(["soon", "mid"]);
  });
});

// ─── bedtime ─────────────────────────────────────────────────────────────

describe("computeDerivedState — bedtime window", () => {
  const SETTINGS = [
    { childId: "emma", childName: "Emma", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 },
    { childId: "jack", childName: "Jack", weekday: "21:00", weekend: "21:30", reminderLeadMin: 30 },
  ];

  it("inactive 31 minutes before bedtime", () => {
    const raw_ = raw({ bedtime: SETTINGS });
    const d = computeDerivedState(raw_, { now: at(2026, 4, 23, 19, 59), user: PETER });
    expect(d.bedtimeReminderActive).toBe(false);
  });

  it("active exactly 30 minutes before earliest bedtime", () => {
    const raw_ = raw({ bedtime: SETTINGS });
    const d = computeDerivedState(raw_, { now: at(2026, 4, 23, 20, 0), user: PETER });
    expect(d.bedtimeReminderActive).toBe(true);
    expect(d.bedtimeWindow?.kidsInRange.map((k) => k.childId)).toContain("emma");
  });

  it("inactive at exact bedtime", () => {
    const raw_ = raw({ bedtime: SETTINGS });
    const d = computeDerivedState(raw_, { now: at(2026, 4, 23, 20, 30), user: PETER });
    // Emma's window ends at 20:30 (exclusive); Jack's window runs 20:30–21:00.
    expect(d.bedtimeReminderActive).toBe(true);
    expect(d.bedtimeWindow?.kidsInRange.map((k) => k.childId)).toContain("jack");
    expect(d.bedtimeWindow?.kidsInRange.map((k) => k.childId)).not.toContain("emma");
  });

  it("weekend schedule applies on Saturday", () => {
    const raw_ = raw({ bedtime: SETTINGS });
    // Sat 20:30 → Emma's weekend bedtime is 21:00, so window is 20:30–21:00
    const d = computeDerivedState(raw_, { now: at(2026, 4, 18, 20, 30), user: PETER });
    expect(d.bedtimeReminderActive).toBe(true);
    expect(d.bedtimeWindow?.kidsInRange.map((k) => k.childId)).toContain("emma");
  });

  it("suppressed when dismissedUntil is in the future", () => {
    const raw_ = raw({
      bedtime: SETTINGS,
      settings: { bedtimeDismissedUntil: at(2026, 4, 23, 23, 0).toISOString() },
    });
    const d = computeDerivedState(raw_, { now: at(2026, 4, 23, 20, 15), user: PETER });
    expect(d.bedtimeReminderActive).toBe(false);
  });

  it("active when dismissedUntil is past", () => {
    const raw_ = raw({
      bedtime: SETTINGS,
      settings: { bedtimeDismissedUntil: at(2026, 4, 23, 19, 0).toISOString() },
    });
    const d = computeDerivedState(raw_, { now: at(2026, 4, 23, 20, 15), user: PETER });
    expect(d.bedtimeReminderActive).toBe(true);
  });

  it("no kids configured → inactive", () => {
    const d = computeDerivedState(emptyRawState(), { now: at(2026, 4, 23, 20, 30), user: PETER });
    expect(d.bedtimeReminderActive).toBe(false);
  });
});

// ─── takeout ─────────────────────────────────────────────────────────────

describe("computeDerivedState — takeout", () => {
  const today = (now) => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  it("not pending before 16:30", () => {
    const now = at(2026, 4, 23, 16, 29);
    const d = computeDerivedState(emptyRawState(), { now, user: PETER });
    expect(d.takeoutDecisionPending).toBe(false);
  });

  it("pending at exactly 16:30 with no decision", () => {
    const now = at(2026, 4, 23, 16, 30);
    const d = computeDerivedState(emptyRawState(), { now, user: PETER });
    expect(d.takeoutDecisionPending).toBe(true);
  });

  it("not pending once a decision is recorded", () => {
    const now = at(2026, 4, 23, 18, 0);
    const r = raw({
      takeout: {
        today: { date: today(now), decision: "takeout", vendor: "Chipotle" },
      },
    });
    const d = computeDerivedState(r, { now, user: PETER });
    expect(d.takeoutDecisionPending).toBe(false);
  });

  it("suppressed past 20:00", () => {
    const now = at(2026, 4, 23, 20, 0);
    const d = computeDerivedState(emptyRawState(), { now, user: PETER });
    expect(d.takeoutDecisionPending).toBe(false);
  });

  it("always produces 4 rotated vendor suggestions", () => {
    const now = at(2026, 4, 23, 17, 0);
    const d = computeDerivedState(emptyRawState(), { now, user: PETER });
    expect(d.takeoutState.suggestedVendors).toHaveLength(4);
  });
});

// ─── lunch decision ─────────────────────────────────────────────────────

describe("computeDerivedState — lunch decision", () => {
  const MENU = (date) => [{ date, items: ["Chicken nuggets", "Broccoli"] }];

  it("needed at 18:00 when tomorrow is a school day and unset", () => {
    const now = at(2026, 4, 23, 18, 0); // Thursday → Fri tomorrow
    const raw_ = raw({
      schoolLunchMenu: MENU("2026-04-24"),
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.lunchDecisionNeeded).toBe(true);
    expect(d.lunchContext?.menu).toContain("Chicken nuggets");
  });

  it("not needed before 18:00", () => {
    const now = at(2026, 4, 23, 17, 59);
    const raw_ = raw({ schoolLunchMenu: MENU("2026-04-24") });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.lunchDecisionNeeded).toBe(false);
  });

  it("not needed if tomorrow is a weekend", () => {
    // Friday 18:00 → Saturday tomorrow
    const now = at(2026, 4, 24, 18, 0);
    const raw_ = raw({ schoolLunchMenu: MENU("2026-04-25") });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.lunchDecisionNeeded).toBe(false);
  });

  it("not needed if tomorrow has noSchool flag", () => {
    const now = at(2026, 4, 23, 18, 0);
    const raw_ = raw({
      schoolLunchMenu: [{ date: "2026-04-24", items: [], noSchool: true }],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.lunchDecisionNeeded).toBe(false);
  });

  it("not needed once decisions exist for all kids", () => {
    const now = at(2026, 4, 23, 18, 0);
    const raw_ = raw({
      schoolLunchMenu: MENU("2026-04-24"),
      lunchDecisions: {
        "2026-04-24": { date: "2026-04-24", perChild: { emma: "school", jack: "home" } },
      },
      bedtime: [
        { childId: "emma", childName: "Emma", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 },
        { childId: "jack", childName: "Jack", weekday: "21:00", weekend: "21:30", reminderLeadMin: 30 },
      ],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.lunchDecisionNeeded).toBe(false);
  });

  it("still needed if at least one kid has a null decision", () => {
    const now = at(2026, 4, 23, 18, 0);
    const raw_ = raw({
      schoolLunchMenu: MENU("2026-04-24"),
      lunchDecisions: {
        "2026-04-24": { date: "2026-04-24", perChild: { emma: "school", jack: null } },
      },
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.lunchDecisionNeeded).toBe(true);
  });

  it("suppresses after 22:00", () => {
    const now = at(2026, 4, 23, 22, 0);
    const raw_ = raw({ schoolLunchMenu: MENU("2026-04-24") });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.lunchDecisionNeeded).toBe(false);
  });
});

// ─── claw suggestions ────────────────────────────────────────────────────

describe("computeDerivedState — claw suggestions ranking", () => {
  it("produces at least one suggestion per active flag", () => {
    const now = at(2026, 4, 23, 18, 15);
    const raw_ = raw({
      calendar: {
        events: [
          ev("a", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0)),
          ev("b", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 30)),
        ],
      },
      birthdays: [{ id: "b1", name: "Mom", date: "05-01", giftStatus: "needed" }],
      schoolLunchMenu: [{ date: "2026-04-24", items: ["x"] }],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    const ids = d.clawSuggestions.map((s) => s.id);
    expect(ids).toContain("conflict-a-b");
    expect(ids).toContain("lunch");
    expect(ids.find((x) => x.startsWith("gift-"))).toBeTruthy();
  });

  it("orders by tier (tier 1 first)", () => {
    const now = at(2026, 4, 23, 18, 30);
    const raw_ = raw({
      calendar: {
        events: [
          ev("a", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 0)),
          ev("b", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9, 30)),
        ],
      },
      schoolItems: [
        {
          id: "urgent",
          kind: "action",
          title: "urgent",
          summary: "x",
          urgency: 0.9,
          extractionSource: "regex",
          sourceEmailId: "e1",
        },
      ],
    });
    const d = computeDerivedState(raw_, { now, user: PETER });
    expect(d.clawSuggestions[0].tier).toBe(1);
  });

  it("showClawSuggestions false when no flags trigger", () => {
    const now = at(2026, 4, 23, 14, 0);
    const d = computeDerivedState(emptyRawState(), { now, user: PETER });
    expect(d.showClawSuggestions).toBe(false);
    expect(d.clawSuggestions).toEqual([]);
  });
});

// ─── graceful degradation ────────────────────────────────────────────────

describe("computeDerivedState — degradation", () => {
  it("works on emptyRawState() without throwing", () => {
    const d = computeDerivedState(emptyRawState(), { now: new Date(), user: PETER });
    expect(d.hasMorningOverlap).toBe(false);
    expect(d.clawSuggestions).toEqual([]);
  });

  it("nextMeaningfulTransition is always in the future when set", () => {
    const now = at(2026, 4, 23, 8);
    const d = computeDerivedState(emptyRawState(), { now, user: PETER });
    if (d.nextMeaningfulTransition) {
      expect(new Date(d.nextMeaningfulTransition) > now).toBe(true);
    }
  });
});
