"use client";
import { Plus, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { ArchMeta, BlueprintCard } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { Badge, Card, ErrorNote, Skeleton } from "../ui";

type Col = { id: string; name: string };

export function PlaygroundHome() {
  const { token, ready } = useAuth();
  const router = useRouter();
  const [rev, setRev] = useState(0);
  const archs = useApi<ArchMeta[]>(token ? `/architectures?r=${rev}` : null, true);
  const cols = useApi<Col[]>(token ? `/collections?r=${rev}` : null, true);
  const subs = useApi<BlueprintCard[]>(token ? `/blueprints/mine?r=${rev}` : null, true);
  const [colName, setColName] = useState("");
  const [err, setErr] = useState("");

  if (!ready) return <Skeleton />;
  if (!token) return (
    <div className="py-16 text-center">
      <p className="text-muted">Sign in to design and save architectures.</p>
      <Link href="/login" className="btn btn-primary mt-4 h-10 px-5 text-sm">Sign in</Link>
    </div>
  );
  const create = async (collection_id?: string) => {
    try { const a = await api<ArchMeta>("/architectures", { method: "POST", token, body: { title: "Untitled architecture", collection_id: collection_id ?? null } }); router.push(`/playground/${a.id}`); }
    catch (e) { setErr((e as Error).message); }
  };
  const act = async (path: string, method: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try { await api(path, { method, token }); setRev((r) => r + 1); } catch (e) { setErr((e as Error).message); }
  };
  const addCol = async () => { if (!colName.trim()) return; await api("/collections", { method: "POST", token, body: { name: colName.trim() } }); setColName(""); setRev((r) => r + 1); };
  const colOf = (id: string | null) => cols.data?.find((c) => c.id === id)?.name;
  const subTone: Record<string, string> = { pending: "text-warn", published: "text-good", rejected: "text-bad", removed: "text-bad" };
  if (archs.error) return <ErrorNote msg={archs.error} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="display text-3xl">Playground</h1>
          <p className="text-sm text-muted">Design systems from real technologies in the DEVOHOLICS database. Private by default; every save is a version.</p></div>
        <button onClick={() => create()} className="btn btn-primary h-10 px-5 text-sm"><Plus size={15} weight="bold" />New architecture</button>
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <section className="space-y-2" aria-label="Collections">
        <div className="flex flex-wrap items-center gap-2">
          {(cols.data ?? []).map((c) => (
            <Badge key={c.id} className="gap-2">{c.name}
              <button aria-label={`Delete collection ${c.name}`} onClick={() => act(`/collections/${c.id}`, "DELETE", `Delete collection "${c.name}"? Its architectures are kept.`)} className="hover:text-bad"><X size={12} /></button></Badge>
          ))}
          <input value={colName} onChange={(e) => setColName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCol()} placeholder="New collection…" aria-label="New collection name"
            className="field !h-8 !w-48 !text-[13px]" />
        </div>
      </section>
      {!archs.data ? <Skeleton /> : archs.data.length === 0 ? (
        <p className="py-12 text-center text-muted">No architectures yet. Create one to start with a blank canvas.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {archs.data.map((a) => (
            <Card key={a.id} className="lift space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/playground/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                <Badge>{a.visibility}</Badge>
              </div>
              <div className="num text-xs text-muted">v{a.latest_version}, updated {timeAgo(a.updated_at)}{colOf(a.collection_id) ? `, ${colOf(a.collection_id)}` : ""}</div>
              <div className="flex gap-3 text-xs">
                <Link href={`/playground/${a.id}`} className="btn btn-sm">Open</Link>
                <button onClick={() => act(`/architectures/${a.id}/duplicate`, "POST")} className="btn btn-sm">Duplicate</button>
                <button onClick={() => act(`/architectures/${a.id}`, "DELETE", `Delete "${a.title}" and all its versions? This cannot be undone.`)} className="btn btn-sm !text-bad">Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {subs.data && subs.data.length > 0 && (
        <section className="space-y-2" aria-label="My blueprint submissions"><h2 className="font-medium">My blueprint submissions</h2>
          <ul className="space-y-1">{subs.data.map((b) => (
            <li key={b.slug} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-sm">
              <Link href={`/blueprints/${b.slug}`} className="hover:underline">{b.title}</Link>
              <span className={`text-xs ${subTone[b.status]}`}>{b.status}{b.moderation_note ? ` · ${b.moderation_note}` : ""}</span></li>))}</ul></section>)}
    </div>
  );
}
