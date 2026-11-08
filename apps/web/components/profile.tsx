"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "@/lib/use-api";
import type { Signal, TechProfile } from "@/lib/types";
import { compact, timeAgo } from "@/lib/utils";
import { AddToArchitecture } from "./add-to-architecture";
import { TechActions } from "./actions";
import { Badge, Card, ErrorNote, FreshnessBadge, Skeleton } from "./ui";

const LABEL: Record<string, string> = {
  stars_gained_1d: "Stars gained (1d)", stars_gained_7d: "Stars gained (7d)", stars_gained_30d: "Stars gained (30d)",
  stars_growth_30d_pct: "Star growth (30d, %)", star_acceleration_7d: "Acceleration (7d vs prior 7d)",
  days_since_last_push: "Days since last push", days_since_last_release: "Days since last release",
  open_issues: "Open issues", contributors: "Contributors", verified_integrations: "Verified integrations",
  related_technologies: "Related technologies", license: "License", documentation_url: "Documentation link",
  has_published_release: "Published release", archived: "Archived",
};
const BLURB: Record<string, string> = {
  momentum: "How fast attention is growing. Needs snapshot history.",
  maintenance: "Whether the project is actively looked after.",
  ecosystem: "Verified integrations and relationships. Empty until evidence is recorded.",
  readiness: "Basics for adopting it: license, docs, releases.",
};

function Dimension({ name, signals }: { name: string; signals: Signal[] }) {
  return (
    <Card>
      <h3 className="font-medium capitalize">{name}</h3>
      <p className="mb-2 text-xs text-muted">{BLURB[name]}</p>
      <dl className="space-y-1 text-sm">
        {signals.map((s) => (
          <div key={s.name} className="flex justify-between gap-3">
            <dt className="text-muted">{LABEL[s.name] ?? s.name}</dt>
            <dd className={s.value == null ? "text-muted italic" : ""} title={s.note ?? undefined}>
              {s.value == null ? s.note ?? "no data" : typeof s.value === "boolean" ? (s.value ? "yes" : "no") : String(s.value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function Profile({ slug }: { slug: string }) {
  const { data: t, error, loading } = useApi<TechProfile>(`/technologies/${slug}`);
  if (error) return <ErrorNote msg={error} />;
  if (loading || !t) return <Skeleton />;
  const pts = t.history.filter((h) => h.stars != null).map((h) => ({ d: new Date(h.recorded_at).toLocaleDateString(), stars: h.stars }));
  const spanDays = pts.length < 2 ? 0 : (new Date(t.history.at(-1)!.recorded_at).getTime() - new Date(t.history[0].recorded_at).getTime()) / 86400000;
  const unit = t.source_platform === "huggingface" ? "likes" : "stars";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t.name}</h1>
            <Badge>{t.category}</Badge><FreshnessBadge f={t.freshness} />
          </div>
          <p className="max-w-2xl text-sm text-muted">{t.description ?? "No description recorded."}</p>
          <div className="flex flex-wrap gap-3 pt-1 text-sm">
            {t.official_url && <a className="text-accent hover:underline" href={t.official_url} target="_blank" rel="noreferrer">Website ↗</a>}
            {t.documentation_url && <a className="text-accent hover:underline" href={t.documentation_url} target="_blank" rel="noreferrer">Docs ↗</a>}
            {t.repository_url && <a className="text-accent hover:underline" href={t.repository_url} target="_blank" rel="noreferrer">Repository ↗</a>}
          </div>
        </div>
        <div className="space-y-2">
          <TechActions slug={t.slug} />
          <AddToArchitecture slug={t.slug} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[unit, compact(t.stars)], ["forks", compact(t.forks)], ["license", t.license ?? "unknown"],
          ["latest release", t.latest_release ? `${t.latest_release.version} · ${timeAgo(t.latest_release.published_at)}` : "none recorded"]].map(([k, v]) => (
          <Card key={k}><div className="text-xs text-muted">{k}</div><div className="mt-1 truncate font-medium">{v}</div></Card>
        ))}
      </div>

      <section aria-labelledby="hist">
        <h2 id="hist" className="mb-2 font-medium">{unit[0].toUpperCase() + unit.slice(1)} history</h2>
        <Card>
          {spanDays < 1 ? (
            <p className="py-8 text-center text-sm text-muted">History covers less than a day so far. A trend line appears once DEVOHOLICS has collected snapshots on different days.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pts}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="d" stroke="var(--muted)" fontSize={12} />
                  <YAxis stroke="var(--muted)" fontSize={12} domain={["dataMin", "dataMax"]} tickFormatter={compact} width={48} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="stars" stroke="var(--accent)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="dims">
        <h2 id="dims" className="mb-1 font-medium">Intelligence signals</h2>
        <p className="mb-3 text-xs text-muted">Four independent dimensions. There is deliberately no single score; missing data is shown as missing. Popularity is not the same as maintenance or production adoption.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(["momentum", "maintenance", "ecosystem", "readiness"] as const).map((k) => <Dimension key={k} name={k} signals={t.dimensions[k]} />)}
        </div>
      </section>

      {t.packages.length > 0 && (
        <section aria-labelledby="pk">
          <h2 id="pk" className="mb-2 font-medium">Packages</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.packages.map((p) => (
              <Card key={p.registry + p.name} className="text-sm">
                <div className="flex justify-between"><a href={p.url ?? "#"} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">{p.name}</a><Badge>{p.registry}</Badge></div>
                <div className="mt-1 text-muted">v{p.version ?? "?"} · {p.dependencies ?? "?"} deps · {p.weekly_downloads == null ? "downloads n/a" : `${compact(p.weekly_downloads)}/week`}</div>
              </Card>
            ))}
          </div>
        </section>
      )}
      <p className="text-xs text-muted">Data from {t.source_platform ?? "n/a"}{t.freshness.last_synced_at ? `, last synced ${timeAgo(t.freshness.last_synced_at)}` : ""}.</p>
    </div>
  );
}
