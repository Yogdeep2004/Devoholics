import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Feed } from "@/components/feed";
import { FeedCard } from "@/components/feed-card";
import { Explore } from "@/components/explore";
import { compact, timeAgo } from "@/lib/utils";
import type { FeedCardT } from "@/lib/types";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ token: null, ready: true, session: null }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...p}>{children}</a> }));

const card: FeedCardT = {
  id: 1, type: "new_release", title: "FastAPI 1.0 released", description: "Web framework",
  technology: { slug: "fastapi", name: "FastAPI", category: "backend" }, source: "github",
  source_url: "https://example.com/r", detected_at: new Date().toISOString(),
  metrics: { stars: 90000, forks: 8000, stars_gained_7d: null }, score: 40, reasons: ["recency +30.0", "new release +10"],
};

const urls: string[] = [];
function mockFetch(handler: (u: string) => unknown) {
  vi.stubGlobal("fetch", vi.fn(async (u: string) => { urls.push(u); return { ok: true, json: async () => handler(u) }; }));
}
afterEach(() => { vi.unstubAllGlobals(); urls.length = 0; });

describe("utils", () => {
  it("formats numbers and unknowns", () => {
    expect(compact(12345)).toBe("12.3K");
    expect(compact(null)).toBe("—");
    expect(timeAgo(null)).toBe("unknown");
  });
});

describe("FeedCard", () => {
  it("shows reasons, honest missing growth, and source link", () => {
    render(<FeedCard c={card} />);
    expect(screen.getByText("7d: no history yet")).toBeInTheDocument();
    expect(screen.getByText("recency +30.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Source/ })).toHaveAttribute("href", "https://example.com/r");
  });
});

describe("Feed filtering", () => {
  it("refetches with the chosen type and window", async () => {
    mockFetch(() => [card]);
    render(<Feed />);
    await screen.findByText("FastAPI 1.0 released");
    await userEvent.click(screen.getByRole("button", { name: "New releases" }));
    await userEvent.click(screen.getByRole("button", { name: "7d" }));
    await waitFor(() => expect(urls.at(-1)).toMatch(/event_type=releases/));
    expect(urls.at(-1)).toMatch(/window=7d/);
  });

  it("shows an error when the API is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, statusText: "boom", json: async () => ({}) })));
    render(<Feed />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});

describe("Explore", () => {
  it("searches and filters by category", async () => {
    mockFetch((u) => (u.includes("/categories") ? [{ slug: "backend", name: "Backend", technology_count: 1 }] : []));
    render(<Explore />);
    await userEvent.type(screen.getByLabelText("Search technologies"), "qdr");
    await waitFor(() => expect(urls.some((u) => u.includes("q=qdr"))).toBe(true));
    await userEvent.click(await screen.findByRole("button", { name: /Backend/ }));
    await waitFor(() => expect(urls.at(-1)).toMatch(/category=backend/));
    expect(await screen.findByText(/No technologies match/)).toBeInTheDocument();
  });
});
