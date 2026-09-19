import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

const raiz = path.resolve(import.meta.dir, "..");
const diretorioTemporario = path.join(raiz, ".tmp");

interface ResultadoCenario {
  status: number;
  corpo: unknown;
}

async function removerBanco(caminho: string) {
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    try {
      await rm(caminho, { force: true });
      return;
    } catch (erro) {
      if (
        !(erro instanceof Error) ||
        !("code" in erro) ||
        erro.code !== "EBUSY" ||
        tentativa === 9
      ) {
        throw erro;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function executarWorker() {
  const { default: app } = await import("../packages/web/src/api");
  const resposta = await app.fetch(new Request("http://localhost/api/saude"));
  const texto = await resposta.text();
  let corpo: unknown = texto;
  try {
    corpo = JSON.parse(texto);
  } catch {
    // Respostas não JSON também precisam chegar ao processo principal para diagnóstico.
  }
  console.log(JSON.stringify({ status: resposta.status, corpo }));
}

async function executarCenario(
  nome: string,
  databaseUrl: string,
  limiteBancoMb?: string,
): Promise<ResultadoCenario> {
  const processo = spawn(process.execPath, [import.meta.path, "--worker"], {
    cwd: raiz,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      DATABASE_AUTH_TOKEN: databaseUrl.startsWith("file:") ? "" : "token-teste",
      CAV_LIMITE_BANCO_MB: limiteBancoMb ?? "",
    },
    stdio: "pipe",
  });
  let stdout = "";
  let stderr = "";
  processo.stdout.on("data", (pedaco) => {
    stdout += pedaco.toString("utf8");
  });
  processo.stderr.on("data", (pedaco) => {
    stderr += pedaco.toString("utf8");
  });
  const codigo = await new Promise<number | null>((resolve, reject) => {
    processo.once("error", reject);
    processo.once("exit", resolve);
  });
  assert.equal(codigo, 0, `${nome}: ${stderr || stdout}`);
  const linha = stdout.trim().split(/\r?\n/).at(-1);
  assert.ok(linha, `${nome}: worker sem resposta`);
  return JSON.parse(linha) as ResultadoCenario;
}

async function executarTeste() {
  await mkdir(diretorioTemporario, { recursive: true });
  const banco = path.join(
    diretorioTemporario,
    `saude-${process.pid}-${crypto.randomUUID()}.sqlite`,
  );
  const databaseUrl = `file:${banco.replaceAll("\\", "/")}`;

  try {
    const cliente = createClient({ url: databaseUrl });
    await cliente.execute("CREATE TABLE atividade (id INTEGER PRIMARY KEY)");
    cliente.close();

    assert.deepEqual(await executarCenario("saudavel", databaseUrl), {
      status: 200,
      corpo: { ok: true },
    });
    assert.deepEqual(await executarCenario("armazenamento", databaseUrl, "0.000001"), {
      status: 503,
      corpo: { ok: false, alerta: "armazenamento" },
    });
    assert.deepEqual(await executarCenario("indisponivel", "http://127.0.0.1:1"), {
      status: 500,
      corpo: { ok: false },
    });
  } finally {
    await removerBanco(banco);
    await removerBanco(`${banco}-shm`);
    await removerBanco(`${banco}-wal`);
  }

  console.log("Saúde pública: banco ativo, limite de armazenamento e indisponibilidade aprovados.");
}

if (process.argv.includes("--worker")) await executarWorker();
else await executarTeste();
