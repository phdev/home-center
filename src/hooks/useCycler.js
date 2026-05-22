import { useState, useEffect } from "react";

export function useCycler(array, ms) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((x) => (x + 1) % array.length), ms);
    return () => clearInterval(id);
  }, [array.length, ms]);

  return [array[index], index];
}
