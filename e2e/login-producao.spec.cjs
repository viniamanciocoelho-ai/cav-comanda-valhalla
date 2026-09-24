const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { existsSync } = require("node:fs");
const { rm } = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createClient } = require("@libsql/client");
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
  servidor = spawn(process.env.CAV_E2E_BUN_PATH ?? "bun", ["packages/web/src/server.ts"], {
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
  for (const arquivo of [banco, `${banco}-shm`, `${banco}-wal`]) {
    await rm(arquivo, { force: true, maxRetries: 10, retryDelay: 250, recursive: true });
  }
});

async function encerrarServidor() {
  if (!servidor || servidor.exitCode !== null) return;
  const saiu = once(servidor, "exit");
  servidor.kill();
  await Promise.race([saiu, new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Servidor nao encerrou em 10 segundos.")), 10_000),
  )]);
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

test("snapshot da versão anterior é migrado sem tela preta nem perda do rascunho", async ({
  page,
}) => {
  const erros = [];
  page.on("pageerror", (erro) => erros.push(`pageerror: ${erro.message}`));

  await entrarComoGerencia(page);
  await page.route("**/api/rpc/comanda/estado*", async (route) => {
    await route.abort("internetdisconnected");
  });
  await page.evaluate(() => {
    const chave = Object.keys(window.localStorage).find((item) =>
      item.endsWith(":snapshot"),
    );
    if (!chave) throw new Error("Snapshot atual não foi gravado.");
    const atual = JSON.parse(window.localStorage.getItem(chave));
    const mesa = {
      ...atual.estado.mesas[0],
      status: "ocupada",
      ativa: true,
      abertaEm: "2026-09-20T20:00:00.000Z",
      garcom_id: atual.funcionarios[0].funcionario_id,
    };
    delete mesa.atendimento_id;
    const pessoa = {
      pessoa_id: "p-legada",
      nome: "Cliente legado",
      mesa_id: mesa.mesa_id,
    };
    const item = {
      organizacao_id: atual.organizacaoId,
      item_id: "i-legado",
      pedido_id: null,
      mesa_id: mesa.mesa_id,
      pessoa_id: pessoa.pessoa_id,
      produto_id: atual.cardapio[0].produto_id,
      name: atual.cardapio[0].name,
      price: atual.cardapio[0].price,
      quantidade: 1,
      observacao: "",
      destino_producao: atual.cardapio[0].destino_producao,
      status: "novo",
      funcionario_id: atual.funcionarios[0].funcionario_id,
      funcionario_nome: atual.funcionarios[0].funcionario_nome,
      funcionario_perfil: atual.funcionarios[0].funcionario_perfil,
      criado_em: "2026-09-20T20:01:00.000Z",
      enviado_em: null,
      atualizado_em: "2026-09-20T20:01:00.000Z",
    };
    const legado = {
      ...atual,
      estado: {
        mesas: [mesa, ...atual.estado.mesas.slice(1).map((registro) => {
          const copia = { ...registro };
          delete copia.atendimento_id;
          return copia;
        })],
        pessoas: [pessoa],
        itens: [item],
        tickets: [],
        fechamentos: [],
        encerramentos: [],
        anteriores: {},
      },
    };
    window.localStorage.setItem(chave, JSON.stringify(legado));
  });

  await page.reload();
  await page.waitForTimeout(200);

  expect(erros).toEqual([]);
  await expect(page.getByRole("heading", { name: "Visão do salão" })).toBeVisible();
  await expect(page.getByTestId("mesa-1")).toContainText("Ocupada");
  await expect(page.getByTestId("mesa-1")).toContainText("1 pessoa");
  const migrado = await page.evaluate(() => {
    const chave = Object.keys(window.localStorage).find((item) =>
      item.endsWith(":snapshot"),
    );
    const snapshot = JSON.parse(window.localStorage.getItem(chave));
    return {
      balcoes: snapshot.estado.balcoes,
      atendimentoMesa: snapshot.estado.mesas[0].atendimento_id,
      atendimentoPessoa: snapshot.estado.pessoas[0].atendimento_id,
      atendimentoItem: snapshot.estado.itens[0].atendimento_id,
    };
  });
  expect(migrado.balcoes).toHaveLength(4);
  expect(migrado.atendimentoMesa).toBe("mesa:1:legado");
  expect(migrado.atendimentoPessoa).toBe("mesa:1:legado");
  expect(migrado.atendimentoItem).toBe("mesa:1:legado");
});

test("storage indisponível mostra o login em vez de tela preta", async ({ page }) => {
  const erros = [];
  page.on("pageerror", (erro) => erros.push(`pageerror: ${erro.message}`));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage indisponível", "SecurityError");
      },
    });
  });

  await page.goto("/");

  await expect(page.getByTestId("login-pin")).toBeVisible();
  expect(erros).toEqual([]);
});

async function entrarComoGerencia(page) {
  await page.goto("/");
  await page.getByTestId("campo-pin").fill("8462");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão do salão" })).toBeVisible();
}

async function abrirMesaSemNome(page, numero) {
  await page.goto(`/mesa/${numero}`);
  const abertura = page.waitForResponse((resposta) =>
    resposta.url().includes("/api/rpc/comanda/persistir") &&
    resposta.request().postData()?.includes("abrir_mesa"),
  );
  await page.getByTestId("abrir-mesa").click();
  expect((await abertura).status()).toBe(200);
  await expect(page.getByTestId("adicionar-item")).toBeVisible();
}

async function contarItensDaMesa(numero) {
  const db = createClient({ url: `file:${banco.replaceAll("\\", "/")}` });
  try {
    const resultado = await db.execute({
      sql: "SELECT count(*) AS total FROM itens_pedido WHERE organizacao_id = ? AND mesa_id = ?",
      args: ["valhalla", numero],
    });
    return Number(resultado.rows[0]?.total ?? 0);
  } finally {
    db.close();
  }
}

test("mesa sem nome recebe item compartilhado e aparece na segunda sessão", async ({ page, browser }) => {
  const erros = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await entrarComoGerencia(page);
  await page.goto("/mesa/1");
  await page.getByTestId("abrir-mesa").click();
  await expect(page.getByTestId("adicionar-item")).toBeVisible();
  await expect(page.getByText("0 pessoas", { exact: false })).toBeVisible();
  await page.getByTestId("adicionar-item").click();
  await expect(page.getByTestId("destinatario-Compartilhado")).toHaveAttribute("aria-pressed", "true");
  const confirmacao = page.waitForResponse((resposta) =>
    resposta.url().includes("/api/rpc/comanda/persistir") &&
    resposta.request().postData()?.includes("alterar_comanda"),
  );
  await page.locator('[data-testid^="add-"]').first().click();
  const respostaItem = await confirmacao;
  expect(respostaItem.status()).toBe(200);
  const segundaAdicao = page.waitForResponse((resposta) =>
    resposta.url().includes("/api/rpc/comanda/persistir") &&
    resposta.request().postData()?.includes("alterar_comanda"),
  );
  await page.locator('[data-testid^="add-"]').first().click();
  expect((await segundaAdicao).status()).toBe(200);
  await expect(page.getByTestId("status-conexao")).toContainText("Sincronizado");
  await page.reload();
  await expect(page.locator('[data-testid^="item-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="item-"]')).toContainText("2×");
  await page.getByTestId("aba-Compart.").click();
  await expect(page.locator('[data-testid^="item-"]')).toHaveCount(1);

  const outraSessao = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const outraPagina = await outraSessao.newPage();
    await entrarComoGerencia(outraPagina);
    await outraPagina.goto("/mesa/1");
    await expect(outraPagina.locator('[data-testid^="item-"]')).toHaveCount(1);
    await expect(outraPagina.locator('[data-testid^="item-"]')).toContainText("2×");
  } finally {
    await outraSessao.close();
  }
  expect(erros).toEqual([]);
});

test("resposta perdida apos gravar item nao duplica pedido", async ({ page }) => {
  await entrarComoGerencia(page);
  await abrirMesaSemNome(page, 2);
  let gravacoes = 0;
  await page.route("**/api/rpc/comanda/persistir", async (route) => {
    if (!route.request().postData()?.includes("alterar_comanda")) {
      await route.continue();
      return;
    }
    gravacoes += 1;
    const resposta = await route.fetch();
    expect(resposta.status()).toBe(200);
    await route.abort("failed");
  });
  await page.getByTestId("adicionar-item").click();
  await page.locator('[data-testid^="add-"]').first().click();
  await expect(page.getByTestId("status-conexao")).toContainText("Sincronizado");
  await expect.poll(() => contarItensDaMesa(2)).toBe(1);
  await page.reload();
  await expect(page.locator('[data-testid^="item-"]')).toHaveCount(1);
  expect(gravacoes).toBe(1);
});

test("falha antes de gravar preserva intencao sem reenviar sozinha", async ({ page }) => {
  await entrarComoGerencia(page);
  await abrirMesaSemNome(page, 3);
  let gravacoes = 0;
  await page.route("**/api/rpc/comanda/persistir", async (route) => {
    if (!route.request().postData()?.includes("alterar_comanda")) {
      await route.continue();
      return;
    }
    gravacoes += 1;
    await route.abort("failed");
  });
  await page.getByTestId("adicionar-item").click();
  await page.locator('[data-testid^="add-"]').first().click();
  await expect(page.getByTestId("status-conexao")).toContainText("Aguardando confirmação");
  await page.waitForTimeout(3_500);
  expect(gravacoes).toBe(1);
  expect(await contarItensDaMesa(3)).toBe(0);
  await page.reload();
  await expect(page.getByTestId("status-conexao")).toContainText("Aguardando confirmação");
  await expect(page.locator('[data-testid^="item-"]')).toHaveCount(1);
  expect(gravacoes).toBe(1);
});

test("resposta perdida no envio nao duplica ficha nem fila de impressao", async ({ page }) => {
  await entrarComoGerencia(page);
  await abrirMesaSemNome(page, 4);
  await page.getByTestId("adicionar-item").click();
  const inclusao = page.waitForResponse((resposta) =>
    resposta.url().includes("/api/rpc/comanda/persistir") &&
    resposta.request().postData()?.includes("alterar_comanda"),
  );
  await page.locator('[data-testid^="add-"]').first().click();
  expect((await inclusao).status()).toBe(200);
  await page.getByTestId("concluir-cardapio").click();
  let envios = 0;
  await page.route("**/api/rpc/comanda/persistir", async (route) => {
    if (!route.request().postData()?.includes('"enviar_pedido"')) {
      await route.continue();
      return;
    }
    envios += 1;
    const resposta = await route.fetch();
    expect(resposta.status()).toBe(200);
    await route.abort("failed");
  });
  await page.getByTestId("enviar-pedido").click();
  await expect(page.getByTestId("status-conexao")).toContainText("Sincronizado");
  const db = createClient({ url: `file:${banco.replaceAll("\\", "/")}` });
  try {
    const fichas = await db.execute({
      sql: "SELECT count(*) AS total FROM fichas_producao WHERE organizacao_id = ? AND mesa_id = ?",
      args: ["valhalla", 4],
    });
    const impressoes = await db.execute({
      sql: "SELECT count(*) AS total FROM fila_impressoes WHERE organizacao_id = ? AND mesa_id = ? AND tipo = ?",
      args: ["valhalla", 4, "ficha"],
    });
    expect(Number(fichas.rows[0]?.total)).toBe(1);
    expect(Number(impressoes.rows[0]?.total)).toBe(1);
    const pessoasAntesDeFechar = await db.execute({
      sql: "SELECT count(*) AS total FROM pessoas_da_comanda WHERE organizacao_id = ? AND mesa_id = ?",
      args: ["valhalla", 4],
    });
    expect(Number(pessoasAntesDeFechar.rows[0]?.total)).toBe(0);
  } finally {
    db.close();
  }
  await page.reload();
  await expect(page.locator('[data-testid^="item-"]')).toHaveCount(1);
  expect(envios).toBe(1);
  const solicitacao = page.waitForResponse((resposta) =>
    resposta.url().includes("/api/rpc/comanda/persistir") &&
    resposta.request().postData()?.includes('"solicitar_fechamento"'),
  );
  await page.getByTestId("solicitar-fechamento").click();
  expect((await solicitacao).status()).toBe(200);
  await page.goto("/caixa");
  const conta = page.locator('[data-testid^="conta-"]').filter({ hasText: "Mesa 04" });
  await expect(conta).toBeVisible();
  await conta.locator('[data-testid^="dividir-"]').click();
  await expect(page.getByTestId("divisao-Consumo sem identificação")).toBeVisible();
  const fechamento = page.waitForResponse((resposta) =>
    resposta.url().includes("/api/rpc/comanda/persistir") &&
    resposta.request().postData()?.includes('"fechar_conta"'),
  );
  await page.getByTestId("confirmar-fechamento").click();
  expect((await fechamento).status()).toBe(200);
  await expect(page.getByTestId("dialogo-fechamento")).toHaveCount(0);
  const dbFechamento = createClient({ url: `file:${banco.replaceAll("\\", "/")}` });
  try {
    const registros = await dbFechamento.execute({
      sql: "SELECT divisao_json, total_centavos FROM fechamentos WHERE organizacao_id = ? AND mesa_id = ?",
      args: ["valhalla", 4],
    });
    expect(registros.rows).toHaveLength(1);
    const divisao = JSON.parse(registros.rows[0].divisao_json);
    expect(divisao).toHaveLength(1);
    expect(divisao[0].pessoa).toBe("Consumo sem identificação");
    expect(Math.round(divisao[0].valor * 100)).toBe(Number(registros.rows[0].total_centavos));
    const pessoas = await dbFechamento.execute({
      sql: "SELECT count(*) AS total FROM pessoas_da_comanda WHERE organizacao_id = ? AND mesa_id = ?",
      args: ["valhalla", 4],
    });
    expect(Number(pessoas.rows[0]?.total)).toBe(0);
    const notinha = await dbFechamento.execute({
      sql: "SELECT texto FROM fila_impressoes WHERE organizacao_id = ? AND mesa_id = ? AND tipo = 'recibo'",
      args: ["valhalla", 4],
    });
    expect(notinha.rows).toHaveLength(1);
    expect(String(notinha.rows[0].texto)).toContain("CONSUMO SEM IDENTIFICAÇÃO");
    expect(String(notinha.rows[0].texto)).toContain("1x ");
    expect(String(notinha.rows[0].texto)).toContain("TOTAL");
  } finally {
    dbFechamento.close();
  }
});

for (const { numero, nomes, esperados } of [
  { numero: 5, nomes: ["Ana", "Bruno"], esperados: ["Ana", "Bruno"] },
  { numero: 6, nomes: ["Ana", ""], esperados: ["Ana", "Cliente 1"] },
]) {
  test(`rateio e fechamento da mesa ${numero} com nomes ${nomes[1] ? "completos" : "misturados"}`, async ({ page }) => {
    await entrarComoGerencia(page);
    await abrirMesaSemNome(page, numero);
    for (const nome of nomes) {
      await page.getByTestId("nova-pessoa").fill(nome);
      const cadastro = page.waitForResponse((resposta) =>
        resposta.url().includes("/api/rpc/comanda/persistir") &&
        resposta.request().postData()?.includes('"alterar_comanda"'),
      );
      await page.getByTestId("adicionar-pessoa").first().click();
      expect((await cadastro).status()).toBe(200);
    }
    await page.getByTestId("adicionar-item").click();
    await page.getByTestId("destinatario-Compartilhado").click();
    const primeiro = page.waitForResponse((resposta) =>
      resposta.url().includes("/api/rpc/comanda/persistir") &&
      resposta.request().postData()?.includes('"alterar_comanda"'),
    );
    await page.locator('[data-testid^="add-"]').first().click();
    expect((await primeiro).status()).toBe(200);
    await page.getByTestId("destinatario-Ana").click();
    const individual = page.waitForResponse((resposta) =>
      resposta.url().includes("/api/rpc/comanda/persistir") &&
      resposta.request().postData()?.includes('"alterar_comanda"'),
    );
    await page.locator('[data-testid^="add-"]').nth(1).click();
    expect((await individual).status()).toBe(200);
    await page.getByTestId("concluir-cardapio").click();
    const envio = page.waitForResponse((resposta) =>
      resposta.url().includes("/api/rpc/comanda/persistir") &&
      resposta.request().postData()?.includes('"enviar_pedido"'),
    );
    await page.getByTestId("enviar-pedido").click();
    expect((await envio).status()).toBe(200);
    const solicitacao = page.waitForResponse((resposta) =>
      resposta.url().includes("/api/rpc/comanda/persistir") &&
      resposta.request().postData()?.includes('"solicitar_fechamento"'),
    );
    await page.getByTestId("solicitar-fechamento").click();
    expect((await solicitacao).status()).toBe(200);
    await page.goto("/caixa");
    const conta = page.locator('[data-testid^="conta-"]').filter({ hasText: `Mesa ${String(numero).padStart(2, "0")}` });
    await conta.locator('[data-testid^="dividir-"]').click();
    for (const nome of esperados) await expect(page.getByTestId(`divisao-${nome}`)).toBeVisible();
    const fechamento = page.waitForResponse((resposta) =>
      resposta.url().includes("/api/rpc/comanda/persistir") &&
      resposta.request().postData()?.includes('"fechar_conta"'),
    );
    await page.getByTestId("confirmar-fechamento").click();
    expect((await fechamento).status()).toBe(200);
    const db = createClient({ url: `file:${banco.replaceAll("\\", "/")}` });
    try {
      const resultado = await db.execute({
        sql: "SELECT divisao_json, total_centavos FROM fechamentos WHERE organizacao_id = ? AND mesa_id = ?",
        args: ["valhalla", numero],
      });
      expect(resultado.rows).toHaveLength(1);
      const divisao = JSON.parse(resultado.rows[0].divisao_json);
      expect(divisao.map((linha) => linha.pessoa)).toEqual(esperados);
      expect(divisao.every((linha) => linha.valor > 0)).toBe(true);
      expect(divisao.reduce((soma, linha) => soma + Math.round(linha.valor * 100), 0)).toBe(Number(resultado.rows[0].total_centavos));
      const notinha = await db.execute({
        sql: "SELECT texto FROM fila_impressoes WHERE organizacao_id = ? AND mesa_id = ? AND tipo = 'recibo'",
        args: ["valhalla", numero],
      });
      expect(notinha.rows).toHaveLength(1);
      for (const nome of esperados) expect(String(notinha.rows[0].texto)).toContain(nome.toUpperCase());
    } finally {
      db.close();
    }
  });
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
