"use client";
import { useEffect, useState } from "react";

/** Advances through scripted stages on a timer and wraps around. Reduced-motion users get `final` and no timer. */
export function useStageLoop<T extends { ms: number }>(stages: readonly T[], final: T, reduce: boolean | null) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % stages.length), stages[index].ms);
    return () => clearTimeout(t);
  }, [index, reduce, stages]);
  return { stage: reduce ? final : stages[index], index };
}
