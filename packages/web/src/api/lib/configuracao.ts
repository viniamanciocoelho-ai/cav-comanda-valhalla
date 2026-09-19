import { pinOperacionalValido } from "./security";

type Ambiente = Record<string, string | undefined>;

export interface ConfiguracaoAplicacao {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  databaseAuthToken?: string;
  organizacaoCodigo: string;
  bootstrapPinGerencia: string;
  websiteUrl?: string;
  origensPermitidas: string[];
  timeZone: string;
  port: number;
}

function urlHttp(nome: string, valor: string) {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`${nome} deve ser uma URL absoluta válida.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${nome} deve usar http ou https.`);
  }
  return url.origin;
}

function validarTimeZone(valor: string) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: valor }).format(new Date());
  } catch {
    throw new Error("CAV_TIMEZONE deve ser um fuso IANA válido, como America/Cuiaba.");
  }
}

export function validarConfiguracaoAmbiente(
  env: Ambiente = process.env,
): ConfiguracaoAplicacao {
  const nodeEnv = env.NODE_ENV?.trim() || "development";
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV deve ser development, test ou production.");
  }
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (!/^(file:|libsql:|https?:|wss?:)/.test(databaseUrl)) {
    throw new Error(
      "DATABASE_URL é obrigatória e deve usar file:, libsql:, http(s): ou ws(s):.",
    );
  }
  const databaseAuthToken = env.DATABASE_AUTH_TOKEN?.trim() || undefined;
  if (!databaseUrl.startsWith("file:") && !databaseAuthToken) {
    throw new Error("DATABASE_AUTH_TOKEN é obrigatório para banco remoto.");
  }
  const organizacaoCodigo = env.CAV_ORGANIZACAO_CODIGO?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9_-]{2,60}$/.test(organizacaoCodigo)) {
    throw new Error(
      "CAV_ORGANIZACAO_CODIGO é obrigatório e aceita letras minúsculas, números, _ e -.",
    );
  }
  const bootstrapPinGerencia = env.CAV_BOOTSTRAP_PIN_GERENCIA?.trim() ?? "";
  if (!pinOperacionalValido(bootstrapPinGerencia)) {
    throw new Error(
      "CAV_BOOTSTRAP_PIN_GERENCIA deve ser um PIN não sequencial de 4 dígitos.",
    );
  }
  const websiteUrl = env.WEBSITE_URL?.trim()
    ? urlHttp("WEBSITE_URL", env.WEBSITE_URL.trim())
    : undefined;
  if (nodeEnv === "production" && !websiteUrl) {
    throw new Error("WEBSITE_URL é obrigatória em produção.");
  }
  if (
    nodeEnv === "production" &&
    websiteUrl?.startsWith("http://") &&
    !websiteUrl.startsWith("http://localhost")
  ) {
    throw new Error("WEBSITE_URL deve usar https em produção.");
  }
  const origensPermitidas = (env.CAV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origem) => origem.trim())
    .filter(Boolean)
    .map((origem) => urlHttp("CAV_ALLOWED_ORIGINS", origem));
  const timeZone = env.CAV_TIMEZONE?.trim() || "America/Cuiaba";
  validarTimeZone(timeZone);
  const port = Number(env.PORT?.trim() || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT deve ser um inteiro entre 1 e 65535.");
  }
  return {
    nodeEnv: nodeEnv as ConfiguracaoAplicacao["nodeEnv"],
    databaseUrl,
    databaseAuthToken,
    organizacaoCodigo,
    bootstrapPinGerencia,
    websiteUrl,
    origensPermitidas,
    timeZone,
    port,
  };
}
