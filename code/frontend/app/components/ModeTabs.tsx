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
    <div className="inline-flex flex-wrap rounded-full border border-[var(--outline)] bg-[var(--surface-alt)] p-1 shadow-[var(--shadow-soft)]">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            tab.active
              ? "bg-[var(--brand)] text-white shadow-[var(--shadow-soft)]"
              : "text-[var(--brand-ink)] hover:bg-[var(--surface-alt-hover)]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
