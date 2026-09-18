// Roteiro demonstrativo da reuniao. O painel orienta sem bloquear: os passos avancam a mao
// (Proximo/Anterior) e tambem sao marcados sozinhos quando a acao acontece de verdade no estado.

import type { Perfil } from "./types";

/** Chaves de evento que o estado central dispara. Cada passo escuta uma delas. */
export type EventoRoteiro =
  | "perfil-garcom"
  | "mesa-08-aberta"
  | "ana-selecionada"
  | "chopp-ipa-ana"
  | "compartilhado-selecionado"
  | "tabua-observacao"
  | "pedido-enviado"
  | "perfil-producao"
  | "producao-avancou"
  | "perfil-garcom-conferiu"
  | "item-entregue"
  | "fechamento-solicitado"
  | "caixa-dividiu"
  | "notinha-impressa";

export interface PassoRoteiro {
  numero: number;
  evento: EventoRoteiro;
  perfil: Perfil;
  titulo: string;
  detalhe: string;
}

export const passosRoteiro: PassoRoteiro[] = [
  {
    numero: 1,
    evento: "perfil-garcom",
    perfil: "gerencia",
    titulo: "Trocar para o perfil Rafael",
    detalhe: "Use Trocar perfil no topo e escolha Rafael (garçom).",
  },
  {
    numero: 2,
    evento: "mesa-08-aberta",
    perfil: "garcom",
    titulo: "Abrir a Mesa 08",
    detalhe: "Na tela do garçom, toque na Mesa 08 entre as mesas do turno.",
  },
  {
    numero: 3,
    evento: "ana-selecionada",
    perfil: "garcom",
    titulo: "Selecionar Ana",
    detalhe: "Escolha a pessoa antes de lançar o item.",
  },
  {
    numero: 4,
    evento: "chopp-ipa-ana",
    perfil: "garcom",
    titulo: "Adicionar 1 SASSIONS IPA 500ML",
    detalhe: "Toque em Adicionar item, escolha o chopp e confirme a quantidade 1.",
  },
  {
    numero: 5,
    evento: "compartilhado-selecionado",
    perfil: "garcom",
    titulo: "Selecionar Compartilhado",
    detalhe: "Itens da mesa inteira entram como compartilhados e são rateados no fim.",
  },
  {
    numero: 6,
    evento: "tabua-observacao",
    perfil: "garcom",
    titulo: "Adicionar 1 PORÇÃO MISTA com observação Sem cebola",
    detalhe: "Escreva a observação no campo antes de adicionar ao pedido.",
  },
  {
    numero: 7,
    evento: "pedido-enviado",
    perfil: "garcom",
    titulo: "Revisar e enviar",
    detalhe: "Confira o pedido em Revisar pedido e envie para cozinha e bar.",
  },
  {
    numero: 8,
    evento: "perfil-producao",
    perfil: "producao",
    titulo: "Trocar para Produção",
    detalhe: "As fichas chegam separadas: cozinha de um lado, bar do outro.",
  },
  {
    numero: 9,
    evento: "producao-avancou",
    perfil: "producao",
    titulo: "Marcar um item como preparando e outro como pronto",
    detalhe: "Use Iniciar preparo e Marcar pronto nas fichas novas da Mesa 08.",
  },
  {
    numero: 10,
    evento: "perfil-garcom-conferiu",
    perfil: "garcom",
    titulo: "Trocar para Rafael e conferir o item pronto",
    detalhe: "O garçom recebe o aviso de item pronto para retirada.",
  },
  {
    numero: 11,
    evento: "item-entregue",
    perfil: "garcom",
    titulo: "Marcar o item como entregue",
    detalhe: "Depois de levar à mesa, o garçom confirma a entrega.",
  },
  {
    numero: 12,
    evento: "fechamento-solicitado",
    perfil: "garcom",
    titulo: "Solicitar fechamento",
    detalhe: "A Mesa 08 entra na fila do caixa. O garçom não encerra pagamento.",
  },
  {
    numero: 13,
    evento: "caixa-dividiu",
    perfil: "caixa",
    titulo: "Trocar para Caixa e mostrar a divisão",
    detalhe: "Divisão por pessoa, rateio do compartilhado e controle da taxa de serviço.",
  },
  {
    numero: 14,
    evento: "notinha-impressa",
    perfil: "caixa",
    titulo: "Imprimir a notinha",
    detalhe: "O resumo de consumo pode ser impresso em 58 ou 80 mm. Não tem valor fiscal.",
  },
];
