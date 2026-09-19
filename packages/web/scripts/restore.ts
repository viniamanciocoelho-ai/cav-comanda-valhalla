import { createClient } from "@libsql/client";
import { lerBackup, restaurarBanco } from "./backup-core";

function argumento(prefixo: string) {
  return Bun.argv.slice(2).find((valor) => valor.startsWith(prefixo))?.slice(prefixo.length);
}

if (import.meta.main) {
  const arquivo = argumento("--arquivo=");
  const confirmacao = argumento("--confirmar=");
  if (!arquivo) {
    throw new Error(
      "Uso: bun scripts/restore.ts --arquivo=/caminho/backup.json --confirmar=organizacao",
    );
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
  const backup = await lerBackup(arquivo);
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  try {
    await restaurarBanco(client, backup, confirmacao);
    console.log(
      `Restauração concluída para: ${backup.organizacoesIncluidas.join(", ") || "nenhuma organização"}.`,
    );
  } finally {
    client.close();
  }
}
