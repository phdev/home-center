import { describe, expect, it } from "vitest";
import {
  clearLatestKnowledgeResponse,
  getLatestKnowledgeImage,
  getLatestKnowledgeResponse,
  isNegativeImageFeedbackPhrase,
  isNegativeKnowledgeFeedbackPhrase,
  negativeKnowledgeFeedbackIntent,
  rememberKnowledgeResponse,
} from "./feedback";

describe("negative knowledge feedback phrases", () => {
  it("matches the explicit negative feedback phrases", () => {
    expect(isNegativeKnowledgeFeedbackPhrase("Hey Homer, that was wrong")).toBe(true);
    expect(isNegativeKnowledgeFeedbackPhrase("that's wrong")).toBe(true);
    expect(isNegativeKnowledgeFeedbackPhrase("wrong answer")).toBe(true);
    expect(isNegativeKnowledgeFeedbackPhrase("bad response")).toBe(true);
    expect(isNegativeImageFeedbackPhrase("Hey Homer, bad image")).toBe(true);
    expect(isNegativeImageFeedbackPhrase("wrong image")).toBe(true);
    expect(isNegativeImageFeedbackPhrase("bad picture")).toBe(true);
    expect(isNegativeImageFeedbackPhrase("that image is wrong")).toBe(true);
  });

  it("does not loosely match unrelated commands", () => {
    expect(isNegativeKnowledgeFeedbackPhrase("Hey Homer, what's the weather")).toBe(false);
    expect(isNegativeKnowledgeFeedbackPhrase("that was really interesting")).toBe(false);
    expect(isNegativeKnowledgeFeedbackPhrase("bad weather")).toBe(false);
    expect(isNegativeKnowledgeFeedbackPhrase("answer the question")).toBe(false);
  });

  it("routes image and knowledge phrases to separate handlers", () => {
    expect(negativeKnowledgeFeedbackIntent("Hey Homer, that was wrong")).toBe("knowledge");
    expect(negativeKnowledgeFeedbackIntent("bad answer")).toBe("knowledge");
    expect(negativeKnowledgeFeedbackIntent("Hey Homer, bad image")).toBe("image");
    expect(negativeKnowledgeFeedbackIntent("wrong picture")).toBe("image");

    expect(isNegativeImageFeedbackPhrase("that was wrong")).toBe(false);
    expect(isNegativeKnowledgeFeedbackPhrase("bad image")).toBe(false);
    expect(negativeKnowledgeFeedbackIntent("Hey Homer, what's the weather")).toBeNull();
  });
});

describe("knowledge feedback rolling buffer", () => {
  it("keeps the latest knowledge response while it is fresh", () => {
    clearLatestKnowledgeResponse();
    rememberKnowledgeResponse({
      kind: "knowledge",
      query: "what is an ibis",
      log_row_id: "kb_1",
      timestamp: 1_000,
    });

    expect(getLatestKnowledgeResponse(1_000 + 9 * 60 * 1000)).toMatchObject({
      query: "what is an ibis",
      log_row_id: "kb_1",
    });
  });

  it("drops stale responses after ten minutes", () => {
    clearLatestKnowledgeResponse();
    rememberKnowledgeResponse({
      kind: "knowledge",
      query: "what is an ibis",
      log_row_id: "kb_1",
      timestamp: 1_000,
    });

    expect(getLatestKnowledgeResponse(1_000 + 11 * 60 * 1000)).toBeNull();
  });

  it("tracks the latest displayed image when the response has one", () => {
    clearLatestKnowledgeResponse();
    rememberKnowledgeResponse({
      kind: "knowledge",
      query: "what is an ibis",
      log_row_id: "kb_1",
      timestamp: 1_000,
      imageSourceType: "known",
      imageUrl: "https://images.test/ibis.jpg",
    });

    expect(getLatestKnowledgeImage(1_000 + 9 * 60 * 1000)).toMatchObject({
      query: "what is an ibis",
      log_row_id: "kb_1",
      image_source_type: "known",
      image_ref: "https://images.test/ibis.jpg",
    });
  });

  it("clears the image buffer when no image was shown", () => {
    clearLatestKnowledgeResponse();
    rememberKnowledgeResponse({
      kind: "knowledge",
      query: "what is an ibis",
      log_row_id: "kb_1",
      timestamp: 1_000,
      imageSourceType: "known",
      imageUrl: "https://images.test/ibis.jpg",
    });
    rememberKnowledgeResponse({
      kind: "knowledge",
      query: "what is the meaning of justice",
      log_row_id: "kb_2",
      timestamp: 2_000,
      imageSourceType: "none",
      imageUrl: null,
    });

    expect(getLatestKnowledgeImage(2_000)).toBeNull();
  });
});
