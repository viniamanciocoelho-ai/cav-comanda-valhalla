/// <reference types="node" />

import { createConnection } from "node:net";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { filaImpressoes, impressoras } from "../database/schema";
import type { EstadoPersistido } from "./comanda-store";
import {
  divisaoDoFechamento,
  montarFichaProducao,
  montarRecibo,
  montarRelatorioDiario,
  serializarEscPos,
} from "../../web/lib/recibo";
import type {
  ConfiguracaoImpressora,
  DestinoImpressao,
  Impressao,
  RelatorioDiario,
  StatusImpressao,
  Ticket,
  TipoImpressao,
} from "../../web/lib/types";

export const DESTINOS_IMPRESSAO: DestinoImpressao[] = ["bar", "cozinha", "caixa"];
export const TIMEOUT_IMPRESSORA_MS = 3_000;
const RECUPERAR_IMPRESSAO_LOCAL_APOS_MS = 120_000;

type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface LinhaImpressora {
  destino: DestinoImpressao;
  nome: string;
  host: string;
  porta: number;
  largura: number;
  ativa: boolean;
}

interface LinhaFila {
  organizacaoId: string;
  impressaoId: string;
  destino: DestinoImpressao;
  tipo: TipoImpressao;
  referenciaId: string;
  atendimentoId: string;
  mesaId: number | null;
  balcaoId: number | null;
  texto: string;
  largura: number;
  status: StatusImpressao;
  tentativas: number;
  ultimoErro: string | null;
  impressoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

const nomesPadrao: Record<DestinoImpressao, string> = {
  bar: "Impressora do bar",
  cozinha: "Impressora da cozinha",
  caixa: "Impressora do caixa",
};

function larguraValida(largura: number): 58 | 80 {
  return largura === 58 ? 58 : 80;
}

export function hostImpressoraValido(host: string) {
  const valor = host.trim();
  return (
    valor.length > 0 &&
    valor.length <= 253 &&
    !/\s/.test(valor) &&
    !/[\\/]/.test(valor) &&
    !/^[a-z]+:\/\//i.test(valor)
  );
}

export function configuracoesImpressoras(
  linhas: LinhaImpressora[],
  larguraPadrao: 58 | 80,
): ConfiguracaoImpressora[] {
  const porDestino = new Map(linhas.map((linha) => [linha.destino, linha]));
  return DESTINOS_IMPRESSAO.map((destino) => {
    const linha = porDestino.get(destino);
    return {
      destino,
      nome: linha?.nome || nomesPadrao[destino],
      host: linha?.host ?? "",
      porta: linha?.porta ?? 9100,
      largura: larguraValida(linha?.largura ?? larguraPadrao),
      ativa: linha?.ativa ?? false,
    };
  });
}

export function impressoesPublicas(linhas: LinhaFila[]): Impressao[] {
  return linhas.map((linha) => ({
    organizacao_id: linha.organizacaoId,
    impressao_id: linha.impressaoId,
    destino: linha.destino,
    tipo: linha.tipo,
    referencia_id: linha.referenciaId,
    atendimento_id: linha.atendimentoId,
    mesa_id: linha.mesaId,
    balcao_id: linha.balcaoId,
    status: linha.status,
    tentativas: linha.tentativas,
    ultimo_erro: linha.ultimoErro,
    texto: linha.texto,
    largura: larguraValida(linha.largura),
    impresso_em: linha.impressoEm,
    criado_em: linha.criadoEm,
    atualizado_em: linha.atualizadoEm,
  }));
}

function erroImpressora(erro: unknown) {
  if (erro instanceof Error && erro.message) return erro.message.slice(0, 240);
  return "A impressora não respondeu dentro do tempo limite.";
}

export function enviarEscPos(
  host: string,
  porta: number,
  texto: string,
  timeoutMs = TIMEOUT_IMPRESSORA_MS,
): Promise<void> {
  const bytes = Buffer.from(serializarEscPos(texto));
  return new Promise((resolve, reject) => {
    let finalizado = false;
    const finalizar = (erro?: Error) => {
      if (finalizado) return;
      finalizado = true;
      if (erro) reject(erro);
      else resolve();
    };

    const socket = createConnection({ host, port: porta });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      finalizar(new Error("A impressora não respondeu em 3 segundos."));
    });
    socket.once("error", (erro) => finalizar(erro));
    socket.once("connect", () => {
      socket.end(bytes, () => finalizar());
    });
  });
}

function configuracaoAtiva(configuracao: LinhaImpressora | undefined) {
  return Boolean(
    configuracao?.ativa &&
      hostImpressoraValido(configuracao.host) &&
      Number.isInteger(configuracao.porta) &&
      configuracao.porta >= 1 &&
      configuracao.porta <= 65_535,
  );
}

function textoTeste(destino: DestinoImpressao, largura: 58 | 80) {
  const ticket: Ticket = {
    organizacao_id: "teste",
    ticket_id: "teste",
    pedido_id: "teste",
    atendimento_id: "teste",
    mesa_id: 1,
    balcao_id: null,
    destino_producao: destino === "caixa" ? "bar" : destino,
    status: "enviado",
    linhas: [
      {
        item_id: "teste",
        produto_id: "teste",
        name: "Teste de impressão",
        qty: 1,
        pessoa: "",
        observacao: "",
      },
    ],
    itemIds: ["teste"],
    funcionario_id: "teste",
    funcionario_nome: "Sistema",
    criado_em: new Date().toISOString(),
    enviado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };
  if (destino === "caixa") {
    return montarRecibo(
      1,
      [
        {
          pessoa_id: "teste",
          nome: "Teste de impressão",
          atendimento_id: "teste",
          mesa_id: 1,
          balcao_id: null,
        },
      ],
      [],
      [{ pessoa_id: "teste", pessoa: "Teste de impressão", individual: 0, rateio: 0, servico: 0, total: 0 }],
      largura,
    );
  }
  return montarFichaProducao(ticket, largura);
}

export async function testarImpressora(
  organizacaoId: string,
  destino: DestinoImpressao,
) {
  const [configuracao] = await db
    .select()
    .from(impressoras)
    .where(and(eq(impressoras.organizacaoId, organizacaoId), eq(impressoras.destino, destino)))
    .limit(1);
  const largura = larguraValida(configuracao?.largura ?? 80);
  const texto = textoTeste(destino, largura);
  if (!configuracaoAtiva(configuracao)) {
    return { modo: "navegador" as const, texto, largura };
  }
  await enviarEscPos(configuracao.host, configuracao.porta, texto);
  return { modo: "rede" as const, texto: null, largura };
}

export async function imprimirRelatorioDiario(
  organizacaoId: string,
  relatorio: RelatorioDiario,
) {
  const [configuracao] = await db
    .select()
    .from(impressoras)
    .where(
      and(
        eq(impressoras.organizacaoId, organizacaoId),
        eq(impressoras.destino, "caixa"),
      ),
    )
    .limit(1);
  const largura = larguraValida(configuracao?.largura ?? 80);
  const texto = montarRelatorioDiario(relatorio, largura);
  if (!configuracaoAtiva(configuracao)) {
    return { modo: "navegador" as const, texto, largura };
  }
  await enviarEscPos(configuracao.host, configuracao.porta, texto);
  return { modo: "rede" as const, texto: null, largura };
}

export async function enfileirarImpressoesTx(
  tx: Transacao,
  organizacaoId: string,
  anterior: EstadoPersistido,
  estado: EstadoPersistido,
  larguraPadrao: 58 | 80,
) {
  const linhasImpressoras = await tx
    .select()
    .from(impressoras)
    .where(eq(impressoras.organizacaoId, organizacaoId));
  const porDestino = new Map(
    linhasImpressoras.map((linha) => [linha.destino as DestinoImpressao, linha]),
  );
  const ids: string[] = [];
  const ticketIds = new Set(anterior.tickets.map((ticket) => ticket.ticket_id));
  const fechamentoIds = new Set(
    anterior.fechamentos.map((fechamento) => fechamento.fechamento_id),
  );

  const inserir = async (
    destino: DestinoImpressao,
    tipo: TipoImpressao,
    referenciaId: string,
    atendimentoId: string,
    mesaId: number | null,
    balcaoId: number | null,
    texto: string,
  ) => {
    const configuracao = porDestino.get(destino);
    const status: StatusImpressao = configuracaoAtiva(configuracao)
      ? "pendente"
      : "sem_configuracao";
    const impressaoId = crypto.randomUUID();
    await tx
      .insert(filaImpressoes)
      .values({
        organizacaoId,
        impressaoId,
        destino,
        tipo,
        referenciaId,
        atendimentoId,
        mesaId,
        balcaoId,
        texto,
        largura: larguraValida(configuracao?.largura ?? larguraPadrao),
        status,
        tentativas: 0,
        ultimoErro:
          status === "sem_configuracao" ? "Nenhuma impressora de rede ativa neste destino." : null,
        impressoEm: null,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      })
      .onConflictDoNothing({
        target: [filaImpressoes.organizacaoId, filaImpressoes.tipo, filaImpressoes.referenciaId],
      });
    ids.push(impressaoId);
  };

  for (const ticket of estado.tickets) {
    if (ticketIds.has(ticket.ticket_id)) continue;
    const configuracao = porDestino.get(ticket.destino_producao);
    await inserir(
      ticket.destino_producao,
      "ficha",
      ticket.ticket_id,
      ticket.atendimento_id,
      ticket.mesa_id,
      ticket.balcao_id,
      montarFichaProducao(ticket, larguraValida(configuracao?.largura ?? larguraPadrao)),
    );
  }

  for (const fechamento of estado.fechamentos) {
    if (fechamentoIds.has(fechamento.fechamento_id)) continue;
    const configuracao = porDestino.get("caixa");
    const pessoas = anterior.pessoas.filter(
      (pessoa) => pessoa.atendimento_id === fechamento.atendimento_id,
    );
    const itens = anterior.itens.filter(
      (item) => item.atendimento_id === fechamento.atendimento_id,
    );
    await inserir(
      "caixa",
      "recibo",
      fechamento.fechamento_id,
      fechamento.atendimento_id,
      fechamento.mesa_id,
      fechamento.balcao_id,
      montarRecibo(
        fechamento,
        pessoas,
        itens,
        divisaoDoFechamento(fechamento, pessoas, itens),
        larguraValida(configuracao?.largura ?? larguraPadrao),
      ),
    );
  }
  return ids;
}

const impressaoEmAndamento = new Set<string>();

async function processarUmaImpressao(organizacaoId: string, impressaoId: string) {
  const chave = `${organizacaoId}:${impressaoId}`;
  if (impressaoEmAndamento.has(chave)) return;
  impressaoEmAndamento.add(chave);
  try {
    const [fila] = await db
      .select()
      .from(filaImpressoes)
      .where(
        and(
          eq(filaImpressoes.organizacaoId, organizacaoId),
          eq(filaImpressoes.impressaoId, impressaoId),
          inArray(filaImpressoes.status, ["pendente", "falhou", "sem_configuracao"]),
        ),
      )
      .limit(1);
    if (!fila) return;
    const [configuracao] = await db
      .select()
      .from(impressoras)
      .where(
        and(
          eq(impressoras.organizacaoId, organizacaoId),
          eq(impressoras.destino, fila.destino),
        ),
      )
      .limit(1);
    if (!configuracaoAtiva(configuracao)) {
      await db
        .update(filaImpressoes)
        .set({
          status: "sem_configuracao",
          ultimoErro: "Nenhuma impressora de rede ativa neste destino.",
          atualizadoEm: new Date().toISOString(),
        })
        .where(
          and(
            eq(filaImpressoes.organizacaoId, organizacaoId),
            eq(filaImpressoes.impressaoId, impressaoId),
          ),
        );
      return;
    }
    const reservado = await db
      .update(filaImpressoes)
      .set({ status: "imprimindo", atualizadoEm: new Date().toISOString() })
      .where(
        and(
          eq(filaImpressoes.organizacaoId, organizacaoId),
          eq(filaImpressoes.impressaoId, impressaoId),
          inArray(filaImpressoes.status, ["pendente", "falhou", "sem_configuracao"]),
        ),
      );
    if (reservado.rowsAffected !== 1) return;
    try {
      await enviarEscPos(configuracao.host, configuracao.porta, fila.texto);
      await db
        .update(filaImpressoes)
        .set({
          status: "impresso",
          ultimoErro: null,
          tentativas: fila.tentativas + 1,
          impressoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        })
        .where(
          and(
            eq(filaImpressoes.organizacaoId, organizacaoId),
            eq(filaImpressoes.impressaoId, impressaoId),
          ),
        );
    } catch (erro) {
      await db
        .update(filaImpressoes)
        .set({
          status: "falhou",
          ultimoErro: erroImpressora(erro),
          tentativas: fila.tentativas + 1,
          atualizadoEm: new Date().toISOString(),
        })
        .where(
          and(
            eq(filaImpressoes.organizacaoId, organizacaoId),
            eq(filaImpressoes.impressaoId, impressaoId),
          ),
        );
    }
  } finally {
    impressaoEmAndamento.delete(chave);
  }
}

export function processarFila(organizacaoId: string, ids?: string[]) {
  void (async () => {
    const pendentes = await db
      .select({ impressaoId: filaImpressoes.impressaoId })
      .from(filaImpressoes)
      .where(
        and(
          eq(filaImpressoes.organizacaoId, organizacaoId),
          inArray(filaImpressoes.status, ["pendente", "falhou", "sem_configuracao"]),
          ids?.length ? inArray(filaImpressoes.impressaoId, ids) : undefined,
        ),
      );
    for (const linha of pendentes) {
      await processarUmaImpressao(organizacaoId, linha.impressaoId);
    }
  })().catch(() => undefined);
}

export async function reservarImpressaoLocal(
  organizacaoId: string,
  destino: DestinoImpressao,
) {
  const candidatas = await db
    .select()
    .from(filaImpressoes)
    .where(
      and(
        eq(filaImpressoes.organizacaoId, organizacaoId),
        eq(filaImpressoes.destino, destino),
        eq(filaImpressoes.tipo, "ficha"),
        inArray(filaImpressoes.status, [
          "pendente",
          "falhou",
          "sem_configuracao",
          "imprimindo",
        ]),
      ),
    )
    .orderBy(filaImpressoes.criadoEm)
    .limit(10);

  for (const fila of candidatas) {
    const atualizadaEm = Date.parse(fila.atualizadoEm);
    if (
      fila.status === "imprimindo" &&
      Number.isFinite(atualizadaEm) &&
      Date.now() - atualizadaEm < RECUPERAR_IMPRESSAO_LOCAL_APOS_MS
    ) {
      continue;
    }
    const agora = new Date().toISOString();
    const reservado = await db
      .update(filaImpressoes)
      .set({
        status: "imprimindo",
        ultimoErro: null,
        tentativas: fila.tentativas + 1,
        atualizadoEm: agora,
      })
      .where(
        and(
          eq(filaImpressoes.organizacaoId, organizacaoId),
          eq(filaImpressoes.impressaoId, fila.impressaoId),
          eq(filaImpressoes.status, fila.status),
          eq(filaImpressoes.atualizadoEm, fila.atualizadoEm),
        ),
      );
    if (reservado.rowsAffected !== 1) continue;
    return impressoesPublicas([
      {
        ...fila,
        status: "imprimindo",
        tentativas: fila.tentativas + 1,
        ultimoErro: null,
        atualizadoEm: agora,
      },
    ])[0];
  }
  return null;
}

export async function concluirImpressaoLocal(
  organizacaoId: string,
  impressaoId: string,
  sucesso: boolean,
  erro?: string,
) {
  const agora = new Date().toISOString();
  const resultado = await db
    .update(filaImpressoes)
    .set({
      status: sucesso ? "impresso" : "falhou",
      ultimoErro: sucesso ? null : (erro?.trim().slice(0, 240) || "Impressão local não confirmada."),
      impressoEm: sucesso ? agora : null,
      atualizadoEm: agora,
    })
    .where(
      and(
        eq(filaImpressoes.organizacaoId, organizacaoId),
        eq(filaImpressoes.impressaoId, impressaoId),
        eq(filaImpressoes.status, "imprimindo"),
      ),
    );
  if (resultado.rowsAffected === 1) return { ok: true };

  const [atual] = await db
    .select({ status: filaImpressoes.status })
    .from(filaImpressoes)
    .where(
      and(
        eq(filaImpressoes.organizacaoId, organizacaoId),
        eq(filaImpressoes.impressaoId, impressaoId),
      ),
    )
    .limit(1);
  return { ok: atual?.status === "impresso" };
}

export async function solicitarReimpressao(
  organizacaoId: string,
  impressaoId: string,
) {
  const [fila] = await db
    .select()
    .from(filaImpressoes)
    .where(
      and(
        eq(filaImpressoes.organizacaoId, organizacaoId),
        eq(filaImpressoes.impressaoId, impressaoId),
      ),
    )
    .limit(1);
  if (!fila) throw new Error("Impressão não encontrada.");

  const [configuracao] = await db
    .select()
    .from(impressoras)
    .where(
      and(
        eq(impressoras.organizacaoId, organizacaoId),
        eq(impressoras.destino, fila.destino),
      ),
    )
    .limit(1);
  if (!configuracaoAtiva(configuracao)) {
    await db
      .update(filaImpressoes)
      .set({
        status: "sem_configuracao",
        ultimoErro: "Nenhuma impressora de rede ativa neste destino.",
        atualizadoEm: new Date().toISOString(),
      })
      .where(
        and(
          eq(filaImpressoes.organizacaoId, organizacaoId),
          eq(filaImpressoes.impressaoId, impressaoId),
        ),
      );
    return {
      modo: "navegador" as const,
      texto: fila.texto,
      largura: larguraValida(fila.largura),
    };
  }

  await db
    .update(filaImpressoes)
    .set({
      status: "pendente",
      ultimoErro: null,
      atualizadoEm: new Date().toISOString(),
    })
    .where(
      and(
        eq(filaImpressoes.organizacaoId, organizacaoId),
        eq(filaImpressoes.impressaoId, impressaoId),
      ),
    );
  processarFila(organizacaoId, [impressaoId]);
  return { modo: "rede" as const, texto: null, largura: larguraValida(fila.largura) };
}

export async function obterImpressao(organizacaoId: string, impressaoId: string) {
  const [fila] = await db
    .select({
      destino: filaImpressoes.destino,
    })
    .from(filaImpressoes)
    .where(
      and(
        eq(filaImpressoes.organizacaoId, organizacaoId),
        eq(filaImpressoes.impressaoId, impressaoId),
      ),
    )
    .limit(1);
  return fila ?? null;
}

export function erroDeConfiguracaoImpressora() {
  return "Informe host, porta entre 1 e 65535 e largura de papel válida.";
}
