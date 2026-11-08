import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlueprintTile } from "@/components/blueprints/list";
import type { BlueprintCard } from "@/lib/types";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...p}>{children}</a> }));

const bp: BlueprintCard = { slug: "rag-application", title: "RAG Application", description: "Answer questions over your documents", difficulty: "beginner",
  status: "published", curated: true, version: 1, fork_count: 3, components: 7, technologies: ["qdrant", "fastapi"], author: { id: "system", username: "devoholics" }, published_at: null, thumb: { nodes: [], edges: [], ids: [] } };

describe("BlueprintTile", () => {
  it("shows provenance, difficulty, size and links to the detail page", () => {
    const { rerender } = render(<BlueprintTile b={bp} />);
    expect(screen.getByText("Curated")).toBeInTheDocument();
    expect(screen.getByText("beginner")).toBeInTheDocument();
    expect(screen.getByText("7 parts")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/blueprints/rag-application");
    rerender(<BlueprintTile b={{ ...bp, curated: false }} />);
    expect(screen.getByText("Community")).toBeInTheDocument();  // community content is never presented as curated
    expect(screen.queryByText("Curated")).not.toBeInTheDocument();
  });
});
