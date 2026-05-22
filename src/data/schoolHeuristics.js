/**
 * Deterministic heuristics for school email parsing.
 *
 * Everything here is regex / string math — no LLM. The LLM layer (when
 * available) can override these results, but the system MUST produce
 * reasonable output with just these functions (see
 * docs/home_center_decisions_log.md — "OpenClaw is enrichment, not
 * dependency" + "Semantic email interpretation may use OpenClaw").
 */

// ─── Kind classification ─────────────────────────────────────────────────

const ACTION_PATTERNS = [
  /\bplease (sign|return|bring|pay|rsvp|submit|complete)\b/i,
  /\b(sign|bring|rsvp|submit|pay)\b[^.]{0,40}\b(by|before|due)\b/i,
  /\brsvp\b/i,
  /\bplease pay\b/i,
  /\bbring (a |an )/i,
  /\bsign (the |a |and )/i,
];
const EVENT_PATTERNS = [
  /\b(book fair|field trip|picture day|parent-?teacher|conference|assembly|concert|dance|open house|performance)\b/i,
  /\b(spring|fall|winter|summer) (event|fair|fling)\b/i,
];
const REMINDER_PATTERNS = [
  /^\s*reminder\b/i,
  /\bdon'?t forget\b/i,
  /\bfriendly reminder\b/i,
];

/** @returns {'action'|'event'|'reminder'|'info'} */
export function guessKind(text) {
  const s = String(text ?? "");
  if (ACTION_PATTERNS.some((r) => r.test(s))) return "action";
  if (REMINDER_PATTERNS.some((r) => r.test(s))) return "reminder";
  if (EVENT_PATTERNS.some((r) => r.test(s))) return "event";
  return "info";
}

// ─── Urgency ─────────────────────────────────────────────────────────────

const URGENCY_RULES = [
  { pattern: /\b(today|tonight|by end of day)\b/i, score: 0.9, reason: "today" },
  { pattern: /\btomorrow\b/i, score: 0.85, reason: "tomorrow" },
  { pattern: /\burgent\b|\basap\b|\bimmediately\b/i, score: 0.85, reason: "urgent language" },
  { pattern: /\bdue (?:this )?(?:friday|monday|tuesday|wednesday|thursday|sat|sun)\b/i, score: 0.6, reason: "this-week deadline" },
  { pattern: /\bnext week\b/i, score: 0.4, reason: "next week" },
];

/**
 * @param {{title?:string, body?:string, summary?:string}} item
 * @returns {{score:number, reason:string|null}}
 */
export function guessUrgency(item) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.body ?? ""}`;
  let best = { score: 0.3, reason: null };
  for (const r of URGENCY_RULES) {
    if (r.pattern.test(text) && r.score > best.score) {
      best = { score: r.score, reason: r.reason };
    }
  }
  return best;
}

// ─── Due-date extraction ─────────────────────────────────────────────────

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Returns the earliest matching due date from the text, or null.
 * Uses `now` for relative parsing (today / tomorrow / weekday).
 * @param {string} text
 * @param {Date} now
 * @returns {Date|null}
 */
export function extractDueDate(text, now) {
  const s = String(text ?? "").toLowerCase();
  const candidates = [];

  if (/\btoday\b/.test(s)) {
    candidates.push(startOfDay(now));
  }
  if (/\btomorrow\b/.test(s)) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 1);
    candidates.push(d);
  }
  // "due 4/24" or "by 04/24"
  const mdMatch = s.match(/\b(?:due|by|before|deadline)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    const explicitYear = mdMatch[3] ? normalizeYear(mdMatch[3]) : null;
    let year = explicitYear ?? now.getFullYear();
    let d = new Date(year, month - 1, day);
    if (!explicitYear && d < startOfDay(now)) {
      d = new Date(year + 1, month - 1, day);
    }
    if (!Number.isNaN(d.getTime())) candidates.push(d);
  }
  // weekday cue
  const wdMatch = s.match(/\b(?:by|due|turn in by|before)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wdMatch) {
    const target = WEEKDAYS.indexOf(wdMatch[1]);
    const d = startOfDay(now);
    const cur = d.getDay();
    let diff = (target - cur + 7) % 7;
    if (diff === 0) diff = 7; // "by Friday" from Friday = next Friday
    d.setDate(d.getDate() + diff);
    candidates.push(d);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a - b);
  return candidates[0];
}

function startOfDay(ref) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeYear(y) {
  const n = parseInt(y, 10);
  if (n < 100) return 2000 + n;
  return n;
}

// ─── Semantic dedup ──────────────────────────────────────────────────────

/**
 * Collapse items whose titles are near-identical (jaccard >= 0.6 on word sets,
 * ignoring trivial parenthetical qualifiers). Keeps the newest item when a
 * duplicate is found.
 *
 * @template {{id:string,title:string,receivedAt?:string,sourceEmailId?:string}} T
 * @param {T[]} items
 * @returns {T[]}
 */
export function dedupeSemantic(items) {
  const sorted = [...items].sort((a, b) => {
    const ta = a.receivedAt ? Date.parse(a.receivedAt) : 0;
    const tb = b.receivedAt ? Date.parse(b.receivedAt) : 0;
    return tb - ta;
  });
  const kept = [];
  for (const item of sorted) {
    const sig = wordSet(stripParens(item.title));
    const dup = kept.find((k) => jaccard(sig, wordSet(stripParens(k.title))) >= 0.6);
    if (!dup) kept.push(item);
  }
  return kept;
}

function stripParens(s) {
  return String(s ?? "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

function wordSet(s) {
  return new Set(
    String(s ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3), // drop noise words like "of", "a"
  );
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
