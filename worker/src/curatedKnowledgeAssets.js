const CANONICAL_CURATED_ASSETS = [
  {
    topicKey: "madagascar",
    title: "Madagascar",
    type: "location",
    assetRole: "hero",
    cropHint: "right-subject",
    focalPoint: { x: 0.7, y: 0.46 },
    tone: "home-center-dark",
    heroImage: {
      url: "/home-center/knowledge-assets/madagascar-baobabs.jpg",
      source: "Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Avenue_of_Baobabs,_Madagascar_(22558139260).jpg",
      credit: "Rod Waddington",
      license: "CC BY-SA 2.0",
      width: 4739,
      height: 3454,
      focalPoint: { x: 0.7, y: 0.46 },
      cropHint: "right-subject",
      tone: "home-center-dark",
    },
  },
  {
    topicKey: "ada-lovelace",
    title: "Ada Lovelace",
    type: "person",
    assetRole: "hero",
    cropHint: "right-subject",
    focalPoint: { x: 0.68, y: 0.42 },
    tone: "home-center-dark",
    heroImage: {
      url: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Ada_Lovelace_portrait.jpg",
      source: "Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Ada_Lovelace_portrait.jpg",
      credit: "Alfred Edward Chalon",
      license: "Public domain",
      width: 2362,
      height: 3078,
      focalPoint: { x: 0.68, y: 0.42 },
      cropHint: "right-subject",
      tone: "home-center-dark",
    },
  },
  {
    topicKey: "emperor-penguin",
    title: "Emperor Penguin",
    type: "fauna",
    assetRole: "hero",
    cropHint: "right-subject",
    focalPoint: { x: 0.64, y: 0.5 },
    tone: "home-center-dark",
    heroImage: {
      url: "/home-center/knowledge-assets/emperor-penguin-reference-hero.png",
      source: "Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Emperor_penguins_in_Antarctica.jpg",
      credit: "Wikimedia Commons",
      license: "CC BY 2.0",
      width: 1152,
      height: 768,
      focalPoint: { x: 0.64, y: 0.5 },
      cropHint: "right-subject",
      tone: "home-center-dark",
    },
  },
  {
    topicKey: "coast-redwood",
    title: "Coast Redwood",
    type: "flora",
    assetRole: "hero",
    cropHint: "right-subject",
    focalPoint: { x: 0.66, y: 0.46 },
    tone: "home-center-dark",
    heroImage: {
      url: "/home-center/knowledge-assets/coast-redwood-hero.jpg",
      source: "Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Prairie_Creek_Redwoods_-_Coastal_Redwood_Forest.jpg",
      credit: "Owen Lloyd",
      license: "Public domain",
      width: 2304,
      height: 1728,
      focalPoint: { x: 0.66, y: 0.46 },
      cropHint: "right-subject",
      tone: "home-center-dark",
    },
  },
  {
    topicKey: "apollo-11-moon-landing",
    title: "Apollo 11 Moon Landing",
    type: "event",
    assetRole: "hero",
    cropHint: "center-subject",
    focalPoint: { x: 0.5, y: 0.48 },
    tone: "home-center-dark",
    heroImage: {
      url: "https://upload.wikimedia.org/wikipedia/commons/9/9c/Aldrin_Apollo_11.jpg",
      source: "NASA",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Aldrin_Apollo_11.jpg",
      credit: "NASA / Buzz Aldrin",
      license: "Public domain",
      width: 5940,
      height: 5940,
      focalPoint: { x: 0.5, y: 0.48 },
      cropHint: "center-subject",
      tone: "home-center-dark",
    },
  },
  {
    topicKey: "the-internet",
    title: "The Internet",
    type: "concept",
    assetRole: "hero",
    cropHint: "left-text-safe",
    focalPoint: { x: 0.62, y: 0.5 },
    tone: "home-center-dark",
    heroImage: {
      url: "/home-center/knowledge-assets/internet-layered-network-hero.png",
      source: "GPT Image 2",
      sourceUrl: null,
      credit: "Generated from Home Center art direction",
      license: "Generated asset",
      width: 1672,
      height: 941,
      focalPoint: { x: 0.66, y: 0.48 },
      cropHint: "left-text-safe",
      tone: "home-center-dark",
      mode: "generated",
      assetMode: "generated",
    },
  },
];

export function curatedKnowledgeAssetsFromEnv(env = {}) {
  const custom = parseCustomAssets(env.CURATED_KNOWLEDGE_ASSETS_JSON);
  return [...custom, ...CANONICAL_CURATED_ASSETS];
}

export function curatedTopicKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCustomAssets(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return Object.values(parsed);
  } catch {
    return [];
  }
  return [];
}
