import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { autenticado } from "./comanda";
import { obterRelatorioDiario } from "../lib/relatorio-diario";
import { imprimirRelatorioDiario } from "../lib/impressao";

const entrada = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

function exigirFinanceiro(perfil: string) {
  if (perfil !== "gerencia" && perfil !== "caixa") throw new ORPCError("FORBIDDEN");
}

export const relatorioDiario = autenticado.input(entrada).handler(async ({ input, context }) => {
  exigirFinanceiro(context.sessao.funcionario.funcionario_perfil);
  return obterRelatorioDiario(context.sessao.organizacaoId, input.data);
});

export const relatorioDiarioImprimir = autenticado
  .input(entrada)
  .handler(async ({ input, context }) => {
    exigirFinanceiro(context.sessao.funcionario.funcionario_perfil);
    const relatorio = await obterRelatorioDiario(context.sessao.organizacaoId, input.data);
    try {
      return await imprimirRelatorioDiario(context.sessao.organizacaoId, relatorio);
    } catch (erro) {
      throw new ORPCError("BAD_REQUEST", {
        message: erro instanceof Error ? erro.message : "Não foi possível imprimir o relatório.",
      });
    }
  });

export const relatorio = { diario: relatorioDiario, imprimir: relatorioDiarioImprimir };
