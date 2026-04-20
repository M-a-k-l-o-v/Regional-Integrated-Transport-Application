import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import ModeTabs from "../components/ModeTabs";
import PanelCard from "../components/PanelCard";
import PageHeader from "../components/PageHeader";

// next/link is imported at module-eval time by the components. Stub it with
// a plain anchor so jsdom can render it without a Next.js runtime.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

describe("ModeTabs", () => {
  it("renders one link per tab with the correct href", () => {
    render(
      <ModeTabs
        tabs={[
          { label: "Bus", href: "/boards/bus", active: false },
          { label: "Rail", href: "/boards/rail", active: true },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "Bus" })).toHaveAttribute("href", "/boards/bus");
    expect(screen.getByRole("link", { name: "Rail" })).toHaveAttribute("href", "/boards/rail");
  });

  it("applies the active class to only the active tab", () => {
    render(
      <ModeTabs
        tabs={[
          { label: "Bus", href: "/boards/bus", active: false },
          { label: "Rail", href: "/boards/rail", active: true },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "Rail" }).className).toMatch(/bg-\[var\(--brand\)\]/);
    expect(screen.getByRole("link", { name: "Bus" }).className).not.toMatch(/bg-\[var\(--brand\)\]/);
  });

  it("renders no tabs when the array is empty", () => {
    const { container } = render(<ModeTabs tabs={[]} />);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});

describe("PanelCard", () => {
  it("renders eyebrow, title, description and children", () => {
    render(
      <PanelCard eyebrow="SECTION" title="Recent boards" description="Recently viewed">
        <p>Child content</p>
      </PanelCard>
    );
    expect(screen.getByText("SECTION")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Recent boards" })).toBeInTheDocument();
    expect(screen.getByText("Recently viewed")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("sets aria-label from title", () => {
    render(
      <PanelCard title="Live departures">
        <div />
      </PanelCard>
    );
    expect(screen.getByRole("region", { name: "Live departures" })).toBeInTheDocument();
  });

  it("falls back to eyebrow for aria-label when title is absent", () => {
    render(
      <PanelCard eyebrow="STATUS">
        <div />
      </PanelCard>
    );
    expect(screen.getByRole("region", { name: "STATUS" })).toBeInTheDocument();
  });

  it("does not render any header text when only children are supplied", () => {
    render(
      <PanelCard>
        <p>Just me</p>
      </PanelCard>
    );
    expect(screen.getByText("Just me")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders the title as a level-2 heading", () => {
    render(<PageHeader title="Journey planner" />);
    expect(screen.getByRole("heading", { level: 2, name: "Journey planner" })).toBeInTheDocument();
  });

  it("renders a back link when backHref is provided", () => {
    render(<PageHeader title="Leg detail" backHref="/journeys" backLabel="All journeys" />);
    expect(screen.getByRole("link", { name: /All journeys/ })).toHaveAttribute("href", "/journeys");
  });

  it("omits the back link when backHref is not provided", () => {
    render(<PageHeader title="No back" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the eyebrow and description when provided", () => {
    render(
      <PageHeader eyebrow="PLANNER" title="Find a journey" description="Multimodal search" />
    );
    expect(screen.getByText("PLANNER")).toBeInTheDocument();
    expect(screen.getByText("Multimodal search")).toBeInTheDocument();
  });

  it("renders an actions slot", () => {
    render(
      <PageHeader
        title="With actions"
        actions={<button type="button">Export</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});
