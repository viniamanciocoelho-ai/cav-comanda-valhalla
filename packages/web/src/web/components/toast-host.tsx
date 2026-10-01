import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useComanda } from "./comanda-provider";

const cores = {
  info: "var(--vh-bronze)",
  sucesso: "var(--vh-moss)",
  atencao: "var(--vh-ember)",
} as const;

export function ToastHost() {
  const { toasts, descartarToast } = useComanda();
  const destaque = [...toasts].reverse().find((toast) => toast.destaque);
  const dialogoAberto = destaque && typeof document !== "undefined"
    ? document.querySelector("dialog[open]") : null;
  const aviso = destaque ? (
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center px-4" aria-live="polite">
      <button type="button" onClick={() => descartarToast(destaque.id)}
        data-testid="aviso-item-adicionado"
        aria-label={`${destaque.text} Toque para fechar.`}
        className="bg-surface border-moss text-parchment pointer-events-auto w-full max-w-md rounded-md border-2 px-6 py-7 text-center text-xl font-semibold leading-snug shadow-[var(--vh-shadow)] motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none">
        {destaque.text}
      </button>
    </div>
  ) : null;

  return (
    <>
    {dialogoAberto && aviso ? createPortal(aviso, dialogoAberto) : aviso}
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[calc(128px+env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-[72px] sm:w-[380px]"
      aria-live="polite"
      data-testid="toast-host"
    >
      {toasts.filter((toast) => !toast.destaque).map((toast) => (
        <div
          key={toast.id}
          className="vh-toast bg-surface border-line pointer-events-auto flex items-start gap-3 rounded-md border py-3 pr-2 pl-4 shadow-[var(--vh-shadow)]"
          style={{ borderLeft: `3px solid ${cores[toast.tone]}` }}
        >
          <p className="text-parchment flex-1 text-[13px] leading-snug">{toast.text}</p>
          <button
            type="button"
            onClick={() => descartarToast(toast.id)}
            aria-label="Fechar aviso"
            className="text-muted hover:text-parchment grid size-11 shrink-0 place-items-center rounded-md"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
    </>
  );
}
