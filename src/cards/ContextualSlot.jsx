import { TakeoutCard as EngineTakeoutCard } from "../ui/cards/TakeoutCard";
import { MorningChecklistCard } from "./MorningChecklistCard";
import { LunchCard } from "./LunchCard";
import { BedtimeToast } from "./BedtimeToast";
import { ClawSuggestionsCard } from "./ClawSuggestionsCard";

export function ContextualSlot({ cards = [], derived, raw, fallback, selected }) {
  const picked = firstCardOfType(cards, ["TakeoutCard", "LunchCard", "MorningChecklistCard"]);
  if (!picked) return fallback ?? null;

  if (picked.type === "TakeoutCard") {
    return <EngineTakeoutCard card={picked} selected={selected} />;
  }
  if (picked.type === "LunchCard") {
    return (
      <LunchCard
        derived={derived}
        raw={raw}
        enhanced={picked.enhanced ?? {}}
        selected={selected}
      />
    );
  }
  if (picked.type === "MorningChecklistCard") {
    return (
      <MorningChecklistCard
        derived={derived}
        raw={raw}
        enhanced={picked.enhanced ?? {}}
        selected={selected}
      />
    );
  }
  return fallback ?? null;
}

export function RightColumnCards({ cards = [], derived, raw, fallback, selected, onAction }) {
  const picked = firstCardOfType(cards, ["ClawSuggestionsCard"]);
  if (!picked) return fallback ?? null;
  return (
    <ClawSuggestionsCard
      derived={derived}
      raw={raw}
      enhanced={picked.enhanced ?? {}}
      selected={selected}
      onAction={onAction}
    />
  );
}

export function OverlayCards({ cards = [], derived, raw }) {
  return (
    <>
      {cards
        .filter((card) => card.type === "BedtimeToast")
        .map((card) => (
          <BedtimeToast
            key={card.id}
            derived={derived}
            raw={raw}
            enhanced={card.enhanced ?? {}}
          />
        ))}
    </>
  );
}

function firstCardOfType(cards, types) {
  return (cards ?? []).find((card) => types.includes(card.type)) ?? null;
}
