/**
 * Normalize school-updates hook output to SchoolItem[].
 *
 * The hybrid pipeline (email-triage → worker → LLM classification) lives
 * elsewhere. This normalizer just coerces the incoming items into canonical
 * shape. If a field is missing, we fill deterministic defaults so downstream
 * derived-state logic has something safe to run on.
 */
export function normalizeSchoolItems(hookResult) {
  const list = hookResult?.items ?? hookResult?.updates ?? [];
  return list.map((i, idx) => ({
    id: i.id || `school-${idx}`,
    kind: coerceKind(i.kind ?? i.category),
    title: i.title ?? i.subject ?? "School update",
    summary: i.summary ?? (i.body ? i.body.slice(0, 160) : ""),
    dueDate: i.dueDate,
    eventDate: i.eventDate,
    child: i.child,
    class: i.class,
    teacher: i.teacher,
    location: i.location,
    urgency: toUnit(i.urgency ?? guessUrgency(i)),
    extractionSource: i.extractionSource ?? (i.classifier === "llm" ? "openclaw" : "regex"),
    rawSnippet: i.rawSnippet ?? i.snippet,
    dismissedAt: i.dismissedAt,
    sourceEmailId: i.sourceEmailId ?? i.emailId ?? "",
  }));
}

function coerceKind(k) {
  if (k === "action" || k === "event" || k === "reminder" || k === "info") return k;
  if (typeof k === "string" && k.includes("action")) return "action";
  if (typeof k === "string" && k.includes("remind")) return "reminder";
  if (typeof k === "string" && k.includes("event")) return "event";
  return "info";
}

function toUnit(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return Math.min(1, n / 100);
  return Math.max(0, Math.min(1, n));
}

function guessUrgency(i) {
  const s = `${i.title ?? ""} ${i.summary ?? ""} ${i.body ?? ""}`.toLowerCase();
  if (/today|tonight|tomorrow|urgent|asap|reminder:?\s*due/.test(s)) return 0.8;
  if (/due (this )?(week|friday|mon|tue|wed|thu)/.test(s)) return 0.6;
  return 0.3;
}
