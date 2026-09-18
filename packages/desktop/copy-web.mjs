import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(packageDir, "../web/dist");
const destination = path.resolve(packageDir, "web-dist");

try {
  await stat(path.join(source, "index.html"));
} catch {
  throw new Error("Build web ausente. Execute o build do workspace @template/web primeiro.");
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
await rm(path.join(destination, "runable.js"), { force: true });

const indexPath = path.join(destination, "index.html");
const indexOriginal = await readFile(indexPath, "utf8");
const indexDesktop = indexOriginal
  .replace(/\s*<script[^>]+src="\/runable\.js"[^>]*><\/script>/, "")
  .replace(/((?:src|href)=")\//g, "$1./");
await writeFile(indexPath, indexDesktop, "utf8");

const assetsDir = path.join(destination, "assets");
for (const entry of await readdir(assetsDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const cssPath = path.join(assetsDir, entry.name);
  const contents = await readFile(cssPath, "utf8");
  const desktopContents =
    path.extname(entry.name) === ".css"
      ? contents.replace(/url\((['"]?)\/fonts\//g, "url($1../fonts/")
      : contents.replace(
          /function\((\w+)\)\{return"\/"\+\1\}/g,
          'function($1){return"./"+$1}',
        );
  await writeFile(cssPath, desktopContents, "utf8");
}
