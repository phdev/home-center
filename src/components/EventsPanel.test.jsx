import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventsPanel } from "./EventsPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mkItem(overrides = {}) {
  return {
    id: overrides.id ?? "i1",
    kind: overrides.kind ?? "action",
    title: overrides.title ?? "Sign science fair waiver",
    summary: overrides.summary ?? "Please sign and return.",
    urgency: overrides.urgency ?? 0.4,
    dueDate: overrides.dueDate,
    child: overrides.child,
    extractionSource: "regex",
    sourceEmailId: "e1",
  };
}

function derived({ items = [], urgent = false } = {}) {
  return {
    rankedSchoolItems: items,
    hasUrgentSchoolItem: urgent,
  };
}

describe("EventsPanel — visibility & data are derived-state-driven", () => {
  it("renders the empty state when derived has no items", () => {
    render(<EventsPanel derived={derived()} />);
    expect(screen.getByText(/no school updates/i)).toBeTruthy();
  });

  it("renders exactly the items in derived.rankedSchoolItems, preserving order", () => {
    const items = [
      mkItem({ id: "a", title: "Urgent action", kind: "action", urgency: 0.9 }),
      mkItem({ id: "b", title: "Book fair", kind: "event", urgency: 0.3 }),
      mkItem({ id: "c", title: "Newsletter", kind: "info", urgency: 0.1 }),
    ];
    render(<EventsPanel derived={derived({ items, urgent: true })} />);
    const rendered = items.map((i) => screen.getByTestId(`school-item-${i.id}`));
    // Order in the DOM matches the order in derived.rankedSchoolItems
    expect(
      rendered[0].compareDocumentPosition(rendered[1]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      rendered[1].compareDocumentPosition(rendered[2]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the kind chip label for each item", () => {
    const items = [
      mkItem({ id: "a", kind: "action" }),
      mkItem({ id: "b", kind: "event" }),
      mkItem({ id: "c", kind: "reminder" }),
    ];
    render(<EventsPanel derived={derived({ items })} />);
    expect(screen.getByText("ACTION")).toBeTruthy();
    expect(screen.getByText("EVENT")).toBeTruthy();
    expect(screen.getByText("REMINDER")).toBeTruthy();
  });

  it("shows item count in the header badge from rankedSchoolItems.length", () => {
    const items = [mkItem({ id: "a" }), mkItem({ id: "b" }), mkItem({ id: "c" })];
    render(<EventsPanel derived={derived({ items })} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("does not throw when derived is undefined", () => {
    expect(() => render(<EventsPanel />)).not.toThrow();
    expect(screen.getByText(/no school updates/i)).toBeTruthy();
  });

  it("does not read from the network / raw worker hook", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<EventsPanel derived={derived({ items: [mkItem()] })} />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not accept a legacy `updates` prop", () => {
    // Passing a raw updates prop must not affect rendering — we route only
    // through derived.rankedSchoolItems. This is an invariant contract test.
    const updates = [{ id: "legacy", title: "Legacy", kind: "info" }];
    render(<EventsPanel updates={updates} derived={derived()} />);
    expect(screen.queryByText("Legacy")).toBeNull();
    expect(screen.getByText(/no school updates/i)).toBeTruthy();
  });
});
