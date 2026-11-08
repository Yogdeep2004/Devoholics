"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ArchMeta } from "@/lib/types";

/** Profile -> Playground bridge: adds the technology as a new version of an existing design, or starts a new one. */
export function AddToArchitecture({ slug }: { slug: string }) {
  const { token, ready } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<ArchMeta[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (ready && !token) return <Link href="/login" className="btn w-full">Sign in to use in the Playground</Link>;

  const open = async () => { setErr(""); try { setList(await api<ArchMeta[]>("/architectures", { token })); } catch (e) { setErr((e as Error).message); } };
  const go = async (archId: string | null) => {
    setBusy(true); setErr("");
    try {
      let id = archId;
      if (!id) id = (await api<ArchMeta>("/architectures", { method: "POST", token, body: { title: "Untitled architecture" } })).id;
      await api(`/architectures/${id}/add-technology`, { method: "POST", token, body: { technology: slug } });
      router.push(`/playground/${id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  if (!list) return <button onClick={open} disabled={!ready} className="btn btn-primary w-full">Open in Playground</button>;
  return (
    <div className="w-full space-y-0.5 rounded-xl border border-border-strong bg-surface p-1.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.6)]" role="menu" aria-label="Add to architecture">
      <button role="menuitem" disabled={busy} onClick={() => go(null)} className="row-hover w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150">+ New architecture</button>
      {list.map((a) => <button key={a.id} role="menuitem" disabled={busy} onClick={() => go(a.id)} className="row-hover w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150">{a.title}</button>)}
      {err && <p role="alert" className="text-xs text-bad">{err}</p>}
      <button onClick={() => setList(null)} className="text-xs text-muted hover:text-fg">Cancel</button>
    </div>
  );
}
