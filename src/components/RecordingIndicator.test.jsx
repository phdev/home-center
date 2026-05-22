import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecordingIndicator } from "./RecordingIndicator";

describe("RecordingIndicator", () => {
  afterEach(cleanup);

  it("does not show legacy 50-sample training targets while idle", () => {
    render(<RecordingIndicator active={false} type="positive" count={0} totalPositive={50} totalNegative={50} />);

    expect(screen.getByText("Recorder idle")).toBeTruthy();
    expect(screen.getByText("+0")).toBeTruthy();
    expect(screen.queryByText("+50/50")).toBeNull();
    expect(screen.queryByText("−50/50")).toBeNull();
  });

  it("shows the current recording session count when active", () => {
    render(<RecordingIndicator active type="negative" count={3} totalPositive={50} totalNegative={50} />);

    expect(screen.getByText("− Recording")).toBeTruthy();
    expect(screen.getByText("−3")).toBeTruthy();
  });
});
