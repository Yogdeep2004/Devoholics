import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/footer";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

describe("Footer credit", () => {
  beforeEach(() => { path = "/"; });

  it("credits the author on the home page and links to their GitHub profile", () => {
    render(<Footer />);
    expect(screen.getByText(/Made with/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Yogdeep2004" });
    expect(link).toHaveAttribute("href", "https://github.com/Yogdeep2004");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(screen.getByLabelText("love")).toBeInTheDocument();
  });

  it.each(["/explore", "/library", "/playground", "/blueprints", "/blueprints/rag-application", "/t/react", "/login", "/admin"])(
    "is not shown on %s", (p) => { path = p; const { container } = render(<Footer />); expect(container).toBeEmptyDOMElement(); });
});
