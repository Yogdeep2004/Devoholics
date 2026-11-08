"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { BlueprintCard, Me, ReportRow } from "@/lib/types";
import { Badge, Card, ErrorNote, Skeleton } from "../ui";

export function Moderation() {
  const { token, ready } = useAuth();
  const [rev, setRev] = useState(0);
  const me = useApi<Me>(token ? "/me" : null, true);
  const isMod = !!me.data?.is_admin;
  const queue = useApi<BlueprintCard[]>(isMod ? `/admin/blueprints?status=pending&r=${rev}` : null, true);
  const reports = useApi<ReportRow[]>(isMod ? `/admin/reports?r=${rev}` : null, true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const act = async (path: string, body: unknown) => { setErr(""); try { await api(path, { method: "POST", token, body }); setRev((r) => r + 1); } catch (e) { setErr((e as Error).message); } };

  if (!ready || (token && me.loading)) return <Skeleton />;
  if (!token) return <p className="py-12 text-center text-muted">Sign in as a moderator.</p>;
  if (me.error) return <ErrorNote msg={me.error} />;
  if (!isMod) return <p className="py-12 text-center text-muted">Moderator access required.</p>;
  return (
    <div className="space-y-8">
      <h1 className="display text-3xl">Moderation</h1>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <section className="space-y-2" aria-label="Pending blueprints"><h2 className="font-medium">Pending submissions ({queue.data?.length ?? 0})</h2>
        {queue.data?.length === 0 && <p className="text-sm text-muted">Nothing waiting.</p>}
        {queue.data?.map((b) => (
          <Card key={b.slug} className="space-y-2"><div className="flex items-center justify-between gap-2">
            <Link href={`/blueprints/${b.slug}`} className="font-medium hover:underline">{b.title}</Link><Badge>{b.difficulty}</Badge></div>
            <p className="text-sm text-muted">{b.description}</p><p className="text-xs text-muted">by {b.author.username} · {b.components} components · v{b.version}</p>
            <input aria-label={`Note for ${b.title}`} placeholder="Note (required to reject)" value={notes[b.slug] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [b.slug]: e.target.value }))} className="field" />
            <div className="flex gap-2"><button onClick={() => act(`/admin/blueprints/${b.slug}/approve`, { note: notes[b.slug] || null })} className="btn btn-primary btn-sm">Approve</button>
              <button onClick={() => act(`/admin/blueprints/${b.slug}/reject`, { note: notes[b.slug] })} className="btn btn-sm !text-bad">Reject</button></div></Card>))}
      </section>
      <section className="space-y-2" aria-label="Open reports"><h2 className="font-medium">Open reports ({reports.data?.length ?? 0})</h2>
        {reports.data?.length === 0 && <p className="text-sm text-muted">No open reports.</p>}
        {reports.data?.map((r) => (
          <Card key={r.id} className="space-y-2"><div className="flex items-center justify-between"><Link href={`/blueprints/${r.blueprint.slug}`} className="font-medium hover:underline">{r.blueprint.title}</Link><Badge className="text-warn">{r.reason}</Badge></div>
            {r.details && <p className="text-sm text-muted">{r.details}</p>}
            <div className="flex gap-2"><button onClick={() => act(`/admin/reports/${r.id}/resolve`, { action: "dismiss" })} className="btn btn-sm">Dismiss</button>
              <button onClick={() => confirm("Remove this blueprint from the library?") && act(`/admin/reports/${r.id}/resolve`, { action: "remove_blueprint", note: `Removed after report (${r.reason})` })} className="btn btn-sm !text-bad">Remove blueprint</button></div></Card>))}
      </section>
    </div>
  );
}
