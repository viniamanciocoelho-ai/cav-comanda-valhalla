import { strict as assert } from "node:assert";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { prepararBancoTeste } from "./test-database";

await prepararBancoTeste("backup");
const { garantirOrganizacaoPadrao } = await import(
  "../packages/web/src/api/lib/comanda-store"
);
const {
  TABELAS_BACKUP,
  aplicarRetencaoLocal,
  exportarBanco,
  gravarBackupLocal,
  lerBackup,
  restaurarBanco,
  validarIntegridade,
} = await import("../packages/web/scripts/backup-core");
const { executarBackup } = await import("../packages/web/scripts/backup");

await garantirOrganizacaoPadrao();
const client = createClient({ url: process.env.DATABASE_URL! });
const diretorio = path.resolve(import.meta.dir, "..", ".tmp", `backup-${crypto.randomUUID()}`);
await mkdir(diretorio, { recursive: true });

try {
  await client.execute({
    sql: `INSERT INTO auditoria
      (auditoria_id, organizacao_id, funcionario_id, acao, entidade, entidade_id, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "audit-backup",
      "valhalla",
      "gerencia-1",
      "teste_backup",
      "banco",
      null,
      "2026-09-19T12:00:00.000Z",
    ],
  });

  const backup = await exportarBanco(client, new Date("2026-09-19T12:00:00.000Z"));
  validarIntegridade(backup);
  assert.deepEqual(
    Object.keys(backup.tabelas).sort(),
    Object.keys(TABELAS_BACKUP).sort(),
    "o backup deve conter todas as tabelas previstas",
  );
  assert.deepEqual(backup.organizacoesIncluidas, ["valhalla"]);

  const arquivo = await gravarBackupLocal(backup, diretorio);
  const relido = await lerBackup(arquivo);
  assert.equal(relido.tabelas.auditoria.length, 1);

  const resultadoS3 = await executarBackup({
    agora: new Date("2026-09-19T12:01:00.000Z"),
    diretorio,
    retencao: 30,
    enviarS3: async () => {
      throw new Error("S3 indisponível no teste");
    },
  });
  assert.match(resultadoS3.erroS3 ?? "", /S3 indisponível/);
  assert.equal(await Bun.file(resultadoS3.arquivo).exists(), true);

  const processoBackupParcial = Bun.spawn(
    ["bun", "packages/web/scripts/backup.ts"],
    {
      cwd: path.resolve(import.meta.dir, ".."),
      env: {
        ...process.env,
        CAV_BACKUP_DIR: diretorio,
        S3_ENDPOINT: "https://s3.exemplo.invalid",
        S3_BUCKET: "",
        S3_ACCESS_KEY_ID: "",
        S3_SECRET_ACCESS_KEY: "",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [saidaBackupParcial, erroBackupParcial, codigoBackupParcial] =
    await Promise.all([
      new Response(processoBackupParcial.stdout).text(),
      new Response(processoBackupParcial.stderr).text(),
      processoBackupParcial.exited,
    ]);
  assert.notEqual(codigoBackupParcial, 0);
  assert.match(saidaBackupParcial, /Backup local criado:/);
  assert.match(
    erroBackupParcial,
    /Configuração S3 incompleta\. Defina: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY\./,
  );

  for (let indice = 2; indice <= 5; indice += 1) {
    await gravarBackupLocal(
      { ...backup, criadoEm: `2026-09-19T12:0${indice}:00.000Z` },
      diretorio,
      new Date(`2026-09-19T12:0${indice}:00.000Z`),
    );
  }
  const removidos = await aplicarRetencaoLocal(diretorio, 2);
  const restantes = (await readdir(diretorio)).filter((nome) => nome.endsWith(".json"));
  assert.equal(restantes.length, 2);
  assert.equal(removidos.length >= 3, true);

  await client.execute({ sql: "DELETE FROM auditoria", args: [] });
  await client.execute({ sql: "DELETE FROM organizacoes", args: [] });
  await assert.rejects(() => restaurarBanco(client, backup), /Restauração bloqueada/);
  assert.equal(
    (await client.execute("SELECT COUNT(*) AS total FROM organizacoes")).rows[0]?.total,
    0,
  );

  await restaurarBanco(client, backup, "valhalla");
  assert.equal(
    (await client.execute("SELECT COUNT(*) AS total FROM organizacoes")).rows[0]?.total,
    1,
  );
  assert.equal(
    (await client.execute("SELECT COUNT(*) AS total FROM auditoria")).rows[0]?.total,
    1,
  );

  console.log(
    "backup: tabelas, integridade, falha S3, retenção, confirmação e restauração aprovados",
  );
} finally {
  client.close();
  await rm(diretorio, { recursive: true, force: true });
}
