import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

const raiz = path.resolve(import.meta.dir, "..");
const diretorioTemporario = path.join(raiz, ".tmp");
const arquivo = path.join(diretorioTemporario, `migracao-legado-${crypto.randomUUID()}.sqlite`);
const migracoes = [
  "0000_fase1.sql",
  "0001_cancelamento-anterior.sql",
  "0002_remover-campo-mesa.sql",
  "0003_certain_lila_cheney.sql",
  "0004_relatorio_diario.sql",
];
const atendimentoLegado = "mesa:3:legado";
const agora = "2026-09-22T12:00:00.000Z";

await mkdir(diretorioTemporario, { recursive: true });

const url = `file:${arquivo.replaceAll("\\", "/")}`;
const client = createClient({ url });

try {
  for (const nome of migracoes) {
    const sql = await Bun.file(path.join(raiz, "packages", "web", "drizzle", nome)).text();
    await client.executeMultiple(sql.replaceAll("--> statement-breakpoint", "\n"));
  }

  await client.execute({
    sql: `INSERT INTO mesas
      (organizacao_id, mesa_id, status, ativa, pessoas_fixas, total_fixo_centavos,
       aberta_em, garcom_id, conta_solicitada, servico_incluso)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ["valhalla", 3, "livre", 0, 0, 0, null, null, 0, 1],
  });
  await client.execute({
    sql: `INSERT INTO pessoas_da_comanda (organizacao_id, pessoa_id, mesa_id, nome)
      VALUES (?, ?, ?, ?)`,
    args: ["valhalla", "p-legado", 3, "Pessoa histórica"],
  });
  await client.execute({
    sql: `INSERT INTO itens_pedido
      (organizacao_id, item_id, pedido_id, mesa_id, pessoa_id, produto_id, nome,
       preco_centavos, quantidade, observacao, destino_producao, status,
       status_anterior, funcionario_id, funcionario_nome, funcionario_perfil,
       criado_em, enviado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "valhalla",
      "i-legado",
      "pedido-legado",
      3,
      "p-legado",
      "produto-legado",
      "Produto histórico",
      100,
      1,
      "",
      "cozinha",
      "enviado",
      null,
      "f-legado",
      "Atendimento",
      "garcom",
      agora,
      agora,
      agora,
    ],
  });
  await client.execute({
    sql: `INSERT INTO fichas_producao
      (organizacao_id, ticket_id, pedido_id, mesa_id, destino_producao, status,
       linhas_json, item_ids_json, funcionario_id, funcionario_nome, criado_em,
       enviado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "valhalla",
      "ticket-legado",
      "pedido-legado",
      3,
      "cozinha",
      "enviado",
      "[]",
      '["i-legado"]',
      "f-legado",
      "Atendimento",
      agora,
      agora,
      agora,
    ],
  });

  const migracao = await Bun.file(
    path.join(raiz, "packages", "web", "drizzle", "0005_atendimento_balcao.sql"),
  ).text();
  await client.executeMultiple(migracao.replaceAll("--> statement-breakpoint", "\n"));

  for (const tabela of ["pessoas_da_comanda", "itens_pedido", "fichas_producao"]) {
    const resultado = await client.execute({
      sql: `SELECT atendimento_id FROM ${tabela} WHERE organizacao_id = ? LIMIT 1`,
      args: ["valhalla"],
    });
    assert.equal(resultado.rows[0]?.atendimento_id, atendimentoLegado, tabela);
  }
} finally {
  client.close();
}

console.log("Migração legada: registros de mesas encerradas preservam vínculo de atendimento.");
