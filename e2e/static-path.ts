import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { resolverArquivoEstatico } from "../packages/web/src/api/lib/static-path";

const distDir = resolve(".tmp/static-dist");
const indexPath = resolve(distDir, "index.html");

assert.equal(resolverArquivoEstatico(distDir, indexPath, "/"), indexPath);
assert.equal(
  resolverArquivoEstatico(distDir, indexPath, "/assets/app.js"),
  resolve(distDir, "assets/app.js"),
);
assert.equal(resolverArquivoEstatico(distDir, indexPath, "/../segredo.txt"), null);
assert.equal(resolverArquivoEstatico(distDir, indexPath, "/%2e%2e/segredo.txt"), null);
assert.equal(resolverArquivoEstatico(distDir, indexPath, "/..%5csegredo.txt"), null);
assert.equal(resolverArquivoEstatico(distDir, indexPath, "/%E0%A4%A"), null);
assert.equal(resolverArquivoEstatico(distDir, indexPath, "/arquivo%00.txt"), null);

console.log("static-path: 7 cenarios aprovados");
