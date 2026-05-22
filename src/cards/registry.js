/**
 * Central card registry — binds a card component to its visibility rule,
 * tier, and feature key (for OpenClaw enhancement).
 *
 * This is the ONLY place a developer touches to add a new card. Adding a
 * card without updating this file means it's unreachable, which is the
 * intended guardrail.
 *
 * `visible(derived)` must be deterministic and derived-state-driven — do
 * not read props, refs, DOM, or localStorage here.
 *
 * When you add or change a card here, update:
 *   - docs/home_center_ui_card_contracts.md (per-card contract)
 *   - docs/home_center_derived_states.md (if it relies on a new flag)
 * See docs/README.md for the full gbrain contract.
 */

import { MorningChecklistCard } from "./MorningChecklistCard";
import { TakeoutCard } from "./TakeoutCard";
import { LunchCard } from "./LunchCard";
import { BedtimeToast } from "./BedtimeToast";
import { ClawSuggestionsCard } from "./ClawSuggestionsCard";
import { runInterventionEngine } from "../core/interventions/engine";

/**
 * @typedef {Object} CardDef
 * @property {string} id
 * @property {string} engineType
 * @property {'contextualSlot'|'rightColumn'|'overlay'} placement
 * @property {1|2|3|4} tier
 * @property {(derived:import('../state/types').DerivedState)=>boolean} visible
 * @property {(derived:import('../state/types').DerivedState)=>number} [deadlineTs]  sort tie-breaker
 * @property {React.ComponentType<any>} Component
 * @property {string} enhancementFeature
 */

// NOTE: Adding, removing, or changing the `visible` predicate of a card
//       belongs in docs/home_center_ui_card_contracts.md. If the predicate
//       relies on a new derived flag, also update
//       docs/home_center_derived_states.md. See CLAUDE.md → Compound Step.
/** @type {CardDef[]} */
export const CARDS = [
  {
    id: "bedtimeToast",
    engineType: "BedtimeToast",
    placement: "overlay",
    tier: 1,
    visible: visibleViaEngine("BedtimeToast"),
    Component: BedtimeToast,
    enhancementFeature: "bedtime",
  },
  {
    id: "lunchDecision",
    engineType: "LunchCard",
    placement: "contextualSlot",
    tier: 2,
    visible: visibleViaEngine("LunchCard"),
    deadlineTs: () => todayAt(22).getTime(),
    Component: LunchCard,
    enhancementFeature: "lunch",
  },
  {
    id: "takeoutDecision",
    engineType: "TakeoutCard",
    placement: "contextualSlot",
    tier: 2,
    visible: visibleViaEngine("TakeoutCard"),
    deadlineTs: () => todayAt(20).getTime(),
    Component: TakeoutCard,
    enhancementFeature: "takeout",
  },
  {
    id: "morningChecklist",
    engineType: "MorningChecklistCard",
    placement: "contextualSlot",
    tier: 4,
    visible: visibleViaEngine("MorningChecklistCard"),
    deadlineTs: () => todayAt(9).getTime(),
    Component: MorningChecklistCard,
    enhancementFeature: "morningChecklist",
  },
  {
    id: "clawSuggestions",
    engineType: "ClawSuggestionsCard",
    placement: "rightColumn",
    tier: 3,
    visible: visibleViaEngine("ClawSuggestionsCard"),
    Component: ClawSuggestionsCard,
    enhancementFeature: "clawSuggestions",
  },
];

/**
 * Pick the single card to render in the contextual slot.
 * Highest tier wins; on tie, closest deadline.
 *
 * @param {import('../state/types').DerivedState} derived
 * @returns {CardDef|null}
 */
export function pickContextualCard(derived) {
  return firstEngineCardDef(derived, "contextualSlot");
}

export function pickRightColumnCards(derived) {
  return engineCardDefs(derived).filter((c) => c.placement === "rightColumn");
}

export function pickOverlays(derived) {
  return engineCardDefs(derived).filter((c) => c.placement === "overlay");
}

function visibleViaEngine(engineType) {
  return (derived) =>
    runInterventionEngine(derived, registryContext()).some((card) => card.type === engineType);
}

function firstEngineCardDef(derived, placement) {
  return engineCardDefs(derived).find((def) => def.placement === placement) ?? null;
}

function engineCardDefs(derived) {
  return runInterventionEngine(derived, registryContext())
    .map((engineCard) => CARDS.find((def) => def.engineType === engineCard.type))
    .filter(Boolean);
}

function registryContext() {
  return { now: new Date("2026-04-23T12:00:00") };
}

function todayAt(h, m = 0) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
