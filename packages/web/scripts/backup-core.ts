import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Client, InStatement } from "@libsql/client";

export const TABELAS_BACKUP = {
  organizacoes: [
    "organizacao_id",
    "codigo",
    "nome",
    "quantidade_mesas",
    "largura_recibo",
    "criado_em",
    "atualizado_em",
  ],
  funcionarios: [
    "organizacao_id",
    "funcionario_id",
    "nome",
    "perfil",
    "pin_hash",
    "ativo",
    "criado_em",
    "atualizado_em",
  ],
  sessoes: ["token_hash", "organizacao_id", "funcionario_id", "expira_em", "criado_em"],
  versoes_estado: ["organizacao_id", "versao", "atualizado_em"],
  mesas: [
    "organizacao_id",
    "mesa_id",
    "status",
    "ativa",
    "pessoas_fixas",
    "total_fixo_centavos",
    "aberta_em",
    "garcom_id",
    "conta_solicitada",
    "servico_incluso",
  ],
  pessoas_da_comanda: ["organizacao_id", "pessoa_id", "mesa_id", "nome"],
  itens_pedido: [
    "organizacao_id",
    "item_id",
    "pedido_id",
    "mesa_id",
    "pessoa_id",
    "produto_id",
    "nome",
    "preco_centavos",
    "quantidade",
    "observacao",
    "destino_producao",
    "status",
    "status_anterior",
    "funcionario_id",
    "funcionario_nome",
    "funcionario_perfil",
    "criado_em",
    "enviado_em",
    "atualizado_em",
  ],
  fichas_producao: [
    "organizacao_id",
    "ticket_id",
    "pedido_id",
    "mesa_id",
    "destino_producao",
    "status",
    "linhas_json",
    "item_ids_json",
    "funcionario_id",
    "funcionario_nome",
    "criado_em",
    "enviado_em",
    "atualizado_em",
  ],
  fechamentos: [
    "organizacao_id",
    "fechamento_id",
    "mesa_id",
    "hora",
    "subtotal_centavos",
    "servico_centavos",
    "total_centavos",
    "servico_incluso",
    "divisao_json",
    "funcionario_nome",
    "garcom_nome",
    "criado_em",
  ],
  encerramentos_sem_consumo: [
    "organizacao_id",
    "encerramento_id",
    "mesa_id",
    "abertura_id",
    "motivo",
    "observacao",
    "rascunhos_descartados",
    "funcionario_id",
    "funcionario_nome",
    "funcionario_perfil",
    "aberta_em",
    "encerrada_em",
    "duracao_segundos",
    "desfeito_em",
  ],
  cardapio: [
    "organizacao_id",
    "produto_id",
    "nome",
    "preco_centavos",
    "destino_producao",
    "categoria",
    "ativo",
  ],
  auditoria: [
    "auditoria_id",
    "organizacao_id",
    "funcionario_id",
    "acao",
    "entidade",
    "entidade_id",
    "criado_em",
  ],
  impressoras: [
    "organizacao_id",
    "destino",
    "nome",
    "host",
    "porta",
    "largura",
    "ativa",
    "criado_em",
    "atualizado_em",
  ],
  fila_impressoes: [
    "organizacao_id",
    "impressao_id",
    "destino",
    "tipo",
    "referencia_id",
    "mesa_id",
    "texto",
    "largura",
    "status",
    "tentativas",
    "ultimo_erro",
    "criado_em",
    "atualizado_em",
  ],
} as const;

export type NomeTabelaBackup = keyof typeof TABELAS_BACKUP;
export type RegistroBackup = Record<string, string | number | null>;

export interface ArquivoBackup {
  formato: "cav-comanda-backup";
  versao: 1;
  criadoEm: string;
  organizacoesIncluidas: string[];
  tabelas: Record<NomeTabelaBackup, RegistroBackup[]>;
}

const ORDEM_RESTAURACAO = Object.keys(TABELAS_BACKUP) as NomeTabelaBackup[];
const ORDEM_EXCLUSAO = [...ORDEM_RESTAURACAO].reverse();

function consultaTabela(tabela: NomeTabelaBackup) {
  return `SELECT * FROM "${tabela}"`;
}

function exclusaoTabela(tabela: NomeTabelaBackup) {
  return `DELETE FROM "${tabela}"`;
}

function insercaoTabela(tabela: NomeTabelaBackup) {
  const colunas = TABELAS_BACKUP[tabela];
  const nomes = colunas.map((coluna) => `"${coluna}"`).join(", ");
  const valores = colunas.map(() => "?").join(", ");
  return `INSERT INTO "${tabela}" (${nomes}) VALUES (${valores})`;
}

export async function exportarBanco(client: Client, agora = new Date()): Promise<ArquivoBackup> {
  const tabelas = {} as ArquivoBackup["tabelas"];
  for (const tabela of ORDEM_RESTAURACAO) {
    const resultado = await client.execute(consultaTabela(tabela));
    const colunas = TABELAS_BACKUP[tabela];
    tabelas[tabela] = resultado.rows.map((linha) =>
      Object.fromEntries(colunas.map((coluna) => [coluna, linha[coluna] ?? null])),
    ) as RegistroBackup[];
  }
  return {
    formato: "cav-comanda-backup",
    versao: 1,
    criadoEm: agora.toISOString(),
    organizacoesIncluidas: tabelas.organizacoes.map((registro) =>
      String(registro.organizacao_id),
    ),
    tabelas,
  };
}

export function validarIntegridade(backup: unknown): asserts backup is ArquivoBackup {
  if (!backup || typeof backup !== "object") throw new Error("Backup ilegível.");
  const candidato = backup as Partial<ArquivoBackup>;
  if (candidato.formato !== "cav-comanda-backup" || candidato.versao !== 1) {
    throw new Error("Formato de backup não reconhecido.");
  }
  if (!candidato.criadoEm || !Number.isFinite(Date.parse(candidato.criadoEm))) {
    throw new Error("Backup sem data válida.");
  }
  if (!candidato.tabelas || typeof candidato.tabelas !== "object") {
    throw new Error("Backup sem tabelas.");
  }
  for (const [tabela, colunas] of Object.entries(TABELAS_BACKUP) as [
    NomeTabelaBackup,
    readonly string[],
  ][]) {
    const registros = candidato.tabelas[tabela];
    if (!Array.isArray(registros)) throw new Error(`Tabela ausente no backup: ${tabela}.`);
    for (const registro of registros) {
      if (!registro || typeof registro !== "object") {
        throw new Error(`Registro inválido na tabela ${tabela}.`);
      }
      for (const coluna of colunas) {
        if (!(coluna in registro)) {
          throw new Error(`Coluna ausente no backup: ${tabela}.${coluna}.`);
        }
      }
    }
  }
}

function nomeDoArquivo(data: Date) {
  return `cav-comanda-${data.toISOString().replaceAll(":", "-")}.json`;
}

export async function gravarBackupLocal(
  backup: ArquivoBackup,
  diretorio: string,
  data = new Date(backup.criadoEm),
) {
  await mkdir(diretorio, { recursive: true });
  const arquivo = path.join(diretorio, nomeDoArquivo(data));
  await writeFile(arquivo, `${JSON.stringify(backup, null, 2)}\n`, "utf8");
  const relido = JSON.parse(await readFile(arquivo, "utf8")) as unknown;
  validarIntegridade(relido);
  return arquivo;
}

export async function aplicarRetencaoLocal(diretorio: string, manter: number) {
  if (!Number.isInteger(manter) || manter < 1) {
    throw new Error("CAV_BACKUP_RETENTION deve ser um inteiro maior que zero.");
  }
  const arquivos = (await readdir(diretorio, { withFileTypes: true }))
    .filter(
      (entrada) =>
        entrada.isFile() &&
        entrada.name.startsWith("cav-comanda-") &&
        entrada.name.endsWith(".json"),
    )
    .map((entrada) => entrada.name)
    .sort()
    .reverse();
  const removidos = arquivos.slice(manter);
  await Promise.all(removidos.map((arquivo) => rm(path.join(diretorio, arquivo), { force: true })));
  return removidos;
}

export async function lerBackup(arquivo: string): Promise<ArquivoBackup> {
  const backup = JSON.parse(await readFile(arquivo, "utf8")) as unknown;
  validarIntegridade(backup);
  return backup;
}

export function validarConfirmacaoRestauracao(backup: ArquivoBackup, confirmacao?: string) {
  const esperado = backup.organizacoesIncluidas.sort().join(",");
  if (!confirmacao || confirmacao !== esperado) {
    throw new Error(
      `Restauração bloqueada. Repita com --confirmar=${esperado} para sobrescrever os dados.`,
    );
  }
}

export async function restaurarBanco(
  client: Client,
  backup: ArquivoBackup,
  confirmacao?: string,
) {
  validarIntegridade(backup);
  validarConfirmacaoRestauracao(backup, confirmacao);
  const comandos: InStatement[] = [];
  for (const tabela of ORDEM_EXCLUSAO) {
    comandos.push({ sql: exclusaoTabela(tabela), args: [] });
  }
  for (const tabela of ORDEM_RESTAURACAO) {
    const colunas = TABELAS_BACKUP[tabela];
    const sql = insercaoTabela(tabela);
    for (const registro of backup.tabelas[tabela]) {
      comandos.push({
        sql,
        args: colunas.map((coluna) => registro[coluna] ?? null),
      });
    }
  }
  await client.batch(comandos, "write");
  const restaurado = await exportarBanco(client, new Date(backup.criadoEm));
  for (const tabela of ORDEM_RESTAURACAO) {
    if (restaurado.tabelas[tabela].length !== backup.tabelas[tabela].length) {
      throw new Error(`Restauração incompleta na tabela ${tabela}.`);
    }
  }
}
