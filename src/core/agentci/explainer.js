export function explainCard(run, cardId) {
  const card = (run.cards ?? []).find((item) => item.id === cardId);
  if (!card) return `No card with id "${cardId}" appeared in this run.`;

  const reason = card.reason ?? { triggeredBy: [], suppressedBy: [], priorityReason: "" };
  const triggers = reason.triggeredBy?.length
    ? sentenceList(reason.triggeredBy.map((key) => explainDerivedKey(key, run.derivedState)))
    : "its deterministic trigger information was not recorded";
  const suppressions = reason.suppressedBy?.length
    ? ` It considered suppressions from ${reason.suppressedBy.join(", ")}.`
    : "";

  return `The ${humanType(card.type)} appeared because ${triggers}. It was prioritized as ${card.priority} because ${humanPriorityReason(reason.priorityReason)}.${suppressions}`;
}

export function explainAgentRun(run, agentRunId) {
  const agentRun = (run.agentRuns ?? []).find((item) => item.agentRunId === agentRunId);
  if (!agentRun) return `No agent run with id "${agentRunId}" was recorded in this run.`;

  const purpose = humanPurpose(agentRun.purpose);
  const feature = agentRun.input_snapshot?.feature ?? "unknown OpenClaw feature";
  const produced = explainAgentOutput(agentRun.output_artifacts);
  const card = findRelatedCard(run.cards ?? [], agentRun);
  const cardText = card
    ? `the ${humanType(card.type)} (${card.id})`
    : `cardId ${agentRun.cardId ?? "none"}`;
  const uiEffect = explainAgentUiEffect(card);

  return `AgentRun ${agentRun.agentRunId} enhanced ${cardText} by asking OpenClaw to ${purpose} for ${humanFeature(feature)}. It produced ${produced}. ${uiEffect}`;
}

function humanType(type) {
  return String(type ?? "card")
    .replace(/Card$/, " card")
    .replace(/Toast$/, " toast")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

function humanPurpose(purpose) {
  if (purpose === "summary") return "summarize deterministic context";
  if (purpose === "extraction") return "extract structured presentation fields";
  return "suggest wording or next-step copy";
}

function humanFeature(feature) {
  return String(feature ?? "unknown OpenClaw feature")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function explainAgentOutput(outputArtifacts = {}) {
  const fields = outputArtifacts.fields ?? {};
  const fieldNames = Object.keys(fields).sort();
  const source = outputArtifacts.source ? ` from ${outputArtifacts.source}` : "";
  if (outputArtifacts.error) {
    return `fallback output${source} with error "${outputArtifacts.error}"`;
  }
  if (fieldNames.length === 0) {
    return `no enhancement fields${source}`;
  }
  return `enhancement fields ${sentenceList(fieldNames)}${source}`;
}

function explainAgentUiEffect(card) {
  if (!card) {
    return "No final card in this snapshot references that agent feature, so no UI effect is recorded.";
  }
  return `The card was already selected by the deterministic system; the agent did not influence visibility and did not influence priority.`;
}

function findRelatedCard(cards, agentRun) {
  const cardId = agentRun.cardId ?? agentRun.input_snapshot?.cardId;
  const feature = agentRun.input_snapshot?.feature;
  return cards.find((card) => card.id === cardId || card.agent?.feature === feature);
}

function explainDerivedKey(key, derivedState = {}) {
  const explain = DERIVED_MEANINGS[key];
  if (explain) return explain(derivedState);
  return `the recorded trigger "${key}" has no explanation mapping yet`;
}

const DERIVED_MEANINGS = {
  rankedSchoolItems: (state) => {
    const count = state.rankedSchoolItems?.length ?? 0;
    return count === 1
      ? "there is one school update important enough to rank"
      : `there are ${count} school updates important enough to rank`;
  },
  hasSchoolActionItems: () => "at least one school update requires family action",
  hasUrgentSchoolItem: () => "a school-related task is due soon or marked as urgent",
  needsSchoolActionToday: () => "a school action needs attention today",
  hasSchoolEventUpcoming: () => "a dated school event is coming up soon",
  upcomingSchoolEvents: (state) => {
    const count = state.upcomingSchoolEvents?.length ?? 0;
    return count === 1 ? "one school event is upcoming" : `${count} school events are upcoming`;
  },
  hasMorningOverlap: () => "two or more calendar events overlap this morning",
  hasMorningConflict: () => "the morning calendar has a conflict",
  conflicts: (state) => {
    const count = state.conflicts?.length ?? 0;
    return count === 1 ? "one calendar conflict was found" : `${count} calendar conflicts were found`;
  },
  peter0800_0900Risk: () => "Peter has something scheduled during the weekday 8-9 work block",
  takeoutDecisionPending: () => "tonight's dinner decision has not been made after the reminder cutoff",
  takeoutState: () => "the dinner state still has no final takeout or home-cooking decision",
  lunchDecisionNeeded: () => "tomorrow is a school day and lunch has not been set",
  lunchContext: () => "tomorrow's school lunch context is available",
  bedtimeReminderActive: () => "a bedtime reminder window is currently active",
  bedtimeWindow: () => "one or more children are inside the bedtime reminder window",
  birthdayGiftNeeded: () => "an upcoming birthday still needs a handled gift",
  birthdaysRanked: () => "upcoming birthdays have been ranked by date",
  showMorningChecklist: () => "the weekday morning checklist window is active",
  checklist: () => "the current checklist items were derived from routine and weather inputs",
  showClawSuggestions: () => "deterministic suggestions are available",
  clawSuggestions: () => "one or more deterministic next-action suggestions were produced",
};

function humanPriorityReason(reason) {
  const text = stripTrailingPeriod(reason);
  return PRIORITY_REASON_MEANINGS[text] ?? lowerFirst(text);
}

const PRIORITY_REASON_MEANINGS = {
  "Urgent school item is due soon or high urgency":
    "a school-related task is due soon or has a high urgency score",
  "Open school updates need review":
    "there are school updates that need review",
  "Calendar conflict starts within 15 minutes":
    "a calendar conflict starts within 15 minutes",
  "Morning calendar overlap or Peter 8-9 work-block risk":
    "the morning schedule has an overlap or Peter's work block is at risk",
  "Dinner decision is still unset after the 16:30 reminder cutoff":
    "the dinner decision is still unset after the 16:30 reminder cutoff",
  "Tomorrow is a school day and lunch is not set":
    "tomorrow is a school day and lunch is not set",
  "A bedtime reminder window is active":
    "a bedtime reminder window is active",
  "Weekday pre-school checklist window is active":
    "the weekday pre-school checklist window is active",
  "Deterministic state produced cross-card suggestions":
    "deterministic state produced cross-card suggestions",
};

function sentenceList(items) {
  const unique = [...new Set(items.filter(Boolean))];
  if (unique.length === 0) return "its deterministic trigger information was not recorded";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function lowerFirst(value) {
  const text = String(value ?? "");
  return text ? `${text[0].toLowerCase()}${text.slice(1)}` : "the deterministic priority rule matched";
}

function stripTrailingPeriod(value) {
  return String(value ?? "").replace(/\.+$/, "");
}
