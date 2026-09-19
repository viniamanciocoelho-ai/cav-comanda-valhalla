import { strict as assert } from "node:assert";
import { cp, mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";

const raiz = path.resolve(import.meta.dir, "..");
const dockerfile = await Bun.file(path.join(raiz, "Dockerfile")).text();

assert.match(
  dockerfile,
  /COPY --chown=bun:bun packages\/web\/src\/web\/lib packages\/web\/src\/web\/lib/,
  "o estágio runtime deve copiar os módulos compartilhados usados pela API",
);

const runtime = path.join(raiz, ".tmp", `docker-runtime-${crypto.randomUUID()}`);
const origemSrc = path.join(raiz, "packages", "web", "src");
const destinoSrc = path.join(runtime, "packages", "web", "src");

try {
  await mkdir(destinoSrc, { recursive: true });
  await cp(path.join(origemSrc, "api"), path.join(destinoSrc, "api"), {
    recursive: true,
  });
  await cp(path.join(origemSrc, "web", "lib"), path.join(destinoSrc, "web", "lib"), {
    recursive: true,
  });
  await symlink(
    path.join(raiz, "packages", "web", "node_modules"),
    path.join(runtime, "packages", "web", "node_modules"),
    "junction",
  );

  process.env.DATABASE_URL = "file::memory:";
  await import(path.join(destinoSrc, "api", "lib", "relatorio-diario.ts"));
  await import(path.join(destinoSrc, "api", "lib", "comanda-store.ts"));
  await import(path.join(destinoSrc, "api", "lib", "impressao.ts"));

  console.log("docker-runtime: módulos compartilhados da API disponíveis");
} finally {
  await rm(runtime, { recursive: true, force: true });
}
