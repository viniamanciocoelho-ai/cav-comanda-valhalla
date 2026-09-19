import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { prepararBancoTeste } from "./test-database";

await prepararBancoTeste("demo-mode", true);
const { router } = await import("../packages/web/src/api");

const publico = createRouterClient(router, {
  context: { headers: new Headers() },
});
const sessao = await publico.auth.login({ organizacao: "valhalla", pin: "1111" });
const gerencia = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessao.token}` }),
  },
});
const estado = await gerencia.comanda.estado();

assert.equal(estado.modoDemo, true);
assert.equal(estado.estado.itens.length, 11);
assert.equal(estado.estado.pessoas.length > 0, true);
assert.equal(estado.cardapio.length, 43);

console.log("Modo demo: dados fictícios restritos ao banco temporário habilitado.");
