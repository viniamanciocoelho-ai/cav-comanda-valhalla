import { sql } from "drizzle-orm";
import { db } from "./index";

let pronto: Promise<void> | null = null;

export function garantirBanco(): Promise<void> {
  pronto ??= criarEstrutura();
  return pronto;
}

async function criarEstrutura() {
  const comandos = [
    `CREATE TABLE IF NOT EXISTS organizacoes (
      organizacao_id TEXT PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL,
      quantidade_mesas INTEGER NOT NULL DEFAULT 15, largura_recibo INTEGER NOT NULL DEFAULT 80,
      criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS funcionarios (
      organizacao_id TEXT NOT NULL, funcionario_id TEXT NOT NULL, nome TEXT NOT NULL,
      perfil TEXT NOT NULL, pin_hash TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
      PRIMARY KEY (organizacao_id, funcionario_id)
    )`,
    `CREATE INDEX IF NOT EXISTS funcionarios_org_perfil ON funcionarios (organizacao_id, perfil)`,
    `CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY, organizacao_id TEXT NOT NULL, funcionario_id TEXT NOT NULL,
      expira_em TEXT NOT NULL, criado_em TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS sessoes_org_funcionario ON sessoes (organizacao_id, funcionario_id)`,
    `CREATE TABLE IF NOT EXISTS versoes_estado (
      organizacao_id TEXT PRIMARY KEY, versao INTEGER NOT NULL DEFAULT 0, atualizado_em TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mesas (
      organizacao_id TEXT NOT NULL, mesa_id INTEGER NOT NULL, status TEXT NOT NULL,
      ativa INTEGER NOT NULL, pessoas_fixas INTEGER NOT NULL,
      total_fixo_centavos INTEGER NOT NULL, aberta_em TEXT, garcom_id TEXT,
      conta_solicitada INTEGER NOT NULL, servico_incluso INTEGER NOT NULL,
      PRIMARY KEY (organizacao_id, mesa_id)
    )`,
    `CREATE INDEX IF NOT EXISTS mesas_org_status ON mesas (organizacao_id, status)`,
    `CREATE TABLE IF NOT EXISTS pessoas_da_comanda (
      organizacao_id TEXT NOT NULL, pessoa_id TEXT NOT NULL, mesa_id INTEGER NOT NULL,
      nome TEXT NOT NULL, PRIMARY KEY (organizacao_id, pessoa_id)
    )`,
    `CREATE INDEX IF NOT EXISTS pessoas_org_mesa ON pessoas_da_comanda (organizacao_id, mesa_id)`,
    `CREATE TABLE IF NOT EXISTS itens_pedido (
      organizacao_id TEXT NOT NULL, item_id TEXT NOT NULL, pedido_id TEXT, mesa_id INTEGER NOT NULL,
      pessoa_id TEXT NOT NULL, produto_id TEXT NOT NULL, nome TEXT NOT NULL,
      preco_centavos INTEGER NOT NULL, quantidade INTEGER NOT NULL, observacao TEXT NOT NULL,
      destino_producao TEXT NOT NULL, status TEXT NOT NULL, status_anterior TEXT,
      funcionario_id TEXT NOT NULL,
      funcionario_nome TEXT NOT NULL, funcionario_perfil TEXT NOT NULL, criado_em TEXT NOT NULL,
      enviado_em TEXT, atualizado_em TEXT NOT NULL, PRIMARY KEY (organizacao_id, item_id)
    )`,
    `CREATE INDEX IF NOT EXISTS itens_org_mesa ON itens_pedido (organizacao_id, mesa_id)`,
    `CREATE INDEX IF NOT EXISTS itens_org_status ON itens_pedido (organizacao_id, status)`,
    `CREATE TABLE IF NOT EXISTS fichas_producao (
      organizacao_id TEXT NOT NULL, ticket_id TEXT NOT NULL, pedido_id TEXT NOT NULL,
      mesa_id INTEGER NOT NULL, destino_producao TEXT NOT NULL, status TEXT NOT NULL,
      linhas_json TEXT NOT NULL, item_ids_json TEXT NOT NULL, funcionario_id TEXT NOT NULL,
      funcionario_nome TEXT NOT NULL, criado_em TEXT NOT NULL, enviado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL, PRIMARY KEY (organizacao_id, ticket_id)
    )`,
    `CREATE INDEX IF NOT EXISTS fichas_org_status ON fichas_producao (organizacao_id, status)`,
    `CREATE TABLE IF NOT EXISTS fechamentos (
      organizacao_id TEXT NOT NULL, fechamento_id TEXT NOT NULL, mesa_id INTEGER NOT NULL,
      hora TEXT NOT NULL, subtotal_centavos INTEGER NOT NULL, servico_centavos INTEGER NOT NULL,
      total_centavos INTEGER NOT NULL, servico_incluso INTEGER NOT NULL, divisao_json TEXT NOT NULL,
      funcionario_nome TEXT NOT NULL, garcom_nome TEXT, criado_em TEXT NOT NULL,
      PRIMARY KEY (organizacao_id, fechamento_id)
    )`,
    `CREATE INDEX IF NOT EXISTS fechamentos_org_mesa ON fechamentos (organizacao_id, mesa_id)`,
    `CREATE TABLE IF NOT EXISTS encerramentos_sem_consumo (
      organizacao_id TEXT NOT NULL, encerramento_id TEXT NOT NULL, mesa_id INTEGER NOT NULL,
      abertura_id TEXT NOT NULL, motivo TEXT NOT NULL, observacao TEXT NOT NULL,
      rascunhos_descartados INTEGER NOT NULL, funcionario_id TEXT NOT NULL,
      funcionario_nome TEXT NOT NULL, funcionario_perfil TEXT NOT NULL, aberta_em TEXT,
      encerrada_em TEXT NOT NULL, duracao_segundos INTEGER NOT NULL, desfeito_em TEXT,
      PRIMARY KEY (organizacao_id, encerramento_id),
      UNIQUE (organizacao_id, abertura_id)
    )`,
    `CREATE TABLE IF NOT EXISTS cardapio (
      organizacao_id TEXT NOT NULL, produto_id TEXT NOT NULL, nome TEXT NOT NULL,
      preco_centavos INTEGER NOT NULL, destino_producao TEXT NOT NULL, categoria TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (organizacao_id, produto_id)
    )`,
    `CREATE TABLE IF NOT EXISTS auditoria (
      auditoria_id TEXT PRIMARY KEY, organizacao_id TEXT NOT NULL, funcionario_id TEXT NOT NULL,
      acao TEXT NOT NULL, entidade TEXT NOT NULL, entidade_id TEXT, criado_em TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS auditoria_org_criado ON auditoria (organizacao_id, criado_em)`,
  ];

  for (const comando of comandos) {
    await db.run(sql.raw(comando));
  }
}
