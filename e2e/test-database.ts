import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

const raiz = path.resolve(import.meta.dir, "..");
const diretorioTemporario = path.join(raiz, ".tmp");
const diretorioMigracoes = path.join(raiz, "packages", "web", "drizzle");

export const PIN_GERENCIA_TESTE = "8462";

export async function prepararBancoTeste(nome: string) {
  await mkdir(diretorioTemporario, { recursive: true });
  const arquivo = path.join(
    diretorioTemporario,
    `${nome}-${process.pid}-${crypto.randomUUID()}.sqlite`,
  );
  await rm(arquivo, { force: true });

  const databaseUrl = `file:${arquivo.replaceAll("\\", "/")}`;
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.CAV_BOOTSTRAP_PIN_GERENCIA = PIN_GERENCIA_TESTE;
  delete process.env.CAV_BOOTSTRAP_PIN_GARCOM;
  delete process.env.CAV_BOOTSTRAP_PIN_PRODUCAO;
  delete process.env.CAV_BOOTSTRAP_PIN_CAIXA;
  process.env.NODE_ENV = "test";

  const client = createClient({ url: databaseUrl });
  try {
    const glob = new Bun.Glob("*.sql");
    const migracoes = Array.from(
      glob.scanSync({ cwd: diretorioMigracoes, absolute: false }),
    ).sort();
    for (const nomeMigracao of migracoes) {
      const sql = await Bun.file(path.join(diretorioMigracoes, nomeMigracao)).text();
      await client.executeMultiple(sql.replaceAll("--> statement-breakpoint", "\n"));
    }
  } finally {
    client.close();
  }

  return arquivo;
}
