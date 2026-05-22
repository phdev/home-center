/**
 * Compatibility entry point for the deterministic Home Center state model.
 *
 * The implementation lives in src/core/derivations so all callers share the
 * same rawData -> derivations -> derivedState path.
 */

export { computeDerivedState, emptyRawState } from "../core/derivations";
