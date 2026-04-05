import { useEffect, useState } from "react";
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
import { useHandController } from "./hooks/useHandController";
import { useLLMQuery } from "./hooks/useLLMQuery";
import { useWakeWordDebug } from "./hooks/useWakeWordDebug";
import { useWakeRecord } from "./hooks/useWakeRecord";
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
import { FullWeatherPage } from "./components/FullWeatherPage";
import { FullPhotosPage } from "./components/FullPhotosPage";
import { FullLLMResponsePage } from "./components/FullLLMResponsePage";
import { FullHistoryPage } from "./components/FullHistoryPage";
import { TranscriptionOverlay } from "./components/TranscriptionOverlay";
import { SideNav } from "./components/SideNav";
import { FamilyMemberPage } from "./components/FamilyMemberPage";
import { WakeWordDebug } from "./components/WakeWordDebug";
import { VoiceActivationOverlay } from "./components/VoiceActivationOverlay";
import { ModelHealthPanel } from "./modules/model-health/ModelHealthPanel";
import { FullModelHealthPage } from "./modules/model-health/FullModelHealthPage";

export default function App() {
  const now = useTime();
  const { isMobile } = usePreviewMode();
  const [activeMember, setActiveMember] = useState("home");
  const { settings } = useSettings();
  const { timers, expiredTimers, dismissTimer, dismissAll } = useTimers(settings.worker);
  const { page, calendarView, goTo } = useNavigation(settings.worker);

  // URL params can force a specific page/view (used by TV preview)
  const urlParams = new URLSearchParams(window.location.search);
  const forcePage = urlParams.get("page") || page;
  const forceView = urlParams.get("view") || calendarView;

  const hc = useHandController(settings.worker, forcePage, goTo);

  const weather = useWeather(settings.weather);
  const calendar = useCalendar(settings.calendar, settings.worker);
  const photos = usePhotos(settings.photos, settings.worker);
  const bdays = useBirthdays(settings.worker);
  const school = useSchoolUpdates(settings.worker);
  const llm = useLLMQuery(settings.worker);
  const wakeDebug = useWakeWordDebug(settings.worker);
  const wakeRecord = useWakeRecord();

  // Auto-navigate to LLM response page when a new response arrives
  useEffect(() => {
    if (llm.latestResponse && forcePage !== "llm-response") {
      goTo("llm-response");
    }
  }, [llm.latestResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  if (forcePage === "calendar" && !isMobile) {
    return (
      <>
        <FullCalendarPage
          events={calendar.events}
          loading={calendar.loading}
          view={forceView}
          onViewChange={(v) => goTo(null, v)}
          onBack={() => goTo("dashboard")}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <TranscriptionOverlay query={llm.latestResponse?.query} visible={!!llm.latestResponse && forcePage !== "llm-response"} />
        <VoiceActivationOverlay active={hc.listening} />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
        {wakeDebug.visible && <WakeWordDebug events={wakeDebug.events} connected={wakeDebug.connected} onClear={wakeDebug.clearEvents} workerUrl={settings.worker?.url} workerToken={settings.worker?.token} />}
      </>
    );
  }

  if (forcePage === "weather" && !isMobile) {
    return (
      <>
        <FullWeatherPage
          weatherData={weather.data}
          loading={weather.loading}
          error={weather.error}
          locationName={weather.locationName}
          onBack={() => goTo("dashboard")}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <TranscriptionOverlay query={llm.latestResponse?.query} visible={!!llm.latestResponse && forcePage !== "llm-response"} />
        <VoiceActivationOverlay active={hc.listening} />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
        {wakeDebug.visible && <WakeWordDebug events={wakeDebug.events} connected={wakeDebug.connected} onClear={wakeDebug.clearEvents} workerUrl={settings.worker?.url} workerToken={settings.worker?.token} />}
      </>
    );
  }

  if (forcePage === "photos" && !isMobile) {
    return (
      <>
        <FullPhotosPage
          photos={photos.photos}
          loading={photos.loading}
          error={photos.error}
          onBack={() => goTo("dashboard")}
          columns={hc.photoColumns}
          scrollDir={hc.photoScrollDir}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <TranscriptionOverlay query={llm.latestResponse?.query} visible={!!llm.latestResponse && forcePage !== "llm-response"} />
        <VoiceActivationOverlay active={hc.listening} />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
        {wakeDebug.visible && <WakeWordDebug events={wakeDebug.events} connected={wakeDebug.connected} onClear={wakeDebug.clearEvents} workerUrl={settings.worker?.url} workerToken={settings.worker?.token} />}
      </>
    );
  }

  if (forcePage === "llm-response" && !isMobile) {
    return (
      <>
        <FullLLMResponsePage
          response={llm.latestResponse}
          onBack={() => { llm.dismissResponse(); goTo("dashboard"); }}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <VoiceActivationOverlay active={hc.listening} />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
        {wakeDebug.visible && <WakeWordDebug events={wakeDebug.events} connected={wakeDebug.connected} onClear={wakeDebug.clearEvents} workerUrl={settings.worker?.url} workerToken={settings.worker?.token} />}
      </>
    );
  }

  if (forcePage === "model-health") {
    return (
      <>
        <FullModelHealthPage onBack={() => goTo("dashboard")} />
        <VoiceActivationOverlay active={hc.listening} />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      </>
    );
  }

  if (forcePage === "history" && !isMobile) {
    return (
      <>
        <FullHistoryPage
          history={llm.history}
          loading={llm.historyLoading}
          onBack={() => goTo("dashboard")}
          onSelect={(item) => {
            // When selecting a history item, set it as latest and navigate to response
            // For now, just show the summary since we don't store full sections in history
            goTo("dashboard");
          }}
          handControllerConnected={hc.connected}
          lastGesture={hc.lastGesture}
        />
        <VoiceActivationOverlay active={hc.listening} />
        <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
        {wakeDebug.visible && <WakeWordDebug events={wakeDebug.events} connected={wakeDebug.connected} onClear={wakeDebug.clearEvents} workerUrl={settings.worker?.url} workerToken={settings.worker?.token} />}
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
        <Header now={now} isMobile={isMobile} onHistory={() => { llm.fetchHistory(); goTo("history"); }} handControllerConnected={hc.connected} lastGesture={hc.lastGesture} wakeRecord={wakeRecord} />

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
            <ModelHealthPanel onExpand={() => goTo("model-health")} />
            <FactPanel />
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, marginTop: 16, minHeight: 0 }}>
            <SideNav activeMember={activeMember} onSelect={setActiveMember} />
            {activeMember !== "home" ? (
              <FamilyMemberPage member={activeMember} />
            ) : (
              <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0, marginLeft: 16 }}>
                {/* Left column: Calendar */}
                <div style={{ width: 400, flexShrink: 0, minHeight: 0 }}>
                  <CalendarPanel events={calendar.events} loading={calendar.loading} error={calendar.error} selected={hc.selectedPanelId === "calendar"} />
                </div>

                {/* Middle column */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
                  <div style={{ display: "flex", gap: 16, height: 270, flexShrink: 0 }}>
                    <div style={{ width: 340, flexShrink: 0, minHeight: 0 }}>
                      <BirthdaysPanel birthdays={bdays.birthdays} loading={bdays.loading} error={bdays.error} selected={hc.selectedPanelId === "birthdays"} />
                    </div>
                    <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <WeatherPanel weatherData={weather.data} loading={weather.loading} error={weather.error} selected={hc.selectedPanelId === "weather"} />
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <WorldClockPanel selected={hc.selectedPanelId === "worldclock"} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <PhotoPanel photos={photos.photos} photosLoading={photos.loading} photosError={photos.error} selected={hc.selectedPanelId === "photos"} />
                    </div>
                    <div style={{ width: 340, flexShrink: 0, minHeight: 0 }}>
                      <EventsPanel updates={school.updates} loading={school.loading} error={school.error} selected={hc.selectedPanelId === "events"} />
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div style={{ width: 400, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
                  <div style={{ height: 270, flexShrink: 0 }}>
                    <TimersPanel timers={timers} dismissTimer={dismissTimer} selected={hc.selectedPanelId === "timers"} />
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <AgentTasksPanel selected={hc.selectedPanelId === "agenttasks"} />
                  </div>
                  <FactPanel selected={hc.selectedPanelId === "fact"} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <TranscriptionOverlay query={llm.latestResponse?.query} visible={!!llm.latestResponse && forcePage !== "llm-response"} />
      <AlarmOverlay expiredTimers={expiredTimers} onDismissAll={dismissAll} />
      <WakeWordDebug events={wakeDebug.events} connected={wakeDebug.connected} onClear={wakeDebug.clearEvents} workerUrl={settings.worker?.url} workerToken={settings.worker?.token} />
    </>
  );
}
