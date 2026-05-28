export function buildHowieActions(derived, now = new Date()) {
  const SCHOOL_TIEBREAKER_FALLBACK = -Number.MAX_SAFE_INTEGER;
  const GIFT_DAYS_HORIZON = 14;
  const TAKEOUT_CUTOFF_MINUTES = 16.5 * 60;
  const LUNCH_CUTOFF_MINUTES = 18 * 60;
  const CUTOFF_PAST_SCORE = 0.95;
  const CUTOFF_30_MIN_SCORE = 0.8;
  const CUTOFF_90_MIN_SCORE = 0.55;
  const CUTOFF_240_MIN_SCORE = 0.3;
  const CUTOFF_DEFAULT_SCORE = 0.1;

  const actions = [];

  const clamp01 = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  };
  const dateTiebreaker = (value) => {
    if (!value) return SCHOOL_TIEBREAKER_FALLBACK;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? -ts : SCHOOL_TIEBREAKER_FALLBACK;
  };
  const parseActionDate = (value) => {
    if (!value) return null;
    const md = /^(\d{2})-(\d{2})$/.exec(value);
    if (md) {
      let date = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]));
      if (date < startOfDay(now)) date = new Date(now.getFullYear() + 1, Number(md[1]) - 1, Number(md[2]));
      return date;
    }
    const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    const date = new Date(`${ymd ? ymd[1] : value}T00:00:00`);
    return Number.isFinite(date.getTime()) ? date : null;
  };
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysUntilDate = (value) => {
    const date = parseActionDate(value);
    if (!date) return null;
    return Math.floor((startOfDay(date) - startOfDay(now)) / 86_400_000);
  };
  const datedTone = (value, fallbackTone) => {
    const days = daysUntilDate(value);
    if (days == null) return fallbackTone;
    if (days <= 2) return "urgent";
    if (days <= 5) return "warning";
    return fallbackTone;
  };
  const cutoffScore = (minutesToCutoff) => {
    if (minutesToCutoff <= 0) return CUTOFF_PAST_SCORE;
    if (minutesToCutoff <= 30) return CUTOFF_30_MIN_SCORE;
    if (minutesToCutoff <= 90) return CUTOFF_90_MIN_SCORE;
    if (minutesToCutoff <= 240) return CUTOFF_240_MIN_SCORE;
    return CUTOFF_DEFAULT_SCORE;
  };
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const withPriority = (action, urgencyScore, tiebreaker) => {
    actions.push({ ...action, urgencyScore, tiebreaker });
  };
  const formatDate = (value, prefix) => {
    if (!value) return null;
    let date;
    const md = /^(\d{2})-(\d{2})$/.exec(value);
    if (md) {
      date = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]));
      if (date < now) date = new Date(now.getFullYear() + 1, Number(md[1]) - 1, Number(md[2]));
    } else {
      date = new Date(`${value}T00:00:00`);
    }
    if (!Number.isFinite(date.getTime())) return null;
    return `${prefix} ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  for (const item of derived?.rankedSchoolItems ?? []) {
    const tiebreaker = item.dueDate
      ? dateTiebreaker(item.dueDate)
      : item.eventDate
        ? dateTiebreaker(item.eventDate)
        : SCHOOL_TIEBREAKER_FALLBACK;
    withPriority({
      id: `school-${item.id}`,
      kind: item.kind === "event" ? "Event" : "Action",
      tone: datedTone(
        item.dueDate || item.eventDate,
        item.urgency >= 0.7 ? "urgent" : item.kind === "event" ? "event" : "neutral"
      ),
      meta: item.dueLabel || item.dateLabel || formatDate(item.dueDate, "Due") || formatDate(item.eventDate, "Date") || item.child || "School",
      title: item.title,
      detailLabel: item.suggestedAction ? "Suggested action" : null,
      detail: item.suggestedAction || item.summary || item.child || "School update",
    }, clamp01(item.urgency), tiebreaker);
  }

  if (derived?.birthdayGiftNeeded && derived.birthdaysRanked?.length) {
    const birthday = derived.birthdaysRanked.find((item) =>
      item.giftStatus === "needed" || item.giftStatus === "unknown"
    ) ?? derived.birthdaysRanked[0];
    const daysUntil = Math.max(0, Number(birthday.daysUntil) || 0);
    withPriority({
      id: `gift-${birthday.id}`,
      kind: "Gift",
      tone: daysUntil <= 2 ? "urgent" : daysUntil <= 5 ? "warning" : "gift",
      meta: formatDate(birthday.nextDate || birthday.date, "Birthday") || `Birthday in ${birthday.daysUntil} days`,
      title: `Order ${birthday.name}'s gift`,
      detailLabel: "Suggested action",
      detail: "Order birthday present",
    }, Math.max(0, Math.min(1, 1 - daysUntil / GIFT_DAYS_HORIZON)), -daysUntil);
  }

  if (derived?.takeoutDecisionPending) {
    const minutesToCutoff = TAKEOUT_CUTOFF_MINUTES - minutesSinceMidnight;
    withPriority({
      id: "takeout",
      kind: "Dinner",
      tone: "neutral",
      meta: "Tonight",
      title: "Lock in dinner",
      detail: derived.takeoutState?.suggestedVendors?.slice(0, 2).join(" or ") || "Pick a dinner plan.",
    }, cutoffScore(minutesToCutoff), -minutesToCutoff);
  }

  if (derived?.lunchDecisionNeeded) {
    const minutesToCutoff = LUNCH_CUTOFF_MINUTES - minutesSinceMidnight;
    withPriority({
      id: "lunch",
      kind: "Lunch",
      tone: "neutral",
      meta: "Tomorrow",
      title: "Pick tomorrow's lunch",
      detail: derived.lunchContext?.menu?.[0] || "Choose school or home lunch.",
    }, cutoffScore(minutesToCutoff), -minutesToCutoff);
  }

  return actions.length ? actions
    .sort((a, b) => b.urgencyScore - a.urgencyScore || b.tiebreaker - a.tiebreaker)
    .map(({ urgencyScore, tiebreaker, ...action }) => action) : [
    {
      id: "fallback",
      kind: "Ready",
      tone: "neutral",
      meta: "Howie",
      title: "No urgent family actions",
      detail: "Howie will surface the next thing that needs attention.",
    },
  ];
}
