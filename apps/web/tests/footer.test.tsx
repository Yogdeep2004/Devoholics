import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/footer";

describe("Footer", () => {
  it("credits the author and links to their GitHub profile", () => {
    render(<Footer />);
    expect(screen.getByText(/Made with/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Yogdeep2004" });
    expect(link).toHaveAttribute("href", "https://github.com/Yogdeep2004");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(screen.getByLabelText("love")).toBeInTheDocument();
  });
});
