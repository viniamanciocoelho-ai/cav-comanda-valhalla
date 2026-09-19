export const TAXA_SERVICO = 0.1;

export const COMPARTILHADO_SUFIXO = "compartilhado";
export const COMPARTILHADO = "Compartilhado";

export function compartilhadoId(mesaId: number): string {
  return `m${mesaId}-${COMPARTILHADO_SUFIXO}`;
}

export function ehCompartilhado(pessoaId: string): boolean {
  return pessoaId.endsWith(`-${COMPARTILHADO_SUFIXO}`);
}
