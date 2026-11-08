"use client";
import { ArrowUpRight, BookOpenText, CheckCircle, GithubLogo, Globe, Graph, TrendUp, Wrench } from "@phosphor-icons/react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "@/lib/use-api";
import type { Signal, TechProfile } from "@/lib/types";
import { compact, plain, timeAgo } from "@/lib/utils";
import { TechActions } from "./actions";
import { AddToArchitecture } from "./add-to-architecture";
import { TechLogo } from "./logo";
import { ErrorNote, FreshnessBadge, Skeleton, Stat } from "./ui";

const LABEL: Record<string, string> = {
  stars_gained_1d: "Stars gained, 1d", stars_gained_7d: "Stars gained, 7d", stars_gained_30d: "Stars gained, 30d",
  stars_growth_30d_pct: "Star growth, 30d (%)", star_acceleration_7d: "Acceleration, 7d vs prior 7d",
  days_since_last_push: "Days since last push", days_since_last_release: "Days since last release",
  open_issues: "Open issues", contributors: "Contributors", verified_integrations: "Verified integrations",
  related_technologies: "Related technologies", license: "License", documentation_url: "Documentation link",
  has_published_release: "Published release", archived: "Archived",
};
const DIM = {
  momentum: { Icon: TrendUp, blurb: "How fast attention is growing. Needs snapshot history." },
  maintenance: { Icon: Wrench, blurb: "Whether the project is actively looked after." },
  ecosystem: { Icon: Graph, blurb: "Verified integrations and relationships. Empty until evidence is recorded." },
  readiness: { Icon: CheckCircle, blurb: "Basics for adopting it: license, docs, releases." },
} as const;

function Dimension({ name, signals }: { name: keyof typeof DIM; signals: Signal[] }) {
  const { Icon, blurb } = DIM[name];
  return (
    <section className="rounded-xl border hairline bg-surface">
      <header className="flex items-start gap-3 border-b hairline p-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface3 text-accent"><Icon size={17} weight="bold" /></span>
        <div><h3 className="font-medium capitalize leading-tight">{name}</h3><p className="mt-0.5 text-xs text-muted">{blurb}</p></div>
      </header>
      <dl className="divide-y divide-border">
        {signals.map((s) => (
          <div key={s.name} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-[13px]">
            <dt className="text-muted">{LABEL[s.name] ?? s.name}</dt>
            <dd className={s.value == null ? "text-xs italic text-faint" : "num font-medium"} title={s.note ?? undefined}>
              {s.value == null ? s.note ?? "no data" : typeof s.value === "boolean" ? (s.value ? "yes" : "no") : String(s.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Profile({ slug }: { slug: string }) {
  const { data: t, error, loading } = useApi<TechProfile>(`/technologies/${slug}`);
  if (error) return <ErrorNote msg={error} />;
  if (loading || !t) return <Skeleton n={3} h={140} />;
  const pts = t.history.filter((h) => h.stars != null).map((h) => ({ d: new Date(h.recorded_at).toLocaleDateString("en", { month: "short", day: "numeric" }), stars: h.stars }));
  const spanDays = pts.length < 2 ? 0 : (new Date(t.history.at(-1)!.recorded_at).getTime() - new Date(t.history[0].recorded_at).getTime()) / 86400000;
  const unit = t.source_platform === "huggingface" ? "likes" : "stars";
  const link = "btn btn-sm";
  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 gap-4">
          <TechLogo name={t.name} repoUrl={t.repository_url} size={56} />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="display text-3xl sm:text-4xl">{t.name}</h1>
              <span className="tag">{t.category}</span><FreshnessBadge f={t.freshness} />
            </div>
            <p className="max-w-2xl text-[15px] text-muted">{plain(t.description) || "No description recorded."}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {t.official_url && <a className={link} href={t.official_url} target="_blank" rel="noreferrer"><Globe size={14} />Website</a>}
              {t.documentation_url && <a className={link} href={t.documentation_url} target="_blank" rel="noreferrer"><BookOpenText size={14} />Docs</a>}
              {t.repository_url && <a className={link} href={t.repository_url} target="_blank" rel="noreferrer"><GithubLogo size={14} />Repository<ArrowUpRight size={12} /></a>}
            </div>
          </div>
        </div>
        <div className="w-full space-y-2 sm:w-56"><TechActions slug={t.slug} /><AddToArchitecture slug={t.slug} /></div>
      </header>

      <div className="grid grid-cols-2 gap-y-6 border-y hairline py-6 sm:grid-cols-4 sm:divide-x sm:divide-border">
        <div className="sm:pr-6"><Stat label={unit} value={compact(t.stars)} /></div>
        <div className="sm:px-6"><Stat label="forks" value={compact(t.forks)} /></div>
        <div className="sm:px-6"><Stat label="license" value={t.license ?? "unknown"} /></div>
        <div className="sm:pl-6"><Stat label="latest release" value={t.latest_release ? t.latest_release.version : "none"} hint={t.latest_release ? timeAgo(t.latest_release.published_at) : "no release recorded"} /></div>
      </div>

      <section aria-labelledby="hist">
        <h2 id="hist" className="display mb-3 text-xl">{unit[0].toUpperCase() + unit.slice(1)} history</h2>
        <div className="rounded-xl border hairline bg-surface p-4">
          {spanDays < 1 ? (
            <p className="py-10 text-center text-sm text-muted">History covers less than a day so far. A trend line appears once DEVOHOLICS has collected snapshots on different days.</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pts} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="d" stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} minTickGap={36} />
                  <YAxis stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} domain={["dataMin", "dataMax"]} tickFormatter={compact} width={44} />
                  <Tooltip cursor={{ stroke: "var(--border-strong)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--muted)" }} />
                  <Area type="monotone" dataKey="stars" stroke="var(--accent)" strokeWidth={1.8} fill="url(#g)" dot={false} activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--bg)", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="dims">
        <h2 id="dims" className="display text-xl">Intelligence signals</h2>
        <p className="mb-4 mt-1 max-w-2xl text-sm text-muted">Four independent dimensions. There is deliberately no single score, and missing data is shown as missing. Popularity is not the same as maintenance or production adoption.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {(["momentum", "maintenance", "ecosystem", "readiness"] as const).map((k) => <Dimension key={k} name={k} signals={t.dimensions[k]} />)}
        </div>
      </section>

      {t.packages.length > 0 && (
        <section aria-labelledby="pk">
          <h2 id="pk" className="display mb-3 text-xl">Packages</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.packages.map((p) => (
              <a key={p.registry + p.name} href={p.url ?? "#"} target="_blank" rel="noreferrer" className="lift flex items-center justify-between gap-3 rounded-xl border hairline bg-surface p-4">
                <div className="min-w-0"><div className="num truncate text-sm font-medium">{p.name}</div>
                  <div className="num mt-1 text-xs text-muted">v{p.version ?? "?"}, {p.dependencies ?? "?"} deps, {p.weekly_downloads == null ? "downloads n/a" : `${compact(p.weekly_downloads)}/week`}</div></div>
                <span className="tag">{p.registry}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <p className="text-xs text-faint">Data from {t.source_platform ?? "n/a"}{t.freshness.last_synced_at ? `, last synced ${timeAgo(t.freshness.last_synced_at)}` : ""}.</p>
    </div>
  );
}
