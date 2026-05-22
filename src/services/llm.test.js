import { afterEach, describe, expect, it, vi } from "vitest";
import { generateImage } from "./llm";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("image generation model", () => {
  it("pins image generation to GPT Image 2 even when a legacy model is passed", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      data: [{ b64_json: "ZmFrZS1pbWFnZQ==" }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await generateImage("A diagram of the moon", "test-key", "dall-e-3");

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe("gpt-image-2");
  });
});
