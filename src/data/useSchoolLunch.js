import { useEffect, useState } from "react";
import { readWithFallback } from "./_storage";

const LOCAL_KEY = "hc:schoolLunch";

/**
 * School lunch menu by date. Ingestion of the district menu PDFs is handled
 * outside this layer (see the documented TODO in worker/src/index.js under
 * `/api/school-lunch`). If the worker has nothing yet we return an empty
 * array and the Lunch Decision card renders a "menu not loaded yet" fallback.
 *
 * @param {{url?:string, token?:string}} [workerSettings]
 * @returns {import('../state/types').SchoolMenuDay[]}
 */
export function useSchoolLunchMenu(workerSettings) {
  const [menu, setMenu] = useState(() => readLocal());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await readWithFallback({
        workerSettings,
        path: "/api/school-lunch",
        readLocal: () => ({ days: readLocal() }),
        writeLocal: (d) => writeLocal(d.days ?? []),
        parse: (d) => (d && Array.isArray(d.days) ? d : null),
      });
      if (!cancelled && data) setMenu(data.days ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [workerSettings?.url, workerSettings?.token]);

  return menu;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(days) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(days));
  } catch {}
}
