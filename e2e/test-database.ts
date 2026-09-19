import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

const raiz = path.resolve(import.meta.dir, "..");
const diretorioTemporario = path.join(raiz, ".tmp");
const diretorioMigracoes = path.join(raiz, "packages", "web", "drizzle");

export async function prepararBancoTeste(nome: string, modoDemo = false) {
  await mkdir(diretorioTemporario, { recursive: true });
  const arquivo = path.join(
    diretorioTemporario,
    `${nome}-${process.pid}-${crypto.randomUUID()}.sqlite`,
  );
  await rm(arquivo, { force: true });

  const databaseUrl = `file:${arquivo.replaceAll("\\", "/")}`;
  process.env.DATABASE_URL = databaseUrl;
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.CAV_DEMO_MODE = modoDemo ? "true" : "false";
  process.env.NODE_ENV = "test";

  const client = createClient({ url: databaseUrl });
  try {
    for (const nomeMigracao of [
      "0000_fase1.sql",
      "0001_cancelamento-anterior.sql",
    ]) {
      const sql = await Bun.file(path.join(diretorioMigracoes, nomeMigracao)).text();
      await client.executeMultiple(sql.replaceAll("--> statement-breakpoint", "\n"));
    }
  } finally {
    client.close();
  }

  return arquivo;
}
