import { useState, useCallback } from "react";
import { getSettings, saveSettings } from "../services/settings";

export function useSettings() {
  const [settings, setSettings] = useState(getSettings);

  const update = useCallback((newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const updateSection = useCallback(
    (section, values) => {
      setSettings((prev) => {
        const next = { ...prev, [section]: { ...prev[section], ...values } };
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  return { settings, update, updateSection };
}
