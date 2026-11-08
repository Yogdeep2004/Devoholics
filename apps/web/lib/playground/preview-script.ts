/** The signed-out Playground preview is a scripted loop. The script is plain data so it can be tested. */
export type PreviewNodeId = "web" | "api" | "db" | "vec" | "obs";
export type PreviewEdgeId = "e1" | "e2" | "e3" | "e4";
export type Stage = {
  nodes: PreviewNodeId[];
  edges: PreviewEdgeId[];
  selected?: PreviewNodeId;
  prompt?: boolean;
  proposal?: "preview" | "accepted";
  caption: 0 | 1 | 2 | 3;
  ms: number;
};

export const CAPTIONS = [
  { title: "Drag in real technologies", body: "Every component is a tool from the database, with its license, activity and alternatives." },
  { title: "Connect them with typed links", body: "HTTP, retrieval, LLM inference, MCP. Each link is verified, compatible or flagged unverified." },
  { title: "Replace, duplicate, lock", body: "Select anything for a floating bar: swap in an alternative, copy it, pin it, or open its profile." },
  { title: "Let the AI propose, you decide", body: "Preview its changes on your canvas, accept the ones you want. Nothing is ever applied behind your back." },
] as const;

const BASE: PreviewNodeId[] = ["web", "api", "db", "vec"];
export const STAGES: Stage[] = [
  { nodes: [], edges: [], caption: 0, ms: 1000 },
  { nodes: ["web"], edges: [], caption: 0, ms: 800 },
  { nodes: ["web", "api"], edges: ["e1"], caption: 1, ms: 800 },
  { nodes: ["web", "api", "db"], edges: ["e1", "e2"], caption: 1, ms: 800 },
  { nodes: BASE, edges: ["e1", "e2", "e3"], caption: 1, ms: 1300 },
  { nodes: BASE, edges: ["e1", "e2", "e3"], selected: "api", caption: 2, ms: 2600 },
  { nodes: BASE, edges: ["e1", "e2", "e3"], prompt: true, caption: 3, ms: 2200 },
  { nodes: [...BASE, "obs"], edges: ["e1", "e2", "e3", "e4"], prompt: true, proposal: "preview", caption: 3, ms: 2800 },
  { nodes: [...BASE, "obs"], edges: ["e1", "e2", "e3", "e4"], prompt: true, proposal: "accepted", caption: 3, ms: 2600 },
];

/** Reduced-motion users get the finished design with no movement. */
export const FINAL_STAGE: Stage = { ...STAGES[STAGES.length - 1], prompt: false, proposal: undefined };

export const PROMPT_TEXT = "Add tracing and metrics";
export const nextStage = (i: number) => (i + 1) % STAGES.length;
