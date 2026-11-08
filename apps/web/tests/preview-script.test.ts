import { describe, expect, it } from "vitest";
import { CAPTIONS, FINAL_STAGE, nextStage, STAGES } from "@/lib/playground/preview-script";

const ENDS: Record<string, [string, string]> = { e1: ["web", "api"], e2: ["api", "db"], e3: ["api", "vec"], e4: ["api", "obs"] };

describe("signed-out Playground preview script", () => {
  it("never shows a connection before both of its endpoints are on screen", () => {
    for (const s of STAGES) for (const e of s.edges) expect(ENDS[e].every((n) => s.nodes.includes(n as never))).toBe(true);
  });

  it("only selects a node that is visible, and only proposes after the prompt", () => {
    for (const s of STAGES) {
      if (s.selected) expect(s.nodes).toContain(s.selected);
      if (s.proposal) expect(s.prompt).toBe(true);
    }
    const firstProposal = STAGES.findIndex((s) => s.proposal);
    expect(STAGES.slice(0, firstProposal).some((s) => s.prompt && !s.proposal)).toBe(true);
  });

  it("builds the design up monotonically (nothing disappears until the loop restarts)", () => {
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].nodes.length).toBeGreaterThanOrEqual(STAGES[i - 1].nodes.length);
      expect(STAGES[i].edges.length).toBeGreaterThanOrEqual(STAGES[i - 1].edges.length);
      expect(STAGES[i].caption).toBeGreaterThanOrEqual(STAGES[i - 1].caption);
    }
  });

  it("ties every stage to a real caption, covers all four, and loops back to the start", () => {
    expect(new Set(STAGES.map((s) => s.caption))).toEqual(new Set([0, 1, 2, 3]));
    for (const s of STAGES) expect(CAPTIONS[s.caption]).toBeDefined();
    expect(nextStage(STAGES.length - 1)).toBe(0);
    expect(STAGES[0].nodes).toEqual([]);
  });

  it("keeps the loop to a watchable length", () => {
    const total = STAGES.reduce((a, s) => a + s.ms, 0);
    expect(total).toBeGreaterThan(8000);
    expect(total).toBeLessThan(20000);
  });

  it("gives reduced-motion users the finished design: everything placed, no prompt, no pending proposal", () => {
    expect(FINAL_STAGE.nodes).toHaveLength(5);
    expect(FINAL_STAGE.edges).toHaveLength(4);
    expect(FINAL_STAGE.prompt).toBe(false);
    expect(FINAL_STAGE.proposal).toBeUndefined();
  });
});
