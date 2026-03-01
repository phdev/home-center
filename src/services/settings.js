const STORAGE_KEY = "homeCenter_settings";

const DEFAULTS = {
  worker: {
    url: "https://home-center-api.phhowell.workers.dev",
    token: "",
  },
  weather: {
    lat: 33.849,
    lng: -118.388,
    units: "fahrenheit",
    autoLocate: false,
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
    imageModel: "dall-e-3",
  },
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    const merged = {
      worker: { ...DEFAULTS.worker, ...saved.worker },
      weather: { ...DEFAULTS.weather, ...saved.weather },
      calendar: { ...DEFAULTS.calendar, ...saved.calendar },
      photos: { ...DEFAULTS.photos, ...saved.photos },
      llm: { ...DEFAULTS.llm, ...saved.llm },
    };
    // If worker URL was previously empty, pick up the new default
    if (!merged.worker.url) merged.worker.url = DEFAULTS.worker.url;
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export { DEFAULTS };
