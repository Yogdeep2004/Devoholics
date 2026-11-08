import { cn } from "@/lib/utils";

/** The numbered list beside a preview. The active step is highlighted and expands to explain itself. */
export function StepList({ captions, active }: { captions: readonly { title: string; body: string }[]; active: number }) {
  return (
    <ol className="mt-7 space-y-1">
      {captions.map((c, k) => (
        <li key={c.title} aria-current={active === k ? "step" : undefined}
          className={cn("relative rounded-lg py-2 pl-4 pr-3 transition-colors duration-300", active === k ? "bg-surface2" : "")}>
          <span aria-hidden className={cn("absolute left-0 top-2 h-[calc(100%-1rem)] w-0.5 rounded bg-accent transition-opacity duration-300", active === k ? "opacity-100" : "opacity-0")} />
          <div className={cn("text-sm font-medium transition-colors duration-300", active === k ? "text-fg" : "text-muted")}>{c.title}</div>
          <div className={cn("grid text-[13px] leading-snug text-muted transition-[grid-template-rows,opacity] duration-300", active === k ? "mt-0.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
            <div className="overflow-hidden">{c.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
