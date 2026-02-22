const STORAGE_KEY = "homeCenter_settings";

const DEFAULTS = {
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
    imageModel: "dall-e-3",
  },
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    return {
      weather: { ...DEFAULTS.weather, ...saved.weather },
      calendar: { ...DEFAULTS.calendar, ...saved.calendar },
      photos: { ...DEFAULTS.photos, ...saved.photos },
      llm: { ...DEFAULTS.llm, ...saved.llm },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export { DEFAULTS };
