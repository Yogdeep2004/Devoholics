"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const LINKS: { href: string; label: string; soon?: boolean }[] = [
  { href: "/", label: "Feed" },
  { href: "/explore", label: "Explore" },
  { href: "/playground", label: "Playground" },
  { href: "/blueprints", label: "Blueprints" },
  { href: "/library", label: "My Library" },
];

export function Nav() {
  const path = usePathname();
  const { session, ready } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight">DEVOHOLICS</Link>
        <nav aria-label="Primary" className="flex flex-1 gap-1 overflow-x-auto">
          {LINKS.map((l) =>
            l.soon ? (
              <span key={l.href} title="Coming in Phase 3" className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-muted/60">
                {l.label}
              </span>
            ) : (
              <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}
                className={cn("rounded-md px-3 py-1.5 text-sm text-muted hover:text-fg",
                  (l.href === "/" ? path === "/" : path.startsWith(l.href)) && "bg-surface2 text-fg")}>
                {l.label}
              </Link>
            ),
          )}
        </nav>
        {ready && (session ? (
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-muted hover:text-fg">Sign out</button>
        ) : (
          <Link href="/login" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg">Sign in</Link>
        ))}
      </div>
    </header>
  );
}
