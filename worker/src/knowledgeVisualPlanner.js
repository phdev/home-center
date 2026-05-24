const VISUAL_FAMILY = "editorial-knowledge-v1";
const DEFAULT_TONE = "home-center-dark";

const TYPE_CONFIG = {
  location: {
    subType: "place-geography",
    compositionPattern: "landscape-right-text-left",
    motifStrategy: "contour-map-lines",
    supportingPanelStyle: "map-geography",
    mapStyle: "locator-glass",
    badgeStyle: "blue-location",
    atAGlanceStyle: "geo-pillars",
  },
  person: {
    subType: "historical-figure",
    compositionPattern: "portrait-right-text-left",
    motifStrategy: "archive-linework",
    supportingPanelStyle: "timeline-history",
    mapStyle: "none",
    badgeStyle: "gold-person",
    atAGlanceStyle: "legacy-pillars",
  },
  fauna: {
    subType: "organism-animal",
    compositionPattern: "environmental-depth-scene",
    motifStrategy: "habitat-rings",
    supportingPanelStyle: "habitat-lifecycle",
    mapStyle: "habitat-range",
    badgeStyle: "green-fauna",
    atAGlanceStyle: "life-pattern",
  },
  flora: {
    subType: "organism-plant",
    compositionPattern: "environmental-depth-scene",
    motifStrategy: "growth-rings",
    supportingPanelStyle: "habitat-lifecycle",
    mapStyle: "range-glass",
    badgeStyle: "emerald-flora",
    atAGlanceStyle: "growth-pattern",
  },
  event: {
    subType: "historical-event",
    compositionPattern: "centered-subject-soft-vignette",
    motifStrategy: "timeline-arc",
    supportingPanelStyle: "timeline-history",
    mapStyle: "event-place",
    badgeStyle: "amber-event",
    atAGlanceStyle: "event-pillars",
  },
  concept: {
    subType: "abstract-concept",
    compositionPattern: "abstract-concept",
    motifStrategy: "systems-linework",
    supportingPanelStyle: "process-concept",
    mapStyle: "none",
    badgeStyle: "violet-concept",
    atAGlanceStyle: "three-pillars",
  },
};

function cleanText(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function includesAny(value, words) {
  const text = cleanText(value, 500).toLowerCase();
  return words.some((word) => text.includes(word));
}

function visualContextFor(type, query, title) {
  const text = `${query} ${title}`.toLowerCase();
  if (type === "person") {
    if (includesAny(text, ["scientist", "mathematician", "engineer", "inventor", "programmer"])) {
      return { subType: "historical-scientist", motifStrategy: "analytical-linework" };
    }
    if (includesAny(text, ["artist", "writer", "composer", "poet"])) {
      return { subType: "cultural-figure", motifStrategy: "archive-paper-linework" };
    }
  }
  if (type === "event") {
    if (includesAny(text, ["apollo", "moon", "space", "nasa", "mission"])) {
      return { subType: "space-history", motifStrategy: "orbital-trajectory-lines", mapStyle: "mission-place" };
    }
  }
  if (type === "concept") {
    if (includesAny(text, ["internet", "network", "protocol", "web", "computer", "quantum"])) {
      return { subType: "systems-concept", motifStrategy: "network-linework" };
    }
    if (includesAny(text, ["photosynthesis", "cycle", "process", "how"])) {
      return { subType: "process-concept", motifStrategy: "process-flow-linework" };
    }
  }
  return {};
}

function patternFor(type, image, imageSourceType) {
  if (!image?.url) {
    return type === "concept" || imageSourceType === "diagram"
      ? "abstract-concept"
      : "fallback-graphic";
  }
  if (image.cropHint === "right-subject") return "portrait-right-text-left";
  if (image.cropHint === "center-subject") return "centered-subject-soft-vignette";
  if (type === "fauna" || type === "flora") return "environmental-depth-scene";
  if (type === "location") return "landscape-right-text-left";
  return TYPE_CONFIG[type]?.compositionPattern || "landscape-right-text-left";
}

function heroStrategyFor(image, imageSourceType, visualNeed) {
  if (image?.url) {
    if (image.assetMode === "generated" || image.mode === "generated") return "generated-hero";
    return "retrieved-single-subject";
  }
  if (imageSourceType === "generated") return "generated-hero";
  if (imageSourceType === "diagram" || visualNeed === "none") return "abstract-concept";
  return "fallback-graphic";
}

function textSafeZoneFor(pattern) {
  if (pattern.endsWith("text-left")) return "left";
  if (pattern === "centered-subject-soft-vignette") return "left";
  return "balanced";
}

function focalRegionFor(pattern, image) {
  if (image?.focalPoint) {
    const x = image.focalPoint.x < 0.4 ? "left" : (image.focalPoint.x > 0.6 ? "right" : "center");
    const y = image.focalPoint.y < 0.42 ? "top" : (image.focalPoint.y > 0.62 ? "bottom" : "center");
    return `${x}-${y}`;
  }
  if (pattern === "portrait-right-text-left") return "right-center";
  if (pattern === "centered-subject-soft-vignette") return "center-center";
  return "right-center";
}

function candidateSummary(retrieved = {}) {
  const candidates = retrieved?.diagnostics?.final?.candidates || [];
  return {
    count: candidates.length,
    acceptedCount: candidates.filter((candidate) => candidate.accepted).length,
    bestScore: candidates.reduce((best, candidate) => Math.max(best, Number(candidate.score || 0)), 0),
  };
}

export function buildKnowledgeVisualPlan({
  query = "",
  title = "",
  type = "concept",
  summary = "",
  profile = null,
  image = null,
  imageSourceType = "none",
  visualNeed = "none",
  classification = {},
  retrieved = {},
} = {}) {
  const queryType = TYPE_CONFIG[type] ? type : "concept";
  const base = TYPE_CONFIG[queryType];
  const context = visualContextFor(queryType, query, title || classification.title);
  const compositionPattern = patternFor(queryType, image, imageSourceType);
  const heroStrategy = heroStrategyFor(image, imageSourceType, visualNeed);
  const candidates = candidateSummary(retrieved);
  const concrete = queryType !== "concept" || imageSourceType === "known";
  const hasMaps = Array.isArray(profile?.maps) && profile.maps.length > 0;

  return {
    visualFamily: VISUAL_FAMILY,
    queryType,
    subType: context.subType || base.subType,
    compositionPattern,
    heroStrategy,
    textSafeZone: textSafeZoneFor(compositionPattern),
    focalRegion: focalRegionFor(compositionPattern, image),
    tone: image?.tone || DEFAULT_TONE,
    contrastLevel: image?.url ? "medium-high" : "high",
    motifStrategy: context.motifStrategy || base.motifStrategy,
    supportingPanelStyle: base.supportingPanelStyle,
    mapStyle: context.mapStyle || (hasMaps ? base.mapStyle : "none"),
    badgeStyle: base.badgeStyle,
    atAGlanceStyle: base.atAGlanceStyle,
    backgroundTreatment: image?.url ? "navy-glass-vignette" : "navy-abstract-linework",
    concrete,
    contentDensity: cleanText(summary).length > 260 ? "dense" : "standard",
    candidateSummary: candidates,
    retryPolicy: { maxAttempts: image?.url || visualNeed === "none" ? 1 : 3 },
  };
}

export function buildHeroCompositionPackage(visualPlan, image = null) {
  const plan = visualPlan || buildKnowledgeVisualPlan({ image });
  return {
    visualFamily: plan.visualFamily,
    pattern: plan.compositionPattern,
    strategy: plan.heroStrategy,
    textSafeZone: plan.textSafeZone,
    focalRegion: plan.focalRegion,
    tone: plan.tone,
    motifStrategy: plan.motifStrategy,
    backgroundTreatment: plan.backgroundTreatment,
    cropHint: image?.cropHint || null,
    focalPoint: image?.focalPoint || null,
  };
}
