"use client";
import { useState } from "react";
import { monogramHue, ownerOf } from "@/lib/utils";

/** Real owner avatar from GitHub when we have a GitHub repository; otherwise a generated monogram. */
export function TechLogo({ name, repoUrl, size = 36 }: { name: string; repoUrl?: string | null; size?: number }) {
  const owner = ownerOf(repoUrl);
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.24) };
  if (owner && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`https://github.com/${owner}.png?size=${size * 2}`} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)}
      className="shrink-0 border hairline bg-surface2 object-cover" style={box} />;
  }
  const hue = monogramHue(name);
  return (
    <span aria-hidden className="grid shrink-0 place-items-center font-mono text-[0.8em] font-medium"
      style={{ ...box, fontSize: size * 0.4, background: `hsl(${hue} 22% 20%)`, color: `hsl(${hue} 45% 75%)`, border: "1px solid var(--border)" }}>
      {name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase()}
    </span>
  );
}
