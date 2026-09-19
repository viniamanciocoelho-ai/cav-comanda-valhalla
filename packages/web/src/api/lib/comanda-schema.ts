import { z } from "zod";
import { compartilhadoId } from "../../web/lib/operacao";

const perfilSchema = z.enum(["gerencia", "garcom", "producao", "caixa"]);
const itemStatusSchema = z.enum([
  "novo",
  "enviado",
  "preparando",
  "pronto",
  "entregue",
  "cancelamento_solicitado",
]);
const statusAnteriorSchema = z.enum(["enviado", "preparando", "pronto"]);
const ticketStatusSchema = z.enum(["enviado", "preparando", "pronto", "entregue"]);
const destinoSchema = z.enum(["cozinha", "bar"]);
const motivoSemConsumoSchema = z.enum([
  "desistiram",
  "nao_encontraram",
  "engano",
  "troca_mesa",
  "outro",
]);
const organizacaoIdSchema = z.string().trim().min(1).max(80);

export const dinheiroSchema = (maximo: number) =>
  z
    .number()
    .finite()
    .nonnegative()
    .max(maximo)
    .refine(
      (valor) =>
        Number.isSafeInteger(Math.round(valor * 100)) &&
        Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-7,
      "Valor monetário deve ter no máximo duas casas decimais.",
    );

const pessoaSchema = z
  .object({
    pessoa_id: z.string().trim().min(1).max(120),
    nome: z.string().trim().min(1).max(120),
    mesa_id: z.number().int().min(1).max(200),
  })
  .strict();
const mesaSchema = z
  .object({
    organizacao_id: organizacaoIdSchema,
    mesa_id: z.number().int().min(1).max(200),
    status: z.enum(["livre", "ocupada", "aguardando"]),
    ativa: z.boolean(),
    pessoasFixas: z.number().int().min(0).max(200),
    totalFixo: dinheiroSchema(1_000_000),
    abertaEm: z.string().nullable(),
    garcom_id: z.string().trim().max(80).nullable(),
    contaSolicitada: z.boolean(),
    servicoIncluso: z.boolean(),
  })
  .strict();
const itemSchema = z
  .object({
    organizacao_id: organizacaoIdSchema,
    item_id: z.string().trim().min(1).max(120),
    pedido_id: z.string().trim().max(120).nullable(),
    mesa_id: z.number().int().min(1).max(200),
    pessoa_id: z.string().trim().min(1).max(120),
    produto_id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    price: dinheiroSchema(100_000),
    quantidade: z.number().int().min(1).max(20),
    observacao: z.string().max(500),
    destino_producao: destinoSchema,
    status: itemStatusSchema,
    funcionario_id: z.string().trim().min(1).max(80),
    funcionario_nome: z.string().trim().min(1).max(120),
    funcionario_perfil: perfilSchema,
    criado_em: z.string().min(1).max(80),
    enviado_em: z.string().max(80).nullable(),
    atualizado_em: z.string().min(1).max(80),
  })
  .strict();
const ticketLinhaSchema = z
  .object({
    item_id: z.string().trim().min(1).max(120),
    produto_id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    qty: z.number().int().min(1).max(20),
    pessoa: z.string().max(120),
    observacao: z.string().max(500),
  })
  .strict();
const ticketSchema = z
  .object({
    organizacao_id: organizacaoIdSchema,
    ticket_id: z.string().trim().min(1).max(120),
    pedido_id: z.string().trim().min(1).max(120),
    mesa_id: z.number().int().min(1).max(200),
    destino_producao: destinoSchema,
    status: ticketStatusSchema,
    linhas: z.array(ticketLinhaSchema).max(100),
    itemIds: z.array(z.string().trim().min(1).max(120)).max(100),
    funcionario_id: z.string().trim().min(1).max(80),
    funcionario_nome: z.string().trim().min(1).max(120),
    criado_em: z.string().min(1).max(80),
    enviado_em: z.string().min(1).max(80),
    atualizado_em: z.string().min(1).max(80),
  })
  .strict();
const fechamentoSchema = z
  .object({
    organizacao_id: organizacaoIdSchema,
    fechamento_id: z.string().trim().min(1).max(120),
    mesa_id: z.number().int().min(1).max(200),
    hora: z.string().min(1).max(80),
    subtotal: dinheiroSchema(1_000_000),
    servico: dinheiroSchema(1_000_000),
    total: dinheiroSchema(1_000_000),
    servicoIncluso: z.boolean(),
    divisao: z
      .array(
        z
          .object({
            pessoa_id: z.string().trim().min(1).max(120),
            pessoa: z.string().trim().min(1).max(120),
            valor: dinheiroSchema(1_000_000),
          })
          .strict(),
      )
      .max(200),
    nfce: z.enum(["simulada", "nao_solicitada"]),
    funcionario_nome: z.string().trim().min(1).max(120),
    garcom_nome: z.string().trim().max(120).nullable(),
  })
  .strict();
const encerramentoSchema = z
  .object({
    organizacao_id: organizacaoIdSchema,
    encerramento_id: z.string().trim().min(1).max(120),
    mesa_id: z.number().int().min(1).max(200),
    abertura_id: z.string().trim().min(1).max(160),
    encerrada_sem_consumo: z.literal(true),
    motivo: motivoSemConsumoSchema,
    observacao: z.string().max(500),
    rascunhos_descartados: z.number().int().nonnegative().max(1_000),
    funcionario_id: z.string().trim().min(1).max(80),
    funcionario_nome: z.string().trim().min(1).max(120),
    funcionario_perfil: perfilSchema,
    aberta_em: z.string().max(80).nullable(),
    encerrada_em: z.string().min(1).max(80),
    duracao_segundos: z.number().int().nonnegative().safe(),
    desfeito_em: z.string().max(80).nullable(),
  })
  .strict();

export const estadoPersistidoSchema = z
  .object({
    mesas: z.array(mesaSchema).max(200),
    pessoas: z.array(pessoaSchema).max(1_000),
    itens: z.array(itemSchema).max(2_000),
    tickets: z.array(ticketSchema).max(400),
    fechamentos: z.array(fechamentoSchema).max(1_000),
    encerramentos: z.array(encerramentoSchema).max(1_000),
    anteriores: z.record(z.string().trim().min(1).max(120), statusAnteriorSchema),
  })
  .strict()
  .superRefine((estado, contexto) => {
    const verificarUnicos = <T>(
      registros: T[],
      id: (registro: T) => string | number,
      colecao: string,
    ) => {
      const ids = registros.map(id);
      if (new Set(ids).size !== ids.length) {
        contexto.addIssue({ code: "custom", message: `IDs duplicados em ${colecao}.` });
      }
    };
    verificarUnicos(estado.mesas, (mesa) => mesa.mesa_id, "mesas");
    verificarUnicos(estado.pessoas, (pessoa) => pessoa.pessoa_id, "pessoas");
    verificarUnicos(estado.itens, (item) => item.item_id, "itens");
    verificarUnicos(estado.tickets, (ticket) => ticket.ticket_id, "tickets");
    verificarUnicos(
      estado.fechamentos,
      (fechamento) => fechamento.fechamento_id,
      "fechamentos",
    );
    verificarUnicos(
      estado.encerramentos,
      (encerramento) => encerramento.encerramento_id,
      "encerramentos",
    );

    const mesas = new Set(estado.mesas.map((mesa) => mesa.mesa_id));
    const pessoas = new Map(
      estado.pessoas.map((pessoa) => [pessoa.pessoa_id, pessoa]),
    );
    const itens = new Map(estado.itens.map((item) => [item.item_id, item]));
    if (estado.pessoas.some((pessoa) => !mesas.has(pessoa.mesa_id))) {
      contexto.addIssue({ code: "custom", message: "Pessoa referencia mesa inexistente." });
    }
    if (
      estado.itens.some((item) => {
        const pessoa = pessoas.get(item.pessoa_id);
        return (
          !mesas.has(item.mesa_id) ||
          (item.pessoa_id !== compartilhadoId(item.mesa_id) &&
            (!pessoa || pessoa.mesa_id !== item.mesa_id))
        );
      })
    ) {
      contexto.addIssue({ code: "custom", message: "Item possui vínculo inválido." });
    }
    for (const ticket of estado.tickets) {
      const ids = new Set(ticket.itemIds);
      const idsLinhas = new Set(ticket.linhas.map((linha) => linha.item_id));
      const vinculosValidos = ticket.itemIds.every((itemId) => {
        const item = itens.get(itemId);
        return (
          item &&
          item.mesa_id === ticket.mesa_id &&
          item.pedido_id === ticket.pedido_id &&
          item.destino_producao === ticket.destino_producao
        );
      });
      if (
        !mesas.has(ticket.mesa_id) ||
        ids.size !== ticket.itemIds.length ||
        idsLinhas.size !== ticket.linhas.length ||
        ticket.itemIds.length !== ticket.linhas.length ||
        [...ids].some((itemId) => !idsLinhas.has(itemId)) ||
        !vinculosValidos
      ) {
        contexto.addIssue({ code: "custom", message: "Ficha de produção inválida." });
      }
    }
    const pendentes = new Set(
      estado.itens
        .filter((item) => item.status === "cancelamento_solicitado")
        .map((item) => item.item_id),
    );
    const anteriores = new Set(Object.keys(estado.anteriores));
    if (
      pendentes.size !== anteriores.size ||
      [...pendentes].some((itemId) => !anteriores.has(itemId))
    ) {
      contexto.addIssue({
        code: "custom",
        message: "Histórico de cancelamento inconsistente.",
      });
    }
  });
