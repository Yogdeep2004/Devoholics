import Link from "next/link";
import type { FeedCardT } from "@/lib/types";
import { compact, timeAgo } from "@/lib/utils";
import { Badge, Card } from "./ui";

const TYPE_LABEL: Record<string, string> = {
  new_release: "New release", trending: "Trending", maintenance_warning: "Maintenance warning",
};

export function FeedCard({ c }: { c: FeedCardT }) {
  const warn = c.type === "maintenance_warning";
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className={warn ? "text-warn" : "text-accent"}>{TYPE_LABEL[c.type] ?? c.type}</Badge>
        <Badge>{c.technology.category}</Badge>
        <span className="text-muted">{c.source ?? "source n/a"} · {timeAgo(c.detected_at)}</span>
      </div>
      <h3 className="font-medium">
        <Link href={`/t/${c.technology.slug}`} className="hover:underline">{c.title}</Link>
      </h3>
      {c.description && <p className="line-clamp-2 text-sm text-muted">{c.description}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>★ {compact(c.metrics.stars)}</span>
        <span>⑂ {compact(c.metrics.forks)}</span>
        <span>7d: {c.metrics.stars_gained_7d == null ? "no history yet" : `+${compact(c.metrics.stars_gained_7d)}`}</span>
      </div>
      {c.used_in.length > 0 && (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-2 text-xs">
          <span className="text-accent">In your stack:</span>{" "}
          {c.used_in.map((u, i) => (
            <span key={u.architecture_id + u.node_id}>{i > 0 && ", "}
              <Link href={`/playground/${u.architecture_id}?investigate=${encodeURIComponent(u.node_id)}`} className="underline hover:text-fg">{u.title}</Link></span>
          ))}
          <span className="block text-muted">{warn ? "Open the design to investigate alternatives with the assistant. Nothing changes automatically." : "Open the design to review whether this affects it."}</span>
        </div>
      )}
      <details className="text-xs text-muted">
        <summary className="cursor-pointer hover:text-fg">Why am I seeing this?</summary>
        <ul className="mt-1 list-disc pl-5">{c.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </details>
      <div className="flex gap-3 text-sm">
        <Link href={`/t/${c.technology.slug}`} className="text-accent hover:underline">Explore</Link>
        {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">Source ↗</a>}
      </div>
    </Card>
  );
}
