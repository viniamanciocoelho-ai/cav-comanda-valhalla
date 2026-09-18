import { and, eq } from "drizzle-orm";
import { db } from "../database";
import {
  cardapio as cardapioTabela,
  auditoria,
  encerramentosSemConsumo,
  fechamentos,
  fichasProducao,
  funcionarios as funcionariosTabela,
  itensPedido,
  mesas,
  organizacoes,
  pessoasDaComanda,
  sessoes,
  versoesEstado,
} from "../database/schema";
import { garantirBanco } from "../database/bootstrap";
import {
  cardapio as cardapioInicial,
  fechamentosIniciais,
  itensIniciais,
  mesasIniciais,
  pessoasIniciais,
  ticketsIniciais,
} from "../../web/lib/demo-data";
import { funcionarios as funcionariosIniciais } from "../../web/lib/perfis";
import type {
  EncerramentoSemConsumo,
  Fechamento,
  Funcionario,
  MenuItem,
  Mesa,
  OrderItem,
  Pessoa,
  Ticket,
} from "../../web/lib/types";
import { conferirPin, gerarHashPin, novoToken, sha256 } from "./security";

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

function configuracaoBootstrap() {
  const producao = process.env.NODE_ENV === "production";
  const codigo = process.env.CAV_ORGANIZACAO_CODIGO?.trim().toLowerCase() || "valhalla";
  const pins: Record<Funcionario["funcionario_perfil"], string | undefined> = {
    gerencia: process.env.CAV_BOOTSTRAP_PIN_GERENCIA || (producao ? undefined : "1111"),
    garcom: process.env.CAV_BOOTSTRAP_PIN_GARCOM || (producao ? undefined : "2222"),
    producao: process.env.CAV_BOOTSTRAP_PIN_PRODUCAO || (producao ? undefined : "3333"),
    caixa: process.env.CAV_BOOTSTRAP_PIN_CAIXA || (producao ? undefined : "4444"),
  };
  if (Object.values(pins).some((pin) => !pin || !/^\d{4}$/.test(pin))) {
    throw new Error("Configure os quatro CAV_BOOTSTRAP_PIN_* com PINs numéricos de 4 dígitos.");
  }
  return {
    codigo,
    demo: process.env.CAV_DEMO_MODE !== "false" && !producao,
    pins: pins as Record<Funcionario["funcionario_perfil"], string>,
  };
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

export async function garantirOrganizacaoPadrao() {
  await garantirBanco();
  const bootstrap = configuracaoBootstrap();
  const existente = await db
    .select()
    .from(organizacoes)
    .where(eq(organizacoes.codigo, bootstrap.codigo))
    .limit(1);
  if (existente.length) return;

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
    await tx.insert(funcionariosTabela).values(
      await Promise.all(
        funcionariosIniciais.map(async (funcionario) => ({
          organizacaoId: ORGANIZACAO_PADRAO,
          funcionarioId: funcionario.funcionario_id,
          nome: funcionario.funcionario_nome,
          perfil: funcionario.funcionario_perfil,
          pinHash: await gerarHashPin(bootstrap.pins[funcionario.funcionario_perfil]),
          ativo: true,
          criadoEm: instante,
          atualizadoEm: instante,
        })),
      ),
    );
    const mesasVazias = Array.from({ length: 15 }, (_, indice) => ({
      ...mesasIniciais[0],
      mesa_id: indice + 1,
      organizacao_id: ORGANIZACAO_PADRAO,
    }));
    await gravarEstadoTx(
      tx,
      ORGANIZACAO_PADRAO,
      {
        mesas: bootstrap.demo
          ? [
              ...mesasIniciais,
              ...mesasVazias.filter(
                (mesaVazia) =>
                  !mesasIniciais.some((mesaInicial) => mesaInicial.mesa_id === mesaVazia.mesa_id),
              ),
            ]
          : mesasVazias,
        pessoas: bootstrap.demo ? pessoasIniciais : [],
        itens: bootstrap.demo
          ? itensIniciais.map((item) => ({ ...item, organizacao_id: ORGANIZACAO_PADRAO }))
          : [],
        tickets: bootstrap.demo
          ? ticketsIniciais.map((ticket) => ({
              ...ticket,
              organizacao_id: ORGANIZACAO_PADRAO,
            }))
          : [],
        fechamentos: fechamentosIniciais,
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
) {
  await tx.delete(mesas).where(eq(mesas.organizacaoId, organizacaoId));
  await tx.delete(pessoasDaComanda).where(eq(pessoasDaComanda.organizacaoId, organizacaoId));
  await tx.delete(itensPedido).where(eq(itensPedido.organizacaoId, organizacaoId));
  await tx.delete(fichasProducao).where(eq(fichasProducao.organizacaoId, organizacaoId));
  await tx.delete(fechamentos).where(eq(fechamentos.organizacaoId, organizacaoId));
  await tx
    .delete(encerramentosSemConsumo)
    .where(eq(encerramentosSemConsumo.organizacaoId, organizacaoId));

  if (estado.mesas.length) {
    await tx.insert(mesas).values(
      estado.mesas.map((mesa) => ({
        organizacaoId,
        mesaId: mesa.mesa_id,
        status: mesa.status,
        ativa: mesa.ativa,
        demonstracao: mesa.demonstracao,
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
  if (estado.fechamentos.length) {
    await tx.insert(fechamentos).values(
      estado.fechamentos.map((fechamento) => ({
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
  if (estado.encerramentos.length) {
    await tx.insert(encerramentosSemConsumo).values(
      estado.encerramentos.map((registro) => ({
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
  if (!organizacao) return null;
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
      },
    };
  }
  return null;
}

export async function obterSessao(cabecalho: string | null): Promise<SessaoAutenticada | null> {
  const token = cabecalho?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const [sessao] = await db
    .select()
    .from(sessoes)
    .where(eq(sessoes.tokenHash, await sha256(token)))
    .limit(1);
  if (!sessao || new Date(sessao.expiraEm).getTime() <= Date.now()) return null;
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
    },
  };
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
  ]);

  const estado: EstadoPersistido = {
    mesas: linhasMesas.map((mesa) => ({
      organizacao_id: organizacaoId,
      mesa_id: mesa.mesaId,
      status: mesa.status,
      ativa: mesa.ativa,
      demonstracao: mesa.demonstracao ?? undefined,
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

  return {
    organizacaoId,
    modoDemo: configuracaoBootstrap().demo,
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
    configuracao: {
      quantidadeMesas: configuracao?.quantidadeMesas ?? 15,
      larguraRecibo: configuracao?.larguraRecibo ?? 80,
    },
    funcionarios: linhasFuncionarios.map((funcionario) => ({
      funcionario_id: funcionario.funcionarioId,
      funcionario_nome: funcionario.nome,
      funcionario_perfil: funcionario.perfil,
      rotulo: funcionario.nome,
      resumo: "",
    })),
  };
}

export function validarTransicao(
  anterior: EstadoPersistido,
  proximo: EstadoPersistido,
  funcionario: Funcionario,
  acao: string,
) {
  const serializar = (valor: unknown) => JSON.stringify(valor);
  const idsMesasAlteradas = new Set<number>();
  const mapaAnterior = new Map(anterior.mesas.map((mesa) => [mesa.mesa_id, mesa]));
  const mapaProximo = new Map(proximo.mesas.map((mesa) => [mesa.mesa_id, mesa]));
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
  if (
    itensNovos.some(
      (item) =>
        item.funcionario_id !== funcionario.funcionario_id ||
        item.funcionario_nome !== funcionario.funcionario_nome ||
        item.funcionario_perfil !== funcionario.funcionario_perfil,
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
  if (
    fechamentosNovos.some(
      (registro) => registro.funcionario_nome !== funcionario.funcionario_nome,
    )
  ) {
    throw new Error("Autoria de fechamento inválida.");
  }
  const encerramentosNovos = proximo.encerramentos.filter(
    (registro) =>
      !anterior.encerramentos.some(
        (existente) => existente.encerramento_id === registro.encerramento_id,
      ),
  );
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

  const iguais = (chave: keyof EstadoPersistido) =>
    serializar(anterior[chave]) === serializar(proximo[chave]);
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
  if (funcionario.funcionario_perfil === "caixa") {
    if (!iguais("pessoas") || !iguais("encerramentos")) {
      throw new Error("Caixa não pode alterar pessoas ou encerramentos sem consumo.");
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
  if (acao === "reiniciar" && !configuracaoBootstrap().demo) {
    throw new Error("Reiniciar demonstração está bloqueado fora do modo demo.");
  }
  const anterior = (await lerEstado(organizacaoId)).estado;
  validarTransicao(anterior, estado, auditor, acao);
  return db.transaction(async (tx) => {
    const proxima = esperado + 1;
    const resultado = await tx
      .update(versoesEstado)
      .set({ versao: proxima, atualizadoEm: agora() })
      .where(
        and(
          eq(versoesEstado.organizacaoId, organizacaoId),
          eq(versoesEstado.versao, esperado),
        ),
      );
    if (resultado.rowsAffected !== 1) return null;
    await gravarEstadoTx(tx, organizacaoId, estado);
    await tx.insert(auditoria).values({
      auditoriaId: crypto.randomUUID(),
      organizacaoId,
      funcionarioId: auditor.funcionario_id,
      acao,
      entidade: "estado_operacional",
      entidadeId,
      criadoEm: agora(),
    });
    return proxima;
  });
}

export async function salvarConfiguracao(
  organizacaoId: string,
  quantidadeMesas: number,
  larguraRecibo: number,
) {
  await db
    .update(organizacoes)
    .set({ quantidadeMesas, larguraRecibo, atualizadoEm: agora() })
    .where(eq(organizacoes.organizacaoId, organizacaoId));
}

export async function salvarProduto(organizacaoId: string, produto: MenuItem) {
  await db
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

export async function salvarFuncionario(
  organizacaoId: string,
  entrada: { funcionarioId: string; nome: string; perfil: Funcionario["funcionario_perfil"]; pin: string },
) {
  const instante = agora();
  const existentes = await db
    .select()
    .from(funcionariosTabela)
    .where(
      and(
        eq(funcionariosTabela.organizacaoId, organizacaoId),
        eq(funcionariosTabela.ativo, true),
      ),
    );
  for (const existente of existentes) {
    if (
      existente.funcionarioId !== entrada.funcionarioId &&
      (await conferirPin(entrada.pin, existente.pinHash))
    ) {
      throw new Error("Este PIN já pertence a outro funcionário.");
    }
  }
  await db
    .insert(funcionariosTabela)
    .values({
      organizacaoId,
      funcionarioId: entrada.funcionarioId,
      nome: entrada.nome,
      perfil: entrada.perfil,
      pinHash: await gerarHashPin(entrada.pin),
      ativo: true,
      criadoEm: instante,
      atualizadoEm: instante,
    })
    .onConflictDoUpdate({
      target: [funcionariosTabela.organizacaoId, funcionariosTabela.funcionarioId],
      set: {
        nome: entrada.nome,
        perfil: entrada.perfil,
        pinHash: await gerarHashPin(entrada.pin),
        ativo: true,
        atualizadoEm: instante,
      },
    });
}
