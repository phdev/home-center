import { useEffect, useState } from "react";

/**
 * School lunch menu by date. Worker `/api/school-lunch` ingests district
 * menu PDFs; in the absence of that endpoint we return an empty array and
 * the Lunch Decision card renders a "menu not loaded yet" fallback.
 *
 * @param {{url?:string, token?:string}} [workerSettings]
 * @returns {import('../state/types').SchoolMenuDay[]}
 */
export function useSchoolLunchMenu(workerSettings) {
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!workerSettings?.url) return;
    (async () => {
      try {
        const res = await fetch(`${workerSettings.url}/api/school-lunch`, {
          headers: workerSettings.token
            ? { Authorization: `Bearer ${workerSettings.token}` }
            : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.days)) setMenu(data.days);
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerSettings?.url, workerSettings?.token]);

  return menu;
}
