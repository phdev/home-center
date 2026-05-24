export const VISUAL_FAMILIES = ["editorial-knowledge-v1"];

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
