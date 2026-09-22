import { createClient, type Client, type InStatement, type Transaction } from "@libsql/client";
import { exportarBanco, gravarBackupLocal, validarIntegridade } from "./backup-core";

export interface SelecaoSalao {
  mesas: number[];
  balcoes: number[];
}

export interface ContagensLimpeza {
  filaImpressoes: number;
  itensFechamento: number;
  cancelamentosAutorizados: number;
  fichasProducao: number;
  itensPedido: number;
  pessoasDaComanda: number;
  fechamentos: number;
  encerramentosSemConsumo: number;
  mesasReiniciadas: number;
  balcoesReiniciados: number;
}

export interface PlanoLimpezaSalao {
  ambiente: string;
  organizacaoId: string;
  selecao: SelecaoSalao;
  marcoCorte: string;
  versaoEstado: number;
  atendimentos: string[];
  contagens: ContagensLimpeza;
  confirmacao: string;
  preservados: string[];
}

export interface ExecucaoLimpezaSalao extends PlanoLimpezaSalao {
  backupArquivo: string;
  auditoriaId: string;
}

const TABELAS_ATENDIMENTO: Array<{ nome: keyof ContagensLimpeza; tabela: string }> = [
  { nome: "filaImpressoes", tabela: "fila_impressoes" },
  { nome: "itensFechamento", tabela: "itens_fechamento" },
  { nome: "cancelamentosAutorizados", tabela: "cancelamentos_autorizados" },
  { nome: "fichasProducao", tabela: "fichas_producao" },
  { nome: "itensPedido", tabela: "itens_pedido" },
  { nome: "pessoasDaComanda", tabela: "pessoas_da_comanda" },
  { nome: "fechamentos", tabela: "fechamentos" },
  { nome: "encerramentosSemConsumo", tabela: "encerramentos_sem_consumo" },
];

const PRESERVADOS = [
  "cadastro e configuracao das mesas selecionadas",
  "cadastro e configuracao dos balcoes selecionados",
  "organizacao, funcionarios, PINs, permissoes e sessoes",
  "cardapio, produtos, categorias, adicionais e fichas tecnicas",
  "impressoras, configuracoes, integracoes e layout",
  "auditoria existente e dados das demais organizacoes",
];

function inteiroPositivo(valor: unknown, nome: string): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 10_000) {
    throw new Error(`${nome} deve conter inteiros entre 1 e 10000.`);
  }
  return numero;
}

function listaIds(valor: number[] | undefined, nome: string): number[] {
  return [...new Set((valor ?? []).map((item) => inteiroPositivo(item, nome)))].sort(
    (a, b) => a - b,
  );
}

function validarSelecao(selecao: SelecaoSalao): SelecaoSalao {
  const normalizada = {
    mesas: listaIds(selecao.mesas, "mesas"),
    balcoes: listaIds(selecao.balcoes, "balcoes"),
  };
  if (!normalizada.mesas.length && !normalizada.balcoes.length) {
    throw new Error("Informe pelo menos uma mesa ou um balcao do salao.");
  }
  return normalizada;
}

function organizacaoValida(valor: string): string {
  const organizacao = valor.trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,60}$/.test(organizacao)) {
    throw new Error("Informe uma organizacao valida.");
  }
  return organizacao;
}

function corteValido(valor: string | Date): string {
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (!Number.isFinite(data.getTime())) throw new Error("Marco de corte invalido.");
  return data.toISOString();
}

function placeholders(valores: unknown[]) {
  return valores.map(() => "?").join(", ");
}

function inClause(coluna: string, valores: number[] | string[]) {
  return `${coluna} IN (${placeholders(valores)})`;
}

function numero(valor: unknown) {
  return Number(valor ?? 0);
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor ? valor : null;
}

function fingerprint(
  organizacaoId: string,
  selecao: SelecaoSalao,
  marcoCorte: string,
  versaoEstado: number,
) {
  return [
    "limpar-salao",
    organizacaoId,
    `v${versaoEstado}`,
    marcoCorte,
    `m${selecao.mesas.join(".") || "-"}`,
    `b${selecao.balcoes.join(".") || "-"}`,
  ].join(":");
}

async function validarAlvo(
  client: Client,
  organizacaoId: string,
  selecao: SelecaoSalao,
  marcoCorte: string,
) {
  const tabelas = [
    ...(selecao.mesas.length
      ? [{ tabela: "mesas", coluna: "mesa_id", ids: selecao.mesas }]
      : []),
    ...(selecao.balcoes.length
      ? [{ tabela: "balcoes", coluna: "balcao_id", ids: selecao.balcoes }]
      : []),
  ];
  for (const alvo of tabelas) {
    const resultado = await client.execute({
      sql: `SELECT COUNT(*) AS total FROM ${alvo.tabela}
        WHERE organizacao_id = ? AND ${inClause(alvo.coluna, alvo.ids)}`,
      args: [organizacaoId, ...alvo.ids],
    });
    if (numero(resultado.rows[0]?.total) !== alvo.ids.length) {
      throw new Error(`A selecao contem ${alvo.tabela} inexistente(s).`);
    }
  }

  const datas = [
    ["mesas", "mesa_id", "aberta_em"],
    ["balcoes", "balcao_id", "aberta_em"],
    ["itens_pedido", "mesa_id", "criado_em"],
    ["itens_pedido", "balcao_id", "criado_em"],
    ["fichas_producao", "mesa_id", "criado_em"],
    ["fichas_producao", "balcao_id", "criado_em"],
    ["fechamentos", "mesa_id", "criado_em"],
    ["fechamentos", "balcao_id", "criado_em"],
    ["itens_fechamento", "mesa_id", "criado_em"],
    ["itens_fechamento", "balcao_id", "criado_em"],
    ["cancelamentos_autorizados", "mesa_id", "autorizado_em"],
    ["cancelamentos_autorizados", "balcao_id", "autorizado_em"],
    ["encerramentos_sem_consumo", "mesa_id", "encerrada_em"],
    ["encerramentos_sem_consumo", "balcao_id", "encerrada_em"],
    ["fila_impressoes", "mesa_id", "criado_em"],
    ["fila_impressoes", "balcao_id", "criado_em"],
  ] as const;
  for (const [tabela, colunaId, colunaData] of datas) {
    const ids = colunaId === "mesa_id" ? selecao.mesas : selecao.balcoes;
    if (!ids.length) continue;
    const resultado = await client.execute({
      sql: `SELECT COUNT(*) AS total FROM ${tabela}
        WHERE organizacao_id = ? AND ${inClause(colunaId, ids)}
        AND ${colunaData} > ?`,
      args: [organizacaoId, ...ids, marcoCorte],
    });
    if (numero(resultado.rows[0]?.total) > 0) {
      throw new Error(
        `Existem dados posteriores ao marco em ${tabela}; escolha outro corte ou aguarde o salao.`,
      );
    }
  }
}

async function idsAtendimentos(
  client: Client,
  organizacaoId: string,
  selecao: SelecaoSalao,
  marcoCorte: string,
) {
  const atendimentos = new Set<string>();
  const locais: InStatement[] = [];
  if (selecao.mesas.length) {
    locais.push({
      sql: `SELECT atendimento_id, aberta_em FROM mesas
        WHERE organizacao_id = ? AND ${inClause("mesa_id", selecao.mesas)}
        AND atendimento_id IS NOT NULL`,
      args: [organizacaoId, ...selecao.mesas],
    });
  }
  if (selecao.balcoes.length) {
    locais.push({
      sql: `SELECT atendimento_id, aberta_em FROM balcoes
        WHERE organizacao_id = ? AND ${inClause("balcao_id", selecao.balcoes)}
        AND atendimento_id IS NOT NULL`,
      args: [organizacaoId, ...selecao.balcoes],
    });
  }
  for (const consulta of locais) {
    const resultado = await client.execute(consulta);
    for (const linha of resultado.rows) {
      const atendimento = texto(linha.atendimento_id);
      const abertaEm = texto(linha.aberta_em);
      if (atendimento && (!abertaEm || Date.parse(abertaEm) <= Date.parse(marcoCorte))) {
        atendimentos.add(atendimento);
      }
    }
  }

  const filtros = [
    ...(selecao.mesas.length ? [{ coluna: "mesa_id", ids: selecao.mesas }] : []),
    ...(selecao.balcoes.length ? [{ coluna: "balcao_id", ids: selecao.balcoes }] : []),
  ];
  const fontes = [
    ["itens_pedido", "criado_em"],
    ["fichas_producao", "criado_em"],
    ["fechamentos", "criado_em"],
    ["itens_fechamento", "criado_em"],
    ["cancelamentos_autorizados", "autorizado_em"],
    ["encerramentos_sem_consumo", "encerrada_em"],
    ["fila_impressoes", "criado_em"],
  ] as const;
  for (const [tabela, data] of fontes) {
    for (const filtro of filtros) {
      const resultado = await client.execute({
        sql: `SELECT atendimento_id FROM ${tabela}
          WHERE organizacao_id = ? AND ${inClause(filtro.coluna, filtro.ids)}
          AND ${data} <= ?`,
        args: [organizacaoId, ...filtro.ids, marcoCorte],
      });
      for (const linha of resultado.rows) {
        const atendimento = texto(linha.atendimento_id);
        if (atendimento) atendimentos.add(atendimento);
      }
    }
  }
  return [...atendimentos].sort();
}

async function contar(
  client: Client,
  organizacaoId: string,
  atendimentos: string[],
  selecao: SelecaoSalao,
  marcoCorte: string,
): Promise<ContagensLimpeza> {
  const resultado = {
    filaImpressoes: 0,
    itensFechamento: 0,
    cancelamentosAutorizados: 0,
    fichasProducao: 0,
    itensPedido: 0,
    pessoasDaComanda: 0,
    fechamentos: 0,
    encerramentosSemConsumo: 0,
    mesasReiniciadas: 0,
    balcoesReiniciados: 0,
  };
  if (atendimentos.length) {
    for (const item of TABELAS_ATENDIMENTO) {
      const leitura = await client.execute({
        sql: `SELECT COUNT(*) AS total FROM ${item.tabela}
          WHERE organizacao_id = ? AND ${inClause("atendimento_id", atendimentos)}`,
        args: [organizacaoId, ...atendimentos],
      });
      resultado[item.nome] = numero(leitura.rows[0]?.total);
    }
  }
  if (selecao.mesas.length) {
    const leitura = await client.execute({
      sql: `SELECT COUNT(*) AS total FROM mesas
        WHERE organizacao_id = ? AND ${inClause("mesa_id", selecao.mesas)}
        AND ativa = 1 AND atendimento_id IS NOT NULL AND aberta_em <= ?`,
      args: [organizacaoId, ...selecao.mesas, marcoCorte],
    });
    resultado.mesasReiniciadas = numero(leitura.rows[0]?.total);
  }
  if (selecao.balcoes.length) {
    const leitura = await client.execute({
      sql: `SELECT COUNT(*) AS total FROM balcoes
        WHERE organizacao_id = ? AND ${inClause("balcao_id", selecao.balcoes)}
        AND ativa = 1 AND atendimento_id IS NOT NULL AND aberta_em <= ?`,
      args: [organizacaoId, ...selecao.balcoes, marcoCorte],
    });
    resultado.balcoesReiniciados = numero(leitura.rows[0]?.total);
  }
  return resultado;
}

export async function planejarLimpezaSalao(
  client: Client,
  organizacaoRecebida: string,
  selecaoRecebida: SelecaoSalao,
  marcoRecebido: string | Date,
): Promise<PlanoLimpezaSalao> {
  const organizacaoId = organizacaoValida(organizacaoRecebida);
  const selecao = validarSelecao(selecaoRecebida);
  const marcoCorte = corteValido(marcoRecebido);
  const organizacao = await client.execute({
    sql: "SELECT organizacao_id FROM organizacoes WHERE organizacao_id = ? LIMIT 1",
    args: [organizacaoId],
  });
  if (!organizacao.rows.length) throw new Error(`Organizacao nao encontrada: ${organizacaoId}`);
  await validarAlvo(client, organizacaoId, selecao, marcoCorte);
  const versao = await client.execute({
    sql: "SELECT versao FROM versoes_estado WHERE organizacao_id = ?",
    args: [organizacaoId],
  });
  if (!versao.rows.length) throw new Error("Versao operacional ausente para a organizacao.");
  const versaoEstado = numero(versao.rows[0]?.versao);
  const atendimentos = await idsAtendimentos(client, organizacaoId, selecao, marcoCorte);
  return {
    ambiente: process.env.NODE_ENV?.trim() || "desconhecido",
    organizacaoId,
    selecao,
    marcoCorte,
    versaoEstado,
    atendimentos,
    contagens: await contar(client, organizacaoId, atendimentos, selecao, marcoCorte),
    confirmacao: fingerprint(organizacaoId, selecao, marcoCorte, versaoEstado),
    preservados: PRESERVADOS,
  };
}

async function verificarResponsavel(client: Client, organizacaoId: string, funcionarioId: string) {
  const resultado = await client.execute({
    sql: `SELECT funcionario_id FROM funcionarios
      WHERE organizacao_id = ? AND funcionario_id = ? AND perfil = 'gerencia' AND ativo = 1`,
    args: [organizacaoId, funcionarioId.trim()],
  });
  if (!resultado.rows.length) {
    throw new Error("O responsavel deve ser um funcionario de gerencia ativo da organizacao.");
  }
}

function comandosExclusao(organizacaoId: string, atendimentos: string[]): InStatement[] {
  if (!atendimentos.length) return [];
  return [
    "fila_impressoes",
    "itens_fechamento",
    "cancelamentos_autorizados",
    "fichas_producao",
    "itens_pedido",
    "pessoas_da_comanda",
    "fechamentos",
    "encerramentos_sem_consumo",
  ].map((tabela) => ({
    sql: `DELETE FROM ${tabela}
      WHERE organizacao_id = ? AND ${inClause("atendimento_id", atendimentos)}`,
    args: [organizacaoId, ...atendimentos],
  }));
}

async function confirmarZerado(tx: Transaction, plano: PlanoLimpezaSalao) {
  if (!plano.atendimentos.length) return;
  for (const tabela of TABELAS_ATENDIMENTO) {
    const resultado = await tx.execute({
      sql: `SELECT COUNT(*) AS total FROM ${tabela.tabela}
        WHERE organizacao_id = ? AND ${inClause("atendimento_id", plano.atendimentos)}`,
      args: [plano.organizacaoId, ...plano.atendimentos],
    });
    if (numero(resultado.rows[0]?.total) !== 0) {
      throw new Error(`Apos a limpeza ainda existem registros em ${tabela.tabela}.`);
    }
  }
}

export async function limparSalao(
  client: Client,
  opcoes: {
    organizacaoId: string;
    selecao: SelecaoSalao;
    marcoCorte: string | Date;
    responsavelId: string;
    backupDir: string;
    confirmacao: string;
  },
): Promise<ExecucaoLimpezaSalao> {
  const planoAntes = await planejarLimpezaSalao(
    client,
    opcoes.organizacaoId,
    opcoes.selecao,
    opcoes.marcoCorte,
  );
  await verificarResponsavel(client, planoAntes.organizacaoId, opcoes.responsavelId);
  if (opcoes.confirmacao !== planoAntes.confirmacao) {
    throw new Error(`Confirmacao invalida. Use exatamente: ${planoAntes.confirmacao}`);
  }

  const backup = await exportarBanco(client, new Date());
  validarIntegridade(backup);
  const backupArquivo = await gravarBackupLocal(backup, opcoes.backupDir, new Date());
  const plano = await planejarLimpezaSalao(
    client,
    opcoes.organizacaoId,
    opcoes.selecao,
    opcoes.marcoCorte,
  );
  if (plano.confirmacao !== planoAntes.confirmacao) {
    throw new Error("O salao mudou durante o backup. A limpeza foi cancelada.");
  }

  const auditoriaId = crypto.randomUUID();
  const tx = await client.transaction("write");
  try {
    const versaoAtualizada = await tx.execute({
      sql: `UPDATE versoes_estado
        SET versao = versao + 1, atualizado_em = ?
        WHERE organizacao_id = ? AND versao = ?`,
      args: [new Date().toISOString(), plano.organizacaoId, plano.versaoEstado],
    });
    if (versaoAtualizada.rowsAffected !== 1) {
      throw new Error("O salao mudou durante a preparacao. Tente novamente.");
    }
    await tx.batch(comandosExclusao(plano.organizacaoId, plano.atendimentos));
    if (plano.selecao.mesas.length) {
      const atendimentoMesa =
        plano.atendimentos.length > 0
          ? `OR atendimento_id IN (${placeholders(plano.atendimentos)})`
          : "";
      await tx.execute({
        sql: `UPDATE mesas SET status = 'livre', ativa = 0, atendimento_id = NULL,
          pessoas_fixas = 0, total_fixo_centavos = 0, aberta_em = NULL, garcom_id = NULL,
          conta_solicitada = 0, servico_incluso = 1
          WHERE organizacao_id = ? AND ${inClause("mesa_id", plano.selecao.mesas)}
          AND (atendimento_id IS NULL ${atendimentoMesa})`,
        args: [
          plano.organizacaoId,
          ...plano.selecao.mesas,
          ...plano.atendimentos,
        ],
      });
    }
    if (plano.selecao.balcoes.length) {
      const atendimentoBalcao =
        plano.atendimentos.length > 0
          ? `OR atendimento_id IN (${placeholders(plano.atendimentos)})`
          : "";
      await tx.execute({
        sql: `UPDATE balcoes SET status = 'livre', ativa = 0, atendimento_id = NULL,
          aberta_em = NULL, garcom_id = NULL, conta_solicitada = 0, servico_incluso = 1
          WHERE organizacao_id = ? AND ${inClause("balcao_id", plano.selecao.balcoes)}
          AND (atendimento_id IS NULL ${atendimentoBalcao})`,
        args: [
          plano.organizacaoId,
          ...plano.selecao.balcoes,
          ...plano.atendimentos,
        ],
      });
    }
    await tx.execute({
      sql: `INSERT INTO auditoria
        (auditoria_id, organizacao_id, funcionario_id, acao, entidade, entidade_id, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        auditoriaId,
        plano.organizacaoId,
        opcoes.responsavelId.trim(),
        "limpar_salao",
        "salao",
        plano.confirmacao,
        new Date().toISOString(),
      ],
    });
    await confirmarZerado(tx, plano);
    await tx.commit();
  } catch (erro) {
    await tx.rollback().catch(() => undefined);
    throw erro;
  } finally {
    tx.close();
  }
  return { ...plano, backupArquivo, auditoriaId };
}

function argumento(prefixo: string) {
  return Bun.argv.slice(2).find((valor) => valor.startsWith(prefixo))?.slice(prefixo.length);
}

function idsArgumento(valor: string | undefined): number[] {
  return (valor ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => inteiroPositivo(item, "ids"));
}

if (import.meta.main) {
  const organizacaoId = argumento("--organizacao=");
  const marco = argumento("--marco=") ?? new Date().toISOString();
  const selecao = {
    mesas: idsArgumento(argumento("--mesas=")),
    balcoes: idsArgumento(argumento("--balcoes=")),
  };
  if (!organizacaoId) {
    throw new Error(
      "Uso: bun scripts/limpar-operacao.ts --organizacao=valhalla --mesas=1,2 --balcoes=1,2",
    );
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada.");
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  try {
    const plano = await planejarLimpezaSalao(client, organizacaoId, selecao, marco);
    console.log(JSON.stringify(plano, null, 2));
    if (!Bun.argv.includes("--executar")) {
      console.log("Simulacao concluida. Nenhuma alteracao foi feita.");
      console.log(`Para executar, repita com --executar --confirmar=${plano.confirmacao}`);
      process.exit(0);
    }
    const responsavelId = argumento("--responsavel=");
    const backupDir = argumento("--backup-dir=");
    const confirmacao = argumento("--confirmar=");
    if (!responsavelId || !backupDir || !confirmacao) {
      throw new Error(
        "Execucao exige --responsavel, --backup-dir e --confirmar com o codigo da simulacao.",
      );
    }
    const resultado = await limparSalao(client, {
      organizacaoId,
      selecao,
      marcoCorte: marco,
      responsavelId,
      backupDir,
      confirmacao,
    });
    console.log(JSON.stringify({ ...resultado, status: "executado" }, null, 2));
  } finally {
    client.close();
  }
}
