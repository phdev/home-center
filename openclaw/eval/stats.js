export function summarize(samples) {
  const values = samples
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: 0, stdev: 0, p50: 0, p90: 0, p95: 0, max: 0, min: 0 };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance = n > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
    : 0;

  return {
    n,
    mean,
    stdev: Math.sqrt(variance),
    p50: quantile(values, 0.5),
    p90: quantile(values, 0.9),
    p95: quantile(values, 0.95),
    max: values[n - 1],
    min: values[0],
  };
}

export function wilsonInterval(passes, total, z = 1.96) {
  if (total === 0) return [0, 1];
  const n = total;
  const p = passes / total;
  const z2 = z ** 2;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator;
  return [
    Math.max(0, center - margin),
    Math.min(1, center + margin),
  ];
}

function quantile(sortedValues, q) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}
