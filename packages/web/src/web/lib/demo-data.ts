// DADOS DEMONSTRATIVOS. Nomes, itens, precos e estados existem apenas para demonstrar o
// funcionamento do sistema na reuniao. O cardapio real da Valhalla substitui este conteudo
// depois do levantamento no local.

import { ORGANIZACAO_ID } from "./types";
import type { Fechamento, Mesa, MenuItem, OrderItem, Pessoa, Ticket } from "./types";

/** Mesas com comanda real nesta demonstracao. */
export const MESAS_ATIVAS = [2, 6, 8] as const;
/** Mesa do roteiro principal da reuniao. */
export const MESA_DEMO = 8;
export const TAXA_SERVICO = 0.1;
export const TOTAL_MESAS = 15;

/** Sufixo do "dono" compartilhado de cada mesa. Rateado entre as pessoas no fechamento. */
export const COMPARTILHADO_SUFIXO = "compartilhado";
export const COMPARTILHADO = "Compartilhado";

export function compartilhadoId(mesa_id: number): string {
  return `m${mesa_id}-${COMPARTILHADO_SUFIXO}`;
}

export function ehCompartilhado(pessoa_id: string): boolean {
  return pessoa_id.endsWith(`-${COMPARTILHADO_SUFIXO}`);
}

/** Horario relativo ao carregamento: a demonstracao sempre mostra horas plausiveis. */
function minutosAtras(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

export const pessoasIniciais: Pessoa[] = [
  { pessoa_id: "m2-diego", nome: "Diego", mesa_id: 2 },
  { pessoa_id: "m2-marcos", nome: "Marcos", mesa_id: 2 },
  { pessoa_id: "m6-helena", nome: "Helena", mesa_id: 6 },
  { pessoa_id: "m6-tiago", nome: "Tiago", mesa_id: 6 },
  { pessoa_id: "m6-bia", nome: "Bia", mesa_id: 6 },
  { pessoa_id: "m8-fabio", nome: "Fábio", mesa_id: 8 },
  { pessoa_id: "m8-ana", nome: "Ana", mesa_id: 8 },
  { pessoa_id: "m8-bruno", nome: "Bruno", mesa_id: 8 },
  { pessoa_id: "m8-carol", nome: "Carol", mesa_id: 8 },
];

function mesa(
  mesa_id: number,
  extra: Partial<Mesa> = {},
): Mesa {
  return {
    organizacao_id: ORGANIZACAO_ID,
    mesa_id,
    status: "livre",
    ativa: false,
    pessoasFixas: 0,
    totalFixo: 0,
    abertaEm: null,
    garcom_id: null,
    contaSolicitada: false,
    servicoIncluso: true,
    ...extra,
  };
}

export const mesasIniciais: Mesa[] = [
  mesa(1),
  mesa(2, { status: "ocupada", ativa: true, abertaEm: minutosAtras(24), garcom_id: "f-rafael" }),
  mesa(3),
  mesa(4, {
    status: "aguardando",
    pessoasFixas: 5,
    totalFixo: 148.6,
    abertaEm: minutosAtras(74),
    garcom_id: "f-livia",
  }),
  mesa(5),
  mesa(6, { status: "ocupada", ativa: true, abertaEm: minutosAtras(31), garcom_id: "f-rafael" }),
  mesa(7),
  mesa(8, {
    status: "ocupada",
    ativa: true,
    demonstracao: true,
    abertaEm: minutosAtras(42),
    garcom_id: "f-rafael",
  }),
  mesa(9),
  mesa(10),
  mesa(11),
  mesa(12),
  mesa(13),
  mesa(14),
  mesa(15),
];

interface SementeItem {
  item_id: string;
  pedido_id: string | null;
  mesa_id: number;
  pessoa_id: string;
  produto_id: string;
  name: string;
  price: number;
  quantidade: number;
  destino_producao: OrderItem["destino_producao"];
  status: OrderItem["status"];
  observacao?: string;
  minutos: number;
  funcionario_id?: string;
  funcionario_nome?: string;
}

const sementes: SementeItem[] = [
  // Mesa 02
  {
    item_id: "i201",
    pedido_id: "pd201",
    mesa_id: 2,
    pessoa_id: "m2-diego",
    produto_id: "m11",
    name: "Hambúrguer da casa",
    price: 34,
    quantidade: 1,
    destino_producao: "cozinha",
    status: "pronto",
    minutos: 12,
  },
  {
    item_id: "i202",
    pedido_id: "pd201",
    mesa_id: 2,
    pessoa_id: "m2-marcos",
    produto_id: "m11",
    name: "Hambúrguer da casa",
    price: 34,
    quantidade: 1,
    destino_producao: "cozinha",
    status: "pronto",
    observacao: "Bem passado",
    minutos: 12,
  },
  {
    item_id: "i203",
    pedido_id: "pd202",
    mesa_id: 2,
    pessoa_id: compartilhadoId(2),
    produto_id: "m1",
    name: "Chopp Pilsen 500 ml",
    price: 13,
    quantidade: 2,
    destino_producao: "bar",
    status: "entregue",
    minutos: 20,
  },
  // Mesa 06
  {
    item_id: "i601",
    pedido_id: "pd601",
    mesa_id: 6,
    pessoa_id: "m6-helena",
    produto_id: "m2",
    name: "Chopp IPA 500 ml",
    price: 16,
    quantidade: 2,
    destino_producao: "bar",
    status: "preparando",
    minutos: 4,
  },
  {
    item_id: "i602",
    pedido_id: "pd601",
    mesa_id: 6,
    pessoa_id: "m6-tiago",
    produto_id: "m5",
    name: "Água com gás",
    price: 6,
    quantidade: 1,
    destino_producao: "bar",
    status: "preparando",
    minutos: 4,
  },
  {
    item_id: "i603",
    pedido_id: null,
    mesa_id: 6,
    pessoa_id: compartilhadoId(6),
    produto_id: "m9",
    name: "Asas de Valquíria",
    price: 38,
    quantidade: 1,
    destino_producao: "cozinha",
    status: "novo",
    minutos: 1,
  },
  // Mesa 08 — roteiro principal
  {
    item_id: "i801",
    pedido_id: "pd801",
    mesa_id: 8,
    pessoa_id: "m8-fabio",
    produto_id: "m4",
    name: "Coca-Cola 1 L",
    price: 14,
    quantidade: 1,
    destino_producao: "bar",
    status: "pronto",
    minutos: 12,
  },
  {
    item_id: "i802",
    pedido_id: "pd802",
    mesa_id: 8,
    pessoa_id: "m8-fabio",
    produto_id: "m7",
    name: "Batata com bacon",
    price: 32,
    quantidade: 1,
    destino_producao: "cozinha",
    status: "preparando",
    minutos: 9,
  },
  {
    item_id: "i803",
    pedido_id: "pd801",
    mesa_id: 8,
    pessoa_id: "m8-ana",
    produto_id: "m1",
    name: "Chopp Pilsen 500 ml",
    price: 13,
    quantidade: 1,
    destino_producao: "bar",
    status: "pronto",
    minutos: 12,
  },
  {
    item_id: "i804",
    pedido_id: null,
    mesa_id: 8,
    pessoa_id: "m8-ana",
    produto_id: "m8",
    name: "Batata caramelizada",
    price: 29,
    quantidade: 1,
    destino_producao: "cozinha",
    status: "novo",
    minutos: 2,
  },
  {
    item_id: "i805",
    pedido_id: null,
    mesa_id: 8,
    pessoa_id: compartilhadoId(8),
    produto_id: "m10",
    name: "Isca de carne",
    price: 46,
    quantidade: 1,
    destino_producao: "cozinha",
    status: "novo",
    minutos: 2,
  },
];

export const itensIniciais: OrderItem[] = sementes.map((s) => {
  const criado = minutosAtras(s.minutos);
  return {
    organizacao_id: ORGANIZACAO_ID,
    item_id: s.item_id,
    pedido_id: s.pedido_id,
    mesa_id: s.mesa_id,
    pessoa_id: s.pessoa_id,
    produto_id: s.produto_id,
    name: s.name,
    price: s.price,
    quantidade: s.quantidade,
    observacao: s.observacao ?? "",
    destino_producao: s.destino_producao,
    status: s.status,
    funcionario_id: s.funcionario_id ?? "f-rafael",
    funcionario_nome: s.funcionario_nome ?? "Rafael",
    funcionario_perfil: "garcom",
    criado_em: criado,
    enviado_em: s.pedido_id ? criado : null,
    atualizado_em: criado,
  };
});

export const cardapio: MenuItem[] = [
  { produto_id: "m1", name: "Chopp Pilsen 500 ml", price: 13, destino_producao: "bar", categoria: "Chopes" },
  { produto_id: "m2", name: "Chopp IPA 500 ml", price: 16, destino_producao: "bar", categoria: "Chopes" },
  { produto_id: "m3", name: "Chopp Weiss 500 ml", price: 15, destino_producao: "bar", categoria: "Chopes" },
  { produto_id: "m4", name: "Coca-Cola 1 L", price: 14, destino_producao: "bar", categoria: "Bebidas" },
  { produto_id: "m5", name: "Água com gás", price: 6, destino_producao: "bar", categoria: "Bebidas" },
  { produto_id: "m6", name: "Caipirinha de limão", price: 22, destino_producao: "bar", categoria: "Bebidas" },
  { produto_id: "m7", name: "Batata com bacon", price: 32, destino_producao: "cozinha", categoria: "Petiscos" },
  { produto_id: "m8", name: "Batata caramelizada", price: 29, destino_producao: "cozinha", categoria: "Petiscos" },
  { produto_id: "m9", name: "Asas de Valquíria", price: 38, destino_producao: "cozinha", categoria: "Petiscos" },
  { produto_id: "m10", name: "Isca de carne", price: 46, destino_producao: "cozinha", categoria: "Petiscos" },
  { produto_id: "m11", name: "Hambúrguer da casa", price: 34, destino_producao: "cozinha", categoria: "Cozinha" },
  { produto_id: "m12", name: "Tábua para dois", price: 72, destino_producao: "cozinha", categoria: "Cozinha" },
];

interface SementeFicha {
  ticket_id: string;
  pedido_id: string;
  mesa_id: number;
  destino_producao: Ticket["destino_producao"];
  status: Ticket["status"];
  minutos: number;
  itemIds: string[];
  linhas?: Ticket["linhas"];
  funcionario_id?: string;
  funcionario_nome?: string;
}

const fichas: SementeFicha[] = [
  {
    ticket_id: "t801",
    pedido_id: "pd801",
    mesa_id: 8,
    destino_producao: "bar",
    status: "pronto",
    minutos: 12,
    itemIds: ["i801", "i803"],
  },
  {
    ticket_id: "t802",
    pedido_id: "pd802",
    mesa_id: 8,
    destino_producao: "cozinha",
    status: "preparando",
    minutos: 9,
    itemIds: ["i802"],
  },
  {
    ticket_id: "t201",
    pedido_id: "pd201",
    mesa_id: 2,
    destino_producao: "cozinha",
    status: "pronto",
    minutos: 12,
    itemIds: ["i201", "i202"],
  },
  {
    ticket_id: "t202",
    pedido_id: "pd202",
    mesa_id: 2,
    destino_producao: "bar",
    status: "entregue",
    minutos: 20,
    itemIds: ["i203"],
  },
  {
    ticket_id: "t601",
    pedido_id: "pd601",
    mesa_id: 6,
    destino_producao: "bar",
    status: "preparando",
    minutos: 4,
    itemIds: ["i601", "i602"],
  },
  {
    // Mesa 04 e mesa de apoio: a ficha existe, mas sem comanda detalhada nesta demonstracao.
    ticket_id: "t401",
    pedido_id: "pd401",
    mesa_id: 4,
    destino_producao: "cozinha",
    status: "enviado",
    minutos: 8,
    itemIds: [],
    funcionario_id: "f-livia",
    funcionario_nome: "Lívia",
    linhas: [
      {
        item_id: "x401",
        produto_id: "m7",
        name: "Batata com bacon",
        qty: 1,
        pessoa: "Compartilhado",
        observacao: "",
      },
      {
        item_id: "x402",
        produto_id: "m9",
        name: "Asas de Valquíria",
        qty: 2,
        pessoa: "Compartilhado",
        observacao: "",
      },
    ],
  },
];

function nomeDe(pessoa_id: string): string {
  if (ehCompartilhado(pessoa_id)) return COMPARTILHADO;
  return pessoasIniciais.find((p) => p.pessoa_id === pessoa_id)?.nome ?? pessoa_id;
}

export const ticketsIniciais: Ticket[] = fichas.map((f) => {
  const quando = minutosAtras(f.minutos);
  const linhas =
    f.linhas ??
    f.itemIds.map((id) => {
      const item = itensIniciais.find((i) => i.item_id === id)!;
      return {
        item_id: item.item_id,
        produto_id: item.produto_id,
        name: item.name,
        qty: item.quantidade,
        pessoa: nomeDe(item.pessoa_id),
        observacao: item.observacao,
      };
    });

  return {
    organizacao_id: ORGANIZACAO_ID,
    ticket_id: f.ticket_id,
    pedido_id: f.pedido_id,
    mesa_id: f.mesa_id,
    destino_producao: f.destino_producao,
    status: f.status,
    linhas,
    itemIds: f.itemIds,
    funcionario_id: f.funcionario_id ?? "f-rafael",
    funcionario_nome: f.funcionario_nome ?? "Rafael",
    criado_em: quando,
    enviado_em: quando,
    atualizado_em: quando,
  };
});

export const fechamentosIniciais: Fechamento[] = [];

export const configuracaoPrevista = [
  {
    icone: "monitor-smartphone",
    titulo: "Dispositivos",
    texto: "Funciona pelo navegador em celular, tablet e computador. Sem aplicativo para instalar.",
    estado: "Flexível",
    tipo: "neutro" as const,
  },
  {
    icone: "printer",
    titulo: "Impressão térmica",
    texto: "Marca, modelo, largura (58 ou 80 mm) e tipo de conexão ainda serão identificados no local.",
    estado: "A confirmar",
    tipo: "atencao" as const,
  },
  {
    icone: "file-check-2",
    titulo: "NFC-e",
    texto:
      "Integração fiscal prevista. Depende de credenciais fiscais, regras do contador e homologação.",
    estado: "Planejada",
    tipo: "atencao" as const,
  },
  {
    icone: "utensils",
    titulo: "Cardápio",
    texto: "Os itens desta demonstração são provisórios e serão trocados pelo cardápio real.",
    estado: "Provisório",
    tipo: "atencao" as const,
  },
  {
    icone: "chef-hat",
    titulo: "Pontos de produção",
    texto: "Cozinha e bar recebem fichas separadas. A divisão final será validada com a equipe.",
    estado: "A confirmar",
    tipo: "atencao" as const,
  },
  {
    icone: "users",
    titulo: "Equipe e acessos",
    texto:
      "Cada funcionário entra com PIN individual e recebe somente as rotas do próprio perfil.",
    estado: "Persistido",
    tipo: "neutro" as const,
  },
];
