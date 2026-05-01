import {
  MS_PER_DAY,
  addDays,
  atClock,
  dateKey,
  daysUntilMMDD,
  diffHours,
  endOfDay,
  isSameDate,
  isWeekday,
  startOfDay,
} from "./time.js";

const VENDOR_ROTATION = [
  "Mickey's Deli",
  "Rascals",
  "Chipotle",
  "In-N-Out",
  "Sushi",
  "Chicken Maison",
  "California Chicken Cafe",
];

/**
 * @param {import('../../state/types').RawState} rawData
 * @param {import('../../state/types').DerivedContext} context
 */
export function hasMorningConflict(rawData, context) {
  const events = rawData.calendar?.events ?? [];
  const dayStart = startOfDay(context.now);
  const noon = atClock(context.now, 12);
  const morning = events
    .filter((event) => !event.allDay && event.status !== "declined")
    .filter((event) => {
      const start = new Date(event.start);
      return start >= dayStart && start < noon;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const conflicts = [];
  for (let i = 0; i < morning.length; i++) {
    for (let j = i + 1; j < morning.length; j++) {
      const a = morning[i];
      const b = morning[j];
      if (new Date(a.end) > new Date(b.start)) {
        conflicts.push({ a, b, eventA: a, eventB: b, at: b.start });
      }
    }
  }

  return { value: conflicts.length > 0, conflicts };
}

/**
 * Peter's protected weekday work block is 08:00-09:00 local time.
 *
 * @param {import('../../state/types').RawState} rawData
 * @param {import('../../state/types').DerivedContext} context
 */
export function hasWorkConflictForPeter(rawData, context) {
  if (!isWeekday(context.now)) return { value: false, events: [] };

  const events = rawData.calendar?.events ?? [];
  const lo = atClock(context.now, 8);
  const hi = atClock(context.now, 9);
  const peterEmail = context.user?.email?.toLowerCase();

  const matches = events.filter((event) => {
    if (event.status === "declined") return false;
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (!(start < hi && end > lo)) return false;
    if (event.calendarOwner === "peter" || event.calendarOwner === "howell-family") {
      return true;
    }
    if (
      peterEmail &&
      event.attendees?.some((attendee) => attendee.toLowerCase() === peterEmail)
    ) {
      return true;
    }
    return !!context.user?.isPeter && (!event.attendees || event.attendees.length === 0);
  });

  return { value: matches.length > 0, events: matches };
}

/**
 * Open school actions that need attention today. This is stricter than
 * "has any action item"; distant non-urgent actions stay ranked but do not
 * become today's action flag.
 *
 * @param {import('../../state/types').RawState} rawData
 * @param {import('../../state/types').DerivedContext} context
 */
export function needsSchoolActionToday(rawData, context) {
  const live = (rawData.schoolItems ?? []).filter((item) => !item.dismissedAt);
  const actionItems = live.filter((item) => item.kind === "action");
  const todayEnd = endOfDay(context.now);
  const urgentItems = live.filter((item) => isUrgentSchoolItem(item, context.now));
  const todayActionItems = actionItems.filter((item) => {
    if (item.urgency >= 0.7) return true;
    if (!item.dueDate) return false;
    const due = new Date(item.dueDate);
    return Number.isFinite(due.getTime()) && due <= todayEnd;
  });

  return {
    value: todayActionItems.length > 0,
    actionItems,
    todayActionItems,
    urgentItems,
    rankedItems: rankSchoolItems(live, context.now),
  };
}

/**
 * Upcoming dated school events in the next seven days.
 *
 * @param {import('../../state/types').RawState} rawData
 * @param {import('../../state/types').DerivedContext} context
 */
export function hasSchoolEventUpcoming(rawData, context) {
  const nowStart = startOfDay(context.now);
  const horizon = endOfDay(addDays(context.now, 7));
  const items = (rawData.schoolItems ?? [])
    .filter((item) => !item.dismissedAt && item.kind === "event")
    .filter((item) => {
      const iso = item.eventDate ?? item.dueDate;
      if (!iso) return false;
      const date = new Date(iso);
      return Number.isFinite(date.getTime()) && date >= nowStart && date <= horizon;
    })
    .sort((a, b) => new Date(a.eventDate ?? a.dueDate) - new Date(b.eventDate ?? b.dueDate));

  return { value: items.length > 0, items };
}

/**
 * @param {import('../../state/types').RawState} rawData
 * @param {import('../../state/types').DerivedContext} context
 */
export function takeoutUndecided(rawData, context) {
  const today = rawData.takeout?.today;
  const decision = today?.decision ?? null;
  const cutoff = atClock(context.now, 16, 30);
  const h = context.now.getHours();
  const pending = decision === null && context.now >= cutoff && h < 20;
  const dayIdx = Math.floor(
    (startOfDay(context.now) - startOfDay(new Date(context.now.getFullYear(), 0, 1))) /
      MS_PER_DAY,
  );
  const suggestedVendors = [];
  for (let i = 0; i < 4; i++) {
    suggestedVendors.push(VENDOR_ROTATION[(dayIdx + i) % VENDOR_ROTATION.length]);
  }

  return {
    value: pending,
    state: {
      decision,
      vendor: today?.vendor,
      suggestedVendors,
    },
  };
}

/**
 * @param {import('../../state/types').RawState} rawData
 * @param {import('../../state/types').DerivedContext} context
 */
export function bedtimeReminderActive(rawData, context) {
  const settings = rawData.bedtime ?? [];
  if (settings.length === 0) return { value: false, window: null };

  const dismissedUntil = rawData.settings?.bedtimeDismissedUntil
    ? new Date(rawData.settings.bedtimeDismissedUntil)
    : null;
  if (dismissedUntil && dismissedUntil > context.now) {
    return { value: false, window: null };
  }

  const weekend = !isWeekday(context.now);
  const kidsInRange = [];
  let earliest = null;

  for (const setting of settings) {
    const [h, m] = (weekend ? setting.weekend : setting.weekday).split(":").map(Number);
    const bedtimeAt = atClock(context.now, h, m);
    const lead = Number.isFinite(setting.reminderLeadMin) ? setting.reminderLeadMin : 30;
    const windowStart = new Date(bedtimeAt.getTime() - lead * 60_000);
    if (context.now >= windowStart && context.now < bedtimeAt) {
      kidsInRange.push({ childId: setting.childId, childName: setting.childName });
      if (!earliest || bedtimeAt < earliest) earliest = bedtimeAt;
    }
  }

  if (kidsInRange.length === 0) return { value: false, window: null };
  return {
    value: true,
    window: {
      bedtimeAt: earliest.toISOString(),
      minutesUntil: Math.max(
        0,
        Math.round((earliest.getTime() - context.now.getTime()) / 60_000),
      ),
      kidsInRange,
    },
  };
}

/**
 * @param {import('../../state/types').RawState} rawData
 * @param {import('../../state/types').DerivedContext} context
 */
export function birthdayNeedsGift(rawData, context) {
  const birthdays = (rawData.birthdays ?? [])
    .map((birthday) => ({
      id: birthday.id,
      name: birthday.name,
      daysUntil: daysUntilMMDD(birthday.date, context.now),
      giftStatus: birthday.giftStatus,
    }))
    .filter((birthday) => birthday.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    value: birthdays.some(
      (birthday) =>
        birthday.daysUntil <= 30 &&
        (birthday.giftStatus === "needed" || birthday.giftStatus === "unknown"),
    ),
    birthdays,
  };
}

/**
 * Preparation needed for tomorrow. Today this owns the deterministic lunch
 * decision rule and can absorb other tomorrow-specific prep rules later.
 *
 * @param {import('../../state/types').RawState} rawData
 * @param {import('../../state/types').DerivedContext} context
 */
export function tomorrowNeedsPrep(rawData, context) {
  const tomorrow = addDays(context.now, 1);
  const key = dateKey(tomorrow);
  const menuDay = rawData.schoolLunchMenu?.find((day) => day.date === key);
  const isSchoolDay = isWeekday(tomorrow) && !(menuDay && menuDay.noSchool);
  const decision = rawData.lunchDecisions?.[key];
  const unset =
    !decision ||
    !decision.perChild ||
    Object.values(decision.perChild).some((value) => value === null || value === undefined);
  const h = context.now.getHours();
  const lunchDecisionNeeded = unset && isSchoolDay && h >= 18 && h < 22;
  const schoolItemsForTomorrow = (rawData.schoolItems ?? []).filter((item) => {
    if (item.dismissedAt) return false;
    const iso = item.eventDate ?? item.dueDate;
    if (!iso) return false;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) && isSameDate(d, tomorrow);
  });
  const reasons = [
    ...(lunchDecisionNeeded ? ["lunch"] : []),
    ...schoolItemsForTomorrow.map((item) => `school:${item.id}`),
  ];

  return {
    value: reasons.length > 0,
    lunchDecisionNeeded,
    lunchContext: {
      dateLabel: tomorrow.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      dateISO: key,
      isSchoolDay,
      menu: menuDay?.items ?? [],
    },
    schoolItemsForTomorrow,
    reasons,
  };
}

export function computeDerivedState(rawData, context) {
  const morning = hasMorningConflict(rawData, context);
  const peterWork = hasWorkConflictForPeter(rawData, context);
  const checklist = computeChecklistView(rawData);
  const showChecklist = computeShowMorningChecklist(rawData, context);
  const schoolToday = needsSchoolActionToday(rawData, context);
  const schoolUpcoming = hasSchoolEventUpcoming(rawData, context);
  const birthdays = birthdayNeedsGift(rawData, context);
  const bedtime = bedtimeReminderActive(rawData, context);
  const takeout = takeoutUndecided(rawData, context);
  const tomorrow = tomorrowNeedsPrep(rawData, context);

  const partial = {
    hasMorningConflict: morning.value,
    hasMorningOverlap: morning.value,
    conflicts: morning.conflicts,
    hasWorkConflictForPeter: peterWork.value,
    peter0800_0900Risk: peterWork.value,
    peter0800_0900Events: peterWork.events,
    showMorningChecklist: showChecklist,
    checklist,
    needsSchoolActionToday: schoolToday.value,
    hasSchoolActionItems: schoolToday.actionItems.length > 0,
    hasUrgentSchoolItem: schoolToday.urgentItems.length > 0,
    rankedSchoolItems: schoolToday.rankedItems,
    hasSchoolEventUpcoming: schoolUpcoming.value,
    upcomingSchoolEvents: schoolUpcoming.items,
    birthdaysRanked: birthdays.birthdays,
    birthdayNeedsGift: birthdays.value,
    birthdayGiftNeeded: birthdays.value,
    bedtimeReminderActive: bedtime.value,
    bedtimeWindow: bedtime.window,
    takeoutUndecided: takeout.value,
    takeoutDecisionPending: takeout.value,
    takeoutState: takeout.state,
    tomorrowNeedsPrep: tomorrow.value,
    tomorrowPrepReasons: tomorrow.reasons,
    lunchDecisionNeeded: tomorrow.lunchDecisionNeeded,
    lunchContext: tomorrow.lunchContext,
    showClawSuggestions: false,
    clawSuggestions: [],
    nextMeaningfulTransition: null,
  };

  partial.clawSuggestions = buildClawSuggestions(partial);
  partial.showClawSuggestions = partial.clawSuggestions.length > 0;
  partial.nextMeaningfulTransition = computeNextTransition(partial, context);

  return partial;
}

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
    schoolUpdates: [],
    settings: {},
  };
}

function computeChecklistView(rawData) {
  const weather = rawData.weather?.today;
  const variant = {
    highTempF: weather?.highTempF ?? null,
    needsJacket: (weather?.highTempF ?? 70) < 60,
    hotDay: (weather?.highTempF ?? 70) >= 80,
    rain: (weather?.precipProb ?? 0) >= 0.5,
  };
  const matches = (condition) => {
    if (condition === "always") return true;
    if (condition === "cold") return variant.needsJacket;
    if (condition === "hot") return variant.hotDay;
    if (condition === "rain") return variant.rain;
    return false;
  };

  const items = (rawData.checklist?.items ?? [])
    .filter((item) => matches(item.condition))
    .map((item) => ({
      id: item.id,
      label: item.label,
      done: false,
      conditionReason:
        item.condition === "hot"
          ? "hot today"
          : item.condition === "cold"
            ? "chilly out"
            : item.condition === "rain"
              ? "rain likely"
              : undefined,
    }));

  return { variant, items };
}

function computeShowMorningChecklist(rawData, context) {
  const h = context.now.getHours();
  if (rawData.settings?.forceMorningChecklist) return true;
  return isWeekday(context.now) && h >= 6 && h < 9;
}

function isUrgentSchoolItem(item, now) {
  return (
    (item.dueDate && diffHours(item.dueDate, now) <= 24) ||
    Number(item.urgency ?? 0) >= 0.7
  );
}

function rankSchoolItems(items, now) {
  const tierOf = (item) => {
    if (isUrgentSchoolItem(item, now)) return 0;
    if (item.kind === "action") return 1;
    if (item.kind === "event") return 2;
    if (item.kind === "reminder") return 3;
    return 4;
  };
  return [...items].sort((a, b) => {
    const ta = tierOf(a);
    const tb = tierOf(b);
    if (ta !== tb) return ta - tb;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });
}

function buildClawSuggestions(derived) {
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
    const conflict = derived.conflicts[0];
    out.push({
      id: `conflict-${conflict.a.id}-${conflict.b.id}`,
      tier: 2,
      iconName: "calendar-clock",
      accent: "amber",
      title: "Resolve morning conflict",
      detail: `${conflict.a.title} and ${conflict.b.title} at ${new Date(
        conflict.at,
      ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      actionKind: "openEventDetail",
      targetRef: { eventId: conflict.a.id },
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
    const birthday = derived.birthdaysRanked[0];
    out.push({
      id: `gift-${birthday.id}`,
      tier: 3,
      iconName: "gift",
      accent: "amber",
      title: `Order ${birthday.name}'s gift`,
      detail: `In ${birthday.daysUntil} day${birthday.daysUntil === 1 ? "" : "s"} - no gift logged yet.`,
      actionKind: "orderGift",
      targetRef: { birthdayId: birthday.id },
    });
  }

  return out.sort((a, b) => a.tier - b.tier);
}

function computeNextTransition(derived, context) {
  const candidates = [];
  const add = (date) => date && candidates.push(new Date(date));

  add(startOfDay(addDays(context.now, 1)));

  const cutoff = atClock(context.now, 16, 30);
  if (cutoff > context.now) add(cutoff);

  const lunchPrompt = atClock(context.now, 18);
  if (lunchPrompt > context.now) add(lunchPrompt);

  const morningEnd = atClock(context.now, 9);
  if (morningEnd > context.now) add(morningEnd);

  if (derived.bedtimeWindow) add(derived.bedtimeWindow.bedtimeAt);

  const sorted = candidates
    .filter((date) => date > context.now)
    .sort((a, b) => a - b);
  return sorted[0]?.toISOString() ?? null;
}
