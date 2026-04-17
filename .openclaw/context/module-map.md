# Home Center Module Map

Auto-generated — do not edit manually.
Run `.openclaw/scripts/build-context.sh` to regenerate.

## Components (src/components/)

- **AgentTasksPanel** — `src/components/AgentTasksPanel.jsx`
- **AlarmOverlay** — `src/components/AlarmOverlay.jsx`
- **BirthdaysPanel** — `src/components/BirthdaysPanel.jsx`
- **CalendarPanel** — `src/components/CalendarPanel.jsx`
- **Clock** — `src/components/Clock.jsx`
- **ConversationsPanel** — `src/components/ConversationsPanel.jsx`
- **EventsPanel** — `src/components/EventsPanel.jsx`
- **FactPanel** — `src/components/FactPanel.jsx`
- **FamilyMemberPage** — `src/components/FamilyMemberPage.jsx`
- **FullCalendarPage** — `src/components/FullCalendarPage.jsx`
- **FullHistoryPage** — `src/components/FullHistoryPage.jsx`
- **FullLLMResponsePage** — `src/components/FullLLMResponsePage.jsx`
- **FullPhotosPage** — `src/components/FullPhotosPage.jsx`
- **FullWeatherPage** — `src/components/FullWeatherPage.jsx`
- **GestureDebug** — `src/components/GestureDebug.jsx`
- **GlassesIndicator** — `src/components/GlassesIndicator.jsx`
- **Header** — `src/components/Header.jsx`
- **NotificationsPanel** — `src/components/NotificationsPanel.jsx`
- **Panel** — `src/components/Panel.jsx`
- **PhotoPanel** — `src/components/PhotoPanel.jsx`
- **SearchPanel** — `src/components/SearchPanel.jsx`
- **SettingsModal** — `src/components/SettingsModal.jsx`
- **SideNav** — `src/components/SideNav.jsx`
- **TimersPanel** — `src/components/TimersPanel.jsx`
- **TimerStrip** — `src/components/TimerStrip.jsx`
- **TranscriptionOverlay** — `src/components/TranscriptionOverlay.jsx`
- **WakeWordDebug** — `src/components/WakeWordDebug.jsx`
- **WeatherPanel** — `src/components/WeatherPanel.jsx`
- **WeatherStrip** — `src/components/WeatherStrip.jsx`
- **WorldClockPanel** — `src/components/WorldClockPanel.jsx`

## Hooks (src/hooks/)

- **useBirthdays** — `src/hooks/useBirthdays.js`
- **useCalendar** — `src/hooks/useCalendar.js`
- **useCycler** — `src/hooks/useCycler.js`
- **useHandController** — `src/hooks/useHandController.js`
- **useLLMQuery** — `src/hooks/useLLMQuery.js`
- **useNavigation** — `src/hooks/useNavigation.js`
- **useNotifications** — `src/hooks/useNotifications.js`
- **usePhotos** — `src/hooks/usePhotos.js`
- **usePreviewMode** — `src/hooks/usePreviewMode.js`
- **useSchoolUpdates** — `src/hooks/useSchoolUpdates.js`
- **useSettings** — `src/hooks/useSettings.js`
- **useTime** — `src/hooks/useTime.js`
- **useTimers** — `src/hooks/useTimers.js`
- **useVoiceInput** — `src/hooks/useVoiceInput.js`
- **useWakeWordDebug** — `src/hooks/useWakeWordDebug.js`
- **useWeather** — `src/hooks/useWeather.js`

## Worker Endpoints (worker/src/index.js)

- `/api/ask-query`
- `/api/ask`
- `/api/birthdays`
- `/api/calendar`
- `/api/gesture`
- `/api/health`
- `/api/llm/dismiss`
- `/api/llm/history`
- `/api/llm/latest`
- `/api/navigate`
- `/api/notifications`
- `/api/photos`
- `/api/school-updates`
- `/api/timers/dismiss-all`
- `/api/timers`
- `/api/wake-config`
- `/api/wake-debug`

## Pi Services

- **wake-word** — `pi/wake_word_service.py` (openWakeWord + Whisper voice commands)
- **openclaw** — `openclaw/index.js` (Telegram bridge, port 3100, Mac Mini)
- **email-triage** — `email-triage/` (email classification + notifications)
- **school-updates** — `school-updates/` (Gmail school email summarizer)

## Themes (src/themes/)

- **index** — `src/themes/index.js`

## Data & Config

- `src/data/mockData.js` — static data (facts, etc.)
- `src/design/pen-spec.js` — Pencil design node mapping
- `vite.config.js` — Vite config (base: /home-center/)
- `worker/wrangler.toml` — Cloudflare Worker config
