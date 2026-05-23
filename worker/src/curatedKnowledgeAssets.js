const CANONICAL_CURATED_ASSETS = [
  {
    topicKey: "madagascar",
    title: "Madagascar",
    type: "location",
    assetRole: "hero",
    cropHint: "wide-landscape",
    focalPoint: { x: 0.68, y: 0.48 },
    tone: "home-center-dark",
    heroImage: null,
  },
  {
    topicKey: "ada-lovelace",
    title: "Ada Lovelace",
    type: "person",
    assetRole: "hero",
    cropHint: "right-subject",
    focalPoint: { x: 0.68, y: 0.42 },
    tone: "home-center-dark",
    heroImage: null,
  },
  {
    topicKey: "emperor-penguin",
    title: "Emperor Penguin",
    type: "fauna",
    assetRole: "hero",
    cropHint: "right-subject",
    focalPoint: { x: 0.63, y: 0.52 },
    tone: "home-center-dark",
    heroImage: null,
  },
  {
    topicKey: "coast-redwood",
    title: "Coast Redwood",
    type: "flora",
    assetRole: "hero",
    cropHint: "wide-landscape",
    focalPoint: { x: 0.58, y: 0.5 },
    tone: "home-center-dark",
    heroImage: null,
  },
  {
    topicKey: "apollo-11-moon-landing",
    title: "Apollo 11 Moon Landing",
    type: "event",
    assetRole: "hero",
    cropHint: "center-subject",
    focalPoint: { x: 0.62, y: 0.48 },
    tone: "home-center-dark",
    heroImage: null,
  },
  {
    topicKey: "internet",
    title: "The Internet",
    type: "concept",
    assetRole: "hero",
    cropHint: "left-text-safe",
    focalPoint: { x: 0.62, y: 0.5 },
    tone: "home-center-dark",
    heroImage: null,
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

