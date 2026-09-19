import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { prepararBancoTeste } from "./test-database";

await prepararBancoTeste("fase1-api");
const { router } = await import("../packages/web/src/api");

const publico = createRouterClient(router, {
  context: { headers: new Headers() },
});

await assert.rejects(() => publico.auth.login({ organizacao: "valhalla", pin: "0000" }));

const logins = await Promise.all(
  [
    ["1111", "gerencia"],
    ["2222", "garcom"],
    ["3333", "producao"],
    ["4444", "caixa"],
  ].map(async ([pin, perfil]) => {
    const sessao = await publico.auth.login({ organizacao: "valhalla", pin });
    assert.equal(sessao.funcionario.funcionario_perfil, perfil);
    return sessao;
  }),
);

const gerencia = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${logins[0].token}` }),
  },
});
const garcom = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${logins[1].token}` }),
  },
});
const sessaoRevogavel = await publico.auth.login({ organizacao: "valhalla", pin: "4444" });
const clienteRevogavel = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoRevogavel.token}` }),
  },
});
await clienteRevogavel.auth.logout();
await assert.rejects(() => clienteRevogavel.comanda.estado());

const inicial = await gerencia.comanda.estado();
assert.equal(inicial.organizacaoId, "valhalla");
assert.equal(inicial.estado.mesas.length, 15);
assert.equal(inicial.estado.itens.length, 0);
assert.equal(inicial.estado.pessoas.length, 0);
assert.equal(inicial.modoDemo, false);
assert.equal(inicial.cardapio.length, 43);
assert.equal(inicial.cardapio.find((produto) => produto.produto_id === "m1")?.name, "CHOOP PIL 500ML");
assert.equal(inicial.cardapio.find((produto) => produto.produto_id === "real-monster")?.price, 18);

const mesa1 = inicial.estado.mesas.find((mesa) => mesa.mesa_id === 1);
assert.ok(mesa1);
const aberto = {
  ...inicial.estado,
  mesas: inicial.estado.mesas.map((mesa) =>
    mesa.mesa_id === 1
      ? {
          ...mesa,
          status: "ocupada" as const,
          ativa: true,
          abertaEm: new Date().toISOString(),
          garcom_id: logins[1].funcionario.funcionario_id,
        }
      : mesa,
  ),
};
const primeira = await garcom.comanda.persistir({
  versao: inicial.versao,
  acao: "abrir_mesa",
  entidadeId: "1",
  estado: aberto,
});
assert.equal(primeira.versao, inicial.versao + 1);

const aposAbertura = await garcom.comanda.estado();
const agora = new Date().toISOString();
const produto = aposAbertura.cardapio.find((registro) => registro.produto_id === "m1");
assert.ok(produto);
const pessoa = { pessoa_id: "m1-api", nome: "Teste API", mesa_id: 1 };
const item = {
  organizacao_id: "valhalla",
  item_id: "i-api",
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
  funcionario_id: logins[1].funcionario.funcionario_id,
  funcionario_nome: logins[1].funcionario.funcionario_nome,
  funcionario_perfil: logins[1].funcionario.funcionario_perfil,
  criado_em: agora,
  enviado_em: null,
  atualizado_em: agora,
};
const comRascunho = await garcom.comanda.persistir({
  versao: aposAbertura.versao,
  acao: "alterar_comanda",
  entidadeId: "1",
  estado: {
    ...aposAbertura.estado,
    pessoas: [...aposAbertura.estado.pessoas, pessoa],
    itens: [...aposAbertura.estado.itens, item],
  },
});
const pedidoId = "pd-api";
const enviado = await garcom.comanda.persistir({
  versao: comRascunho.versao,
  acao: "enviar_pedido",
  entidadeId: "1",
  estado: {
    ...aposAbertura.estado,
    pessoas: [...aposAbertura.estado.pessoas, pessoa],
    itens: [
      ...aposAbertura.estado.itens,
      {
        ...item,
        pedido_id: pedidoId,
        status: "enviado" as const,
        enviado_em: agora,
        atualizado_em: agora,
      },
    ],
    tickets: [
      {
        organizacao_id: "valhalla",
        ticket_id: "t-api",
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
        funcionario_id: logins[1].funcionario.funcionario_id,
        funcionario_nome: logins[1].funcionario.funcionario_nome,
        criado_em: agora,
        enviado_em: agora,
        atualizado_em: agora,
      },
      ...aposAbertura.estado.tickets,
    ],
  },
});
assert.equal(enviado.versao, comRascunho.versao + 1);

await assert.rejects(() =>
  garcom.comanda.persistir({
    versao: inicial.versao,
    acao: "abrir_mesa",
    entidadeId: "1",
    estado: aberto,
  }),
);

await assert.rejects(() =>
  garcom.comanda.configurar({
    versao: enviado.versao,
    quantidadeMesas: 20,
    larguraRecibo: 80,
  }),
);
const configurada = await gerencia.comanda.configurar({
  versao: enviado.versao,
  quantidadeMesas: 16,
  larguraRecibo: 58,
});
assert.equal(configurada.versao, enviado.versao + 1);
await assert.rejects(() =>
  gerencia.comanda.persistir({
    versao: configurada.versao,
    acao: "reiniciar",
    estado: inicial.estado,
  }),
);

const persistido = await gerencia.comanda.estado();
assert.equal(persistido.estado.mesas.find((mesa) => mesa.mesa_id === 1)?.ativa, true);
assert.equal(persistido.estado.mesas.length, 16);
assert.equal(persistido.configuracao.larguraRecibo, 58);
assert.equal(persistido.versao, configurada.versao);

console.log("Fase 1 API: autenticação, persistência, envio e configuração aprovados.");
