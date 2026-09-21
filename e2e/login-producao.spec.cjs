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

test("login por PIN renderiza a tela principal sem erros e permite sair", async ({
  page,
  context,
}) => {
  const erros = [];
  const registrarErros = (pagina) => {
    pagina.on("pageerror", (erro) => erros.push(`pageerror: ${erro.message}`));
    pagina.on("console", (mensagem) => {
      if (mensagem.type() === "error") erros.push(`console: ${mensagem.text()}`);
    });
  };
  registrarErros(page);

  const saude = await page.request.get(`${baseURL}/api/saude`);
  expect(saude.status()).toBe(200);
  expect(await saude.json()).toEqual({ ok: true });

  await page.goto("/");
  await expect(page.getByTestId("login-pin")).toBeVisible();
  await page.getByTestId("campo-pin").fill("8462");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByTestId("login-pin")).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(erros).toEqual([]);
  await expect(page.getByRole("heading", { name: "Visão do salão" })).toBeVisible();
  await expect(page.getByTestId("status-conexao")).toBeVisible();

  let leiturasEstado = 0;
  const requisicoesEstado = [];
  const paginaRestaurada = await context.newPage();
  registrarErros(paginaRestaurada);
  paginaRestaurada.on("request", (request) => {
    if (!request.url().includes("/api/rpc/comanda/estado")) return;
    leiturasEstado += 1;
    requisicoesEstado.push({
      method: request.method(),
      resourceType: request.resourceType(),
      postData: request.postData(),
    });
  });
  await page.close();
  await paginaRestaurada.goto("/");
  await expect(
    paginaRestaurada.getByRole("heading", { name: "Visão do salão" }),
  ).toBeVisible();
  expect(leiturasEstado, JSON.stringify(requisicoesEstado)).toBe(1);

  await paginaRestaurada.getByTestId("trocar-perfil").click();
  await paginaRestaurada.getByRole("button", { name: "Sair" }).click();
  await expect(paginaRestaurada.getByTestId("login-pin")).toBeVisible();
  expect(erros).toEqual([]);
});

async function entrarComoGerencia(page) {
  await page.goto("/");
  await page.getByTestId("campo-pin").fill("8462");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão do salão" })).toBeVisible();
}

function instalarBluetoothSimulado(page, { gravavel = true } = {}) {
  return page.addInitScript(
    ({ gravavel }) => {
      const ouvintes = new Map();
      const diagnostico = {
        conexoes: 0,
        gestos: [],
        escritas: [],
        falharProximaEscrita: false,
      };
      const caracteristica = {
        uuid: "0000ffe1-0000-1000-8000-00805f9b34fb",
        properties: {
          write: gravavel,
          writeWithoutResponse: gravavel,
        },
        async writeValueWithoutResponse(valor) {
          if (diagnostico.falharProximaEscrita) {
            diagnostico.falharProximaEscrita = false;
            dispositivo.gatt.connected = false;
            for (const ouvinte of ouvintes.get("gattserverdisconnected") ?? []) {
              ouvinte();
            }
            throw new DOMException("GATT disconnected", "NetworkError");
          }
          diagnostico.escritas.push([...new Uint8Array(valor.buffer ?? valor)]);
        },
        async writeValue(valor) {
          return this.writeValueWithoutResponse(valor);
        },
      };
      const servico = {
        uuid: "0000ffe0-0000-1000-8000-00805f9b34fb",
        async getCharacteristics() {
          return [caracteristica];
        },
      };
      const servidor = {
        async getPrimaryServices() {
          return [servico];
        },
      };
      const dispositivo = {
        id: "kprinter-teste",
        name: "KPrinter_1234",
        addEventListener(tipo, ouvinte) {
          const atuais = ouvintes.get(tipo) ?? [];
          atuais.push(ouvinte);
          ouvintes.set(tipo, atuais);
        },
        gatt: {
          connected: false,
          async connect() {
            diagnostico.conexoes += 1;
            this.connected = true;
            return servidor;
          },
        },
      };
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: {
          requestDevice() {
            diagnostico.gestos.push(navigator.userActivation?.isActive ?? null);
            return Promise.resolve(dispositivo);
          },
          getDevices() {
            return Promise.resolve([dispositivo]);
          },
        },
      });
      Object.defineProperty(window, "__cavBleMock", {
        configurable: true,
        value: diagnostico,
      });
    },
    { gravavel },
  );
}

test("Bluetooth BLE conecta, envia em blocos e reconecta após queda", async ({ page }) => {
  await instalarBluetoothSimulado(page);
  await entrarComoGerencia(page);
  await page.goto("/configuracao");

  await page.getByTestId("conectar-impressora-bluetooth").click();
  await expect(page.getByText("Bluetooth conectado")).toBeVisible();
  await page.getByText("Diagnóstico da impressora", { exact: true }).click();
  await expect(page.getByText(/Dispositivo: KPrinter_1234/)).toBeVisible();
  expect(
    await page.evaluate(() => window.__cavBleMock.gestos),
  ).toEqual([true]);

  await page.evaluate(() => {
    window.__cavBleMock.falharProximaEscrita = true;
  });
  await page.getByTestId("teste-impressora-local").click();
  await expect
    .poll(() => page.evaluate(() => window.__cavBleMock.escritas.length))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => window.__cavBleMock.conexoes),
  ).toBe(2);
  expect(
    await page.evaluate(() =>
      window.__cavBleMock.escritas.every((bloco) => bloco.length <= 100),
    ),
  ).toBe(true);
});

test("Bluetooth sem característica gravável oferece RawBT", async ({ page }) => {
  await instalarBluetoothSimulado(page, { gravavel: false });
  await entrarComoGerencia(page);
  await page.goto("/configuracao");

  await page.getByTestId("conectar-impressora-bluetooth").click();
  await expect(
    page.getByTestId("erro-impressora-local").getByText(/canal BLE de escrita/i),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /usar rawbt/i })).toBeVisible();
});

test("impressão do navegador usa iframe dentro do clique e não abre pop-up", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.open = () => {
      throw new Error("window.open não deve ser chamado");
    };
    window.__cavPrintEventos = [];
    window.addEventListener("cav:impressao-navegador", (evento) => {
      window.__cavPrintEventos.push(evento.detail);
    });
  });
  await entrarComoGerencia(page);
  await page.goto("/configuracao");

  await page.getByLabel("Método de impressão").selectOption("navegador");
  await page.getByTestId("teste-impressora-local").click();

  await expect
    .poll(() => page.evaluate(() => window.__cavPrintEventos.length))
    .toBe(1);
  expect(
    await page.evaluate(() => window.__cavPrintEventos[0]?.ativacaoUsuario),
  ).toBe(true);
  await expect(page.getByText(/bloqueou a janela/i)).toHaveCount(0);
  await expect(page.locator('iframe[data-cav-impressao="navegador"]')).toHaveCount(1);
  await page.evaluate(() => {
    const quadro = document.querySelector('iframe[data-cav-impressao="navegador"]');
    quadro?.contentWindow?.dispatchEvent(new Event("afterprint"));
  });
  await expect(page.locator('iframe[data-cav-impressao="navegador"]')).toHaveCount(0);
});

test(
  "configuração Bluetooth permanece utilizável no Chrome móvel",
  async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await instalarBluetoothSimulado(page);
    await entrarComoGerencia(page);
    await page.goto("/configuracao");

    await expect(page.getByLabel("Método de impressão")).toBeVisible();
    await expect(page.getByTestId("conectar-impressora-bluetooth")).toBeVisible();
    await expect(page.getByTestId("teste-impressora-local")).toBeVisible();
    const dimensoes = await page.evaluate(() => ({
      larguraDocumento: document.documentElement.scrollWidth,
      larguraVisivel: document.documentElement.clientWidth,
    }));
    expect(dimensoes.larguraDocumento).toBeLessThanOrEqual(dimensoes.larguraVisivel);
    await page.screenshot({
      path: testInfo.outputPath("configuracao-bluetooth-mobile.png"),
      fullPage: true,
    });
  },
);
