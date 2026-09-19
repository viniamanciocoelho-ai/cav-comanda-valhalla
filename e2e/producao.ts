import assert from "node:assert/strict";
import { validarConfiguracaoAmbiente } from "../packages/web/src/api/lib/configuracao";
import { prepararBancoTeste } from "./test-database";

const producao = {
  NODE_ENV: "production",
  DATABASE_URL: "libsql://banco.exemplo",
  DATABASE_AUTH_TOKEN: "token-seguro",
  CAV_ORGANIZACAO_CODIGO: "valhalla",
  CAV_BOOTSTRAP_PIN_GERENCIA: "8462",
  WEBSITE_URL: "https://comanda.exemplo.site",
  CAV_ALLOWED_ORIGINS: "https://painel.exemplo.site",
  CAV_TIMEZONE: "America/Cuiaba",
  PORT: "3000",
};

assert.throws(
  () => validarConfiguracaoAmbiente({ ...producao, DATABASE_URL: undefined }),
  /DATABASE_URL/,
);
assert.throws(
  () => validarConfiguracaoAmbiente({ ...producao, DATABASE_AUTH_TOKEN: undefined }),
  /DATABASE_AUTH_TOKEN/,
);
assert.throws(
  () => validarConfiguracaoAmbiente({ ...producao, CAV_ORGANIZACAO_CODIGO: undefined }),
  /CAV_ORGANIZACAO_CODIGO/,
);
assert.throws(
  () => validarConfiguracaoAmbiente({ ...producao, CAV_BOOTSTRAP_PIN_GERENCIA: "1234" }),
  /CAV_BOOTSTRAP_PIN_GERENCIA/,
);
assert.throws(
  () => validarConfiguracaoAmbiente({ ...producao, WEBSITE_URL: undefined }),
  /WEBSITE_URL/,
);
assert.throws(
  () => validarConfiguracaoAmbiente({ ...producao, WEBSITE_URL: "http://comanda.exemplo.site" }),
  /https/,
);
assert.throws(
  () => validarConfiguracaoAmbiente({ ...producao, CAV_TIMEZONE: "Fuso/Inexistente" }),
  /CAV_TIMEZONE/,
);
assert.equal(validarConfiguracaoAmbiente(producao).port, 3000);
assert.equal(
  validarConfiguracaoAmbiente({
    NODE_ENV: "development",
    DATABASE_URL: "file:./local.sqlite",
    CAV_ORGANIZACAO_CODIGO: "valhalla",
    CAV_BOOTSTRAP_PIN_GERENCIA: "8462",
  }).websiteUrl,
  undefined,
);

await prepararBancoTeste("producao");
const { verificarSaude } = await import("../packages/web/src/api/lib/health");
const saudavel = await verificarSaude(async () => ({ ok: true }));
assert.equal(saudavel.statusHttp, 200);
assert.equal(saudavel.corpo.database, "ok");

const indisponivel = await verificarSaude(async () => {
  throw new Error("libsql://usuario:segredo@host não respondeu");
});
assert.equal(indisponivel.statusHttp, 503);
assert.equal(indisponivel.corpo.database, "indisponivel");
assert.equal(JSON.stringify(indisponivel.corpo).includes("segredo"), false);

const { default: app } = await import("../packages/web/src/api");
const resposta = await app.fetch(new Request("http://localhost/api/health/ready"));
assert.equal(resposta.status, 200);
assert.equal((await resposta.json()).database, "ok");

console.log("produção: fail-fast de ambiente e saúde do banco aprovados");
