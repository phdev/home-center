import { normalizeEmailTriageToSchoolUpdates } from "../core/email/schoolUpdates";

export function normalizeSchoolItems(hookResult) {
  return normalizeEmailTriageToSchoolUpdates(hookResult);
}
