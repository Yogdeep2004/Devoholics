"use client";
import { X } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

const inp = "field";
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/** Submits the architecture's latest *saved* version as a community blueprint (goes to moderation first). */
export function PublishDialog({ architectureId, defaultTitle, token, dirty, onClose }: { architectureId: string; defaultTitle: string; token: string; dirty: boolean; onClose: () => void }) {
  const [f, setF] = useState({ title: defaultTitle === "Untitled architecture" ? "" : defaultTitle, description: "", difficulty: "intermediate", flows: "", limits: "", infra: "" });
  const [err, setErr] = useState(""); const [done, setDone] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api<{ slug: string }>("/blueprints", { method: "POST", token, body: {
        architecture_id: architectureId, title: f.title, description: f.description, difficulty: f.difficulty,
        data_flows: lines(f.flows), known_limitations: lines(f.limits), infrastructure_notes: f.infra || null } });
      setDone(r.slug);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Publish as blueprint">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-strong bg-surface p-5 shadow-[0_24px_64px_-16px_rgb(0_0_0/0.8)]">
        <div className="mb-3 flex justify-between"><h2 className="font-medium">Publish as blueprint</h2><button onClick={onClose} aria-label="Close" className="btn btn-icon btn-sm"><X size={14} /></button></div>
        {done ? (
          <div className="space-y-3 text-sm"><p role="status" className="text-good">Submitted for review.</p>
            <p className="text-muted">A moderator will check it for policy. It stays private to you until approved. This is not a technical review.</p>
            <Link href={`/blueprints/${done}`} className="text-accent hover:underline">View your submission</Link></div>
        ) : (
          <form onSubmit={submit} className="space-y-3 text-sm">
            {dirty && <p role="status" className="text-xs text-warn">You have unsaved changes. Only your last saved version is published.</p>}
            <label className="block space-y-1 text-xs text-muted">Title<input className={inp} required minLength={3} maxLength={200} value={f.title} onChange={set("title")} /></label>
            <label className="block space-y-1 text-xs text-muted">Description (what it is for and how it works)<textarea className={inp} required minLength={20} maxLength={3000} rows={3} value={f.description} onChange={set("description")} /></label>
            <label className="block space-y-1 text-xs text-muted">Difficulty<select className={inp} value={f.difficulty} onChange={set("difficulty")}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            <label className="block space-y-1 text-xs text-muted">Data flows (one per line)<textarea className={inp} rows={3} value={f.flows} onChange={set("flows")} /></label>
            <label className="block space-y-1 text-xs text-muted">Known limitations (one per line)<textarea className={inp} rows={3} value={f.limits} onChange={set("limits")} /></label>
            <label className="block space-y-1 text-xs text-muted">Infrastructure considerations<textarea className={inp} rows={2} maxLength={2000} value={f.infra} onChange={set("infra")} /></label>
            {err && <p role="alert" className="text-xs text-bad">{err}</p>}
            <div className="flex gap-2"><button disabled={busy} className="btn btn-primary">{busy ? "Submitting…" : "Submit for review"}</button>
              <button type="button" onClick={onClose} className="btn">Cancel</button></div>
          </form>)}
      </div>
    </div>
  );
}
