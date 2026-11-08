"use client";
import { ArrowUpRight, GitFork, SealCheck, Users } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { BlueprintDetail } from "@/lib/types";
import { compact } from "@/lib/utils";
import { Diagram } from "../playground/diagram";
import { Badge, Card, ErrorNote, Skeleton } from "../ui";
import { DIFF_TONE } from "./list";

const REASONS = [["spam", "Spam or advertising"], ["inappropriate", "Inappropriate"], ["inaccurate", "Technically misleading"], ["copyright", "Copyright"], ["other", "Other"]];

function ReportBox({ slug, token }: { slug: string; token: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState("spam"); const [details, setDetails] = useState(""); const [msg, setMsg] = useState("");
  const send = async () => {
    try { await api(`/blueprints/${slug}/report`, { method: "POST", token, body: { reason, details: details || null } }); setMsg("Thanks, a moderator will review this."); setOpen(false); }
    catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="text-sm">
      {msg && <p role="status" className="mb-1 text-xs text-muted">{msg}</p>}
      {!open ? <button onClick={() => setOpen(true)} className="text-xs text-muted hover:text-fg">Report this blueprint</button> : (
        <div className="space-y-2 rounded-xl border hairline p-3">
          <select aria-label="Report reason" value={reason} onChange={(e) => setReason(e.target.value)} className="field">
            {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <textarea aria-label="Report details" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Details (optional)" className="field" />
          <div className="flex gap-2"><button onClick={send} className="btn btn-primary btn-sm">Submit report</button>
            <button onClick={() => setOpen(false)} className="btn btn-sm">Cancel</button></div>
        </div>)}
    </div>
  );
}

export function BlueprintPage({ slug }: { slug: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const { data: b, error, loading } = useApi<BlueprintDetail>(`/blueprints/${slug}`);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (error) return <ErrorNote msg={error} />;
  if (loading || !b) return <Skeleton />;
  const fork = async () => {
    setBusy(true); setErr("");
    try { const r = await api<{ architecture_id: string }>(`/blueprints/${slug}/fork`, { method: "POST", token }); router.push(`/playground/${r.architecture_id}`); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <div className="space-y-6">
      {b.status !== "published" && <p role="status" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
        Status: <b>{b.status}</b>{b.moderation_note ? `. Moderator note: ${b.moderation_note}` : b.status === "pending" ? ". Only you can see this until a moderator approves it." : ""}</p>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="display text-3xl">{b.title}</h1>
            {b.curated ? <Badge className="gap-1 text-accent"><SealCheck size={12} weight="fill" />Curated</Badge> : <Badge className="gap-1"><Users size={12} />Community</Badge>}<Badge className={DIFF_TONE[b.difficulty]}>{b.difficulty}</Badge></div>
          <p className="text-sm text-muted">{b.description}</p>
          <p className="num text-xs text-muted">By {b.author.username}, version {b.version}{b.changelog ? ` (${b.changelog})` : ""}, {b.fork_count} forks</p>
          {b.notice && <p className="text-xs text-muted">{b.notice}</p>}
        </div>
        <div className="w-56 space-y-2">
          {token ? <button onClick={fork} disabled={busy || b.status !== "published"} className="btn btn-primary h-10 w-full text-sm"><GitFork size={15} weight="bold" />{busy ? "Forking..." : "Fork architecture"}</button>
            : <Link href="/login" className="btn btn-primary h-10 w-full text-sm">Sign in to fork</Link>}
          <p className="text-xs text-muted">Creates a private, editable copy in your Playground.</p>
          {err && <p role="alert" className="text-xs text-bad">{err}</p>}
          {token && b.status === "published" && !b.is_author && <ReportBox slug={slug} token={token} />}
        </div>
      </div>

      <Diagram graph={b.graph} report={b.validation} />
      <p className="-mt-3 text-xs text-muted">Grey lines match a common structural pattern for those component types. Green means a verified integration is on record. Dashed amber is custom or unverified, so check each tool&apos;s documentation. These are design patterns, not claims of official integrations.</p>

      <section aria-labelledby="comp"><h2 id="comp" className="display mb-2 text-xl">Technology components</h2>
        <p className="mb-2 text-xs text-muted">Facts below come from DEVOHOLICS data collection, not from the author.</p>
        <div className="overflow-x-auto rounded-xl border hairline"><table className="w-full text-left text-[13px]">
          <thead className="border-b hairline text-xs text-muted"><tr><th className="px-3 py-2.5 font-normal">Component</th><th className="px-3 py-2.5 font-normal">Technology</th><th className="px-3 py-2.5 font-normal">Layer</th><th className="px-3 py-2.5 font-normal">License</th><th className="px-3 py-2.5 font-normal">Stars</th><th className="px-3 py-2.5 font-normal">Last push</th><th className="px-3 py-2.5 font-normal">Source</th></tr></thead>
          <tbody>{b.component_facts.map((c) => (
            <tr key={c.node_id} className="row-hover border-t hairline first:border-0 [&>td]:px-3 [&>td]:py-2.5">
              <td>{c.label}</td><td><Link href={`/t/${c.slug}`} className="text-accent hover:underline">{c.name}</Link></td>
              <td className="text-muted">{c.layer ?? "n/a"}</td><td>{c.license ?? "unknown"}</td><td>{compact(c.stars)}</td>
              <td>{c.days_since_last_push == null ? "unknown" : `${c.days_since_last_push}d ago`}</td>
              <td>{c.source ? <a href={c.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">GitHub<ArrowUpRight size={12} /></a> : "n/a"}</td></tr>))}</tbody></table></div></section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Data flows" items={b.data_flows} />
        <Section title="Known limitations" items={b.known_limitations} />
      </div>
      {b.integration_notes.length > 0 && <section><h2 className="display mb-2 text-xl">Integration notes</h2><div className="space-y-2">
        {b.integration_notes.map((n, i) => <Card key={i} className="text-sm"><b className="font-medium">{n.from} → {n.to}</b><p className="text-muted">{n.explanation}</p></Card>)}</div></section>}
      {b.infrastructure_notes && <section><h2 className="display mb-1 text-xl">Infrastructure considerations</h2><p className="text-sm text-muted">{b.infrastructure_notes}</p></section>}
      {b.versions.length > 1 && <section><h2 className="display mb-1 text-xl">Version history</h2><ul className="text-sm text-muted">
        {b.versions.map((v) => <li key={v.version} className="num">v{v.version}, {new Date(v.created_at).toLocaleDateString()}, {v.changelog ?? "no changelog"}</li>)}</ul></section>}
    </div>
  );
}

const Section = ({ title, items }: { title: string; items: string[] }) => items.length === 0 ? null : (
  <section><h2 className="display mb-2 text-xl">{title}</h2><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></section>
);
