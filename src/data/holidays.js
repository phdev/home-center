// Static list of US holidays + popular Hallmark dates. Hardcoded ISO dates so
// floating holidays (Memorial Day, Mother's Day, etc.) don't need date math
// at runtime. Extend the list when a new year is needed.

const HOLIDAYS = [
  // 2026
  { date: "2026-05-05", name: "Cinco de Mayo", kind: "cultural" },
  { date: "2026-05-10", name: "Mother's Day", kind: "hallmark" },
  { date: "2026-05-25", name: "Memorial Day", kind: "federal" },
  { date: "2026-06-14", name: "Flag Day", kind: "observance" },
  { date: "2026-06-19", name: "Juneteenth", kind: "federal" },
  { date: "2026-06-21", name: "Father's Day", kind: "hallmark" },
  { date: "2026-07-04", name: "Independence Day", kind: "federal" },
  { date: "2026-09-07", name: "Labor Day", kind: "federal" },
  { date: "2026-10-12", name: "Columbus Day", kind: "federal" },
  { date: "2026-10-31", name: "Halloween", kind: "cultural" },
  { date: "2026-11-11", name: "Veterans Day", kind: "federal" },
  { date: "2026-11-26", name: "Thanksgiving", kind: "federal" },
  { date: "2026-12-24", name: "Christmas Eve", kind: "cultural" },
  { date: "2026-12-25", name: "Christmas Day", kind: "federal" },
  { date: "2026-12-31", name: "New Year's Eve", kind: "cultural" },
  // 2027
  { date: "2027-01-01", name: "New Year's Day", kind: "federal" },
  { date: "2027-01-18", name: "MLK Day", kind: "federal" },
  { date: "2027-02-14", name: "Valentine's Day", kind: "hallmark" },
  { date: "2027-02-15", name: "Presidents' Day", kind: "federal" },
  { date: "2027-03-17", name: "St. Patrick's Day", kind: "cultural" },
  { date: "2027-03-28", name: "Easter Sunday", kind: "cultural" },
  { date: "2027-04-22", name: "Earth Day", kind: "observance" },
];

const KIND_COLORS = {
  federal: "#F59270",
  hallmark: "#EC4899",
  cultural: "#60A5FA",
  observance: "#A78BFA",
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(from, to) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86400000);
}

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function getUpcomingHolidays(now = new Date(), { daysAhead = 60, max = 10 } = {}) {
  const today = startOfDay(now);
  const horizon = startOfDay(new Date(today.getTime() + daysAhead * 86400000));

  return HOLIDAYS
    .map((h) => {
      const [y, m, d] = h.date.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return {
        ...h,
        dateObj: date,
        label: `${SHORT_MONTHS[m - 1]} ${d}`,
        daysUntil: daysBetween(today, date),
        color: KIND_COLORS[h.kind] ?? "#FFFFFF",
      };
    })
    .filter((h) => h.dateObj >= today && h.dateObj <= horizon)
    .sort((a, b) => a.dateObj - b.dateObj)
    .slice(0, max);
}

export const HOLIDAY_KIND_COLORS = KIND_COLORS;
