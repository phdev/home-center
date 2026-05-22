import {
  dedupeSemantic,
  extractDueDate,
  guessKind,
  guessUrgency,
} from "../../data/schoolHeuristics";

export function normalizeEmailTriageToSchoolUpdates(input, now = new Date()) {
  const sourceItems = Array.isArray(input) ? input : input?.updates ?? input?.items ?? [];
  const normalized = sourceItems
    .map((item, index) => normalizeOneSchoolUpdate(item, index, now))
    .filter(Boolean);
  return dedupeSemantic(normalized);
}

export function normalizeOneSchoolUpdate(item, index = 0, now = new Date()) {
  if (!item) return null;
  const text = `${item.title ?? item.subject ?? ""} ${item.summary ?? ""} ${item.body ?? ""} ${item.rawSnippet ?? item.snippet ?? ""}`;
  const kind = coerceKind(item.kind ?? item.type ?? item.category ?? guessKind(text));
  const urgency = item.urgency != null ? toUnit(item.urgency) : guessUrgency(item).score;
  const extractedDueDate = extractDueDate(text, now)?.toISOString();
  const date = item.date ?? item.dueDate ?? item.eventDate ?? extractedDueDate ?? null;

  return {
    id: item.id || item.emailId || item.sourceEmailId || `school-update-${index}`,
    type: kind === "reminder" ? "info" : kind,
    kind,
    title: item.title ?? item.subject ?? "School update",
    summary: item.summary ?? item.body?.slice(0, 160) ?? item.rawSnippet ?? item.snippet ?? "",
    date,
    dueDate: item.dueDate ?? (kind === "action" ? date : undefined),
    eventDate: item.eventDate ?? (kind === "event" ? date : undefined),
    child: item.child,
    class: item.class,
    teacher: item.teacher,
    location: item.location,
    urgency,
    suggestedAction: item.suggestedAction ?? defaultSuggestedAction(kind, item.title ?? item.subject),
    extractionSource: item.extractionSource ?? (item.classifier === "llm" ? "openclaw" : "regex"),
    rawSnippet: item.rawSnippet ?? item.snippet,
    dismissedAt: item.dismissedAt,
    sourceEmailId: item.sourceEmailId ?? item.emailId ?? item.id ?? "",
  };
}

function coerceKind(kind) {
  if (kind === "action" || kind === "event" || kind === "reminder" || kind === "info") return kind;
  if (typeof kind === "string" && kind.includes("action")) return "action";
  if (typeof kind === "string" && kind.includes("event")) return "event";
  if (typeof kind === "string" && kind.includes("remind")) return "reminder";
  return "info";
}

function toUnit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function defaultSuggestedAction(kind, title) {
  if (kind === "action") return title ? `Handle: ${title}` : "Review and complete this school action.";
  if (kind === "event") return "Check the calendar and add any needed prep.";
  return undefined;
}
