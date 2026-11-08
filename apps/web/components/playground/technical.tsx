"use client";
import { useState } from "react";
import { useEditor } from "@/lib/playground/store";

/** Technical view: configuration, connection types and notes as editable structured data. */
export function TechnicalView() {
  const { nodes, edges, patchNode, patchEdge, report } = useEditor();
  const [bad, setBad] = useState<string | null>(null);
  const comps = nodes.filter((n) => n.type === "component");
  return (
    <div className="h-full space-y-6 overflow-y-auto p-4 text-sm">
      <section>
        <h2 className="mb-2 font-medium">Components ({comps.length})</h2>
        <div className="space-y-2">
          {comps.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-baseline gap-2"><b>{n.data.label}</b>
                <code className="text-xs text-muted">{n.data.technology} · {n.data.component_type}{n.data.layer ? ` · layer: ${n.data.layer}` : ""}</code></div>
              <label className="mt-2 block text-xs text-muted">Implementation notes
                <textarea className="mt-1 w-full rounded border border-border bg-surface2 p-1.5 text-sm text-fg" rows={2} value={n.data.notes} onChange={(e) => patchNode(n.id, { notes: e.target.value })} /></label>
              <label className="mt-2 block text-xs text-muted">Configuration (JSON)
                <textarea className="mt-1 w-full rounded border border-border bg-surface2 p-1.5 font-mono text-xs text-fg" rows={3} defaultValue={JSON.stringify(n.data.config, null, 2)}
                  onBlur={(e) => { try { const v = JSON.parse(e.target.value || "{}"); if (typeof v !== "object" || Array.isArray(v) || !v) throw new Error(); patchNode(n.id, { config: v }); setBad(null); } catch { setBad(n.id); } }} /></label>
              {bad === n.id && <p role="alert" className="mt-1 text-xs text-bad">Configuration must be a valid JSON object.</p>}
            </div>
          ))}
          {comps.length === 0 && <p className="text-muted">No components yet.</p>}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium">Connections ({edges.length})</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-muted"><tr><th className="py-1">From</th><th>To</th><th>Type</th><th>Status</th><th>Label</th></tr></thead>
          <tbody>
            {edges.map((e) => {
              const name = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id;
              return (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-1">{name(e.source)}</td><td>{name(e.target)}</td><td>{e.data?.connection_type.replace(/_/g, " ")}</td>
                  <td>{report?.edge_status[e.id] ?? "—"}</td>
                  <td><input className="w-full rounded border border-border bg-surface2 px-1 py-0.5" value={e.data?.label ?? ""} onChange={(ev) => patchEdge(e.id, { label: ev.target.value })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
