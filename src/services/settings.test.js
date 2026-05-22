import { beforeEach, describe, expect, it } from "vitest";
import { getSettings } from "./settings";

describe("settings image model", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalizes legacy saved image models to GPT Image 2", () => {
    localStorage.setItem("homeCenter_settings", JSON.stringify({
      llm: {
        apiKey: "test-key",
        model: "gpt-4o-mini",
        imageModel: "dall-e-3",
      },
    }));

    expect(getSettings().llm.imageModel).toBe("gpt-image-2");
  });
});
