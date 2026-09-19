import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { sql } from "drizzle-orm";
import { validarConfiguracaoAmbiente } from "../src/api/lib/configuracao";

interface DependenciasPreparacao {
  validarAmbiente: () => unknown;
  aplicarMigrations: () => Promise<number>;
  verificarBanco: () => Promise<{ statusHttp: number }>;
}

export interface ResultadoPreparacao {
  migrationsAplicadas: number;
  bancoRespondeu: true;
}

const NOMES_SEGREDOS = [
  "DATABASE_AUTH_TOKEN",
  "CAV_BOOTSTRAP_PIN_GERENCIA",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

function mensagemDoErro(erro: unknown) {
  return erro instanceof Error ? erro.message : String(erro);
}

export function mascararSegredos(mensagem: string) {
  let segura = mensagem;
  for (const nome of NOMES_SEGREDOS) {
    const valor = process.env[nome]?.trim();
    if (valor) segura = segura.replaceAll(valor, "[SEGREDO_OCULTO]");
  }
  return segura;
}

export async function executarPreparacaoDeploy(
  dependencias: DependenciasPreparacao,
): Promise<ResultadoPreparacao> {
  try {
    dependencias.validarAmbiente();
  } catch (erro) {
    throw new Error(`Configuração inválida: ${mascararSegredos(mensagemDoErro(erro))}`);
  }

  let migrationsAplicadas: number;
  try {
    migrationsAplicadas = await dependencias.aplicarMigrations();
  } catch (erro) {
    throw new Error(
      "Falha ao aplicar migrations. Verifique DATABASE_URL, DATABASE_AUTH_TOKEN e as " +
        `permissões do banco. Detalhe: ${mascararSegredos(mensagemDoErro(erro))}`,
    );
  }

  const saude = await dependencias.verificarBanco();
  if (saude.statusHttp !== 200) {
    throw new Error(
      "O banco não respondeu após as migrations. Verifique a conectividade e as credenciais.",
    );
  }

  return { migrationsAplicadas, bancoRespondeu: true };
}

async function aplicarMigrationsConfiguradas() {
  const { db } = await import("../src/api/database");
  const migrationsFolder = path.resolve(import.meta.dir, "..", "drizzle");
  const migrations = readMigrationFiles({ migrationsFolder });
  const tabelaExiste = await db.values(
    sql`SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = '__drizzle_migrations'`,
  );
  let ultimaMigration = 0;
  if (tabelaExiste.length > 0) {
    const linhas = await db.values(
      sql`SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
    );
    ultimaMigration = Number(linhas[0]?.[0] ?? 0);
  }
  const pendentes = migrations.filter(
    (migration) => migration.folderMillis > ultimaMigration,
  ).length;
  await migrate(db, { migrationsFolder });
  return pendentes;
}

async function main() {
  console.log("1/3 Validando configuração do ambiente...");
  const resultado = await executarPreparacaoDeploy({
    validarAmbiente: validarConfiguracaoAmbiente,
    aplicarMigrations: async () => {
      console.log("2/3 Aplicando migrations pendentes...");
      return aplicarMigrationsConfiguradas();
    },
    verificarBanco: async () => {
      console.log("3/3 Confirmando resposta do banco...");
      const { verificarSaude } = await import("../src/api/lib/health");
      return verificarSaude();
    },
  });
  console.log("");
  console.log("Preparação de deploy concluída.");
  console.log("- Ambiente validado: sim");
  console.log(`- Migrations aplicadas: ${resultado.migrationsAplicadas}`);
  console.log("- Banco respondeu: sim");
}

if (import.meta.main) {
  try {
    await main();
  } catch (erro) {
    console.error(`Falha na preparação de deploy: ${mascararSegredos(mensagemDoErro(erro))}`);
    process.exitCode = 1;
  }
}
