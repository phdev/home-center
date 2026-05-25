import {
  COMPOSITION_PATTERNS,
  DEFAULT_VISUAL_PLAN,
  HERO_STRATEGIES,
  KNOWLEDGE_DESIGN_PRINCIPLES,
  TEXT_SAFE_ZONES,
  TYPE_COMPOSITION_CONTRACTS,
  VISUAL_FAMILIES,
} from "./visualPlanTypes";

function valueIn(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function text(value, max = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeRetryPolicy(value) {
  const maxAttempts = Number(value?.maxAttempts);
  return { maxAttempts: Number.isFinite(maxAttempts) ? Math.max(1, Math.min(5, maxAttempts)) : 3 };
}

function normalizeModuleStyles(value = {}, fallback = DEFAULT_VISUAL_PLAN.moduleStyles) {
  return {
    hero: text(value.hero || fallback.hero, 48),
    facts: text(value.facts || fallback.facts, 48),
    middle: text(value.middle || fallback.middle, 48),
    lower: text(value.lower || fallback.lower, 48),
  };
}

function normalizeDesignPrinciples(value = {}) {
  return {
    ...KNOWLEDGE_DESIGN_PRINCIPLES,
    ...Object.fromEntries(
      Object.entries(value || {}).map(([key, entry]) => [key, text(entry, 64)]),
    ),
  };
}

function normalizeCompositionContract(queryType, value = {}) {
  const fallback = TYPE_COMPOSITION_CONTRACTS[queryType] || TYPE_COMPOSITION_CONTRACTS.concept;
  return {
    hero: Array.isArray(value.hero) && value.hero.length ? value.hero.map((item) => text(item, 48)) : fallback.hero,
    facts: Array.isArray(value.facts) && value.facts.length ? value.facts.map((item) => text(item, 48)) : fallback.facts,
    middle: Array.isArray(value.middle) && value.middle.length ? value.middle.map((item) => text(item, 48)) : fallback.middle,
    lower: Array.isArray(value.lower) && value.lower.length ? value.lower.map((item) => text(item, 48)) : fallback.lower,
  };
}

export function normalizeVisualPlan(response = {}) {
  const raw = response?.visualPlan || response?.visual?.plan || {};
  const fallback = {
    ...DEFAULT_VISUAL_PLAN,
    queryType: response?.type || DEFAULT_VISUAL_PLAN.queryType,
  };
  const queryType = text(raw.queryType || fallback.queryType, 32);
  return {
    visualFamily: valueIn(raw.visualFamily, VISUAL_FAMILIES, fallback.visualFamily),
    designPrinciples: normalizeDesignPrinciples(raw.designPrinciples),
    typeCompositionContract: normalizeCompositionContract(queryType, raw.typeCompositionContract),
    queryType,
    subType: text(raw.subType || fallback.subType, 48),
    compositionPattern: valueIn(raw.compositionPattern, COMPOSITION_PATTERNS, fallback.compositionPattern),
    heroStrategy: valueIn(raw.heroStrategy, HERO_STRATEGIES, fallback.heroStrategy),
    textSafeZone: valueIn(raw.textSafeZone, TEXT_SAFE_ZONES, fallback.textSafeZone),
    focalRegion: text(raw.focalRegion || fallback.focalRegion, 32),
    tone: text(raw.tone || fallback.tone, 32),
    contrastLevel: text(raw.contrastLevel || fallback.contrastLevel, 32),
    motifStrategy: text(raw.motifStrategy || fallback.motifStrategy, 64),
    supportingPanelStyle: text(raw.supportingPanelStyle || fallback.supportingPanelStyle, 64),
    mapStyle: text(raw.mapStyle || fallback.mapStyle, 48),
    badgeStyle: text(raw.badgeStyle || fallback.badgeStyle, 48),
    atAGlanceStyle: text(raw.atAGlanceStyle || fallback.atAGlanceStyle, 48),
    moduleStyles: normalizeModuleStyles(raw.moduleStyles, fallback.moduleStyles),
    backgroundTreatment: text(raw.backgroundTreatment || fallback.backgroundTreatment, 64),
    retryPolicy: normalizeRetryPolicy(raw.retryPolicy),
  };
}

export function heroCompositionClassNames(plan = DEFAULT_VISUAL_PLAN) {
  return [
    `knowledge-hero-composition-${plan.compositionPattern}`,
    `knowledge-hero-strategy-${plan.heroStrategy}`,
    `knowledge-hero-text-safe-${plan.textSafeZone}`,
    `knowledge-hero-background-${plan.backgroundTreatment}`,
  ].join(" ");
}
