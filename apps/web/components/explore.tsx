"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/use-api";
import type { Category, TechSummary } from "@/lib/types";
import { compact, cn } from "@/lib/utils";
import { Badge, Card, ErrorNote, FreshnessBadge, Skeleton } from "./ui";

export function TechCard({ t }: { t: TechSummary }) {
  return (
    <Link href={`/t/${t.slug}`} className="block">
      <Card className="h-full space-y-2 transition-colors hover:border-accent/50">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{t.name}</h3>
          <Badge>{t.category}</Badge>
        </div>
        <p className="line-clamp-2 min-h-10 text-sm text-muted">{t.description ?? "No description recorded."}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>★ {compact(t.stars)}</span><span>⑂ {compact(t.forks)}</span>
          <span>{t.license ?? "license unknown"}</span><FreshnessBadge f={t.freshness} />
        </div>
      </Card>
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
  const qs = new URLSearchParams({ sort, limit: "60", ...(debounced && { q: debounced }), ...(category && { category }) });
  const { data, error, loading } = useApi<TechSummary[]>(`/technologies?${qs}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search technologies…"
          aria-label="Search technologies" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <option value="stars">Most stars</option><option value="name">Name</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
        {[{ slug: "", name: "All", technology_count: 0 }, ...(cats.data ?? [])].map((c) => (
          <button key={c.slug} aria-pressed={category === c.slug} onClick={() => setCategory(c.slug)}
            className={cn("rounded-full border px-3 py-1 text-sm", category === c.slug ? "border-accent bg-accent/15 text-accent" : "border-border text-muted hover:text-fg")}>
            {c.name}{c.technology_count ? ` · ${c.technology_count}` : ""}
          </button>
        ))}
      </div>
      {error ? <ErrorNote msg={error} /> : loading ? <Skeleton n={6} /> : data!.length === 0 ? (
        <p className="py-12 text-center text-muted">No technologies match. Try a different search or category.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data!.map((t) => <TechCard key={t.slug} t={t} />)}</div>
      )}
    </div>
  );
}
