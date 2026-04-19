import { useMemo } from "react";
import { useCalendar } from "../hooks/useCalendar";
import { useWeather } from "../hooks/useWeather";
import { useBirthdays } from "../hooks/useBirthdays";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import { useTakeout } from "./useTakeout";
import { useBedtimeSettings } from "./useBedtime";
import { useChecklistConfig } from "./useChecklist";
import { useLunchDecisions } from "./useLunch";
import { useSchoolLunchMenu } from "./useSchoolLunch";
import { normalizeCalendar } from "./calendar";
import { normalizeBirthdays } from "./birthdays";
import { normalizeSchoolItems } from "./schoolUpdates";
import { normalizeWeather } from "./weather";

/**
 * Hook that composes all raw state into a single RawState shape.
 *
 * @param {Object} settings — from useSettings()
 * @returns {import('../state/types').RawState}
 */
export function useRawState(settings) {
  const cal = useCalendar(settings?.calendar ?? {}, settings?.worker ?? {});
  const weather = useWeather(settings?.weather ?? {});
  const birthdays = useBirthdays(settings?.worker ?? {});
  const school = useSchoolUpdates(settings?.worker ?? {});
  const takeout = useTakeout(settings?.worker);
  const bedtime = useBedtimeSettings(settings);
  const checklist = useChecklistConfig(settings);
  const lunchDecisions = useLunchDecisions(settings?.worker);
  const lunchMenu = useSchoolLunchMenu(settings?.worker);

  return useMemo(
    () => ({
      calendar: { events: normalizeCalendar(cal) },
      weather: { today: normalizeWeather(weather) },
      birthdays: normalizeBirthdays(birthdays),
      bedtime: bedtime ?? [],
      checklist: checklist ?? { items: [] },
      takeout: { today: takeout ?? null },
      lunchDecisions: lunchDecisions ?? {},
      schoolLunchMenu: lunchMenu ?? [],
      schoolItems: normalizeSchoolItems(school),
      settings: {},
    }),
    [cal, weather, birthdays, school, takeout, bedtime, checklist, lunchDecisions, lunchMenu],
  );
}
