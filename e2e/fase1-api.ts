import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { router } from "../packages/web/src/api";

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

const inicial = await gerencia.comanda.estado();
assert.equal(inicial.organizacaoId, "valhalla");
assert.equal(inicial.estado.mesas.length, 15);
assert.equal(inicial.estado.itens.length, 0);
assert.equal(inicial.estado.pessoas.length, 0);
assert.equal(inicial.modoDemo, false);

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

await assert.rejects(() =>
  garcom.comanda.persistir({
    versao: inicial.versao,
    acao: "abrir_mesa",
    entidadeId: "1",
    estado: aberto,
  }),
);

await assert.rejects(() =>
  garcom.comanda.configurar({ quantidadeMesas: 20, larguraRecibo: 80 }),
);
await assert.rejects(() =>
  gerencia.comanda.persistir({
    versao: primeira.versao,
    acao: "reiniciar",
    estado: inicial.estado,
  }),
);

const persistido = await gerencia.comanda.estado();
assert.equal(persistido.estado.mesas.find((mesa) => mesa.mesa_id === 1)?.ativa, true);
assert.equal(persistido.versao, primeira.versao);

console.log("Fase 1 API: 14 verificações aprovadas.");
