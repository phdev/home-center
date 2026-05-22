export function stableJson(value) {
  return `${JSON.stringify(sortObjectKeys(value), null, 2)}\n`;
}

export function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== "object") return value;

  const out = {};
  for (const key of Object.keys(value).sort()) {
    const current = value[key];
    if (current === undefined) continue;
    out[key] = sortObjectKeys(current);
  }
  return out;
}

export function cloneStable(value) {
  return JSON.parse(JSON.stringify(sortObjectKeys(value)));
}
