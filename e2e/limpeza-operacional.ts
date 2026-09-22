import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { prepararBancoTeste } from "./test-database";
import {
  limparSalao,
  planejarLimpezaSalao,
} from "../packages/web/scripts/limpar-operacao";

await prepararBancoTeste("limpeza-operacional");
const client = createClient({ url: process.env.DATABASE_URL! });
const backupDir = ".tmp/backup-limpeza-operacional";
const corte = "2026-09-22T23:59:59.000Z";

try {
  await client.batch(
    [
      {
        sql: `INSERT INTO organizacoes
          (organizacao_id, codigo, nome, quantidade_mesas, largura_recibo, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", "limpeza", "Limpeza", 2, 80, corte, corte],
      },
      {
        sql: `INSERT INTO organizacoes
          (organizacao_id, codigo, nome, quantidade_mesas, largura_recibo, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ["outra", "outra", "Outra", 1, 80, corte, corte],
      },
      {
        sql: `INSERT INTO versoes_estado (organizacao_id, versao, atualizado_em)
          VALUES (?, ?, ?)`,
        args: ["limpeza", 7, corte],
      },
      {
        sql: `INSERT INTO versoes_estado (organizacao_id, versao, atualizado_em)
          VALUES (?, ?, ?)`,
        args: ["outra", 4, corte],
      },
      {
        sql: `INSERT INTO funcionarios
          (organizacao_id, funcionario_id, nome, perfil, pin_hash, ativo, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", "gerencia-1", "Gerente", "gerencia", "hash", 1, corte, corte],
      },
      {
        sql: `INSERT INTO mesas
          (organizacao_id, mesa_id, atendimento_id, status, ativa, pessoas_fixas,
           total_fixo_centavos, aberta_em, garcom_id, conta_solicitada, servico_incluso)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", 1, "at-mesa-1", "ocupada", 1, 1, 1500, "2026-09-22T18:00:00Z", "g1", 1, 0],
      },
      {
        sql: `INSERT INTO mesas
          (organizacao_id, mesa_id, atendimento_id, status, ativa, pessoas_fixas,
           total_fixo_centavos, aberta_em, garcom_id, conta_solicitada, servico_incluso)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", 2, null, "livre", 0, 0, 0, null, null, 0, 1],
      },
      {
        sql: `INSERT INTO mesas
          (organizacao_id, mesa_id, atendimento_id, status, ativa, pessoas_fixas,
           total_fixo_centavos, aberta_em, garcom_id, conta_solicitada, servico_incluso)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["outra", 1, "at-outra", "ocupada", 1, 1, 1500, "2026-09-22T18:00:00Z", "g2", 0, 1],
      },
      {
        sql: `INSERT INTO balcoes
          (organizacao_id, balcao_id, atendimento_id, status, ativa, aberta_em,
           garcom_id, conta_solicitada, servico_incluso)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", 1, "at-balcao-1", "ocupada", 1, "2026-09-22T18:01:00Z", "g1", 1, 0],
      },
      {
        sql: `INSERT INTO pessoas_da_comanda
          (organizacao_id, pessoa_id, atendimento_id, mesa_id, balcao_id, nome)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: ["limpeza", "p-1", "at-mesa-1", 1, null, "Pessoa"],
      },
      {
        sql: `INSERT INTO itens_pedido
          (organizacao_id, item_id, pedido_id, atendimento_id, mesa_id, balcao_id, pessoa_id,
           produto_id, nome, preco_centavos, quantidade, observacao, destino_producao, status,
           funcionario_id, funcionario_nome, funcionario_perfil, criado_em, enviado_em,
           atualizado_em, status_anterior)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "limpeza", "i-1", "pedido-1", "at-mesa-1", 1, null, "p-1", "produto", "Produto",
          1500, 1, "", "bar", "novo", "g1", "Garcom", "garcom",
          "2026-09-22T18:02:00Z", null, "2026-09-22T18:02:00Z", null,
        ],
      },
      {
        sql: `INSERT INTO fichas_producao
          (organizacao_id, ticket_id, pedido_id, atendimento_id, mesa_id, balcao_id,
           destino_producao, status, linhas_json, item_ids_json, funcionario_id,
           funcionario_nome, criado_em, enviado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "limpeza", "t-1", "pedido-1", "at-mesa-1", 1, null, "bar", "enviado",
          "[]", "[\"i-1\"]", "g1", "Garcom", "2026-09-22T18:03:00Z",
          "2026-09-22T18:03:00Z", "2026-09-22T18:03:00Z",
        ],
      },
    ],
    "write",
  );

  const plano = await planejarLimpezaSalao(
    client,
    "limpeza",
    { mesas: [1], balcoes: [1] },
    corte,
  );
  assert.equal(plano.contagens.itensPedido, 1);
  assert.equal(plano.contagens.pessoasDaComanda, 1);
  assert.equal(plano.contagens.fichasProducao, 1);
  assert.equal(plano.contagens.mesasReiniciadas, 1);
  assert.equal(plano.contagens.balcoesReiniciados, 1);
  assert.match(plano.confirmacao, /^limpar-salao:limpeza:v7:/);
  assert.deepEqual(plano.selecao, { mesas: [1], balcoes: [1] });

  const semConfirmacao = await assert.rejects(
    () =>
      limparSalao(client, {
        organizacaoId: "limpeza",
        selecao: { mesas: [1], balcoes: [1] },
        marcoCorte: corte,
        responsavelId: "gerencia-1",
        backupDir,
        confirmacao: "errada",
      }),
    /Confirmacao invalida/,
  );
  assert.equal(semConfirmacao, undefined);

  const executado = await limparSalao(client, {
    organizacaoId: "limpeza",
    selecao: { mesas: [1], balcoes: [1] },
    marcoCorte: corte,
    responsavelId: "gerencia-1",
    backupDir,
    confirmacao: plano.confirmacao,
  });
  assert.equal(executado.backupArquivo.includes("cav-comanda-"), true);

  const estado = await client.batch(
    [
      { sql: "SELECT * FROM mesas WHERE organizacao_id = ? AND mesa_id = 1", args: ["limpeza"] },
      { sql: "SELECT * FROM balcoes WHERE organizacao_id = ? AND balcao_id = 1", args: ["limpeza"] },
      { sql: "SELECT COUNT(*) AS total FROM itens_pedido WHERE organizacao_id = ?", args: ["limpeza"] },
      { sql: "SELECT COUNT(*) AS total FROM fichas_producao WHERE organizacao_id = ?", args: ["limpeza"] },
      { sql: "SELECT COUNT(*) AS total FROM auditoria WHERE organizacao_id = ? AND acao = 'limpar_salao'", args: ["limpeza"] },
      { sql: "SELECT COUNT(*) AS total FROM mesas WHERE organizacao_id = ? AND mesa_id = 1", args: ["outra"] },
    ],
    "read",
  );
  assert.equal(estado[0]?.rows[0]?.status, "livre");
  assert.equal(estado[0]?.rows[0]?.atendimento_id, null);
  assert.equal(estado[1]?.rows[0]?.status, "livre");
  assert.equal(estado[1]?.rows[0]?.atendimento_id, null);
  assert.equal(estado[2]?.rows[0]?.total, 0);
  assert.equal(estado[3]?.rows[0]?.total, 0);
  assert.equal(estado[4]?.rows[0]?.total, 1);
  assert.equal(estado[5]?.rows[0]?.total, 1);

  const repetido = await planejarLimpezaSalao(
    client,
    "limpeza",
    { mesas: [1], balcoes: [1] },
    corte,
  );
  assert.equal(repetido.contagens.itensPedido, 0);
  assert.equal(repetido.contagens.mesasReiniciadas, 0);
} finally {
  client.close();
  await rm(backupDir, { recursive: true, force: true });
}

console.log("Limpeza de salao: simulacao, backup, escopo, auditoria e idempotencia aprovados.");
