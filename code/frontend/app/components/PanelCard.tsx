import { ReactNode } from "react";

type PanelCardProps = {
  title?: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export default function PanelCard({ title, eyebrow, description, children, className = "" }: PanelCardProps) {
  return (
    <section
      className={`rounded-[2rem] border border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface)_62%,var(--surface-soft)_100%)] p-5 shadow-[var(--shadow-soft)] ${className}`.trim()}
    >
      {eyebrow ? (
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-[var(--muted)]">{eyebrow}</p>
      ) : null}
      {title ? <h3 className="mt-2 text-[1.45rem] font-semibold leading-tight text-[var(--brand-ink)]">{title}</h3> : null}
      {description ? <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{description}</p> : null}
      <div className={title || eyebrow || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
