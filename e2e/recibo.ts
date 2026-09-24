import assert from "node:assert/strict";
import { divisaoDoFechamento, montarRecibo } from "../packages/web/src/web/lib/recibo";
import { compartilhadoId } from "../packages/web/src/web/lib/operacao";
import type { Fechamento, LinhaDivisao, OrderItem, Pessoa } from "../packages/web/src/web/lib/types";

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
assert.match(recibo, /Rateio compartilhados/);
assert.match(recibo, /TOTAL/);
assert.match(recibo, /sem valor fiscal/);
assert.doesNotMatch(recibo, /NFC-e/i);

const atendimento = "at-recibo-sem-nome";
const fechamento = { atendimento_id: atendimento, servico: 0 } as Fechamento;
const compartilhado: OrderItem = {
  ...itens[1],
  atendimento_id: atendimento,
  pessoa_id: compartilhadoId(atendimento),
  price: 0.03,
};
const anonimo = divisaoDoFechamento(fechamento, [], [compartilhado]);
assert.equal(anonimo.length, 1);
assert.equal(anonimo[0].pessoa, "Consumo sem identificação");
assert.equal(anonimo[0].total, 0.03);
const reciboAnonimo = montarRecibo(1, [], [compartilhado], anonimo, 58);
assert.match(reciboAnonimo, /CONSUMO SEM IDENTIFICAÇÃO/);
assert.match(reciboAnonimo, /1x Água/);
assert.match(reciboAnonimo, /TOTAL/);

const mistos: Pessoa[] = [
  { ...pessoas[0], atendimento_id: atendimento, nome: "Ana" },
  { ...pessoas[1], atendimento_id: atendimento, nome: "Cliente 1" },
];
const divisaoMista = divisaoDoFechamento(fechamento, mistos, [compartilhado]);
assert.deepEqual(divisaoMista.map((linha) => Math.round(linha.rateio * 100)), [2, 1]);
assert.equal(divisaoMista.reduce((soma, linha) => soma + Math.round(linha.total * 100), 0), 3);
const reciboMisto = montarRecibo(1, mistos, [compartilhado], divisaoMista, 58);
assert.match(reciboMisto, /ANA/);
assert.match(reciboMisto, /CLIENTE 1/);

console.log("Recibo térmico: nomes opcionais e centavos do rateio aprovados.");
