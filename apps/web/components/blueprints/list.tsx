"use client";
import { GitFork, MagnifyingGlass, SealCheck, Users } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/use-api";
import type { BlueprintCard } from "@/lib/types";
import { Empty, ErrorNote } from "../ui";
import { GraphThumb } from "./thumb";

export const DIFF_TONE = { beginner: "text-good", intermediate: "text-warn", advanced: "text-bad" } as const;

export function BlueprintTile({ b, i = 0 }: { b: BlueprintCard; i?: number }) {
  return (
    <Link href={`/blueprints/${b.slug}`} className="rise lift group flex h-full flex-col overflow-hidden rounded-xl border hairline bg-surface" style={{ ["--i" as string]: Math.min(i, 8) }}>
      <div className="surface-grid h-28 border-b hairline bg-bg/40 px-2">{b.thumb && <GraphThumb thumb={b.thumb} />}</div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-medium leading-snug tracking-tight">{b.title}</h3>
          {b.curated ? <span className="tag shrink-0 gap-1 text-accent"><SealCheck size={12} weight="fill" />Curated</span> : <span className="tag shrink-0 gap-1"><Users size={12} />Community</span>}
        </div>
        <p className="line-clamp-2 text-[13px] leading-snug text-muted">{b.description}</p>
        <div className="num mt-auto flex items-center gap-x-4 pt-1 text-xs text-muted">
          <span className={DIFF_TONE[b.difficulty]}>{b.difficulty}</span>
          <span>{b.components} parts</span>
          <span className="inline-flex items-center gap-1"><GitFork size={13} />{b.fork_count}</span>
        </div>
      </div>
    </Link>
  );
}

export function BlueprintLibrary() {
  const [q, setQ] = useState(""); const [d, setD] = useState(""); const [difficulty, setDifficulty] = useState(""); const [sort, setSort] = useState("popular");
  useEffect(() => { const id = setTimeout(() => setD(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  const qs = new URLSearchParams({ sort, ...(d && { q: d }), ...(difficulty && { difficulty }) });
  const { data, error, loading } = useApi<BlueprintCard[]>(`/blueprints?${qs}`);
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search blueprints</span>
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search blueprints" aria-label="Search blueprints" className="field !pl-9" />
        </label>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Difficulty">
          {[["", "All levels"], ["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]].map(([v, l]) => (
            <button key={v} aria-pressed={difficulty === v} onClick={() => setDifficulty(v)} className="chip">{l}</button>))}
        </div>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="field sm:!w-36">
          <option value="popular">Most forked</option><option value="new">Newest</option></select>
      </div>
      {error ? <ErrorNote msg={error} /> : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 232 }} />)}</div>
      ) : data!.length === 0 ? <Empty title="No blueprints match" hint="Try another search or level." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data!.map((b, i) => <BlueprintTile key={b.slug} b={b} i={i} />)}</div>
      )}
    </div>
  );
}
