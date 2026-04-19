/**
 * Normalize birthdays hook output to Birthday[] shape.
 *
 * Existing `useBirthdays` returns `{birthdays: [{name, date, …}]}` (worker
 * KV-backed). We add the `giftStatus` field if it's not already present.
 */
export function normalizeBirthdays(hookResult) {
  let list;
  if (Array.isArray(hookResult)) list = hookResult;
  else if (Array.isArray(hookResult?.birthdays)) list = hookResult.birthdays;
  else list = [];
  return list.map((b, i) => ({
    id: b.id || `bd-${i}-${b.name}`,
    name: b.name,
    relation: b.relation,
    date: toMMDD(b.date),
    giftStatus: b.giftStatus ?? "unknown",
    giftNotes: b.giftNotes,
  }));
}

function toMMDD(v) {
  if (!v) return "01-01";
  if (/^\d{2}-\d{2}$/.test(v)) return v;
  // Parse YYYY-MM-DD directly without going through Date() to avoid UTC
  // offsets shifting the day in negative-offset time zones.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (ymd) return `${ymd[2]}-${ymd[3]}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "01-01";
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
