import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import {
  EVENTO_IMPRESSAO_LOCAL,
  estadoImpressaoLocal,
  usarRawBtPendente,
} from "../lib/impressao-local";
import { Action, IconAction } from "./ui/action";

export function ImpressaoFallback() {
  const [estado, setEstado] = useState(estadoImpressaoLocal);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    const atualizar = () => {
      // oxlint-disable-next-line react/set-state-in-effect
      setEstado(estadoImpressaoLocal());
      setOculto(false);
    };
    window.addEventListener(EVENTO_IMPRESSAO_LOCAL, atualizar);
    return () => window.removeEventListener(EVENTO_IMPRESSAO_LOCAL, atualizar);
  }, []);

  if (!estado.temTrabalhoPendente || oculto) return null;

  return (
    <aside
      className="border-ember/70 bg-surface fixed inset-x-3 bottom-[calc(128px+env(safe-area-inset-bottom))] z-[60] flex flex-wrap items-center gap-3 rounded-md border p-3 shadow-[var(--vh-shadow)] sm:right-6 sm:left-auto sm:max-w-[460px]"
      aria-live="assertive"
      data-testid="fallback-impressao-rawbt"
    >
      <p className="text-parchment min-w-0 flex-1 text-[13px]">
        A impressão BLE falhou. A notinha continua pronta para ser enviada pelo RawBT.
      </p>
      <Action
        variante="tracejada"
        onClick={() => {
          usarRawBtPendente();
        }}
      >
        <Smartphone className="size-4" />
        Usar RawBT
      </Action>
      <IconAction label="Fechar alternativa de impressão" onClick={() => setOculto(true)}>
        <X className="size-4" />
      </IconAction>
    </aside>
  );
}
