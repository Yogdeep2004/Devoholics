import { applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react";
import { create } from "zustand";
import type { Component, Diff, Graph, Report } from "../types";
import { fromGraph, toGraph, uid, type RFEdge, type RFNode } from "./convert";

const desel = <T extends { selected?: boolean }>(xs: T[]): T[] => xs.map((x) => (x.selected ? { ...x, selected: false } : x));

type Sel = { kind: "node" | "edge"; id: string } | null;

type State = {
  nodes: RFNode[]; edges: RFEdge[]; selected: Sel; dirty: boolean; view: "visual" | "technical";
  report: Report | null; defaultConnection: string;
  preview: { graph: Graph; diff: Diff } | null;
  setPreview: (p: { graph: Graph; diff: Diff } | null) => void;
  load: (g: Graph) => void;
  onNodesChange: (c: NodeChange<RFNode>[]) => void;
  onEdgesChange: (c: EdgeChange<RFEdge>[]) => void;
  onConnect: (c: Connection) => void;
  addComponent: (c: Component, pos: { x: number; y: number }) => string;
  addGroup: (pos: { x: number; y: number }) => void;
  addNote: (pos: { x: number; y: number }) => void;
  patchNode: (id: string, p: Partial<RFNode["data"]>) => void;
  patchEdge: (id: string, p: Partial<NonNullable<RFEdge["data"]>>) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  setSelected: (s: Sel) => void;
  setView: (v: "visual" | "technical") => void;
  setReport: (r: Report | null) => void;
  setDefaultConnection: (c: string) => void;
  markSaved: () => void;
  graph: () => Graph;
};

export const useEditor = create<State>((set, get) => ({
  nodes: [], edges: [], selected: null, dirty: false, view: "visual", report: null, defaultConnection: "http_api", preview: null,
  setPreview: (preview) => set({ preview }),
  load: (g) => set({ ...fromGraph(g), selected: null, dirty: false }),
  onNodesChange: (c) => set((s) => ({
    nodes: applyNodeChanges(c, s.nodes),
    dirty: s.dirty || c.some((x) => x.type !== "select" && x.type !== "dimensions"),
  })),
  onEdgesChange: (c) => set((s) => ({ edges: applyEdgeChanges(c, s.edges), dirty: s.dirty || c.some((x) => x.type !== "select") })),
  onConnect: (c) => set((s) => {
    if (!c.source || !c.target || c.source === c.target) return s;
    const e: RFEdge = { id: uid("e"), source: c.source, target: c.target, selected: true,
      data: { connection_type: s.defaultConnection, label: "", notes: "" } };
    return { edges: [...desel(s.edges), e], nodes: desel(s.nodes), dirty: true, selected: { kind: "edge", id: e.id } };
  }),
  addComponent: (c, pos) => {
    const id = uid(c.slug.replace(/[^A-Za-z0-9]/g, "").slice(0, 20) || "node");
    set((s) => ({ dirty: true, selected: { kind: "node", id }, edges: desel(s.edges), nodes: [...desel(s.nodes), {
      id, type: "component", position: pos, selected: true,
      data: { label: c.name, technology: c.slug, component_type: c.component_type, notes: "", layer: null, config: {} } }] }));
    return id;
  },
  addGroup: (pos) => set((s) => {
    const id = uid("group");
    return { dirty: true, selected: { kind: "node", id }, nodes: [{ id, type: "group", position: pos, selected: true, style: { width: 360, height: 240 },
      data: { label: "New layer", technology: null, component_type: null, notes: "", layer: null, config: {} } }, ...desel(s.nodes)] };
  }),
  addNote: (pos) => set((s) => {
    const id = uid("note");
    return { dirty: true, selected: { kind: "node", id }, nodes: [...desel(s.nodes), { id, type: "note", position: pos, selected: true,
      data: { label: "Note", technology: null, component_type: null, notes: "", layer: null, config: {} } }] };
  }),
  patchNode: (id, p) => set((s) => ({ dirty: true, nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...p } } : n)) })),
  patchEdge: (id, p) => set((s) => ({ dirty: true, edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data!, ...p } } : e)) })),
  deleteSelected: () => set((s) => {
    const sel = s.nodes.filter((n) => n.selected).map((n) => n.id);
    if (s.selected?.kind === "node" && !sel.includes(s.selected.id)) sel.push(s.selected.id);
    const gone = new Set(sel);
    const selEdges = new Set(s.edges.filter((e) => e.selected).map((e) => e.id));
    if (s.selected?.kind === "edge") selEdges.add(s.selected.id);
    return { dirty: true, selected: null,
      nodes: s.nodes.filter((n) => !gone.has(n.id)).map((n) => (n.parentId && gone.has(n.parentId) ? { ...n, parentId: undefined } : n)),
      edges: s.edges.filter((e) => !selEdges.has(e.id) && !gone.has(e.source) && !gone.has(e.target)) };
  }),
  duplicateSelected: () => set((s) => {
    const src = s.nodes.filter((n) => n.selected || (s.selected?.kind === "node" && n.id === s.selected.id));
    if (!src.length) return s;
    const copies = src.map((n): RFNode => ({ ...n, id: uid(n.type ?? "n"), selected: false, parentId: undefined,
      position: { x: n.position.x + 40, y: n.position.y + 40 }, data: { ...n.data, label: `${n.data.label} copy` } }));
    return { dirty: true, nodes: [...desel(s.nodes), ...copies.map((c, i) => ({ ...c, selected: i === 0 }))], selected: { kind: "node", id: copies[0].id } };
  }),
  setSelected: (selected) => set((s) =>
    s.selected?.kind === selected?.kind && s.selected?.id === selected?.id ? s : { selected }),
  setView: (view) => set({ view }),
  setReport: (report) => set({ report }),
  setDefaultConnection: (defaultConnection) => set({ defaultConnection }),
  markSaved: () => set({ dirty: false }),
  graph: () => toGraph(get().nodes, get().edges),
}));
