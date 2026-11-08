"use client";
import { useState } from "react";
import { useApi } from "@/lib/use-api";
import type { FeedCardT } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FeedCard } from "./feed-card";
import { ErrorNote, Skeleton } from "./ui";

const TYPES = [["", "All updates"], ["trending", "Trending"], ["releases", "New releases"], ["warnings", "Maintenance"]];
const WINDOWS = ["24h", "7d", "30d", "90d"];
const SORTS = [["relevance", "Relevance"], ["recency", "Recency"], ["growth", "Growth"]];

const Pill = ({ on, ...p }: { on: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button aria-pressed={on} className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-accent bg-accent/15 text-accent" : "border-border text-muted hover:text-fg")} {...p} />
);

export function Feed() {
  const [type, setType] = useState("");
  const [window, setWindow] = useState("30d");
  const [sort, setSort] = useState("relevance");
  const qs = new URLSearchParams({ window, sort, limit: "60", ...(type && { event_type: type }) });
  const { data, error, loading } = useApi<FeedCardT[]>(`/feed?${qs}`);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Update type">
          {TYPES.map(([v, l]) => <Pill key={v} on={type === v} onClick={() => setType(v)}>{l}</Pill>)}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time window and sort">
          {WINDOWS.map((w) => <Pill key={w} on={window === w} onClick={() => setWindow(w)}>{w}</Pill>)}
          <span className="mx-1 text-border">|</span>
          {SORTS.map(([v, l]) => <Pill key={v} on={sort === v} onClick={() => setSort(v)}>{l}</Pill>)}
        </div>
      </div>
      {error ? <ErrorNote msg={error} /> : loading ? <Skeleton /> : data!.length === 0 ? (
        <p className="py-12 text-center text-muted">No updates in this window. Try a longer time range.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">{data!.map((c) => <FeedCard key={c.id} c={c} />)}</div>
      )}
    </div>
  );
}
