import { TYPE_META } from "../playground/nodes";
import type { BlueprintCard } from "@/lib/types";

/** A small SVG drawn from the blueprint's real graph (positions, component types, connections). */
export function GraphThumb({ thumb }: { thumb: BlueprintCard["thumb"] }) {
  const ns = thumb.nodes;
  if (ns.length === 0) return null;
  const minX = Math.min(...ns.map((n) => n.x)), maxX = Math.max(...ns.map((n) => n.x));
  const minY = Math.min(...ns.map((n) => n.y)), maxY = Math.max(...ns.map((n) => n.y));
  const W = 320, H = 112, pad = 26, w = 44, h = 16;
  const sx = (v: number) => pad + ((v - minX) / Math.max(1, maxX - minX)) * (W - pad * 2 - w);
  const sy = (v: number) => pad + ((v - minY) / Math.max(1, maxY - minY)) * (H - pad * 2 - h);
  const at = new Map(thumb.ids.map((id, i) => [id, { x: sx(ns[i].x) + w / 2, y: sy(ns[i].y) + h / 2 }]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Diagram preview" preserveAspectRatio="xMidYMid meet">
      {thumb.edges.map(([a, b], i) => {
        const p = at.get(a), q = at.get(b);
        if (!p || !q) return null;
        const mx = (p.x + q.x) / 2;
        return <path key={i} d={`M${p.x},${p.y} C${mx},${p.y} ${mx},${q.y} ${q.x},${q.y}`} fill="none" stroke="var(--border-strong)" strokeWidth={1.2} />;
      })}
      {ns.map((n, i) => {
        const c = TYPE_META[n.t ?? ""]?.color ?? "#8f9bb0";
        return (
          <g key={i} transform={`translate(${sx(n.x)} ${sy(n.y)})`}>
            <rect width={w} height={h} rx={5} fill="var(--surface)" stroke={c} strokeOpacity={0.55} />
            <rect x={4} y={4} width={8} height={8} rx={2.5} fill={c} fillOpacity={0.85} />
            <rect x={16} y={6.5} width={w - 22} height={3} rx={1.5} fill="var(--faint)" fillOpacity={0.6} />
          </g>
        );
      })}
    </svg>
  );
}
