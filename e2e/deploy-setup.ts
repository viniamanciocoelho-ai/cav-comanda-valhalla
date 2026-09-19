import { strict as assert } from "node:assert";
import {
  executarPreparacaoDeploy,
  mascararSegredos,
} from "../packages/web/scripts/deploy-setup";

const ordem: string[] = [];
const resultado = await executarPreparacaoDeploy({
  validarAmbiente() {
    ordem.push("ambiente");
  },
  async aplicarMigrations() {
    ordem.push("migrations");
    return 3;
  },
  async verificarBanco() {
    ordem.push("banco");
    return { statusHttp: 200 };
  },
});

assert.deepEqual(ordem, ["ambiente", "migrations", "banco"]);
assert.deepEqual(resultado, { migrationsAplicadas: 3, bancoRespondeu: true });

const etapasAposFalha: string[] = [];
await assert.rejects(
  executarPreparacaoDeploy({
    validarAmbiente() {
      etapasAposFalha.push("ambiente");
      throw new Error("DATABASE_URL ausente");
    },
    async aplicarMigrations() {
      etapasAposFalha.push("migrations");
      return 0;
    },
    async verificarBanco() {
      etapasAposFalha.push("banco");
      return { statusHttp: 200 };
    },
  }),
  /DATABASE_URL/,
);
assert.deepEqual(etapasAposFalha, ["ambiente"]);

await assert.rejects(
  executarPreparacaoDeploy({
    validarAmbiente() {},
    async aplicarMigrations() {
      return 0;
    },
    async verificarBanco() {
      return { statusHttp: 503 };
    },
  }),
  /não respondeu/,
);

process.env.DATABASE_AUTH_TOKEN = "token-super-secreto";
assert.equal(
  mascararSegredos("falha com token-super-secreto"),
  "falha com [SEGREDO_OCULTO]",
);
delete process.env.DATABASE_AUTH_TOKEN;

console.log("deploy-setup: ordem, interrupcao e readiness aprovados");
