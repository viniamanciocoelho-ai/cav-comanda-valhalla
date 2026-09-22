import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { montarFichaProducao, serializarEscPos } from "../packages/web/src/web/lib/recibo";
import type { Ticket } from "../packages/web/src/web/lib/types";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

const ticketTeste: Ticket = {
  organizacao_id: "valhalla",
  ticket_id: "t-serializacao",
  pedido_id: "p-serializacao",
  atendimento_id: "at-serializacao",
  mesa_id: 8,
  balcao_id: null,
  destino_producao: "cozinha",
  status: "enviado",
  linhas: [
    {
      item_id: "i-serializacao",
      produto_id: "m1",
      name: "Batata cheddar",
      qty: 2,
      pessoa: "Ana",
      observacao: "Sem cebola",
    },
  ],
  itemIds: ["i-serializacao"],
  funcionario_id: "f-gerencia",
  funcionario_nome: "Gerência",
  criado_em: new Date().toISOString(),
  enviado_em: new Date().toISOString(),
  atualizado_em: new Date().toISOString(),
};
const textoFicha = montarFichaProducao(ticketTeste, 58);
const bytesFicha = serializarEscPos(textoFicha);
assert.deepEqual(
  bytesFicha.slice(0, 8),
  new Uint8Array([0x1b, 0x40, 0x1b, 0x74, 0x03, 0x1b, 0x61, 0x00]),
);
assert.deepEqual(bytesFicha.slice(-3), new Uint8Array([0x1b, 0x64, 0x04]));
assert.equal(
  bytesFicha.findIndex(
    (byte, indice) =>
      byte === 0x1d && bytesFicha[indice + 1] === 0x56,
  ),
  -1,
);

await prepararBancoTeste("impressao");
const { router } = await import("../packages/web/src/api");
const publico = createRouterClient(router, { context: { headers: new Headers() } });
const sessaoGerencia = await publico.auth.login({
  organizacao: "valhalla",
  pin: PIN_GERENCIA_TESTE,
});
const gerencia = createRouterClient(router, {
  context: { headers: new Headers({ authorization: `Bearer ${sessaoGerencia.token}` }) },
});
await gerencia.comanda.funcionarioSalvar({
  funcionarioId: "f-producao",
  nome: "Produção",
  perfil: "producao",
  pin: "6385",
  ativo: true,
});
const sessaoProducao = await publico.auth.login({
  organizacao: "valhalla",
  pin: "6385",
});
const producao = createRouterClient(router, {
  context: { headers: new Headers({ authorization: `Bearer ${sessaoProducao.token}` }) },
});

await assert.rejects(() =>
  gerencia.impressao.impressoraSalvar({
    destino: "bar",
    nome: "Bar",
    host: "",
    porta: 9100,
    largura: 58,
    ativa: true,
  }),
);
await assert.rejects(() =>
  gerencia.impressao.impressoraSalvar({
    destino: "bar",
    nome: "Bar",
    host: "127.0.0.1",
    porta: 65_536,
    largura: 58,
    ativa: true,
  }),
);

await gerencia.impressao.impressoraSalvar({
  destino: "bar",
  nome: "Bar",
  host: "127.0.0.1",
  porta: 9,
  largura: 58,
  ativa: true,
});

const estadoInicial = await gerencia.comanda.estado();
const produtoBar = estadoInicial.cardapio.find((produto) => produto.destino_producao === "bar");
const produtoCozinha = estadoInicial.cardapio.find(
  (produto) => produto.destino_producao === "cozinha",
);
assert.ok(produtoBar);
assert.ok(produtoCozinha);
const pessoa = {
  pessoa_id: "m8-impressao",
  nome: "Ana",
  atendimento_id: "at-impressao",
  mesa_id: 8,
  balcao_id: null,
};
const agora = new Date().toISOString();
const itemBar = {
  organizacao_id: "valhalla",
  item_id: "i-bar-impressao",
  pedido_id: null,
  atendimento_id: "at-impressao",
  mesa_id: 8,
  balcao_id: null,
  pessoa_id: pessoa.pessoa_id,
  produto_id: produtoBar.produto_id,
  name: produtoBar.name,
  price: produtoBar.price,
  quantidade: 1,
  observacao: "",
  destino_producao: "bar" as const,
  status: "novo" as const,
  funcionario_id: sessaoGerencia.funcionario.funcionario_id,
  funcionario_nome: sessaoGerencia.funcionario.funcionario_nome,
  funcionario_perfil: sessaoGerencia.funcionario.funcionario_perfil,
  criado_em: agora,
  enviado_em: null,
  atualizado_em: agora,
};
const itemCozinha = {
  ...itemBar,
  item_id: "i-cozinha-impressao",
  produto_id: produtoCozinha.produto_id,
  name: produtoCozinha.name,
  price: produtoCozinha.price,
  destino_producao: "cozinha" as const,
};
const aberta = await gerencia.comanda.persistir({
  versao: estadoInicial.versao,
  acao: "abrir_mesa",
  entidadeId: "8",
  estado: {
    ...estadoInicial.estado,
    mesas: estadoInicial.estado.mesas.map((mesa) =>
      mesa.mesa_id === 8
        ? {
            ...mesa,
            status: "ocupada" as const,
            ativa: true,
            atendimento_id: "at-impressao",
            abertaEm: agora,
            garcom_id: "f-gerencia",
          }
        : mesa,
    ),
  },
});
const comRascunho = await gerencia.comanda.persistir({
  versao: aberta.versao,
  acao: "alterar_comanda",
  entidadeId: "8",
  estado: {
    ...estadoInicial.estado,
    mesas: aberta.versao
      ? (await gerencia.comanda.estado()).estado.mesas
      : estadoInicial.estado.mesas,
    pessoas: [pessoa],
    itens: [itemBar, itemCozinha],
  },
});
const pedidoId = "p-impressao";
const enviado = await gerencia.comanda.persistir({
  versao: comRascunho.versao,
  acao: "enviar_pedido",
  entidadeId: "8",
  estado: {
    ...(await gerencia.comanda.estado()).estado,
    itens: [
      { ...itemBar, pedido_id: pedidoId, status: "enviado" as const, enviado_em: agora },
      { ...itemCozinha, pedido_id: pedidoId, status: "enviado" as const, enviado_em: agora },
    ],
    tickets: [
      {
        ...ticketTeste,
        ticket_id: "t-bar-impressao",
        pedido_id: pedidoId,
        atendimento_id: "at-impressao",
        mesa_id: 8,
        balcao_id: null,
        destino_producao: "bar",
        linhas: [
          {
            item_id: itemBar.item_id,
            produto_id: itemBar.produto_id,
            name: itemBar.name,
            qty: 1,
            pessoa: pessoa.nome,
            observacao: "",
          },
        ],
        itemIds: [itemBar.item_id],
        funcionario_id: "f-gerencia",
        funcionario_nome: "Gerência",
        criado_em: agora,
        enviado_em: agora,
        atualizado_em: agora,
      },
      {
        ...ticketTeste,
        ticket_id: "t-cozinha-impressao",
        pedido_id: pedidoId,
        atendimento_id: "at-impressao",
        mesa_id: 8,
        balcao_id: null,
        destino_producao: "cozinha",
        linhas: [
          {
            item_id: itemCozinha.item_id,
            produto_id: itemCozinha.produto_id,
            name: itemCozinha.name,
            qty: 1,
            pessoa: pessoa.nome,
            observacao: "",
          },
        ],
        itemIds: [itemCozinha.item_id],
        funcionario_id: "f-gerencia",
        funcionario_nome: "Gerência",
        criado_em: agora,
        enviado_em: agora,
        atualizado_em: agora,
      },
    ],
  },
});
assert.equal(enviado.versao, comRascunho.versao + 1);

async function esperarFila(
  referenciaId: string,
  status: "falhou" | "sem_configuracao",
) {
  for (let tentativa = 0; tentativa < 30; tentativa += 1) {
    const estado = await gerencia.comanda.estado();
    const fila = estado.impressoes.find((item) => item.referencia_id === referenciaId);
    if (fila?.status === status) return fila;
    await Bun.sleep(100);
  }
  throw new Error(`A impressão ${referenciaId} não chegou ao estado ${status}.`);
}

const filaBar = await esperarFila("t-bar-impressao", "falhou");
const filaCozinha = await esperarFila("t-cozinha-impressao", "sem_configuracao");
assert.equal(filaBar.destino, "bar");
assert.equal(filaCozinha.destino, "cozinha");
assert.equal(
  (await gerencia.comanda.estado()).estado.itens.filter((item) => item.status === "enviado").length,
  2,
);

const reservaLocal = await gerencia.impressao.impressaoLocalReservar({
  destino: "cozinha",
});
assert.equal(reservaLocal.impressao?.impressao_id, filaCozinha.impressao_id);
const reservaDuplicada = await gerencia.impressao.impressaoLocalReservar({
  destino: "cozinha",
});
assert.equal(reservaDuplicada.impressao, null);
assert.deepEqual(
  await gerencia.impressao.impressaoLocalConcluir({
    impressaoId: filaCozinha.impressao_id,
    sucesso: false,
    erro: "Falha simulada no dispositivo local.",
  }),
  { ok: true },
);
const retryLocal = await gerencia.impressao.impressaoLocalReservar({
  destino: "cozinha",
});
assert.equal(retryLocal.impressao?.impressao_id, filaCozinha.impressao_id);
assert.deepEqual(
  await gerencia.impressao.impressaoLocalConcluir({
    impressaoId: filaCozinha.impressao_id,
    sucesso: true,
  }),
  { ok: true },
);
assert.equal(
  (await gerencia.impressao.impressaoLocalReservar({ destino: "cozinha" })).impressao,
  null,
);

const antesFechamento = await gerencia.comanda.estado();
const subtotal = produtoBar.price + produtoCozinha.price;
const servico = Math.round(subtotal * 100 * 0.1) / 100;
const total = subtotal + servico;
const fechamentoId = "f-impressao";
const fechamento = await gerencia.comanda.persistir({
  versao: antesFechamento.versao,
  acao: "fechar_conta",
  entidadeId: "8",
  estado: {
    ...antesFechamento.estado,
    mesas: antesFechamento.estado.mesas.map((mesa) =>
      mesa.mesa_id === 8
        ? {
            ...mesa,
            status: "livre" as const,
            ativa: false,
            atendimento_id: null,
            contaSolicitada: false,
            abertaEm: null,
            garcom_id: null,
            servicoIncluso: true,
            pessoasFixas: 0,
            totalFixo: 0,
          }
        : mesa,
    ),
    pessoas: [],
    itens: [],
    tickets: [],
    fechamentos: [
      {
        organizacao_id: "valhalla",
        fechamento_id: fechamentoId,
        atendimento_id: "at-impressao",
        mesa_id: 8,
        balcao_id: null,
        hora: "12:00",
        subtotal,
        servico,
        total,
        servicoIncluso: true,
        divisao: [{ pessoa_id: pessoa.pessoa_id, pessoa: pessoa.nome, valor: total }],
        nfce: "nao_solicitada",
        funcionario_nome: "Gerência",
        garcom_nome: null,
      },
      ...antesFechamento.estado.fechamentos,
    ],
    anteriores: {},
  },
});
assert.equal(fechamento.versao, antesFechamento.versao + 1);
const filaCaixa = await esperarFila(fechamentoId, "sem_configuracao");
assert.equal(filaCaixa.destino, "caixa");
assert.equal(filaCaixa.tipo, "recibo");

await gerencia.impressao.impressoraSalvar({
  destino: "bar",
  nome: "Bar",
  host: "",
  porta: 9100,
  largura: 58,
  ativa: false,
});
const reimpressao = await producao.impressao.impressaoReimprimir({
  impressaoId: filaBar.impressao_id,
});
assert.equal(reimpressao.modo, "navegador");
assert.match(reimpressao.texto, /MESA 08/);

console.log("Impressão: serialização ESC/POS, roteamento, falha não bloqueante, fila e reimpressão aprovados.");
