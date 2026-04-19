import { useSettings } from "../hooks/useSettings";
import { useEnhancement } from "../ai/openclaw";
import { pickContextualCard, pickOverlays, pickRightColumnCards } from "./registry";

/**
 * Mounts the current winning contextual card. If nothing wins, renders
 * `fallback` (the Photos panel in our default wiring) — caller supplies it.
 */
export function ContextualSlot({ derived, raw, fallback, selected }) {
  const { settings } = useSettings();
  const picked = pickContextualCard(derived);

  const enhancement = useEnhancement(
    picked?.enhancementFeature ?? "__none__",
    pickedState(picked, derived),
    settings?.worker,
    { enabled: !!picked },
  );

  if (!picked) return fallback ?? null;
  const { Component } = picked;
  return (
    <Component
      derived={derived}
      raw={raw}
      enhanced={enhancement.fields}
      selected={selected}
    />
  );
}

/**
 * Right-column cards (currently: ClawSuggestionsCard) — replace Fun Fact
 * slot when visible, fall back to `fallback`.
 */
export function RightColumnCards({ derived, raw, fallback, selected, onAction }) {
  const { settings } = useSettings();
  const cards = pickRightColumnCards(derived);
  const first = cards[0];
  const enhancement = useEnhancement(
    first?.enhancementFeature ?? "__none__",
    pickedState(first, derived),
    settings?.worker,
    { enabled: !!first },
  );
  if (!first) return fallback ?? null;
  const { Component } = first;
  return (
    <Component
      derived={derived}
      raw={raw}
      enhanced={enhancement.fields}
      selected={selected}
      onAction={onAction}
    />
  );
}

/**
 * Overlays (toasts) render over the whole dashboard.
 */
export function OverlayCards({ derived, raw }) {
  const { settings } = useSettings();
  const overlays = pickOverlays(derived);
  return (
    <>
      {overlays.map((c) => (
        <SingleOverlay key={c.id} card={c} derived={derived} raw={raw} settings={settings} />
      ))}
    </>
  );
}

function SingleOverlay({ card, derived, raw, settings }) {
  const enhancement = useEnhancement(
    card.enhancementFeature,
    pickedState(card, derived),
    settings?.worker,
    { enabled: true },
  );
  const { Component } = card;
  return <Component derived={derived} raw={raw} enhanced={enhancement.fields} />;
}

function pickedState(card, derived) {
  if (!card) return null;
  switch (card.enhancementFeature) {
    case "bedtime":
      return derived.bedtimeWindow;
    case "takeout":
      return derived.takeoutState;
    case "lunch":
      return derived.lunchContext;
    case "morningChecklist":
      return derived.checklist;
    case "clawSuggestions":
      return derived.clawSuggestions.map((s) => ({ id: s.id, tier: s.tier, title: s.title }));
    default:
      return null;
  }
}
