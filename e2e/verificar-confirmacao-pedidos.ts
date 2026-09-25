import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const raiz = path.resolve(import.meta.dir, "..");
const bun = process.execPath;

if (Bun.version !== "1.3.14") {
  throw new Error(`Este gate exige Bun 1.3.14; encontrado ${Bun.version}.`);
}

for (const diretorio of [raiz, path.join(raiz, "packages", "web")]) {
  if (readdirSync(diretorio).some((nome) => nome.startsWith(".env") && nome !== ".env.example")) {
    throw new Error(`Remova arquivos .env reais do checkout de verificacao: ${diretorio}`);
  }
}
if (process.env.DATABASE_URL || process.env.DATABASE_AUTH_TOKEN) {
  throw new Error("Nao execute o gate com conexao de banco herdada no ambiente.");
}

const env: Record<string, string> = {};
for (const nome of [
  "PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE",
  "APPDATA", "LOCALAPPDATA", "ComSpec", "PATHEXT", "CI", "PLAYWRIGHT_BROWSER_PATH",
  "PLAYWRIGHT_BROWSERS_PATH",
]) {
  if (process.env[nome]) env[nome] = process.env[nome]!;
}
env.PATH = `${path.dirname(bun)}${path.delimiter}${env.PATH ?? env.Path ?? ""}`;
if (process.platform === "win32") env.Path = env.PATH;
env.NODE_ENV = "test";
env.DATABASE_URL = `file:${path.join(raiz, ".tmp", "gate-confirmacao.sqlite").replaceAll("\\", "/")}`;
env.DATABASE_AUTH_TOKEN = "";
env.CAV_E2E_BUN_PATH = bun;

function executar(nome: string, comando: string[]) {
  console.log(`\n[verificacao] ${nome}`);
  const resultado = Bun.spawnSync(comando, {
    cwd: raiz,
    env,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (resultado.exitCode !== 0) {
    throw new Error(`${nome} falhou (codigo ${resultado.exitCode ?? "desconhecido"}).`);
  }
}

function binarioFixado(pacote: string) {
  const runkit = realpathSync(path.join(raiz, "node_modules", "@runablehq", "runkit"));
  const requireRunkit = createRequire(path.join(runkit, "dist", "bin", "runkit.js"));
  const arquivo = requireRunkit.resolve(`${pacote}/package.json`);
  const manifesto = JSON.parse(readFileSync(arquivo, "utf8")) as { bin: string | Record<string, string> };
  const relativo = typeof manifesto.bin === "string" ? manifesto.bin : manifesto.bin[pacote];
  if (!relativo || !existsSync(path.resolve(path.dirname(arquivo), relativo))) {
    throw new Error(`Binario fixado de ${pacote} nao encontrado; rode bun install --frozen-lockfile.`);
  }
  return path.resolve(path.dirname(arquivo), relativo);
}

executar("typecheck", [bun, "run", "typecheck"]);
executar("build", [bun, "run", "build"]);
if (process.platform === "win32") {
  executar("convencoes do runkit (Windows)", [
    bun, binarioFixado("konsistent"), "check", "--config-package", "@runablehq/runkit",
  ]);
  executar("oxlint fixado (Windows)", [
    bun, binarioFixado("oxlint"), ".", "--deny-warnings", "--no-error-on-unmatched-pattern",
  ]);
} else {
  executar("runkit lint", [bun, "run", "lint"]);
}
for (const teste of [
  "bootstrap-seguro", "confirmacao-pedidos", "offline", "mesas-compartilhadas", "tenant-isolation",
  "security-regressao", "fase1-api", "sem-consumo", "recibo", "monetario",
]) {
  executar(`e2e/${teste}.ts`, [bun, `e2e/${teste}.ts`]);
}
executar("Playwright no bundle de producao", [
  bun, "x", "playwright", "test", "e2e/login-producao.spec.cjs", "--workers=1",
]);
console.log("\nVerificacao local concluida com banco isolado.");
