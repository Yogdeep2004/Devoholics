"use client";
import { ArrowsLeftRight, Trash } from "@phosphor-icons/react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useEditor } from "@/lib/playground/store";

/** Connection with a readable label and, when selected, reverse/delete actions. */
export function ActionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, selected, data }: EdgeProps) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const editable = useEditor((s) => s.editable);
  const reverse = useEditor((s) => s.reverseEdge);
  const del = useEditor((s) => s.deleteEdge);
  const label = (data as { displayLabel?: string } | undefined)?.displayLabel;
  return (
    <>
      <BaseEdge id={id} path={path} style={{ ...style, strokeWidth: selected ? 2 : 1.4 }} markerEnd={markerEnd} interactionWidth={22} />
      <EdgeLabelRenderer>
        <div className="nodrag nopan absolute" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, pointerEvents: "all" }}>
          {selected && editable ? (
            <div className="action-bar pop" role="toolbar" aria-label="Connection actions">
              {label && <span className="px-2 text-[11px] text-muted">{label}</span>}
              <button className="tool-btn" title="Reverse direction" aria-label="Reverse direction" onClick={() => reverse(id)}><ArrowsLeftRight size={15} /></button>
              <span className="tool-sep" />
              <button className="tool-btn danger" title="Delete connection" aria-label="Delete connection" onClick={() => del(id)}><Trash size={15} /></button>
            </div>
          ) : label ? (
            <span className="rounded-md bg-bg px-1.5 py-0.5 text-[10px] text-muted">{label}</span>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { action: ActionEdge };
