import { useMemo } from "react";

/**
 * Bedtime settings per child. Defaults live in code so an empty-settings
 * install still gets reminders. Users can override in settings.
 *
 * @returns {import('../state/types').BedtimeSetting[]}
 */
export function useBedtimeSettings(settings) {
  return useMemo(() => {
    const cfg = settings?.bedtime;
    if (Array.isArray(cfg) && cfg.length > 0) return cfg;
    return [
      {
        childId: "emma",
        childName: "Emma",
        weekday: "20:30",
        weekend: "21:00",
        reminderLeadMin: 30,
      },
      {
        childId: "jack",
        childName: "Jack",
        weekday: "21:00",
        weekend: "21:30",
        reminderLeadMin: 30,
      },
    ];
  }, [settings?.bedtime]);
}
