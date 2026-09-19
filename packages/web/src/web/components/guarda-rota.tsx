// Guarda de rota unica do aplicativo. A matriz de permissao vive em lib/perfis.ts
// (rotasPermitidas) e e consultada em UM lugar so: aqui. Nenhuma tela repete a regra.
//
// Comportamento no bloqueio: a tela proibida NAO e montada (nada de piscar conteudo),
// o perfil volta para a rota inicial dele, um aviso aparece e o estado operacional
// continua intacto. Sem loop: a rota inicial de cada perfil esta sempre na lista dele.
//
// Esta guarda melhora a experiencia; a autorizacao efetiva tambem e aplicada na API.

import { useEffect, useRef } from "react";
import { Redirect, useLocation } from "wouter";
import { podeAcessar, rotaInicial } from "../lib/perfis";
import { useComanda } from "./comanda-provider";

export const AVISO_ROTA_BLOQUEADA = "Esta área não está disponível para este perfil";

export function GuardaRota({ children }: { children: React.ReactNode }) {
  const [rota] = useLocation();
  const { perfilAtivo, notificar } = useComanda();
  const liberado = podeAcessar(perfilAtivo, rota);
  // Evita repetir o mesmo aviso quando o React reexecuta o efeito.
  const ultimoAviso = useRef<string | null>(null);

  useEffect(() => {
    if (liberado) {
      ultimoAviso.current = null;
      return;
    }
    const chave = `${perfilAtivo}:${rota}`;
    if (ultimoAviso.current === chave) return;
    ultimoAviso.current = chave;
    notificar(`${AVISO_ROTA_BLOQUEADA}.`, "atencao");
  }, [liberado, notificar, perfilAtivo, rota]);

  if (!liberado) return <Redirect to={rotaInicial[perfilAtivo]} replace />;
  return <>{children}</>;
}
