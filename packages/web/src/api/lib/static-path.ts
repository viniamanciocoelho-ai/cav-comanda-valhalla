import { isAbsolute, relative, resolve, sep } from "node:path";

export function resolverArquivoEstatico(
  distDir: string,
  indexPath: string,
  pathname: string,
) {
  let caminhoDecodificado: string;

  try {
    caminhoDecodificado = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (caminhoDecodificado.includes("\0")) return null;

  const caminhoSolicitado = caminhoDecodificado.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!caminhoSolicitado) {
    return resolve(indexPath);
  }

  const raiz = resolve(distDir);
  const candidato = resolve(raiz, caminhoSolicitado);
  const caminhoRelativo = relative(raiz, candidato);
  const saiuDaRaiz =
    caminhoRelativo === ".." ||
    caminhoRelativo.startsWith(`..${sep}`) ||
    isAbsolute(caminhoRelativo);

  return saiuDaRaiz ? null : candidato;
}
