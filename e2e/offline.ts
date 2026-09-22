import { strict as assert } from "node:assert";
import {
  backoffMs,
  carregarFila,
  erroDeRede,
  estadoConfirmadoParaResumo,
  reaplicarAcao,
  salvarFila,
  type ArmazenamentoOffline,
  type FilaOfflineItem,
} from "../packages/web/src/web/lib/offline";
import type { Dados } from "../packages/web/src/web/components/comanda-provider";

class Memoria implements ArmazenamentoOffline {
  private readonly valores = new Map<string, string>();

  getItem(chave: string) {
    return this.valores.get(chave) ?? null;
  }

  setItem(chave: string, valor: string) {
    this.valores.set(chave, valor);
  }

  removeItem(chave: string) {
    this.valores.delete(chave);
  }
}

function dadosBase(): Dados {
  return {
    mesas: [
      {
        organizacao_id: "valhalla",
        mesa_id: 1,
        atendimento_id: null,
        status: "livre",
        ativa: false,
        pessoasFixas: 0,
        totalFixo: 0,
        abertaEm: null,
        garcom_id: null,
        contaSolicitada: false,
        servicoIncluso: true,
      },
      {
        organizacao_id: "valhalla",
        mesa_id: 2,
        atendimento_id: null,
        status: "livre",
        ativa: false,
        pessoasFixas: 0,
        totalFixo: 0,
        abertaEm: null,
        garcom_id: null,
        contaSolicitada: false,
        servicoIncluso: true,
      },
    ],
    balcoes: [],
    pessoas: [],
    itens: [],
    tickets: [],
    fechamentos: [],
    encerramentos: [],
    anteriores: {},
  };
}

const antes = dadosBase();
const depois: Dados = {
  ...antes,
  mesas: antes.mesas.map((mesa) =>
    mesa.mesa_id === 1
      ? {
          ...mesa,
          atendimento_id: "at-offline-1",
          status: "ocupada",
          ativa: true,
          abertaEm: "2026-09-19T10:00:00.000Z",
          garcom_id: "g1",
        }
      : mesa,
  ),
};

const acao: FilaOfflineItem = {
  id: "offline-1",
  organizacaoId: "valhalla",
  acao: "abrir_mesa",
  entidadeId: "1",
  antes,
  depois,
  tentativas: 0,
  proximaTentativaEm: 0,
  criadoEm: "2026-09-19T10:00:00.000Z",
};

const armazenamento = new Memoria();
salvarFila("valhalla", [acao], armazenamento);
const reaberta = carregarFila("valhalla", armazenamento);
assert.equal(reaberta.length, 1, "a fila precisa sobreviver ao reload");
assert.equal(reaberta[0]?.depois.mesas[0]?.ativa, true);

assert.equal(backoffMs(0), 500);
assert.equal(backoffMs(4), 8_000);
assert.equal(backoffMs(20), 30_000);
assert.equal(erroDeRede(new TypeError("Failed to fetch")), true);
assert.equal(erroDeRede(new Error("FORBIDDEN")), false);

const remoto: Dados = {
  ...antes,
  mesas: antes.mesas.map((mesa) =>
    mesa.mesa_id === 2
      ? { ...mesa, status: "ocupada", ativa: true, abertaEm: "2026-09-19T10:02:00.000Z" }
      : mesa,
  ),
};
const rebased = reaplicarAcao(remoto, acao);
assert.equal(rebased.conflitos.length, 0);
assert.equal(rebased.estado.mesas.find((mesa) => mesa.mesa_id === 1)?.ativa, true);
assert.equal(
  rebased.estado.mesas.find((mesa) => mesa.mesa_id === 2)?.abertaEm,
  "2026-09-19T10:02:00.000Z",
  "rebase não pode apagar alteração remota independente",
);

const conflitoRemoto: Dados = {
  ...antes,
  mesas: antes.mesas.map((mesa) =>
    mesa.mesa_id === 1
      ? { ...mesa, status: "ocupada", ativa: true, abertaEm: "2026-09-19T10:05:00.000Z" }
      : mesa,
  ),
};
assert.equal(reaplicarAcao(conflitoRemoto, acao).conflitos.length, 1);

const pendenteComItem: Dados = {
  ...depois,
  itens: [
    {
      organizacao_id: "valhalla",
      item_id: "i1",
      pedido_id: null,
      atendimento_id: "at-offline-1",
      mesa_id: 1,
      balcao_id: null,
      pessoa_id: "compartilhado-m1",
      produto_id: "p1",
      name: "Suco",
      price: 10,
      quantidade: 1,
      observacao: "",
      destino_producao: "bar",
      status: "novo",
      funcionario_id: "g1",
      funcionario_nome: "Garçom",
      funcionario_perfil: "garcom",
      criado_em: "2026-09-19T10:01:00.000Z",
      enviado_em: null,
      atualizado_em: "2026-09-19T10:01:00.000Z",
    },
  ],
};
const baseParaTotal = estadoConfirmadoParaResumo("offline", depois, pendenteComItem);
assert.equal(baseParaTotal.itens.length, 0, "total offline não pode incluir item apenas local");

console.log("offline: fila persistente, backoff, rebase, falha de rede e total confirmado OK");
