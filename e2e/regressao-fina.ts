import assert from "node:assert/strict";
import {
  aberturaId,
  avaliarSemConsumoDe,
  type Dados,
} from "../packages/web/src/web/components/comanda-provider";
import { hora, minutosDesde } from "../packages/web/src/web/lib/format";
import { funcionarios, podeAcessar } from "../packages/web/src/web/lib/perfis";
import type { Mesa } from "../packages/web/src/web/lib/types";

function mesa(extra: Partial<Mesa> = {}): Mesa {
  return {
    organizacao_id: "valhalla-teste",
    mesa_id: 7,
    status: "ocupada",
    ativa: true,
    pessoasFixas: 0,
    totalFixo: 0,
    abertaEm: new Date(Date.now() - 60_000).toISOString(),
    garcom_id: "f-rafael",
    contaSolicitada: false,
    servicoIncluso: true,
    ...extra,
  };
}

const rafael = funcionarios.find((funcionario) => funcionario.funcionario_id === "f-rafael");
assert.ok(rafael);

const dadosBase: Dados = {
  mesas: [mesa()],
  pessoas: [],
  itens: [],
  tickets: [],
  fechamentos: [],
  encerramentos: [],
  anteriores: {},
};

assert.equal(podeAcessar("garcom", "/mesa/8"), true);
assert.equal(podeAcessar("garcom", "/mesa/8/extra"), false);
assert.equal(podeAcessar("garcom", "/mesa-maliciosa"), false);
assert.equal(podeAcessar("caixa", "/fechamentos/segredo"), false);
assert.equal(podeAcessar("producao", "/producao-extra"), false);

assert.equal(
  avaliarSemConsumoDe(
    { ...dadosBase, mesas: [mesa({ ativa: true, status: "livre" })] },
    7,
    rafael,
  ).elegivel,
  false,
);
assert.equal(
  avaliarSemConsumoDe(
    { ...dadosBase, mesas: [mesa({ ativa: true, abertaEm: null })] },
    7,
    rafael,
  ).elegivel,
  false,
);

assert.equal(hora("nao-e-uma-data"), "--:--");
assert.equal(minutosDesde("nao-e-uma-data"), 0);
assert.notEqual(aberturaId(mesa()), aberturaId(mesa({ mesa_id: 8 })));

console.log("Regressao fina: 10 verificacoes aprovadas.");
