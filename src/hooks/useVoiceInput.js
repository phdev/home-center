import { useState, useEffect, useRef, useCallback } from "react";
import { normalizeCommandEvent, validateCommandEvent } from "../core/commands/commandEvent";

export function useVoiceInput({ onResult, onInterim, onCommandEvent }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef(null);
  const callbacksRef = useRef({ onResult, onInterim, onCommandEvent });

  useEffect(() => {
    callbacksRef.current = { onResult, onInterim, onCommandEvent };
  }, [onResult, onInterim, onCommandEvent]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSupported(true);
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e) => {
        const callbacks = callbacksRef.current;
        let interim = "";
        let final = "";
        let finalConfidence = null;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const alternative = e.results[i][0];
          const tr = alternative.transcript;
          if (e.results[i].isFinal) {
            final += tr;
            if (Number.isFinite(alternative.confidence)) {
              finalConfidence = finalConfidence == null
                ? alternative.confidence
                : Math.max(finalConfidence, alternative.confidence);
            }
          } else {
            interim += tr;
          }
        }
        if (final) {
          const commandEvent = normalizeCommandEvent({
            source: "voice",
            transcript: final,
            wakewordDetected: false,
            confidence: finalConfidence,
            locale: rec.lang,
            deviceType: "browser",
          });
          if (validateCommandEvent(commandEvent)) {
            if (callbacks.onCommandEvent) callbacks.onCommandEvent(commandEvent);
            if (callbacks.onResult) callbacks.onResult(commandEvent);
          }
        }
        if (interim && callbacks.onInterim) callbacks.onInterim(interim);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
    }
    return () => {
      if (recRef.current) {
        try {
          recRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (!recRef.current) return;
    if (listening) {
      recRef.current.stop();
      setListening(false);
    } else {
      try {
        recRef.current.start();
        setListening(true);
      } catch (e) {
        // ignore
      }
    }
  }, [listening]);

  return { listening, supported, toggle };
}
