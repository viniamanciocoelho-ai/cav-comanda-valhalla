import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { prepararBancoTeste } from "./test-database";

await prepararBancoTeste("historico-persistencia");
const [{ router }, { db }, { fechamentos }] = await Promise.all([
  import("../packages/web/src/api"),
  import("../packages/web/src/api/database"),
  import("../packages/web/src/api/database/schema"),
]);

const publico = createRouterClient(router, {
  context: { headers: new Headers({ "x-real-ip": "203.0.113.20" }) },
});
const sessao = await publico.auth.login({ organizacao: "valhalla", pin: "1111" });
const cliente = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessao.token}` }),
  },
});
const funcionario = sessao.funcionario;

let leitura = await cliente.comanda.estado();
const instante = new Date().toISOString();
let resultado = await cliente.comanda.persistir({
  versao: leitura.versao,
  acao: "abrir_mesa",
  entidadeId: "1",
  estado: {
    ...leitura.estado,
    mesas: leitura.estado.mesas.map((mesa) =>
      mesa.mesa_id === 1
        ? {
            ...mesa,
            status: "ocupada" as const,
            ativa: true,
            abertaEm: instante,
            garcom_id: funcionario.funcionario_id,
          }
        : mesa,
    ),
  },
});

leitura = await cliente.comanda.estado();
const produto = leitura.cardapio.find((item) => item.produto_id === "m1");
assert.ok(produto);
const pessoa = { pessoa_id: "m1-historico", nome: "Histórico", mesa_id: 1 };
const item = {
  organizacao_id: leitura.organizacaoId,
  item_id: "i-historico",
  pedido_id: null,
  mesa_id: 1,
  pessoa_id: pessoa.pessoa_id,
  produto_id: produto.produto_id,
  name: produto.name,
  price: produto.price,
  quantidade: 1,
  observacao: "",
  destino_producao: produto.destino_producao,
  status: "novo" as const,
  funcionario_id: funcionario.funcionario_id,
  funcionario_nome: funcionario.funcionario_nome,
  funcionario_perfil: funcionario.funcionario_perfil,
  criado_em: instante,
  enviado_em: null,
  atualizado_em: instante,
};
resultado = await cliente.comanda.persistir({
  versao: resultado.versao,
  acao: "alterar_comanda",
  entidadeId: "1",
  estado: {
    ...leitura.estado,
    pessoas: [...leitura.estado.pessoas, pessoa],
    itens: [...leitura.estado.itens, item],
  },
});

leitura = await cliente.comanda.estado();
const pedidoId = "pd-historico";
const ticket = {
  organizacao_id: leitura.organizacaoId,
  ticket_id: "t-historico",
  pedido_id: pedidoId,
  mesa_id: 1,
  destino_producao: produto.destino_producao,
  status: "enviado" as const,
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
  funcionario_id: funcionario.funcionario_id,
  funcionario_nome: funcionario.funcionario_nome,
  criado_em: instante,
  enviado_em: instante,
  atualizado_em: instante,
};
resultado = await cliente.comanda.persistir({
  versao: resultado.versao,
  acao: "enviar_pedido",
  entidadeId: "1",
  estado: {
    ...leitura.estado,
    itens: leitura.estado.itens.map((registro) =>
      registro.item_id === item.item_id
        ? {
            ...registro,
            pedido_id: pedidoId,
            status: "enviado" as const,
            enviado_em: instante,
            atualizado_em: instante,
          }
        : registro,
    ),
    tickets: [ticket, ...leitura.estado.tickets],
  },
});

for (const status of ["preparando", "pronto"] as const) {
  leitura = await cliente.comanda.estado();
  resultado = await cliente.comanda.persistir({
    versao: resultado.versao,
    acao: "mover_producao",
    entidadeId: ticket.ticket_id,
    estado: {
      ...leitura.estado,
      itens: leitura.estado.itens.map((registro) =>
        registro.item_id === item.item_id
          ? { ...registro, status, atualizado_em: new Date().toISOString() }
          : registro,
      ),
      tickets: leitura.estado.tickets.map((registro) =>
        registro.ticket_id === ticket.ticket_id
          ? { ...registro, status, atualizado_em: new Date().toISOString() }
          : registro,
      ),
    },
  });
}

leitura = await cliente.comanda.estado();
resultado = await cliente.comanda.persistir({
  versao: resultado.versao,
  acao: "entregar_item",
  entidadeId: item.item_id,
  estado: {
    ...leitura.estado,
    itens: leitura.estado.itens.map((registro) =>
      registro.item_id === item.item_id
        ? { ...registro, status: "entregue" as const, atualizado_em: new Date().toISOString() }
        : registro,
    ),
    tickets: leitura.estado.tickets.map((registro) =>
      registro.ticket_id === ticket.ticket_id
        ? { ...registro, status: "entregue" as const, atualizado_em: new Date().toISOString() }
        : registro,
    ),
  },
});

leitura = await cliente.comanda.estado();
const fechamentoId = "f-historico";
resultado = await cliente.comanda.persistir({
  versao: resultado.versao,
  acao: "fechar_conta",
  entidadeId: "1",
  estado: {
    ...leitura.estado,
    mesas: leitura.estado.mesas.map((mesa) =>
      mesa.mesa_id === 1
        ? {
            ...mesa,
            status: "livre" as const,
            ativa: false,
            abertaEm: null,
            garcom_id: null,
            contaSolicitada: false,
            servicoIncluso: true,
            pessoasFixas: 0,
            totalFixo: 0,
          }
        : mesa,
    ),
    pessoas: leitura.estado.pessoas.filter((registro) => registro.mesa_id !== 1),
    itens: leitura.estado.itens.filter((registro) => registro.mesa_id !== 1),
    tickets: leitura.estado.tickets.filter((registro) => registro.mesa_id !== 1),
    fechamentos: [
      {
        organizacao_id: leitura.organizacaoId,
        fechamento_id: fechamentoId,
        mesa_id: 1,
        hora: "20:00",
        subtotal: 15,
        servico: 1.5,
        total: 16.5,
        servicoIncluso: true,
        divisao: [{ pessoa_id: pessoa.pessoa_id, pessoa: pessoa.nome, valor: 16.5 }],
        nfce: "nao_solicitada" as const,
        funcionario_nome: funcionario.funcionario_nome,
        garcom_nome: funcionario.funcionario_nome,
      },
      ...leitura.estado.fechamentos,
    ],
  },
});

const antes = (await db.select().from(fechamentos)).find(
  (registro) => registro.fechamentoId === fechamentoId,
);
assert.ok(antes);
await Bun.sleep(20);

leitura = await cliente.comanda.estado();
await cliente.comanda.persistir({
  versao: resultado.versao,
  acao: "abrir_mesa",
  entidadeId: "2",
  estado: {
    ...leitura.estado,
    mesas: leitura.estado.mesas.map((mesa) =>
      mesa.mesa_id === 2
        ? {
            ...mesa,
            status: "ocupada" as const,
            ativa: true,
            abertaEm: new Date().toISOString(),
            garcom_id: funcionario.funcionario_id,
          }
        : mesa,
    ),
  },
});
const depois = (await db.select().from(fechamentos)).find(
  (registro) => registro.fechamentoId === fechamentoId,
);
assert.equal(depois?.criadoEm, antes.criadoEm);

console.log("Histórico financeiro preserva o timestamp após novas operações.");
