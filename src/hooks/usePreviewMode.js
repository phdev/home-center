import { useState, useEffect } from "react";

const TV_WIDTH = 1920;
const TV_HEIGHT = 1080;
const MOBILE_BREAKPOINT = 1200;

export function usePreviewMode() {
  const [preview, setPreview] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const isMobile = w < MOBILE_BREAKPOINT;
      setPreview(isMobile);
      if (isMobile) {
        // Scale the 1920px layout to fit viewport width with small margin
        const margin = 8;
        setScale((w - margin * 2) / TV_WIDTH);
      } else {
        setScale(1);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return { preview, scale, tvWidth: TV_WIDTH, tvHeight: TV_HEIGHT };
}
