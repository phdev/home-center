import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FullKnowledgePage } from "./FullKnowledgePage";

afterEach(() => {
  cleanup();
});

function response(overrides = {}) {
  return {
    query: "How big is the Sun?",
    title: "How big is the Sun?",
    summary: "The Sun is enormous.",
    sections: [],
    infographic: null,
    imageUrl: "https://example.test/sun.jpg",
    image: {
      url: "https://example.test/sun.jpg",
      source: "NASA",
      mode: "retrieved",
      sourceUrl: "https://images.nasa.gov/details/sun",
    },
    visual: {
      source: "NASA",
      mode: "retrieved",
      metadata: { retrievalSource: "NASA" },
    },
    ...overrides,
  };
}

describe("FullKnowledgePage", () => {
  it("labels retrieved image sources in the hero card", () => {
    render(<FullKnowledgePage response={response()} onBack={() => {}} />);

    expect(screen.getByText("NASA · retrieved source image")).toBeTruthy();
  });

  it("labels generated visuals distinctly from retrieved imagery", () => {
    render(<FullKnowledgePage response={response({
      image: {
        url: "data:image/jpeg;base64,ZmFrZQ==",
        source: "GPT Image 2",
        mode: "generated",
      },
      visual: {
        source: "GPT Image 2",
        mode: "generated",
        metadata: { generator: "openai" },
      },
    })} onBack={() => {}} />);

    expect(screen.getByText("GPT Image 2 · generated raw visual")).toBeTruthy();
  });

  it("applies curated focal point and crop hints to the hero image", () => {
    render(<FullKnowledgePage response={response({
      image: {
        url: "https://example.test/ada.jpg",
        source: "Curated Archive",
        mode: "pinned",
        sourceUrl: "https://example.test/ada",
        focalPoint: { x: 0.72, y: 0.42 },
        cropHint: "right-subject",
        tone: "home-center-dark",
      },
      visualPlan: {
        visualFamily: "editorial-knowledge-v1",
        queryType: "person",
        subType: "historical-scientist",
        compositionPattern: "portrait-right-text-left",
        heroStrategy: "retrieved-single-subject",
        textSafeZone: "left",
        focalRegion: "right-center",
        tone: "home-center-dark",
        contrastLevel: "medium-high",
        motifStrategy: "analytical-linework",
        supportingPanelStyle: "timeline-history",
        mapStyle: "none",
        badgeStyle: "gold-person",
        atAGlanceStyle: "legacy-pillars",
        backgroundTreatment: "navy-glass-vignette",
        retryPolicy: { maxAttempts: 1 },
      },
    })} onBack={() => {}} />);

    const image = screen.getByAltText("How big is the Sun?");
    const hero = image.closest(".knowledge-hero");
    expect(image.style.objectPosition).toBe("72% 42%");
    expect(image.closest(".knowledge-hero-visual").className).toContain("knowledge-hero-visual-right-subject");
    expect(hero.className).toContain("knowledge-hero-composition-portrait-right-text-left");
    expect(hero.className).toContain("knowledge-hero-strategy-retrieved-single-subject");
    expect(screen.getByText("Curated Archive · curated hero image")).toBeTruthy();
  });

  it("shows a generating placeholder while the image is pending", () => {
    render(<FullKnowledgePage response={response({
      imageUrl: null,
      image: null,
      imagePending: true,
      visual: {
        source: "none",
        mode: "none",
        metadata: { reason: "image_generating" },
      },
    })} onBack={() => {}} />);

    expect(screen.getByText("GPT Image 2 · generating raw visual")).toBeTruthy();
  });

  it("renders query-type profile maps and infographic modules", () => {
    render(<FullKnowledgePage response={response({
      type: "location",
      profile: {
        facts: [{ label: "Area", value: "587,041 km²", detail: "Island country off Africa." }],
        maps: [
          { scope: "world", label: "World map", value: "Indian Ocean" },
          { scope: "continent", label: "Continent map", value: "Africa" },
        ],
        relatedConcepts: [],
      },
      infographics: [{
        title: "Island scale",
        kind: "comparison",
        description: "Compare Madagascar with nearby land areas.",
        items: [{ label: "Area", value: "587,041 km²" }],
      }],
    })} onBack={() => {}} />);

    expect(screen.getAllByText("LOCATION").length).toBeGreaterThan(0);
    expect(screen.getAllByText("587,041 km²").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("World map")).toBeTruthy();
    expect(screen.getByText("Island scale")).toBeTruthy();
  });

  it("renders every knowledge type with the expected category label", () => {
    for (const [type, label] of [
      ["location", "LOCATION"],
      ["person", "PERSON"],
      ["fauna", "FAUNA"],
      ["flora", "FLORA"],
      ["event", "EVENT"],
      ["concept", "CONCEPT"],
    ]) {
      const { unmount } = render(<FullKnowledgePage response={response({ type })} onBack={() => {}} />);
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it("renders the expected type-specific supporting cards", () => {
    const cases = [
      {
        type: "location",
        expected: ["Map", "At a Glance"],
        data: { profile: { maps: [{ scope: "world", label: "World", value: "Madagascar" }] } },
      },
      {
        type: "person",
        expected: ["Timeline", "Legacy Signals"],
        data: { timeline: [{ date: "1843", label: "Published notes", description: "Early computing work." }] },
      },
      {
        type: "fauna",
        expected: ["Map", "Lifecycle"],
        data: { profile: { maps: [{ scope: "world", label: "Habitat", value: "Antarctica" }] } },
      },
      {
        type: "flora",
        expected: ["Map", "Lifecycle"],
        data: { profile: { maps: [{ scope: "world", label: "Range", value: "California coast" }] } },
      },
      {
        type: "event",
        expected: ["Map", "Timeline"],
        data: { timeline: [{ date: "1969", label: "Landing", description: "Apollo 11 touched down." }] },
      },
      {
        type: "concept",
        expected: ["How It Works", "Concept Map"],
        data: {},
      },
    ];

    for (const item of cases) {
      const { unmount } = render(<FullKnowledgePage response={response({ type: item.type, ...item.data })} onBack={() => {}} />);
      for (const label of item.expected) {
        expect(screen.getByText(label)).toBeTruthy();
      }
      unmount();
    }
  });

  it("renders related topic chips and a no-image fallback", () => {
    render(<FullKnowledgePage response={response({
      imageUrl: null,
      image: null,
      type: "concept",
      profile: { facts: [], maps: [], relatedConcepts: ["packet switching", "protocols"] },
    })} onBack={() => {}} />);

    expect(screen.getByText("packet switching")).toBeTruthy();
    expect(screen.getByText("protocols")).toBeTruthy();
    expect(screen.getByText("Facts unavailable")).toBeTruthy();
  });
});
