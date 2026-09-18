import { X } from "lucide-react";
import { useComanda } from "./comanda-provider";

const cores = {
  info: "var(--vh-bronze)",
  sucesso: "var(--vh-moss)",
  atencao: "var(--vh-ember)",
} as const;

export function ToastHost() {
  const { toasts, descartarToast } = useComanda();

  return (
    // No celular o aviso sobe acima da barra inferior (57px) e da faixa do selo (64px).
    // No desktop sobe acima do selo da plataforma, que fica fixo no canto inferior direito.
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[calc(128px+env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-[72px] sm:w-[380px]"
      aria-live="polite"
      data-testid="toast-host"
    >
      {toasts.map((toast) => (
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
  );
}
