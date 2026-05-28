import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NeedsActionPanel } from "../App";

function action(index) {
  return {
    id: `action-${index}`,
    kind: "Action",
    tone: index === 0 ? "urgent" : "neutral",
    meta: "School",
    title: `Action ${index + 1}`,
    detail: `Do item ${index + 1}`,
  };
}

describe("NeedsActionPanel", () => {
  it.each([0, 1, 3, 8])("renders %i actions without clipping the list", (count) => {
    const actions = Array.from({ length: count }, (_, index) => action(index));
    const { container } = render(<NeedsActionPanel actions={actions} />);

    expect(screen.getByText(String(count))).toBeTruthy();
    const list = container.querySelector("[data-testid='needs-action-list']");
    expect(list).toBeTruthy();
    expect(within(list).queryAllByRole("button")).toHaveLength(count);
    expect(list.style.overflowY).toBe("auto");
    expect(list.style.minHeight).toBe("0");
    expect(list.style.flex).toBe("1 1 0%");

    for (const item of actions) {
      expect(within(list).getByText(item.title)).toBeTruthy();
    }
  });

  it("shows suggested-action detail for event-toned items", () => {
    render(<NeedsActionPanel actions={[{
      id: "school-event",
      kind: "Event",
      tone: "event",
      meta: "School",
      title: "Walking Field Trip to Franklin Park",
      detail: "Note the June 5 field trip on your calendar.",
    }]} />);

    expect(screen.getByText("Walking Field Trip to Franklin Park")).toBeTruthy();
    expect(screen.getByText("Note the June 5 field trip on your calendar.")).toBeTruthy();
  });
});
