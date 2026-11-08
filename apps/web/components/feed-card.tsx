import { ArrowUpRight, GithubLogo, Sparkle, TrendUp, Warning, Tag as TagIcon, Stack } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { FeedCardT } from "@/lib/types";
import { compact, plain, timeAgo } from "@/lib/utils";
import { TechLogo } from "./logo";

const TYPE: Record<string, { label: string; Icon: typeof TagIcon; tone: string }> = {
  new_release: { label: "Release", Icon: TagIcon, tone: "text-fg" },
  trending: { label: "Trending", Icon: TrendUp, tone: "text-accent" },
  new_tool: { label: "New tool", Icon: Sparkle, tone: "text-accent" },
  maintenance_warning: { label: "Maintenance", Icon: Warning, tone: "text-warn" },
};

export function FeedCard({ c, i = 0 }: { c: FeedCardT; i?: number }) {
  const t = TYPE[c.type] ?? { label: c.type, Icon: TagIcon, tone: "text-muted" };
  const warn = c.type === "maintenance_warning";
  const g = c.metrics.stars_gained_7d;
  return (
    <article className="rise row-hover grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-[auto_1fr_auto] sm:px-5" style={{ ["--i" as string]: Math.min(i, 8) }}>
      <TechLogo name={c.technology.name} repoUrl={c.technology.repository_url} />
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={`inline-flex items-center gap-1.5 font-medium ${t.tone}`}><t.Icon size={14} weight="bold" />{t.label}</span>
          <span className="text-muted">{c.technology.category}</span>
          <span className="inline-flex items-center gap-1 text-faint"><GithubLogo size={13} />{timeAgo(c.detected_at)}</span>
        </div>
        <h3 className="text-[15px] font-medium leading-snug tracking-tight">
          <Link href={`/t/${c.technology.slug}`} className="hover:underline underline-offset-4 decoration-border-strong">{c.title}</Link>
        </h3>
        {plain(c.description) && <p className="line-clamp-2 max-w-[65ch] text-[13px] text-muted">{plain(c.description)}</p>}
        {c.used_in.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 rounded-lg border border-accent/35 bg-accent/10 px-2.5 py-1.5 text-xs">
            <Stack size={14} className="text-accent" weight="bold" />
            <span className="text-accent">In your stack</span>
            {c.used_in.map((u) => (
              <Link key={u.architecture_id + u.node_id} href={`/playground/${u.architecture_id}?investigate=${encodeURIComponent(u.node_id)}`} className="underline underline-offset-2 hover:text-fg">{u.title}</Link>
            ))}
            <span className="basis-full text-muted">{warn ? "Open the design to investigate alternatives with the assistant. Nothing changes automatically." : "Open the design to review whether this affects it."}</span>
          </div>
        )}
        <details className="group text-xs text-muted">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 hover:text-fg [&::-webkit-details-marker]:hidden">Why am I seeing this?</summary>
          <ul className="mt-1.5 space-y-0.5 border-l border-border-strong pl-3">{c.reasons.map((r) => <li key={r} className="num">{r}</li>)}</ul>
        </details>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start">
        <dl className="num flex gap-4 text-xs sm:flex-col sm:items-end sm:gap-1">
          <div className="flex items-baseline gap-1.5"><dt className="text-faint">stars</dt><dd className="text-[13px]">{compact(c.metrics.stars)}</dd></div>
          <div className="flex items-baseline gap-1.5"><dt className="text-faint">7d</dt><dd className={g == null ? "text-faint" : "text-good"}>{g == null ? "no history" : `+${compact(g)}`}</dd></div>
        </dl>
        <div className="flex gap-2">
          <Link href={`/t/${c.technology.slug}`} className="btn btn-sm">Explore</Link>
          {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-icon" aria-label={`Open source for ${c.title}`}><ArrowUpRight size={14} /></a>}
        </div>
      </div>
    </article>
  );
}
