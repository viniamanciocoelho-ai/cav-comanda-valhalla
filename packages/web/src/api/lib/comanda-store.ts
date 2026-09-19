import { and, eq, gt } from "drizzle-orm";
import { db } from "../database";
import {
  cardapio as cardapioTabela,
  auditoria,
  cancelamentosAutorizados,
  encerramentosSemConsumo,
  fechamentos,
  fichasProducao,
  filaImpressoes,
  funcionarios as funcionariosTabela,
  impressoras,
  itensFechamento,
  itensPedido,
  mesas,
  organizacoes,
  pessoasDaComanda,
  sessoes,
  versoesEstado,
} from "../database/schema";
import { garantirBanco } from "../database/bootstrap";
import {
  COMPARTILHADO,
  TAXA_SERVICO,
  compartilhadoId,
  ehCompartilhado,
} from "../../web/lib/operacao";
import { ratear } from "../../web/lib/rateio";
import type {
  ConfiguracaoImpressora,
  EncerramentoSemConsumo,
  Fechamento,
  Funcionario,
  MenuItem,
  Mesa,
  OrderItem,
  Pessoa,
  ProdutoConfiguracao,
  Ticket,
} from "../../web/lib/types";
import {
  configuracoesImpressoras,
  enfileirarImpressoesTx,
  impressoesPublicas,
  processarFila,
  hostImpressoraValido,
} from "./impressao";
import { cardapioInicial } from "./cardapio-inicial";
import { criarMesaVazia } from "./mesa-inicial";
import {
  conferirPin,
  gerarHashPin,
  novoToken,
  pinOperacionalValido,
  sha256,
} from "./security";

export interface EstadoPersistido {
  mesas: Mesa[];
  pessoas: Pessoa[];
  itens: OrderItem[];
  tickets: Ticket[];
  fechamentos: Fechamento[];
  encerramentos: EncerramentoSemConsumo[];
  anteriores: Record<string, OrderItem["status"]>;
}

export interface SessaoAutenticada {
  token: string;
  organizacaoId: string;
  funcionario: Funcionario;
}

const ORGANIZACAO_PADRAO = "valhalla";
const HASH_PIN_NEUTRO = gerarHashPin("0000");

export function configuracaoBootstrap() {
  const codigo = process.env.CAV_ORGANIZACAO_CODIGO?.trim().toLowerCase() || "valhalla";
  const pinGerencia = process.env.CAV_BOOTSTRAP_PIN_GERENCIA?.trim() ?? "";
  if (!pinOperacionalValido(pinGerencia)) {
    throw new Error(
      "Configure CAV_BOOTSTRAP_PIN_GERENCIA com um PIN não sequencial de 4 dígitos.",
    );
  }
  return { codigo, pinGerencia };
}

function agora() {
  return new Date().toISOString();
}

function reais(centavos: number) {
  return centavos / 100;
}

function centavos(valor: number) {
  return Math.round(valor * 100);
}

function statusAnteriorValido(status: OrderItem["status"] | undefined) {
  return status && status !== "cancelamento_solicitado" ? status : null;
}

function validarFechamentoFinanceiro(
  anterior: EstadoPersistido,
  fechamento: Fechamento,
) {
  const itens = anterior.itens.filter((item) => item.mesa_id === fechamento.mesa_id);
  const pessoas = anterior.pessoas.filter((pessoa) => pessoa.mesa_id === fechamento.mesa_id);
  const mesa = anterior.mesas.find((registro) => registro.mesa_id === fechamento.mesa_id);
  if (
    !mesa?.ativa ||
    !itens.length ||
    !pessoas.length ||
    fechamento.servicoIncluso !== mesa.servicoIncluso ||
    itens.some(
      (item) => item.status === "novo" || item.status === "cancelamento_solicitado",
    )
  ) {
    throw new Error("Fechamento inválido para a mesa.");
  }

  const centavosDoItem = (item: OrderItem) => centavos(item.price) * item.quantidade;
  const subtotal = itens.reduce((soma, item) => soma + centavosDoItem(item), 0);
  const servico = fechamento.servicoIncluso ? Math.round(subtotal * TAXA_SERVICO) : 0;
  const individuais = pessoas.map((pessoa) =>
    itens
      .filter((item) => item.pessoa_id === pessoa.pessoa_id)
      .reduce((soma, item) => soma + centavosDoItem(item), 0),
  );
  const compartilhado = itens
    .filter((item) => ehCompartilhado(item.pessoa_id))
    .reduce((soma, item) => soma + centavosDoItem(item), 0);
  if (
    itens.some(
      (item) =>
        !ehCompartilhado(item.pessoa_id) &&
        !pessoas.some((pessoa) => pessoa.pessoa_id === item.pessoa_id),
    )
  ) {
    throw new Error("Fechamento contém item sem pessoa válida.");
  }
  const compartilhados = ratear(
    compartilhado,
    pessoas.map(() => 1),
  );
  const bases = individuais.map((valor, indice) => valor + compartilhados[indice]);
  const servicos = ratear(servico, bases);
  const valoresEsperados = new Map(
    pessoas.map((pessoa, indice) => [
      pessoa.pessoa_id,
      bases[indice] + servicos[indice],
    ]),
  );
  const valoresRecebidos = new Map(
    fechamento.divisao.map((linha) => [linha.pessoa_id, centavos(linha.valor)]),
  );
  const divisaoValida =
    fechamento.divisao.length === pessoas.length &&
    valoresRecebidos.size === valoresEsperados.size &&
    [...valoresEsperados].every(
      ([pessoaId, valor]) =>
        valoresRecebidos.get(pessoaId) === valor &&
        fechamento.divisao.find((linha) => linha.pessoa_id === pessoaId)?.pessoa ===
          pessoas.find((pessoa) => pessoa.pessoa_id === pessoaId)?.nome,
    ) &&
    [...valoresRecebidos.values()].reduce((soma, valor) => soma + valor, 0) ===
      subtotal + servico;
  if (
    centavos(fechamento.subtotal) !== subtotal ||
    centavos(fechamento.servico) !== servico ||
    centavos(fechamento.total) !== subtotal + servico ||
    !divisaoValida
  ) {
    throw new Error("Totais ou divisão do fechamento não conferem.");
  }
}

async function sincronizarCardapioReal(organizacaoId: string) {
  const marcador = await db
    .select({ produtoId: cardapioTabela.produtoId })
    .from(cardapioTabela)
    .where(
      and(
        eq(cardapioTabela.organizacaoId, organizacaoId),
        eq(cardapioTabela.produtoId, "real-monster"),
      ),
    )
    .limit(1);
  if (marcador.length) return;

  await db.transaction(async (tx) => {
    for (const produto of cardapioInicial) {
      await tx
        .insert(cardapioTabela)
        .values({
          organizacaoId,
          produtoId: produto.produto_id,
          nome: produto.name,
          precoCentavos: centavos(produto.price),
          destinoProducao: produto.destino_producao,
          categoria: produto.categoria,
          ativo: true,
        })
        .onConflictDoUpdate({
          target: [cardapioTabela.organizacaoId, cardapioTabela.produtoId],
          set: {
            nome: produto.name,
            precoCentavos: centavos(produto.price),
            destinoProducao: produto.destino_producao,
            categoria: produto.categoria,
            ativo: true,
          },
        });
    }
  });
}

export async function garantirOrganizacaoPadrao() {
  await garantirBanco();
  const bootstrap = configuracaoBootstrap();
  const existente = await db
    .select()
    .from(organizacoes)
    .where(eq(organizacoes.codigo, bootstrap.codigo))
    .limit(1);
  if (existente.length) {
    await sincronizarCardapioReal(existente[0].organizacaoId);
    return;
  }

  const instante = agora();
  await db.transaction(async (tx) => {
    await tx.insert(organizacoes).values({
      organizacaoId: ORGANIZACAO_PADRAO,
      codigo: bootstrap.codigo,
      nome: "Valhalla Choperia",
      quantidadeMesas: 15,
      larguraRecibo: 80,
      criadoEm: instante,
      atualizadoEm: instante,
    });
    await tx.insert(versoesEstado).values({
      organizacaoId: ORGANIZACAO_PADRAO,
      versao: 1,
      atualizadoEm: instante,
    });
    await tx.insert(funcionariosTabela).values({
      organizacaoId: ORGANIZACAO_PADRAO,
      funcionarioId: "f-gerencia",
      nome: "Gerência",
      perfil: "gerencia",
      pinHash: await gerarHashPin(bootstrap.pinGerencia),
      ativo: true,
      criadoEm: instante,
      atualizadoEm: instante,
    });
    const mesasVazias = Array.from({ length: 15 }, (_, indice) =>
      criarMesaVazia(ORGANIZACAO_PADRAO, indice + 1),
    );
    await gravarEstadoTx(
      tx,
      ORGANIZACAO_PADRAO,
      {
        mesas: mesasVazias,
        pessoas: [],
        itens: [],
        tickets: [],
        fechamentos: [],
        encerramentos: [],
        anteriores: {},
      },
      cardapioInicial,
    );
  });
}

type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function gravarEstadoTx(
  tx: Transacao,
  organizacaoId: string,
  estado: EstadoPersistido,
  produtos?: MenuItem[],
  anterior?: EstadoPersistido,
  substituirHistorico = false,
) {
  await tx.delete(mesas).where(eq(mesas.organizacaoId, organizacaoId));
  await tx.delete(pessoasDaComanda).where(eq(pessoasDaComanda.organizacaoId, organizacaoId));
  await tx.delete(itensPedido).where(eq(itensPedido.organizacaoId, organizacaoId));
  await tx.delete(fichasProducao).where(eq(fichasProducao.organizacaoId, organizacaoId));
  if (!anterior || substituirHistorico) {
    await tx.delete(fechamentos).where(eq(fechamentos.organizacaoId, organizacaoId));
    await tx
      .delete(encerramentosSemConsumo)
      .where(eq(encerramentosSemConsumo.organizacaoId, organizacaoId));
  }

  if (estado.mesas.length) {
    await tx.insert(mesas).values(
      estado.mesas.map((mesa) => ({
        organizacaoId,
        mesaId: mesa.mesa_id,
        status: mesa.status,
        ativa: mesa.ativa,
        pessoasFixas: mesa.pessoasFixas,
        totalFixoCentavos: centavos(mesa.totalFixo),
        abertaEm: mesa.abertaEm,
        garcomId: mesa.garcom_id,
        contaSolicitada: mesa.contaSolicitada,
        servicoIncluso: mesa.servicoIncluso,
      })),
    );
  }
  if (estado.pessoas.length) {
    await tx.insert(pessoasDaComanda).values(
      estado.pessoas.map((pessoa) => ({
        organizacaoId,
        pessoaId: pessoa.pessoa_id,
        mesaId: pessoa.mesa_id,
        nome: pessoa.nome,
      })),
    );
  }
  if (estado.itens.length) {
    await tx.insert(itensPedido).values(
      estado.itens.map((item) => ({
        organizacaoId,
        itemId: item.item_id,
        pedidoId: item.pedido_id,
        mesaId: item.mesa_id,
        pessoaId: item.pessoa_id,
        produtoId: item.produto_id,
        nome: item.name,
        precoCentavos: centavos(item.price),
        quantidade: item.quantidade,
        observacao: item.observacao,
        destinoProducao: item.destino_producao,
        status: item.status,
        statusAnterior: statusAnteriorValido(estado.anteriores[item.item_id]),
        funcionarioId: item.funcionario_id,
        funcionarioNome: item.funcionario_nome,
        funcionarioPerfil: item.funcionario_perfil,
        criadoEm: item.criado_em,
        enviadoEm: item.enviado_em,
        atualizadoEm: item.atualizado_em,
      })),
    );
  }
  if (estado.tickets.length) {
    await tx.insert(fichasProducao).values(
      estado.tickets.map((ticket) => ({
        organizacaoId,
        ticketId: ticket.ticket_id,
        pedidoId: ticket.pedido_id,
        mesaId: ticket.mesa_id,
        destinoProducao: ticket.destino_producao,
        status: ticket.status,
        linhasJson: JSON.stringify(ticket.linhas),
        itemIdsJson: JSON.stringify(ticket.itemIds),
        funcionarioId: ticket.funcionario_id,
        funcionarioNome: ticket.funcionario_nome,
        criadoEm: ticket.criado_em,
        enviadoEm: ticket.enviado_em,
        atualizadoEm: ticket.atualizado_em,
      })),
    );
  }
  const fechamentosParaInserir =
    !anterior || substituirHistorico
      ? estado.fechamentos
      : estado.fechamentos.filter(
          (fechamento) =>
            !anterior.fechamentos.some(
              (existente) =>
                existente.fechamento_id === fechamento.fechamento_id,
            ),
        );
  if (fechamentosParaInserir.length) {
    await tx.insert(fechamentos).values(
      fechamentosParaInserir.map((fechamento) => ({
        organizacaoId,
        fechamentoId: fechamento.fechamento_id,
        mesaId: fechamento.mesa_id,
        hora: fechamento.hora,
        subtotalCentavos: centavos(fechamento.subtotal),
        servicoCentavos: centavos(fechamento.servico),
        totalCentavos: centavos(fechamento.total),
        servicoIncluso: fechamento.servicoIncluso,
        divisaoJson: JSON.stringify(fechamento.divisao),
        funcionarioNome: fechamento.funcionario_nome,
        garcomNome: fechamento.garcom_nome,
        criadoEm: agora(),
      })),
    );
  }
  const encerramentosParaInserir =
    !anterior || substituirHistorico
      ? estado.encerramentos
      : estado.encerramentos.filter(
          (registro) =>
            !anterior.encerramentos.some(
              (existente) =>
                existente.encerramento_id === registro.encerramento_id,
            ),
        );
  if (encerramentosParaInserir.length) {
    await tx.insert(encerramentosSemConsumo).values(
      encerramentosParaInserir.map((registro) => ({
        organizacaoId,
        encerramentoId: registro.encerramento_id,
        mesaId: registro.mesa_id,
        aberturaId: registro.abertura_id,
        motivo: registro.motivo,
        observacao: registro.observacao,
        rascunhosDescartados: registro.rascunhos_descartados,
        funcionarioId: registro.funcionario_id,
        funcionarioNome: registro.funcionario_nome,
        funcionarioPerfil: registro.funcionario_perfil,
        abertaEm: registro.aberta_em,
        encerradaEm: registro.encerrada_em,
        duracaoSegundos: registro.duracao_segundos,
        desfeitoEm: registro.desfeito_em,
      })),
    );
  }
  if (anterior && !substituirHistorico) {
    const encerramentosAlterados = estado.encerramentos.filter((registro) => {
      const existente = anterior.encerramentos.find(
        (anteriorRegistro) =>
          anteriorRegistro.encerramento_id === registro.encerramento_id,
      );
      return existente && existente.desfeito_em !== registro.desfeito_em;
    });
    for (const registro of encerramentosAlterados) {
      await tx
        .update(encerramentosSemConsumo)
        .set({ desfeitoEm: registro.desfeito_em })
        .where(
          and(
            eq(encerramentosSemConsumo.organizacaoId, organizacaoId),
            eq(encerramentosSemConsumo.encerramentoId, registro.encerramento_id),
          ),
        );
    }
  }
  if (produtos) {
    await tx.delete(cardapioTabela).where(eq(cardapioTabela.organizacaoId, organizacaoId));
    await tx.insert(cardapioTabela).values(
      produtos.map((produto) => ({
        organizacaoId,
        produtoId: produto.produto_id,
        nome: produto.name,
        precoCentavos: centavos(produto.price),
        destinoProducao: produto.destino_producao,
        categoria: produto.categoria,
        ativo: true,
      })),
    );
  }
}

export async function autenticar(codigo: string, pin: string): Promise<SessaoAutenticada | null> {
  await garantirOrganizacaoPadrao();
  const [organizacao] = await db
    .select()
    .from(organizacoes)
    .where(eq(organizacoes.codigo, codigo.trim().toLowerCase()))
    .limit(1);
  if (!organizacao) {
    await conferirPin(pin, await HASH_PIN_NEUTRO);
    return null;
  }
  const candidatos = await db
    .select()
    .from(funcionariosTabela)
    .where(
      and(
        eq(funcionariosTabela.organizacaoId, organizacao.organizacaoId),
        eq(funcionariosTabela.ativo, true),
      ),
    );
  for (const candidato of candidatos) {
    if (!(await conferirPin(pin, candidato.pinHash))) continue;
    const token = novoToken();
    const instante = agora();
    await db.insert(sessoes).values({
      tokenHash: await sha256(token),
      organizacaoId: organizacao.organizacaoId,
      funcionarioId: candidato.funcionarioId,
      criadoEm: instante,
      expiraEm: new Date(Date.now() + 12 * 60 * 60_000).toISOString(),
    });
    return {
      token,
      organizacaoId: organizacao.organizacaoId,
      funcionario: {
        funcionario_id: candidato.funcionarioId,
        funcionario_nome: candidato.nome,
        funcionario_perfil: candidato.perfil,
        rotulo: candidato.nome,
        resumo: "",
        ativo: true,
      },
    };
  }
  return null;
}

export async function obterSessao(cabecalho: string | null): Promise<SessaoAutenticada | null> {
  const token = cabecalho?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const [sessao] = await db
    .select()
    .from(sessoes)
    .where(eq(sessoes.tokenHash, tokenHash))
    .limit(1);
  if (!sessao) return null;
  if (new Date(sessao.expiraEm).getTime() <= Date.now()) {
    await db.delete(sessoes).where(eq(sessoes.tokenHash, tokenHash));
    return null;
  }
  const [funcionario] = await db
    .select()
    .from(funcionariosTabela)
    .where(
      and(
        eq(funcionariosTabela.organizacaoId, sessao.organizacaoId),
        eq(funcionariosTabela.funcionarioId, sessao.funcionarioId),
        eq(funcionariosTabela.ativo, true),
      ),
    )
    .limit(1);
  if (!funcionario) return null;
  return {
    token,
    organizacaoId: sessao.organizacaoId,
    funcionario: {
      funcionario_id: funcionario.funcionarioId,
      funcionario_nome: funcionario.nome,
      funcionario_perfil: funcionario.perfil,
      rotulo: funcionario.nome,
      resumo: "",
      ativo: true,
    },
  };
}

export async function revogarSessao(cabecalho: string | null): Promise<void> {
  const token = cabecalho?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return;
  await db.delete(sessoes).where(eq(sessoes.tokenHash, await sha256(token)));
}

export async function lerEstado(organizacaoId: string) {
  const [
    [versao],
    linhasMesas,
    linhasPessoas,
    linhasItens,
    linhasTickets,
    linhasFechamentos,
    linhasEncerramentos,
    linhasCardapio,
    [configuracao],
    linhasFuncionarios,
    linhasImpressoras,
    linhasFilaImpressoes,
  ] = await Promise.all([
    db.select().from(versoesEstado).where(eq(versoesEstado.organizacaoId, organizacaoId)).limit(1),
    db.select().from(mesas).where(eq(mesas.organizacaoId, organizacaoId)),
    db.select().from(pessoasDaComanda).where(eq(pessoasDaComanda.organizacaoId, organizacaoId)),
    db.select().from(itensPedido).where(eq(itensPedido.organizacaoId, organizacaoId)),
    db.select().from(fichasProducao).where(eq(fichasProducao.organizacaoId, organizacaoId)),
    db.select().from(fechamentos).where(eq(fechamentos.organizacaoId, organizacaoId)),
    db
      .select()
      .from(encerramentosSemConsumo)
      .where(eq(encerramentosSemConsumo.organizacaoId, organizacaoId)),
    db.select().from(cardapioTabela).where(eq(cardapioTabela.organizacaoId, organizacaoId)),
    db.select().from(organizacoes).where(eq(organizacoes.organizacaoId, organizacaoId)).limit(1),
    db
      .select()
      .from(funcionariosTabela)
      .where(eq(funcionariosTabela.organizacaoId, organizacaoId)),
    db
      .select()
      .from(impressoras)
      .where(eq(impressoras.organizacaoId, organizacaoId)),
    db
      .select()
      .from(filaImpressoes)
      .where(eq(filaImpressoes.organizacaoId, organizacaoId)),
  ]);

  const estado: EstadoPersistido = {
    mesas: linhasMesas.map((mesa) => ({
      organizacao_id: organizacaoId,
      mesa_id: mesa.mesaId,
      status: mesa.status,
      ativa: mesa.ativa,
      pessoasFixas: mesa.pessoasFixas,
      totalFixo: reais(mesa.totalFixoCentavos),
      abertaEm: mesa.abertaEm,
      garcom_id: mesa.garcomId,
      contaSolicitada: mesa.contaSolicitada,
      servicoIncluso: mesa.servicoIncluso,
    })),
    pessoas: linhasPessoas.map((pessoa) => ({
      pessoa_id: pessoa.pessoaId,
      nome: pessoa.nome,
      mesa_id: pessoa.mesaId,
    })),
    itens: linhasItens.map((item) => ({
      organizacao_id: organizacaoId,
      item_id: item.itemId,
      pedido_id: item.pedidoId,
      mesa_id: item.mesaId,
      pessoa_id: item.pessoaId,
      produto_id: item.produtoId,
      name: item.nome,
      price: reais(item.precoCentavos),
      quantidade: item.quantidade,
      observacao: item.observacao,
      destino_producao: item.destinoProducao,
      status: item.status,
      funcionario_id: item.funcionarioId,
      funcionario_nome: item.funcionarioNome,
      funcionario_perfil: item.funcionarioPerfil,
      criado_em: item.criadoEm,
      enviado_em: item.enviadoEm,
      atualizado_em: item.atualizadoEm,
    })),
    tickets: linhasTickets.map((ticket) => ({
      organizacao_id: organizacaoId,
      ticket_id: ticket.ticketId,
      pedido_id: ticket.pedidoId,
      mesa_id: ticket.mesaId,
      destino_producao: ticket.destinoProducao,
      status: ticket.status,
      linhas: JSON.parse(ticket.linhasJson) as Ticket["linhas"],
      itemIds: JSON.parse(ticket.itemIdsJson) as string[],
      funcionario_id: ticket.funcionarioId,
      funcionario_nome: ticket.funcionarioNome,
      criado_em: ticket.criadoEm,
      enviado_em: ticket.enviadoEm,
      atualizado_em: ticket.atualizadoEm,
    })),
    fechamentos: linhasFechamentos.map((fechamento) => ({
      organizacao_id: organizacaoId,
      fechamento_id: fechamento.fechamentoId,
      mesa_id: fechamento.mesaId,
      hora: fechamento.hora,
      subtotal: reais(fechamento.subtotalCentavos),
      servico: reais(fechamento.servicoCentavos),
      total: reais(fechamento.totalCentavos),
      servicoIncluso: fechamento.servicoIncluso,
      divisao: JSON.parse(fechamento.divisaoJson) as Fechamento["divisao"],
      nfce: "nao_solicitada",
      funcionario_nome: fechamento.funcionarioNome,
      garcom_nome: fechamento.garcomNome,
    })),
    encerramentos: linhasEncerramentos.map((registro) => ({
      organizacao_id: organizacaoId,
      encerramento_id: registro.encerramentoId,
      mesa_id: registro.mesaId,
      abertura_id: registro.aberturaId,
      encerrada_sem_consumo: true,
      motivo: registro.motivo as EncerramentoSemConsumo["motivo"],
      observacao: registro.observacao,
      rascunhos_descartados: registro.rascunhosDescartados,
      funcionario_id: registro.funcionarioId,
      funcionario_nome: registro.funcionarioNome,
      funcionario_perfil: registro.funcionarioPerfil,
      aberta_em: registro.abertaEm,
      encerrada_em: registro.encerradaEm,
      duracao_segundos: registro.duracaoSegundos,
      desfeito_em: registro.desfeitoEm,
    })),
    anteriores: Object.fromEntries(
      linhasItens
        .filter((item) => item.statusAnterior)
        .map((item) => [item.itemId, item.statusAnterior as OrderItem["status"]]),
    ),
  };

  const larguraRecibo = configuracao?.larguraRecibo === 58 ? 58 : 80;
  return {
    organizacaoId,
    versao: versao?.versao ?? 0,
    estado,
    cardapio: linhasCardapio
      .filter((produto) => produto.ativo)
      .map((produto) => ({
        produto_id: produto.produtoId,
        name: produto.nome,
        price: reais(produto.precoCentavos),
        destino_producao: produto.destinoProducao,
        categoria: produto.categoria,
      })),
    produtos: linhasCardapio.map((produto) => ({
      produto_id: produto.produtoId,
      name: produto.nome,
      price: reais(produto.precoCentavos),
      destino_producao: produto.destinoProducao,
      categoria: produto.categoria,
      ativo: produto.ativo,
    })),
    configuracao: {
      quantidadeMesas: configuracao?.quantidadeMesas ?? 15,
      larguraRecibo,
    },
    impressoras: configuracoesImpressoras(linhasImpressoras, larguraRecibo),
    impressoes: impressoesPublicas(linhasFilaImpressoes),
    funcionarios: linhasFuncionarios.map((funcionario) => ({
      funcionario_id: funcionario.funcionarioId,
      funcionario_nome: funcionario.nome,
      funcionario_perfil: funcionario.perfil,
      rotulo: funcionario.nome,
      resumo: "",
      ativo: funcionario.ativo,
    })),
  };
}

export function validarTransicao(
  anterior: EstadoPersistido,
  proximo: EstadoPersistido,
  funcionario: Funcionario,
  acao: string,
  funcionariosAtivos: Funcionario[] = [funcionario],
) {
  const serializar = (valor: unknown) => JSON.stringify(valor);
  const iguais = (chave: keyof EstadoPersistido) =>
    serializar(anterior[chave]) === serializar(proximo[chave]);
  const colecoesPermitidas: Record<string, (keyof EstadoPersistido)[]> = {
    abrir_mesa: ["mesas"],
    alterar_comanda: ["pessoas", "itens"],
    enviar_pedido: ["itens", "tickets"],
    mover_producao: ["itens", "tickets"],
    entregar_item: ["itens", "tickets"],
    solicitar_cancelamento: ["itens", "anteriores"],
    decidir_cancelamento: ["itens", "tickets", "anteriores"],
    solicitar_fechamento: ["mesas"],
    alterar_servico: ["mesas"],
    fechar_conta: ["mesas", "pessoas", "itens", "tickets", "fechamentos", "anteriores"],
    encerrar_sem_consumo: ["mesas", "pessoas", "itens", "encerramentos"],
    desfazer_sem_consumo: ["mesas", "pessoas", "itens", "encerramentos"],
  };
  const permitidas = new Set(colecoesPermitidas[acao] ?? []);
  for (const chave of Object.keys(anterior) as (keyof EstadoPersistido)[]) {
    if (!permitidas.has(chave) && !iguais(chave)) {
      throw new Error(`A ação ${acao} não pode alterar ${String(chave)}.`);
    }
  }

  const validarCamposComuns = <T extends Record<string, unknown>>(
    antes: T[],
    depois: T[],
    chave: keyof T,
    camposPermitidos: string[],
  ): string[] => {
    const mapaAntes = new Map(antes.map((registro) => [String(registro[chave]), registro]));
    const mapaDepois = new Map(depois.map((registro) => [String(registro[chave]), registro]));
    if (
      mapaAntes.size !== mapaDepois.size ||
      [...mapaAntes.keys()].some((id) => !mapaDepois.has(id))
    ) {
      throw new Error(`A ação ${acao} não pode criar ou remover registros nesta coleção.`);
    }
    const permitidosCampos = new Set(camposPermitidos);
    const alterados: string[] = [];
    for (const [id, registroAntes] of mapaAntes) {
      const registroDepois = mapaDepois.get(id);
      if (!registroDepois) throw new Error(`Registro ${id} desapareceu durante ${acao}.`);
      if (serializar(registroAntes) === serializar(registroDepois)) continue;
      alterados.push(id);
      const semPermitidos = (registro: T) =>
        Object.fromEntries(
          Object.entries(registro).filter(([campo]) => !permitidosCampos.has(campo)),
        );
      if (serializar(semPermitidos(registroAntes)) !== serializar(semPermitidos(registroDepois))) {
        throw new Error(`A ação ${acao} alterou campos não permitidos.`);
      }
    }
    return alterados;
  };
  const validarForaDaMesa = <T extends { mesa_id: number }>(
    antes: T[],
    depois: T[],
    mesaId: number,
  ) => {
    if (
      serializar(antes.filter((registro) => registro.mesa_id !== mesaId)) !==
      serializar(depois.filter((registro) => registro.mesa_id !== mesaId))
    ) {
      throw new Error(`A ação ${acao} alterou registros de outra mesa.`);
    }
  };

  const mapaAnterior = new Map(anterior.mesas.map((mesa) => [mesa.mesa_id, mesa]));
  const mapaProximo = new Map(proximo.mesas.map((mesa) => [mesa.mesa_id, mesa]));

  if (acao === "abrir_mesa") {
    const alteradas = validarCamposComuns(
      anterior.mesas as unknown as Record<string, unknown>[],
      proximo.mesas as unknown as Record<string, unknown>[],
      "mesa_id",
      [
        "status",
        "ativa",
        "abertaEm",
        "garcom_id",
        "contaSolicitada",
        "servicoIncluso",
        "pessoasFixas",
        "totalFixo",
      ],
    );
    const antes = alteradas.length === 1 ? mapaAnterior.get(Number(alteradas[0])) : null;
    const depois = alteradas.length === 1 ? mapaProximo.get(Number(alteradas[0])) : null;
    if (
      alteradas.length !== 1 ||
      !antes ||
      !depois ||
      antes.status !== "livre" ||
      antes.ativa ||
      depois.status !== "ocupada" ||
      !depois.ativa ||
      !depois.abertaEm ||
      depois.garcom_id !== funcionario.funcionario_id ||
      depois.contaSolicitada ||
      !depois.servicoIncluso ||
      depois.pessoasFixas !== 0 ||
      centavos(depois.totalFixo) !== 0
    ) {
      throw new Error("Abertura de mesa inválida.");
    }
  }

  if (acao === "alterar_comanda") {
    const pessoasAntes = new Map(anterior.pessoas.map((pessoa) => [pessoa.pessoa_id, pessoa]));
    const pessoasDepois = new Map(proximo.pessoas.map((pessoa) => [pessoa.pessoa_id, pessoa]));
    for (const [pessoaId, pessoa] of pessoasAntes) {
      const depois = pessoasDepois.get(pessoaId);
      if (!depois || serializar(pessoa) !== serializar(depois)) {
        throw new Error("Alteração de comanda não pode remover ou editar pessoas.");
      }
    }
    for (const pessoa of proximo.pessoas) {
      if (pessoasAntes.has(pessoa.pessoa_id)) continue;
      const mesa = mapaAnterior.get(pessoa.mesa_id);
      if (!mesa?.ativa || mesa.contaSolicitada) {
        throw new Error("Pessoa nova exige mesa ativa e aberta para lançamentos.");
      }
    }

    const itensAntes = new Map(anterior.itens.map((item) => [item.item_id, item]));
    const itensDepois = new Map(proximo.itens.map((item) => [item.item_id, item]));
    for (const [itemId, itemAntes] of itensAntes) {
      const itemDepois = itensDepois.get(itemId);
      if (!itemDepois) {
        if (itemAntes.status !== "novo") {
          throw new Error("Somente rascunhos podem ser removidos da comanda.");
        }
        continue;
      }
      if (serializar(itemAntes) === serializar(itemDepois)) continue;
      validarCamposComuns(
        [itemAntes] as unknown as Record<string, unknown>[],
        [itemDepois] as unknown as Record<string, unknown>[],
        "item_id",
        ["quantidade", "observacao", "atualizado_em"],
      );
      if (itemAntes.status !== "novo" || itemDepois.status !== "novo") {
        throw new Error("Somente rascunhos podem ser editados na comanda.");
      }
    }
    for (const item of proximo.itens) {
      if (itensAntes.has(item.item_id)) continue;
      const mesa = mapaAnterior.get(item.mesa_id);
      const pessoaValida =
        item.pessoa_id === compartilhadoId(item.mesa_id) ||
        proximo.pessoas.some(
          (pessoa) =>
            pessoa.pessoa_id === item.pessoa_id && pessoa.mesa_id === item.mesa_id,
        );
      if (
        !mesa?.ativa ||
        mesa.contaSolicitada ||
        !pessoaValida ||
        item.status !== "novo" ||
        item.pedido_id !== null ||
        item.enviado_em !== null
      ) {
        throw new Error("Novo item inválido para a comanda.");
      }
    }
  }

  if (acao === "enviar_pedido") {
    const itensAlterados = validarCamposComuns(
      anterior.itens as unknown as Record<string, unknown>[],
      proximo.itens as unknown as Record<string, unknown>[],
      "item_id",
      ["pedido_id", "status", "enviado_em", "atualizado_em"],
    );
    const itensAntes = new Map(anterior.itens.map((item) => [item.item_id, item]));
    const itensDepois = new Map(proximo.itens.map((item) => [item.item_id, item]));
    for (const itemId of itensAlterados) {
      const antes = itensAntes.get(itemId);
      const depois = itensDepois.get(itemId);
      if (
        !antes ||
        !depois ||
        antes.status !== "novo" ||
        depois.status !== "enviado" ||
        !depois.pedido_id ||
        !depois.enviado_em
      ) {
        throw new Error("Transição de item inválida ao enviar pedido.");
      }
    }

    const ticketsAntes = new Map(
      anterior.tickets.map((ticket) => [ticket.ticket_id, ticket]),
    );
    const ticketsDepois = new Map(
      proximo.tickets.map((ticket) => [ticket.ticket_id, ticket]),
    );
    for (const [ticketId, ticket] of ticketsAntes) {
      const depois = ticketsDepois.get(ticketId);
      if (!depois || serializar(ticket) !== serializar(depois)) {
        throw new Error("Enviar pedido não pode alterar fichas existentes.");
      }
    }
    const ticketsNovos = proximo.tickets.filter(
      (ticket) => !ticketsAntes.has(ticket.ticket_id),
    );
    const itensVinculados = new Set<string>();
    for (const ticket of ticketsNovos) {
      const idsUnicos = new Set(ticket.itemIds);
      if (
        ticket.status !== "enviado" ||
        ticket.funcionario_id !== funcionario.funcionario_id ||
        ticket.funcionario_nome !== funcionario.funcionario_nome ||
        idsUnicos.size !== ticket.itemIds.length ||
        ticket.linhas.length !== ticket.itemIds.length
      ) {
        throw new Error("Ficha de produção nova inválida.");
      }
      for (const itemId of ticket.itemIds) {
        if (itensVinculados.has(itemId)) {
          throw new Error("Item duplicado entre fichas de produção.");
        }
        itensVinculados.add(itemId);
        const item = itensDepois.get(itemId);
        const linha = ticket.linhas.find((registro) => registro.item_id === itemId);
        if (
          !item ||
          !itensAlterados.includes(itemId) ||
          item.pedido_id !== ticket.pedido_id ||
          item.mesa_id !== ticket.mesa_id ||
          item.destino_producao !== ticket.destino_producao ||
          !linha ||
          linha.produto_id !== item.produto_id ||
          linha.name !== item.name ||
          linha.qty !== item.quantidade ||
          linha.observacao !== item.observacao ||
          linha.pessoa !==
            (ehCompartilhado(item.pessoa_id)
              ? COMPARTILHADO
              : proximo.pessoas.find(
                  (pessoa) => pessoa.pessoa_id === item.pessoa_id,
                )?.nome)
        ) {
          throw new Error("Ficha de produção não corresponde aos itens enviados.");
        }
      }
    }
    if (
      !itensAlterados.length ||
      !ticketsNovos.length ||
      itensVinculados.size !== itensAlterados.length
    ) {
      throw new Error("Envio deve vincular todos os itens alterados a fichas novas.");
    }
  }

  if (acao === "mover_producao") {
    const itensAlterados = validarCamposComuns(
      anterior.itens as unknown as Record<string, unknown>[],
      proximo.itens as unknown as Record<string, unknown>[],
      "item_id",
      ["status", "atualizado_em"],
    );
    const ticketsAlterados = validarCamposComuns(
      anterior.tickets as unknown as Record<string, unknown>[],
      proximo.tickets as unknown as Record<string, unknown>[],
      "ticket_id",
      ["status", "atualizado_em"],
    );
    const antes = anterior.tickets.find(
      (ticket) => ticket.ticket_id === ticketsAlterados[0],
    );
    const depois = proximo.tickets.find(
      (ticket) => ticket.ticket_id === ticketsAlterados[0],
    );
    const transicao = antes && depois ? `${antes.status}:${depois.status}` : "";
    const transicoesValidas = new Set([
      "enviado:preparando",
      "preparando:enviado",
      "preparando:pronto",
      "pronto:preparando",
    ]);
    if (
      ticketsAlterados.length !== 1 ||
      !antes ||
      !depois ||
      !transicoesValidas.has(transicao)
    ) {
      throw new Error("Transição de produção inválida.");
    }
    const vinculados = new Set(antes.itemIds);
    if (itensAlterados.some((itemId) => !vinculados.has(itemId))) {
      throw new Error("Produção alterou item fora da ficha.");
    }
    for (const itemId of vinculados) {
      const itemAntes = anterior.itens.find((item) => item.item_id === itemId);
      const itemDepois = proximo.itens.find((item) => item.item_id === itemId);
      if (!itemAntes || !itemDepois) throw new Error("Ficha referencia item inexistente.");
      const imutavel =
        itemAntes.status === "entregue" ||
        itemAntes.status === "cancelamento_solicitado";
      if (
        (imutavel && itemDepois.status !== itemAntes.status) ||
        (!imutavel && itemDepois.status !== depois.status)
      ) {
        throw new Error("Status da ficha e dos itens ficou inconsistente.");
      }
    }
  }

  if (acao === "entregar_item") {
    const itensAlterados = validarCamposComuns(
      anterior.itens as unknown as Record<string, unknown>[],
      proximo.itens as unknown as Record<string, unknown>[],
      "item_id",
      ["status", "atualizado_em"],
    );
    const ticketsAlterados = validarCamposComuns(
      anterior.tickets as unknown as Record<string, unknown>[],
      proximo.tickets as unknown as Record<string, unknown>[],
      "ticket_id",
      ["status", "atualizado_em"],
    );
    const itemAntes = anterior.itens.find(
      (item) => item.item_id === itensAlterados[0],
    );
    const itemDepois = proximo.itens.find(
      (item) => item.item_id === itensAlterados[0],
    );
    if (
      itensAlterados.length !== 1 ||
      !itemAntes ||
      !itemDepois ||
      itemAntes.status !== "pronto" ||
      itemDepois.status !== "entregue"
    ) {
      throw new Error("Entrega de item inválida.");
    }
    for (const ticketId of ticketsAlterados) {
      const ticketAntes = anterior.tickets.find((ticket) => ticket.ticket_id === ticketId);
      const ticketDepois = proximo.tickets.find((ticket) => ticket.ticket_id === ticketId);
      if (
        !ticketAntes ||
        !ticketDepois ||
        !ticketAntes.itemIds.includes(itemAntes.item_id) ||
        ticketDepois.status !== "entregue" ||
        !ticketDepois.itemIds.every(
          (itemId) =>
            proximo.itens.find((item) => item.item_id === itemId)?.status === "entregue",
        )
      ) {
        throw new Error("Entrega deixou a ficha inconsistente.");
      }
    }
    for (const ticket of proximo.tickets.filter((registro) =>
      registro.itemIds.includes(itemAntes.item_id),
    )) {
      const todosEntregues = ticket.itemIds.every(
        (itemId) =>
          proximo.itens.find((item) => item.item_id === itemId)?.status === "entregue",
      );
      if (todosEntregues !== (ticket.status === "entregue")) {
        throw new Error("Entrega deixou a ficha inconsistente.");
      }
    }
  }

  if (acao === "solicitar_cancelamento") {
    const itensAlterados = validarCamposComuns(
      anterior.itens as unknown as Record<string, unknown>[],
      proximo.itens as unknown as Record<string, unknown>[],
      "item_id",
      ["status", "atualizado_em"],
    );
    const antes = anterior.itens.find((item) => item.item_id === itensAlterados[0]);
    const depois = proximo.itens.find((item) => item.item_id === itensAlterados[0]);
    const anterioresEsperados =
      antes && depois
        ? { ...anterior.anteriores, [antes.item_id]: antes.status }
        : anterior.anteriores;
    if (
      itensAlterados.length !== 1 ||
      !antes ||
      !depois ||
      !["enviado", "preparando", "pronto"].includes(antes.status) ||
      depois.status !== "cancelamento_solicitado" ||
      serializar(proximo.anteriores) !== serializar(anterioresEsperados)
    ) {
      throw new Error("Solicitação de cancelamento inválida.");
    }
  }
  if (acao === "decidir_cancelamento") {
    const mapaItensDepois = new Map(
      proximo.itens.map((item) => [item.item_id, item]),
    );
    const candidatos = anterior.itens.filter((item) => {
      const depois = mapaItensDepois.get(item.item_id);
      return (
        item.status === "cancelamento_solicitado" &&
        (!depois || serializar(item) !== serializar(depois))
      );
    });
    const itemAntes = candidatos[0];
    const itemDepois = itemAntes
      ? mapaItensDepois.get(itemAntes.item_id)
      : undefined;
    if (candidatos.length !== 1 || !itemAntes) {
      throw new Error("Decisão de cancelamento deve afetar exatamente um item pendente.");
    }
    const itensInalterados = anterior.itens
      .filter((item) => item.item_id !== itemAntes.item_id)
      .every(
        (item) =>
          serializar(item) === serializar(mapaItensDepois.get(item.item_id)),
      );
    const anterioresEsperados = { ...anterior.anteriores };
    delete anterioresEsperados[itemAntes.item_id];
    if (
      !itensInalterados ||
      serializar(proximo.anteriores) !== serializar(anterioresEsperados)
    ) {
      throw new Error("Decisão de cancelamento alterou itens ou histórico indevidos.");
    }

    if (itemDepois) {
      validarCamposComuns(
        [itemAntes] as unknown as Record<string, unknown>[],
        [itemDepois] as unknown as Record<string, unknown>[],
        "item_id",
        ["status", "atualizado_em"],
      );
      const ficha = anterior.tickets.find((ticket) =>
        ticket.itemIds.includes(itemAntes.item_id),
      );
      const statusAnterior = anterior.anteriores[itemAntes.item_id] ?? "enviado";
      const restaurado =
        ficha && ficha.status !== "entregue" ? ficha.status : statusAnterior;
      if (
        itemDepois.status !== restaurado ||
        serializar(anterior.tickets) !== serializar(proximo.tickets)
      ) {
        throw new Error("Recusa de cancelamento inválida.");
      }
    } else {
      if (proximo.itens.length !== anterior.itens.length - 1) {
        throw new Error("Autorização de cancelamento removeu itens indevidos.");
      }
      const ticketsDepois = new Map(
        proximo.tickets.map((ticket) => [ticket.ticket_id, ticket]),
      );
      for (const ticketAntes of anterior.tickets) {
        const ticketDepois = ticketsDepois.get(ticketAntes.ticket_id);
        if (!ticketAntes.itemIds.includes(itemAntes.item_id)) {
          if (!ticketDepois || serializar(ticketAntes) !== serializar(ticketDepois)) {
            throw new Error("Cancelamento alterou ficha não relacionada.");
          }
          continue;
        }

        const itemIds = ticketAntes.itemIds.filter(
          (itemId) => itemId !== itemAntes.item_id,
        );
        const linhas = ticketAntes.linhas.filter(
          (linha) => linha.item_id !== itemAntes.item_id,
        );
        if (!itemIds.length) {
          if (ticketDepois) {
            throw new Error("Ficha vazia deveria ser removida após o cancelamento.");
          }
          continue;
        }
        const todosEntregues = itemIds.every(
          (itemId) =>
            proximo.itens.find((item) => item.item_id === itemId)?.status ===
            "entregue",
        );
        const esperado = {
          ...ticketAntes,
          status: todosEntregues ? ("entregue" as const) : ticketAntes.status,
          itemIds,
          linhas,
          atualizado_em: ticketDepois?.atualizado_em,
        };
        if (
          !ticketDepois ||
          serializar(ticketDepois) !== serializar(esperado)
        ) {
          throw new Error("Ficha ficou inconsistente após autorizar cancelamento.");
        }
      }
      if (
        proximo.tickets.some(
          (ticket) =>
            !anterior.tickets.some(
              (existente) => existente.ticket_id === ticket.ticket_id,
            ),
        )
      ) {
        throw new Error("Cancelamento não pode criar ficha de produção.");
      }
    }
  }

  const idsMesasAlteradas = new Set<number>();
  for (const id of new Set([...mapaAnterior.keys(), ...mapaProximo.keys()])) {
    if (serializar(mapaAnterior.get(id)) !== serializar(mapaProximo.get(id))) idsMesasAlteradas.add(id);
  }
  const colecoesPorMesa = [
    [anterior.pessoas, proximo.pessoas, "pessoa_id"],
    [anterior.itens, proximo.itens, "item_id"],
    [anterior.tickets, proximo.tickets, "ticket_id"],
  ] as const;
  for (const [antes, depois, chaveId] of colecoesPorMesa) {
    const mapaAntes = new Map(
      antes.map((registro) => [String(registro[chaveId as keyof typeof registro]), registro]),
    );
    const mapaDepois = new Map(
      depois.map((registro) => [String(registro[chaveId as keyof typeof registro]), registro]),
    );
    const chaves = new Set([...mapaAntes.keys(), ...mapaDepois.keys()]);
    for (const chave of chaves) {
      if (serializar(mapaAntes.get(chave)) === serializar(mapaDepois.get(chave))) continue;
      const registro = mapaAntes.get(chave) ?? mapaDepois.get(chave);
      if (registro) idsMesasAlteradas.add(registro.mesa_id);
    }
  }

  if (acao === "solicitar_fechamento") {
    const alteradas = validarCamposComuns(
      anterior.mesas as unknown as Record<string, unknown>[],
      proximo.mesas as unknown as Record<string, unknown>[],
      "mesa_id",
      ["status", "contaSolicitada"],
    );
    const antes = alteradas.length === 1 ? mapaAnterior.get(Number(alteradas[0])) : null;
    const depois = alteradas.length === 1 ? mapaProximo.get(Number(alteradas[0])) : null;
    const itensMesa = antes
      ? anterior.itens.filter((item) => item.mesa_id === antes.mesa_id)
      : [];
    const temPessoas = antes
      ? anterior.pessoas.some((pessoa) => pessoa.mesa_id === antes.mesa_id)
      : false;
    if (
      alteradas.length !== 1 ||
      !antes?.ativa ||
      antes.contaSolicitada ||
      !depois?.ativa ||
      depois.status !== "aguardando" ||
      !depois.contaSolicitada ||
      !itensMesa.length ||
      !temPessoas ||
      itensMesa.some(
        (item) =>
          item.status === "novo" ||
          item.status === "cancelamento_solicitado",
      )
    ) {
      throw new Error("Solicitação de fechamento inválida.");
    }
  }

  if (acao === "alterar_servico") {
    const alteradas = validarCamposComuns(
      anterior.mesas as unknown as Record<string, unknown>[],
      proximo.mesas as unknown as Record<string, unknown>[],
      "mesa_id",
      ["servicoIncluso"],
    );
    const antes = alteradas.length === 1 ? mapaAnterior.get(Number(alteradas[0])) : null;
    const depois = alteradas.length === 1 ? mapaProximo.get(Number(alteradas[0])) : null;
    if (
      alteradas.length !== 1 ||
      !antes?.ativa ||
      !depois?.ativa ||
      antes.servicoIncluso === depois.servicoIncluso
    ) {
      throw new Error("Alteração da taxa de serviço inválida.");
    }
  }

  if (funcionario.funcionario_perfil === "garcom") {
    for (const mesaId of idsMesasAlteradas) {
      const mesa = mapaAnterior.get(mesaId) ?? mapaProximo.get(mesaId);
      const abrindoLivre =
        acao === "abrir_mesa" &&
        mapaAnterior.get(mesaId)?.status === "livre" &&
        mapaProximo.get(mesaId)?.garcom_id === funcionario.funcionario_id;
      if (!abrindoLivre && mesa?.garcom_id !== funcionario.funcionario_id) {
        throw new Error("Garçom não pode alterar mesa de outro funcionário.");
      }
    }
  }

  const itensNovos = proximo.itens.filter(
    (item) => !anterior.itens.some((existente) => existente.item_id === item.item_id),
  );
  const autoriaCorresponde = (item: OrderItem, autor: Funcionario) =>
    item.funcionario_id === autor.funcionario_id &&
    item.funcionario_nome === autor.funcionario_nome &&
    item.funcionario_perfil === autor.funcionario_perfil;
  if (
    itensNovos.some(
      (item) =>
        !autoriaCorresponde(item, funcionario) &&
        (acao !== "desfazer_sem_consumo" ||
          !funcionariosAtivos.some((autor) => autoriaCorresponde(item, autor))),
    )
  ) {
    throw new Error("Autoria de item inválida.");
  }
  const fechamentosNovos = proximo.fechamentos.filter(
    (registro) =>
      !anterior.fechamentos.some(
        (existente) => existente.fechamento_id === registro.fechamento_id,
      ),
  );
  if (acao === "fechar_conta") {
    const fechamentosAntes = new Map(
      anterior.fechamentos.map((registro) => [registro.fechamento_id, registro]),
    );
    for (const [fechamentoId, registro] of fechamentosAntes) {
      const depois = proximo.fechamentos.find(
        (fechamento) => fechamento.fechamento_id === fechamentoId,
      );
      if (!depois || serializar(registro) !== serializar(depois)) {
        throw new Error("Fechamento não pode alterar registros financeiros anteriores.");
      }
    }
    const fechamento = fechamentosNovos[0];
    const mesaAntes = fechamento ? mapaAnterior.get(fechamento.mesa_id) : null;
    const mesaDepois = fechamento ? mapaProximo.get(fechamento.mesa_id) : null;
    if (
      fechamentosNovos.length !== 1 ||
      !fechamento ||
      !mesaAntes?.ativa ||
      !mesaDepois ||
      mesaDepois.status !== "livre" ||
      mesaDepois.ativa ||
      mesaDepois.contaSolicitada ||
      mesaDepois.abertaEm !== null ||
      mesaDepois.garcom_id !== null ||
      !mesaDepois.servicoIncluso ||
      mesaDepois.pessoasFixas !== 0 ||
      centavos(mesaDepois.totalFixo) !== 0
    ) {
      throw new Error("Encerramento financeiro da mesa inválido.");
    }
    validarForaDaMesa(anterior.pessoas, proximo.pessoas, fechamento.mesa_id);
    validarForaDaMesa(anterior.itens, proximo.itens, fechamento.mesa_id);
    validarForaDaMesa(anterior.tickets, proximo.tickets, fechamento.mesa_id);
    if (
      proximo.pessoas.some((registro) => registro.mesa_id === fechamento.mesa_id) ||
      proximo.itens.some((registro) => registro.mesa_id === fechamento.mesa_id) ||
      proximo.tickets.some((registro) => registro.mesa_id === fechamento.mesa_id)
    ) {
      throw new Error("Fechamento deve limpar somente os dados da mesa encerrada.");
    }
    const itensDaMesa = new Set(
      anterior.itens
        .filter((item) => item.mesa_id === fechamento.mesa_id)
        .map((item) => item.item_id),
    );
    const anterioresEsperados = Object.fromEntries(
      Object.entries(anterior.anteriores).filter(([itemId]) => !itensDaMesa.has(itemId)),
    );
    if (serializar(proximo.anteriores) !== serializar(anterioresEsperados)) {
      throw new Error("Fechamento alterou histórico de cancelamento de outra mesa.");
    }
  }
  if (
    fechamentosNovos.some(
      (registro) => registro.funcionario_nome !== funcionario.funcionario_nome,
    )
  ) {
    throw new Error("Autoria de fechamento inválida.");
  }
  for (const fechamento of fechamentosNovos) {
    validarFechamentoFinanceiro(anterior, fechamento);
  }
  const encerramentosNovos = proximo.encerramentos.filter(
    (registro) =>
      !anterior.encerramentos.some(
        (existente) => existente.encerramento_id === registro.encerramento_id,
      ),
  );
  if (acao === "encerrar_sem_consumo") {
    const registrosAntes = new Map(
      anterior.encerramentos.map((registro) => [registro.encerramento_id, registro]),
    );
    for (const [encerramentoId, registro] of registrosAntes) {
      const depois = proximo.encerramentos.find(
        (encerramento) => encerramento.encerramento_id === encerramentoId,
      );
      if (!depois || serializar(registro) !== serializar(depois)) {
        throw new Error("Encerramento sem consumo não pode alterar auditoria anterior.");
      }
    }
    const registro = encerramentosNovos[0];
    const mesaAntes = registro ? mapaAnterior.get(registro.mesa_id) : null;
    const mesaDepois = registro ? mapaProximo.get(registro.mesa_id) : null;
    const itensMesa = registro
      ? anterior.itens.filter((item) => item.mesa_id === registro.mesa_id)
      : [];
    if (
      encerramentosNovos.length !== 1 ||
      !registro ||
      !mesaAntes?.ativa ||
      !mesaAntes.abertaEm ||
      !mesaDepois ||
      mesaDepois.status !== "livre" ||
      mesaDepois.ativa ||
      mesaDepois.abertaEm !== null ||
      mesaDepois.garcom_id !== null ||
      mesaDepois.contaSolicitada ||
      !mesaDepois.servicoIncluso ||
      itensMesa.some((item) => item.status !== "novo") ||
      anterior.tickets.some((ticket) => ticket.mesa_id === registro.mesa_id) ||
      registro.abertura_id !== `ab-m${registro.mesa_id}-${mesaAntes.abertaEm}` ||
      registro.aberta_em !== mesaAntes.abertaEm ||
      registro.desfeito_em !== null ||
      registro.rascunhos_descartados !==
        itensMesa.reduce((soma, item) => soma + item.quantidade, 0)
    ) {
      throw new Error("Encerramento sem consumo inválido.");
    }
    validarForaDaMesa(anterior.pessoas, proximo.pessoas, registro.mesa_id);
    validarForaDaMesa(anterior.itens, proximo.itens, registro.mesa_id);
    if (
      proximo.pessoas.some((pessoa) => pessoa.mesa_id === registro.mesa_id) ||
      proximo.itens.some((item) => item.mesa_id === registro.mesa_id)
    ) {
      throw new Error("Encerramento sem consumo deve limpar somente a mesa informada.");
    }
  }
  if (acao === "desfazer_sem_consumo") {
    const alterados = validarCamposComuns(
      anterior.encerramentos as unknown as Record<string, unknown>[],
      proximo.encerramentos as unknown as Record<string, unknown>[],
      "encerramento_id",
      ["desfeito_em"],
    );
    const antes = anterior.encerramentos.find(
      (registro) => registro.encerramento_id === alterados[0],
    );
    const depois = proximo.encerramentos.find(
      (registro) => registro.encerramento_id === alterados[0],
    );
    const desfeitoEm = depois?.desfeito_em ? new Date(depois.desfeito_em).getTime() : Number.NaN;
    const encerradaEm = antes ? new Date(antes.encerrada_em).getTime() : Number.NaN;
    const mesaAntes = antes ? mapaAnterior.get(antes.mesa_id) : null;
    const mesaDepois = antes ? mapaProximo.get(antes.mesa_id) : null;
    if (
      alterados.length !== 1 ||
      !antes ||
      !depois ||
      antes.desfeito_em !== null ||
      !Number.isFinite(desfeitoEm) ||
      !Number.isFinite(encerradaEm) ||
      desfeitoEm < encerradaEm ||
      desfeitoEm - encerradaEm > 10_000 ||
      !mesaAntes ||
      mesaAntes.status !== "livre" ||
      mesaAntes.ativa ||
      !mesaDepois ||
      mesaDepois.status !== "ocupada" ||
      !mesaDepois.ativa ||
      mesaDepois.abertaEm !== antes.aberta_em ||
      mesaDepois.contaSolicitada
    ) {
      throw new Error("Desfazer encerramento sem consumo inválido ou expirado.");
    }
    validarForaDaMesa(anterior.pessoas, proximo.pessoas, antes.mesa_id);
    validarForaDaMesa(anterior.itens, proximo.itens, antes.mesa_id);
    const pessoasAntes = new Set(anterior.pessoas.map((pessoa) => pessoa.pessoa_id));
    const itensAntes = new Set(anterior.itens.map((item) => item.item_id));
    const pessoasRestauradas = proximo.pessoas.filter(
      (pessoa) => !pessoasAntes.has(pessoa.pessoa_id),
    );
    const itensRestaurados = proximo.itens.filter((item) => !itensAntes.has(item.item_id));
    if (
      pessoasRestauradas.some((pessoa) => pessoa.mesa_id !== antes.mesa_id) ||
      itensRestaurados.some(
        (item) =>
          item.mesa_id !== antes.mesa_id ||
          item.status !== "novo" ||
          item.pedido_id !== null ||
          item.enviado_em !== null,
      ) ||
      itensRestaurados.reduce((soma, item) => soma + item.quantidade, 0) !==
        antes.rascunhos_descartados
    ) {
      throw new Error("Restauração sem consumo não corresponde à mesa encerrada.");
    }
  }
  if (
    encerramentosNovos.some(
      (registro) =>
        registro.funcionario_id !== funcionario.funcionario_id ||
        registro.funcionario_nome !== funcionario.funcionario_nome ||
        registro.funcionario_perfil !== funcionario.funcionario_perfil,
    )
  ) {
    throw new Error("Autoria de encerramento inválida.");
  }

  if (funcionario.funcionario_perfil === "producao") {
    if (
      !iguais("mesas") ||
      !iguais("pessoas") ||
      !iguais("fechamentos") ||
      !iguais("encerramentos")
    ) {
      throw new Error("Produção só pode alterar o andamento das fichas.");
    }
  }
}

export async function salvarEstado(
  organizacaoId: string,
  esperado: number,
  estado: EstadoPersistido,
  auditor: Funcionario,
  acao: string,
  entidadeId?: string,
) {
  const leituraAnterior = await lerEstado(organizacaoId);
  const anterior = leituraAnterior.estado;
  const cardapio = new Map(
    leituraAnterior.cardapio.map((produto) => [produto.produto_id, produto]),
  );
  for (const item of estado.itens) {
    const anteriorItem = anterior.itens.find(
      (registro) => registro.item_id === item.item_id,
    );
    const produto = cardapio.get(item.produto_id);
    if (
      anteriorItem &&
      (item.produto_id !== anteriorItem.produto_id ||
        item.name !== anteriorItem.name ||
        centavos(item.price) !== centavos(anteriorItem.price) ||
        item.destino_producao !== anteriorItem.destino_producao)
    ) {
      throw new Error("Dados comerciais de item existente não podem ser alterados.");
    }
    if (
      !anteriorItem &&
      (!produto ||
        item.name !== produto.name ||
        centavos(item.price) !== centavos(produto.price) ||
        item.destino_producao !== produto.destino_producao)
    ) {
      throw new Error("Item não corresponde ao cardápio da organização.");
    }
  }
  validarTransicao(
    anterior,
    estado,
    auditor,
    acao,
    leituraAnterior.funcionarios,
  );
  const resultado = await db.transaction(async (tx) => {
    const proxima = esperado + 1;
    const instante = agora();
    const resultado = await tx
      .update(versoesEstado)
      .set({ versao: proxima, atualizadoEm: instante })
      .where(
        and(
          eq(versoesEstado.organizacaoId, organizacaoId),
          eq(versoesEstado.versao, esperado),
        ),
      );
    if (resultado.rowsAffected !== 1) return null;
    const fechamentosAnteriores = new Set(
      anterior.fechamentos.map((fechamento) => fechamento.fechamento_id),
    );
    const novosFechamentos = estado.fechamentos.filter(
      (fechamento) => !fechamentosAnteriores.has(fechamento.fechamento_id),
    );
    const linhasFechadas = novosFechamentos.flatMap((fechamento) =>
      anterior.itens
        .filter((item) => item.mesa_id === fechamento.mesa_id)
        .map((item) => ({
          organizacaoId,
          fechamentoId: fechamento.fechamento_id,
          itemId: item.item_id,
          mesaId: item.mesa_id,
          produtoId: item.produto_id,
          nome: item.name,
          precoCentavos: centavos(item.price),
          quantidade: item.quantidade,
          destinoProducao: item.destino_producao,
          criadoEm: instante,
        })),
    );
    if (linhasFechadas.length) {
      await tx.insert(itensFechamento).values(linhasFechadas);
    }
    if (acao === "decidir_cancelamento") {
      const idsAtuais = new Set(estado.itens.map((item) => item.item_id));
      const autorizados = anterior.itens
        .filter(
          (item) =>
            item.status === "cancelamento_solicitado" && !idsAtuais.has(item.item_id),
        )
        .map((item) => ({
          organizacaoId,
          cancelamentoId: crypto.randomUUID(),
          itemId: item.item_id,
          mesaId: item.mesa_id,
          produtoId: item.produto_id,
          nome: item.name,
          precoCentavos: centavos(item.price),
          quantidade: item.quantidade,
          destinoProducao: item.destino_producao,
          autorizadoPorId: auditor.funcionario_id,
          autorizadoPorNome: auditor.funcionario_nome,
          autorizadoEm: instante,
        }));
      if (autorizados.length) {
        await tx.insert(cancelamentosAutorizados).values(autorizados);
      }
    }
    await gravarEstadoTx(
      tx,
      organizacaoId,
      estado,
      undefined,
      anterior,
      false,
    );
    await tx.insert(auditoria).values({
      auditoriaId: crypto.randomUUID(),
      organizacaoId,
      funcionarioId: auditor.funcionario_id,
      acao,
      entidade: "estado_operacional",
      entidadeId,
      criadoEm: instante,
    });
    const impressaoIds =
      acao === "enviar_pedido" || acao === "fechar_conta"
        ? await enfileirarImpressoesTx(
            tx,
            organizacaoId,
            anterior,
            estado,
            leituraAnterior.configuracao.larguraRecibo === 58 ? 58 : 80,
          )
        : [];
    return { versao: proxima, impressaoIds };
  });
  if (resultado?.impressaoIds.length) processarFila(organizacaoId, resultado.impressaoIds);
  return resultado?.versao ?? null;
}

export async function salvarConfiguracao(
  organizacaoId: string,
  esperado: number,
  quantidadeMesas: number,
  larguraRecibo: number,
) {
  return db.transaction(async (tx) => {
    const existentes = await tx
      .select()
      .from(mesas)
      .where(eq(mesas.organizacaoId, organizacaoId));
    const maiorEmUso = existentes.reduce(
      (maior, mesa) =>
        mesa.ativa || mesa.status !== "livre" ? Math.max(maior, mesa.mesaId) : maior,
      0,
    );
    if (quantidadeMesas < maiorEmUso) {
      throw new Error(`A Mesa ${maiorEmUso} está em uso e impede essa redução.`);
    }

    const proxima = esperado + 1;
    const versaoAtualizada = await tx
      .update(versoesEstado)
      .set({ versao: proxima, atualizadoEm: agora() })
      .where(
        and(
          eq(versoesEstado.organizacaoId, organizacaoId),
          eq(versoesEstado.versao, esperado),
        ),
      );
    if (versaoAtualizada.rowsAffected !== 1) return null;

    await tx
      .update(organizacoes)
      .set({ quantidadeMesas, larguraRecibo, atualizadoEm: agora() })
      .where(eq(organizacoes.organizacaoId, organizacaoId));
    await tx
      .delete(mesas)
      .where(
        and(
          eq(mesas.organizacaoId, organizacaoId),
          gt(mesas.mesaId, quantidadeMesas),
        ),
      );

    const idsExistentes = new Set(existentes.map((mesa) => mesa.mesaId));
    const novas = Array.from({ length: quantidadeMesas }, (_, indice) => indice + 1)
      .filter((mesaId) => !idsExistentes.has(mesaId))
      .map((mesaId) => ({
        organizacaoId,
        mesaId,
        status: "livre" as const,
        ativa: false,
        pessoasFixas: 0,
        totalFixoCentavos: 0,
        abertaEm: null,
        garcomId: null,
        contaSolicitada: false,
        servicoIncluso: true,
      }));
    if (novas.length) await tx.insert(mesas).values(novas);
    return proxima;
  });
}

export async function salvarProduto(
  organizacaoId: string,
  produto: ProdutoConfiguracao,
) {
  await db
    .insert(cardapioTabela)
    .values({
      organizacaoId,
      produtoId: produto.produto_id,
      nome: produto.name,
      precoCentavos: centavos(produto.price),
      destinoProducao: produto.destino_producao,
      categoria: produto.categoria,
      ativo: produto.ativo,
    })
    .onConflictDoUpdate({
      target: [cardapioTabela.organizacaoId, cardapioTabela.produtoId],
      set: {
        nome: produto.name,
        precoCentavos: centavos(produto.price),
        destinoProducao: produto.destino_producao,
        categoria: produto.categoria,
        ativo: produto.ativo,
      },
    });
}

export async function salvarImpressora(
  organizacaoId: string,
  entrada: ConfiguracaoImpressora,
) {
  const host = entrada.host.trim();
  if (entrada.ativa && !hostImpressoraValido(host)) {
    throw new Error("Informe um host válido para a impressora ativa.");
  }
  if (!Number.isInteger(entrada.porta) || entrada.porta < 1 || entrada.porta > 65_535) {
    throw new Error("A porta da impressora deve estar entre 1 e 65535.");
  }
  const instante = agora();
  await db
    .insert(impressoras)
    .values({
      organizacaoId,
      destino: entrada.destino,
      nome: entrada.nome.trim(),
      host,
      porta: entrada.porta,
      largura: entrada.largura,
      ativa: entrada.ativa,
      criadoEm: instante,
      atualizadoEm: instante,
    })
    .onConflictDoUpdate({
      target: [impressoras.organizacaoId, impressoras.destino],
      set: {
        nome: entrada.nome.trim(),
        host,
        porta: entrada.porta,
        largura: entrada.largura,
        ativa: entrada.ativa,
        atualizadoEm: instante,
      },
    });
  if (entrada.ativa) processarFila(organizacaoId);
}

export async function salvarFuncionario(
  organizacaoId: string,
  funcionarioAtualId: string,
  entrada: {
    funcionarioId: string;
    nome: string;
    perfil: Funcionario["funcionario_perfil"];
    pin?: string;
    ativo: boolean;
  },
) {
  const instante = agora();
  if (!entrada.ativo && entrada.funcionarioId === funcionarioAtualId) {
    throw new Error("O funcionário da sessão atual não pode ser desativado.");
  }
  if (entrada.pin !== undefined && !pinOperacionalValido(entrada.pin)) {
    throw new Error("Use um PIN não sequencial de 4 dígitos.");
  }
  await db.transaction(async (tx) => {
    const [atual] = await tx
      .select()
      .from(funcionariosTabela)
      .where(
        and(
          eq(funcionariosTabela.organizacaoId, organizacaoId),
          eq(funcionariosTabela.funcionarioId, entrada.funcionarioId),
        ),
      )
      .limit(1);
    if (!atual && !entrada.pin) {
      throw new Error("Informe um PIN para o novo funcionário.");
    }
    const existentes = await tx
      .select()
      .from(funcionariosTabela)
      .where(eq(funcionariosTabela.organizacaoId, organizacaoId));
    if (entrada.pin) {
      for (const existente of existentes) {
        if (
          existente.funcionarioId !== entrada.funcionarioId &&
          (await conferirPin(entrada.pin, existente.pinHash))
        ) {
          throw new Error("Este PIN já pertence a outro funcionário.");
        }
      }
    }
    const pinHash = entrada.pin
      ? await gerarHashPin(entrada.pin)
      : atual!.pinHash;
    await tx
      .insert(funcionariosTabela)
      .values({
        organizacaoId,
        funcionarioId: entrada.funcionarioId,
        nome: entrada.nome,
        perfil: entrada.perfil,
        pinHash,
        ativo: entrada.ativo,
        criadoEm: instante,
        atualizadoEm: instante,
      })
      .onConflictDoUpdate({
        target: [funcionariosTabela.organizacaoId, funcionariosTabela.funcionarioId],
        set: {
          nome: entrada.nome,
          perfil: entrada.perfil,
          pinHash,
          ativo: entrada.ativo,
          atualizadoEm: instante,
        },
      });
    if (!entrada.ativo) {
      await tx
        .delete(sessoes)
        .where(
          and(
            eq(sessoes.organizacaoId, organizacaoId),
            eq(sessoes.funcionarioId, entrada.funcionarioId),
          ),
        );
    }
  });
}

export async function alterarPinProprio(
  organizacaoId: string,
  funcionarioId: string,
  pinAtual: string,
  pinNovo: string,
) {
  if (!pinOperacionalValido(pinNovo)) {
    throw new Error("Use um PIN novo não sequencial de 4 dígitos.");
  }
  await db.transaction(async (tx) => {
    const [funcionario] = await tx
      .select()
      .from(funcionariosTabela)
      .where(
        and(
          eq(funcionariosTabela.organizacaoId, organizacaoId),
          eq(funcionariosTabela.funcionarioId, funcionarioId),
          eq(funcionariosTabela.ativo, true),
        ),
      )
      .limit(1);
    if (!funcionario || !(await conferirPin(pinAtual, funcionario.pinHash))) {
      throw new Error("PIN atual incorreto.");
    }
    const existentes = await tx
      .select()
      .from(funcionariosTabela)
      .where(eq(funcionariosTabela.organizacaoId, organizacaoId));
    for (const existente of existentes) {
      if (
        existente.funcionarioId !== funcionarioId &&
        (await conferirPin(pinNovo, existente.pinHash))
      ) {
        throw new Error("Este PIN já pertence a outro funcionário.");
      }
    }
    await tx
      .update(funcionariosTabela)
      .set({
        pinHash: await gerarHashPin(pinNovo),
        atualizadoEm: agora(),
      })
      .where(
        and(
          eq(funcionariosTabela.organizacaoId, organizacaoId),
          eq(funcionariosTabela.funcionarioId, funcionarioId),
        ),
      );
  });
}
