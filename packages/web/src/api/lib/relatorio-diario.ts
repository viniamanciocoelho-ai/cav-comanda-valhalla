import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../database";
import {
  cancelamentosAutorizados,
  encerramentosSemConsumo,
  fechamentos,
  itensFechamento,
} from "../database/schema";
import { ratear } from "../../web/lib/rateio";
import type { Destino, MotivoSemConsumo, RelatorioDiario } from "../../web/lib/types";

interface LinhaFechamento {
  fechamentoId: string;
  mesaId: number;
  hora: string;
  totalCentavos: number;
  servicoCentavos: number;
  funcionarioNome: string;
}

interface LinhaItemFechado {
  fechamentoId: string;
  produtoId: string;
  nome: string;
  precoCentavos: number;
  quantidade: number;
  destinoProducao: Destino;
}

interface LinhaSemConsumo {
  encerramentoId: string;
  mesaId: number;
  motivo: string;
  observacao: string;
  funcionarioNome: string;
  encerradaEm: string;
}

interface LinhaCancelamento {
  cancelamentoId: string;
  mesaId: number;
  nome: string;
  precoCentavos: number;
  quantidade: number;
  autorizadoPorNome: string;
  autorizadoEm: string;
}

function offsetNoFuso(instante: Date, timeZone: string) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return (
    Date.UTC(
      Number(valor.year),
      Number(valor.month) - 1,
      Number(valor.day),
      Number(valor.hour),
      Number(valor.minute),
      Number(valor.second),
    ) - instante.getTime()
  );
}

function inicioNoFuso(data: string, timeZone: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const alvo = Date.UTC(ano, mes - 1, dia, 0, 0, 0);
  let instante = alvo;
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    instante = alvo - offsetNoFuso(new Date(instante), timeZone);
  }
  return new Date(instante);
}

export function limitesDoDia(
  data: string,
  timeZone = process.env.CAV_TIMEZONE || "America/Cuiaba",
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data inválida.");
  const inicio = inicioNoFuso(data, timeZone);
  const proximo = new Date(`${data}T12:00:00.000Z`);
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  const fim = inicioNoFuso(proximo.toISOString().slice(0, 10), timeZone);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

export function calcularRelatorioDiario(
  data: string,
  linhasFechamentos: LinhaFechamento[],
  linhasItens: LinhaItemFechado[],
  linhasSemConsumo: LinhaSemConsumo[],
  linhasCancelamentos: LinhaCancelamento[],
): RelatorioDiario {
  const faturamentoCentavos = linhasFechamentos.reduce(
    (soma, fechamento) => soma + fechamento.totalCentavos,
    0,
  );
  const servicoCentavos = linhasFechamentos.reduce(
    (soma, fechamento) => soma + fechamento.servicoCentavos,
    0,
  );
  const bases: Record<Destino, number> = { bar: 0, cozinha: 0 };
  const quantidades: Record<Destino, number> = { bar: 0, cozinha: 0 };
  const produtos = new Map<
    string,
    { produto_id: string; nome: string; quantidade: number; valorCentavos: number }
  >();
  for (const item of linhasItens) {
    const valor = item.precoCentavos * item.quantidade;
    bases[item.destinoProducao] += valor;
    quantidades[item.destinoProducao] += item.quantidade;
    const produto = produtos.get(item.produtoId) ?? {
      produto_id: item.produtoId,
      nome: item.nome,
      quantidade: 0,
      valorCentavos: 0,
    };
    produto.quantidade += item.quantidade;
    produto.valorCentavos += valor;
    produtos.set(item.produtoId, produto);
  }
  const totalBases = bases.bar + bases.cozinha;
  const ajustes = ratear(faturamentoCentavos - totalBases, [bases.bar, bases.cozinha]);
  const destinos: RelatorioDiario["destinos"] = (["bar", "cozinha"] as const).map(
    (destino, indice) => ({
      destino,
      quantidade: quantidades[destino],
      subtotalCentavos: bases[destino],
      totalCentavos: bases[destino] + ajustes[indice],
    }),
  );

  return {
    data,
    faturamentoCentavos,
    mesasAtendidas: linhasFechamentos.length,
    ticketMedioCentavos: linhasFechamentos.length
      ? Math.round(faturamentoCentavos / linhasFechamentos.length)
      : 0,
    servicoCentavos,
    destinos,
    produtos: Array.from(produtos.values()).sort(
      (a, b) => b.quantidade - a.quantidade || b.valorCentavos - a.valorCentavos,
    ),
    fechamentos: linhasFechamentos.map((fechamento) => ({
      fechamento_id: fechamento.fechamentoId,
      mesa_id: fechamento.mesaId,
      hora: fechamento.hora,
      totalCentavos: fechamento.totalCentavos,
      funcionario_nome: fechamento.funcionarioNome,
    })),
    encerramentosSemConsumo: linhasSemConsumo.map((registro) => ({
      encerramento_id: registro.encerramentoId,
      mesa_id: registro.mesaId,
      motivo: registro.motivo as MotivoSemConsumo,
      observacao: registro.observacao,
      funcionario_nome: registro.funcionarioNome,
      encerrada_em: registro.encerradaEm,
    })),
    cancelamentos: linhasCancelamentos.map((registro) => ({
      cancelamento_id: registro.cancelamentoId,
      mesa_id: registro.mesaId,
      nome: registro.nome,
      quantidade: registro.quantidade,
      valorCentavos: registro.precoCentavos * registro.quantidade,
      autorizado_por_nome: registro.autorizadoPorNome,
      autorizado_em: registro.autorizadoEm,
    })),
  };
}

export async function obterRelatorioDiario(
  organizacaoId: string,
  data: string,
): Promise<RelatorioDiario> {
  const { inicio, fim } = limitesDoDia(data);
  const [linhasFechamentos, linhasSemConsumo, linhasCancelamentos] = await Promise.all([
    db
      .select()
      .from(fechamentos)
      .where(
        and(
          eq(fechamentos.organizacaoId, organizacaoId),
          gte(fechamentos.criadoEm, inicio),
          lt(fechamentos.criadoEm, fim),
        ),
      ),
    db
      .select()
      .from(encerramentosSemConsumo)
      .where(
        and(
          eq(encerramentosSemConsumo.organizacaoId, organizacaoId),
          gte(encerramentosSemConsumo.encerradaEm, inicio),
          lt(encerramentosSemConsumo.encerradaEm, fim),
        ),
      ),
    db
      .select()
      .from(cancelamentosAutorizados)
      .where(
        and(
          eq(cancelamentosAutorizados.organizacaoId, organizacaoId),
          gte(cancelamentosAutorizados.autorizadoEm, inicio),
          lt(cancelamentosAutorizados.autorizadoEm, fim),
        ),
      ),
  ]);
  const ids = linhasFechamentos.map((fechamento) => fechamento.fechamentoId);
  const linhasItens = ids.length
    ? await db
        .select()
        .from(itensFechamento)
        .where(
          and(
            eq(itensFechamento.organizacaoId, organizacaoId),
            inArray(itensFechamento.fechamentoId, ids),
          ),
        )
    : [];
  return calcularRelatorioDiario(
    data,
    linhasFechamentos,
    linhasItens,
    linhasSemConsumo,
    linhasCancelamentos,
  );
}
