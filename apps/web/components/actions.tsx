"use client";
import Link from "next/link";
import { BookmarkSimple, Bell } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Library } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Bookmark + follow toggles. Anonymous visitors are sent to sign in rather than silently failing. */
export function TechActions({ slug }: { slug: string }) {
  const { token, ready } = useAuth();
  const [state, setState] = useState({ bookmarked: false, following: false });
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!token) return;
    api<Library>("/me/library", { token }).then((l) =>
      setState({ bookmarked: l.bookmarks.some((t) => t.slug === slug), following: l.follows.some((t) => t.slug === slug) }),
      () => {});
  }, [token, slug]);

  if (ready && !token)
    return <Link href="/login" className="btn w-full">Sign in to save or follow</Link>;

  const toggle = async (kind: "bookmarks" | "follows", key: "bookmarked" | "following") => {
    const on = !state[key];
    setState((s) => ({ ...s, [key]: on })); setErr("");
    try { await api(`/me/${kind}/${slug}`, { method: on ? "PUT" : "DELETE", token }); }
    catch (e) { setState((s) => ({ ...s, [key]: !on })); setErr((e as Error).message); }
  };
  const btn = (on: boolean) => cn("btn flex-1", on && "!border-accent !bg-accent/15 !text-accent");
  return (
    <div className="flex items-center gap-2">
      <button className={btn(state.bookmarked)} aria-pressed={state.bookmarked} onClick={() => toggle("bookmarks", "bookmarked")}>
        <BookmarkSimple size={14} weight={state.bookmarked ? "fill" : "regular"} />{state.bookmarked ? "Saved" : "Save"}
      </button>
      <button className={btn(state.following)} aria-pressed={state.following} onClick={() => toggle("follows", "following")}>
        <Bell size={14} weight={state.following ? "fill" : "regular"} />{state.following ? "Following" : "Follow"}
      </button>
      {err && <span role="alert" className="text-xs text-bad">{err}</span>}
    </div>
  );
}
