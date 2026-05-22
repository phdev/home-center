import { SchoolUpdatesCard } from "../ui/cards/SchoolUpdatesCard";

/**
 * Legacy dashboard slot wrapper. New code should pass a card from the
 * intervention engine; the derived fallback keeps older tests and call sites
 * working while decisions move out of UI components.
 */
export function EventsPanel({ card, derived, selected }) {
  const renderCard =
    card ??
    {
      id: "school-updates",
      type: "SchoolUpdatesCard",
      priority: derived?.hasUrgentSchoolItem ? "urgent" : "important",
      timeContext: {},
      shouldDisplay: true,
      reason: "Legacy derived-state fallback.",
      data: {
        items: derived?.rankedSchoolItems ?? [],
        urgent: !!derived?.hasUrgentSchoolItem,
      },
    };

  return <SchoolUpdatesCard card={renderCard} selected={selected} />;
}
