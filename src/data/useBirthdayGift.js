import { useCallback } from "react";
import { writeWithFallback } from "./_storage";

const LOCAL_KEY = "hc:birthdayGiftOverrides";

/**
 * Writer for a birthday's gift status. Routes through the worker when
 * configured, otherwise writes to localStorage — components call this
 * without knowing which.
 *
 * Valid statuses: 'unknown' | 'needed' | 'ordered' | 'ready'.
 *
 * @param {{url?:string, token?:string}} [workerSettings]
 */
export function useBirthdayGiftWriter(workerSettings) {
  return useCallback(
    /**
     * @param {string} id
     * @param {{giftStatus:'unknown'|'needed'|'ordered'|'ready', giftNotes?:string}} patch
     */
    async (id, patch) => {
      const current = readLocalMap();
      const next = {
        ...current,
        [id]: {
          giftStatus: patch.giftStatus,
          giftNotes: patch.giftNotes ?? current[id]?.giftNotes ?? null,
          updatedAt: new Date().toISOString(),
        },
      };
      await writeWithFallback({
        workerSettings,
        path: `/api/birthdays/${encodeURIComponent(id)}`,
        method: "PATCH",
        body: { giftStatus: patch.giftStatus, giftNotes: patch.giftNotes ?? null },
        writeLocalOnFailure: () => writeLocalMap(next),
        writeLocalOnSuccess: () => writeLocalMap(next),
      });
      window.dispatchEvent(new CustomEvent("hc:birthday-gift-updated", { detail: next }));
      return next[id];
    },
    [workerSettings?.url, workerSettings?.token],
  );
}

/**
 * Reads the local-overrides map. Used by the Birthdays component to merge
 * optimistic updates on top of the upstream fetch until it re-syncs.
 */
export function readGiftOverrides() {
  return readLocalMap();
}

function readLocalMap() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalMap(m) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(m));
  } catch {}
}
