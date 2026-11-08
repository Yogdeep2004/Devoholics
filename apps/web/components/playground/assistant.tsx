"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useEditor } from "@/lib/playground/store";
import type { AIOp, ArchMeta, ExplainOut, Finding, ReviewOut, Suggestion, SuggestionRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "../ui";

const OBJECTIVES = [["reduce_cost", "Reduce cost"], ["improve_scalability", "Improve scalability"], ["reduce_complexity", "Reduce complexity"],
  ["prefer_open_source", "Prefer open-source"], ["prefer_self_hosted", "Prefer self-hosted"], ["improve_maintainability", "Improve maintainability"]];
const SEV: Record<string, string> = { high: "text-bad border-bad/40", medium: "text-warn border-warn/40", low: "text-muted border-border", info: "text-accent border-accent/40" };
const inp = "field";
const btn = "btn btn-sm";

export function describeOp(op: AIOp, label: (id: string) => string): string {
  const s = (k: string) => String(op[k] ?? "");
  switch (op.action) {
    case "add_node": return `Add ${s("label") || s("technology_id")}${s("layer") ? ` (layer ${s("layer")})` : ""}`;
    case "remove_node": return `Remove ${label(s("target_node"))}`;
    case "replace_node": return `Replace ${label(s("target_node"))} with ${(op.replacement as { technology_id: string }).technology_id}`;
    case "update_node": return `Update ${label(s("target_node"))}`;
    case "add_edge": return `Connect ${label(s("source"))} → ${label(s("target"))} (${s("connection_type").replace(/_/g, " ")})`;
    case "remove_edge": return `Remove connection ${s("edge_id")}`;
    default: return op.action;
  }
}

export function Assistant({ id, token, dirty, onApplied }: { id: string; token: string; dirty: boolean; onApplied: () => void }) {
  const { nodes, selected, setSelected, setPreview } = useEditor();
  const [prompt, setPrompt] = useState("");
  const [objective, setObjective] = useState(OBJECTIVES[0][0]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [review, setReview] = useState<ReviewOut | null>(null);
  const [explain, setExplain] = useState<ExplainOut | null>(null);
  const [past, setPast] = useState<SuggestionRow[]>([]);
  const [others, setOthers] = useState<ArchMeta[]>([]);
  const [cmpWith, setCmpWith] = useState("");
  const [cmp, setCmp] = useState<Record<string, unknown> | null>(null);
  const label = useCallback((nid: string) => {
    const existing = nodes.find((n) => n.id === nid)?.data.label;
    if (existing) return existing;
    const added = sug?.proposal.operations.find((o) => o.action === "add_node" && o.ref === nid); // temp ref from this proposal
    return added ? String(added.label || added.technology_id) : nid;
  }, [nodes, sug]);
  const selNode = selected?.kind === "node" ? nodes.find((n) => n.id === selected.id && n.type === "component") : undefined;

  const loadPast = useCallback(() => api<SuggestionRow[]>(`/architectures/${id}/ai/suggestions`, { token }).then(setPast, () => {}), [id, token]);
  useEffect(() => { loadPast(); api<ArchMeta[]>("/architectures", { token }).then((r) => setOthers(r.filter((a) => a.id !== id)), () => {}); }, [id, token, loadPast]);

  const run = async <T,>(name: string, path: string, body: unknown, ok: (r: T) => void) => {
    setBusy(name); setErr("");
    try { ok(await api<T>(`/architectures/${path}`, { method: "POST", token, body })); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(""); }
  };
  const show = (s: Suggestion) => { setSug(s); setChosen(new Set(s.proposal.operations.map((_, i) => i))); setPreview({ graph: s.preview_graph, diff: s.diff }); loadPast(); };
  const clear = () => { setSug(null); setPreview(null); };
  const blocked = dirty ? "Save your changes first so the AI sees the current design." : "";

  const accept = async () => {
    if (!sug) return;
    setBusy("accept"); setErr("");
    try {
      const all = chosen.size === sug.proposal.operations.length;
      await api(`/architectures/${id}/ai/suggestions/${sug.id}/accept`, { method: "POST", token, body: { operation_indexes: all ? null : [...chosen].sort((a, b) => a - b) } });
      clear(); onApplied(); loadPast();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not apply"); }
    finally { setBusy(""); }
  };
  const reject = async () => { if (!sug) return; await api(`/architectures/${id}/ai/suggestions/${sug.id}/reject`, { method: "POST", token }).catch(() => {}); clear(); loadPast(); };

  return (
    <div className="space-y-3 text-sm">
      <p className="rounded-lg border hairline bg-surface2 p-2.5 text-xs leading-relaxed text-muted">
        The assistant <b>proposes</b>; nothing changes until you accept. AI text is opinion. &ldquo;Verified data&rdquo; comes from DEVOHOLICS sources.
      </p>
      {blocked && <p role="status" className="text-xs text-warn">{blocked}</p>}
      {err && <p role="alert" className="text-xs text-bad">{err}</p>}

      {!sug && (
        <>
          <section className="space-y-1.5">
            <label className="text-xs text-muted" htmlFor="ai-prompt">Describe what you want to build</label>
            <textarea id="ai-prompt" className={inp} rows={3} value={prompt} maxLength={2000} onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. An AI research assistant that searches the web, processes documents and writes reports" />
            <button className={cn(btn, "btn-primary w-full !h-9")} disabled={!!busy || !!blocked || prompt.trim().length < 3}
              onClick={() => run<Suggestion>("generate", `${id}/ai/generate`, { prompt }, show)}>{busy === "generate" ? "Thinking…" : "Generate architecture"}</button>
          </section>
          <section className="space-y-1.5">
            <div className="flex gap-2">
              <select aria-label="Objective" className={inp} value={objective} onChange={(e) => setObjective(e.target.value)}>
                {OBJECTIVES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <button className={btn} disabled={!!busy || !!blocked} onClick={() => run<Suggestion>("optimize", `${id}/ai/optimize`, { objective }, show)}>{busy === "optimize" ? "…" : "Optimize"}</button>
            </div>
            <button className={cn(btn, "w-full")} disabled={!!busy} onClick={() => run<ReviewOut>("review", `${id}/ai/review`, {}, setReview)}>{busy === "review" ? "Reviewing…" : "Review architecture"}</button>
          </section>
          <section className="space-y-1.5 border-t border-border pt-3">
            <div className="text-xs text-muted">{selNode ? <>Selected: <b className="text-fg">{selNode.data.label}</b></> : "Select a component or connection to ask about it."}</div>
            <input className={inp} value={question} maxLength={1000} onChange={(e) => setQuestion(e.target.value)} placeholder="Optional question, e.g. Can I replace this with CrewAI?" aria-label="Question" />
            <div className="flex gap-2">
              <button className={btn} disabled={!!busy || !selected} onClick={() => run<ExplainOut>("explain", `${id}/ai/explain`,
                { node_id: selected?.kind === "node" ? selected.id : null, edge_id: selected?.kind === "edge" ? selected.id : null, question: question || null }, setExplain)}>{busy === "explain" ? "…" : "Explain"}</button>
              <button className={btn} disabled={!!busy || !selNode || !!blocked} onClick={() => run<Suggestion>("alt", `${id}/ai/alternatives`, { node_id: selNode!.id, question: question || null }, show)}>{busy === "alt" ? "…" : "Suggest alternative"}</button>
            </div>
          </section>
          <section className="space-y-1.5 border-t border-border pt-3">
            <div className="text-xs text-muted">Compare with another design</div>
            <div className="flex gap-2">
              <select aria-label="Compare with" className={inp} value={cmpWith} onChange={(e) => { setCmpWith(e.target.value); setCmp(null); }}>
                <option value="">Choose…</option>{others.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
              <button className={btn} disabled={!cmpWith || !!busy} onClick={() => run<Record<string, unknown>>("cmp", "ai/compare", { a: { id }, b: { id: cmpWith } }, setCmp)}>Compare</button>
            </div>
            {cmp && <Compare data={cmp} />}
          </section>
        </>
      )}

      {explain && !sug && (
        <section className="space-y-1 rounded-md border border-border p-2"><Badge>AI explanation</Badge>
          <p className="whitespace-pre-wrap text-xs">{explain.answer}</p><Facts facts={explain.verified_facts} /></section>
      )}

      {review && !sug && (
        <section className="space-y-1.5" aria-label="Review findings">
          <h3 className="text-xs font-medium">Review ({review.findings.length})</h3>
          {review.ai_error && <p className="text-xs text-warn">{review.ai_error}</p>}
          {review.findings.length === 0 && <p className="text-xs text-good">No findings.</p>}
          {review.findings.map((f: Finding, i) => (
            <div key={i} className={cn("rounded-lg border p-2.5 text-xs", SEV[f.severity])}>
              <div className="flex items-center gap-2"><b className="uppercase">{f.severity}</b><span className="text-fg">{f.title}</span>
                <Badge className="ml-auto">{f.source === "rule" ? "rule" : "AI opinion"}</Badge></div>
              <p className="mt-1 text-muted">{f.explanation}</p>
              {f.nodes.map((n) => <button key={n} onClick={() => setSelected({ kind: "node", id: n })} className="mr-2 mt-1 text-accent hover:underline">{label(n)}</button>)}
            </div>
          ))}
        </section>
      )}

      {sug && (
        <section className="space-y-2" aria-label="Proposal">
          <div className="flex items-center gap-2"><Badge className="text-accent">AI suggestion · {sug.kind}</Badge><span className="text-xs text-muted">preview on canvas</span></div>
          <h3 className="font-medium">{sug.proposal.summary}</h3>
          {sug.proposal.explanation && <p className="whitespace-pre-wrap text-xs text-muted">{sug.proposal.explanation}</p>}
          <ul className="space-y-1" aria-label="Proposed changes">
            {sug.proposal.operations.map((op, i) => (
              <li key={i} className="rounded-lg border hairline p-2 text-xs">
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={chosen.has(i)} onChange={() => setChosen((c) => { const n = new Set(c); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="mt-0.5" />
                  <span><b>{describeOp(op, label)}</b>{op.reason ? <span className="block text-muted">{op.reason}</span> : null}</span>
                </label>
              </li>
            ))}
            {sug.proposal.operations.length === 0 && <li className="text-xs text-muted">The assistant proposed no changes.</li>}
          </ul>
          {sug.proposal.comparison.length > 0 && (
            <table className="w-full text-left text-xs"><thead className="text-muted"><tr><th>Criterion</th><th>Current</th><th>Alternative</th></tr></thead>
              <tbody>{sug.proposal.comparison.map((r, i) => <tr key={i} className="border-t border-border align-top"><td className="py-1 pr-2">{r.criterion}</td><td className="pr-2">{r.current}</td><td>{r.alternative}</td></tr>)}</tbody></table>
          )}
          {[["Assumptions", sug.proposal.assumptions], ["Trade-offs", sug.proposal.trade_offs]].map(([t, l]) => (l as string[]).length > 0 && (
            <div key={t as string} className="text-xs"><div className="font-medium">{t as string}</div><ul className="list-disc pl-4 text-muted">{(l as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          ))}
          <Facts facts={sug.verified_facts} />
          {sug.validation.issues.length > 0 && <p className="text-xs text-warn">{sug.validation.issues.length} validation note(s) after applying; see the Inspector tab.</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={accept} disabled={busy === "accept" || chosen.size === 0} className="btn btn-primary flex-1">
              {busy === "accept" ? "Applying…" : `Accept ${chosen.size === sug.proposal.operations.length ? "all" : `${chosen.size} selected`}`}</button>
            <button onClick={reject} className="btn">Reject</button>
          </div>
        </section>
      )}

      {past.length > 0 && !sug && (
        <section className="border-t border-border pt-3"><h3 className="mb-1 text-xs font-medium">Previous suggestions</h3>
          <ul className="space-y-1">{past.slice(0, 6).map((p) => <li key={p.id} className="flex justify-between gap-2 text-xs text-muted"><span className="truncate">{p.summary ?? p.prompt}</span><Badge>{p.status}</Badge></li>)}</ul></section>
      )}
    </div>
  );
}

function Facts({ facts }: { facts: Record<string, Record<string, unknown>> }) {
  const rows = Object.values(facts).filter(Boolean);
  if (!rows.length) return null;
  return (
    <details className="text-xs"><summary className="cursor-pointer text-muted hover:text-fg">Verified data (DEVOHOLICS)</summary>
      <ul className="mt-1 space-y-1">{rows.map((f) => (
        <li key={String(f.slug)} className="rounded border border-border p-1.5"><b>{String(f.name)}</b> · {String(f.component_type)}
          <div className="text-muted">license {String(f.license ?? "unknown")} · stars {String(f.stars ?? "?")} · last push {f.days_since_last_push == null ? "unknown" : `${f.days_since_last_push}d ago`} · release {String(f.latest_release ?? "none recorded")}</div></li>
      ))}</ul></details>
  );
}

function Compare({ data }: { data: Record<string, unknown> }) {
  const a = data.a as Record<string, unknown>, b = data.b as Record<string, unknown>;
  const rows: [string, keyof typeof a][] = [["Components", "components"], ["Connections", "connections"], ["Open-source licensed", "open_source_licensed"],
    ["Unknown license", "license_unknown"], ["External services", "external_services"], ["Infrastructure", "infrastructure_components"], ["Unverified links", "unverified_connections"]];
  const list = (k: string) => (data[k] as string[]).join(", ") || "none";
  return (
    <div className="space-y-1 text-xs">
      <table className="w-full text-left"><thead className="text-muted"><tr><th></th><th>This</th><th>Other</th></tr></thead><tbody>
        {rows.map(([l, k]) => <tr key={k} className="border-t border-border"><td className="py-0.5 text-muted">{l}</td><td>{String(a[k])}</td><td>{String(b[k])}</td></tr>)}
        <tr className="border-t border-border"><td className="py-0.5 text-muted">Monitoring</td><td>{a.has_monitoring ? "yes" : "no"}</td><td>{b.has_monitoring ? "yes" : "no"}</td></tr></tbody></table>
      <p><span className="text-muted">Only here:</span> {list("only_in_a")}</p><p><span className="text-muted">Only there:</span> {list("only_in_b")}</p>
      <p className="text-faint">{String(data.note)}</p>
    </div>
  );
}
