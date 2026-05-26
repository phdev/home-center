const VISUAL_FAMILY = "editorial-knowledge-v1";
const DEFAULT_TONE = "home-center-dark";

export const KNOWLEDGE_DESIGN_PRINCIPLES = {
  version: "apollo-penguin-internet-reference-v1",
  panelStyle: "transparent-liquid-glass",
  heroTransparency: "match-supporting-panels",
  mapLabelPlacement: "external-callouts",
  timelineConnectorStyle: "segmented-between-icons",
  ornamentStyle: "topic-specific-line-art",
  relatedChipScale: "compact-secondary-nav",
  conceptHeroTreatment: "layered-native-or-pinned-hero",
  conceptModuleOrder: "process-then-glance",
  conceptInsightOrnament: "accent-line-art-secondary",
};

export const COMPOSITION_PATTERNS = {
  "portrait-right-text-left": {
    subjectPlacement: "right-center",
    textSafeZone: "left",
    cropRatio: "16:10",
    overlayIntensity: "medium-high",
    motifPlacement: "right-background",
    secondaryImageBlending: false,
    subjectMaskHelpful: true,
    echoMotifInInsight: true,
  },
  "landscape-right-text-left": {
    subjectPlacement: "right-center",
    textSafeZone: "left",
    cropRatio: "16:9",
    overlayIntensity: "medium",
    motifPlacement: "upper-right",
    secondaryImageBlending: false,
    subjectMaskHelpful: false,
    echoMotifInInsight: true,
  },
  "centered-subject-soft-vignette": {
    subjectPlacement: "center",
    textSafeZone: "left",
    cropRatio: "16:9",
    overlayIntensity: "high",
    motifPlacement: "orbital-center",
    secondaryImageBlending: true,
    subjectMaskHelpful: false,
    echoMotifInInsight: true,
  },
  "environmental-depth-scene": {
    subjectPlacement: "right-depth",
    textSafeZone: "left",
    cropRatio: "16:9",
    overlayIntensity: "medium-high",
    motifPlacement: "habitat-field",
    secondaryImageBlending: false,
    subjectMaskHelpful: true,
    echoMotifInInsight: true,
  },
  "archival-event-scene": {
    subjectPlacement: "center-right",
    textSafeZone: "left",
    cropRatio: "16:9",
    overlayIntensity: "high",
    motifPlacement: "timeline-arc",
    secondaryImageBlending: true,
    subjectMaskHelpful: false,
    echoMotifInInsight: true,
  },
  "object-or-artifact-focus": {
    subjectPlacement: "right-center",
    textSafeZone: "left",
    cropRatio: "4:3",
    overlayIntensity: "medium-high",
    motifPlacement: "technical-frame",
    secondaryImageBlending: false,
    subjectMaskHelpful: true,
    echoMotifInInsight: true,
  },
  "abstract-concept-orbital": {
    subjectPlacement: "center",
    textSafeZone: "balanced",
    cropRatio: "16:9",
    overlayIntensity: "high",
    motifPlacement: "full-field",
    secondaryImageBlending: true,
    subjectMaskHelpful: false,
    echoMotifInInsight: true,
  },
  "concept-layered-diagram-like": {
    subjectPlacement: "center-right",
    textSafeZone: "left",
    cropRatio: "16:9",
    overlayIntensity: "high",
    motifPlacement: "diagram-field",
    secondaryImageBlending: false,
    subjectMaskHelpful: false,
    echoMotifInInsight: true,
  },
  "species-closeup-with-environment": {
    subjectPlacement: "right-center",
    textSafeZone: "left",
    cropRatio: "16:9",
    overlayIntensity: "medium-high",
    motifPlacement: "habitat-field",
    secondaryImageBlending: false,
    subjectMaskHelpful: true,
    echoMotifInInsight: true,
  },
  "place-scenic-wide": {
    subjectPlacement: "right-depth",
    textSafeZone: "left",
    cropRatio: "21:9",
    overlayIntensity: "medium",
    motifPlacement: "contour-corner",
    secondaryImageBlending: false,
    subjectMaskHelpful: false,
    echoMotifInInsight: true,
  },
  "tall-subject-forest-depth": {
    subjectPlacement: "right-vertical",
    textSafeZone: "left",
    cropRatio: "16:9",
    overlayIntensity: "medium-high",
    motifPlacement: "growth-rings",
    secondaryImageBlending: false,
    subjectMaskHelpful: true,
    echoMotifInInsight: true,
  },
  "multi-subject-fauna-family": {
    subjectPlacement: "right-depth",
    textSafeZone: "left",
    cropRatio: "16:9",
    overlayIntensity: "medium-high",
    motifPlacement: "habitat-field",
    secondaryImageBlending: false,
    subjectMaskHelpful: false,
    echoMotifInInsight: true,
  },
  "fallback-graphic": {
    subjectPlacement: "center",
    textSafeZone: "balanced",
    cropRatio: "16:9",
    overlayIntensity: "high",
    motifPlacement: "full-field",
    secondaryImageBlending: false,
    subjectMaskHelpful: false,
    echoMotifInInsight: true,
  },
};

const SUBTYPE_RULES = [
  { type: "location", subType: "location/island", words: ["island", "madagascar", "iceland", "archipelago"], pattern: "place-scenic-wide", motif: "island-contour" },
  { type: "location", subType: "location/country", words: ["country", "nation", "capital", "border"], pattern: "landscape-right-text-left", motif: "contour-map-lines" },
  { type: "location", subType: "location/city", words: ["city", "town", "metropolis", "rome", "kyoto"], pattern: "place-scenic-wide", motif: "street-grid-linework" },
  { type: "person", subType: "person/historical-scientist", words: ["scientist", "mathematician", "engineer", "inventor", "programmer", "lovelace", "curie", "berners-lee"], pattern: "portrait-right-text-left", motif: "technical-sketch" },
  { type: "person", subType: "person/artist", words: ["artist", "writer", "composer", "poet", "painter"], pattern: "portrait-right-text-left", motif: "manuscript-linework" },
  { type: "person", subType: "person/political-figure", words: ["president", "prime minister", "king", "queen", "leader", "political"], pattern: "portrait-right-text-left", motif: "civic-arc" },
  { type: "fauna", subType: "fauna/polar-animal", words: ["penguin", "polar", "arctic", "antarctic", "seal"], pattern: "species-closeup-with-environment", motif: "snow-habitat-rings" },
  { type: "fauna", subType: "fauna/ocean-animal", words: ["whale", "shark", "dolphin", "ocean", "marine"], pattern: "multi-subject-fauna-family", motif: "wave-field-lines" },
  { type: "flora", subType: "flora/tree", words: ["tree", "redwood", "sequoia", "oak", "forest"], pattern: "tall-subject-forest-depth", motif: "growth-rings" },
  { type: "flora", subType: "flora/flowering-plant", words: ["flower", "orchid", "rose", "flytrap", "plant"], pattern: "species-closeup-with-environment", motif: "botanical-lineart" },
  { type: "event", subType: "event/space-mission", words: ["apollo", "moon", "space", "nasa", "mission", "rocket"], pattern: "archival-event-scene", motif: "orbital" },
  { type: "event", subType: "event/war", words: ["war", "battle", "invasion", "revolution"], pattern: "archival-event-scene", motif: "timeline-arc" },
  { type: "event", subType: "event/discovery", words: ["discovery", "discovered", "invention", "breakthrough"], pattern: "object-or-artifact-focus", motif: "technical-sketch" },
  { type: "concept", subType: "concept/network", words: ["internet", "network", "protocol", "web", "packet"], pattern: "abstract-concept-orbital", motif: "node-mesh" },
  { type: "concept", subType: "concept/physical-process", words: ["photosynthesis", "cycle", "process", "gravity", "weathering"], pattern: "concept-layered-diagram-like", motif: "process-orbital" },
  { type: "concept", subType: "concept/abstract-scientific", words: ["quantum", "entanglement", "relativity", "field", "wave"], pattern: "abstract-concept-orbital", motif: "paired-field" },
  { type: "concept", subType: "concept/invention", words: ["invention", "invented", "machine", "engine", "technology"], pattern: "object-or-artifact-focus", motif: "technical-sketch" },
];

const TYPE_DEFAULTS = {
  location: { subType: "location/country", pattern: "landscape-right-text-left", motif: "contour-map-lines", supportingPanelStyle: "map-geography", mapStyle: "world-map-pin", badgeStyle: "blue-location", atAGlanceStyle: "island-shape-stats" },
  person: { subType: "person/historical-scientist", pattern: "portrait-right-text-left", motif: "technical-sketch", supportingPanelStyle: "vertical-timeline", mapStyle: "none", badgeStyle: "gold-person", atAGlanceStyle: "icon-metric-columns" },
  fauna: { subType: "fauna/polar-animal", pattern: "species-closeup-with-environment", motif: "habitat-rings", supportingPanelStyle: "lifecycle-loop", mapStyle: "habitat-range", badgeStyle: "green-fauna", atAGlanceStyle: "lifecycle-loop" },
  flora: { subType: "flora/tree", pattern: "tall-subject-forest-depth", motif: "growth-rings", supportingPanelStyle: "height-comparison", mapStyle: "range-glass", badgeStyle: "emerald-flora", atAGlanceStyle: "height-comparison" },
  event: { subType: "event/discovery", pattern: "archival-event-scene", motif: "timeline-arc", supportingPanelStyle: "horizontal-mission-timeline", mapStyle: "us-places-map", badgeStyle: "amber-event", atAGlanceStyle: "timeline-icons" },
  concept: { subType: "concept/abstract-scientific", pattern: "abstract-concept-orbital", motif: "node-mesh", supportingPanelStyle: "process-flow", mapStyle: "none", badgeStyle: "violet-concept", atAGlanceStyle: "icon-metric-columns" },
};

export const TYPE_COMPOSITION_CONTRACTS = {
  location: {
    hero: ["scenic-location"],
    facts: ["compact-fact-rows"],
    middle: ["world-map-pin", "map-geography"],
    lower: ["island-shape-stats", "icon-metric-columns"],
  },
  person: {
    hero: ["portrait-editorial"],
    facts: ["compact-fact-rows"],
    middle: ["vertical-timeline"],
    lower: ["icon-metric-columns"],
  },
  fauna: {
    hero: ["species-closeup-with-environment"],
    facts: ["compact-fact-rows"],
    middle: ["habitat-range"],
    lower: ["lifecycle-loop", "icon-metric-columns"],
  },
  flora: {
    hero: ["scenic-location", "species-closeup-with-environment"],
    facts: ["compact-fact-rows"],
    middle: ["range-glass"],
    lower: ["height-comparison", "icon-metric-columns"],
  },
  event: {
    hero: ["archival-event-scene"],
    facts: ["compact-fact-rows"],
    middle: ["us-places-map", "world-map-pin"],
    lower: ["horizontal-mission-timeline", "icon-metric-columns"],
  },
  concept: {
    hero: ["native-concept-hero", "fallback-graphic"],
    facts: ["compact-fact-rows"],
    middle: ["process-flow"],
    lower: ["icon-metric-columns"],
  },
};

const CANONICAL_VISUAL_OVERRIDES = {
  internet: {
    subType: "concept/network",
    compositionPattern: "concept-layered-diagram-like",
    motifStrategy: "node-mesh",
    supportingPanelStyle: "process-flow",
    mapStyle: "none",
    atAGlanceStyle: "icon-metric-columns",
    heroStrategy: "abstract-concept",
    moduleStyles: {
      hero: "native-concept-hero",
      facts: "compact-fact-rows",
      middle: "process-flow",
      lower: "icon-metric-columns",
    },
  },
  madagascar: {
    subType: "location/island",
    compositionPattern: "place-scenic-wide",
    motifStrategy: "island-contour",
    supportingPanelStyle: "map-geography",
    mapStyle: "world-map-pin",
    atAGlanceStyle: "island-shape-stats",
    moduleStyles: {
      hero: "scenic-location",
      facts: "compact-fact-rows",
      middle: "world-map-pin",
      lower: "island-shape-stats",
    },
  },
  "ada-lovelace": {
    subType: "person/historical-scientist",
    compositionPattern: "portrait-right-text-left",
    motifStrategy: "technical-sketch",
    supportingPanelStyle: "vertical-timeline",
    mapStyle: "none",
    atAGlanceStyle: "icon-metric-columns",
    moduleStyles: {
      hero: "portrait-editorial",
      facts: "compact-fact-rows",
      middle: "vertical-timeline",
      lower: "icon-metric-columns",
    },
  },
  "emperor-penguin": {
    subType: "fauna/polar-animal",
    compositionPattern: "species-closeup-with-environment",
    motifStrategy: "snow-habitat-rings",
    supportingPanelStyle: "lifecycle-loop",
    mapStyle: "habitat-range",
    atAGlanceStyle: "lifecycle-loop",
    moduleStyles: {
      hero: "species-closeup-with-environment",
      facts: "compact-fact-rows",
      middle: "habitat-range",
      lower: "lifecycle-loop",
    },
  },
  "coast-redwood": {
    subType: "flora/tree",
    compositionPattern: "tall-subject-forest-depth",
    motifStrategy: "growth-rings",
    supportingPanelStyle: "height-comparison",
    mapStyle: "range-glass",
    atAGlanceStyle: "height-comparison",
    moduleStyles: {
      hero: "scenic-location",
      facts: "compact-fact-rows",
      middle: "range-glass",
      lower: "height-comparison",
    },
  },
  "apollo-11-moon-landing": {
    subType: "event/space-mission",
    compositionPattern: "archival-event-scene",
    motifStrategy: "orbital",
    supportingPanelStyle: "horizontal-mission-timeline",
    mapStyle: "us-places-map",
    atAGlanceStyle: "timeline-icons",
    moduleStyles: {
      hero: "archival-event-scene",
      facts: "compact-fact-rows",
      middle: "us-places-map",
      lower: "horizontal-mission-timeline",
    },
  },
};

function cleanText(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function searchText(query, title, summary = "") {
  return `${query} ${title} ${summary}`.toLowerCase();
}

function topicKey(value) {
  return cleanText(value, 160)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalVisualOverride(query, title) {
  const keys = [topicKey(title), topicKey(query)];
  if (/\binternet\b/.test(`${query} ${title}`.toLowerCase())) keys.push("internet");
  if (/\bmadagascar\b/.test(`${query} ${title}`.toLowerCase())) keys.push("madagascar");
  if (/\bada-lovelace\b/.test(keys.join(" "))) keys.push("ada-lovelace");
  if (/\bemperor-penguin/.test(keys.join(" "))) keys.push("emperor-penguin");
  if (/\bcoast-redwood/.test(keys.join(" "))) keys.push("coast-redwood");
  if (/\bapollo-11\b/.test(keys.join(" ")) || /\bapollo-eleven\b/.test(keys.join(" "))) keys.push("apollo-11-moon-landing");
  return keys.map((key) => CANONICAL_VISUAL_OVERRIDES[key]).find(Boolean) || null;
}

function includesAny(value, words) {
  const text = cleanText(value, 900).toLowerCase();
  return words.some((word) => text.includes(word));
}

export function inferKnowledgeSubtype({ type = "concept", query = "", title = "", summary = "" } = {}) {
  const queryType = TYPE_DEFAULTS[type] ? type : "concept";
  const text = searchText(query, title, summary);
  const rule = SUBTYPE_RULES.find((candidate) => candidate.type === queryType && includesAny(text, candidate.words));
  const fallback = TYPE_DEFAULTS[queryType];
  return {
    queryType,
    subType: rule?.subType || fallback.subType,
    compositionPattern: rule?.pattern || fallback.pattern,
    motifType: rule?.motif || fallback.motif,
    supportingPanelStyle: fallback.supportingPanelStyle,
    mapStyle: fallback.mapStyle,
    badgeStyle: fallback.badgeStyle,
    atAGlanceStyle: fallback.atAGlanceStyle,
  };
}

function imageAspect(image) {
  const width = Number(image?.width || 0);
  const height = Number(image?.height || 0);
  return width > 0 && height > 0 ? width / height : null;
}

function subjectBehindTextRisk(pattern, image) {
  const x = Number(image?.focalPoint?.x);
  if (!Number.isFinite(x)) return 8;
  const textSafeZone = COMPOSITION_PATTERNS[pattern]?.textSafeZone;
  if (textSafeZone === "left" && x < 0.46) return 24;
  if (textSafeZone === "right" && x > 0.54) return 24;
  return 0;
}

export function scoreHeroCompositionQuality({ image = null, visualPlan = null, candidateScore = null, fallbackReason = "" } = {}) {
  const reasons = [];
  let score = 56;
  const pattern = visualPlan?.compositionPattern || "fallback-graphic";
  const patternData = COMPOSITION_PATTERNS[pattern] || COMPOSITION_PATTERNS["fallback-graphic"];

  if (image?.url) {
    score += 12;
    reasons.push("base_image_present");
    const width = Number(image.width || 0);
    const height = Number(image.height || 0);
    const aspect = imageAspect(image);
    if (width >= 900 && height >= 500) score += 10;
    else {
      score -= 16;
      reasons.push("dimensions_low_or_unknown");
    }
    if (aspect && aspect >= 1.2 && aspect <= 2.4) score += 8;
    else if (aspect) {
      score -= 10;
      reasons.push("awkward_crop_ratio");
    }
    if (image.focalPoint) score += 8;
    else reasons.push("missing_focal_point");
    if (image.tone === DEFAULT_TONE) score += 8;
    else reasons.push("tone_not_confirmed");
    if (Number.isFinite(Number(candidateScore))) {
      const normalized = Math.max(-20, Math.min(18, (Number(candidateScore) - 55) / 2));
      score += normalized;
      if (candidateScore < 55) reasons.push("candidate_score_low");
    }
    const textRisk = subjectBehindTextRisk(pattern, image);
    score -= textRisk;
    if (textRisk) reasons.push("subject_may_conflict_with_text_safe_zone");
  } else if (visualPlan?.heroStrategy === "abstract-concept" || visualPlan?.heroStrategy === "fallback-graphic") {
    score += 4;
    reasons.push("intentional_native_fallback");
  } else {
    score -= 18;
    reasons.push(fallbackReason || "missing_base_image");
  }

  if (visualPlan?.motifStrategy && visualPlan.motifStrategy !== "none") {
    score += 9;
    reasons.push("supporting_motif_enriches_composition");
  }
  if (patternData.echoMotifInInsight) score += 3;
  if (patternData.overlayIntensity === "high" || patternData.overlayIntensity === "medium-high") score += 4;

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  if (finalScore < 60) reasons.push("below_art_direction_threshold");
  return { score: finalScore, reasons };
}

function patternFor(subtypePlan, image, imageSourceType, visualNeed) {
  if (!image?.url) {
    if (imageSourceType === "diagram" || visualNeed === "none") return subtypePlan.compositionPattern;
    return "fallback-graphic";
  }
  if (image.cropHint === "right-subject" && subtypePlan.queryType === "person") return "portrait-right-text-left";
  if (image.cropHint === "center-subject" && subtypePlan.queryType === "event") return "archival-event-scene";
  return subtypePlan.compositionPattern;
}

function heroStrategyFor(image, imageSourceType, visualNeed, quality = null) {
  if (image?.url) {
    if (image.assetMode === "generated" || image.mode === "generated") return "generated-hero";
    if (quality?.score < 62) return "retrieved-plus-generated-motif";
    return "retrieved-single-subject";
  }
  if (imageSourceType === "generated") return "generated-hero";
  if (imageSourceType === "diagram" || visualNeed === "none") return "abstract-concept";
  return "fallback-graphic";
}

function focalRegionFor(pattern, image) {
  if (image?.focalPoint) {
    const x = image.focalPoint.x < 0.4 ? "left" : (image.focalPoint.x > 0.6 ? "right" : "center");
    const y = image.focalPoint.y < 0.42 ? "top" : (image.focalPoint.y > 0.62 ? "bottom" : "center");
    return `${x}-${y}`;
  }
  return COMPOSITION_PATTERNS[pattern]?.subjectPlacement || "right-center";
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
  const subtype = inferKnowledgeSubtype({ type, query, title: title || classification.title, summary });
  const override = canonicalVisualOverride(query, title || classification.title);
  const plannedSubtype = override ? {
    ...subtype,
    subType: override.subType || subtype.subType,
    compositionPattern: override.compositionPattern || subtype.compositionPattern,
    motifType: override.motifStrategy || subtype.motifType,
    supportingPanelStyle: override.supportingPanelStyle || subtype.supportingPanelStyle,
    mapStyle: override.mapStyle || subtype.mapStyle,
    atAGlanceStyle: override.atAGlanceStyle || subtype.atAGlanceStyle,
  } : subtype;
  const hasMaps = Array.isArray(profile?.maps) && profile.maps.length > 0;
  const initialPattern = override?.compositionPattern || patternFor(plannedSubtype, image, imageSourceType, visualNeed);
  const provisionalPlan = {
    compositionPattern: initialPattern,
    motifStrategy: plannedSubtype.motifType,
    heroStrategy: image?.url ? "retrieved-single-subject" : "fallback-graphic",
  };
  const candidateScore = image?.score ?? retrieved?.diagnostics?.final?.image?.score ?? null;
  const quality = scoreHeroCompositionQuality({
    image,
    visualPlan: provisionalPlan,
    candidateScore,
    fallbackReason: retrieved?.diagnostics?.final?.fallbackReason,
  });
  const heroStrategy = override?.heroStrategy && !image?.url
    ? override.heroStrategy
    : heroStrategyFor(image, imageSourceType, visualNeed, quality);
  const pattern = heroStrategy === "fallback-graphic" ? "fallback-graphic" : initialPattern;
  const patternData = COMPOSITION_PATTERNS[pattern] || COMPOSITION_PATTERNS["fallback-graphic"];
  const candidates = candidateSummary(retrieved);
  const concrete = plannedSubtype.queryType !== "concept" || imageSourceType === "known";

  return {
    visualFamily: VISUAL_FAMILY,
    designPrinciples: KNOWLEDGE_DESIGN_PRINCIPLES,
    typeCompositionContract: TYPE_COMPOSITION_CONTRACTS[plannedSubtype.queryType] || TYPE_COMPOSITION_CONTRACTS.concept,
    queryType: plannedSubtype.queryType,
    subType: plannedSubtype.subType,
    compositionPattern: pattern,
    heroStrategy,
    textSafeZone: patternData.textSafeZone,
    focalRegion: focalRegionFor(pattern, image),
    tone: image?.tone || DEFAULT_TONE,
    contrastLevel: image?.url ? patternData.overlayIntensity : "high",
    motifStrategy: plannedSubtype.motifType,
    motifPlacement: patternData.motifPlacement,
    supportingPanelStyle: plannedSubtype.supportingPanelStyle,
    mapStyle: hasMaps ? plannedSubtype.mapStyle : "none",
    badgeStyle: plannedSubtype.badgeStyle,
    atAGlanceStyle: plannedSubtype.atAGlanceStyle,
    moduleStyles: override?.moduleStyles || {
      hero: image?.url ? plannedSubtype.compositionPattern : (plannedSubtype.queryType === "concept" ? "native-concept-hero" : "fallback-graphic"),
      facts: "compact-fact-rows",
      middle: hasMaps ? plannedSubtype.mapStyle : plannedSubtype.supportingPanelStyle,
      lower: plannedSubtype.atAGlanceStyle,
    },
    backgroundTreatment: image?.url ? "navy-glass-vignette" : "navy-abstract-linework",
    concrete,
    contentDensity: cleanText(summary).length > 260 ? "dense" : "standard",
    candidateSummary: candidates,
    compositionConstraints: patternData,
    quality,
    retryPolicy: { maxAttempts: image?.url || visualNeed === "none" ? 1 : 3 },
  };
}

function objectPositionFor(image, pattern) {
  if (image?.focalPoint) {
    return `${Math.round(image.focalPoint.x * 100)}% ${Math.round(image.focalPoint.y * 100)}%`;
  }
  const placement = COMPOSITION_PATTERNS[pattern]?.subjectPlacement || "right-center";
  if (placement.includes("right")) return "66% 48%";
  if (placement.includes("center")) return "50% 50%";
  return "58% 50%";
}

export function buildHeroCompositionPackage(visualPlan, image = null) {
  const plan = visualPlan || buildKnowledgeVisualPlan({ image });
  const patternData = COMPOSITION_PATTERNS[plan.compositionPattern] || COMPOSITION_PATTERNS["fallback-graphic"];
  const mode = image?.assetMode || image?.mode || (plan.heroStrategy === "fallback-graphic" || plan.heroStrategy === "abstract-concept" ? "fallback" : "retrieved");
  return {
    pattern: plan.compositionPattern,
    strategy: plan.heroStrategy,
    textSafeZone: plan.textSafeZone,
    focalRegion: plan.focalRegion,
    tone: plan.tone,
    motifStrategy: plan.motifStrategy,
    backgroundTreatment: plan.backgroundTreatment,
    mode,
    visualPlan: plan,
    baseImage: image?.url ? {
      url: image.url,
      source: image.source || null,
      sourceUrl: image.sourceUrl || null,
      width: image.width || null,
      height: image.height || null,
      focalPoint: image.focalPoint || null,
      cropHint: image.cropHint || null,
    } : null,
    overlays: {
      leftGradient: patternData.textSafeZone === "left",
      navyTone: true,
      vignette: patternData.overlayIntensity === "high" ? "strong" : "soft",
      noiseTexture: false,
    },
    motif: {
      type: motifRenderType(plan.motifStrategy),
      assetKey: plan.motifStrategy || "none",
      placement: plan.motifPlacement || patternData.motifPlacement,
      opacity: image?.url ? 0.34 : 0.52,
      echoInInsight: patternData.echoMotifInInsight,
    },
    subjectMask: {
      enabled: false,
      helpful: patternData.subjectMaskHelpful,
    },
    composition: {
      pattern: plan.compositionPattern,
      objectPosition: objectPositionFor(image, plan.compositionPattern),
      textSafeZone: plan.textSafeZone,
      negativeSpaceScore: plan.textSafeZone === "left" && image?.focalPoint?.x < 0.46 ? 42 : 82,
      preferredCropRatio: patternData.cropRatio,
      secondaryImageBlending: patternData.secondaryImageBlending,
    },
    quality: plan.quality || scoreHeroCompositionQuality({ image, visualPlan: plan }),
  };
}

function motifRenderType(strategy = "") {
  if (/node|network|field/.test(strategy)) return "lineart";
  if (/orbital|arc/.test(strategy)) return "orbital";
  if (/botanical|growth|leaf/.test(strategy)) return "botanical";
  if (/technical|manuscript|sketch/.test(strategy)) return "technical-sketch";
  if (/snow|habitat|wave|contour|island/.test(strategy)) return "halo";
  if (!strategy || strategy === "none") return "none";
  return "diagrammatic";
}

export function artDirectedHeroPrompt({ title = "", visualPlan = null } = {}) {
  const plan = visualPlan || buildKnowledgeVisualPlan({ title });
  const subject = cleanText(title || "this topic", 120);
  const subtype = plan.subType || "knowledge topic";
  return [
    `Create a wide editorial no-text hero visual for "${subject}".`,
    `Topic subtype: ${subtype}.`,
    `Composition: ${plan.compositionPattern}; subject/focus in ${plan.focalRegion}; text-safe area on ${plan.textSafeZone}.`,
    `Use ${plan.motifStrategy} as a subtle supporting visual motif.`,
    "Use a dark navy cinematic Home Center palette with readable negative space.",
    "No text. No labels. No UI. No poster. No infographic panels. No logos.",
  ].join("\n");
}
