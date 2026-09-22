import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const organizacoes = sqliteTable(
  "organizacoes",
  {
    organizacaoId: text("organizacao_id").primaryKey(),
    codigo: text("codigo").notNull(),
    nome: text("nome").notNull(),
    quantidadeMesas: integer("quantidade_mesas").notNull().default(15),
    larguraRecibo: integer("largura_recibo").notNull().default(80),
    criadoEm: text("criado_em").notNull(),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (table) => [uniqueIndex("organizacoes_codigo_unico").on(table.codigo)],
);

export const funcionarios = sqliteTable(
  "funcionarios",
  {
    organizacaoId: text("organizacao_id").notNull(),
    funcionarioId: text("funcionario_id").notNull(),
    nome: text("nome").notNull(),
    perfil: text("perfil", {
      enum: ["gerencia", "garcom", "producao", "caixa"],
    }).notNull(),
    pinHash: text("pin_hash").notNull(),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
    criadoEm: text("criado_em").notNull(),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.funcionarioId] }),
    index("funcionarios_org_perfil").on(table.organizacaoId, table.perfil),
  ],
);

export const sessoes = sqliteTable(
  "sessoes",
  {
    tokenHash: text("token_hash").primaryKey(),
    organizacaoId: text("organizacao_id").notNull(),
    funcionarioId: text("funcionario_id").notNull(),
    expiraEm: text("expira_em").notNull(),
    criadoEm: text("criado_em").notNull(),
  },
  (table) => [index("sessoes_org_funcionario").on(table.organizacaoId, table.funcionarioId)],
);

export const versoesEstado = sqliteTable("versoes_estado", {
  organizacaoId: text("organizacao_id").primaryKey(),
  versao: integer("versao").notNull().default(0),
  atualizadoEm: text("atualizado_em").notNull(),
});

export const mesas = sqliteTable(
  "mesas",
  {
    organizacaoId: text("organizacao_id").notNull(),
    mesaId: integer("mesa_id").notNull(),
    atendimentoId: text("atendimento_id"),
    status: text("status", { enum: ["livre", "ocupada", "aguardando"] }).notNull(),
    ativa: integer("ativa", { mode: "boolean" }).notNull(),
    pessoasFixas: integer("pessoas_fixas").notNull(),
    totalFixoCentavos: integer("total_fixo_centavos").notNull(),
    abertaEm: text("aberta_em"),
    garcomId: text("garcom_id"),
    contaSolicitada: integer("conta_solicitada", { mode: "boolean" }).notNull(),
    servicoIncluso: integer("servico_incluso", { mode: "boolean" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.mesaId] }),
    index("mesas_org_status").on(table.organizacaoId, table.status),
  ],
);

export const balcoes = sqliteTable(
  "balcoes",
  {
    organizacaoId: text("organizacao_id").notNull(),
    balcaoId: integer("balcao_id").notNull(),
    atendimentoId: text("atendimento_id"),
    status: text("status", { enum: ["livre", "ocupada", "aguardando"] }).notNull(),
    ativa: integer("ativa", { mode: "boolean" }).notNull(),
    abertaEm: text("aberta_em"),
    garcomId: text("garcom_id"),
    contaSolicitada: integer("conta_solicitada", { mode: "boolean" }).notNull(),
    servicoIncluso: integer("servico_incluso", { mode: "boolean" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.balcaoId] }),
    index("balcoes_org_status").on(table.organizacaoId, table.status),
  ],
);

export const pessoasDaComanda = sqliteTable(
  "pessoas_da_comanda",
  {
    organizacaoId: text("organizacao_id").notNull(),
    pessoaId: text("pessoa_id").notNull(),
    atendimentoId: text("atendimento_id").notNull(),
    mesaId: integer("mesa_id"),
    balcaoId: integer("balcao_id"),
    nome: text("nome").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.pessoaId] }),
    index("pessoas_org_mesa").on(table.organizacaoId, table.mesaId),
    index("pessoas_org_balcao").on(table.organizacaoId, table.balcaoId),
    index("pessoas_org_atendimento").on(table.organizacaoId, table.atendimentoId),
  ],
);

export const itensPedido = sqliteTable(
  "itens_pedido",
  {
    organizacaoId: text("organizacao_id").notNull(),
    itemId: text("item_id").notNull(),
    pedidoId: text("pedido_id"),
    atendimentoId: text("atendimento_id").notNull(),
    mesaId: integer("mesa_id"),
    balcaoId: integer("balcao_id"),
    pessoaId: text("pessoa_id").notNull(),
    produtoId: text("produto_id").notNull(),
    nome: text("nome").notNull(),
    precoCentavos: integer("preco_centavos").notNull(),
    quantidade: integer("quantidade").notNull(),
    observacao: text("observacao").notNull(),
    destinoProducao: text("destino_producao", { enum: ["cozinha", "bar"] }).notNull(),
    status: text("status", {
      enum: ["novo", "enviado", "preparando", "pronto", "entregue", "cancelamento_solicitado"],
    }).notNull(),
    statusAnterior: text("status_anterior", {
      enum: ["novo", "enviado", "preparando", "pronto", "entregue"],
    }),
    funcionarioId: text("funcionario_id").notNull(),
    funcionarioNome: text("funcionario_nome").notNull(),
    funcionarioPerfil: text("funcionario_perfil", {
      enum: ["gerencia", "garcom", "producao", "caixa"],
    }).notNull(),
    criadoEm: text("criado_em").notNull(),
    enviadoEm: text("enviado_em"),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.itemId] }),
    index("itens_org_mesa").on(table.organizacaoId, table.mesaId),
    index("itens_org_balcao").on(table.organizacaoId, table.balcaoId),
    index("itens_org_atendimento").on(table.organizacaoId, table.atendimentoId),
    index("itens_org_status").on(table.organizacaoId, table.status),
  ],
);

export const fichasProducao = sqliteTable(
  "fichas_producao",
  {
    organizacaoId: text("organizacao_id").notNull(),
    ticketId: text("ticket_id").notNull(),
    pedidoId: text("pedido_id").notNull(),
    atendimentoId: text("atendimento_id").notNull(),
    mesaId: integer("mesa_id"),
    balcaoId: integer("balcao_id"),
    destinoProducao: text("destino_producao", { enum: ["cozinha", "bar"] }).notNull(),
    status: text("status", { enum: ["enviado", "preparando", "pronto", "entregue"] }).notNull(),
    linhasJson: text("linhas_json").notNull(),
    itemIdsJson: text("item_ids_json").notNull(),
    funcionarioId: text("funcionario_id").notNull(),
    funcionarioNome: text("funcionario_nome").notNull(),
    criadoEm: text("criado_em").notNull(),
    enviadoEm: text("enviado_em").notNull(),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.ticketId] }),
    index("fichas_org_atendimento").on(table.organizacaoId, table.atendimentoId),
    index("fichas_org_status").on(table.organizacaoId, table.status),
  ],
);

export const fechamentos = sqliteTable(
  "fechamentos",
  {
    organizacaoId: text("organizacao_id").notNull(),
    fechamentoId: text("fechamento_id").notNull(),
    atendimentoId: text("atendimento_id").notNull(),
    mesaId: integer("mesa_id"),
    balcaoId: integer("balcao_id"),
    hora: text("hora").notNull(),
    subtotalCentavos: integer("subtotal_centavos").notNull(),
    servicoCentavos: integer("servico_centavos").notNull(),
    totalCentavos: integer("total_centavos").notNull(),
    servicoIncluso: integer("servico_incluso", { mode: "boolean" }).notNull(),
    divisaoJson: text("divisao_json").notNull(),
    funcionarioNome: text("funcionario_nome").notNull(),
    garcomNome: text("garcom_nome"),
    criadoEm: text("criado_em").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.fechamentoId] }),
    index("fechamentos_org_mesa").on(table.organizacaoId, table.mesaId),
    index("fechamentos_org_balcao").on(table.organizacaoId, table.balcaoId),
    index("fechamentos_org_atendimento").on(table.organizacaoId, table.atendimentoId),
  ],
);

export const itensFechamento = sqliteTable(
  "itens_fechamento",
  {
    organizacaoId: text("organizacao_id").notNull(),
    fechamentoId: text("fechamento_id").notNull(),
    itemId: text("item_id").notNull(),
    atendimentoId: text("atendimento_id").notNull(),
    mesaId: integer("mesa_id"),
    balcaoId: integer("balcao_id"),
    produtoId: text("produto_id").notNull(),
    nome: text("nome").notNull(),
    precoCentavos: integer("preco_centavos").notNull(),
    quantidade: integer("quantidade").notNull(),
    destinoProducao: text("destino_producao", { enum: ["cozinha", "bar"] }).notNull(),
    criadoEm: text("criado_em").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.fechamentoId, table.itemId] }),
    index("itens_fechamento_org_fechamento").on(
      table.organizacaoId,
      table.fechamentoId,
    ),
    index("itens_fechamento_org_atendimento").on(
      table.organizacaoId,
      table.atendimentoId,
    ),
  ],
);

export const cancelamentosAutorizados = sqliteTable(
  "cancelamentos_autorizados",
  {
    organizacaoId: text("organizacao_id").notNull(),
    cancelamentoId: text("cancelamento_id").notNull(),
    itemId: text("item_id").notNull(),
    atendimentoId: text("atendimento_id").notNull(),
    mesaId: integer("mesa_id"),
    balcaoId: integer("balcao_id"),
    produtoId: text("produto_id").notNull(),
    nome: text("nome").notNull(),
    precoCentavos: integer("preco_centavos").notNull(),
    quantidade: integer("quantidade").notNull(),
    destinoProducao: text("destino_producao", { enum: ["cozinha", "bar"] }).notNull(),
    autorizadoPorId: text("autorizado_por_id").notNull(),
    autorizadoPorNome: text("autorizado_por_nome").notNull(),
    autorizadoEm: text("autorizado_em").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.cancelamentoId] }),
    index("cancelamentos_org_autorizado").on(
      table.organizacaoId,
      table.autorizadoEm,
    ),
    index("cancelamentos_org_atendimento").on(
      table.organizacaoId,
      table.atendimentoId,
    ),
  ],
);

export const encerramentosSemConsumo = sqliteTable(
  "encerramentos_sem_consumo",
  {
    organizacaoId: text("organizacao_id").notNull(),
    encerramentoId: text("encerramento_id").notNull(),
    atendimentoId: text("atendimento_id").notNull(),
    mesaId: integer("mesa_id"),
    balcaoId: integer("balcao_id"),
    aberturaId: text("abertura_id").notNull(),
    motivo: text("motivo").notNull(),
    observacao: text("observacao").notNull(),
    rascunhosDescartados: integer("rascunhos_descartados").notNull(),
    funcionarioId: text("funcionario_id").notNull(),
    funcionarioNome: text("funcionario_nome").notNull(),
    funcionarioPerfil: text("funcionario_perfil", {
      enum: ["gerencia", "garcom", "producao", "caixa"],
    }).notNull(),
    abertaEm: text("aberta_em"),
    encerradaEm: text("encerrada_em").notNull(),
    duracaoSegundos: integer("duracao_segundos").notNull(),
    desfeitoEm: text("desfeito_em"),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.encerramentoId] }),
    uniqueIndex("encerramentos_org_abertura").on(table.organizacaoId, table.aberturaId),
    index("encerramentos_org_atendimento").on(
      table.organizacaoId,
      table.atendimentoId,
    ),
  ],
);

export const cardapio = sqliteTable(
  "cardapio",
  {
    organizacaoId: text("organizacao_id").notNull(),
    produtoId: text("produto_id").notNull(),
    nome: text("nome").notNull(),
    precoCentavos: integer("preco_centavos").notNull(),
    destinoProducao: text("destino_producao", { enum: ["cozinha", "bar"] }).notNull(),
    categoria: text("categoria", {
      enum: [
        "Bebidas alcoólicas",
        "Bebidas sem álcool",
        "Porções",
        "Lanche artesanal",
        "Complementos",
        "Energético",
      ],
    }).notNull(),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.organizacaoId, table.produtoId] })],
);

export const auditoria = sqliteTable(
  "auditoria",
  {
    auditoriaId: text("auditoria_id").primaryKey(),
    organizacaoId: text("organizacao_id").notNull(),
    funcionarioId: text("funcionario_id").notNull(),
    acao: text("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: text("entidade_id"),
    criadoEm: text("criado_em").notNull(),
  },
  (table) => [index("auditoria_org_criado").on(table.organizacaoId, table.criadoEm)],
);

export const impressoras = sqliteTable(
  "impressoras",
  {
    organizacaoId: text("organizacao_id").notNull(),
    destino: text("destino", { enum: ["bar", "cozinha", "caixa"] }).notNull(),
    nome: text("nome").notNull(),
    host: text("host").notNull(),
    porta: integer("porta").notNull(),
    largura: integer("largura").notNull(),
    ativa: integer("ativa", { mode: "boolean" }).notNull().default(false),
    criadoEm: text("criado_em").notNull(),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.destino] }),
    index("impressoras_org_ativa").on(table.organizacaoId, table.ativa),
  ],
);

export const filaImpressoes = sqliteTable(
  "fila_impressoes",
  {
    organizacaoId: text("organizacao_id").notNull(),
    impressaoId: text("impressao_id").notNull(),
    destino: text("destino", { enum: ["bar", "cozinha", "caixa"] }).notNull(),
    tipo: text("tipo", { enum: ["ficha", "recibo"] }).notNull(),
    referenciaId: text("referencia_id").notNull(),
    atendimentoId: text("atendimento_id").notNull(),
    mesaId: integer("mesa_id"),
    balcaoId: integer("balcao_id"),
    texto: text("texto").notNull(),
    largura: integer("largura").notNull(),
    status: text("status", {
      enum: ["pendente", "imprimindo", "impresso", "falhou", "sem_configuracao"],
    }).notNull(),
    tentativas: integer("tentativas").notNull().default(0),
    ultimoErro: text("ultimo_erro"),
    impressoEm: text("impresso_em"),
    criadoEm: text("criado_em").notNull(),
    atualizadoEm: text("atualizado_em").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizacaoId, table.impressaoId] }),
    uniqueIndex("fila_impressoes_org_referencia").on(
      table.organizacaoId,
      table.tipo,
      table.referenciaId,
    ),
    index("fila_impressoes_org_status").on(table.organizacaoId, table.status),
  ],
);
