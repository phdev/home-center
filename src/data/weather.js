/**
 * Normalize weather hook output to a WeatherToday shape.
 * Existing `useWeather` returns `{current, forecast, …}`. We pick today's
 * summary numbers from the first forecast day (or from current if absent).
 */
export function normalizeWeather(hookResult) {
  const today = hookResult?.forecast?.[0] ?? hookResult?.current ?? {};
  const highTempF = toNum(today.highF ?? today.high ?? today.tempF ?? today.temp);
  const lowTempF = toNum(today.lowF ?? today.low ?? highTempF);
  const precipProb = toUnit(today.precipProb ?? today.precipProbability ?? 0);
  return {
    highTempF: Number.isFinite(highTempF) ? highTempF : 70,
    lowTempF: Number.isFinite(lowTempF) ? lowTempF : 55,
    precipProb: Number.isFinite(precipProb) ? precipProb : 0,
    summary: today.summary ?? today.condition ?? "",
  };
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function toUnit(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}
