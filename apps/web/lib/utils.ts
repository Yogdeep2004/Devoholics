import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

export function compact(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "unknown";
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 60) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 86400 / 30)}mo ago`;
}

/** Descriptions come from GitHub and sometimes start with emoji; the UI shows plain text only. */
export function plain(text: string | null | undefined): string {
  return (text ?? "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/[\u2014\u2013]/g, "-").replace(/\s+/g, " ").trim();
}

export function ownerOf(repoUrl: string | null | undefined): string | null {
  const m = repoUrl?.match(/^https:\/\/github\.com\/([^/]+)\//);
  return m ? m[1] : null;
}

export function monogramHue(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
