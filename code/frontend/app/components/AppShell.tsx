import Link from "next/link";
import { ReactNode } from "react";
import ThemeToggle from "./ThemeToggle";

type AppShellProps = {
  activePath?: "home" | "journeys" | "map" | "boards" | "roads";
  children: ReactNode;
};

const navItems = [
  {
    key: "home" as const,
    label: "Home",
    href: "/home",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
      </svg>
    ),
  },
  {
    key: "journeys" as const,
    label: "Journeys",
    href: "/journeys",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    key: "map" as const,
    label: "Map",
    href: "/map",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "roads" as const,
    label: "Roads",
    href: "/road-info",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l3-18m0 18l3-18M4 8h18M2 16h18" />
      </svg>
    ),
  },
  {
    key: "boards" as const,
    label: "Boards",
    href: "/boards",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
];

export default function AppShell({ activePath, children }: AppShellProps) {
  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Desktop top nav */}
      <header className="sticky top-0 z-[800] hidden border-b border-[var(--outline)] bg-[var(--surface)]/80 backdrop-blur-xl md:block" role="banner">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/home" className="text-base font-bold tracking-tight text-[var(--brand)]" aria-label="Lancashire Transport — Home">
            Lancashire Transport
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = item.key === activePath;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="ml-2 border-l border-[var(--outline)] pl-3">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main id="main-content" className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-8" role="main">
        <div className="flex flex-col gap-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--outline)] bg-[var(--surface)]/90 backdrop-blur-xl safe-b md:hidden" aria-label="Mobile navigation">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const active = item.key === activePath;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 transition ${
                  active ? "text-[var(--brand)]" : "text-[var(--muted)]"
                }`}
              >
                <span className={active ? "rounded-full bg-[var(--brand)] p-1.5 text-white" : "p-1.5"} aria-hidden="true">
                  {item.icon}
                </span>
                <span className="text-[0.65rem] font-semibold">{item.label}</span>
              </Link>
            );
          })}
          <div className="flex flex-col items-center gap-0.5 px-1 py-1.5">
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </div>
  );
}
