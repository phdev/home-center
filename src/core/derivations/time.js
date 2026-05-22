export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export function atClock(ref, h, m = 0) {
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  return d;
}

export function startOfDay(ref) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(ref) {
  const d = new Date(ref);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(ref, n) {
  const d = new Date(ref);
  d.setDate(d.getDate() + n);
  return d;
}

export function dateKey(ref) {
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, "0");
  const d = String(ref.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isWeekday(ref) {
  const d = ref.getDay();
  return d >= 1 && d <= 5;
}

export function diffHours(toISO, now) {
  return (new Date(toISO).getTime() - now.getTime()) / MS_PER_HOUR;
}

export function daysUntilMMDD(mmdd, now) {
  const [m, d] = String(mmdd ?? "").split("-").map(Number);
  if (!m || !d) return Infinity;
  const y = now.getFullYear();
  let target = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (target < startOfDay(now)) target = new Date(y + 1, m - 1, d);
  return Math.round((target - startOfDay(now)) / MS_PER_DAY);
}

export function isSameDate(a, b) {
  return dateKey(a) === dateKey(b);
}
