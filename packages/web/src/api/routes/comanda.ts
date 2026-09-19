import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "../__core/app";
import {
  alterarPinProprio,
  autenticar,
  garantirOrganizacaoPadrao,
  lerEstado,
  obterSessao,
  revogarSessao,
  salvarConfiguracao,
  salvarEstado,
  salvarFuncionario,
  salvarProduto,
  type EstadoPersistido,
} from "../lib/comanda-store";
import type { Funcionario, Perfil, ProdutoConfiguracao } from "../../web/lib/types";
import { dinheiroSchema, estadoPersistidoSchema } from "../lib/comanda-schema";

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
};

const tentativasLogin = new Map<
  string,
  { falhas: number; janelaIniciadaEm: number; bloqueadoAte: number; ultimoAcesso: number }
>();
const JANELA_LOGIN_MS = 5 * 60_000;
const BLOQUEIO_LOGIN_MS = 15 * 60_000;
const LIMITE_LOGIN_ORIGEM = 8;
const LIMITE_LOGIN_ORGANIZACAO = 80;

function origemLogin(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "origem-desconhecida"
  );
}

function reservarTentativa(chave: string, limite: number): boolean {
  const instante = Date.now();
  let anterior = tentativasLogin.get(chave);
  if (!anterior && tentativasLogin.size >= 5_000) {
    for (const [id, registro] of tentativasLogin) {
      if (
        registro.bloqueadoAte <= instante &&
        instante - registro.ultimoAcesso > JANELA_LOGIN_MS
      ) {
        tentativasLogin.delete(id);
      }
    }
    anterior = tentativasLogin.get(chave);
    if (!anterior && tentativasLogin.size >= 5_000) return false;
  }
  if (anterior?.bloqueadoAte && anterior.bloqueadoAte > instante) return false;

  const atual =
    !anterior || instante - anterior.janelaIniciadaEm > JANELA_LOGIN_MS
      ? { falhas: 0, janelaIniciadaEm: instante, bloqueadoAte: 0, ultimoAcesso: instante }
      : { ...anterior, ultimoAcesso: instante };
  atual.falhas += 1;
  if (atual.falhas >= limite) atual.bloqueadoAte = instante + BLOQUEIO_LOGIN_MS;
  tentativasLogin.set(chave, atual);
  return true;
}

export const autenticado = base.use(async ({ context, next }) => {
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
  .handler(async ({ input, context }) => {
    const organizacao = input.organizacao.trim().toLowerCase();
    const origem = origemLogin(context.headers);
    const chaveOrigem = `origem:${origem}:${organizacao}`;
    const chaveOrganizacao = `organizacao:${organizacao}`;
    if (
      !reservarTentativa(chaveOrigem, LIMITE_LOGIN_ORIGEM) ||
      !reservarTentativa(chaveOrganizacao, LIMITE_LOGIN_ORGANIZACAO)
    ) {
      throw new ORPCError("UNAUTHORIZED", { message: "Organização ou PIN inválido." });
    }
    const sessao = await autenticar(input.organizacao, input.pin);
    if (!sessao) {
      throw new ORPCError("UNAUTHORIZED", { message: "Organização ou PIN inválido." });
    }
    tentativasLogin.delete(chaveOrigem);
    tentativasLogin.delete(chaveOrganizacao);
    return {
      token: sessao.token,
      funcionario: sessao.funcionario,
      organizacaoId: sessao.organizacaoId,
    };
  });

export const logout = autenticado.handler(async ({ context }) => {
  await revogarSessao(context.headers.get("authorization"));
  return { ok: true };
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
    const estadoValidado = estadoPersistidoSchema.safeParse(input.estado);
    if (!estadoValidado.success) {
      throw new ORPCError("BAD_REQUEST", { message: "Estado inválido." });
    }
    const estadoRecebido = estadoValidado.data as EstadoPersistido;
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
      versao: z.number().int().nonnegative(),
      quantidadeMesas: z.number().int().min(1).max(200),
      larguraRecibo: z.union([z.literal(58), z.literal(80)]),
    }),
  )
  .handler(async ({ input, context }) => {
    if (context.sessao.funcionario.funcionario_perfil !== "gerencia") {
      throw new ORPCError("FORBIDDEN");
    }
    const versao = await salvarConfiguracao(
      context.sessao.organizacaoId,
      input.versao,
      input.quantidadeMesas,
      input.larguraRecibo,
    );
    if (versao === null) {
      throw new ORPCError("CONFLICT", {
        message: "A configuração mudou em outro dispositivo. Recarregue o estado.",
      });
    }
    return { ok: true, versao };
  });

export const produtoSalvar = autenticado
  .input(
    z.object({
      produto_id: z.string().trim().min(1).max(80),
      name: z.string().trim().min(1).max(120),
      price: dinheiroSchema(100_000),
      destino_producao: z.enum(["cozinha", "bar"]),
      categoria: z.enum([
        "Bebidas alcoólicas",
        "Bebidas sem álcool",
        "Porções",
        "Lanche artesanal",
        "Complementos",
        "Energético",
      ]),
      ativo: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (context.sessao.funcionario.funcionario_perfil !== "gerencia") {
      throw new ORPCError("FORBIDDEN");
    }
    await salvarProduto(
      context.sessao.organizacaoId,
      input as ProdutoConfiguracao,
    );
    return { ok: true };
  });

export const funcionarioSalvar = autenticado
  .input(
    z.object({
      funcionarioId: z.string().trim().min(1).max(80),
      nome: z.string().trim().min(1).max(120),
      perfil: z.enum(perfis),
      pin: z.string().regex(/^\d{4}$/).optional(),
      ativo: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (context.sessao.funcionario.funcionario_perfil !== "gerencia") {
      throw new ORPCError("FORBIDDEN");
    }
    await salvarFuncionario(
      context.sessao.organizacaoId,
      context.sessao.funcionario.funcionario_id,
      {
        ...input,
        perfil: input.perfil as Funcionario["funcionario_perfil"],
      },
    );
    return { ok: true };
  });

export const pinAlterar = autenticado
  .input(
    z.object({
      pinAtual: z.string().regex(/^\d{4}$/),
      pinNovo: z.string().regex(/^\d{4}$/),
    }),
  )
  .handler(async ({ input, context }) => {
    await alterarPinProprio(
      context.sessao.organizacaoId,
      context.sessao.funcionario.funcionario_id,
      input.pinAtual,
      input.pinNovo,
    );
    return { ok: true };
  });

export const comanda = {
  estado,
  persistir,
  configurar,
  produtoSalvar,
  funcionarioSalvar,
  pinAlterar,
};
