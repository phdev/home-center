const PRIORITY_RANK = {
  urgent: 0,
  important: 1,
  ambient: 2,
};

const MAX_VISIBLE_CARDS = 3;

export function runInterventionEngine(derivedState, context = {}) {
  const now = context.now ?? new Date();
  const candidates = [
    bedtimeCard(derivedState, now),
    schoolUpdatesCard(derivedState, now),
    calendarConflictCard(derivedState, now),
    takeoutCard(derivedState, now),
    lunchCard(derivedState, now),
    birthdayGiftCard(derivedState, now),
    morningChecklistCard(derivedState, now),
    clawSuggestionsCard(derivedState, now),
  ].filter(Boolean);

  const deduped = suppressRedundantCards(candidates);
  return deduped
    .sort(compareCards)
    .slice(0, MAX_VISIBLE_CARDS)
    .map(({ _rank, _dedupeKeys, dedupeKeys, rankHint, ...card }) => card);
}

export { MAX_VISIBLE_CARDS };

function calendarConflictCard(derived, now) {
  if (!derived?.hasMorningOverlap && !derived?.peter0800_0900Risk) return null;
  const conflict = derived.conflicts?.[0] ?? null;
  const startsAt = conflict?.at ? new Date(conflict.at) : null;
  const minutesUntil =
    startsAt && startsAt > now ? Math.round((startsAt.getTime() - now.getTime()) / 60_000) : null;
  const soon = minutesUntil != null && minutesUntil <= 15;

  return card({
    id: "calendar-conflict",
    type: "CalendarConflictCard",
    priority: soon ? "important" : "ambient",
    placement: "calendar",
    timeContext: {
      now: now.toISOString(),
      startsAt: startsAt?.toISOString() ?? null,
      minutesUntil,
    },
    reason: soon
      ? "Calendar conflict starts within 15 minutes."
      : "Morning calendar overlap or Peter 8-9 work-block risk.",
    data: {
      conflicts: derived.conflicts ?? [],
      peter0800_0900Risk: !!derived.peter0800_0900Risk,
      workRiskEvents: derived.peter0800_0900Events ?? [],
    },
    agent: {
      feature: "calendarConflict",
      state: {
        conflicts: (derived.conflicts ?? []).map((conflictItem) => ({
          a: { title: conflictItem.a?.title, start: conflictItem.a?.start },
          b: { title: conflictItem.b?.title, start: conflictItem.b?.start },
          at: conflictItem.at,
        })),
        peter0800_0900Risk: !!derived.peter0800_0900Risk,
      },
    },
    dedupeKeys: ["calendar", "schedule", "openEventDetail"],
    rankHint: soon ? 0 : 20,
  });
}

function schoolUpdatesCard(derived, now) {
  const items = derived?.rankedSchoolItems ?? [];
  if (items.length === 0) return null;
  const urgent = !!derived.hasUrgentSchoolItem;
  return card({
    id: "school-updates",
    type: "SchoolUpdatesCard",
    priority: urgent ? "urgent" : "important",
    placement: "main",
    timeContext: { now: now.toISOString() },
    reason: urgent ? "Urgent school item is due soon or high urgency." : "Open school updates need review.",
    data: {
      items: items.slice(0, 5),
      urgent,
      hasAction: !!derived.hasSchoolActionItems,
    },
    agent: {
      feature: "schoolUpdatesSummary",
      state: items.slice(0, 5).map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        summary: item.summary,
        urgency: item.urgency,
        dueDate: item.dueDate,
        eventDate: item.eventDate,
      })),
    },
    dedupeKeys: ["school", "openSchoolItem"],
    rankHint: urgent ? 0 : 4,
  });
}

function takeoutCard(derived, now) {
  if (!derived?.takeoutDecisionPending) return null;
  return card({
    id: "takeout",
    type: "TakeoutCard",
    priority: "important",
    placement: "contextual",
    timeContext: { now: now.toISOString(), deadline: setToday(now, 20).toISOString() },
    reason: "Dinner decision is still unset after the 16:30 reminder cutoff.",
    data: {
      state: derived.takeoutState,
      suggestedVendors: derived.takeoutState?.suggestedVendors ?? [],
    },
    agent: {
      feature: "takeout",
      state: derived.takeoutState,
    },
    dedupeKeys: ["dinner", "setTakeout"],
    rankHint: 2,
  });
}

function lunchCard(derived, now) {
  if (!derived?.lunchDecisionNeeded) return null;
  return card({
    id: "lunch",
    type: "LunchCard",
    priority: "important",
    placement: "contextual",
    timeContext: { now: now.toISOString(), deadline: setToday(now, 22).toISOString() },
    reason: "Tomorrow is a school day and lunch is not set.",
    data: { context: derived.lunchContext },
    agent: {
      feature: "lunch",
      state: derived.lunchContext,
    },
    dedupeKeys: ["tomorrow-prep", "lunch", "setLunch"],
    rankHint: 3,
  });
}

function bedtimeCard(derived, now) {
  if (!derived?.bedtimeReminderActive) return null;
  return card({
    id: "bedtime",
    type: "BedtimeToast",
    priority: "urgent",
    placement: "overlay",
    timeContext: { now: now.toISOString(), bedtimeAt: derived.bedtimeWindow?.bedtimeAt ?? null },
    reason: "A bedtime reminder window is active.",
    data: { window: derived.bedtimeWindow },
    agent: {
      feature: "bedtime",
      state: derived.bedtimeWindow,
    },
    dedupeKeys: ["bedtime", "snoozeBedtime"],
    rankHint: 0,
  });
}

function birthdayGiftCard(derived, now) {
  if (!derived?.birthdayGiftNeeded) return null;
  const birthday = derived.birthdaysRanked?.find(
    (item) => item.giftStatus === "needed" || item.giftStatus === "unknown",
  );
  if (!birthday) return null;
  return card({
    id: `birthday-gift-${birthday.id}`,
    type: "BirthdayGiftCard",
    priority: birthday.daysUntil <= 14 ? "important" : "ambient",
    placement: "main",
    timeContext: { now: now.toISOString(), daysUntil: birthday.daysUntil },
    reason: `${birthday.name} has an upcoming birthday without a handled gift.`,
    data: { birthday },
    agent: {
      feature: "birthdayGiftIdeas",
      state: birthday,
    },
    dedupeKeys: ["birthday", `birthday:${birthday.id}`, "orderGift"],
    rankHint: birthday.daysUntil <= 14 ? 5 : 30,
  });
}

function morningChecklistCard(derived, now) {
  if (!derived?.showMorningChecklist) return null;
  return card({
    id: "morning-checklist",
    type: "MorningChecklistCard",
    priority: "ambient",
    placement: "contextual",
    timeContext: { now: now.toISOString(), deadline: setToday(now, 9).toISOString() },
    reason: "Weekday pre-school checklist window is active.",
    data: { checklist: derived.checklist },
    agent: {
      feature: "morningChecklist",
      state: derived.checklist,
    },
    dedupeKeys: ["morning"],
    rankHint: 10,
  });
}

function clawSuggestionsCard(derived, now) {
  const suggestions = derived?.clawSuggestions ?? [];
  if (suggestions.length === 0) return null;
  return card({
    id: "claw-suggestions",
    type: "ClawSuggestionsCard",
    priority: suggestions.some((suggestion) => suggestion.tier === 1) ? "important" : "ambient",
    placement: "rightColumn",
    timeContext: { now: now.toISOString() },
    reason: "Deterministic state produced cross-card suggestions.",
    data: { suggestions },
    agent: {
      feature: "clawSuggestions",
      state: suggestions.map((suggestion) => ({
        id: suggestion.id,
        tier: suggestion.tier,
        title: suggestion.title,
      })),
    },
    dedupeKeys: suggestions.map((suggestion) => suggestion.actionKind),
    rankHint: 50,
  });
}

function card(input) {
  return {
    ...input,
    shouldDisplay: true,
    _rank: PRIORITY_RANK[input.priority] ?? PRIORITY_RANK.ambient,
    _dedupeKeys: input.dedupeKeys ?? [],
  };
}

function compareCards(a, b) {
  if (a._rank !== b._rank) return a._rank - b._rank;
  if ((a.rankHint ?? 0) !== (b.rankHint ?? 0)) return (a.rankHint ?? 0) - (b.rankHint ?? 0);
  return a.id.localeCompare(b.id);
}

function suppressRedundantCards(cards) {
  const selected = [];
  const seenKeys = new Set();
  for (const candidate of [...cards].sort(compareCards)) {
    const duplicate = candidate._dedupeKeys.some((key) => seenKeys.has(key));
    if (duplicate && candidate.type === "ClawSuggestionsCard") continue;
    selected.push(candidate);
    for (const key of candidate._dedupeKeys) seenKeys.add(key);
  }
  return selected;
}

function setToday(now, h, m = 0) {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}
