import { useState, useEffect } from "react";

const TV_WIDTH = 1920;
const TV_HEIGHT = 1080;
const MOBILE_BREAKPOINT = 768;

export function usePreviewMode() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setIsMobile(w < MOBILE_BREAKPOINT);
      const margin = 8;
      setScale((w - margin * 2) / TV_WIDTH);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return { isMobile, scale, tvWidth: TV_WIDTH, tvHeight: TV_HEIGHT };
}
