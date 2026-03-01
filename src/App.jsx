import { useTime } from "./hooks/useTime";
import { useTimers } from "./hooks/useTimers";
import { usePreviewMode } from "./hooks/usePreviewMode";
import { useSettings } from "./hooks/useSettings";
import { useWeather } from "./hooks/useWeather";
import { useCalendar } from "./hooks/useCalendar";
import { usePhotos } from "./hooks/usePhotos";
import { useBirthdays } from "./hooks/useBirthdays";
import { useSchoolUpdates } from "./hooks/useSchoolUpdates";
import { useNavigation } from "./hooks/useNavigation";
import { Header } from "./components/Header";
import { CalendarPanel } from "./components/CalendarPanel";
import { WeatherPanel } from "./components/WeatherPanel";
import { PhotoPanel } from "./components/PhotoPanel";
import { FactPanel } from "./components/FactPanel";
import { AgentTasksPanel } from "./components/AgentTasksPanel";
import { EventsPanel } from "./components/EventsPanel";
import { BirthdaysPanel } from "./components/BirthdaysPanel";
import { TimersPanel } from "./components/TimersPanel";
import { AlarmOverlay } from "./components/AlarmOverlay";
import { WorldClockPanel } from "./components/WorldClockPanel";
import { FullCalendarPage } from "./components/FullCalendarPage";

export default function App() {
  const now = useTime();
  const { isMobile } = usePreviewMode();
  const { settings } = useSettings();
  const { timers, expiredTimers, dismissTimer, dismissAll } = useTimers(settings.worker);
  const { page, calendarView, goTo } = useNavigation(settings.worker);

  const weather = useWeather(settings.weather);
  const calendar = useCalendar(settings.calendar, settings.worker);
  const photos = usePhotos(settings.photos, settings.worker);
  const bdays = useBirthdays(settings.worker);
  const school = useSchoolUpdates(settings.worker);

  if (page === "calendar" && !isMobile) {
    return (
      <>
        <FullCalendarPage
          events={calendar.events}
          loading={calendar.loading}
          view={calendarView}
          onViewChange={(v) => goTo(null, v)}
          onBack={() => goTo("dashboard")}
        />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  return (
    <>
      <style>{`
        body { overflow: ${isMobile ? "auto" : "hidden"} }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: #FFFFFF15; border-radius: 3px }
      `}</style>
      <div
        style={{
          width: "100%",
          minHeight: isMobile ? "100vh" : undefined,
          height: isMobile ? "auto" : "100vh",
          background: "#000000",
          padding: isMobile ? "12px 12px 80px" : "0px 16px 16px",
          display: "flex",
          flexDirection: "column",
          overflow: isMobile ? "visible" : "hidden",
          fontFamily: "'Geist','Inter',system-ui,sans-serif",
          color: "#FFFFFF",
        }}
      >
        <Header now={now} isMobile={isMobile} />

        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <CalendarPanel events={calendar.events} loading={calendar.loading} error={calendar.error} />
            <WeatherPanel weatherData={weather.data} loading={weather.loading} error={weather.error} />
            <div style={{ height: 220 }}>
              <PhotoPanel photos={photos.photos} photosLoading={photos.loading} photosError={photos.error} />
            </div>
            <WorldClockPanel />
            <BirthdaysPanel birthdays={bdays.birthdays} loading={bdays.loading} error={bdays.error} />
            <EventsPanel updates={school.updates} loading={school.loading} error={school.error} />
            <AgentTasksPanel />
            <TimersPanel timers={timers} dismissTimer={dismissTimer} />
            <FactPanel />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 16, flex: 1, marginTop: 16, minHeight: 0 }}>
            {/* Left column: Calendar */}
            <div style={{ width: 400, flexShrink: 0, minHeight: 0 }}>
              <CalendarPanel events={calendar.events} loading={calendar.loading} error={calendar.error} />
            </div>

            {/* Middle column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
              <div style={{ display: "flex", gap: 16, height: 270, flexShrink: 0 }}>
                <div style={{ width: 340, flexShrink: 0, minHeight: 0 }}>
                  <BirthdaysPanel birthdays={bdays.birthdays} loading={bdays.loading} error={bdays.error} />
                </div>
                <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <WeatherPanel weatherData={weather.data} loading={weather.loading} error={weather.error} />
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <WorldClockPanel />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <PhotoPanel photos={photos.photos} photosLoading={photos.loading} photosError={photos.error} />
                </div>
                <div style={{ width: 340, flexShrink: 0, minHeight: 0 }}>
                  <EventsPanel updates={school.updates} loading={school.loading} error={school.error} />
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ width: 400, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
              <div style={{ height: 270, flexShrink: 0 }}>
                <TimersPanel timers={timers} dismissTimer={dismissTimer} />
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <AgentTasksPanel />
              </div>
              <FactPanel />
            </div>
          </div>
        )}
      </div>
      <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
    </>
  );
}
