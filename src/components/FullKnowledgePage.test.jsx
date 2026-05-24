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
        expected: ["On the Map", "At a Glance"],
        data: { profile: { maps: [{ scope: "world", label: "World", value: "Madagascar" }] } },
      },
      {
        type: "person",
        expected: ["Timeline", "Legacy Signals"],
        data: { timeline: [{ date: "1843", label: "Published notes", description: "Early computing work." }] },
      },
      {
        type: "fauna",
        expected: ["On the Map", "Lifecycle"],
        data: { profile: { maps: [{ scope: "world", label: "Habitat", value: "Antarctica" }] } },
      },
      {
        type: "flora",
        expected: ["On the Map", "Lifecycle"],
        data: { profile: { maps: [{ scope: "world", label: "Range", value: "California coast" }] } },
      },
      {
        type: "event",
        expected: ["On the Map", "Timeline"],
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

  it("renders fauna adaptation ornamentation and habitat range map treatment", () => {
    const { container } = render(<FullKnowledgePage response={response({
      type: "fauna",
      sections: [{ heading: "Adaptation", content: "Dense feathers and huddling behavior conserve heat." }],
      profile: { maps: [{ scope: "world", label: "Habitat", highlight: "Antarctica" }] },
      visualPlan: {
        moduleStyles: { middle: "habitat-range", lower: "lifecycle-loop" },
      },
    })} onBack={() => {}} />);

    expect(container.querySelector(".knowledge-insight-ornament-fauna")).toBeTruthy();
    expect(container.querySelector(".knowledge-module-habitat-range")).toBeTruthy();
    expect(container.querySelector("[aria-label='World map']")).toBeTruthy();
    expect(screen.queryByText("ANTARCTICA")).toBeNull();
  });

  it("renders US event maps without an inner map backing or visible place label", () => {
    const { container } = render(<FullKnowledgePage response={response({
      type: "event",
      profile: { maps: [{ scope: "country", label: "United States", highlight: "United States", regionCode: "FL" }] },
    })} onBack={() => {}} />);

    expect(screen.getByLabelText("United States map")).toBeTruthy();
    expect(container.querySelector(".knowledge-map-wrap rect")).toBeFalsy();
    expect(screen.queryByText("FL")).toBeNull();
    expect(screen.queryByText("US")).toBeNull();
  });

  it("renders Apollo 11 with canonical places, full date, result ornament, and mission glance", () => {
    const { container } = render(<FullKnowledgePage response={response({
      query: "What happened during Apollo 11?",
      title: "Apollo 11 Moon Landing",
      type: "event",
      summary: "Apollo 11 was the 1969 NASA mission that first landed humans on the Moon.",
      image: {
        url: "https://example.test/apollo.jpg",
        source: "NASA",
        mode: "pinned",
        focalPoint: { x: 0.62, y: 0.48 },
        cropHint: "center-subject",
      },
      visualPlan: {
        moduleStyles: {
          facts: "compact-fact-rows",
          middle: "us-places-map",
          lower: "horizontal-mission-timeline",
        },
      },
    })} onBack={() => {}} />);

    expect(screen.getByText("July 16-24, 1969")).toBeTruthy();
    expect(screen.getByText("Places")).toBeTruthy();
    expect(screen.getByText("Houston")).toBeTruthy();
    expect(screen.getByText("Cape Canaveral")).toBeTruthy();
    expect(screen.getByText("Result")).toBeTruthy();
    expect(screen.getByText("At a Glance")).toBeTruthy();
    expect(screen.getByText("Lunar Landing")).toBeTruthy();
    expect(container.querySelector("svg.knowledge-insight-earth")).toBeTruthy();
    expect(container.querySelectorAll(".knowledge-us-state-highlight")).toHaveLength(2);
    expect(container.querySelector(".knowledge-module-horizontal-mission-timeline")).toBeTruthy();
    expect(screen.getByAltText("Apollo 11 Moon Landing").style.objectPosition).toBe("50% 50%");
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

  it("does not nest metric grids for standard at-a-glance cards", () => {
    const { container } = render(<FullKnowledgePage response={response({
      type: "person",
      infographics: [{
        title: "Computing Firsts",
        kind: "metrics",
        items: [
          { label: "Known for", value: "Analytical Engine" },
          { label: "Legacy", value: "First programmer" },
        ],
      }],
    })} onBack={() => {}} />);

    expect(container.querySelector(".knowledge-metrics .knowledge-metrics")).toBeFalsy();
    expect(container.querySelectorAll(".knowledge-metric").length).toBeGreaterThanOrEqual(2);
  });

  it("renders a native concept hero visual instead of the generic placeholder", () => {
    const { container } = render(<FullKnowledgePage response={response({
      imageUrl: null,
      image: null,
      type: "concept",
      title: "The Internet",
      summary: "The Internet is a global network that moves data between connected systems.",
      visualPlan: {
        visualFamily: "editorial-knowledge-v1",
        queryType: "concept",
        subType: "concept/network",
        compositionPattern: "abstract-concept-orbital",
        heroStrategy: "abstract-concept",
        textSafeZone: "balanced",
        focalRegion: "center",
        tone: "home-center-dark",
        contrastLevel: "high",
        motifStrategy: "node-mesh",
        supportingPanelStyle: "process-flow",
        mapStyle: "none",
        badgeStyle: "violet-concept",
        atAGlanceStyle: "icon-metric-columns",
        moduleStyles: {
          hero: "native-concept-hero",
          facts: "compact-fact-rows",
          middle: "process-flow",
          lower: "icon-metric-columns",
        },
        backgroundTreatment: "navy-abstract-linework",
        retryPolicy: { maxAttempts: 1 },
      },
      profile: { facts: [], maps: [], relatedConcepts: ["protocols"] },
    })} onBack={() => {}} />);

    expect(container.querySelector(".knowledge-concept-visual")).toBeTruthy();
    expect(container.querySelector(".knowledge-fallback-mark")).toBeFalsy();
  });
});
