import type { Mesa } from "../../web/lib/types";

export function criarMesaVazia(organizacaoId: string, mesaId: number): Mesa {
  return {
    organizacao_id: organizacaoId,
    mesa_id: mesaId,
    atendimento_id: null,
    status: "livre",
    ativa: false,
    pessoasFixas: 0,
    totalFixo: 0,
    abertaEm: null,
    garcom_id: null,
    contaSolicitada: false,
    servicoIncluso: true,
  };
}
