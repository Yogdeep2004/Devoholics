"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import type { Category, Library as Lib, Me } from "@/lib/types";
import { TechCard } from "./explore";
import { ErrorNote, Skeleton } from "./ui";

function Interests({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const { token } = useAuth();
  const cats = useApi<Category[]>("/categories");
  const [sel, setSel] = useState<string[]>(me.interests);
  const [saved, setSaved] = useState(false);
  const toggle = (s: string) => { setSaved(false); setSel((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s])); };
  const save = async () => { await api("/me/interests", { method: "PUT", body: { categories: sel }, token }); setSaved(true); onSaved(); };
  return (
    <section aria-labelledby="int" className="space-y-2">
      <h2 id="int" className="display text-xl">Your interests</h2>
      <p className="text-xs text-muted">Matching categories get a boost in your feed.</p>
      <div className="flex flex-wrap gap-2">
        {(cats.data ?? []).map((c) => (
          <button key={c.slug} aria-pressed={sel.includes(c.slug)} onClick={() => toggle(c.slug)}
            className="chip">{c.name}</button>
        ))}
      </div>
      <button onClick={save} className="btn btn-primary btn-sm">Save interests</button>
      {saved && <span role="status" className="ml-2 text-sm text-good">Saved</span>}
    </section>
  );
}

const List = ({ title, items, empty }: { title: string; items: Lib["bookmarks"]; empty: string }) => (
  <section className="space-y-2">
    <h2 className="display text-xl">{title} <span className="num text-sm font-normal text-muted">{items.length}</span></h2>
    {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> :
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((t) => <TechCard key={t.slug} t={t} />)}</div>}
  </section>
);

export function Library() {
  const { token, ready } = useAuth();
  const [rev, setRev] = useState(0);
  const me = useApi<Me>(token ? "/me" : null, true);
  const lib = useApi<Lib>(token ? `/me/library?r=${rev}` : null, true);
  if (!ready) return <Skeleton />;
  if (!token) return (
    <div className="py-16 text-center">
      <p className="text-muted">Sign in to keep a personal library of saved and followed technologies.</p>
      <Link href="/login" className="btn btn-primary mt-4 h-10 px-5 text-sm">Sign in</Link>
    </div>
  );
  if (me.error || lib.error) return <ErrorNote msg={me.error ?? lib.error!} />;
  if (!me.data || !lib.data) return <Skeleton />;
  return (
    <div className="space-y-8">
      <h1 className="display text-3xl">Library</h1>
      <List title="Saved" items={lib.data.bookmarks} empty="Nothing saved yet. Use Save on any technology page." />
      <List title="Following" items={lib.data.follows} empty="You aren't following anything yet. Followed technologies rank higher in your feed." />
      <Interests me={me.data} onSaved={() => setRev((r) => r + 1)} />
      <p className="text-sm text-muted">Architecture collections arrive with the Playground in Phase 3.</p>
    </div>
  );
}
