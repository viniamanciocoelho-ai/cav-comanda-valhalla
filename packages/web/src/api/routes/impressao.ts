import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { autenticado } from "./comanda";
import {
  obterImpressao,
  solicitarReimpressao,
  testarImpressora,
} from "../lib/impressao";
import { salvarImpressora } from "../lib/comanda-store";
import type { DestinoImpressao } from "../../web/lib/types";

const destinos = ["bar", "cozinha", "caixa"] as const;
const largura = z.union([z.literal(58), z.literal(80)]);

function exigirGerencia(perfil: string) {
  if (perfil !== "gerencia") throw new ORPCError("FORBIDDEN");
}

export const impressoraSalvar = autenticado
  .input(
    z.object({
      destino: z.enum(destinos),
      nome: z.string().trim().min(1).max(120),
      host: z.string().trim().max(253),
      porta: z.number().int().min(1).max(65_535),
      largura,
      ativa: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    exigirGerencia(context.sessao.funcionario.funcionario_perfil);
    await salvarImpressora(
      context.sessao.organizacaoId,
      input as {
        destino: DestinoImpressao;
        nome: string;
        host: string;
        porta: number;
        largura: 58 | 80;
        ativa: boolean;
      },
    );
    return { ok: true };
  });

export const impressoraTestar = autenticado
  .input(z.object({ destino: z.enum(destinos) }))
  .handler(async ({ input, context }) => {
    exigirGerencia(context.sessao.funcionario.funcionario_perfil);
    try {
      return await testarImpressora(context.sessao.organizacaoId, input.destino);
    } catch (erro) {
      throw new ORPCError("BAD_REQUEST", {
        message: erro instanceof Error ? erro.message : "Não foi possível testar a impressora.",
      });
    }
  });

export const impressaoReimprimir = autenticado
  .input(z.object({ impressaoId: z.string().trim().min(1).max(120) }))
  .handler(async ({ input, context }) => {
    const fila = await obterImpressao(context.sessao.organizacaoId, input.impressaoId);
    if (!fila) throw new ORPCError("NOT_FOUND", { message: "Impressão não encontrada." });
    const perfil = context.sessao.funcionario.funcionario_perfil;
    const autorizado =
      perfil === "gerencia" ||
      (fila.destino === "caixa" && perfil === "caixa") ||
      (fila.destino !== "caixa" && perfil === "producao");
    if (!autorizado) throw new ORPCError("FORBIDDEN");
    return solicitarReimpressao(context.sessao.organizacaoId, input.impressaoId);
  });

export const impressao = {
  impressoraSalvar,
  impressoraTestar,
  impressaoReimprimir,
};
