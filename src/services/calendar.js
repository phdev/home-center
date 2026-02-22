function unescapeIcal(str) {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcalDate(str) {
  if (!str) return null;
  // Handle TZID format: DTSTART;TZID=America/New_York:20260222T083000
  const colonIdx = str.lastIndexOf(":");
  const dateStr = colonIdx >= 0 ? str.substring(colonIdx + 1) : str;

  // YYYYMMDD or YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
  const clean = dateStr.replace(/[^0-9TZ]/g, "");
  if (clean.length === 8) {
    return new Date(
      parseInt(clean.slice(0, 4)),
      parseInt(clean.slice(4, 6)) - 1,
      parseInt(clean.slice(6, 8)),
    );
  }
  if (clean.length >= 15) {
    const y = parseInt(clean.slice(0, 4));
    const mo = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    const h = parseInt(clean.slice(9, 11));
    const mi = parseInt(clean.slice(11, 13));
    const s = parseInt(clean.slice(13, 15));
    if (clean.endsWith("Z")) {
      return new Date(Date.UTC(y, mo, d, h, mi, s));
    }
    return new Date(y, mo, d, h, mi, s);
  }
  return new Date(dateStr);
}

function unfoldIcal(text) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

export function parseIcal(icsText) {
  const unfolded = unfoldIcal(icsText);
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let inEvent = false;
  let current = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.summary) {
        events.push({
          summary: unescapeIcal(current.summary),
          start: parseIcalDate(current.dtstart),
          end: parseIcalDate(current.dtend),
          description: current.description
            ? unescapeIcal(current.description)
            : "",
          location: current.location
            ? unescapeIcal(current.location)
            : "",
        });
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.substring(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.substring(colonIdx + 1);

    if (key === "SUMMARY") current.summary = value;
    else if (key === "DTSTART") current.dtstart = line.substring(line.indexOf(":") < line.indexOf(";") && line.indexOf(";") > 0 ? 0 : 0); // keep full for timezone parsing
    else if (key === "DTEND") current.dtend = line;
    else if (key === "DESCRIPTION") current.description = value;
    else if (key === "LOCATION") current.location = value;

    // Re-parse dtstart/dtend with full line for timezone info
    if (key === "DTSTART") current.dtstart = line;
    if (key === "DTEND") current.dtend = line;
  }

  return events;
}

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function formatTime(date) {
  if (!date) return "";
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const EVENT_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFE66D",
  "#6BCB77",
  "#9B59B6",
  "#FF8A5C",
  "#3498DB",
  "#E74C3C",
  "#1ABC9C",
  "#F39C12",
];

export async function fetchCalendarEvents(urls, corsProxy) {
  const today = new Date();
  const allEvents = [];

  for (const url of urls) {
    try {
      const icsUrl = url.replace("webcal://", "https://");
      const proxyUrl = corsProxy
        ? `${corsProxy}${encodeURIComponent(icsUrl)}`
        : icsUrl;
      const res = await fetch(proxyUrl);
      if (!res.ok) continue;
      const text = await res.text();
      const events = parseIcal(text);
      allEvents.push(...events);
    } catch (e) {
      console.warn("Failed to fetch calendar:", url, e);
    }
  }

  const todayEvents = allEvents
    .filter((e) => e.start && isSameDay(e.start, today))
    .sort((a, b) => a.start - b.start)
    .map((e, i) => ({
      time: formatTime(e.start),
      title: e.summary,
      who: e.location || e.description?.slice(0, 30) || "",
      c: EVENT_COLORS[i % EVENT_COLORS.length],
    }));

  return todayEvents;
}
