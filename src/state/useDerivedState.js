import { useEffect, useMemo, useState } from "react";
import { computeDerivedState, emptyRawState } from "./deriveState";
import { useRawState } from "../data/useRawState";

/** Safety-net tick cadence used whenever `nextMeaningfulTransition` is
 *  missing, invalid, or farther away than we want to wait. */
const FALLBACK_INTERVAL_MS = 60_000;
/** Upper bound for the sharp-edge setTimeout. Beyond this we just let the
 *  fallback interval carry us forward and reschedule on the next tick. */
const MAX_PRECISE_SCHEDULE_MS = 10 * 60_000;

/**
 * React wiring for the derived state.
 *
 * - Pulls all normalized raw inputs from useRawState.
 * - Recomputes derived state on raw change AND on a time tick.
 * - Scheduling:
 *     • Always runs a fallback interval (covers "transition missing" /
 *       "invalid" / "too far out").
 *     • Additionally schedules a setTimeout aimed at
 *       `derived.nextMeaningfulTransition` when that timestamp is valid,
 *       in the future, and within `MAX_PRECISE_SCHEDULE_MS`. The two
 *       mechanisms compose — whichever fires first calls setNow.
 *
 * See docs/home_center_decisions_log.md → "Scheduling uses
 * nextMeaningfulTransition" for the rationale. Changing these constants
 * means updating that entry.
 */
export function useDerivedState({ user = { isPeter: true } } = {}) {
  const raw = useRawState();
  const [now, setNow] = useState(() => new Date());

  const derived = useMemo(
    () => computeDerivedState(raw ?? emptyRawState(), { now, user }),
    [raw, now, user],
  );

  // Fallback interval — always running. Guarantees recompute even if
  // nextMeaningfulTransition is null or unreliable.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), FALLBACK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Sharp-edge setTimeout — only when the transition is known, parseable,
  // in the future, and within the bound.
  useEffect(() => {
    const t = derived.nextMeaningfulTransition;
    if (!t) return;
    const ts = Date.parse(t);
    if (!Number.isFinite(ts)) return;
    const msUntil = ts - now.getTime();
    if (msUntil <= 0) return;
    if (msUntil > MAX_PRECISE_SCHEDULE_MS) return;
    const id = setTimeout(() => setNow(new Date()), msUntil + 250);
    return () => clearTimeout(id);
  }, [derived.nextMeaningfulTransition, now]);

  return { raw, derived };
}

// Exported so tests can lock the constants without reaching into internals.
export const __testing = {
  FALLBACK_INTERVAL_MS,
  MAX_PRECISE_SCHEDULE_MS,
};
