import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

await prepararBancoTeste("balcao");
const { router } = await import("../packages/web/src/api");

const publico = createRouterClient(router, {
  context: { headers: new Headers() },
});
const sessaoGerencia = await publico.auth.login({
  organizacao: "valhalla",
  pin: PIN_GERENCIA_TESTE,
});
const gerencia = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoGerencia.token}` }),
  },
});

const inicial = await gerencia.comanda.estado();
const estado = inicial.estado as typeof inicial.estado & {
  balcoes: {
    organizacao_id: string;
    balcao_id: number;
    status: "livre" | "ocupada" | "aguardando";
    ativa: boolean;
    atendimento_id: string | null;
  }[];
};

assert.deepEqual(
  estado.balcoes.map((balcao) => ({
    organizacao_id: balcao.organizacao_id,
    balcao_id: balcao.balcao_id,
    status: balcao.status,
    ativa: balcao.ativa,
    atendimento_id: balcao.atendimento_id,
  })),
  [1, 2, 3, 4].map((balcao_id) => ({
    organizacao_id: "valhalla",
    balcao_id,
    status: "livre",
    ativa: false,
    atendimento_id: null,
  })),
);

await gerencia.comanda.funcionarioSalvar({
  funcionarioId: "f-dennis",
  nome: "Dennis",
  perfil: "garcom",
  pin: "5274",
  ativo: true,
});
const sessaoDennis = await publico.auth.login({
  organizacao: "valhalla",
  pin: "5274",
});
const dennis = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoDennis.token}` }),
  },
});

type PersistirBalcao = (entrada: {
  versao: number;
  acao: string;
  entidadeId: string;
  estado: unknown;
}) => Promise<{ versao: number }>;
const persistirGerencia = gerencia.comanda.persistir as unknown as PersistirBalcao;
const persistirDennis = dennis.comanda.persistir as unknown as PersistirBalcao;

const atendimentoId = "at-balcao-1";
const abertaEm = new Date().toISOString();
const pessoa = {
  pessoa_id: "p-balcao-1",
  nome: "Cliente",
  atendimento_id: atendimentoId,
  mesa_id: null,
  balcao_id: 1,
};
const abertura = await persistirGerencia({
  versao: inicial.versao,
  acao: "abrir_balcao",
  entidadeId: "balcao:1",
  estado: {
    ...inicial.estado,
    balcoes: estado.balcoes.map((balcao) =>
      balcao.balcao_id === 1
        ? {
            ...balcao,
            atendimento_id: atendimentoId,
            status: "ocupada",
            ativa: true,
            abertaEm,
            garcom_id: sessaoGerencia.funcionario.funcionario_id,
          }
        : balcao,
    ),
    pessoas: [pessoa],
  },
});

const estadoDennis = await dennis.comanda.estado();
const estadoCompartilhado = estadoDennis.estado as typeof estadoDennis.estado & {
  balcoes: typeof estado.balcoes;
};
assert.equal(
  estadoCompartilhado.balcoes.find((balcao) => balcao.balcao_id === 1)?.atendimento_id,
  atendimentoId,
);

const produto = estadoDennis.cardapio.find((registro) => registro.produto_id === "m1");
assert.ok(produto);
const agora = new Date().toISOString();
const item = {
  organizacao_id: estadoDennis.organizacaoId,
  item_id: "i-balcao-1",
  pedido_id: null,
  atendimento_id: atendimentoId,
  mesa_id: null,
  balcao_id: 1,
  pessoa_id: pessoa.pessoa_id,
  produto_id: produto.produto_id,
  name: produto.name,
  price: produto.price,
  quantidade: 1,
  observacao: "",
  destino_producao: produto.destino_producao,
  status: "novo",
  funcionario_id: sessaoDennis.funcionario.funcionario_id,
  funcionario_nome: sessaoDennis.funcionario.funcionario_nome,
  funcionario_perfil: sessaoDennis.funcionario.funcionario_perfil,
  criado_em: agora,
  enviado_em: null,
  atualizado_em: agora,
};
const rascunho = await persistirDennis({
  versao: abertura.versao,
  acao: "alterar_comanda",
  entidadeId: atendimentoId,
  estado: {
    ...estadoDennis.estado,
    pessoas: [pessoa],
    itens: [item],
  },
});
const pedidoId = "pd-balcao-1";
const envio = await persistirDennis({
  versao: rascunho.versao,
  acao: "enviar_pedido",
  entidadeId: atendimentoId,
  estado: {
    ...estadoDennis.estado,
    pessoas: [pessoa],
    itens: [
      {
        ...item,
        pedido_id: pedidoId,
        status: "enviado",
        enviado_em: agora,
      },
    ],
    tickets: [
      {
        organizacao_id: estadoDennis.organizacaoId,
        ticket_id: "t-balcao-1",
        pedido_id: pedidoId,
        atendimento_id: atendimentoId,
        mesa_id: null,
        balcao_id: 1,
        destino_producao: produto.destino_producao,
        status: "enviado",
        linhas: [
          {
            item_id: item.item_id,
            produto_id: item.produto_id,
            name: item.name,
            qty: item.quantidade,
            pessoa: pessoa.nome,
            observacao: item.observacao,
          },
        ],
        itemIds: [item.item_id],
        funcionario_id: sessaoDennis.funcionario.funcionario_id,
        funcionario_nome: sessaoDennis.funcionario.funcionario_nome,
        criado_em: agora,
        enviado_em: agora,
        atualizado_em: agora,
      },
    ],
  },
});

const persistido = await dennis.comanda.estado();
assert.equal(persistido.versao, envio.versao);
const itemPersistido = (
  persistido.estado.itens as (typeof item)[]
).find((registro) => registro.item_id === item.item_id);
assert.equal(itemPersistido?.funcionario_id, sessaoDennis.funcionario.funcionario_id);
assert.equal(itemPersistido?.atendimento_id, atendimentoId);
assert.equal(itemPersistido?.balcao_id, 1);

const estadoAntesTransferencia = persistido.estado as typeof persistido.estado & {
  balcoes: typeof estado.balcoes;
};
const transferirPara = (mesaId: number) => ({
  ...estadoAntesTransferencia,
  balcoes: estadoAntesTransferencia.balcoes.map((balcao) =>
    balcao.balcao_id === 1
      ? {
          ...balcao,
          atendimento_id: null,
          status: "livre" as const,
          ativa: false,
          abertaEm: null,
          garcom_id: null,
          contaSolicitada: false,
          servicoIncluso: true,
        }
      : balcao,
  ),
  mesas: estadoAntesTransferencia.mesas.map((mesa) =>
    mesa.mesa_id === mesaId
      ? {
          ...mesa,
          atendimento_id: atendimentoId,
          status: "ocupada" as const,
          ativa: true,
          abertaEm,
          garcom_id: sessaoGerencia.funcionario.funcionario_id,
          contaSolicitada: false,
          servicoIncluso: true,
        }
      : mesa,
  ),
  pessoas: estadoAntesTransferencia.pessoas.map((registro) =>
    registro.atendimento_id === atendimentoId
      ? { ...registro, mesa_id: mesaId, balcao_id: null }
      : registro,
  ),
  itens: estadoAntesTransferencia.itens.map((registro) =>
    registro.atendimento_id === atendimentoId
      ? { ...registro, mesa_id: mesaId, balcao_id: null }
      : registro,
  ),
  tickets: estadoAntesTransferencia.tickets.map((registro) =>
    registro.atendimento_id === atendimentoId
      ? { ...registro, mesa_id: mesaId, balcao_id: null }
      : registro,
  ),
});

const disputas = await Promise.allSettled(
  [8, 9].map((mesaId) =>
    persistirGerencia({
      versao: persistido.versao,
      acao: "transferir_balcao_mesa",
      entidadeId: `balcao:1->mesa:${mesaId}`,
      estado: transferirPara(mesaId),
    }),
  ),
);
assert.equal(disputas.filter((resultado) => resultado.status === "fulfilled").length, 1);
assert.equal(disputas.filter((resultado) => resultado.status === "rejected").length, 1);

const depoisTransferencia = await gerencia.comanda.estado();
const mesaDestino = depoisTransferencia.estado.mesas.find(
  (mesa) => mesa.atendimento_id === atendimentoId,
);
assert.ok(mesaDestino);
assert.ok(mesaDestino.mesa_id === 8 || mesaDestino.mesa_id === 9);
assert.equal(
  (depoisTransferencia.estado.balcoes as typeof estado.balcoes).find(
    (balcao) => balcao.balcao_id === 1,
  )?.ativa,
  false,
);
assert.equal(
  depoisTransferencia.estado.itens.find((registro) => registro.item_id === item.item_id)
    ?.item_id,
  item.item_id,
);
assert.equal(
  depoisTransferencia.estado.itens.find((registro) => registro.item_id === item.item_id)
    ?.mesa_id,
  mesaDestino.mesa_id,
);
assert.equal(
  depoisTransferencia.estado.tickets.find(
    (registro) => registro.ticket_id === "t-balcao-1",
  )?.status,
  "enviado",
);
await assert.rejects(() =>
  persistirGerencia({
    versao: persistido.versao,
    acao: "transferir_balcao_mesa",
    entidadeId: `balcao:1->mesa:${mesaDestino.mesa_id}`,
    estado: transferirPara(mesaDestino.mesa_id),
  }),
);

const atendimentoReuso = "at-balcao-reuso";
const pessoaReuso = {
  pessoa_id: "p-balcao-reuso",
  nome: "Cliente",
  atendimento_id: atendimentoReuso,
  mesa_id: null,
  balcao_id: 1,
};
const aberturaReuso = await persistirGerencia({
  versao: depoisTransferencia.versao,
  acao: "abrir_balcao",
  entidadeId: "balcao:1",
  estado: {
    ...depoisTransferencia.estado,
    balcoes: (depoisTransferencia.estado.balcoes as typeof estado.balcoes).map(
      (balcao) =>
        balcao.balcao_id === 1
          ? {
              ...balcao,
              atendimento_id: atendimentoReuso,
              status: "ocupada",
              ativa: true,
              abertaEm: agora,
              garcom_id: sessaoGerencia.funcionario.funcionario_id,
            }
          : balcao,
    ),
    pessoas: [...depoisTransferencia.estado.pessoas, pessoaReuso],
  },
});
const itemReuso = {
  ...item,
  item_id: "i-balcao-reuso",
  pedido_id: "pd-balcao-reuso",
  atendimento_id: atendimentoReuso,
  mesa_id: null,
  balcao_id: 1,
  pessoa_id: pessoaReuso.pessoa_id,
  status: "enviado" as const,
  funcionario_id: sessaoGerencia.funcionario.funcionario_id,
  funcionario_nome: sessaoGerencia.funcionario.funcionario_nome,
  funcionario_perfil: sessaoGerencia.funcionario.funcionario_perfil,
  enviado_em: agora,
};
const ticketReuso = {
  organizacao_id: estadoDennis.organizacaoId,
  ticket_id: "t-balcao-reuso",
  pedido_id: "pd-balcao-reuso",
  atendimento_id: atendimentoReuso,
  mesa_id: null,
  balcao_id: 1,
  destino_producao: produto.destino_producao,
  status: "enviado" as const,
  linhas: [
    {
      item_id: itemReuso.item_id,
      produto_id: itemReuso.produto_id,
      name: itemReuso.name,
      qty: itemReuso.quantidade,
      pessoa: pessoaReuso.nome,
      observacao: itemReuso.observacao,
    },
  ],
  itemIds: [itemReuso.item_id],
  funcionario_id: sessaoGerencia.funcionario.funcionario_id,
  funcionario_nome: sessaoGerencia.funcionario.funcionario_nome,
  criado_em: agora,
  enviado_em: agora,
  atualizado_em: agora,
};
const estadoReusoAberto = await gerencia.comanda.estado();
const rascunhoReuso = await persistirGerencia({
  versao: aberturaReuso.versao,
  acao: "alterar_comanda",
  entidadeId: atendimentoReuso,
  estado: {
    ...estadoReusoAberto.estado,
    itens: [
      ...estadoReusoAberto.estado.itens,
      { ...itemReuso, pedido_id: null, status: "novo", enviado_em: null },
    ],
  },
});
const estadoRascunhoReuso = await gerencia.comanda.estado();
const envioReuso = await persistirGerencia({
  versao: rascunhoReuso.versao,
  acao: "enviar_pedido",
  entidadeId: atendimentoReuso,
  estado: {
    ...estadoRascunhoReuso.estado,
    itens: estadoRascunhoReuso.estado.itens.map((registro) =>
      registro.item_id === itemReuso.item_id ? itemReuso : registro,
    ),
    tickets: [ticketReuso, ...estadoRascunhoReuso.estado.tickets],
  },
});
const estadoParaFechar = await gerencia.comanda.estado();
const subtotal = produto.price;
const servico = Math.round(subtotal * 100 * 0.1) / 100;
const fechamentoId = "f-balcao-reuso";
const fechamento = {
  organizacao_id: estadoDennis.organizacaoId,
  fechamento_id: fechamentoId,
  atendimento_id: atendimentoReuso,
  mesa_id: null,
  balcao_id: 1,
  hora: agora,
  subtotal,
  servico,
  total: subtotal + servico,
  servicoIncluso: true,
  divisao: [
    {
      pessoa_id: pessoaReuso.pessoa_id,
      pessoa: pessoaReuso.nome,
      valor: subtotal + servico,
    },
  ],
  nfce: "nao_solicitada" as const,
  funcionario_nome: sessaoGerencia.funcionario.funcionario_nome,
  garcom_nome: sessaoGerencia.funcionario.funcionario_nome,
};
const fechamentoReuso = await persistirGerencia({
  versao: envioReuso.versao,
  acao: "fechar_conta",
  entidadeId: atendimentoReuso,
  estado: {
    ...estadoParaFechar.estado,
    balcoes: (estadoParaFechar.estado.balcoes as typeof estado.balcoes).map(
      (balcao) =>
        balcao.balcao_id === 1
          ? {
              ...balcao,
              atendimento_id: null,
              status: "livre",
              ativa: false,
              abertaEm: null,
              garcom_id: null,
              contaSolicitada: false,
              servicoIncluso: true,
            }
          : balcao,
    ),
    pessoas: estadoParaFechar.estado.pessoas.filter(
      (registro) => registro.atendimento_id !== atendimentoReuso,
    ),
    itens: estadoParaFechar.estado.itens.filter(
      (registro) => registro.atendimento_id !== atendimentoReuso,
    ),
    tickets: estadoParaFechar.estado.tickets.filter(
      (registro) => registro.atendimento_id !== atendimentoReuso,
    ),
    fechamentos: [...estadoParaFechar.estado.fechamentos, fechamento],
  },
});
const aposFechamento = await gerencia.comanda.estado();
assert.equal(aposFechamento.versao, fechamentoReuso.versao);
assert.equal(
  (aposFechamento.estado.balcoes as typeof estado.balcoes).find(
    (balcao) => balcao.balcao_id === 1,
  )?.atendimento_id,
  null,
);
assert.equal(
  aposFechamento.estado.itens.some(
    (registro) => registro.atendimento_id === atendimentoReuso,
  ),
  false,
);
assert.equal(
  aposFechamento.estado.fechamentos.some(
    (registro) => registro.fechamento_id === fechamentoId,
  ),
  true,
);

console.log(
  "Balcão: operação compartilhada, transferência concorrente, fechamento e reuso preservam tenant, IDs e autoria.",
);
