import { useMemo } from "react";
import { useTime } from "../hooks/useTime";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { GlassesIndicator } from "./GlassesIndicator";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Assign stable colors to events based on title hash
const EVENT_COLORS = [
  { text: "#60A5FA", bg: "#3B82F620" },  // blue
  { text: "#A78BFA", bg: "#A78BFA20" },  // purple
  { text: "#4ADE80", bg: "#22C55E20" },  // green
  { text: "#FB923C", bg: "#F9731620" },  // orange
  { text: "#F472B6", bg: "#EC489920" },  // pink
  { text: "#FACC15", bg: "#EAB30820" },  // yellow
  { text: "#2DD4BF", bg: "#14B8A620" },  // teal
  { text: "#FF6B6B", bg: "#EF444420" },  // red
];

function hashColor(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = ((h << 5) - h + title.charCodeAt(i)) | 0;
  return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length];
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const cells = [];
  // Previous month trailing days
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, inMonth: false, date: new Date(year, month - 1, prevDays - i) });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
  }
  // Fill remaining to make 35 or 42 cells
  const target = cells.length > 35 ? 42 : 35;
  let nextDay = 1;
  while (cells.length < target) {
    cells.push({ day: nextDay++, inMonth: false, date: new Date(year, month + 1, nextDay - 1) });
  }
  return cells;
}

function getWeekDates(today) {
  const sun = new Date(today);
  sun.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    return d;
  });
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM

// ─── Top Bar ─────────────────────────────────────────────────────────

function TopBar({ view, onViewChange, onBack, now, handControllerConnected }) {
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dateStr = `${dayNames[now.getDay()]}, ${SHORT_MONTHS[now.getMonth()]} ${now.getDate()}`;
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";

  const tabs = ["monthly", "weekly", "daily"];

  return (
    <div style={{
      width: "100%", height: 70, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 24px", flexShrink: 0,
      borderBottom: "1px solid #FFFFFF30",
    }}>
      {/* Left: back + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={onBack}>
        <ArrowLeft size={30} color="#FFFFFF" />
        <span style={{ fontFamily: F, fontSize: 33, fontWeight: 700, color: "#FFF" }}>Calendar</span>
      </div>

      {/* Center: tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {tabs.map((t) => {
          const active = t === view;
          return (
            <div
              key={t}
              onClick={() => onViewChange(t)}
              style={{
                padding: "8px 18px", borderRadius: 999, cursor: "pointer",
                background: active ? "#FFFFFF" : "transparent",
                border: active ? "none" : "1px solid #FFFFFF50",
                fontFamily: F, fontSize: 18, fontWeight: active ? 600 : 500,
                color: active ? "#000" : "#FFFFFF88",
                textTransform: "capitalize",
              }}
            >
              {t}
            </div>
          );
        })}
      </div>

      {/* Right: glasses + date + clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <GlassesIndicator connected={handControllerConnected} />
        <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>{dateStr}</span>
        <span style={{ fontFamily: M, fontSize: 42, fontWeight: 600, color: "#FFF" }}>
          {h}:{m} {ampm}
        </span>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────

function MiniCalendar({ today, monthGrid }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Header row */}
      <div style={{ display: "flex" }}>
        {DAYS.map((d) => (
          <span key={d} style={{
            flex: 1, textAlign: "center", fontFamily: F, fontSize: 11,
            fontWeight: 600, color: "#FFFFFF44", letterSpacing: 1,
          }}>{d.charAt(0)}</span>
        ))}
      </div>
      {/* Day grid */}
      {Array.from({ length: Math.ceil(monthGrid.length / 7) }, (_, w) => (
        <div key={w} style={{ display: "flex" }}>
          {monthGrid.slice(w * 7, w * 7 + 7).map((cell, i) => {
            const isToday = cell.inMonth && isSameDay(cell.date, today);
            return (
              <span key={i} style={{
                flex: 1, textAlign: "center", fontFamily: M, fontSize: 12,
                fontWeight: isToday ? 700 : 400, padding: "3px 0",
                color: isToday ? "#FFF" : cell.inMonth ? "#FFFFFF88" : "#FFFFFF30",
                background: isToday ? "#FFFFFF20" : "transparent",
                borderRadius: isToday ? 4 : 0,
              }}>{cell.day}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function getWeekRange(today) {
  const sun = new Date(today);
  sun.setDate(today.getDate() - today.getDay());
  const sat = new Date(sun);
  sat.setDate(sun.getDate() + 6);
  const fmt = (d) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
  return fmt(sun) + " – " + fmt(sat);
}

function getWeekNumber(today) {
  const start = new Date(today.getFullYear(), 0, 1);
  const diff = today - start + ((start.getTimezoneOffset() - today.getTimezoneOffset()) * 60000);
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function Sidebar({ today, events, monthGrid, view }) {
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const todayEvents = events.filter((e) => e.start && isSameDay(new Date(e.start), today));
  const weekEvents = useMemo(() => {
    const start = weekDates[0], end = weekDates[6];
    return events.filter((e) => {
      if (!e.start) return false;
      const d = new Date(e.start);
      return d >= start && d <= new Date(end.getTime() + 86400000);
    });
  }, [events, weekDates]);

  const isWeekly = view === "weekly";
  const isDaily = view === "daily";
  const displayEvents = isWeekly ? weekEvents : todayEvents;
  const DAY_NAMES_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  return (
    <div style={{
      width: 350, flexShrink: 0, display: "flex", flexDirection: "column",
      gap: 24, overflow: "hidden",
    }}>
      {/* Date header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {isWeekly ? (
          <>
            <span style={{ fontFamily: F, fontSize: 27, fontWeight: 700, color: "#FFF" }}>
              {getWeekRange(today)}
            </span>
            <span style={{ fontFamily: F, fontSize: 18, color: "#FFFFFF66" }}>
              Week {getWeekNumber(today)}
            </span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: F, fontSize: 27, fontWeight: 700, color: "#FFF" }}>
              {MONTHS[today.getMonth()]} {today.getDate()}
            </span>
            <span style={{ fontFamily: F, fontSize: 18, color: "#FFFFFF66" }}>
              {DAY_NAMES_FULL[today.getDay()]}
            </span>
          </>
        )}
      </div>

      {/* Mini calendar (monthly only) */}
      {!isWeekly && !isDaily && <MiniCalendar today={today} monthGrid={monthGrid} />}

      {/* Events list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CalendarCheck size={21} color="#FFF" />
          <span style={{ fontFamily: F, fontSize: 21, fontWeight: 600, color: "#FFF" }}>
            {isWeekly ? "This Week's Events" : isDaily ? "Today's Schedule" : "Today's Events"}
          </span>
        </div>
        {displayEvents.length === 0 && (
          <span style={{ fontFamily: F, fontSize: 15, color: "#FFFFFF40" }}>
            {isWeekly ? "No events this week" : "No events today"}
          </span>
        )}
        {displayEvents.map((e, i) => {
          const d = e.start ? new Date(e.start) : null;
          const dayPrefix = isWeekly && d ? `${DAYS[d.getDay()].charAt(0)}${DAYS[d.getDay()].slice(1).toLowerCase()} ` : "";
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 5,
              border: "1px solid #FFFFFF30",
            }}>
              <span style={{ fontFamily: M, fontSize: 18, fontWeight: 600, color: "#FFF", flexShrink: 0 }}>
                {dayPrefix}{e.time}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontFamily: F, fontSize: 18, fontWeight: 500, color: "#FFF" }}>{e.title}</span>
                {e.who && (
                  <span style={{ fontFamily: F, fontSize: 15, color: "#FFFFFF66" }}>{e.who}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Monthly Grid ────────────────────────────────────────────────────

function MonthlyGrid({ today, events, monthGrid }) {
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (!e.start) continue;
      const d = new Date(e.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  const weeks = [];
  for (let i = 0; i < monthGrid.length; i += 7) {
    weeks.push(monthGrid.slice(i, i + 7));
  }

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      border: "1px solid #FFFFFF", borderRadius: 8, overflow: "hidden",
    }}>
      {/* Weekday header */}
      <div style={{
        display: "flex", height: 40, background: "#FFFFFF08", flexShrink: 0,
        borderBottom: "1px solid #FFFFFF20",
      }}>
        {DAYS.map((d) => (
          <div key={d} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F, fontSize: 15, fontWeight: 600, color: "#FFFFFF66",
            letterSpacing: 1,
          }}>{d}</div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{
          display: "flex", flex: 1,
          borderBottom: wi < weeks.length - 1 ? "1px solid #FFFFFF20" : "none",
        }}>
          {week.map((cell, di) => {
            const isToday = cell.inMonth && isSameDay(cell.date, today);
            const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            const dayEvents = eventsByDate[key] || [];

            return (
              <div key={di} style={{
                flex: 1, display: "flex", flexDirection: "column", gap: 4,
                padding: 8, minHeight: 0, overflow: "hidden",
                borderRight: di < 6 ? "1px solid #FFFFFF10" : "none",
                background: isToday ? "#FFFFFF10" : "transparent",
              }}>
                <span style={{
                  fontFamily: M, fontSize: 16, fontWeight: 600,
                  color: cell.inMonth ? "#FFF" : "#FFFFFF30",
                }}>{cell.day}</span>
                {dayEvents.slice(0, 3).map((e, ei) => {
                  const c = hashColor(e.title);
                  return (
                    <div key={ei} style={{
                      padding: "2px 5px", borderRadius: 3,
                      background: c.bg, overflow: "hidden",
                      whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}>
                      <span style={{
                        fontFamily: F, fontSize: 11, fontWeight: 500, color: c.text,
                      }}>{e.title}</span>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span style={{ fontFamily: F, fontSize: 10, color: "#FFFFFF44" }}>
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Weekly View ─────────────────────────────────────────────────────

function WeeklyGrid({ today, events }) {
  const weekDates = getWeekDates(today);

  const eventsByDateHour = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (!e.start) continue;
      const d = new Date(e.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const hour = d.getHours();
      const k = `${key}-${hour}`;
      if (!map[k]) map[k] = [];
      map[k].push(e);
    }
    return map;
  }, [events]);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      border: "1px solid #FFFFFF", borderRadius: 8, overflow: "hidden",
    }}>
      {/* Day headers */}
      <div style={{
        display: "flex", height: 60, flexShrink: 0, borderBottom: "1px solid #FFFFFF20",
      }}>
        <div style={{ width: 80, flexShrink: 0, background: "#FFFFFF08" }} />
        {weekDates.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 2,
              background: isToday ? "#FFFFFF10" : "#FFFFFF08",
              borderRight: i < 6 ? "1px solid #FFFFFF10" : "none",
            }}>
              <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF66", letterSpacing: 1 }}>
                {DAYS[d.getDay()]}
              </div>
              <div style={{
                fontFamily: M, fontSize: 20, fontWeight: 600,
                color: isToday ? "#FFF" : "#FFFFFF88",
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Hour rows */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {HOURS.map((hour) => (
          <div key={hour} style={{
            display: "flex", height: 65, borderBottom: "1px solid #FFFFFF10",
          }}>
            <div style={{
              width: 80, flexShrink: 0, display: "flex", alignItems: "flex-start",
              padding: "6px 0 0 0", background: "#FFFFFF08",
              fontFamily: M, fontSize: 15, color: "#FFFFFF44",
            }}>
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
            {weekDates.map((d, di) => {
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${hour}`;
              const cellEvents = eventsByDateHour[key] || [];
              const isToday = isSameDay(d, today);
              return (
                <div key={di} style={{
                  flex: 1, padding: 4, overflow: "hidden",
                  borderRight: di < 6 ? "1px solid #FFFFFF10" : "none",
                  background: isToday ? "#FFFFFF05" : "transparent",
                }}>
                  {cellEvents.map((e, ei) => {
                    const c = hashColor(e.title);
                    return (
                      <div key={ei} style={{
                        padding: "4px 8px", borderRadius: 4, marginBottom: 2,
                        background: c.bg, borderLeft: `3px solid ${c.text}`,
                        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                      }}>
                        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 500, color: c.text }}>{e.title}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily View ──────────────────────────────────────────────────────

function DailyGrid({ today, events }) {
  const todayEvents = useMemo(() => {
    const byHour = {};
    for (const e of events) {
      if (!e.start) continue;
      const d = new Date(e.start);
      if (!isSameDay(d, today)) continue;
      const hour = d.getHours();
      if (!byHour[hour]) byHour[hour] = [];
      byHour[hour].push(e);
    }
    return byHour;
  }, [events, today]);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      border: "1px solid #FFFFFF", borderRadius: 8, overflow: "hidden",
    }}>
      {/* Day header */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "0 20px", height: 50, background: "#FFFFFF08",
        borderBottom: "1px solid #FFFFFF20",
      }}>
        <span style={{ fontFamily: F, fontSize: 20, fontWeight: 600, color: "#FFF" }}>
          {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today.getDay()]},{" "}
          {MONTHS[today.getMonth()]} {today.getDate()}
        </span>
      </div>

      {/* Hour rows */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {HOURS.map((hour) => {
          const hourEvents = todayEvents[hour] || [];
          return (
            <div key={hour} style={{
              display: "flex", minHeight: 70, borderBottom: "1px solid #FFFFFF10",
            }}>
              <div style={{
                width: 100, flexShrink: 0, display: "flex", alignItems: "flex-start",
                padding: "8px 0 0 0", background: "#FFFFFF08",
                fontFamily: M, fontSize: 15, color: "#FFFFFF44",
              }}>
                {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
              </div>
              <div style={{
                flex: 1, padding: 6, display: "flex", flexDirection: "column", gap: 4,
              }}>
                {hourEvents.map((e, ei) => {
                  const c = hashColor(e.title);
                  return (
                    <div key={ei} style={{
                      padding: "8px 12px", borderRadius: 4,
                      background: c.bg, borderLeft: `3px solid ${c.text}`,
                    }}>
                      <div style={{ fontFamily: F, fontSize: 17, fontWeight: 500, color: c.text }}>
                        {e.title}
                      </div>
                      <div style={{ fontFamily: F, fontSize: 14, color: "#FFFFFF66", marginTop: 3 }}>
                        {e.time}{e.who ? ` · ${e.who}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export function FullCalendarPage({ events, loading, view, onViewChange, onBack, handControllerConnected }) {
  const now = useTime();
  const today = new Date(now);

  const monthGrid = useMemo(
    () => getMonthGrid(today.getFullYear(), today.getMonth()),
    [today.getFullYear(), today.getMonth()],
  );

  const safeEvents = events || [];

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#000", display: "flex",
      flexDirection: "column", overflow: "hidden",
      fontFamily: F, color: "#FFF",
    }}>
      <TopBar view={view} onViewChange={onViewChange} onBack={onBack} now={now} handControllerConnected={handControllerConnected} />
      <div style={{
        flex: 1, display: "flex", gap: 16, padding: 16, minHeight: 0,
      }}>
        <Sidebar today={today} events={safeEvents} monthGrid={monthGrid} view={view} />
        {view === "monthly" && <MonthlyGrid today={today} events={safeEvents} monthGrid={monthGrid} />}
        {view === "weekly" && <WeeklyGrid today={today} events={safeEvents} />}
        {view === "daily" && <DailyGrid today={today} events={safeEvents} />}
      </div>
    </div>
  );
}
