import assert from "node:assert/strict";
import { montarRecibo } from "../packages/web/src/web/lib/recibo";
import type { LinhaDivisao, OrderItem, Pessoa } from "../packages/web/src/web/lib/types";

const pessoas: Pessoa[] = [
  { pessoa_id: "p1", nome: "Guilherme", mesa_id: 1 },
  { pessoa_id: "p2", nome: "Ana", mesa_id: 1 },
];
const itens: OrderItem[] = [
  {
    organizacao_id: "valhalla",
    item_id: "i1",
    pedido_id: "pd1",
    mesa_id: 1,
    pessoa_id: "p1",
    produto_id: "batata",
    name: "Batata cheddar",
    price: 28.8,
    quantidade: 1,
    observacao: "",
    destino_producao: "cozinha",
    status: "entregue",
    funcionario_id: "f1",
    funcionario_nome: "Rafael",
    funcionario_perfil: "garcom",
    criado_em: new Date().toISOString(),
    enviado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
  {
    organizacao_id: "valhalla",
    item_id: "i2",
    pedido_id: "pd1",
    mesa_id: 1,
    pessoa_id: "m1-compartilhado",
    produto_id: "agua",
    name: "Água",
    price: 5,
    quantidade: 1,
    observacao: "",
    destino_producao: "bar",
    status: "entregue",
    funcionario_id: "f1",
    funcionario_nome: "Rafael",
    funcionario_perfil: "garcom",
    criado_em: new Date().toISOString(),
    enviado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  },
];
const divisao: LinhaDivisao[] = [
  { pessoa_id: "p1", pessoa: "Guilherme", individual: 28.8, rateio: 2.5, servico: 3.13, total: 34.43 },
  { pessoa_id: "p2", pessoa: "Ana", individual: 0, rateio: 2.5, servico: 0.25, total: 2.75 },
];

const recibo = montarRecibo(1, pessoas, itens, divisao, 58);
assert.match(recibo, /GUILHERME/);
assert.match(recibo, /Batata cheddar/);
assert.match(recibo, /Rateio Água/);
assert.match(recibo, /TOTAL/);
assert.match(recibo, /sem valor fiscal/);
assert.doesNotMatch(recibo, /NFC-e/i);

console.log("Recibo térmico: 6 verificações aprovadas.");
