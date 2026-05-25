export const VISUAL_FAMILIES = ["editorial-knowledge-v1"];

export const KNOWLEDGE_DESIGN_PRINCIPLES = {
  version: "apollo-penguin-reference-v1",
  panelStyle: "transparent-liquid-glass",
  heroTransparency: "match-supporting-panels",
  mapLabelPlacement: "external-callouts",
  timelineConnectorStyle: "segmented-between-icons",
  ornamentStyle: "topic-specific-line-art",
  relatedChipScale: "compact-secondary-nav",
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

export const COMPOSITION_PATTERNS = [
  "portrait-right-text-left",
  "landscape-right-text-left",
  "centered-subject-soft-vignette",
  "environmental-depth-scene",
  "archival-event-scene",
  "object-or-artifact-focus",
  "abstract-concept-orbital",
  "concept-layered-diagram-like",
  "species-closeup-with-environment",
  "place-scenic-wide",
  "tall-subject-forest-depth",
  "multi-subject-fauna-family",
  "fallback-graphic",
];

export const HERO_STRATEGIES = [
  "retrieved-single-subject",
  "retrieved-plus-generated-motif",
  "generated-hero",
  "abstract-concept",
  "fallback-graphic",
];

export const TEXT_SAFE_ZONES = ["left", "right", "balanced"];

export const DEFAULT_VISUAL_PLAN = {
  visualFamily: "editorial-knowledge-v1",
  designPrinciples: KNOWLEDGE_DESIGN_PRINCIPLES,
  typeCompositionContract: TYPE_COMPOSITION_CONTRACTS.concept,
  queryType: "concept",
  subType: "abstract-concept",
  compositionPattern: "abstract-concept-orbital",
  heroStrategy: "abstract-concept",
  textSafeZone: "balanced",
  focalRegion: "center-center",
  tone: "home-center-dark",
  contrastLevel: "high",
  motifStrategy: "systems-linework",
  supportingPanelStyle: "process-concept",
  mapStyle: "none",
  badgeStyle: "violet-concept",
  atAGlanceStyle: "three-pillars",
  moduleStyles: {
    hero: "native-concept-hero",
    facts: "compact-fact-rows",
    middle: "process-flow",
    lower: "icon-metric-columns",
  },
  backgroundTreatment: "navy-abstract-linework",
  retryPolicy: { maxAttempts: 3 },
};
