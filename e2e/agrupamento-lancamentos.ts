import assert from "node:assert/strict";
import { agruparLancamentos } from "../packages/web/src/web/lib/agrupamento";
import type { OrderItem } from "../packages/web/src/web/lib/types";

const exemplo = (id: string, autor: string, quantidade: number, extras: Partial<OrderItem> = {}): OrderItem => ({
  organizacao_id: "valhalla", item_id: id, pedido_id: null, atendimento_id: "at-2",
  mesa_id: 2, balcao_id: null, pessoa_id: "p-1", produto_id: "chopp", name: "Chopp Pilsen 500",
  price: 12.55, quantidade, observacao: "", destino_producao: "bar", status: "novo",
  funcionario_id: autor, funcionario_nome: autor, funcionario_perfil: "garcom",
  criado_em: "2026-10-01T20:10:00.000Z", enviado_em: null,
  atualizado_em: "2026-10-01T20:10:00.000Z", ...extras,
});

const flavio = exemplo("i-flavio", "Flávio", 2, { status: "entregue" });
const leandro = exemplo("i-leandro", "Leandro", 3, { price: 12.56, status: "preparando" });
const grupos = agruparLancamentos([flavio, leandro]);
assert.equal(grupos.length, 1);
assert.equal(grupos[0]?.quantidade, 5);
assert.equal(grupos[0]?.subtotalCentavos, 2 * 1255 + 3 * 1256);
assert.deepEqual(grupos[0]?.itens.map((item) => [item.item_id, item.funcionario_nome, item.status]),
  [["i-flavio", "Flávio", "entregue"], ["i-leandro", "Leandro", "preparando"]]);
assert.equal(flavio.quantidade, 2);
for (const diferenca of [
  { produto_id: "outro" }, { pessoa_id: "p-2" }, { observacao: "sem gelo" },
  { atendimento_id: "at-3" },
]) {
  assert.equal(agruparLancamentos([flavio, exemplo("outro", "Leandro", 1, diferenca)]).length, 2);
}
console.log("agrupamento-lancamentos: quantidade, autoria, chave e centavos preservados");
