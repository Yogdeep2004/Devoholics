import { cn } from "@/lib/utils";
import type { Freshness } from "@/lib/types";

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-lg border border-border bg-surface p-4", className)} {...p} />
);

export const Badge = ({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("inline-flex items-center rounded border border-border bg-surface2 px-1.5 py-0.5 text-xs text-muted", className)} {...p} />
);

export function FreshnessBadge({ f }: { f: Freshness }) {
  const tone = f.status === "fresh" ? "text-good" : f.status === "stale" ? "text-warn" : "text-muted";
  const label = f.status === "never" ? "not yet synced" : f.status === "stale" ? "stale data" : "fresh data";
  return <Badge className={tone} title={f.last_synced_at ?? undefined}>{label}</Badge>;
}

export const ErrorNote = ({ msg }: { msg: string }) => (
  <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">Could not load data: {msg}. Is the API running?</p>
);

export const Skeleton = ({ n = 3 }: { n?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: n }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />)}
  </div>
);
