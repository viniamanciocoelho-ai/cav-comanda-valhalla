import assert from "node:assert/strict";

process.env.DATABASE_URL = "file::memory:";
delete process.env.DATABASE_AUTH_TOKEN;
const { configuracaoBootstrap } = await import("../packages/web/src/api/lib/comanda-store");

const anterior = process.env.CAV_BOOTSTRAP_PIN_GERENCIA;
const organizacaoAnterior = process.env.CAV_ORGANIZACAO_CODIGO;
process.env.CAV_ORGANIZACAO_CODIGO = "valhalla";

delete process.env.CAV_BOOTSTRAP_PIN_GERENCIA;
assert.throws(
  () => configuracaoBootstrap(),
  /CAV_BOOTSTRAP_PIN_GERENCIA/,
  "o primeiro acesso não pode usar PIN padrão",
);

process.env.CAV_BOOTSTRAP_PIN_GERENCIA = "8462";
assert.equal(configuracaoBootstrap().pinGerencia, "8462");

if (anterior === undefined) delete process.env.CAV_BOOTSTRAP_PIN_GERENCIA;
else process.env.CAV_BOOTSTRAP_PIN_GERENCIA = anterior;
if (organizacaoAnterior === undefined) delete process.env.CAV_ORGANIZACAO_CODIGO;
else process.env.CAV_ORGANIZACAO_CODIGO = organizacaoAnterior;

console.log("Bootstrap seguro: PIN da gerência é obrigatório e não possui default.");
