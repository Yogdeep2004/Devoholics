"use client";
import Link from "next/link";
import { useApi } from "@/lib/use-api";
import type { Report, TechProfile, TechSummary } from "@/lib/types";
import { useEditor } from "@/lib/playground/store";
import { compact, timeAgo } from "@/lib/utils";
import { Badge } from "../ui";
import { TYPE_META } from "./nodes";

const CONNECTIONS = ["http_api", "database_connection", "llm_inference", "embedding_generation", "retrieval",
  "tool_invocation", "mcp_communication", "event_streaming", "authentication", "data_ingestion", "custom"];
const inp = "w-full rounded-md border border-border bg-surface2 px-2 py-1.5 text-sm";
const Label = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block space-y-1 text-xs text-muted">{t}{children}</label>;

export function TechInspector({ slug, onReplace }: { slug: string; onReplace?: (slug: string) => void }) {
  const { data: t } = useApi<TechProfile>(`/technologies/${slug}`);
  const alts = useApi<TechSummary[]>(t ? `/technologies?category=${t.category}&limit=6` : null);
  if (!t) return <p className="text-sm text-muted">Loading technology…</p>;
  const sig = (dim: keyof TechProfile["dimensions"], name: string) => t.dimensions[dim].find((s) => s.name === name);
  const push = sig("maintenance", "days_since_last_push")?.value;
  return (
    <section className="space-y-2 border-t border-border pt-3" aria-label="Technology inspector">
      <div className="flex items-center justify-between"><h3 className="text-sm font-medium">{t.name}</h3>
        <Link href={`/t/${t.slug}`} target="_blank" className="text-xs text-accent hover:underline">Full profile ↗</Link></div>
      <p className="line-clamp-3 text-xs text-muted">{t.description ?? "No description recorded."}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">License</dt><dd>{t.license ?? "unknown"}</dd>
        <dt className="text-muted">Stars</dt><dd>{compact(t.stars)}</dd>
        <dt className="text-muted">Last push</dt><dd>{push == null ? "unknown" : `${push}d ago`}</dd>
        <dt className="text-muted">Latest release</dt><dd>{t.latest_release ? `${t.latest_release.version} (${timeAgo(t.latest_release.published_at)})` : "none recorded"}</dd>
        <dt className="text-muted">7d growth</dt><dd>{String(sig("momentum", "stars_gained_7d")?.value ?? "no history yet")}</dd>
      </dl>
      <div className="flex flex-wrap gap-3 text-xs">
        {t.documentation_url && <a className="text-accent hover:underline" href={t.documentation_url} target="_blank" rel="noreferrer">Docs ↗</a>}
        {t.repository_url && <a className="text-accent hover:underline" href={t.repository_url} target="_blank" rel="noreferrer">GitHub ↗</a>}
        {t.official_url && <a className="text-accent hover:underline" href={t.official_url} target="_blank" rel="noreferrer">Website ↗</a>}
      </div>
      <div>
        <div className="mb-1 text-xs text-muted">Alternatives in {t.category}</div>
        <ul className="space-y-1">
          {(alts.data ?? []).filter((a) => a.slug !== t.slug).slice(0, 4).map((a) => (
            <li key={a.slug} className="flex items-center justify-between gap-2 text-xs">
              <Link href={`/t/${a.slug}`} target="_blank" className="truncate hover:underline">{a.name}</Link>
              <span className="flex items-center gap-2 text-muted">★ {compact(a.stars)}
                {onReplace && <button onClick={() => onReplace(a.slug)} className="rounded border border-border px-1.5 hover:text-fg">Replace</button>}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Inspector({ report, onReplace }: { report: Report | null; onReplace: (nodeId: string, slug: string) => void }) {
  const { nodes, edges, selected, patchNode, patchEdge, deleteSelected, duplicateSelected } = useEditor();
  const node = selected?.kind === "node" ? nodes.find((n) => n.id === selected.id) : null;
  const edge = selected?.kind === "edge" ? edges.find((e) => e.id === selected.id) : null;
  return (
    <aside className="space-y-3 p-3" aria-label="Inspector">
      {node && (
        <>
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold capitalize">{node.type}</h2>
            <div className="flex gap-2 text-xs"><button onClick={duplicateSelected} className="text-muted hover:text-fg">Duplicate</button>
              <button onClick={deleteSelected} className="text-bad hover:underline">Delete</button></div></div>
          <Label t="Label"><input className={inp} value={node.data.label} onChange={(e) => patchNode(node.id, { label: e.target.value })} /></Label>
          {node.type === "component" && <Label t="Layer (free text, e.g. Data, Serving)"><input className={inp} value={node.data.layer ?? ""} onChange={(e) => patchNode(node.id, { layer: e.target.value || null })} /></Label>}
          <Label t="Notes"><textarea className={inp} rows={3} value={node.data.notes} onChange={(e) => patchNode(node.id, { notes: e.target.value })} /></Label>
          {node.type === "component" && node.data.component_type && <Badge>{TYPE_META[node.data.component_type]?.label}</Badge>}
          {node.type === "component" && node.data.technology && <TechInspector slug={node.data.technology} onReplace={(s) => onReplace(node.id, s)} />}
        </>
      )}
      {edge && (
        <>
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Connection</h2>
            <button onClick={deleteSelected} className="text-xs text-bad hover:underline">Delete</button></div>
          <Label t="Type"><select className={inp} value={edge.data?.connection_type} onChange={(e) => patchEdge(edge.id, { connection_type: e.target.value })}>
            {CONNECTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</select></Label>
          <Label t="Label"><input className={inp} value={edge.data?.label ?? ""} onChange={(e) => patchEdge(edge.id, { label: e.target.value })} /></Label>
          <Label t="Notes"><textarea className={inp} rows={3} value={edge.data?.notes ?? ""} onChange={(e) => patchEdge(edge.id, { notes: e.target.value })} /></Label>
          <p className="text-xs text-muted">Status: <b>{report?.edge_status[edge.id] ?? "unchecked"}</b>.{" "}
            {report?.edge_status[edge.id] === "compatible" && "Matches a common structural pattern for these component types; not proof these products integrate."}
            {report?.edge_status[edge.id] === "unverified" && "No documented pattern or verified integration on record."}
            {report?.edge_status[edge.id] === "verified" && "A verified integration is on record."}</p>
        </>
      )}
      {!node && !edge && <p className="text-sm text-muted">Select a component or connection to inspect it. Drag from a node&apos;s right handle to another node to connect.</p>}
      <Issues report={report} />
    </aside>
  );
}

export function Issues({ report }: { report: Report | null }) {
  const setSelected = useEditor((s) => s.setSelected);
  const nodes = useEditor((s) => s.nodes);
  if (!report) return null;
  if (report.issues.length === 0) return <p className="border-t border-border pt-3 text-xs text-good">No validation issues.</p>;
  return (
    <section className="space-y-1 border-t border-border pt-3" aria-label="Validation">
      <h3 className="text-xs font-medium">Validation ({report.issues.length})</h3>
      <ul className="space-y-1">
        {report.issues.map((i, k) => (
          <li key={k}><button onClick={() => i.ref && nodes.some((n) => n.id === i.ref) && setSelected({ kind: "node", id: i.ref })}
            className={`w-full rounded border px-2 py-1 text-left text-xs ${i.level === "error" ? "border-bad/40 text-bad" : "border-warn/40 text-warn"}`}>{i.message}</button></li>
        ))}
      </ul>
    </section>
  );
}
