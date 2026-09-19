const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { existsSync } = require("node:fs");
const { rm } = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { expect, test } = require("@playwright/test");

const raiz = path.resolve(__dirname, "..");
const porta = Number(process.env.CAV_E2E_PORT ?? 4319);
const baseURL = `http://localhost:${porta}`;
const banco = path.join(raiz, ".tmp", `login-producao-${randomUUID()}.sqlite`);
const executavelNavegador = [
  process.env.PLAYWRIGHT_BROWSER_PATH,
  String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
  String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
  String.raw`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
].find((candidato) => candidato && existsSync(candidato));

let servidor;
let saidaServidor = "";

test.use({
  baseURL,
  launchOptions: executavelNavegador ? { executablePath: executavelNavegador } : undefined,
});

test.beforeAll(async () => {
  await rm(banco, { force: true });
  servidor = spawn("bun", ["packages/web/src/server.ts"], {
    cwd: raiz,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(porta),
      WEBSITE_URL: baseURL,
      DATABASE_URL: `file:${banco.replaceAll("\\", "/")}`,
      DATABASE_AUTH_TOKEN: "",
      CAV_ORGANIZACAO_CODIGO: "valhalla",
      CAV_BOOTSTRAP_PIN_GERENCIA: "8462",
      CAV_ALLOWED_ORIGINS: baseURL,
      CAV_TIMEZONE: "America/Cuiaba",
    },
    stdio: "pipe",
  });
  servidor.stdout.on("data", (pedaco) => {
    saidaServidor += pedaco.toString("utf8");
  });
  servidor.stderr.on("data", (pedaco) => {
    saidaServidor += pedaco.toString("utf8");
  });

  const limite = Date.now() + 20_000;
  while (Date.now() < limite) {
    if (servidor.exitCode !== null) {
      throw new Error(`Servidor de produção encerrou antes do teste.\n${saidaServidor}`);
    }
    try {
      const resposta = await fetch(`${baseURL}/api/health/ready`);
      if (resposta.ok) return;
    } catch {
      // O servidor ainda está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  servidor.kill();
  throw new Error(`Servidor de produção não ficou pronto em 20 segundos.\n${saidaServidor}`);
});

test.afterAll(async () => {
  await encerrarServidor();
  await rm(banco, { force: true });
  await rm(`${banco}-shm`, { force: true });
  await rm(`${banco}-wal`, { force: true });
});

async function encerrarServidor() {
  if (!servidor || servidor.exitCode !== null) return;
  servidor.kill();
  await Promise.race([
    once(servidor, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

test("login por PIN renderiza a tela principal sem erros e permite sair", async ({ page }) => {
  const erros = [];
  page.on("pageerror", (erro) => erros.push(`pageerror: ${erro.message}`));
  page.on("console", (mensagem) => {
    if (mensagem.type() === "error") erros.push(`console: ${mensagem.text()}`);
  });

  await page.goto("/");
  await expect(page.getByTestId("login-pin")).toBeVisible();
  await page.getByTestId("campo-pin").fill("8462");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByTestId("login-pin")).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(erros).toEqual([]);
  await expect(page.getByRole("heading", { name: "Visão do salão" })).toBeVisible();
  await expect(page.getByTestId("status-conexao")).toBeVisible();

  await page.getByTestId("trocar-perfil").click();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByTestId("login-pin")).toBeVisible();
  expect(erros).toEqual([]);
});
