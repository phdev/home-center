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

/**
 * @typedef {Object} CardDef
 * @property {string} id
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
    placement: "overlay",
    tier: 1,
    visible: (d) => d.bedtimeReminderActive,
    Component: BedtimeToast,
    enhancementFeature: "bedtime",
  },
  {
    id: "lunchDecision",
    placement: "contextualSlot",
    tier: 2,
    visible: (d) => d.lunchDecisionNeeded,
    deadlineTs: () => todayAt(22).getTime(),
    Component: LunchCard,
    enhancementFeature: "lunch",
  },
  {
    id: "takeoutDecision",
    placement: "contextualSlot",
    tier: 2,
    visible: (d) => d.takeoutDecisionPending,
    deadlineTs: () => todayAt(20).getTime(),
    Component: TakeoutCard,
    enhancementFeature: "takeout",
  },
  {
    id: "morningChecklist",
    placement: "contextualSlot",
    tier: 4,
    visible: (d) => d.showMorningChecklist,
    deadlineTs: () => todayAt(9).getTime(),
    Component: MorningChecklistCard,
    enhancementFeature: "morningChecklist",
  },
  {
    id: "clawSuggestions",
    placement: "rightColumn",
    tier: 3,
    visible: (d) => d.showClawSuggestions,
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
  const candidates = CARDS.filter(
    (c) => c.placement === "contextualSlot" && c.visible(derived),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const da = a.deadlineTs?.(derived) ?? Infinity;
    const db = b.deadlineTs?.(derived) ?? Infinity;
    return da - db;
  });
  return candidates[0];
}

export function pickRightColumnCards(derived) {
  return CARDS.filter(
    (c) => c.placement === "rightColumn" && c.visible(derived),
  );
}

export function pickOverlays(derived) {
  return CARDS.filter((c) => c.placement === "overlay" && c.visible(derived));
}

function todayAt(h, m = 0) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
