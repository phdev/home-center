import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarPanel } from "./CalendarPanel";
import { BirthdaysPanel } from "./BirthdaysPanel";

describe("live data panels", () => {
  it("does not show mock calendar events when live events are unavailable", () => {
    render(<CalendarPanel events={null} loading={false} error="Unauthorized" />);

    expect(screen.getByText("Unauthorized")).toBeTruthy();
    expect(screen.queryByText("Soccer Practice")).toBeNull();
    expect(screen.getByText("No upcoming events")).toBeTruthy();
  });

  it("does not show mock birthdays when live birthdays are unavailable", () => {
    render(<BirthdaysPanel birthdays={null} loading={false} error="Unauthorized" />);

    expect(screen.getAllByText("Unauthorized").length).toBeGreaterThan(0);
    expect(screen.queryByText("Grandma Sue")).toBeNull();
    expect(screen.getByText("No upcoming birthdays")).toBeTruthy();
  });
});
