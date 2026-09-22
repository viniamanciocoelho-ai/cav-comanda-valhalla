import { createClient, type Client } from "@libsql/client";

export interface ResultadoLimpeza {
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

export async function limparOperacao(
  client: Client,
  organizacaoId: string,
): Promise<ResultadoLimpeza> {
  const organizacao = organizacaoId.trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(organizacao)) {
    throw new Error("Informe uma organização válida.");
  }

  const existente = await client.execute({
    sql: "SELECT organizacao_id FROM organizacoes WHERE organizacao_id = ? LIMIT 1",
    args: [organizacao],
  });
  if (!existente.rows.length) {
    throw new Error(`Organização não encontrada: ${organizacao}`);
  }

  const resultados = await client.batch(
    [
      {
        sql: "DELETE FROM fila_impressoes WHERE organizacao_id = ?",
        args: [organizacao],
      },
      {
        sql: "DELETE FROM itens_fechamento WHERE organizacao_id = ?",
        args: [organizacao],
      },
      {
        sql: "DELETE FROM cancelamentos_autorizados WHERE organizacao_id = ?",
        args: [organizacao],
      },
      {
        sql: "DELETE FROM fichas_producao WHERE organizacao_id = ?",
        args: [organizacao],
      },
      {
        sql: "DELETE FROM itens_pedido WHERE organizacao_id = ?",
        args: [organizacao],
      },
      {
        sql: "DELETE FROM pessoas_da_comanda WHERE organizacao_id = ?",
        args: [organizacao],
      },
      {
        sql: "DELETE FROM fechamentos WHERE organizacao_id = ?",
        args: [organizacao],
      },
      {
        sql: "DELETE FROM encerramentos_sem_consumo WHERE organizacao_id = ?",
        args: [organizacao],
      },
      {
        sql: `UPDATE mesas
          SET status = 'livre',
              ativa = 0,
              atendimento_id = NULL,
              pessoas_fixas = 0,
              total_fixo_centavos = 0,
              aberta_em = NULL,
              garcom_id = NULL,
              conta_solicitada = 0,
              servico_incluso = 1
          WHERE organizacao_id = ?`,
        args: [organizacao],
      },
      {
        sql: `UPDATE balcoes
          SET status = 'livre',
              ativa = 0,
              atendimento_id = NULL,
              aberta_em = NULL,
              garcom_id = NULL,
              conta_solicitada = 0,
              servico_incluso = 1
          WHERE organizacao_id = ?`,
        args: [organizacao],
      },
      {
        sql: `UPDATE versoes_estado
          SET versao = versao + 1, atualizado_em = ?
          WHERE organizacao_id = ?`,
        args: [new Date().toISOString(), organizacao],
      },
    ],
    "write",
  );

  return {
    filaImpressoes: resultados[0]?.rowsAffected ?? 0,
    itensFechamento: resultados[1]?.rowsAffected ?? 0,
    cancelamentosAutorizados: resultados[2]?.rowsAffected ?? 0,
    fichasProducao: resultados[3]?.rowsAffected ?? 0,
    itensPedido: resultados[4]?.rowsAffected ?? 0,
    pessoasDaComanda: resultados[5]?.rowsAffected ?? 0,
    fechamentos: resultados[6]?.rowsAffected ?? 0,
    encerramentosSemConsumo: resultados[7]?.rowsAffected ?? 0,
    mesasReiniciadas: resultados[8]?.rowsAffected ?? 0,
    balcoesReiniciados: resultados[9]?.rowsAffected ?? 0,
  };
}

function organizacaoDosArgumentos() {
  const argumentos = Bun.argv.slice(2);
  const nomeado = argumentos.find((argumento) =>
    argumento.startsWith("--organizacao="),
  );
  return nomeado?.slice("--organizacao=".length) ?? argumentos[0] ?? "";
}

if (import.meta.main) {
  const organizacaoId = organizacaoDosArgumentos();
  if (!organizacaoId) {
    throw new Error(
      "Uso: bun scripts/limpar-operacao.ts --organizacao=valhalla",
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  try {
    const resultado = await limparOperacao(client, organizacaoId);
    console.log(`Limpeza concluída para ${organizacaoId}:`);
    console.table(resultado);
  } finally {
    client.close();
  }
}
