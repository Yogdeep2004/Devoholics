"use client";
import { ArrowRight, GitFork } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { BlueprintDetail, Category } from "@/lib/types";
import { Stat } from "./ui";

const Diagram = dynamic(() => import("./playground/diagram").then((m) => m.Diagram), { ssr: false, loading: () => <div className="skeleton h-full !rounded-none" /> });

export function Hero() {
  const { token, ready } = useAuth();
  const bp = useApi<BlueprintDetail>("/blueprints/rag-application");
  if (ready && token) return null; // signed-in users go straight to their feed
  return (
    <section className="relative isolate -mt-8 mb-14 overflow-hidden pb-2 pt-12 lg:pt-20" aria-label="Introduction">
      <div aria-hidden className="hero-art pointer-events-none absolute -inset-x-16 inset-y-0 -z-10 bg-cover bg-[position:60%_55%] opacity-70 max-lg:hidden"
        style={{ backgroundImage: "url(/art/signal-field.png)" }} />
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <div>
          <h1 className="display rise text-[2.6rem] sm:text-6xl lg:text-[3.3rem]" style={{ ["--i" as string]: 0 }}>See what&apos;s shipping before it trends.</h1>
          <p className="rise mt-5 max-w-md text-[15px] leading-relaxed text-muted" style={{ ["--i" as string]: 2 }}>
            Live momentum and maintenance data for developer tools, plus a canvas to design your stack.
          </p>
          <div className="rise mt-7 flex flex-wrap gap-3" style={{ ["--i" as string]: 4 }}>
            <Link href="/explore" className="btn btn-primary h-10 px-5 text-sm">Explore tools <ArrowRight size={15} weight="bold" /></Link>
            <Link href="/playground" className="btn h-10 px-5 text-sm">Open Playground</Link>
          </div>
        </div>
        <div className="rise overflow-hidden rounded-xl border border-border-strong bg-surface/90 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)] backdrop-blur" style={{ ["--i" as string]: 3 }}>
          <div className="flex h-11 items-center justify-between gap-3 border-b hairline px-4">
            <div className="flex min-w-0 items-center gap-2.5"><span className="truncate text-[13px] font-medium">{bp.data?.title ?? "RAG Application"}</span><span className="tag">curated blueprint</span></div>
            <Link href="/blueprints/rag-application" className="btn btn-sm"><GitFork size={14} />Fork</Link>
          </div>
          <div className="h-[300px] surface-grid sm:h-[330px]">
            {bp.data ? <Diagram graph={bp.data.graph} report={bp.data.validation} height={330} bare layered /> : <div className="skeleton h-full !rounded-none" />}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Stats() {
  const cats = useApi<Category[]>("/categories");
  const bps = useApi<unknown[]>("/blueprints");
  const total = cats.data?.reduce((a, c) => a + c.technology_count, 0);
  return (
    <div className="mb-12 grid grid-cols-2 gap-y-6 border-y hairline py-6 sm:grid-cols-4 sm:divide-x sm:divide-border">
      <div className="sm:pr-6"><Stat label="Technologies tracked" value={total ?? "n/a"} /></div>
      <div className="sm:px-6"><Stat label="Categories" value={cats.data?.length ?? "n/a"} /></div>
      <div className="sm:px-6"><Stat label="Curated blueprints" value={bps.data?.length ?? "n/a"} /></div>
      <div className="sm:pl-6"><Stat label="Data sources" value="5" hint="GitHub, npm, PyPI, Hugging Face, MCP" /></div>
    </div>
  );
}
