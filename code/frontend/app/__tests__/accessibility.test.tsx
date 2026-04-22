import { describe, it, expect, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { axe } from "vitest-axe";
import ModeTabs from "../components/ModeTabs";
import PanelCard from "../components/PanelCard";
import PageHeader from "../components/PageHeader";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

describe("Accessibility — axe-core zero-violation checks", () => {
  it("ModeTabs renders no violations", async () => {
    const { container } = render(
      <ModeTabs
        tabs={[
          { label: "Bus", href: "/boards/bus", active: false },
          { label: "Rail", href: "/boards/rail", active: true },
        ]}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("PanelCard with full metadata renders no violations", async () => {
    const { container } = render(
      <PanelCard eyebrow="STATUS" title="Live departures" description="Updated every 30 seconds">
        <ul>
          <li>Preston 08:30 — On time</li>
          <li>Glasgow 08:47 — 2 min late</li>
        </ul>
      </PanelCard>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("PageHeader with back link and actions renders no violations", async () => {
    const { container } = render(
      <PageHeader
        eyebrow="PLANNER"
        title="Find a journey"
        description="Multimodal search across bus and rail"
        backHref="/journeys"
        backLabel="All journeys"
        actions={<button type="button">Export</button>}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("A composed section (header + panel + tabs) renders no violations", async () => {
    const { container } = render(
      <main>
        <PageHeader eyebrow="BOARDS" title="Departures" description="Live and scheduled" />
        <ModeTabs
          tabs={[
            { label: "Bus", href: "/boards/bus", active: true },
            { label: "Rail", href: "/boards/rail", active: false },
          ]}
        />
        <PanelCard title="Current board" description="Preston">
          <p>No services available at the moment.</p>
        </PanelCard>
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
