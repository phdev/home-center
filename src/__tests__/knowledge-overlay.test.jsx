import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  latestResponse: {
    id: "knowledge-stale",
    kind: "knowledge",
    query: "is that i-b's",
    title: "Ibis",
    summary: "Ibises are long-legged wading birds with curved bills.",
    sections: [],
    timestamp: Date.now(),
  },
  page: "dashboard",
  navigationTimestamp: 0,
  goTo: vi.fn(),
  dismissResponse: vi.fn(),
}));

vi.mock("../hooks/useTime", () => ({ useTime: () => new Date("2026-05-16T16:00:00Z") }));
vi.mock("../hooks/useTimers", () => ({
  useTimers: () => ({ timers: [], expiredTimers: [], dismissTimer: vi.fn(), dismissAll: vi.fn() }),
}));
vi.mock("../hooks/usePreviewMode", () => ({ usePreviewMode: () => ({ isMobile: false }) }));
vi.mock("../hooks/useSettings", () => ({
  useSettings: () => ({ settings: { worker: { url: "https://worker.test", token: "token" } } }),
}));
vi.mock("../hooks/useWeather", () => ({ useWeather: () => ({ data: null, loading: false, error: null }) }));
vi.mock("../hooks/useCalendar", () => ({ useCalendar: () => ({ events: [], loading: false, error: null }) }));
vi.mock("../hooks/usePhotos", () => ({ usePhotos: () => ({ photos: [], loading: false, error: null }) }));
vi.mock("../hooks/useBirthdays", () => ({ useBirthdays: () => ({ birthdays: [], loading: false, error: null }) }));
vi.mock("../hooks/useSchoolUpdates", () => ({ useSchoolUpdates: () => [] }));
vi.mock("../hooks/useNavigation", () => ({
  useNavigation: () => ({
    page: mockState.page,
    calendarView: "month",
    navigationTimestamp: mockState.navigationTimestamp,
    goTo: mockState.goTo,
  }),
}));
vi.mock("../hooks/useHandController", () => ({
  useHandController: () => ({
    connected: false,
    lastGesture: null,
    listening: false,
    selectedPanelId: null,
    photoColumns: 3,
    photoScrollDir: null,
  }),
}));
vi.mock("../hooks/useLLMQuery", () => ({
  useLLMQuery: () => ({
    latestResponse: mockState.latestResponse,
    history: [],
    historyLoading: false,
    fetchHistory: vi.fn(),
    dismissResponse: mockState.dismissResponse,
  }),
}));
vi.mock("../hooks/useWakeWordDebug", () => ({
  useWakeWordDebug: () => ({ visible: false, events: [], connected: false, clearEvents: vi.fn() }),
}));
vi.mock("../hooks/useWakeRecord", () => ({
  useWakeRecord: () => ({ active: false, status: null, toggle: vi.fn() }),
}));
vi.mock("../hooks/useLiveCaption", () => ({
  useLiveCaption: () => ({ text: "", isWake: false, stage: "", age: Infinity, ts: 0 }),
}));
vi.mock("../data/useTakeout", () => ({ useTakeout: () => null }));
vi.mock("../data/useBedtime", () => ({ useBedtimeSettings: () => [] }));
vi.mock("../data/useChecklist", () => ({ useChecklistConfig: () => ({ items: [] }) }));
vi.mock("../data/useLunch", () => ({ useLunchDecisions: () => ({}) }));
vi.mock("../data/useSchoolLunch", () => ({ useSchoolLunchMenu: () => [] }));
vi.mock("../core/agents/clawAdapter", () => ({ useClawAugmentedCards: (cards) => cards }));
vi.mock("../components/FullKnowledgePage", () => ({
  FullKnowledgePage: ({ response }) => (
    <main data-testid="knowledge-page">
      <h1>{response?.title}</h1>
      <p>{response?.query}</p>
      <p>{response?.summary}</p>
    </main>
  ),
}));

describe("knowledge response overlay behavior", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockState.goTo.mockClear();
    mockState.dismissResponse.mockClear();
    mockState.latestResponse = {
      id: "knowledge-stale",
      kind: "knowledge",
      query: "is that i-b's",
      title: "Ibis",
      summary: "Ibises are long-legged wading birds with curved bills.",
      sections: [],
      timestamp: Date.now(),
    };
    mockState.page = "dashboard";
    mockState.navigationTimestamp = 0;
    window.history.pushState({}, "", "/");
  });

  it("does not render the old completed-response Thinking overlay from App", () => {
    const appSource = readFileSync(resolve(process.cwd(), "src/App.jsx"), "utf8");

    expect(appSource).not.toContain("TranscriptionOverlay");
  });

  it("shows a completed knowledge response without covering the dashboard with Thinking", async () => {
    const { default: App } = await import("../App.jsx");

    render(<App />);

    expect(screen.getByTestId("knowledge-page")).toBeTruthy();
    expect(screen.queryByText("Thinking")).toBeNull();
    expect(screen.queryByText(/is that i-b's/i)).toBeTruthy();
  });

  it("shows the knowledge page immediately with loading text before the response is ready", async () => {
    mockState.latestResponse = null;
    mockState.page = "knowledge";
    const { default: App } = await import("../App.jsx");

    render(<App />);

    expect(screen.getByTestId("knowledge-page")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Loading" })).toBeTruthy();
    expect(screen.getByText(/loading knowledge answer/i)).toBeTruthy();
  });

  it("dismisses a knowledge response when a newer dashboard navigation command arrives", async () => {
    mockState.latestResponse = {
      id: "knowledge-stale",
      kind: "knowledge",
      query: "is that i-b's",
      title: "Ibis",
      summary: "Ibises are long-legged wading birds with curved bills.",
      sections: [],
      timestamp: Date.now(),
    };
    mockState.navigationTimestamp = mockState.latestResponse.timestamp + 1000;
    const { default: App } = await import("../App.jsx");

    render(<App />);

    await waitFor(() => {
      expect(mockState.dismissResponse).toHaveBeenCalledTimes(1);
    });
  });
});
