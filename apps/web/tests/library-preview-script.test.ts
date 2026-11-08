import { describe, expect, it } from "vitest";
import { LIBRARY_CAPTIONS, LIBRARY_FINAL, LIBRARY_STAGES, MAX_SAVED } from "@/lib/library-preview-script";

describe("signed-out Library preview script", () => {
  it("starts empty and only ever adds things, never removes them mid-loop", () => {
    expect(LIBRARY_STAGES[0]).toMatchObject({ saved: 0, following: 0, interests: 0, feed: false });
    for (let i = 1; i < LIBRARY_STAGES.length; i++) {
      const [a, b] = [LIBRARY_STAGES[i - 1], LIBRARY_STAGES[i]];
      expect(b.saved).toBeGreaterThanOrEqual(a.saved); expect(b.following).toBeGreaterThanOrEqual(a.following);
      expect(b.interests).toBeGreaterThanOrEqual(a.interests); expect(Number(b.feed)).toBeGreaterThanOrEqual(Number(a.feed));
      expect(b.caption).toBeGreaterThanOrEqual(a.caption);
    }
  });

  it("never shows more saved items than the preview has slots for, and the feed explanation comes last", () => {
    for (const s of LIBRARY_STAGES) expect(s.saved).toBeLessThanOrEqual(MAX_SAVED);
    const firstFeed = LIBRARY_STAGES.findIndex((s) => s.feed);
    expect(firstFeed).toBe(LIBRARY_STAGES.length - 1);
    expect(LIBRARY_STAGES[firstFeed].following).toBeGreaterThan(0); // the ranking explanation cites "you follow"
    expect(LIBRARY_STAGES[firstFeed].interests).toBeGreaterThan(0); // and "matches your interests"
  });

  it("covers all four captions and keeps the loop watchable", () => {
    expect(new Set(LIBRARY_STAGES.map((s) => s.caption))).toEqual(new Set([0, 1, 2, 3]));
    for (const s of LIBRARY_STAGES) expect(LIBRARY_CAPTIONS[s.caption]).toBeDefined();
    const total = LIBRARY_STAGES.reduce((a, s) => a + s.ms, 0);
    expect(total).toBeGreaterThan(8000); expect(total).toBeLessThan(20000);
  });

  it("gives reduced-motion users the finished library", () => {
    expect(LIBRARY_FINAL).toMatchObject({ saved: MAX_SAVED, feed: true });
  });
});
