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
      aria-label={title ?? eyebrow ?? undefined}
      className={`rounded-[var(--radius-card)] border border-[var(--outline)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5 ${className}`.trim()}
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{eyebrow}</p>
      ) : null}
      {title ? <h3 className="mt-1.5 text-lg font-bold text-[var(--foreground)]">{title}</h3> : null}
      {description ? <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{description}</p> : null}
      <div className={title || eyebrow || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
