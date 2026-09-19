import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

await prepararBancoTeste("tenant-isolation");
const [{ db }, schema, { gerarHashPin }, { router }] = await Promise.all([
  import("../packages/web/src/api/database"),
  import("../packages/web/src/api/database/schema"),
  import("../packages/web/src/api/lib/security"),
  import("../packages/web/src/api"),
]);
const { cardapio, funcionarios, mesas, organizacoes, versoesEstado } = schema;

const publico = createRouterClient(router, {
  context: { headers: new Headers() },
});
const valhalla = await publico.auth.login({
  organizacao: "valhalla",
  pin: PIN_GERENCIA_TESTE,
});
const instante = new Date().toISOString();

await db.transaction(async (tx) => {
  await tx.insert(organizacoes).values({
    organizacaoId: "odin",
    codigo: "odin",
    nome: "Odin",
    quantidadeMesas: 1,
    larguraRecibo: 80,
    criadoEm: instante,
    atualizadoEm: instante,
  });
  await tx.insert(versoesEstado).values({
    organizacaoId: "odin",
    versao: 1,
    atualizadoEm: instante,
  });
  await tx.insert(funcionarios).values({
    organizacaoId: "odin",
    funcionarioId: "f-odin",
    nome: "Gestor Odin",
    perfil: "gerencia",
    pinHash: await gerarHashPin("5555"),
    ativo: true,
    criadoEm: instante,
    atualizadoEm: instante,
  });
  await tx.insert(mesas).values({
    organizacaoId: "odin",
    mesaId: 1,
    status: "livre",
    ativa: false,
    pessoasFixas: 0,
    totalFixoCentavos: 0,
    abertaEm: null,
    garcomId: null,
    contaSolicitada: false,
    servicoIncluso: true,
  });
  await tx.insert(cardapio).values({
    organizacaoId: "odin",
    produtoId: "odin-agua",
    nome: "Água Odin",
    precoCentavos: 500,
    destinoProducao: "bar",
    categoria: "Bebidas sem álcool",
    ativo: true,
  });
});

const origemBloqueada = createRouterClient(router, {
  context: { headers: new Headers({ "x-real-ip": "203.0.113.10" }) },
});
for (let tentativa = 0; tentativa < 8; tentativa += 1) {
  await assert.rejects(() =>
    origemBloqueada.auth.login({ organizacao: "odin", pin: "0000" }),
  );
}
await assert.rejects(() =>
  origemBloqueada.auth.login({ organizacao: "odin", pin: "5555" }),
);
const origemAlternativa = createRouterClient(router, {
  context: { headers: new Headers({ "x-real-ip": "203.0.113.11" }) },
});
const odin = await origemAlternativa.auth.login({ organizacao: "odin", pin: "5555" });
const clienteValhalla = createRouterClient(router, {
  context: { headers: new Headers({ authorization: `Bearer ${valhalla.token}` }) },
});
const clienteOdin = createRouterClient(router, {
  context: { headers: new Headers({ authorization: `Bearer ${odin.token}` }) },
});

const estadoValhalla = await clienteValhalla.comanda.estado();
const estadoOdin = await clienteOdin.comanda.estado();
assert.equal(estadoValhalla.organizacaoId, "valhalla");
assert.equal(estadoOdin.organizacaoId, "odin");
assert.equal(estadoOdin.estado.mesas.length, 1);
assert.equal(estadoOdin.cardapio.some((produto) => produto.produto_id === "m1"), false);
assert.equal(
  estadoValhalla.cardapio.some((produto) => produto.produto_id === "odin-agua"),
  false,
);

await assert.rejects(() =>
  clienteOdin.comanda.persistir({
    versao: estadoOdin.versao,
    acao: "abrir_mesa",
    entidadeId: "1",
    estado: {
      ...estadoOdin.estado,
      mesas: estadoOdin.estado.mesas.map((mesa) => ({
        ...mesa,
        organizacao_id: "valhalla",
      })),
    },
  }),
);

const aberta = await clienteOdin.comanda.persistir({
  versao: estadoOdin.versao,
  acao: "abrir_mesa",
  entidadeId: "1",
  estado: {
    ...estadoOdin.estado,
    mesas: estadoOdin.estado.mesas.map((mesa) => ({
      ...mesa,
      status: "ocupada" as const,
      ativa: true,
      abertaEm: instante,
      garcom_id: odin.funcionario.funcionario_id,
    })),
  },
});
assert.equal(aberta.versao, estadoOdin.versao + 1);
assert.equal(
  (await clienteValhalla.comanda.estado()).estado.mesas.find(
    (mesa) => mesa.mesa_id === 1,
  )?.ativa,
  false,
);

console.log("Isolamento multi-tenant e limite de tentativas de PIN aprovados.");
