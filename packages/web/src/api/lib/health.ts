import { sql } from "drizzle-orm";
import { db } from "../database";

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
