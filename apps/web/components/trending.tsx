"use client";
import { ArrowRight, ArrowUpRight, Cube, GithubLogo, Lightning, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/use-api";
import type { EmergingTool, UseCases } from "@/lib/types";
import { compact, plain } from "@/lib/utils";
import { TechLogo } from "./logo";
import { Empty, ErrorNote } from "./ui";

const WINDOWS = [30, 60, 90];
/** Real stars usually come with forks. A very low fork ratio is shown as a neutral caution, not as an accusation. */
const lowForks = (t: EmergingTool) => (t.forks ?? 0) / Math.max(1, t.stars) < 0.03;
const FORK_NOTE = "Few forks for its star count. Stars can be inflated, so check commit activity and issues before relying on it.";

/** The "what could I use this for" panel. Always labelled as an AI summary, with the grounding stated. */
export function UseForPanel({ uc, topics = [], size = "lg" }: { uc: UseCases | null | undefined; topics?: string[]; size?: "lg" | "md" }) {
  if (!uc || (!uc.headline && uc.applications.length === 0)) {
    return topics.length ? (
      <div className="flex flex-wrap gap-1.5">{topics.map((t) => <span key={t} className="tag">{t}</span>)}</div>
    ) : null;
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/35 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_13%,transparent),transparent_70%)] p-4 sm:p-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-accent"><span className="grid size-6 place-items-center rounded-md bg-accent/15"><Lightning size={14} weight="fill" /></span>What you could use it for</span>
        {uc.ai_generated && <span className="tag gap-1" title="Written by AI from the repository description and topics. Check the docs before relying on it."><Sparkle size={11} weight="fill" />AI summary</span>}
      </div>
      <p className={size === "lg" ? "display text-[1.35rem] leading-snug sm:text-2xl" : "text-[15px] font-medium leading-snug tracking-tight"}>{uc.headline}</p>
      {uc.applications.length > 0 && (
        <ul className="mt-3.5 space-y-2">
          {uc.applications.map((a) => (
            <li key={a} className="flex items-start gap-2.5 text-[14px] leading-snug">
              <ArrowRight size={14} weight="bold" className="mt-[3px] shrink-0 text-accent" /><span className="capitalize-first">{a}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Featured({ t }: { t: EmergingTool }) {
  return (
    <article className="rise flex flex-col gap-5 rounded-xl border hairline bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <TechLogo name={t.name} repoUrl={t.repository_url} size={48} />
          <div className="min-w-0">
            <h3 className="display truncate text-2xl"><Link href={`/t/${t.slug}`} className="hover:underline underline-offset-4 decoration-border-strong">{t.name}</Link></h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"><span>{t.category}</span><span className="num">launched {t.age_days}d ago</span><span className="num">{compact(t.stars)} stars</span>
              {lowForks(t) && <span className="tag text-warn" title={FORK_NOTE}>low fork ratio</span>}</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-2xl font-medium leading-none tracking-tight text-accent">{compact(Math.round(t.stars_per_day))}</div>
          <div className="mt-1 text-[11px] leading-tight text-muted">stars / day<br />avg since launch</div>
        </div>
      </div>
      <UseForPanel uc={t.use_cases} topics={t.topics} />
      {!t.use_cases && plain(t.description) && <p className="text-[14px] text-muted">{plain(t.description)}</p>}
      <div className="mt-auto flex flex-wrap gap-2">
        <Link href={`/t/${t.slug}`} className="btn btn-primary">Explore {t.name}</Link>
        <a href={t.repository_url} target="_blank" rel="noreferrer" className="btn"><GithubLogo size={14} />Repository<ArrowUpRight size={12} /></a>
      </div>
    </article>
  );
}

function Row({ t, rank }: { t: EmergingTool; rank: number }) {
  return (
    <Link href={`/t/${t.slug}`} className="row-hover group grid grid-cols-[1.5rem_auto_1fr_auto] items-start gap-x-3 px-4 py-3.5 transition-colors duration-150">
      <span className="num pt-1 text-xs text-faint">{rank}</span>
      <TechLogo name={t.name} repoUrl={t.repository_url} size={32} />
      <div className="min-w-0">
        <div className="flex items-center gap-2"><h3 className="truncate text-sm font-medium tracking-tight">{t.name}</h3><span className="num shrink-0 text-xs text-faint">{t.age_days}d old</span>
          {lowForks(t) && <span className="tag shrink-0 text-warn" title={FORK_NOTE}>low fork ratio</span>}</div>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{t.use_cases?.headline ?? (plain(t.description) || "No description recorded.")}</p>
      </div>
      <div className="pl-2 text-right"><div className="num text-sm font-medium text-accent">{compact(Math.round(t.stars_per_day))}</div><div className="text-[11px] text-faint">stars/day</div></div>
    </Link>
  );
}

export function Trending() {
  const [days, setDays] = useState(60);
  const { data, error, loading } = useApi<{ items: EmergingTool[]; note: string }>(`/trending/emerging?days=${days}&limit=6`);
  const all = data?.items ?? [];
  // Feature the fastest-rising tool whose stars look healthy; flagged tools keep their place in the ranked list.
  const lead = all.findIndex((t) => !lowForks(t));
  const items = lead > 0 ? [all[lead], ...all.filter((_, i) => i !== lead)] : all;
  return (
    <section aria-labelledby="trending" className="mb-14 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="trending" className="display text-2xl">Trending tools</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">New repositories gaining stars fastest, each with what you could use it for.</p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Launched within">
          <span className="text-xs text-faint">Launched in the last</span>
          {WINDOWS.map((w) => <button key={w} aria-pressed={days === w} onClick={() => setDays(w)} className="chip"><span className="num">{w}d</span></button>)}
        </div>
      </div>
      {error ? <ErrorNote msg={error} /> : loading ? (
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]"><div className="skeleton" style={{ height: 380 }} /><div className="skeleton" style={{ height: 380 }} /></div>
      ) : items.length === 0 ? (
        <Empty title="No new tools in this window" hint="Discovery runs daily. Try a longer window." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <Featured key={items[0].slug} t={items[0]} />
          <div className="divide-y divide-border overflow-hidden rounded-xl border hairline bg-surface">
            {items.slice(1).map((t, i) => <Row key={t.slug} t={t} rank={i + 2} />)}
            {items.length < 2 && <div className="flex items-center gap-2 p-4 text-sm text-muted"><Cube size={16} />More appear as discovery finds them.</div>}
          </div>
        </div>
      )}
      <p className="text-xs text-faint">Stars per day is an average since the repository was created, not a measure of quality. Summaries are AI-written from the repository description and topics.</p>
    </section>
  );
}
