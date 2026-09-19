import path from "node:path";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@libsql/client";
import {
  aplicarRetencaoLocal,
  exportarBanco,
  gravarBackupLocal,
} from "./backup-core";

export interface ResultadoBackup {
  arquivo: string;
  chaveS3: string | null;
  erroS3: string | null;
}

function inteiroPositivo(valor: string | undefined, fallback: number) {
  const numero = valor ? Number(valor) : fallback;
  if (!Number.isInteger(numero) || numero < 1) {
    throw new Error("CAV_BACKUP_RETENTION deve ser um inteiro maior que zero.");
  }
  return numero;
}

function clienteS3DoAmbiente() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const faltantes = [
    ["S3_ENDPOINT", endpoint],
    ["S3_BUCKET", bucket],
    ["S3_ACCESS_KEY_ID", accessKeyId],
    ["S3_SECRET_ACCESS_KEY", secretAccessKey],
  ]
    .filter(([, valor]) => !valor)
    .map(([nome]) => nome);
  if (faltantes.length > 0) {
    throw new Error(`Configuração S3 incompleta. Defina: ${faltantes.join(", ")}.`);
  }
  return {
    bucket,
    client: new S3Client({
      endpoint,
      region: process.env.S3_REGION?.trim() || "auto",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

async function reterS3(client: S3Client, bucket: string, manter: number) {
  const resposta = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: "cav-comanda/" }),
  );
  const antigos = [...(resposta.Contents ?? [])]
    .filter((item) => item.Key)
    .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
    .slice(manter)
    .map((item) => ({ Key: item.Key! }));
  if (antigos.length) {
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: antigos } }));
  }
}

export async function executarBackup(options?: {
  agora?: Date;
  diretorio?: string;
  retencao?: number;
  enviarS3?: (arquivo: string, conteudo: Uint8Array) => Promise<string>;
}): Promise<ResultadoBackup> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
  const agora = options?.agora ?? new Date();
  const diretorio =
    options?.diretorio ??
    path.resolve(import.meta.dir, "..", "..", "..", process.env.CAV_BACKUP_DIR || "backups");
  const retencao =
    options?.retencao ?? inteiroPositivo(process.env.CAV_BACKUP_RETENTION, 30);
  const db = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  try {
    const backup = await exportarBanco(db, agora);
    const arquivo = await gravarBackupLocal(backup, diretorio, agora);
    await aplicarRetencaoLocal(diretorio, retencao);
    try {
      if (options?.enviarS3) {
        const chaveS3 = await options.enviarS3(arquivo, await Bun.file(arquivo).bytes());
        return { arquivo, chaveS3, erroS3: null };
      }
      const { client, bucket } = clienteS3DoAmbiente();
      try {
        const chaveS3 = `cav-comanda/${path.basename(arquivo)}`;
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: chaveS3,
            Body: await Bun.file(arquivo).bytes(),
            ContentType: "application/json",
          }),
        );
        await reterS3(client, bucket, retencao);
        return { arquivo, chaveS3, erroS3: null };
      } finally {
        client.destroy();
      }
    } catch (erro) {
      return {
        arquivo,
        chaveS3: null,
        erroS3: erro instanceof Error ? erro.message : String(erro),
      };
    }
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  const resultado = await executarBackup();
  console.log(`Backup local criado: ${resultado.arquivo}`);
  if (resultado.erroS3) {
    console.error(`Falha no envio ao S3: ${resultado.erroS3}`);
    process.exitCode = 1;
  } else {
    console.log(`Backup enviado ao S3: ${resultado.chaveS3}`);
  }
}
