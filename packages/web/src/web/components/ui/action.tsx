// Botoes da operacao. Altura minima de 44 px em todas as variantes (alvo de toque).

import type { ButtonHTMLAttributes } from "react";

type Variante = "primaria" | "secundaria" | "fantasma" | "tracejada";

const base =
  "font-display inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-[13px] tracking-[0.12em] whitespace-nowrap uppercase transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0";

const variantes: Record<Variante, string> = {
  primaria:
    "bg-ember text-on-accent border border-ember/80 hover:bg-gold-bright hover:border-gold-bright",
  secundaria:
    "bg-surface-2 text-parchment border border-line hover:border-gold/70 hover:bg-surface-3",
  fantasma: "text-muted border border-transparent hover:text-parchment hover:bg-surface-2",
  tracejada:
    "text-gold border border-dashed border-bronze/60 hover:border-gold hover:bg-surface-2 hover:text-gold-bright",
};

interface ActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  full?: boolean;
}

export function Action({
  variante = "secundaria",
  full = false,
  className = "",
  ...props
}: ActionProps) {
  return (
    <button
      type="button"
      className={`${base} ${variantes[variante]} ${full ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}

export function IconAction({
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`border-line bg-surface-2 text-parchment hover:border-gold/70 hover:bg-surface-3 grid size-11 shrink-0 place-items-center rounded-md border transition-colors duration-150 ${className}`}
      {...props}
    />
  );
}
