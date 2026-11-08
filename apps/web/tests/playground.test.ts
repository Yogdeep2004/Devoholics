import { beforeEach, describe, expect, it } from "vitest";
import { fromGraph, toGraph } from "@/lib/playground/convert";
import { useEditor } from "@/lib/playground/store";
import type { Component, Graph } from "@/lib/types";

const comp = (slug: string, type = "backend"): Component => ({ slug, name: slug.toUpperCase(), category: "x", component_type: type,
  description: null, license: null, stars: null, official_url: null, documentation_url: null, repository_url: null });

const g: Graph = {
  nodes: [
    { id: "a", kind: "component", technology: "fastapi", position: { x: 10, y: 20 }, parent: "grp",
      data: { label: "API", notes: "n", layer: "Serving", component_type: "backend", config: { port: 80 } } },
    { id: "grp", kind: "group", technology: null, position: { x: 0, y: 0 }, parent: null, width: 300, height: 200,
      data: { label: "Layer", notes: "", layer: null, component_type: null, config: {} } },
  ],
  edges: [{ id: "e", source: "a", target: "grp", connection_type: "http_api", label: "x", notes: "" }],
};

beforeEach(() => useEditor.getState().load({ nodes: [], edges: [] }));

describe("graph conversion", () => {
  it("round-trips and orders parents first", () => {
    const rf = fromGraph(g);
    expect(rf.nodes[0].id).toBe("grp");
    expect(rf.nodes[1].parentId).toBe("grp");
    expect(toGraph(rf.nodes, rf.edges)).toEqual({
      nodes: [g.nodes[1], g.nodes[0]].map((n) => ({ ...n, width: n.width ?? null, height: n.height ?? null })), edges: g.edges });
  });
});

describe("editor store", () => {
  it("adds components with stable technology references and marks dirty", () => {
    const id = useEditor.getState().addComponent(comp("qdrant", "vector_database"), { x: 1, y: 2 });
    const s = useEditor.getState();
    expect(s.dirty).toBe(true);
    expect(s.nodes[0]).toMatchObject({ id, type: "component", data: { technology: "qdrant", component_type: "vector_database" } });
  });

  it("connects with the default type, refuses self-loops, and cascades deletes", () => {
    const st = useEditor.getState();
    const a = st.addComponent(comp("a"), { x: 0, y: 0 });
    const b = st.addComponent(comp("b"), { x: 0, y: 0 });
    st.setDefaultConnection("retrieval");
    st.onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    st.onConnect({ source: a, target: a, sourceHandle: null, targetHandle: null });
    expect(useEditor.getState().edges).toHaveLength(1);
    expect(useEditor.getState().edges[0].data?.connection_type).toBe("retrieval");
    useEditor.getState().setSelected({ kind: "node", id: a });
    useEditor.getState().deleteSelected();
    expect(useEditor.getState().nodes.map((n) => n.id)).toEqual([b]);
    expect(useEditor.getState().edges).toHaveLength(0);
  });

  it("duplicates a selected node as a new id offset from the original", () => {
    const st = useEditor.getState();
    const a = st.addComponent(comp("a"), { x: 5, y: 5 });
    useEditor.getState().duplicateSelected();
    const [orig, copy] = useEditor.getState().nodes;
    expect(copy.id).not.toBe(orig.id);
    expect(orig.id).toBe(a);
    expect(copy.position).toEqual({ x: 45, y: 45 });
  });

  it("does not become dirty from selection-only changes, and load resets dirty", () => {
    useEditor.getState().addGroup({ x: 0, y: 0 });
    useEditor.getState().load({ nodes: [], edges: [] });
    useEditor.getState().onNodesChange([{ id: "zzz", type: "select", selected: true }]);
    expect(useEditor.getState().dirty).toBe(false);
  });
});

describe("canvas action icons (store)", () => {
  const two = () => {
    const st = useEditor.getState();
    const a = st.addComponent(comp("a"), { x: 0, y: 0 });
    const b = st.addComponent(comp("b"), { x: 200, y: 0 });
    st.onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    return { a, b, e: useEditor.getState().edges[0].id };
  };

  it("duplicateNode copies one node, offsets it, selects the copy, and leaves edges alone", () => {
    const { a } = two();
    useEditor.getState().duplicateNode(a);
    const s = useEditor.getState();
    expect(s.nodes).toHaveLength(3);
    const copy = s.nodes.at(-1)!;
    expect(copy.id).not.toBe(a);
    expect(copy.data.label).toBe("A copy");
    expect(copy.position).toEqual({ x: 44, y: 44 });
    expect(s.selected).toEqual({ kind: "node", id: copy.id });
    expect(s.edges).toHaveLength(1);
  });

  it("deleteNode removes the node and every connection touching it", () => {
    const { a, b } = two();
    useEditor.getState().deleteNode(a);
    expect(useEditor.getState().nodes.map((n) => n.id)).toEqual([b]);
    expect(useEditor.getState().edges).toHaveLength(0);
  });

  it("reverseEdge swaps direction without changing anything else", () => {
    const { a, b, e } = two();
    const before = useEditor.getState().edges[0].data;
    useEditor.getState().reverseEdge(e);
    const edge = useEditor.getState().edges[0];
    expect([edge.source, edge.target]).toEqual([b, a]);
    expect(edge.data).toEqual(before);
  });

  it("deleteEdge removes only the connection, and toggleLock flips per node", () => {
    const { a, e } = two();
    useEditor.getState().deleteEdge(e);
    expect(useEditor.getState().edges).toHaveLength(0);
    expect(useEditor.getState().nodes).toHaveLength(2);
    useEditor.getState().toggleLock(a);
    expect(useEditor.getState().locked[a]).toBe(true);
    useEditor.getState().toggleLock(a);
    expect(useEditor.getState().locked[a]).toBe(false);
  });

  it("loading another design clears lock state", () => {
    const { a } = two();
    useEditor.getState().toggleLock(a);
    useEditor.getState().load({ nodes: [], edges: [] });
    expect(useEditor.getState().locked).toEqual({});
  });
});
