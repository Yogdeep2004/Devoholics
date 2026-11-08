"use client";
import { GitFork, MagnifyingGlass, Scales, Star } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/use-api";
import type { Category, TechSummary } from "@/lib/types";
import { compact, plain } from "@/lib/utils";
import { TechLogo } from "./logo";
import { Empty, ErrorNote } from "./ui";

export function TechCard({ t, i = 0 }: { t: TechSummary; i?: number }) {
  return (
    <Link href={`/t/${t.slug}`} className="rise lift flex h-full flex-col gap-3 rounded-xl border hairline bg-surface p-4" style={{ ["--i" as string]: Math.min(i, 9) }}>
      <div className="flex items-center gap-3">
        <TechLogo name={t.name} repoUrl={t.repository_url} size={32} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium tracking-tight">{t.name}</h3>
          <span className="text-xs text-muted">{t.category}</span>
        </div>
      </div>
      <p className="line-clamp-2 min-h-[2.6rem] text-[13px] leading-snug text-muted">{plain(t.description) || "No description recorded."}</p>
      <div className="num mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Star size={13} weight="fill" className="text-faint" />{compact(t.stars)}</span>
        <span className="inline-flex items-center gap-1"><GitFork size={13} className="text-faint" />{compact(t.forks)}</span>
        <span className="inline-flex items-center gap-1"><Scales size={13} className="text-faint" />{t.license ?? "unknown"}</span>
        {t.freshness.status !== "fresh" && <span className="text-warn">{t.freshness.status === "never" ? "not synced" : "stale"}</span>}
      </div>
    </Link>
  );
}

export function Explore() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("stars");
  useEffect(() => { const id = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  const cats = useApi<Category[]>("/categories");
  const qs = new URLSearchParams({ sort, limit: "90", ...(debounced && { q: debounced }), ...(category && { category }) });
  const { data, error, loading } = useApi<TechSummary[]>(`/technologies?${qs}`);
  return (
    <div className="grid gap-6 lg:grid-cols-[210px_1fr] lg:gap-10">
      <aside className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:self-start" aria-label="Filters">
        <label className="relative block">
          <span className="sr-only">Search technologies</span>
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools" aria-label="Search technologies" className="field !pl-9" />
        </label>
        <div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className="field">
            <option value="stars">Most stars</option><option value="name">Name</option>
          </select>
        </div>
        <div role="group" aria-label="Category" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0">
          {[{ slug: "", name: "All", technology_count: 0 }, ...(cats.data ?? [])].map((c) => (
            <button key={c.slug} aria-pressed={category === c.slug} onClick={() => setCategory(c.slug)} className="rail-item justify-between">
              <span>{c.name}</span>{c.technology_count ? <span className="num text-xs text-faint">{c.technology_count}</span> : null}
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        {error ? <ErrorNote msg={error} /> : loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 150 }} />)}</div>
        ) : data!.length === 0 ? (
          <Empty title="No technologies match" hint="Try a different search or category." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data!.map((t, i) => <TechCard key={t.slug} t={t} i={i} />)}</div>
        )}
      </div>
    </div>
  );
}
