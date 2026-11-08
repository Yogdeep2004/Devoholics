"use client";
import { Heart } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";

/** The author credit appears on the home page only. */
export function Footer() {
  if (usePathname() !== "/") return null;
  return (
    <footer className="border-t hairline">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-8 text-[13px] text-muted sm:px-6">
        <p className="flex items-center gap-1.5">
          Made with <Heart size={14} weight="fill" className="text-accent" aria-label="love" /> by{" "}
          <a href="https://github.com/Yogdeep2004" target="_blank" rel="noreferrer" className="font-medium text-fg underline-offset-4 transition-colors duration-150 hover:text-accent hover:underline">
            Yogdeep2004
          </a>
        </p>
      </div>
    </footer>
  );
}
