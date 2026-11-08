"use client";
import { ArrowRight, BellSimple, BookmarkSimple, GitFork, LockSimple, Scales, Star } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { LIBRARY_CAPTIONS, LIBRARY_FINAL, LIBRARY_STAGES } from "@/lib/library-preview-script";
import { useStageLoop } from "@/lib/use-stage-loop";
import { useApi } from "@/lib/use-api";
import type { Category, FeedCardT, TechSummary } from "@/lib/types";
import { compact, plain } from "@/lib/utils";
import { TechLogo } from "./logo";
import { StepList } from "./preview/step-list";
import { Skeleton } from "./ui";

const PICK = ["react", "qdrant", "fastapi", "ollama"];

function Saved({ t }: { t: TechSummary }) {
  return (
    <div className="rise flex flex-col gap-2 rounded-xl border hairline bg-surface p-3">
      <div className="flex items-center gap-2.5">
        <TechLogo name={t.name} repoUrl={t.repository_url} size={28} />
        <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium leading-tight">{t.name}</div><div className="text-[11px] text-muted">{t.category}</div></div>
        <BookmarkSimple size={15} weight="fill" className="shrink-0 text-accent" />
      </div>
      <div className="num flex flex-wrap gap-x-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><Star size={11} weight="fill" className="text-faint" />{compact(t.stars)}</span>
        <span className="inline-flex items-center gap-1"><GitFork size={11} className="text-faint" />{compact(t.forks)}</span>
        <span className="inline-flex items-center gap-1"><Scales size={11} className="text-faint" />{t.license ?? "unknown"}</span>
      </div>
    </div>
  );
}

const Section = ({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) => (
  <section><div className="mb-2 flex items-baseline gap-2"><h3 className="text-[13px] font-medium">{title}</h3>{count !== undefined && <span className="num text-xs text-faint">{count}</span>}</div>{children}</section>
);
const Empty = ({ children }: { children: React.ReactNode }) => <div className="rounded-xl border border-dashed border-border-strong px-3 py-2.5 text-xs text-faint">{children}</div>;

/** Looping, non-interactive demo of the real Library for visitors who are not signed in. Uses real catalogue data. */
export function LibraryPreview() {
  const reduce = useReducedMotion();
  const { stage } = useStageLoop(LIBRARY_STAGES, LIBRARY_FINAL, reduce);
  const techs = useApi<TechSummary[]>("/technologies?limit=40");
  const cats = useApi<Category[]>("/categories");
  const feed = useApi<FeedCardT[]>("/feed?limit=1&window=30d&sort=recency&event_type=releases");
  const byPick = PICK.map((s) => techs.data?.find((t) => t.slug === s)).filter(Boolean) as TechSummary[];
  const pool = byPick.length >= 3 ? byPick : (techs.data ?? []).slice(0, 4);
  const [s1, s2, f1] = pool;
  const chips = (cats.data ?? []).slice(0, 4).map((c) => c.name);
  const item = feed.data?.[0];

  return (
    <section aria-label="Library preview" className="grid items-center gap-10 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-10">
      <div>
        <h1 className="display text-[2.2rem] sm:text-5xl lg:text-[2.7rem]">Keep the tools that matter in one place.</h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">Save tools, follow what you depend on, and get a feed ranked around your stack.</p>
        <StepList captions={LIBRARY_CAPTIONS} active={stage.caption} />
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary h-10 px-5 text-sm">Sign in to start <ArrowRight size={15} weight="bold" /></Link>
          <Link href="/explore" className="btn h-10 px-5 text-sm">Explore tools</Link>
        </div>
        <p className="mt-3 text-xs text-faint">Free to use. Your library is private to you.</p>
      </div>
      <div role="img" aria-label="Animated preview of the Library: tools are saved and followed, interests are chosen, and the feed explains why each update is ranked"
        className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)]">
        <div className="flex h-11 items-center justify-between gap-3 border-b hairline px-4">
          <div className="flex items-center gap-2.5"><span className="text-[13px] font-medium">My Library</span><span className="tag">preview</span></div>
          <span className="tag gap-1"><LockSimple size={11} />Private to you</span>
        </div>
        <div className="pointer-events-none h-[430px] space-y-4 overflow-hidden p-4 sm:h-[450px]" aria-hidden>
          {!techs.data ? <Skeleton n={3} h={96} /> : (<>
            <Section title="Saved" count={stage.saved}>
              <div className="grid grid-cols-2 gap-2.5">
                {stage.saved > 0 && s1 ? <Saved key={s1.slug} t={s1} /> : <Empty>Nothing saved yet</Empty>}
                {stage.saved > 1 && s2 ? <Saved key={s2.slug} t={s2} /> : stage.saved > 0 ? <div /> : null}
              </div>
            </Section>
            <Section title="Following" count={stage.following}>
              {stage.following > 0 && f1 ? (
                <div key={f1.slug} className="rise flex items-center gap-2.5 rounded-xl border hairline bg-surface px-3 py-2">
                  <TechLogo name={f1.name} repoUrl={f1.repository_url} size={26} />
                  <div className="min-w-0 flex-1 truncate text-[13px] font-medium">{f1.name}</div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-accent"><BellSimple size={13} weight="fill" />Following</span>
                </div>
              ) : <Empty>Not following anything yet</Empty>}
            </Section>
            <Section title="Your interests">
              <div className="flex flex-wrap gap-1.5">{chips.map((c, i) => <span key={c} className="chip" aria-pressed={i < stage.interests}>{c}</span>)}</div>
            </Section>
            {stage.feed && item && (
              <div key="feed" className="rise rounded-xl border border-accent/35 bg-accent/10 p-3">
                <div className="flex items-center gap-2.5">
                  <TechLogo name={item.technology.name} repoUrl={item.technology.repository_url} size={26} />
                  <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium leading-tight">{item.title}</div>
                    <div className="line-clamp-1 text-[11px] text-muted">{plain(item.description)}</div></div>
                </div>
                <ul className="num mt-2 space-y-0.5 border-l border-accent/50 pl-2.5 text-[11px] text-muted">
                  {[...item.reasons.slice(0, 1), "you follow this technology +50", "matches your interests +20", ...item.reasons.slice(1)].map((r) => (
                    <li key={r} className={r.startsWith("you follow") || r.startsWith("matches") ? "text-accent" : ""}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </>)}
        </div>
      </div>
    </section>
  );
}
