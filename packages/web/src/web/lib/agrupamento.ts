import type { OrderItem } from "./types";

export interface GrupoLancamentos {
  chave: string;
  itens: OrderItem[];
  quantidade: number;
  subtotalCentavos: number;
}

export function agruparLancamentos(itens: OrderItem[]): GrupoLancamentos[] {
  const grupos = new Map<string, GrupoLancamentos>();
  for (const item of itens) {
    const chave = JSON.stringify([item.atendimento_id, item.pessoa_id, item.produto_id, item.observacao]);
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { chave, itens: [], quantidade: 0, subtotalCentavos: 0 };
      grupos.set(chave, grupo);
    }
    grupo.itens.push(item);
    grupo.quantidade += item.quantidade;
    grupo.subtotalCentavos += Math.round(item.price * 100) * item.quantidade;
  }
  return [...grupos.values()];
}
