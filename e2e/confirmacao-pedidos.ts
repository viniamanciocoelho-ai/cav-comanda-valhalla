import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import {
  confirmarAlteracao,
  ResultadoAlteracaoDesconhecidoError,
} from "../packages/web/src/web/lib/persistencia";
import { compartilhadoId } from "../packages/web/src/web/lib/operacao";
import type { Dados } from "../packages/web/src/web/components/comanda-provider";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

await prepararBancoTeste("confirmacao-pedidos");
const { router } = await import("../packages/web/src/api");

const publico = createRouterClient(router, {
  context: { headers: new Headers() },
});
const sessaoGerencia = await publico.auth.login({
  organizacao: "valhalla",
  pin: PIN_GERENCIA_TESTE,
});
const gerencia = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoGerencia.token}` }),
  },
});

await gerencia.comanda.funcionarioSalvar({
  funcionarioId: "garcom-concorrente",
  nome: "Garcom concorrente",
  perfil: "garcom",
  pin: "5274",
  ativo: true,
});
const sessaoGarcom = await publico.auth.login({
  organizacao: "valhalla",
  pin: "5274",
});
const garcom = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoGarcom.token}` }),
  },
});

const inicial = await gerencia.comanda.estado();
const atendimentoId = "at-confirmacao-m1";
const abertaEm = "2026-09-23T21:00:00.000Z";
const aberta: Dados = {
  ...inicial.estado,
  mesas: inicial.estado.mesas.map((mesa) =>
    mesa.mesa_id === 1
      ? {
          ...mesa,
          atendimento_id: atendimentoId,
          status: "ocupada",
          ativa: true,
          abertaEm,
          garcom_id: sessaoGerencia.funcionario.funcionario_id,
        }
      : mesa,
  ),
};
const abertura = await gerencia.comanda.persistir({
  versao: inicial.versao,
  acao: "abrir_mesa",
  entidadeId: "1",
  estado: aberta,
});

const outraAbertura: Dados = {
  ...inicial.estado,
  mesas: inicial.estado.mesas.map((mesa) =>
    mesa.mesa_id === 2
      ? {
          ...mesa,
          atendimento_id: "at-concorrente-m2",
          status: "ocupada",
          ativa: true,
          abertaEm,
          garcom_id: sessaoGerencia.funcionario.funcionario_id,
        }
      : mesa,
  ),
};
await assert.rejects(
  gerencia.comanda.persistir({
    versao: inicial.versao,
    acao: "abrir_mesa",
    entidadeId: "2",
    estado: outraAbertura,
  }),
  (erro: { code?: string }) => erro.code === "CONFLICT",
  "versao obsoleta deve ser conflito antes da validacao de transicao",
);
const aberturaReconciliada = await confirmarAlteracao({
  alteracao: {
    operacaoId: "op-mesa2",
    versao: inicial.versao,
    acao: "abrir_mesa",
    entidadeId: "2",
    antes: inicial.estado,
    depois: outraAbertura,
  },
  persistir: (entrada) => gerencia.comanda.persistir(entrada),
  carregarEstado: () => gerencia.comanda.estado(),
});
assert.equal(aberturaReconciliada.reconciliado, true);
assert.equal(aberturaReconciliada.versao, abertura.versao + 1);
assert.deepEqual(
  (await gerencia.comanda.estado()).estado.mesas
    .filter((mesa) => mesa.ativa)
    .map((mesa) => mesa.mesa_id)
    .sort(),
  [1, 2],
);

const baseGerencia = await gerencia.comanda.estado();
const baseGarcom = await garcom.comanda.estado();
assert.equal(baseGerencia.versao, aberturaReconciliada.versao);
assert.equal(baseGarcom.versao, aberturaReconciliada.versao);
const produto = baseGerencia.cardapio[0];
assert.ok(produto);

function comItem(
  base: Dados,
  itemId: string,
  funcionario: typeof sessaoGerencia.funcionario,
): Dados {
  const agora = "2026-09-23T21:01:00.000Z";
  return {
    ...base,
    itens: [
      ...base.itens,
      {
        organizacao_id: "valhalla",
        item_id: itemId,
        pedido_id: null,
        atendimento_id: atendimentoId,
        mesa_id: 1,
        balcao_id: null,
        pessoa_id: compartilhadoId(atendimentoId),
        produto_id: produto.produto_id,
        name: produto.name,
        price: produto.price,
        quantidade: 1,
        observacao: "",
        destino_producao: produto.destino_producao,
        status: "novo",
        funcionario_id: funcionario.funcionario_id,
        funcionario_nome: funcionario.funcionario_nome,
        funcionario_perfil: funcionario.funcionario_perfil,
        criado_em: agora,
        enviado_em: null,
        atualizado_em: agora,
      },
    ],
  };
}

const itemGerencia = comItem(
  baseGerencia.estado,
  "item-gerencia",
  sessaoGerencia.funcionario,
);
const primeira = await gerencia.comanda.persistir({
  versao: baseGerencia.versao,
  acao: "alterar_comanda",
  entidadeId: "1",
  estado: itemGerencia,
});

const itemGarcom = comItem(
  baseGarcom.estado,
  "item-garcom",
  sessaoGarcom.funcionario,
);
const reconciliado = await confirmarAlteracao({
  alteracao: {
    operacaoId: "op-garcom",
    versao: baseGarcom.versao,
    acao: "alterar_comanda",
    entidadeId: "1",
    antes: baseGarcom.estado,
    depois: itemGarcom,
  },
  persistir: (entrada) => garcom.comanda.persistir(entrada),
  carregarEstado: () => garcom.comanda.estado(),
});
assert.equal(reconciliado.versao, primeira.versao + 1);
assert.equal(reconciliado.reconciliado, true);

const aposConcorrencia = await gerencia.comanda.estado();
assert.deepEqual(
  aposConcorrencia.estado.itens.map((item) => item.item_id).sort(),
  ["item-garcom", "item-gerencia"],
  "os dois lancamentos intencionais devem permanecer",
);

const itemRespostaPerdida = comItem(
  aposConcorrencia.estado,
  "item-resposta-perdida",
  sessaoGerencia.funcionario,
);
let chamadasPersistencia = 0;
const respostaPerdida = await confirmarAlteracao({
  alteracao: {
    operacaoId: "op-resposta-perdida",
    versao: aposConcorrencia.versao,
    acao: "alterar_comanda",
    entidadeId: "1",
    antes: aposConcorrencia.estado,
    depois: itemRespostaPerdida,
  },
  persistir: async (entrada) => {
    chamadasPersistencia += 1;
    await gerencia.comanda.persistir(entrada);
    throw new TypeError("Failed to fetch");
  },
  carregarEstado: () => gerencia.comanda.estado(),
});
assert.equal(respostaPerdida.reconciliado, true);
assert.equal(chamadasPersistencia, 1, "resposta perdida nao pode reenviar escrita confirmada");

const final = await gerencia.comanda.estado();
assert.equal(
  final.estado.itens.filter((item) => item.item_id === "item-resposta-perdida").length,
  1,
  "a mesma operacao logica nao pode duplicar o item",
);

const mesaAlterada = {
  ...final.estado,
  mesas: final.estado.mesas.map((mesa) =>
    mesa.mesa_id === 3 ? { ...mesa, status: "ocupada" as const } : mesa,
  ),
};
let recusas = 0;
await assert.rejects(
  confirmarAlteracao({
    alteracao: {
      operacaoId: "op-recusa",
      versao: final.versao,
      acao: "alterar_comanda",
      antes: final.estado,
      depois: mesaAlterada,
    },
    persistir: (entrada) => {
      recusas += 1;
      return gerencia.comanda.persistir(entrada);
    },
    carregarEstado: () => gerencia.comanda.estado(),
  }),
  (erro: { code?: string }) => erro.code === "BAD_REQUEST",
  "transicao rejeitada antes do banco precisa de codigo conhecido",
);
assert.equal(recusas, 1, "rejeicao conhecida nao pode ter retry");

let tentativasIncertas = 0;
await assert.rejects(
  confirmarAlteracao({
    alteracao: {
      operacaoId: "op-sem-resposta",
      versao: final.versao,
      acao: "alterar_comanda",
      entidadeId: "1",
      antes: final.estado,
      depois: comItem(final.estado, "item-incerto", sessaoGerencia.funcionario),
    },
    persistir: async () => {
      tentativasIncertas += 1;
      throw new TypeError("Failed to fetch");
    },
    carregarEstado: () => gerencia.comanda.estado(),
  }),
  ResultadoAlteracaoDesconhecidoError,
);
assert.equal(tentativasIncertas, 1, "resultado incerto nunca pode reenviar automaticamente");
assert.equal(
  (await garcom.comanda.estado()).estado.itens.some((item) => item.item_id === "item-incerto"),
  false,
);

await assert.rejects(
  confirmarAlteracao({
    alteracao: {
      operacaoId: "op-leitura-falhou",
      versao: final.versao,
      acao: "alterar_comanda",
      antes: final.estado,
      depois: comItem(final.estado, "item-sem-leitura", sessaoGerencia.funcionario),
    },
    persistir: async () => {
      throw new TypeError("Failed to fetch");
    },
    carregarEstado: async () => {
      throw new TypeError("Failed to fetch");
    },
  }),
  ResultadoAlteracaoDesconhecidoError,
  "falha no refetch nao prova falha na escrita",
);

console.log(
  "Confirmacao de pedidos: concorrencia e resposta perdida preservam itens sem duplicacao.",
);
