const STORAGE_KEY = "homeCenter_settings";
const IMAGE_MODEL = "gpt-image-2";

const DEFAULTS = {
  worker: {
    url: "https://home-center-api.phhowell.workers.dev",
    token: "",
  },
  openclaw: {
    url: "http://peters-mac-mini.local:3100",
    chatId: "",
  },
  weather: {
    lat: null,
    lng: null,
    units: "fahrenheit",
    autoLocate: true,
  },
  calendar: {
    urls: [],
    corsProxy: "https://corsproxy.io/?",
  },
  photos: {
    albumToken: "",
    corsProxy: "https://corsproxy.io/?",
  },
  llm: {
    apiKey: "",
    model: "gpt-4o-mini",
    imageModel: IMAGE_MODEL,
  },
  appearance: {
    designSystem: "v2",
  },
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    const merged = {
      worker: { ...DEFAULTS.worker, ...saved.worker },
      openclaw: { ...DEFAULTS.openclaw, ...saved.openclaw },
      weather: { ...DEFAULTS.weather, ...saved.weather },
      calendar: { ...DEFAULTS.calendar, ...saved.calendar },
      photos: { ...DEFAULTS.photos, ...saved.photos },
      llm: { ...DEFAULTS.llm, ...saved.llm },
      appearance: { ...DEFAULTS.appearance, ...saved.appearance },
    };
    // If worker URL was previously empty, pick up the new default
    if (!merged.worker.url) merged.worker.url = DEFAULTS.worker.url;
    if (
      !merged.openclaw.url ||
      merged.openclaw.url === "http://localhost:3100" ||
      merged.openclaw.url === "http://macmini.local:3100"
    ) {
      merged.openclaw.url = DEFAULTS.openclaw.url;
    }
    merged.llm.imageModel = IMAGE_MODEL;
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export { DEFAULTS };
