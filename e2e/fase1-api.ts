import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

await prepararBancoTeste("fase1-api");
const { router } = await import("../packages/web/src/api");

const publico = createRouterClient(router, {
  context: { headers: new Headers() },
});

await assert.rejects(() => publico.auth.login({ organizacao: "valhalla", pin: "0000" }));

const sessaoGerencia = await publico.auth.login({
  organizacao: "valhalla",
  pin: PIN_GERENCIA_TESTE,
});
assert.equal(sessaoGerencia.funcionario.funcionario_perfil, "gerencia");

const gerencia = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoGerencia.token}` }),
  },
});

const inicial = await gerencia.comanda.estado();
assert.equal(inicial.organizacaoId, "valhalla");
assert.equal(inicial.estado.mesas.length, 15);
assert.equal(inicial.estado.itens.length, 0);
assert.equal(inicial.estado.pessoas.length, 0);
assert.equal(inicial.estado.tickets.length, 0);
assert.equal(inicial.estado.fechamentos.length, 0);
assert.equal("modoDemo" in inicial, false);
assert.equal(
  inicial.estado.mesas.every(
    (mesa) =>
      mesa.status === "livre" &&
      !mesa.ativa &&
      mesa.abertaEm === null &&
      mesa.garcom_id === null &&
      !("demonstracao" in mesa),
  ),
  true,
);
assert.equal(inicial.cardapio.length, 43);
assert.equal(inicial.produtos.length, 43);
assert.equal(inicial.funcionarios.length, 1);
assert.equal(inicial.funcionarios[0]?.funcionario_nome, "Gerência");
assert.equal(inicial.funcionarios[0]?.funcionario_perfil, "gerencia");
assert.equal(inicial.funcionarios[0]?.ativo, true);
assert.equal(inicial.cardapio.find((produto) => produto.produto_id === "m1")?.name, "CHOOP PIL 500ML");
assert.equal(inicial.cardapio.find((produto) => produto.produto_id === "real-monster")?.price, 18);

const produtoInicial = inicial.produtos.find((produto) => produto.produto_id === "m1");
assert.ok(produtoInicial);
await gerencia.comanda.produtoSalvar({ ...produtoInicial, ativo: false });
const produtoDesativado = await gerencia.comanda.estado();
assert.equal(
  produtoDesativado.cardapio.some((produto) => produto.produto_id === "m1"),
  false,
);
assert.equal(
  produtoDesativado.produtos.find((produto) => produto.produto_id === "m1")?.ativo,
  false,
);
await gerencia.comanda.produtoSalvar({ ...produtoInicial, ativo: true });

const contas = [
  {
    funcionarioId: "f-atendimento",
    nome: "Atendimento",
    perfil: "garcom" as const,
    pin: "5274",
    ativo: true,
  },
  {
    funcionarioId: "f-producao",
    nome: "Produção",
    perfil: "producao" as const,
    pin: "6385",
    ativo: true,
  },
  {
    funcionarioId: "f-caixa",
    nome: "Caixa",
    perfil: "caixa" as const,
    pin: "7496",
    ativo: true,
  },
];
for (const conta of contas) await gerencia.comanda.funcionarioSalvar(conta);

const logins = [
  sessaoGerencia,
  await publico.auth.login({ organizacao: "valhalla", pin: contas[0].pin }),
  await publico.auth.login({ organizacao: "valhalla", pin: contas[1].pin }),
  await publico.auth.login({ organizacao: "valhalla", pin: contas[2].pin }),
];
assert.deepEqual(
  logins.map((sessao) => sessao.funcionario.funcionario_perfil),
  ["gerencia", "garcom", "producao", "caixa"],
);

const garcom = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${logins[1].token}` }),
  },
});
const sessaoRevogavel = await publico.auth.login({
  organizacao: "valhalla",
  pin: contas[2].pin,
});
const clienteRevogavel = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoRevogavel.token}` }),
  },
});
await clienteRevogavel.auth.logout();
await assert.rejects(() => clienteRevogavel.comanda.estado());

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
          atendimento_id: "at-fase1-api",
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
const pessoa = {
  pessoa_id: "m1-api",
  nome: "Teste API",
  atendimento_id: "at-fase1-api",
  mesa_id: 1,
  balcao_id: null,
};
const item = {
  organizacao_id: "valhalla",
  item_id: "i-api",
  pedido_id: null,
  atendimento_id: "at-fase1-api",
  mesa_id: 1,
  balcao_id: null,
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
        atendimento_id: "at-fase1-api",
        mesa_id: 1,
        balcao_id: null,
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

const persistido = await gerencia.comanda.estado();
assert.equal(persistido.estado.mesas.find((mesa) => mesa.mesa_id === 1)?.ativa, true);
assert.equal(persistido.estado.mesas.length, 16);
assert.equal(persistido.configuracao.larguraRecibo, 58);
assert.equal(persistido.versao, configurada.versao);

await gerencia.comanda.funcionarioSalvar({
  funcionarioId: contas[0].funcionarioId,
  nome: "Atendimento principal",
  perfil: "garcom",
  ativo: true,
});
let equipe = await gerencia.comanda.estado();
assert.equal(
  equipe.funcionarios.find(
    (funcionario) => funcionario.funcionario_id === contas[0].funcionarioId,
  )?.funcionario_nome,
  "Atendimento principal",
);

await gerencia.comanda.funcionarioSalvar({
  funcionarioId: contas[0].funcionarioId,
  nome: "Atendimento principal",
  perfil: "garcom",
  pin: "5318",
  ativo: true,
});
await assert.rejects(() =>
  publico.auth.login({ organizacao: "valhalla", pin: contas[0].pin }),
);
assert.equal(
  (
    await publico.auth.login({
      organizacao: "valhalla",
      pin: "5318",
    })
  ).funcionario.funcionario_id,
  contas[0].funcionarioId,
);

await gerencia.comanda.funcionarioSalvar({
  funcionarioId: contas[0].funcionarioId,
  nome: "Atendimento principal",
  perfil: "garcom",
  ativo: false,
});
await assert.rejects(() =>
  publico.auth.login({ organizacao: "valhalla", pin: "5318" }),
);
equipe = await gerencia.comanda.estado();
assert.equal(
  equipe.funcionarios.find(
    (funcionario) => funcionario.funcionario_id === contas[0].funcionarioId,
  )?.ativo,
  false,
);

await gerencia.comanda.pinAlterar({
  pinAtual: PIN_GERENCIA_TESTE,
  pinNovo: "9753",
});
await assert.rejects(() =>
  publico.auth.login({
    organizacao: "valhalla",
    pin: PIN_GERENCIA_TESTE,
  }),
);
assert.equal(
  (
    await publico.auth.login({
      organizacao: "valhalla",
      pin: "9753",
    })
  ).funcionario.funcionario_perfil,
  "gerencia",
);

console.log(
  "Fase 1 API: bootstrap operacional, autenticação, PINs, equipe, cardápio e persistência aprovados.",
);
