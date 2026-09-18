import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "../__core/app";
import {
  autenticar,
  garantirOrganizacaoPadrao,
  lerEstado,
  obterSessao,
  salvarConfiguracao,
  salvarEstado,
  salvarFuncionario,
  salvarProduto,
  type EstadoPersistido,
} from "../lib/comanda-store";
import type { Funcionario, MenuItem, Perfil } from "../../web/lib/types";

const perfis = ["gerencia", "garcom", "producao", "caixa"] as const;
const acoes = [
  "abrir_mesa",
  "alterar_comanda",
  "enviar_pedido",
  "mover_producao",
  "entregar_item",
  "solicitar_cancelamento",
  "decidir_cancelamento",
  "solicitar_fechamento",
  "alterar_servico",
  "fechar_conta",
  "encerrar_sem_consumo",
  "desfazer_sem_consumo",
  "reiniciar",
] as const;

const permissoes: Record<(typeof acoes)[number], Perfil[]> = {
  abrir_mesa: ["gerencia", "garcom"],
  alterar_comanda: ["gerencia", "garcom"],
  enviar_pedido: ["gerencia", "garcom"],
  mover_producao: ["gerencia", "producao"],
  entregar_item: ["gerencia", "garcom"],
  solicitar_cancelamento: ["gerencia", "garcom"],
  decidir_cancelamento: ["gerencia"],
  solicitar_fechamento: ["gerencia", "garcom"],
  alterar_servico: ["gerencia", "caixa"],
  fechar_conta: ["gerencia", "caixa"],
  encerrar_sem_consumo: ["gerencia", "garcom"],
  desfazer_sem_consumo: ["gerencia", "garcom"],
  reiniciar: ["gerencia"],
};

const autenticado = base.use(async ({ context, next }) => {
  await garantirOrganizacaoPadrao();
  const sessao = await obterSessao(context.headers.get("authorization"));
  if (!sessao) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { sessao } });
});

export const login = base
  .input(
    z.object({
      organizacao: z.string().trim().min(2).max(60),
      pin: z.string().regex(/^\d{4}$/),
    }),
  )
  .handler(async ({ input }) => {
    const sessao = await autenticar(input.organizacao, input.pin);
    if (!sessao) {
      throw new ORPCError("UNAUTHORIZED", { message: "Organização ou PIN inválido." });
    }
    return {
      token: sessao.token,
      funcionario: sessao.funcionario,
      organizacaoId: sessao.organizacaoId,
    };
  });

export const estado = autenticado.handler(async ({ context }) => ({
  ...(await lerEstado(context.sessao.organizacaoId)),
  funcionario: context.sessao.funcionario,
}));

export const persistir = autenticado
  .input(
    z.object({
      versao: z.number().int().nonnegative(),
      acao: z.enum(acoes),
      entidadeId: z.string().trim().max(120).optional(),
      estado: z.unknown(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (!permissoes[input.acao].includes(context.sessao.funcionario.funcionario_perfil)) {
      throw new ORPCError("FORBIDDEN");
    }
    const estadoRecebido = input.estado as EstadoPersistido;
    const colecoes = [
      estadoRecebido?.mesas,
      estadoRecebido?.itens,
      estadoRecebido?.tickets,
      estadoRecebido?.fechamentos,
      estadoRecebido?.encerramentos,
    ];
    if (
      !colecoes.every(Array.isArray) ||
      colecoes.some((colecao) =>
        colecao.some(
          (registro: { organizacao_id?: string }) =>
            registro.organizacao_id !== context.sessao.organizacaoId,
        ),
      )
    ) {
      throw new ORPCError("BAD_REQUEST", { message: "Estado inválido para a organização." });
    }
    const versao = await salvarEstado(
      context.sessao.organizacaoId,
      input.versao,
      estadoRecebido,
      context.sessao.funcionario,
      input.acao,
      input.entidadeId,
    );
    if (versao === null) {
      throw new ORPCError("CONFLICT", {
        message: "O salão foi atualizado em outro dispositivo. Recarregue o estado.",
      });
    }
    return { versao };
  });

export const configurar = autenticado
  .input(
    z.object({
      quantidadeMesas: z.number().int().min(1).max(200),
      larguraRecibo: z.union([z.literal(58), z.literal(80)]),
    }),
  )
  .handler(async ({ input, context }) => {
    if (context.sessao.funcionario.funcionario_perfil !== "gerencia") {
      throw new ORPCError("FORBIDDEN");
    }
    await salvarConfiguracao(
      context.sessao.organizacaoId,
      input.quantidadeMesas,
      input.larguraRecibo,
    );
    return { ok: true };
  });

export const produtoSalvar = autenticado
  .input(
    z.object({
      produto_id: z.string().trim().min(1).max(80),
      name: z.string().trim().min(1).max(120),
      price: z.number().nonnegative().max(100_000),
      destino_producao: z.enum(["cozinha", "bar"]),
      categoria: z.enum(["Chopes", "Bebidas", "Petiscos", "Cozinha"]),
    }),
  )
  .handler(async ({ input, context }) => {
    if (context.sessao.funcionario.funcionario_perfil !== "gerencia") {
      throw new ORPCError("FORBIDDEN");
    }
    await salvarProduto(context.sessao.organizacaoId, input as MenuItem);
    return { ok: true };
  });

export const funcionarioSalvar = autenticado
  .input(
    z.object({
      funcionarioId: z.string().trim().min(1).max(80),
      nome: z.string().trim().min(1).max(120),
      perfil: z.enum(perfis),
      pin: z.string().regex(/^\d{4}$/),
    }),
  )
  .handler(async ({ input, context }) => {
    if (context.sessao.funcionario.funcionario_perfil !== "gerencia") {
      throw new ORPCError("FORBIDDEN");
    }
    await salvarFuncionario(context.sessao.organizacaoId, {
      ...input,
      perfil: input.perfil as Funcionario["funcionario_perfil"],
    });
    return { ok: true };
  });
