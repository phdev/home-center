import { useCallback, useEffect, useState } from "react";
import { apiHeaders, apiUrl } from "../services/piLocal";

const STORAGE_KEY = "homeCenter_designSystem";
const VALID = new Set(["v1", "v2"]);

function normalizeDesignSystem(value, fallback = "v2") {
  const normalized = String(value || "").toLowerCase();
  return VALID.has(normalized) ? normalized : fallback;
}

export function useDesignSystem(workerSettings, configuredDesignSystem = "v2") {
  const [designSystem, setDesignSystemState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return normalizeDesignSystem(
      params.get("designSystem") || params.get("ds") || localStorage.getItem(STORAGE_KEY),
      normalizeDesignSystem(configuredDesignSystem),
    );
  });
  const [lastTimestamp, setLastTimestamp] = useState(0);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  useEffect(() => {
    setDesignSystemState((prev) => normalizeDesignSystem(prev, normalizeDesignSystem(configuredDesignSystem)));
  }, [configuredDesignSystem]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, designSystem);
    document.body.dataset.designSystem = designSystem;
    return () => {
      if (document.body.dataset.designSystem === designSystem) {
        delete document.body.dataset.designSystem;
      }
    };
  }, [designSystem]);

  useEffect(() => {
    const url = apiUrl(workerUrl, "/api/design-system");
    if (!url) return undefined;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(url, { headers: apiHeaders(workerToken), cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json();
        const state = data.designSystem || data.design_system;
        const timestamp = Number(state?.timestamp || 0);
        const version = normalizeDesignSystem(state?.version || state?.designSystem || state?.design_system, null);
        if (!version || timestamp <= lastTimestamp) return;
        setLastTimestamp(timestamp);
        setDesignSystemState(version);
      } catch {
        // Pi command server may be offline in development.
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [workerUrl, workerToken, lastTimestamp]);

  const setDesignSystem = useCallback(
    async (value) => {
      const version = normalizeDesignSystem(value);
      const timestamp = Date.now();
      setLastTimestamp(timestamp);
      setDesignSystemState(version);
      const url = apiUrl(workerUrl, "/api/design-system");
      if (!url) return;
      try {
        await fetch(url, {
          method: "POST",
          headers: apiHeaders(workerToken),
          body: JSON.stringify({ version, timestamp }),
        });
      } catch {
        // Local state already switched; remote persistence is best-effort.
      }
    },
    [workerUrl, workerToken],
  );

  return { designSystem, setDesignSystem };
}
