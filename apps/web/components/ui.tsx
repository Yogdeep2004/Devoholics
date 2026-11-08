import { cn } from "@/lib/utils";
import type { Freshness } from "@/lib/types";

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-xl border hairline bg-surface p-4", className)} {...p} />
);

export const Badge = ({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) => <span className={cn("tag", className)} {...p} />;

export function FreshnessBadge({ f }: { f: Freshness }) {
  const tone = f.status === "fresh" ? "text-good" : f.status === "stale" ? "text-warn" : "text-muted";
  const label = f.status === "never" ? "not yet synced" : f.status === "stale" ? "stale data" : "fresh data";
  return <span className={cn("tag", tone)} title={f.last_synced_at ?? undefined}>{label}</span>;
}

export const ErrorNote = ({ msg }: { msg: string }) => (
  <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">Could not load data: {msg}. Is the API running?</p>
);

/** Skeletons are shaped like the content they stand in for. */
export const Skeleton = ({ n = 3, h = 88 }: { n?: number; h?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" style={{ height: h }} />)}
  </div>
);

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 truncate text-2xl font-medium tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  );
}

export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="rounded-xl border border-dashed border-border-strong px-6 py-14 text-center">
    <p className="font-medium">{title}</p>
    {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{hint}</p>}
  </div>
);
