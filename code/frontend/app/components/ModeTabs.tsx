import Link from "next/link";

type Tab = {
  label: string;
  href: string;
  active: boolean;
};

type ModeTabsProps = {
  tabs: Tab[];
};

export default function ModeTabs({ tabs }: ModeTabsProps) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex min-h-11 items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            tab.active
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
