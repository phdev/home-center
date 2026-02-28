/**
 * HTML/CSS recreation of home-center.pen "Family TV Dashboard" (8pkH2).
 * All values from the .pen file at 4K (3840×2160), divided by 2 for 1920×1080 CSS.
 */
import { useState, useEffect } from "react";

const F = "'Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

function Card({ title, icon, subtitle, badge, style, children }) {
  return (
    <div style={{
      borderRadius: 8, border: "1px solid #fff", padding: 16, background: "transparent",
      display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", ...style,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 24, fontWeight: 600, color: "#fff", fontFamily: F }}>{title}</span>
        {subtitle && <span style={{ fontSize: 16, color: "#fff6", fontFamily: F }}>{subtitle}</span>}
        {badge && (
          <span style={{
            marginLeft: "auto", background: "#fff", color: "#000", fontFamily: F,
            fontSize: 14, fontWeight: 700, width: 25, height: 25, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Evt({ time, title, sub }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      borderRadius: 5, border: "1px solid #fff3",
    }}>
      <span style={{ fontSize: 19.5, fontWeight: 600, color: "#fff", fontFamily: M, flexShrink: 0 }}>{time}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: 19.5, fontWeight: 500, color: "#fff", fontFamily: F }}>{title}</span>
        <span style={{ fontSize: 16.5, color: "#fff6", fontFamily: F }}>{sub}</span>
      </div>
    </div>
  );
}

function Bday({ emoji, name, date }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", background: "#fff1",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      }}>{emoji}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 19.5, fontWeight: 500, color: "#fff", fontFamily: F }}>{name}</span>
        <span style={{ fontSize: 16.5, color: "#fff6", fontFamily: F }}>{date}</span>
      </div>
    </div>
  );
}

function Email({ label, date, title, desc }) {
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 5, border: "1px solid #fff3",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: M }}>{label}</span>
        <span style={{ fontSize: 15, color: "#fff4", fontFamily: F }}>{date}</span>
      </div>
      <span style={{ fontSize: 19.5, fontWeight: 500, color: "#fff", fontFamily: F }}>{title}</span>
      <span style={{ fontSize: 16.5, color: "#fff6", fontFamily: F }}>{desc}</span>
    </div>
  );
}

function Task({ name, sub, badge }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 14px", borderRadius: 5, border: "1px solid #fff3",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 19.5, fontWeight: 500, color: "#fff", fontFamily: F }}>{name}</span>
        <span style={{ fontSize: 16.5, color: "#fff6", fontFamily: F }}>{sub}</span>
      </div>
      <span style={{
        fontSize: 15, fontWeight: 600, color: "#fff8", fontFamily: M,
        padding: "4px 10px", borderRadius: 999, background: "#fff1", border: "1px solid #fff4",
        flexShrink: 0, marginLeft: 8,
      }}>{badge}</span>
    </div>
  );
}

function Timer({ label, time }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 14px", borderRadius: 5, border: "1px solid #fff3",
    }}>
      <span style={{ fontSize: 19.5, fontWeight: 500, color: "#fff", fontFamily: F }}>{label}</span>
      <span style={{ fontSize: 33, fontWeight: 700, fontFamily: M, color: "#fff" }}>{time}</span>
    </div>
  );
}

export default function PenPreview() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div style={{
      width: 1920, height: 1080, background: "#000", display: "flex",
      flexDirection: "column", fontFamily: F, overflow: "hidden", color: "#fff",
    }}>
      {/* Top Bar */}
      <div style={{
        height: 70, padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: "1px solid #ffffff30", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🏠</span>
          <span style={{ fontSize: 33, fontWeight: 700 }}>The Howell Hub</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22, opacity: 0.7 }}>🎙️</span>
          <span style={{ fontSize: 21, color: "#fff6" }}>&quot;Hey Dashboard...&quot;</span>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#4ade80" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 22.5, color: "#fff8" }}>{date}</span>
          <span style={{ fontSize: 42, fontWeight: 600, fontFamily: M }}>{time}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", gap: 16, padding: 16, minHeight: 0 }}>
        {/* Left: Calendar */}
        <Card title="Calendar" icon="📅" subtitle="February 2026" style={{ width: 400, flexShrink: 0, height: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <Evt time="9:00" title="Soccer Practice" sub="Elm Creek Park" />
            <Evt time="11:30" title="Piano Lesson — Emma" sub="Mrs. Chen's Studio" />
            <Evt time="3:00" title="Dentist — Jack" sub="Maple Grove Dental" />
            <Evt time="6:30" title="Family Movie Night" sub="Living Room" />
          </div>
        </Card>

        {/* Middle */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          <div style={{ display: "flex", gap: 16, height: 270, flexShrink: 0 }}>
            <Card title="Weather" icon="⛅" style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 72, fontWeight: 700, fontFamily: M }}>34°F</span>
                  <span style={{ fontSize: 21, fontWeight: 500, color: "#fff8" }}>Partly Cloudy</span>
                  <span style={{ fontSize: 18, color: "#fff6" }}>Feels like 28°F</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 18, color: "#fff6" }}>💨 12 mph NW</span>
                  <span style={{ fontSize: 18, color: "#fff6" }}>💧 62% humidity</span>
                  <span style={{ fontSize: 18, color: "#fff6" }}>🌡️ H: 38° / L: 24°</span>
                </div>
              </div>
            </Card>
            <Card title="Birthdays" icon="🎂" style={{ width: 340, flexShrink: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                <Bday emoji="🎂" name="Grandma Sue" date="Mar 5 — 8 days!" />
                <Bday emoji="🎉" name="Uncle Mike" date="Mar 18 — 19 days" />
                <Bday emoji="🎈" name="Cousin Lily" date="Apr 2 — 34 days" />
              </div>
            </Card>
          </div>
          <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
            <Card title="Family Photos" icon="📸" subtitle="Google Photos" style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, flex: 1 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ flex: 1, borderRadius: 5, background: "#ffffff08", border: "1px solid #fff3" }} />
                ))}
              </div>
            </Card>
            <Card title="School Updates" icon="📧" badge="3" style={{ width: 340, flexShrink: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <Email label="DUE TOMORROW" date="Feb 28" title="Science Fair Project — Emma" desc="Board display due Friday" />
                <Email label="EVENT" date="Mar 4" title="Spring Book Fair" desc="Volunteers needed 2–4 PM" />
                <Email label="HOMEWORK" date="Mar 3" title="Math Chapter 7 Test — Jack" desc="Study guide attached" />
              </div>
            </Card>
          </div>
        </div>

        {/* Right */}
        <div style={{ width: 400, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          <Card title="Timers" icon="⏱️" subtitle={`"Set a timer..."`} style={{ height: 270, flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <Timer label="Oven" time="12:34" />
              <Timer label="Laundry" time="45:12" />
            </div>
          </Card>
          <Card title="OpenClaw" icon="🤖" style={{ flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <Task name="Grocery list from recipes" sub="Scanning meal plan..." badge="Running" />
              <Task name="Schedule vet appointment" sub="Checking availability..." badge="Running" />
              <Task name="Compare flight prices SEA→DEN" sub="Found 4 options under $250" badge="Done" />
            </div>
          </Card>
          <Card title="Fun Fact of the Day" icon="✨" style={{ flexShrink: 0 }}>
            <span style={{ fontSize: 21, color: "#fffc", lineHeight: 1.5 }}>
              Honey never spoils! Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still perfectly edible.
            </span>
            <span style={{ fontSize: 16.5, color: "#fff4" }}>— National Geographic</span>
          </Card>
        </div>
      </div>
    </div>
  );
}
