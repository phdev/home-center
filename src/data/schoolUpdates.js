/**
 * Normalize school-updates hook output to SchoolItem[].
 *
 * Applies deterministic heuristics (src/data/schoolHeuristics.js) as the
 * baseline — kind + urgency + due date are regex-derived when the upstream
 * classifier didn't supply them. Worker-side LLM classification is free to
 * override any of these.
 */
import {
  guessKind,
  guessUrgency,
  extractDueDate,
} from "./schoolHeuristics";

export function normalizeSchoolItems(hookResult) {
  const list = hookResult?.items ?? hookResult?.updates ?? [];
  const now = new Date();
  return list.map((i, idx) => {
    const text = `${i.title ?? i.subject ?? ""} ${i.summary ?? ""} ${i.body ?? ""}`;
    const kind = i.kind
      ? coerceKind(i.kind)
      : i.category
      ? coerceKind(i.category)
      : guessKind(text);
    const urgency = i.urgency != null ? toUnit(i.urgency) : guessUrgency(i).score;
    const dueDate = i.dueDate ?? extractDueDate(text, now)?.toISOString();
    return {
      id: i.id || `school-${idx}`,
      kind,
      title: i.title ?? i.subject ?? "School update",
      summary: i.summary ?? (i.body ? i.body.slice(0, 160) : ""),
      dueDate,
      eventDate: i.eventDate,
      child: i.child,
      class: i.class,
      teacher: i.teacher,
      location: i.location,
      urgency,
      extractionSource:
        i.extractionSource ?? (i.classifier === "llm" ? "openclaw" : "regex"),
      rawSnippet: i.rawSnippet ?? i.snippet,
      dismissedAt: i.dismissedAt,
      sourceEmailId: i.sourceEmailId ?? i.emailId ?? "",
    };
  });
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
  return Math.max(0, Math.min(1, n));
}
