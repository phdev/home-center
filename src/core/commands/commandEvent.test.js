import { describe, expect, it } from "vitest";
import { normalizeCommandEvent, normalizeCommandEvents, validateCommandEvent } from "./commandEvent";

describe("CommandEvent contract", () => {
  it("normalizes identical input to identical events", () => {
    const input = {
      source: "voice",
      transcript: "  Hey Homer,\nshow weather  ",
      confidence: 0.91,
      wakewordDetected: true,
      locale: "en-US",
      deviceType: "xvf3800",
      timestamp: 1777672580,
      rawAudio: new Float32Array([0.1, 0.2]),
      providerMetadata: { model: "local" },
    };

    expect(normalizeCommandEvent(input)).toEqual(normalizeCommandEvent(input));
    expect(JSON.stringify(normalizeCommandEvent(input))).toBe(JSON.stringify(normalizeCommandEvent(input)));
  });

  it("normalizes transcript whitespace and invisible characters", () => {
    expect(normalizeCommandEvent({
      source: "voice",
      transcript: " \u200BHey\t Homer,\n\n show   weather ",
    }).transcript).toBe("Hey Homer, show weather");
  });

  it("buckets confidence instead of preserving raw floats", () => {
    expect(normalizeCommandEvent({ confidence: 0.85 }).confidenceBucket).toBe("high");
    expect(normalizeCommandEvent({ confidence: 0.84 }).confidenceBucket).toBe("medium");
    expect(normalizeCommandEvent({ confidence: 0.6 }).confidenceBucket).toBe("medium");
    expect(normalizeCommandEvent({ confidence: 0.59 }).confidenceBucket).toBe("low");
    expect(normalizeCommandEvent({ confidence: null }).confidenceBucket).toBe("unknown");
    expect(normalizeCommandEvent({}).confidenceBucket).toBe("unknown");
  });

  it("preserves already bucketed fixture confidence", () => {
    expect(normalizeCommandEvent({
      source: "fixture",
      transcript: "show school updates",
      confidence: 0.1,
      confidenceBucket: "high",
    }).confidenceBucket).toBe("high");
  });

  it("fills missing optional fields with stable defaults", () => {
    expect(normalizeCommandEvent({ source: "text", transcript: "open calendar" })).toEqual({
      source: "text",
      transcript: "open calendar",
      wakewordDetected: false,
      confidenceBucket: "unknown",
      locale: "und",
      deviceType: "unknown",
    });
  });

  it("normalizes command event arrays for AgentCI replay", () => {
    expect(normalizeCommandEvents([
      { source: "fixture", transcript: " Hey Homer, stop ", confidence: 1 },
      { source: "text", text: "open calendar" },
    ])).toEqual([
      {
        source: "fixture",
        transcript: "Hey Homer, stop",
        wakewordDetected: false,
        confidenceBucket: "high",
        locale: "und",
        deviceType: "unknown",
      },
      {
        source: "text",
        transcript: "open calendar",
        wakewordDetected: false,
        confidenceBucket: "unknown",
        locale: "und",
        deviceType: "unknown",
      },
    ]);
  });

  it("ignores timestamps", () => {
    const first = normalizeCommandEvent({
      source: "voice",
      transcript: "Hey Homer, stop",
      timestamp: 1,
      ts: 1,
    });
    const second = normalizeCommandEvent({
      source: "voice",
      transcript: "Hey Homer, stop",
      timestamp: 999,
      ts: 999,
    });

    expect(first).toEqual(second);
    expect(first).not.toHaveProperty("timestamp");
    expect(first).not.toHaveProperty("ts");
  });

  it("ignores raw audio", () => {
    const normalized = normalizeCommandEvent({
      source: "voice",
      transcript: "Hey Homer, open calendar",
      rawAudio: new Int16Array([1, 2, 3]),
      audioBuffer: [1, 2, 3],
    });

    expect(normalized).not.toHaveProperty("rawAudio");
    expect(normalized).not.toHaveProperty("audioBuffer");
  });

  it("ignores provider-specific metadata and microphone device IDs", () => {
    const normalized = normalizeCommandEvent({
      source: "voice",
      transcript: "Hey Homer, show weather",
      providerMetadata: { alternativeCount: 3 },
      speechRecognitionResult: { isFinal: true },
      microphoneDeviceId: "usb-123",
      deviceId: "hw:1,0",
    });

    expect(normalized).not.toHaveProperty("providerMetadata");
    expect(normalized).not.toHaveProperty("speechRecognitionResult");
    expect(normalized).not.toHaveProperty("microphoneDeviceId");
    expect(normalized).not.toHaveProperty("deviceId");
  });

  it("fails validation for an invalid source", () => {
    expect(validateCommandEvent({
      source: "sensor",
      transcript: "open calendar",
      wakewordDetected: false,
      confidenceBucket: "unknown",
      locale: "und",
      deviceType: "unknown",
    })).toBe(false);
  });

  it("passes validation for a valid voice event", () => {
    expect(validateCommandEvent(normalizeCommandEvent({
      source: "voice",
      transcript: "Hey Homer, open calendar",
      wakewordDetected: true,
      confidence: 0.9,
      locale: "en-US",
      deviceType: "xvf3800",
    }))).toBe(true);
  });

  it("passes validation for a valid fixture event", () => {
    expect(validateCommandEvent(normalizeCommandEvent({
      source: "fixture",
      transcript: "Hey Homer, set a timer for ten seconds",
      wakewordDetected: true,
      confidence: 1,
      locale: "en-US",
      deviceType: "test-fixture",
      createdAt: "2026-05-01T12:00:00Z",
    }))).toBe(true);
  });

  it("rejects extra volatile or provider fields at the boundary", () => {
    expect(validateCommandEvent({
      ...normalizeCommandEvent({ source: "voice", transcript: "Hey Homer, stop" }),
      rawAudio: [1, 2, 3],
    })).toBe(false);
  });
});
