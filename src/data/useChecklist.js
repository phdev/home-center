import { useMemo } from "react";

/**
 * Morning checklist config. Base items always apply; others are gated by
 * weather variants (see deriveState.computeChecklistView).
 *
 * @returns {import('../state/types').ChecklistConfig}
 */
export function useChecklistConfig(settings) {
  return useMemo(() => {
    const override = settings?.checklist;
    if (override?.items?.length) return override;
    return {
      items: [
        { id: "sunscreen", label: "Sunscreen on", condition: "always" },
        { id: "water", label: "Water bottles in backpacks", condition: "always" },
        { id: "jacket", label: "Grab a jacket", condition: "cold" },
        { id: "shorts", label: "Wear shorts (hot day)", condition: "hot" },
        { id: "umbrella", label: "Umbrella in bag", condition: "rain" },
      ],
    };
  }, [settings?.checklist]);
}
