import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKnowledgeFeedbackAcknowledgement } from "./useKnowledgeFeedbackAcknowledgement";
import {
  flagLatestKnowledgeImage,
  flagLatestKnowledgeResponse,
} from "../knowledge/feedback";

vi.mock("../knowledge/feedback", async () => {
  const actual = await vi.importActual("../knowledge/feedback");
  return {
    ...actual,
    flagLatestKnowledgeImage: vi.fn(),
    flagLatestKnowledgeResponse: vi.fn(),
  };
});

describe("useKnowledgeFeedbackAcknowledgement", () => {
  beforeEach(() => {
    flagLatestKnowledgeImage.mockReset();
    flagLatestKnowledgeResponse.mockReset();
  });

  it("flags a recent bad-answer caption and exposes a captured acknowledgement", async () => {
    flagLatestKnowledgeResponse.mockResolvedValue({ ok: true, flagged: true });

    const { result } = renderHook(() =>
      useKnowledgeFeedbackAcknowledgement(
        { text: "Hey Homer, bad answer", ts: 100, stage: "final", age: 0.2 },
        { url: "https://worker.test", token: "token" },
      ),
    );

    expect(result.current).toMatchObject({ kind: "knowledge", status: "saving" });
    await waitFor(() => {
      expect(result.current).toMatchObject({ kind: "knowledge", status: "captured" });
    });
    expect(flagLatestKnowledgeResponse).toHaveBeenCalledTimes(1);
    expect(flagLatestKnowledgeImage).not.toHaveBeenCalled();
  });

  it("routes bad-picture captions to image feedback", async () => {
    flagLatestKnowledgeImage.mockResolvedValue({ ok: true, flagged: true });

    const { result } = renderHook(() =>
      useKnowledgeFeedbackAcknowledgement(
        { text: "Hey Homer bad picture", ts: 101, stage: "final", age: 0.1 },
        { url: "https://worker.test" },
      ),
    );

    await waitFor(() => {
      expect(result.current).toMatchObject({ kind: "image", status: "captured" });
    });
    expect(flagLatestKnowledgeImage).toHaveBeenCalledTimes(1);
    expect(flagLatestKnowledgeResponse).not.toHaveBeenCalled();
  });

  it("does not flag active interim listening captions", () => {
    const { result } = renderHook(() =>
      useKnowledgeFeedbackAcknowledgement(
        { text: "Hey Homer, that was wrong", ts: 102, stage: "listening", age: 0 },
        { url: "https://worker.test" },
      ),
    );

    expect(result.current).toBeNull();
    expect(flagLatestKnowledgeResponse).not.toHaveBeenCalled();
  });
});
