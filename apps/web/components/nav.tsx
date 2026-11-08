"use client";
import { Moon, Sun } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "Feed" },
  { href: "/explore", label: "Explore" },
  { href: "/playground", label: "Playground" },
  { href: "/blueprints", label: "Blueprints" },
  { href: "/library", label: "Library" },
];

type Theme = "dark" | "light";
const subscribeTheme = (cb: () => void) => { window.addEventListener("themechange", cb); return () => window.removeEventListener("themechange", cb); };
const readTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

function ThemeToggle() {
  // The server (and first hydration pass) renders "dark"; the real saved theme is applied before paint by an inline script.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);
  const flip = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event("themechange"));
  };
  return (
    <button onClick={flip} className="btn btn-icon" aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}>
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

export function Nav() {
  const path = usePathname();
  const { session, ready } = useAuth();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="sticky top-0 z-40 h-14 border-b hairline bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-mono text-[13px] font-medium tracking-tight">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-accent" />
          devoholics
        </Link>
        <nav aria-label="Primary" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,#000_82%,transparent)]">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}
              className={cn("relative rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150", active(l.href) ? "text-fg" : "text-muted hover:text-fg")}>
              {active(l.href) && <motion.span layoutId="nav-active" transition={{ type: "spring", duration: 0.35, bounce: 0.15 }} className="absolute inset-0 rounded-md bg-surface3/70" />}
              <span className="relative">{l.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {ready && (session ? (
            <button onClick={() => supabase.auth.signOut()} className="btn btn-sm">Sign out</button>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">Sign in</Link>
          ))}
        </div>
      </div>
    </header>
  );
}
