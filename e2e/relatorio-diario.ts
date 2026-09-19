import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

await prepararBancoTeste("relatorio-diario");
const { calcularRelatorioDiario } = await import(
  "../packages/web/src/api/lib/relatorio-diario"
);

const calculado = calcularRelatorioDiario(
  "2026-09-19",
  [
    {
      fechamentoId: "f1",
      mesaId: 1,
      hora: "10:00",
      totalCentavos: 550,
      servicoCentavos: 50,
      funcionarioNome: "Caixa",
    },
    {
      fechamentoId: "f2",
      mesaId: 2,
      hora: "11:00",
      totalCentavos: 550,
      servicoCentavos: 50,
      funcionarioNome: "Caixa",
    },
  ],
  [
    {
      fechamentoId: "f1",
      produtoId: "bar-1",
      nome: "Chope",
      precoCentavos: 500,
      quantidade: 1,
      destinoProducao: "bar",
    },
    {
      fechamentoId: "f2",
      produtoId: "cozinha-1",
      nome: "Porção",
      precoCentavos: 500,
      quantidade: 1,
      destinoProducao: "cozinha",
    },
  ],
  [],
  [],
);
assert.equal(calculado.faturamentoCentavos, 1_100);
assert.equal(calculado.ticketMedioCentavos, 550);
assert.equal(
  calculado.destinos.reduce((soma, destino) => soma + destino.totalCentavos, 0),
  calculado.faturamentoCentavos,
);

const vazio = calcularRelatorioDiario("2026-09-18", [], [], [], []);
assert.equal(vazio.mesasAtendidas, 0);
assert.equal(vazio.ticketMedioCentavos, 0);
assert.equal(vazio.destinos.reduce((soma, destino) => soma + destino.totalCentavos, 0), 0);

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
  funcionarioId: "garcom-relatorio",
  nome: "Garçom relatório",
  perfil: "garcom",
  pin: "5274",
  ativo: true,
});
const sessaoGarcom = await publico.auth.login({ organizacao: "valhalla", pin: "5274" });
const garcom = createRouterClient(router, {
  context: { headers: new Headers({ authorization: `Bearer ${sessaoGarcom.token}` }) },
});
await assert.rejects(() => garcom.relatorio.diario({ data: "2026-09-19" }));

const inicial = await gerencia.comanda.estado();
const produtoBar = inicial.cardapio.find((produto) => produto.destino_producao === "bar");
const produtoCozinha = inicial.cardapio.find((produto) => produto.destino_producao === "cozinha");
assert.ok(produtoBar);
assert.ok(produtoCozinha);
const agora = new Date().toISOString();
const pessoa = { pessoa_id: "p-relatorio", nome: "Cliente", mesa_id: 1 };
const itemBase = {
  organizacao_id: "valhalla",
  pedido_id: null,
  mesa_id: 1,
  pessoa_id: pessoa.pessoa_id,
  quantidade: 1,
  observacao: "",
  status: "novo" as const,
  funcionario_id: sessaoGerencia.funcionario.funcionario_id,
  funcionario_nome: sessaoGerencia.funcionario.funcionario_nome,
  funcionario_perfil: sessaoGerencia.funcionario.funcionario_perfil,
  criado_em: agora,
  enviado_em: null,
  atualizado_em: agora,
};
const itemCancelado = {
  ...itemBase,
  item_id: "item-cancelado",
  produto_id: produtoBar.produto_id,
  name: produtoBar.name,
  price: produtoBar.price,
  destino_producao: "bar" as const,
};
const itemFechado = {
  ...itemBase,
  item_id: "item-fechado",
  produto_id: produtoCozinha.produto_id,
  name: produtoCozinha.name,
  price: produtoCozinha.price,
  destino_producao: "cozinha" as const,
};

await gerencia.comanda.persistir({
  versao: inicial.versao,
  acao: "abrir_mesa",
  entidadeId: "1",
  estado: {
    ...inicial.estado,
    mesas: inicial.estado.mesas.map((mesa) =>
      mesa.mesa_id === 1
        ? {
            ...mesa,
            status: "ocupada" as const,
            ativa: true,
            abertaEm: agora,
            garcom_id: sessaoGerencia.funcionario.funcionario_id,
          }
        : mesa,
    ),
  },
});
let atual = await gerencia.comanda.estado();
await gerencia.comanda.persistir({
  versao: atual.versao,
  acao: "alterar_comanda",
  entidadeId: "1",
  estado: {
    ...atual.estado,
    pessoas: [pessoa],
    itens: [itemCancelado, itemFechado],
  },
});
atual = await gerencia.comanda.estado();
const pedidoId = "pedido-relatorio";
const tickets = [itemCancelado, itemFechado].map((item) => ({
  organizacao_id: "valhalla",
  ticket_id: `ticket-${item.item_id}`,
  pedido_id: pedidoId,
  mesa_id: 1,
  destino_producao: item.destino_producao,
  status: "enviado" as const,
  linhas: [
    {
      item_id: item.item_id,
      produto_id: item.produto_id,
      name: item.name,
      qty: 1,
      pessoa: pessoa.nome,
      observacao: "",
    },
  ],
  itemIds: [item.item_id],
  funcionario_id: sessaoGerencia.funcionario.funcionario_id,
  funcionario_nome: sessaoGerencia.funcionario.funcionario_nome,
  criado_em: agora,
  enviado_em: agora,
  atualizado_em: agora,
}));
await gerencia.comanda.persistir({
  versao: atual.versao,
  acao: "enviar_pedido",
  entidadeId: "1",
  estado: {
    ...atual.estado,
    itens: atual.estado.itens.map((item) => ({
      ...item,
      pedido_id: pedidoId,
      status: "enviado" as const,
      enviado_em: agora,
    })),
    tickets,
  },
});
atual = await gerencia.comanda.estado();
await gerencia.comanda.persistir({
  versao: atual.versao,
  acao: "solicitar_cancelamento",
  entidadeId: itemCancelado.item_id,
  estado: {
    ...atual.estado,
    itens: atual.estado.itens.map((item) =>
      item.item_id === itemCancelado.item_id
        ? { ...item, status: "cancelamento_solicitado" as const }
        : item,
    ),
    anteriores: { [itemCancelado.item_id]: "enviado" as const },
  },
});
atual = await gerencia.comanda.estado();
await gerencia.comanda.persistir({
  versao: atual.versao,
  acao: "decidir_cancelamento",
  entidadeId: itemCancelado.item_id,
  estado: {
    ...atual.estado,
    itens: atual.estado.itens.filter((item) => item.item_id !== itemCancelado.item_id),
    tickets: atual.estado.tickets
      .map((ticket) => ({
        ...ticket,
        linhas: ticket.linhas.filter((linha) => linha.item_id !== itemCancelado.item_id),
        itemIds: ticket.itemIds.filter((id) => id !== itemCancelado.item_id),
      }))
      .filter((ticket) => ticket.itemIds.length),
    anteriores: {},
  },
});
atual = await gerencia.comanda.estado();
const subtotalCentavos = Math.round(produtoCozinha.price * 100);
const servicoCentavos = Math.round(subtotalCentavos / 10);
const totalCentavos = subtotalCentavos + servicoCentavos;
await gerencia.comanda.persistir({
  versao: atual.versao,
  acao: "fechar_conta",
  entidadeId: "1",
  estado: {
    ...atual.estado,
    mesas: atual.estado.mesas.map((mesa) =>
      mesa.mesa_id === 1
        ? {
            ...mesa,
            status: "livre" as const,
            ativa: false,
            pessoasFixas: 0,
            totalFixo: 0,
            abertaEm: null,
            garcom_id: null,
            contaSolicitada: false,
          }
        : mesa,
    ),
    pessoas: [],
    itens: [],
    tickets: [],
    fechamentos: [
      {
        organizacao_id: "valhalla",
        fechamento_id: "fechamento-relatorio",
        mesa_id: 1,
        hora: "12:00",
        subtotal: subtotalCentavos / 100,
        servico: servicoCentavos / 100,
        total: totalCentavos / 100,
        servicoIncluso: true,
        divisao: [
          {
            pessoa_id: pessoa.pessoa_id,
            pessoa: pessoa.nome,
            valor: totalCentavos / 100,
          },
        ],
        nfce: "nao_solicitada",
        funcionario_nome: "Gerência",
        garcom_nome: null,
      },
      ...atual.estado.fechamentos,
    ],
  },
});

const db = createClient({ url: process.env.DATABASE_URL! });
try {
  assert.equal(
    (await db.execute("SELECT COUNT(*) AS total FROM itens_fechamento")).rows[0]?.total,
    1,
  );
  assert.equal(
    (await db.execute("SELECT COUNT(*) AS total FROM cancelamentos_autorizados")).rows[0]?.total,
    1,
  );
} finally {
  db.close();
}

const hoje = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Cuiaba",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const relatorio = await gerencia.relatorio.diario({ data: hoje });
assert.equal(relatorio.mesasAtendidas, 1);
assert.equal(relatorio.cancelamentos.length, 1);
assert.equal(relatorio.cancelamentos[0]?.autorizado_por_nome, "Gerência");
assert.equal(
  relatorio.destinos.reduce((soma, destino) => soma + destino.totalCentavos, 0),
  relatorio.faturamentoCentavos,
);
const impressao = await gerencia.relatorio.imprimir({ data: hoje });
assert.equal(impressao.modo, "navegador");
assert.match(impressao.texto ?? "", /FECHAMENTO DIARIO/);

console.log(
  "relatório diário: centavos, histórico, vazio, impressão e RBAC aprovados",
);
