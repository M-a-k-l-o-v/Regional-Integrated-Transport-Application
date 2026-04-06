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
    <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--brand)] transition hover:opacity-70"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{eyebrow}</p>
        ) : null}
        <h2 className="text-2xl font-bold leading-tight text-[var(--foreground)] md:text-3xl">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="lg:max-w-sm">{actions}</div> : null}
    </section>
  );
}
