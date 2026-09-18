// Dialogo nativo (<dialog>): foco preso pelo proprio navegador, Esc fecha, sem dependencia extra.
// No celular ele encosta no rodape (folha); no desktop fica centralizado.

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Sheet({
  open,
  onClose,
  eyebrow,
  title,
  hint,
  children,
  footer,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  hint?: string;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const hintId = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (open && !dialogo.open) dialogo.showModal();
    if (!open && dialogo.open) dialogo.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      className="rounded-lg"
      aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined}
      onCancel={(evento) => {
        evento.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="border-line vh-plate sticky top-0 flex items-start gap-3 border-b px-4 py-3.5 sm:px-6">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="font-display text-gold mb-1 text-[12px] tracking-[0.22em] uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h2 id={titleId} className="text-parchment text-[19px] tracking-[0.05em]">
              {title}
            </h2>
            {hint ? (
              <p id={hintId} className="text-muted mt-1 text-[12px] leading-snug">
                {hint}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="border-line bg-surface-2 text-parchment hover:border-gold/70 grid size-11 shrink-0 place-items-center rounded-md border"
          >
            <X className="size-[18px]" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>

        {footer ? (
          <footer
            className="border-line bg-surface-2 border-t px-4 py-3.5 sm:px-6"
            style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
