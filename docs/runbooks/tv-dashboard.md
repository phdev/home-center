# TV Dashboard Runbook

## Display Target

- Physical display: Samsung TV, 3840x2160 over HDMI.
- Logical resolution: 1920x1080. Chromium runs with
  `--force-device-scale-factor=2`, so CSS is authored for 1080p and rendered at
  2x.
- Platform: Chromium kiosk on Raspberry Pi 5 with labwc Wayland compositor and
  LightDM.
- Viewport: fixed position, no scrolling on desktop.
- Mobile breakpoint: 768px, switching to a single-column scrollable layout.

## Layout

- Desktop top row: Calendar, Weather, Photos, Facts.
- Desktop bottom row: Notifications, Events, Birthdays/Weather, Claw Suggestions/Facts.
- Gaps: 14px between panels, with 20px 44px 12px page padding.
- Removed cards as of 2026-04-17: World Clock, Timers panel, and OpenClaw Tasks.
- Left column stack as of 2026-04-24: Calendar plus HolidaysPanel.
- WakeWordDebug defaults minimized so it appears as a bottom-left chip.

## Themes

The five current themes are Midnight Observatory, Morning Paper, Retro
Terminal, Soft Playroom, and Glass Noir. Theme tokens live in
`src/themes/index.js`.

## HandController Gesture Control

The iOS HandController app streams video from Meta Ray-Ban glasses, detects
hand gestures with Apple Vision, and POSTs directly to the Pi on local Wi-Fi.

Connection flow:

1. HandController posts gesture payloads to the Pi command server on `:8765`.
2. `pi/wake_word_service.py` normalizes and stores the latest gesture.
3. The kiosk polls `GET http://localhost:8765/gesture` every 500 ms.
4. `src/hooks/useHandController.js` processes the gesture and updates spatial navigation.

Do not commit concrete LAN IPs. Use the Pi command URL from local ops notes or
environment.

## Gesture Map

- Wave right/left/up/down navigates spatially between panels.
- Calendar is selected by default on load.
- Index-thumb pinch opens fullscreen pages such as Calendar, Weather, and Photos.
- Middle-thumb pinch returns from fullscreen pages to the dashboard.
- Selected panel border is 5px blue, `#3B82F6`.
- On the Photos page, two-hand pinch zooms and pinch-drag scrolls.

## Key Files

| File | Purpose |
|---|---|
| `src/App.jsx` | Main dashboard grid |
| `src/themes/index.js` | Theme definitions |
| `src/hooks/usePreviewMode.js` | TV resolution constants |
| `src/hooks/useHandController.js` | Gesture polling and spatial navigation |
| `src/components/GlassesIndicator.jsx` | Green glasses icon in top nav |
| `src/components/Panel.jsx` | Panel wrapper and selected border |
| `src/components/FullCalendarPage.jsx` | Full calendar page |
| `src/components/FullWeatherPage.jsx` | Full weather page |
| `src/components/FullPhotosPage.jsx` | Full photos page |
| `pi/wake_word_service.py` | Pi gesture receive/poll endpoints |
