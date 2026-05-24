export const VISUAL_FAMILIES = ["editorial-knowledge-v1"];

export const COMPOSITION_PATTERNS = [
  "portrait-right-text-left",
  "landscape-right-text-left",
  "centered-subject-soft-vignette",
  "environmental-depth-scene",
  "abstract-concept",
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
  compositionPattern: "abstract-concept",
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
  backgroundTreatment: "navy-abstract-linework",
  retryPolicy: { maxAttempts: 3 },
};
