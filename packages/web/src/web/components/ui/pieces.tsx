// Pecas visuais compartilhadas: selo de estado, cabecalho de secao, divisor e metricas.

import type { ReactNode } from "react";

export function StatusPill({
  label,
  color,
  strong = false,
  pulse = false,
}: {
  label: string;
  color: string;
  strong?: boolean;
  pulse?: boolean;
}) {
  return (
    <span
      className="font-display inline-flex items-center gap-2 whitespace-nowrap rounded-sm border px-2.5 py-1 text-[12px] leading-none tracking-[0.14em] uppercase"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: strong ? `color-mix(in srgb, ${color} 14%, transparent)` : "transparent",
      }}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${pulse ? "vh-pulse" : ""}`}
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-display text-gold mb-1 text-[12px] tracking-[0.22em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-parchment text-xl tracking-[0.06em] sm:text-2xl">{title}</h2>
        {hint ? <p className="text-muted mt-1 text-[13px]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Divisor discreto: dois fios de bronze e um unico losango ao centro. */
export function RuneDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="from-bronze/60 h-px flex-1 bg-gradient-to-r to-transparent" />
      <span className="border-gold/70 size-1.5 rotate-45 border" />
      <span className="from-bronze/60 h-px flex-1 bg-gradient-to-l to-transparent" />
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <p className="text-muted mb-1.5 truncate text-[12px] tracking-[0.1em] uppercase">{label}</p>
      <p
        className="font-display vh-tabular text-2xl leading-none tracking-[0.04em] sm:text-[28px]"
        style={{ color: accent ?? "var(--vh-text)" }}
      >
        {value}
        {sub ? <span className="text-muted ml-1.5 text-sm tracking-normal">{sub}</span> : null}
      </p>
    </div>
  );
}
