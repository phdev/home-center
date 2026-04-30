import { computeDerivedState, emptyRawState } from "../derivations";

function defaultContext() {
  return { now: new Date(), user: { isPeter: true } };
}

export function createStateSnapshot(rawData = emptyRawState(), context = defaultContext()) {
  const normalizedRawData = rawData ?? emptyRawState();
  return {
    rawData: normalizedRawData,
    derivedState: computeDerivedState(normalizedRawData, context),
  };
}

export function createHomeCenterStore(initialRawData = emptyRawState(), initialContext = defaultContext()) {
  let rawData = initialRawData ?? emptyRawState();
  let context = initialContext;
  let derivedState = computeDerivedState(rawData, context);
  const listeners = new Set();

  const emit = () => {
    for (const listener of listeners) listener(getSnapshot());
  };

  const recompute = () => {
    derivedState = computeDerivedState(rawData, context);
  };

  const getSnapshot = () => ({ rawData, derivedState });

  return {
    getRawData: () => rawData,
    getDerivedState: () => derivedState,
    getSnapshot,
    setRawData(nextRawData, nextContext = context) {
      rawData = nextRawData ?? emptyRawState();
      context = nextContext;
      recompute();
      emit();
      return getSnapshot();
    },
    updateRawData(patch, nextContext = context) {
      rawData = { ...rawData, ...patch };
      context = nextContext;
      recompute();
      emit();
      return getSnapshot();
    },
    setContext(nextContext) {
      context = nextContext;
      recompute();
      emit();
      return getSnapshot();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const homeCenterStore = createHomeCenterStore();
