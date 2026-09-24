import type { Pessoa } from "./types";

export const TAXA_SERVICO = 0.1;

export const COMPARTILHADO_SUFIXO = "compartilhado";
export const COMPARTILHADO = "Compartilhado";

export function compartilhadoId(localId: number | string): string {
  return `${typeof localId === "number" ? `m${localId}` : localId}-${COMPARTILHADO_SUFIXO}`;
}

export function ehCompartilhado(pessoaId: string): boolean {
  return pessoaId.endsWith(`-${COMPARTILHADO_SUFIXO}`);
}

export function participantesDoRateio(
  pessoas: Pick<Pessoa, "pessoa_id" | "nome">[],
  atendimentoId: string,
): Pick<Pessoa, "pessoa_id" | "nome">[] {
  return pessoas.length
    ? pessoas
    : [{ pessoa_id: `${atendimentoId}-sem-identificacao`, nome: "Consumo sem identificação" }];
}
