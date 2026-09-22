import assert from "node:assert/strict";
import { prepararBancoTeste } from "./test-database";
import type { EstadoPersistido } from "../packages/web/src/api/lib/comanda-store";
import type { Fechamento, OrderItem, Pessoa } from "../packages/web/src/web/lib/types";

await prepararBancoTeste("impressao-balcao");
const [{ db }, { filaImpressoes }, { enfileirarImpressoesTx }] = await Promise.all([
  import("../packages/web/src/api/database"),
  import("../packages/web/src/api/database/schema"),
  import("../packages/web/src/api/lib/impressao"),
]);

const agora = "2026-09-22T12:00:00.000Z";
const pessoaA: Pessoa = {
  pessoa_id: "p-balcao-a",
  nome: "Cliente A",
  atendimento_id: "at-balcao-a",
  mesa_id: null,
  balcao_id: 1,
};
const pessoaB: Pessoa = {
  pessoa_id: "p-balcao-b",
  nome: "Cliente B",
  atendimento_id: "at-balcao-b",
  mesa_id: null,
  balcao_id: 2,
};
const itemBase: Omit<OrderItem, "item_id" | "atendimento_id" | "balcao_id" | "pessoa_id"> = {
  organizacao_id: "valhalla",
  pedido_id: "pedido",
  mesa_id: null,
  name: "Água",
  produto_id: "m1",
  price: 10,
  quantidade: 1,
  observacao: "",
  destino_producao: "bar",
  status: "enviado",
  funcionario_id: "f-gerencia",
  funcionario_nome: "Gerência",
  funcionario_perfil: "gerencia",
  criado_em: agora,
  enviado_em: agora,
  atualizado_em: agora,
};
const itemA: OrderItem = {
  ...itemBase,
  item_id: "i-balcao-a",
  atendimento_id: pessoaA.atendimento_id,
  balcao_id: pessoaA.balcao_id,
  pessoa_id: pessoaA.pessoa_id,
};
const itemB: OrderItem = {
  ...itemBase,
  item_id: "i-balcao-b",
  atendimento_id: pessoaB.atendimento_id,
  balcao_id: pessoaB.balcao_id,
  pessoa_id: pessoaB.pessoa_id,
};
const fechamento: Fechamento = {
  organizacao_id: "valhalla",
  fechamento_id: "f-balcao-a",
  atendimento_id: pessoaA.atendimento_id,
  mesa_id: null,
  balcao_id: pessoaA.balcao_id,
  hora: "12:00",
  subtotal: 10,
  servico: 0,
  total: 10,
  servicoIncluso: false,
  divisao: [{ pessoa_id: pessoaA.pessoa_id, pessoa: pessoaA.nome, valor: 10 }],
  nfce: "nao_solicitada",
  funcionario_nome: "Gerência",
  garcom_nome: "Gerência",
};
const anterior: EstadoPersistido = {
  mesas: [],
  balcoes: [
    {
      organizacao_id: "valhalla",
      balcao_id: 1,
      atendimento_id: pessoaA.atendimento_id,
      status: "ocupada",
      ativa: true,
      abertaEm: agora,
      garcom_id: "f-gerencia",
      contaSolicitada: false,
      servicoIncluso: false,
    },
    {
      organizacao_id: "valhalla",
      balcao_id: 2,
      atendimento_id: pessoaB.atendimento_id,
      status: "ocupada",
      ativa: true,
      abertaEm: agora,
      garcom_id: "f-gerencia",
      contaSolicitada: false,
      servicoIncluso: false,
    },
  ],
  pessoas: [pessoaA, pessoaB],
  itens: [itemA, itemB],
  tickets: [],
  fechamentos: [],
  encerramentos: [],
  anteriores: {},
};
const estado: EstadoPersistido = {
  ...anterior,
  balcoes: anterior.balcoes.map((balcao) =>
    balcao.balcao_id === 1
      ? { ...balcao, atendimento_id: null, status: "livre", ativa: false, abertaEm: null, garcom_id: null }
      : balcao,
  ),
  pessoas: [pessoaB],
  itens: [itemB],
  fechamentos: [fechamento],
};

await db.transaction(async (tx) => {
  await enfileirarImpressoesTx(tx, "valhalla", anterior, estado, 58);
});

const fila = (await db.select().from(filaImpressoes)).find(
  (registro) => registro.referenciaId === fechamento.fechamento_id,
);
assert.ok(fila);
assert.match(fila.texto, /CLIENTE A/);
assert.doesNotMatch(fila.texto, /CLIENTE B/);

console.log("Impressão de balcão: recibo isolado por atendimento.");
