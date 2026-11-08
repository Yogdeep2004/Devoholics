import { describe, expect, it } from "vitest";
import { describeOp } from "@/components/playground/assistant";

const label = (id: string) => ({ vec: "Qdrant", api: "FastAPI" })[id] ?? id;

describe("describeOp", () => {
  it("renders every operation in plain language", () => {
    expect(describeOp({ action: "add_node", technology_id: "postgres", label: "Postgres" }, label)).toBe("Add Postgres");
    expect(describeOp({ action: "replace_node", target_node: "vec", replacement: { technology_id: "chroma" } }, label)).toBe("Replace Qdrant with chroma");
    expect(describeOp({ action: "add_edge", source: "api", target: "vec", connection_type: "retrieval" }, label)).toBe("Connect FastAPI → Qdrant (retrieval)");
    expect(describeOp({ action: "remove_node", target_node: "vec" }, label)).toBe("Remove Qdrant");
  });
});
