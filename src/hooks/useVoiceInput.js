import { useState, useEffect, useRef, useCallback } from "react";

export function useVoiceInput({ onResult, onInterim }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSupported(true);
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const tr = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += tr;
          else interim += tr;
        }
        if (final && onResult) onResult(final.trim());
        if (interim && onInterim) onInterim(interim);
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
