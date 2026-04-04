import Link from "next/link";
import { ReactNode } from "react";

type AppShellProps = {
  activePath?: "home" | "journeys" | "map" | "boards";
  children: ReactNode;
};

const navItems = [
  { key: "home" as const, label: "Plan", href: "/home" },
  { key: "journeys" as const, label: "Journeys", href: "/journeys" },
  { key: "map" as const, label: "Map", href: "/map" },
  { key: "boards" as const, label: "Boards", href: "/boards" },
];

export default function AppShell({ activePath, children }: AppShellProps) {
  return (
    <main className="min-h-screen px-4 py-4 text-[var(--foreground)] md:px-6 md:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1480px] flex-col gap-6 lg:min-h-[calc(100vh-3rem)]">
        <header className="rounded-[2.5rem] border border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface)_56%,var(--surface-soft)_100%)] px-5 py-5 shadow-[var(--shadow-card)] backdrop-blur md:px-7 md:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Link href="/home" className="app-pill">
                  Regional Integrated Transport
                </Link>
                <span className="app-pill">Scheduled data shell</span>
              </div>

              <div>
                <h1 className="text-2xl font-semibold leading-tight text-[var(--brand-ink)] md:text-[2.2rem]">
                  Travel planning, stop boards, and network map in one place
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-[var(--muted)] md:text-base">
                  The current app follows the Appendix D product style while running on the scheduled timetable stack already built in the backend.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="inline-flex rounded-full border border-[var(--outline)] bg-[var(--surface-alt)] p-1 shadow-[var(--shadow-soft)]">
                {navItems.map((item) => {
                  const active = item.key === activePath;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-[var(--brand)] text-white shadow-[var(--shadow-soft)]"
                          : "text-[var(--brand-ink)] hover:bg-[var(--surface-alt-hover)]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <div className="hidden rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] lg:inline-flex">
                Responsive scheduled prototype
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
