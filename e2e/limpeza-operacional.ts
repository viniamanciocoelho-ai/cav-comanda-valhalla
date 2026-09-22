import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { prepararBancoTeste } from "./test-database";
import { limparOperacao } from "../packages/web/scripts/limpar-operacao";

await prepararBancoTeste("limpeza-operacional");
const url = process.env.DATABASE_URL!;
const client = createClient({ url });

try {
  await client.batch(
    [
      {
        sql: `INSERT INTO organizacoes
          (organizacao_id, codigo, nome, quantidade_mesas, largura_recibo, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", "limpeza", "Limpeza", 1, 80, "agora", "agora"],
      },
      {
        sql: `INSERT INTO versoes_estado (organizacao_id, versao, atualizado_em)
          VALUES (?, ?, ?)`,
        args: ["limpeza", 1, "agora"],
      },
      {
        sql: `INSERT INTO mesas
          (organizacao_id, mesa_id, atendimento_id, status, ativa, pessoas_fixas, total_fixo_centavos,
           aberta_em, garcom_id, conta_solicitada, servico_incluso)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", 1, "at-limpeza", "ocupada", 1, 1, 1500, "agora", "f-1", 1, 0],
      },
      {
        sql: `INSERT INTO pessoas_da_comanda
          (organizacao_id, pessoa_id, atendimento_id, mesa_id, balcao_id, nome)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", "p-1", "at-limpeza", 1, null, "Pessoa"],
      },
      {
        sql: `INSERT INTO itens_pedido
          (organizacao_id, item_id, pedido_id, atendimento_id, mesa_id, balcao_id, pessoa_id, produto_id, nome,
           preco_centavos, quantidade, observacao, destino_producao, status,
           funcionario_id, funcionario_nome, funcionario_perfil, criado_em, enviado_em,
           atualizado_em, status_anterior)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "limpeza", "i-1", null, "at-limpeza", 1, null, "p-1", "produto", "Produto", 1500, 1, "",
          "bar", "novo", "f-1", "Pessoa", "gerencia", "agora", null, "agora", null,
        ],
      },
      {
        sql: `INSERT INTO balcoes
          (organizacao_id, balcao_id, atendimento_id, status, ativa, aberta_em,
           garcom_id, conta_solicitada, servico_incluso)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", 1, "at-balcao-limpeza", "ocupada", 1, "agora", "f-1", 1, 0],
      },
    ],
    "write",
  );

  const primeira = await limparOperacao(client, "limpeza");
  assert.equal(primeira.itensPedido, 1);
  assert.equal(primeira.pessoasDaComanda, 1);
  assert.equal(primeira.mesasReiniciadas, 1);
  assert.equal(primeira.balcoesReiniciados, 1);

  const segunda = await limparOperacao(client, "limpeza");
  assert.equal(segunda.itensPedido, 0);
  assert.equal(segunda.pessoasDaComanda, 0);
  assert.equal(segunda.mesasReiniciadas, 1);
  assert.equal(segunda.balcoesReiniciados, 1);

  const mesa = await client.execute({
    sql: "SELECT * FROM mesas WHERE organizacao_id = ? AND mesa_id = ?",
    args: ["limpeza", 1],
  });
  assert.equal(mesa.rows[0]?.status, "livre");
  assert.equal(mesa.rows[0]?.ativa, 0);
  assert.equal(mesa.rows[0]?.atendimento_id, null);
  assert.equal(mesa.rows[0]?.conta_solicitada, 0);
  assert.equal(mesa.rows[0]?.servico_incluso, 1);
  const balcao = await client.execute({
    sql: "SELECT * FROM balcoes WHERE organizacao_id = ? AND balcao_id = ?",
    args: ["limpeza", 1],
  });
  assert.equal(balcao.rows[0]?.status, "livre");
  assert.equal(balcao.rows[0]?.ativa, 0);
  assert.equal(balcao.rows[0]?.atendimento_id, null);
  assert.equal(balcao.rows[0]?.conta_solicitada, 0);
  assert.equal(balcao.rows[0]?.servico_incluso, 1);
} finally {
  client.close();
}

console.log("Limpeza operacional: escopo por organização e idempotência aprovados.");
