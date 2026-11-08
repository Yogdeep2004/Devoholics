"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/use-api";
import type { BlueprintCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Card, ErrorNote, Skeleton } from "../ui";

export const DIFF_TONE = { beginner: "text-good", intermediate: "text-warn", advanced: "text-bad" } as const;

export function BlueprintTile({ b }: { b: BlueprintCard }) {
  return (
    <Link href={`/blueprints/${b.slug}`} className="block">
      <Card className="h-full space-y-2 transition-colors hover:border-accent/50">
        <div className="flex items-start justify-between gap-2"><h3 className="font-medium">{b.title}</h3>
          {b.curated ? <Badge className="text-accent">Curated</Badge> : <Badge>Community</Badge>}</div>
        <p className="line-clamp-3 text-sm text-muted">{b.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className={DIFF_TONE[b.difficulty]}>{b.difficulty}</span><span>{b.components} components</span>
          <span>⑂ {b.fork_count} forks</span><span>v{b.version}</span><span>by {b.author.username}</span>
        </div>
        <div className="flex flex-wrap gap-1">{b.technologies.slice(0, 6).map((t) => <Badge key={t}>{t}</Badge>)}</div>
      </Card>
    </Link>
  );
}

export function BlueprintLibrary() {
  const [q, setQ] = useState(""); const [d, setD] = useState(""); const [difficulty, setDifficulty] = useState(""); const [sort, setSort] = useState("popular");
  useEffect(() => { const id = setTimeout(() => setD(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  const qs = new URLSearchParams({ sort, ...(d && { q: d }), ...(difficulty && { difficulty }) });
  const { data, error, loading } = useApi<BlueprintCard[]>(`/blueprints?${qs}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search blueprints…" aria-label="Search blueprints"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted" />
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <option value="popular">Most forked</option><option value="new">Newest</option></select>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulty">
        {[["", "All levels"], ["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]].map(([v, l]) => (
          <button key={v} aria-pressed={difficulty === v} onClick={() => setDifficulty(v)}
            className={cn("rounded-full border px-3 py-1 text-sm", difficulty === v ? "border-accent bg-accent/15 text-accent" : "border-border text-muted hover:text-fg")}>{l}</button>))}
      </div>
      {error ? <ErrorNote msg={error} /> : loading ? <Skeleton n={4} /> : data!.length === 0 ? (
        <p className="py-12 text-center text-muted">No blueprints match.</p>
      ) : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data!.map((b) => <BlueprintTile key={b.slug} b={b} />)}</div>}
    </div>
  );
}
