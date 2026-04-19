import { useEffect, useMemo, useState } from "react";
import { computeDerivedState, emptyRawState } from "./deriveState";
import { useRawState } from "../data/useRawState";

/**
 * React wiring for the derived state.
 *
 * - Pulls all normalized raw inputs from useRawState.
 * - Recomputes derived state on each raw change AND on a ticking clock.
 * - The clock uses `nextMeaningfulTransition` when possible, falling back to
 *   a 30 s tick. This keeps the computation cheap and avoids drift.
 */
export function useDerivedState({ user = { isPeter: true } } = {}) {
  const raw = useRawState();
  const [now, setNow] = useState(() => new Date());

  const derived = useMemo(
    () => computeDerivedState(raw ?? emptyRawState(), { now, user }),
    [raw, now, user],
  );

  useEffect(() => {
    // Primary tick: 30 s. Good enough for minute-aligned bedtime reminders,
    // 16:30 / 18:00 thresholds, and midnight rollover.
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Sharp-edge tick: if `nextMeaningfulTransition` is within the next 30 s,
    // schedule a targeted recompute precisely at that instant so a card
    // doesn't wait up to 30 s to appear/vanish.
    const t = derived.nextMeaningfulTransition;
    if (!t) return;
    const msUntil = new Date(t).getTime() - now.getTime();
    if (msUntil <= 0 || msUntil > 30_000) return;
    const id = setTimeout(() => setNow(new Date()), msUntil + 250);
    return () => clearTimeout(id);
  }, [derived.nextMeaningfulTransition, now]);

  return { raw, derived };
}
