// Hooks compartilhados da interface. Dois assuntos, ambos usados por mais de uma tela:
//
// 1. useAgora  — data e hora reais do dispositivo, em pt-BR e no fuso local, com atualizacao
//                automatica. Nenhuma tela escreve data ou hora fixa: tudo sai daqui.
// 2. useAcaoUnica — protecao contra duplo clique em acao que grava (enviar pedido, fechar
//                conta, solicitar fechamento, marcar entrega). Trava o botao no primeiro
//                clique, libera sozinha depois e restaura na hora em caso de erro.

import { useCallback, useEffect, useRef, useState } from "react";
import { dataOperacional, horaAgora } from "./format";

/** Janela em que o botao fica travado depois de uma execucao bem-sucedida. */
const TRAVA_MS = 600;

export interface Agora {
  /** "Domingo, 13 de setembro" — data real do dispositivo, capitalizada. */
  data: string;
  /** "03:00" — hora real do dispositivo, fuso local. */
  hora: string;
}

/**
 * Data e hora do dispositivo, revistas a cada 20 s (troca de minuto e virada de dia
 * entram sozinhas, sem recarregar a pagina).
 */
export function useAgora(): Agora {
  const [agora, setAgora] = useState<Agora>(() => ({ data: dataOperacional(), hora: horaAgora() }));

  useEffect(() => {
    const atualizar = () => setAgora({ data: dataOperacional(), hora: horaAgora() });
    atualizar();
    const intervalo = window.setInterval(atualizar, 20_000);
    // Voltar para a aba tambem revisa: o navegador pode ter congelado o timer.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  return agora;
}

export interface AcaoUnica {
  /** true enquanto a acao esta em curso: o botao fica desabilitado. */
  processando: boolean;
  /** Executa a acao uma unica vez por clique. Cliques repetidos na janela sao ignorados. */
  executar: (acao: () => void) => void;
}

/**
 * Garante uma execucao por clique. A trava vive num ref, portanto vale ja no segundo
 * clique do mesmo instante — antes de qualquer re-render.
 */
export function useAcaoUnica(): AcaoUnica {
  const trava = useRef(false);
  const timer = useRef<number | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const liberar = useCallback(() => {
    trava.current = false;
    setProcessando(false);
  }, []);

  const executar = useCallback(
    (acao: () => void) => {
      if (trava.current) return;
      trava.current = true;
      setProcessando(true);
      try {
        acao();
      } catch (erro) {
        // Falhou: devolve o botao imediatamente para o operador tentar de novo.
        liberar();
        throw erro;
      }
      timer.current = window.setTimeout(liberar, TRAVA_MS);
    },
    [liberar],
  );

  return { processando, executar };
}
