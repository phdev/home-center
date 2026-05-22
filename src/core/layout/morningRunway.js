export function isMorningRunwayMode(derived, now = new Date(), options = {}) {
  if (options.isHomeView === false) return false;
  if (!derived?.showMorningChecklist) return false;
  const hour = now.getHours();
  return hour >= 7 && hour < 9;
}

export function shouldSuppressStandalonePeterRisk(derived) {
  return !!derived?.showMorningChecklist && !!derived?.peter0800_0900Risk && !derived?.hasMorningOverlap;
}

export function hasUrgentSchoolCard(cards = []) {
  return (cards ?? []).some((card) => card.type === "SchoolUpdatesCard" && card.priority === "urgent");
}
