import { describe, it, expect } from "vitest";
import { normalizeWeather } from "./weather";

describe("normalizeWeather", () => {
  it("returns safe defaults when input is missing", () => {
    const w = normalizeWeather(null);
    expect(w.highTempF).toBe(70);
    expect(w.lowTempF).toBe(55);
    expect(w.precipProb).toBe(0);
    expect(w.summary).toBe("");
  });

  it("reads forecast[0] when present", () => {
    const w = normalizeWeather({
      forecast: [{ highF: 84, lowF: 65, precipProb: 0.2, summary: "Sunny" }],
    });
    expect(w.highTempF).toBe(84);
    expect(w.lowTempF).toBe(65);
    expect(w.precipProb).toBeCloseTo(0.2);
    expect(w.summary).toBe("Sunny");
  });

  it("falls back to current when forecast missing", () => {
    const w = normalizeWeather({ current: { tempF: 68, summary: "Overcast" } });
    expect(w.highTempF).toBe(68);
    expect(w.summary).toBe("Overcast");
  });

  it("converts percent (0..100) precipProb to unit scale", () => {
    const w = normalizeWeather({ forecast: [{ precipProb: 40 }] });
    expect(w.precipProb).toBeCloseTo(0.4);
  });

  it("accepts precipProbability alias", () => {
    const w = normalizeWeather({ forecast: [{ precipProbability: 0.75 }] });
    expect(w.precipProb).toBeCloseTo(0.75);
  });

  it("clamps to defaults when temp fields are non-numeric", () => {
    const w = normalizeWeather({ forecast: [{ highF: "hot" }] });
    expect(w.highTempF).toBe(70);
  });
});
