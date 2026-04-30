import { describe, expect, it } from "vitest";
import { computeDerivedState, emptyRawState } from "../derivations";
import { MAX_VISIBLE_CARDS, runInterventionEngine } from "./engine";

function at(y, m, d, h, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function event(id, start, end) {
  return {
    id,
    title: id,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    attendees: [],
    status: "accepted",
  };
}

function schoolItem(overrides = {}) {
  return {
    id: overrides.id ?? "school",
    kind: overrides.kind ?? "action",
    title: overrides.title ?? "Sign form",
    summary: overrides.summary ?? "Please sign today.",
    dueDate: overrides.dueDate,
    eventDate: overrides.eventDate,
    urgency: overrides.urgency ?? 0.3,
    extractionSource: "regex",
    sourceEmailId: "email-1",
  };
}

const USER = { isPeter: true, email: "peter@howell.com" };

function derivedForEngine(now) {
  return computeDerivedState(
    {
      ...emptyRawState(),
      calendar: {
        events: [
          event("dropoff", at(2026, 4, 23, 8, 15), at(2026, 4, 23, 8, 45)),
          event("standup", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9)),
        ],
      },
      schoolItems: [
        schoolItem({
          id: "urgent-school",
          dueDate: at(2026, 4, 23, 21).toISOString(),
          urgency: 0.2,
        }),
      ],
      takeout: { today: null },
      schoolLunchMenu: [{ date: "2026-04-24", items: ["Pasta"] }],
      bedtime: [
        {
          childId: "emma",
          childName: "Emma",
          weekday: "20:30",
          weekend: "21:00",
          reminderLeadMin: 30,
        },
      ],
      birthdays: [{ id: "mom", name: "Mom", date: "05-01", giftStatus: "unknown" }],
    },
    { now, user: USER },
  );
}

describe("intervention engine", () => {
  it("returns at most three visible cards", () => {
    const now = at(2026, 4, 23, 20, 10);
    const cards = runInterventionEngine(derivedForEngine(now), { now });

    expect(cards.length).toBeLessThanOrEqual(MAX_VISIBLE_CARDS);
    expect(cards.every((card) => card.shouldDisplay)).toBe(true);
  });

  it("prioritizes urgent before important before ambient", () => {
    const now = at(2026, 4, 23, 20, 10);
    const cards = runInterventionEngine(derivedForEngine(now), { now });

    expect(cards.slice(0, 2).map((card) => card.priority)).toEqual(["urgent", "urgent"]);
    expect(cards[0].type).toBe("BedtimeToast");
    expect(cards[1].type).toBe("SchoolUpdatesCard");
  });

  it("suppresses redundant Claw Suggestions when direct cards already cover the actions", () => {
    const now = at(2026, 4, 23, 17, 0);
    const derived = computeDerivedState(
      {
        ...emptyRawState(),
        calendar: {
          events: [
            event("dropoff", at(2026, 4, 23, 8, 15), at(2026, 4, 23, 8, 45)),
            event("standup", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9)),
          ],
        },
        takeout: { today: null },
      },
      { now, user: USER },
    );
    const cards = runInterventionEngine(derived, { now });

    expect(cards.map((card) => card.type)).toContain("CalendarConflictCard");
    expect(cards.map((card) => card.type)).toContain("TakeoutCard");
    expect(cards.map((card) => card.type)).not.toContain("ClawSuggestionsCard");
  });

  it("snapshots selected card output", () => {
    const now = at(2026, 4, 23, 17, 0);
    const derived = computeDerivedState(
      {
        ...emptyRawState(),
        calendar: {
          events: [
            event("dropoff", at(2026, 4, 23, 8, 15), at(2026, 4, 23, 8, 45)),
            event("standup", at(2026, 4, 23, 8, 30), at(2026, 4, 23, 9)),
          ],
        },
        takeout: { today: null },
      },
      { now, user: USER },
    );

    expect(runInterventionEngine(derived, { now })).toMatchInlineSnapshot(`
      [
        {
          "agent": {
            "feature": "takeout",
            "state": {
              "decision": null,
              "suggestedVendors": [
                "California Chicken Cafe",
                "Mickey's Deli",
                "Rascals",
                "Chipotle",
              ],
              "vendor": undefined,
            },
          },
          "data": {
            "state": {
              "decision": null,
              "suggestedVendors": [
                "California Chicken Cafe",
                "Mickey's Deli",
                "Rascals",
                "Chipotle",
              ],
              "vendor": undefined,
            },
            "suggestedVendors": [
              "California Chicken Cafe",
              "Mickey's Deli",
              "Rascals",
              "Chipotle",
            ],
          },
          "id": "takeout",
          "placement": "contextual",
          "priority": "important",
          "reason": "Dinner decision is still unset after the 16:30 reminder cutoff.",
          "shouldDisplay": true,
          "timeContext": {
            "deadline": "2026-04-24T03:00:00.000Z",
            "now": "2026-04-24T00:00:00.000Z",
          },
          "type": "TakeoutCard",
        },
        {
          "agent": {
            "feature": "calendarConflict",
            "state": {
              "conflicts": [
                {
                  "a": {
                    "start": "2026-04-23T15:15:00.000Z",
                    "title": "dropoff",
                  },
                  "at": "2026-04-23T15:30:00.000Z",
                  "b": {
                    "start": "2026-04-23T15:30:00.000Z",
                    "title": "standup",
                  },
                },
              ],
              "peter0800_0900Risk": true,
            },
          },
          "data": {
            "conflicts": [
              {
                "a": {
                  "allDay": false,
                  "attendees": [],
                  "end": "2026-04-23T15:45:00.000Z",
                  "id": "dropoff",
                  "start": "2026-04-23T15:15:00.000Z",
                  "status": "accepted",
                  "title": "dropoff",
                },
                "at": "2026-04-23T15:30:00.000Z",
                "b": {
                  "allDay": false,
                  "attendees": [],
                  "end": "2026-04-23T16:00:00.000Z",
                  "id": "standup",
                  "start": "2026-04-23T15:30:00.000Z",
                  "status": "accepted",
                  "title": "standup",
                },
                "eventA": {
                  "allDay": false,
                  "attendees": [],
                  "end": "2026-04-23T15:45:00.000Z",
                  "id": "dropoff",
                  "start": "2026-04-23T15:15:00.000Z",
                  "status": "accepted",
                  "title": "dropoff",
                },
                "eventB": {
                  "allDay": false,
                  "attendees": [],
                  "end": "2026-04-23T16:00:00.000Z",
                  "id": "standup",
                  "start": "2026-04-23T15:30:00.000Z",
                  "status": "accepted",
                  "title": "standup",
                },
              },
            ],
            "peter0800_0900Risk": true,
            "workRiskEvents": [
              {
                "allDay": false,
                "attendees": [],
                "end": "2026-04-23T15:45:00.000Z",
                "id": "dropoff",
                "start": "2026-04-23T15:15:00.000Z",
                "status": "accepted",
                "title": "dropoff",
              },
              {
                "allDay": false,
                "attendees": [],
                "end": "2026-04-23T16:00:00.000Z",
                "id": "standup",
                "start": "2026-04-23T15:30:00.000Z",
                "status": "accepted",
                "title": "standup",
              },
            ],
          },
          "id": "calendar-conflict",
          "placement": "calendar",
          "priority": "ambient",
          "reason": "Morning calendar overlap or Peter 8-9 work-block risk.",
          "shouldDisplay": true,
          "timeContext": {
            "minutesUntil": null,
            "now": "2026-04-24T00:00:00.000Z",
            "startsAt": "2026-04-23T15:30:00.000Z",
          },
          "type": "CalendarConflictCard",
        },
      ]
    `);
  });
});
