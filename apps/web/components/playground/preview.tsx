"use client";
import "@xyflow/react/dist/style.css";
import { ArrowRight, Check, Sparkle } from "@phosphor-icons/react";
import { ReactFlow, ReactFlowProvider, type Edge } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CAPTIONS, FINAL_STAGE, PROMPT_TEXT, STAGES, type PreviewEdgeId, type PreviewNodeId, type Stage } from "@/lib/playground/preview-script";
import type { RFNode } from "@/lib/playground/convert";
import { useStageLoop } from "@/lib/use-stage-loop";
import { StepList } from "../preview/step-list";
import { nodeTypes } from "./nodes";

const NODES: Record<PreviewNodeId, { label: string; tech: string; type: string; x: number; y: number }> = {
  web: { label: "Next.js", tech: "nextjs", type: "frontend", x: 0, y: 70 },
  api: { label: "FastAPI", tech: "fastapi", type: "backend", x: 250, y: 70 },
  db: { label: "PostgreSQL", tech: "postgres", type: "database", x: 520, y: 0 },
  vec: { label: "Qdrant", tech: "qdrant", type: "vector_database", x: 520, y: 140 },
  obs: { label: "Langfuse", tech: "langfuse", type: "monitoring", x: 250, y: 210 },
};
const EDGES: Record<PreviewEdgeId, [PreviewNodeId, PreviewNodeId]> = { e1: ["web", "api"], e2: ["api", "db"], e3: ["api", "vec"], e4: ["api", "obs"] };

function build(stage: Stage): { nodes: RFNode[]; edges: Edge[] } {
  const proposed = stage.proposal === "preview";
  const nodes = (Object.keys(NODES) as PreviewNodeId[]).map((id): RFNode => {
    const n = NODES[id], shown = stage.nodes.includes(id);
    return {
      id, type: "component", position: { x: n.x, y: n.y + (shown ? 0 : 18) }, selected: stage.selected === id, draggable: false, selectable: false,
      measured: { width: 176, height: 48 },
      style: { opacity: shown ? 1 : 0, ...(id === "obs" && proposed ? { outline: "2px solid var(--good)", outlineOffset: 3, borderRadius: 12 } : {}) },
      data: { label: n.label, technology: n.tech, component_type: n.type, notes: "", layer: null, config: {} },
    };
  });
  const edges = (Object.keys(EDGES) as PreviewEdgeId[]).map((id): Edge => {
    const [source, target] = EDGES[id];
    const isProposal = id === "e4" && proposed;
    return { id, source, target, selectable: false, style: { opacity: stage.edges.includes(id) ? 1 : 0, stroke: isProposal ? "var(--good)" : "var(--muted)", strokeWidth: 1.5, strokeDasharray: isProposal ? "5 4" : undefined } };
  });
  return { nodes, edges };
}

function Canvas({ stage, typed }: { stage: Stage; typed: string }) {
  const { nodes, edges } = useMemo(() => build(stage), [stage]);
  return (
    <div className="preview-flow pointer-events-none relative h-full" aria-hidden>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.1, maxZoom: 0.95 }} minZoom={0.2} maxZoom={1}
        panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        proOptions={{ hideAttribution: false }} colorMode="dark">
      </ReactFlow>
      {stage.prompt && (
        <div key={stage.proposal ?? "typing"} className="rise absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-xl border border-border-strong bg-surface/95 px-3 py-2 text-[13px] shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)] backdrop-blur">
          <Sparkle size={15} weight="fill" className="shrink-0 text-accent" />
          {!stage.proposal && <span className="truncate">{typed}<span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-fg" /></span>}
          {stage.proposal === "preview" && <><span className="truncate"><b className="font-medium">Add Langfuse tracing</b> <span className="text-muted">previewed in green, not applied yet</span></span>
            <span className="ml-auto flex shrink-0 gap-1.5"><span className="btn btn-sm">Reject</span><span className="btn btn-primary btn-sm">Accept</span></span></>}
          {stage.proposal === "accepted" && <span className="flex items-center gap-1.5 truncate text-good"><Check size={14} weight="bold" />Accepted. Saved as a new version; the old one is still restorable.</span>}
        </div>
      )}
    </div>
  );
}

/** Looping, non-interactive demo of the real editor for visitors who are not signed in. */
export function PlaygroundPreview() {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState("");
  const { stage } = useStageLoop(STAGES, FINAL_STAGE, reduce);

  useEffect(() => {
    if (reduce || !stage.prompt || stage.proposal) return;
    let n = 0;
    const iv = setInterval(() => { n += 1; setTyped(PROMPT_TEXT.slice(0, n)); if (n >= PROMPT_TEXT.length) clearInterval(iv); }, 70);
    return () => { clearInterval(iv); setTyped(""); };
  }, [stage.prompt, stage.proposal, reduce]);

  const active = stage.caption;
  return (
    <section aria-label="Playground preview" className="grid items-center gap-10 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-10">
      <div>
        <h1 className="display text-[2.2rem] sm:text-5xl lg:text-[2.7rem]">Design your stack on a canvas of real tools.</h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">Drag in real technologies, connect them with typed links, and let an AI propose changes you approve.</p>
        <StepList captions={CAPTIONS} active={active} />
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary h-10 px-5 text-sm">Sign in to start <ArrowRight size={15} weight="bold" /></Link>
          <Link href="/blueprints" className="btn h-10 px-5 text-sm">Browse blueprints</Link>
        </div>
        <p className="mt-3 text-xs text-faint">Free to use. Your designs stay private until you publish them.</p>
      </div>
      <div role="img" aria-label="Animated preview of the Playground: technologies are added, connected, edited, and an AI proposal is accepted"
        className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)]">
        <div className="flex h-11 items-center justify-between gap-3 border-b hairline px-4">
          <div className="flex min-w-0 items-center gap-2.5"><span className="truncate text-[13px] font-medium">Untitled architecture</span><span className="tag">preview</span></div>
          <span className="tag gap-1 text-accent"><Sparkle size={11} weight="fill" />Assistant</span>
        </div>
        <div className="surface-grid h-[340px] sm:h-[400px]">
          <ReactFlowProvider><Canvas stage={stage} typed={typed} /></ReactFlowProvider>
        </div>
      </div>
    </section>
  );
}
