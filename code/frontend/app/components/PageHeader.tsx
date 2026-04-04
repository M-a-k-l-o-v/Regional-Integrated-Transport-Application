import Link from "next/link";
import { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
}: PageHeaderProps) {
  return (
    <section className="flex flex-col gap-5 rounded-[2.35rem] border border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface)_58%,var(--surface-soft)_100%)] px-5 py-5 shadow-[var(--shadow-card)] md:px-7 md:py-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--brand)] shadow-[var(--shadow-soft)]"
          >
            <span aria-hidden="true">←</span>
            <span>{backLabel}</span>
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">{eyebrow}</p>
        ) : null}
        <div>
          <h2 className="text-3xl font-semibold leading-[1.08] text-[var(--brand-ink)] md:text-[2.7rem]">{title}</h2>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-base">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="lg:max-w-sm">{actions}</div> : null}
    </section>
  );
}
