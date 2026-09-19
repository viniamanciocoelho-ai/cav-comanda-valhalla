import { sql } from "drizzle-orm";
import { db } from "../database";
import { limiteBancoMbDoAmbiente } from "./configuracao";

export interface SaudeAplicacao {
  status: "ok" | "indisponivel";
  app: "ok";
  database: "ok" | "indisponivel";
  timestamp: string;
}

export async function verificarSaude(
  consultarBanco: () => Promise<unknown> = () => db.run(sql`SELECT 1`),
): Promise<{ statusHttp: 200 | 503; corpo: SaudeAplicacao }> {
  try {
    await consultarBanco();
    return {
      statusHttp: 200,
      corpo: {
        status: "ok",
        app: "ok",
        database: "ok",
        timestamp: new Date().toISOString(),
      },
    };
  } catch {
    return {
      statusHttp: 503,
      corpo: {
        status: "indisponivel",
        app: "ok",
        database: "indisponivel",
        timestamp: new Date().toISOString(),
      },
    };
  }
}

type CorpoSaudePublica =
  | { ok: true }
  | { ok: false }
  | { ok: false; alerta: "armazenamento" };

async function consultarAtividadeETamanho() {
  const resultado = await db.run(sql`
    SELECT
      1 AS ativo,
      (SELECT page_count FROM pragma_page_count()) *
      (SELECT page_size FROM pragma_page_size()) AS tamanho_bytes
  `);
  const tamanhoBytes = Number(resultado.rows[0]?.tamanho_bytes);
  if (!Number.isFinite(tamanhoBytes) || tamanhoBytes < 0) {
    throw new Error("O banco não retornou uma métrica de armazenamento válida.");
  }
  return tamanhoBytes;
}

export async function verificarSaudePublica(
  consultarBanco: () => Promise<number> = consultarAtividadeETamanho,
  limiteBancoMb = limiteBancoMbDoAmbiente(),
): Promise<{ statusHttp: 200 | 500 | 503; corpo: CorpoSaudePublica }> {
  try {
    const tamanhoBytes = await consultarBanco();
    const limiteBytes =
      limiteBancoMb === undefined ? undefined : limiteBancoMb * 1024 * 1024;
    if (limiteBytes !== undefined && tamanhoBytes > limiteBytes * 0.8) {
      return {
        statusHttp: 503,
        corpo: { ok: false, alerta: "armazenamento" },
      };
    }
    return { statusHttp: 200, corpo: { ok: true } };
  } catch {
    return { statusHttp: 500, corpo: { ok: false } };
  }
}
