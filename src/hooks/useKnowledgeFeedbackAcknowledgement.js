import { useEffect, useRef, useState } from "react";
import {
  flagLatestKnowledgeImage,
  flagLatestKnowledgeResponse,
  negativeKnowledgeFeedbackIntent,
} from "../knowledge/feedback";

const ACK_VISIBLE_MS = 4200;

export function useKnowledgeFeedbackAcknowledgement(liveCaption, workerSettings) {
  const [ack, setAck] = useState(null);
  const handledTsRef = useRef(null);
  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  useEffect(() => {
    const text = liveCaption?.text || "";
    const ts = liveCaption?.ts || 0;
    const stage = liveCaption?.stage || "";
    const age = Number(liveCaption?.age ?? Infinity);
    const isCompleteCaption = text && stage !== "listening" && stage !== "verifying" && age < 2.5;
    if (!isCompleteCaption || !ts || handledTsRef.current === ts) return;

    const intent = negativeKnowledgeFeedbackIntent(text);
    if (!intent) return;

    handledTsRef.current = ts;
    let cancelled = false;
    const requestId = `${intent}:${ts}`;
    setAck({ id: requestId, kind: intent, status: "saving" });

    const save = intent === "image" ? flagLatestKnowledgeImage : flagLatestKnowledgeResponse;
    save({ url: workerUrl, token: workerToken })
      .then((result) => {
        if (cancelled) return;
        setAck({
          id: requestId,
          kind: intent,
          status: result?.flagged ? "captured" : "not_attached",
          reason: result?.reason || null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAck({ id: requestId, kind: intent, status: "failed" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [liveCaption?.text, liveCaption?.ts, liveCaption?.stage, liveCaption?.age, workerUrl, workerToken]);

  useEffect(() => {
    if (!ack) return undefined;
    const id = setTimeout(() => setAck(null), ACK_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [ack?.id, ack?.status]);

  return ack;
}
