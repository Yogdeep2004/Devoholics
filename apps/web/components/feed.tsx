"use client";
import { Clock, Fire, Rows, Sparkle, Stack, Tag, TrendUp, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { FeedCardT } from "@/lib/types";
import { FeedCard } from "./feed-card";
import { Empty, ErrorNote } from "./ui";

const TYPES = [["", "All updates", Rows], ["new_tools", "New tools", Sparkle], ["releases", "New releases", Tag], ["warnings", "Maintenance", Warning]] as const;
const WINDOWS = ["24h", "7d", "30d", "90d"];
const SORTS = [["relevance", "Relevance", Fire], ["recency", "Recency", Clock], ["growth", "Growth", TrendUp]] as const;

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 lg:block lg:space-y-1" role="group" aria-label={label}>
      <div className="hidden px-2.5 pb-1 text-xs text-faint lg:block">{label}</div>
      {children}
    </div>
  );
}

const Item = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button aria-pressed={on} onClick={onClick} className="rail-item">{children}</button>
);

export function Feed({ onData }: { onData?: (n: number) => void }) {
  const [type, setType] = useState("");
  const [window, setWindow] = useState("30d");
  const [sort, setSort] = useState("relevance");
  const [mine, setMine] = useState(false);
  const { token } = useAuth();
  const qs = new URLSearchParams({ window, sort, limit: "60", ...(type && { event_type: type }), ...(mine && token && { scope: "mine" }) });
  const { data, error, loading } = useApi<FeedCardT[]>(`/feed?${qs}`);
  void onData;
  return (
    <div className="grid gap-6 lg:grid-cols-[210px_1fr] lg:gap-10">
      <aside aria-label="Feed filters" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className="-mx-4 flex gap-6 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-6 lg:overflow-visible lg:px-0 lg:pb-0">
          <Group label="Type">{TYPES.map(([v, l, Icon]) => <Item key={v} on={type === v} onClick={() => setType(v)}><Icon size={15} />{l}</Item>)}</Group>
          <Group label="Time">{WINDOWS.map((w) => <Item key={w} on={window === w} onClick={() => setWindow(w)}><span className="num">{w}</span></Item>)}</Group>
          <Group label="Sort">{SORTS.map(([v, l, Icon]) => <Item key={v} on={sort === v} onClick={() => setSort(v)}><Icon size={15} />{l}</Item>)}</Group>
          {token && <Group label="Scope"><Item on={mine} onClick={() => setMine((m) => !m)}><Stack size={15} />My stack</Item></Group>}
        </div>
      </aside>
      <div className="min-w-0">
        {error ? <ErrorNote msg={error} /> : loading ? (
          <div className="divide-y divide-border overflow-hidden rounded-xl border hairline">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton !rounded-none" style={{ height: 112 }} />)}</div>
        ) : data!.length === 0 ? (
          <Empty title={mine ? "Nothing new for your stack" : "No updates in this window"} hint={mine ? "Follow technologies or save architectures to see their releases and maintenance signals here." : "Try a longer time range."} />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border hairline bg-surface">
            {data!.map((c, i) => <FeedCard key={c.id} c={c} i={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
