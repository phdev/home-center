/**
 * Pure, testable derivation of DerivedState from RawState + DerivedContext.
 *
 * No React, no clock, no network. Every time comparison uses ctx.now so tests
 * can freeze time.
 *
 * See docs/home_center_derived_states.md for the contract of every flag here.
 */

/** @typedef {import('./types').RawState} RawState */
/** @typedef {import('./types').DerivedContext} DerivedContext */
/** @typedef {import('./types').DerivedState} DerivedState */
/** @typedef {import('./types').CalendarEvent} CalendarEvent */
/** @typedef {import('./types').ClawSuggestion} ClawSuggestion */

const VENDOR_ROTATION = [
  "Mickey's Deli",
  "Rascals",
  "Chipotle",
  "In-N-Out",
  "Sushi",
  "Chicken Maison",
  "California Chicken Cafe",
];

/** Local-timezone helper: a Date at y/m/d h:m of the given reference day. */
function atClock(ref, h, m = 0) {
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  return d;
}

function startOfDay(ref) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(ref, n) {
  const d = new Date(ref);
  d.setDate(d.getDate() + n);
  return d;
}

function dateKey(ref) {
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, "0");
  const d = String(ref.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekday(ref) {
  const d = ref.getDay();
  return d >= 1 && d <= 5;
}

function diffHours(toISO, now) {
  return (new Date(toISO).getTime() - now.getTime()) / (1000 * 60 * 60);
}

function daysUntilMMDD(mmdd, now) {
  const [m, d] = mmdd.split("-").map(Number);
  const y = now.getFullYear();
  let target = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (target < startOfDay(now)) target = new Date(y + 1, m - 1, d);
  const diff = Math.round((target - startOfDay(now)) / 86400000);
  return diff;
}

// ─── Per-flag computations ───────────────────────────────────────────────

function computeConflicts(events, now) {
  const dayStart = startOfDay(now);
  const noon = atClock(now, 12);
  const morning = events
    .filter((e) => !e.allDay && e.status !== "declined")
    .filter((e) => new Date(e.start) >= dayStart && new Date(e.start) < noon)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const conflicts = [];
  for (let i = 0; i < morning.length; i++) {
    for (let j = i + 1; j < morning.length; j++) {
      const a = morning[i];
      const b = morning[j];
      if (new Date(a.end) > new Date(b.start)) {
        conflicts.push({ a, b, at: b.start });
      }
    }
  }
  return conflicts;
}

function computePeter0800_0900(events, ctx) {
  if (!isWeekday(ctx.now)) return false;
  const lo = atClock(ctx.now, 8);
  const hi = atClock(ctx.now, 9);
  const peterEmail = ctx.user.email?.toLowerCase();
  return events
    .filter((e) => e.status !== "declined")
    .some((e) => {
      const s = new Date(e.start);
      const en = new Date(e.end);
      const overlaps = s < hi && en > lo;
      if (!overlaps) return false;
      if (e.calendarOwner === "peter" || e.calendarOwner === "howell-family")
        return true;
      if (peterEmail && e.attendees?.some((a) => a.toLowerCase() === peterEmail))
        return true;
      return ctx.user.isPeter; // if attendees unknown but user is Peter, count it
    });
}

function computeChecklistView(raw, ctx) {
  const w = raw.weather?.today;
  const variant = {
    highTempF: w?.highTempF ?? null,
    needsJacket: (w?.highTempF ?? 70) < 60,
    hotDay: (w?.highTempF ?? 70) >= 80,
    rain: (w?.precipProb ?? 0) >= 0.5,
  };
  const matches = (cond) => {
    if (cond === "always") return true;
    if (cond === "cold") return variant.needsJacket;
    if (cond === "hot") return variant.hotDay;
    if (cond === "rain") return variant.rain;
    return false;
  };
  const items = (raw.checklist?.items ?? [])
    .filter((i) => matches(i.condition))
    .map((i) => ({
      id: i.id,
      label: i.label,
      done: false,
      conditionReason:
        i.condition === "hot"
          ? "hot today"
          : i.condition === "cold"
          ? "chilly out"
          : i.condition === "rain"
          ? "rain likely"
          : undefined,
    }));
  return { variant, items };
}

function computeShowMorningChecklist(ctx) {
  const h = ctx.now.getHours();
  return isWeekday(ctx.now) && h >= 6 && h < 9;
}

function computeSchoolFlags(items, now) {
  const live = items.filter((i) => !i.dismissedAt);
  const hasAction = live.some((i) => i.kind === "action");
  const urgent = live.some(
    (i) =>
      (i.dueDate && diffHours(i.dueDate, now) <= 24) || i.urgency >= 0.7,
  );
  // rank: urgent first, then action, then event, then reminder, then info
  const tierOf = (i) => {
    const isUrgent =
      (i.dueDate && diffHours(i.dueDate, now) <= 24) || i.urgency >= 0.7;
    if (isUrgent) return 0;
    if (i.kind === "action") return 1;
    if (i.kind === "event") return 2;
    if (i.kind === "reminder") return 3;
    return 4;
  };
  const ranked = [...live].sort((a, b) => {
    const ta = tierOf(a);
    const tb = tierOf(b);
    if (ta !== tb) return ta - tb;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });
  return { hasAction, urgent, ranked };
}

function computeBirthdays(list, now) {
  const ranked = list
    .map((b) => ({
      id: b.id,
      name: b.name,
      daysUntil: daysUntilMMDD(b.date, now),
      giftStatus: b.giftStatus,
    }))
    .filter((v) => v.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const needed = ranked.some(
    (v) =>
      v.daysUntil <= 30 && (v.giftStatus === "needed" || v.giftStatus === "unknown"),
  );
  return { ranked, needed };
}

function computeBedtime(settings, raw, ctx) {
  if (!settings || settings.length === 0) return { active: false, window: null };
  const dismissedUntil = raw.settings?.bedtimeDismissedUntil
    ? new Date(raw.settings.bedtimeDismissedUntil)
    : null;
  if (dismissedUntil && dismissedUntil > ctx.now)
    return { active: false, window: null };

  const weekend = !isWeekday(ctx.now);
  const kidsInRange = [];
  let earliest = null;

  for (const s of settings) {
    const [h, m] = (weekend ? s.weekend : s.weekday).split(":").map(Number);
    const bed = atClock(ctx.now, h, m);
    const windowStart = new Date(bed.getTime() - s.reminderLeadMin * 60000);
    if (ctx.now >= windowStart && ctx.now < bed) {
      kidsInRange.push({ childId: s.childId, childName: s.childName });
      if (!earliest || bed < earliest) earliest = bed;
    }
  }
  if (kidsInRange.length === 0) return { active: false, window: null };
  return {
    active: true,
    window: {
      bedtimeAt: earliest.toISOString(),
      minutesUntil: Math.max(
        0,
        Math.round((earliest.getTime() - ctx.now.getTime()) / 60000),
      ),
      kidsInRange,
    },
  };
}

function computeTakeout(raw, ctx) {
  const today = raw.takeout?.today;
  const decision = today?.decision ?? null;
  const cutoff = atClock(ctx.now, 16, 30);
  const h = ctx.now.getHours();
  const pending = decision === null && ctx.now >= cutoff && h < 20;
  // history rotation — simple deterministic seed by day-of-year
  const dayIdx = Math.floor(
    (startOfDay(ctx.now) - startOfDay(new Date(ctx.now.getFullYear(), 0, 1))) /
      86400000,
  );
  const rotated = [];
  for (let i = 0; i < 4; i++) {
    rotated.push(VENDOR_ROTATION[(dayIdx + i) % VENDOR_ROTATION.length]);
  }
  return {
    pending,
    state: {
      decision,
      vendor: today?.vendor,
      suggestedVendors: rotated,
    },
  };
}

function computeLunch(raw, ctx) {
  const tomorrow = addDays(ctx.now, 1);
  const key = dateKey(tomorrow);
  const menuDay = raw.schoolLunchMenu?.find((m) => m.date === key);
  const isSchoolDay =
    isWeekday(tomorrow) && !(menuDay && menuDay.noSchool);
  const decision = raw.lunchDecisions?.[key];
  const unset =
    !decision ||
    !decision.perChild ||
    Object.values(decision.perChild).some((v) => v === null || v === undefined);
  const h = ctx.now.getHours();
  const needed = unset && isSchoolDay && h >= 18 && h < 22;
  const dateLabel = tomorrow.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return {
    needed,
    context: {
      dateLabel,
      dateISO: key,
      isSchoolDay,
      menu: menuDay?.items ?? [],
    },
  };
}

function buildClawSuggestions(derived, raw, ctx) {
  /** @type {ClawSuggestion[]} */
  const out = [];

  if (derived.bedtimeReminderActive && derived.bedtimeWindow) {
    out.push({
      id: "bedtime",
      tier: 1,
      iconName: "moon",
      accent: "blue",
      title: "Start the bedtime routine",
      detail: `Bedtime in ${derived.bedtimeWindow.minutesUntil} min.`,
      actionKind: "snoozeBedtime",
    });
  }

  if (derived.hasUrgentSchoolItem) {
    const item = derived.rankedSchoolItems[0];
    if (item) {
      out.push({
        id: `school-${item.id}`,
        tier: 1,
        iconName: "alert-triangle",
        accent: "red",
        title: item.title,
        detail: item.summary,
        actionKind: "openSchoolItem",
        targetRef: { schoolItemId: item.id },
      });
    }
  }

  if (derived.hasMorningOverlap && derived.conflicts[0]) {
    const c = derived.conflicts[0];
    out.push({
      id: `conflict-${c.a.id}-${c.b.id}`,
      tier: 2,
      iconName: "calendar-clock",
      accent: "amber",
      title: "Resolve morning conflict",
      detail: `${c.a.title} and ${c.b.title} at ${new Date(c.at).toLocaleTimeString(
        [],
        { hour: "numeric", minute: "2-digit" },
      )}`,
      actionKind: "openEventDetail",
      targetRef: { eventId: c.a.id },
    });
  }

  if (derived.takeoutDecisionPending) {
    out.push({
      id: "takeout",
      tier: 2,
      iconName: "utensils",
      accent: "amber",
      title: "Lock in dinner",
      detail: `Suggested: ${derived.takeoutState.suggestedVendors.slice(0, 2).join(", ")}`,
      actionKind: "setTakeout",
    });
  }

  if (derived.lunchDecisionNeeded) {
    out.push({
      id: "lunch",
      tier: 2,
      iconName: "sandwich",
      accent: "amber",
      title: "Pick tomorrow's lunch",
      detail: derived.lunchContext?.menu?.[0]
        ? `School menu: ${derived.lunchContext.menu[0]}`
        : "Tap to choose school or home.",
      actionKind: "setLunch",
    });
  }

  if (derived.birthdayGiftNeeded && derived.birthdaysRanked[0]) {
    const b = derived.birthdaysRanked[0];
    out.push({
      id: `gift-${b.id}`,
      tier: 3,
      iconName: "gift",
      accent: "amber",
      title: `Order ${b.name}'s gift`,
      detail: `In ${b.daysUntil} day${b.daysUntil === 1 ? "" : "s"} — no gift logged yet.`,
      actionKind: "orderGift",
      targetRef: { birthdayId: b.id },
    });
  }

  // deterministic sort: tier asc, stable
  return out.sort((a, b) => a.tier - b.tier);
}

function computeNextTransition(derived, ctx) {
  const candidates = [];
  const add = (d) => d && candidates.push(new Date(d));

  // midnight rollover
  const midnight = startOfDay(addDays(ctx.now, 1));
  add(midnight);

  // 16:30 takeout cutoff (if not yet past)
  const cutoff = atClock(ctx.now, 16, 30);
  if (cutoff > ctx.now) add(cutoff);

  // 18:00 lunch prompt
  const lunchPrompt = atClock(ctx.now, 18);
  if (lunchPrompt > ctx.now) add(lunchPrompt);

  // 9:00 morning checklist end
  const mcEnd = atClock(ctx.now, 9);
  if (mcEnd > ctx.now) add(mcEnd);

  // next bedtime transition
  if (derived.bedtimeWindow)
    add(derived.bedtimeWindow.bedtimeAt);

  const sorted = candidates
    .filter((d) => d > ctx.now)
    .sort((a, b) => a - b);
  return sorted[0]?.toISOString() ?? null;
}

// ─── Entry point ─────────────────────────────────────────────────────────

/**
 * @param {RawState} raw
 * @param {DerivedContext} ctx
 * @returns {DerivedState}
 */
export function computeDerivedState(raw, ctx) {
  const events = raw.calendar?.events ?? [];

  const conflicts = computeConflicts(events, ctx.now);
  const peter0800_0900 = computePeter0800_0900(events, ctx);

  const showChecklist = computeShowMorningChecklist(ctx);
  const checklist = computeChecklistView(raw, ctx);

  const school = computeSchoolFlags(raw.schoolItems ?? [], ctx.now);

  const birthdays = computeBirthdays(raw.birthdays ?? [], ctx.now);

  const bedtime = computeBedtime(raw.bedtime ?? [], raw, ctx);

  const takeout = computeTakeout(raw, ctx);

  const lunch = computeLunch(raw, ctx);

  const partial = {
    hasMorningOverlap: conflicts.length > 0,
    conflicts,
    peter0800_0900Risk: peter0800_0900,
    showMorningChecklist: showChecklist,
    checklist,
    hasSchoolActionItems: school.hasAction,
    hasUrgentSchoolItem: school.urgent,
    rankedSchoolItems: school.ranked,
    birthdaysRanked: birthdays.ranked,
    birthdayGiftNeeded: birthdays.needed,
    bedtimeReminderActive: bedtime.active,
    bedtimeWindow: bedtime.window,
    takeoutDecisionPending: takeout.pending,
    takeoutState: takeout.state,
    lunchDecisionNeeded: lunch.needed,
    lunchContext: lunch.context,
    showClawSuggestions: false,
    clawSuggestions: [],
    nextMeaningfulTransition: null,
  };

  partial.clawSuggestions = buildClawSuggestions(partial, raw, ctx);
  partial.showClawSuggestions = partial.clawSuggestions.length > 0;
  partial.nextMeaningfulTransition = computeNextTransition(partial, ctx);

  return partial;
}

/** @returns {RawState} empty skeleton used as a safe fallback. */
export function emptyRawState() {
  return {
    calendar: { events: [] },
    weather: { today: { highTempF: 70, lowTempF: 55, precipProb: 0, summary: "" } },
    birthdays: [],
    bedtime: [],
    checklist: { items: [] },
    takeout: { today: null },
    lunchDecisions: {},
    schoolLunchMenu: [],
    schoolItems: [],
    settings: {},
  };
}
