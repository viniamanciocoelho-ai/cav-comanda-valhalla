import assert from "node:assert/strict";
import { configuracaoBootstrap } from "../packages/web/src/api/lib/comanda-store";

const anterior = process.env.CAV_BOOTSTRAP_PIN_GERENCIA;

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

console.log("Bootstrap seguro: PIN da gerência é obrigatório e não possui default.");
