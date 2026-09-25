import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { COMPARTILHADO, compartilhadoId } from "../packages/web/src/web/lib/operacao";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

const arquivo = await prepararBancoTeste("legado-operacional");
const { router } = await import("../packages/web/src/api");
const publico = createRouterClient(router, { context: { headers: new Headers() } });
const sessao = await publico.auth.login({ organizacao: "valhalla", pin: PIN_GERENCIA_TESTE });
const gerencia = createRouterClient(router, {
  context: { headers: new Headers({ authorization: `Bearer ${sessao.token}` }) },
});
const produto = (await gerencia.comanda.estado()).cardapio[0];
assert.ok(produto);

const historico = createClient({ url: `file:${arquivo.replaceAll("\\", "/")}` });
try {
  // A migration 0005 preserva essas linhas, mesmo quando a mesa ja esta livre.
  await historico.execute({
    sql: `INSERT INTO pessoas_da_comanda
      (organizacao_id, pessoa_id, atendimento_id, mesa_id, balcao_id, nome)
      VALUES (?, ?, ?, ?, NULL, ?)`,
    args: ["valhalla", "p-legado", "mesa:5:legado", 5, "Pessoa historica ficticia"],
  });
  await historico.execute({
    sql: `INSERT INTO itens_pedido
      (organizacao_id, item_id, pedido_id, atendimento_id, mesa_id, balcao_id,
       pessoa_id, produto_id, nome, preco_centavos, quantidade, observacao,
       destino_producao, status, status_anterior, funcionario_id, funcionario_nome,
       funcionario_perfil, criado_em, enviado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    args: [
      "valhalla", "i-legado", "pd-legado", "mesa:5:legado", 5, "p-legado",
      produto.produto_id, produto.name, Math.round(produto.price * 100), 1, "",
      produto.destino_producao, "enviado", sessao.funcionario.funcionario_id,
      sessao.funcionario.funcionario_nome, "gerencia", "2026-09-01T10:00:00.000Z",
      "2026-09-01T10:00:00.000Z", "2026-09-01T10:00:00.000Z",
    ],
  });
  await historico.execute({
    sql: `INSERT INTO fichas_producao
      (organizacao_id, ticket_id, pedido_id, atendimento_id, mesa_id, balcao_id,
       destino_producao, status, linhas_json, item_ids_json, funcionario_id,
       funcionario_nome, criado_em, enviado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "valhalla", "t-legado", "pd-legado", "mesa:5:legado", 5,
      produto.destino_producao, "enviado", "[]", '["i-legado"]',
      sessao.funcionario.funcionario_id, sessao.funcionario.funcionario_nome,
      "2026-09-01T10:00:00.000Z", "2026-09-01T10:00:00.000Z",
      "2026-09-01T10:00:00.000Z",
    ],
  });

  const anterior = await gerencia.comanda.estado();
  assert.equal(anterior.estado.mesas.find((mesa) => mesa.mesa_id === 5)?.status, "livre");
  assert.equal(anterior.estado.itens.find((item) => item.item_id === "i-legado")?.atendimento_id, "mesa:5:legado");
  const atendimentoId = "at-mesa-4-apos-legado";
  const aberta = {
    ...anterior.estado,
    mesas: anterior.estado.mesas.map((mesa) =>
      mesa.mesa_id === 4
        ? {
            ...mesa,
            status: "ocupada" as const,
            ativa: true,
            atendimento_id: atendimentoId,
            abertaEm: "2026-09-25T10:00:00.000Z",
            garcom_id: sessao.funcionario.funcionario_id,
          }
        : mesa,
    ),
  };
  const abertura = await gerencia.comanda.persistir({
    versao: anterior.versao,
    acao: "abrir_mesa",
    entidadeId: "4",
    estado: aberta,
  });
  const atual = await gerencia.comanda.estado();
  assert.equal(atual.estado.mesas.find((mesa) => mesa.mesa_id === 4)?.ativa, true);
  assert.equal(atual.estado.pessoas.find((pessoa) => pessoa.pessoa_id === "p-legado")?.atendimento_id, "mesa:5:legado");
  assert.equal(atual.estado.tickets.find((ticket) => ticket.ticket_id === "t-legado")?.itemIds[0], "i-legado");

  await gerencia.comanda.persistir({
    versao: abertura.versao,
    acao: "alterar_comanda",
    entidadeId: "4",
    estado: {
      ...atual.estado,
      itens: [...atual.estado.itens, {
        organizacao_id: "valhalla",
        item_id: "i-novo",
        pedido_id: null,
        atendimento_id: atendimentoId,
        mesa_id: 4,
        balcao_id: null,
        pessoa_id: compartilhadoId(atendimentoId),
        produto_id: produto.produto_id,
        name: produto.name,
        price: produto.price,
        quantidade: 1,
        observacao: "",
        destino_producao: produto.destino_producao,
        status: "novo",
        funcionario_id: sessao.funcionario.funcionario_id,
        funcionario_nome: sessao.funcionario.funcionario_nome,
        funcionario_perfil: sessao.funcionario.funcionario_perfil,
        criado_em: "2026-09-25T10:01:00.000Z",
        enviado_em: null,
        atualizado_em: "2026-09-25T10:01:00.000Z",
      }],
    },
  });

  const base = await gerencia.comanda.estado();
  await assert.rejects(
    gerencia.comanda.persistir({
      versao: base.versao,
      acao: "alterar_comanda",
      entidadeId: "5",
      estado: {
        ...base.estado,
        pessoas: [...base.estado.pessoas, {
          pessoa_id: "p-invalida",
          nome: "Pessoa ficticia",
          atendimento_id: "mesa:5:legado",
          mesa_id: 5,
          balcao_id: null,
        }],
      },
    }),
    (erro: { code?: string }) => erro.code === "BAD_REQUEST",
    "registro novo nao pode usar vinculo historico encerrado",
  );
  const final = await gerencia.comanda.estado();
  assert.equal(final.estado.itens.filter((registro) => registro.item_id === "i-novo").length, 1);
  assert.equal(final.estado.itens.filter((registro) => registro.item_id === "i-legado").length, 1);
  assert.equal(final.estado.mesas.find((mesa) => mesa.mesa_id === 5)?.status, "livre");

  const linhasLegadas = JSON.stringify([{
    observacao: "",
    pessoa: "Pessoa historica ficticia",
    qty: 1,
    name: produto.name,
    produto_id: produto.produto_id,
    item_id: "i-legado",
  }]);
  await historico.execute({
    sql: `UPDATE fichas_producao SET linhas_json = ?
      WHERE organizacao_id = ? AND ticket_id = ?`,
    args: [linhasLegadas, "valhalla", "t-legado"],
  });
  const comChavesReordenadas = await gerencia.comanda.estado();
  await gerencia.comanda.persistir({
    versao: comChavesReordenadas.versao,
    acao: "abrir_mesa",
    entidadeId: "6",
    estado: {
      ...comChavesReordenadas.estado,
      mesas: comChavesReordenadas.estado.mesas.map((mesa) =>
        mesa.mesa_id === 6
          ? {
              ...mesa,
              status: "ocupada" as const,
              ativa: true,
              atendimento_id: "at-mesa-6-apos-legado",
              abertaEm: "2026-09-25T10:05:00.000Z",
              garcom_id: sessao.funcionario.funcionario_id,
            }
          : mesa,
      ),
    },
  });
  assert.equal((await gerencia.comanda.estado()).estado.mesas.find((mesa) => mesa.mesa_id === 6)?.ativa, true);

  const antesMesaLegada = await gerencia.comanda.estado();
  const aberturaLegadaEm = new Date().toISOString();
  const atendimentoLegadoNovo = "at-mesa-5-reaberta";
  const aberturaLegada = await gerencia.comanda.persistir({
    versao: antesMesaLegada.versao,
    acao: "abrir_mesa",
    entidadeId: "5",
    estado: {
      ...antesMesaLegada.estado,
      mesas: antesMesaLegada.estado.mesas.map((mesa) =>
        mesa.mesa_id === 5
          ? {
              ...mesa,
              status: "ocupada" as const,
              ativa: true,
              atendimento_id: atendimentoLegadoNovo,
              abertaEm: aberturaLegadaEm,
              garcom_id: sessao.funcionario.funcionario_id,
            }
          : mesa,
      ),
    },
  });
  const reaberta = await gerencia.comanda.estado();
  const encerradaEm = new Date().toISOString();
  await gerencia.comanda.persistir({
    versao: aberturaLegada.versao,
    acao: "encerrar_sem_consumo",
    entidadeId: "5",
    estado: {
      ...reaberta.estado,
      mesas: reaberta.estado.mesas.map((mesa) =>
        mesa.mesa_id === 5
          ? {
              ...mesa,
              status: "livre" as const,
              ativa: false,
              atendimento_id: null,
              abertaEm: null,
              garcom_id: null,
            }
          : mesa,
      ),
      encerramentos: [...reaberta.estado.encerramentos, {
        organizacao_id: "valhalla",
        encerramento_id: "sc-mesa-5-reaberta",
        atendimento_id: atendimentoLegadoNovo,
        mesa_id: 5,
        balcao_id: null,
        abertura_id: `ab-m5-${aberturaLegadaEm}`,
        encerrada_sem_consumo: true,
        motivo: "engano",
        observacao: "",
        rascunhos_descartados: 0,
        funcionario_id: sessao.funcionario.funcionario_id,
        funcionario_nome: sessao.funcionario.funcionario_nome,
        funcionario_perfil: sessao.funcionario.funcionario_perfil,
        aberta_em: aberturaLegadaEm,
        encerrada_em: encerradaEm,
        duracao_segundos: 0,
        desfeito_em: null,
      }],
    },
  });
  const encerrada = await gerencia.comanda.estado();
  assert.equal(encerrada.estado.mesas.find((mesa) => mesa.mesa_id === 5)?.status, "livre");
  assert.equal(encerrada.estado.pessoas.find((pessoa) => pessoa.pessoa_id === "p-legado")?.atendimento_id, "mesa:5:legado");
  assert.equal(encerrada.estado.itens.find((registro) => registro.item_id === "i-legado")?.atendimento_id, "mesa:5:legado");

  await assert.rejects(
    gerencia.comanda.persistir({
      versao: encerrada.versao,
      acao: "mover_producao",
      entidadeId: "t-legado",
      estado: {
        ...encerrada.estado,
        itens: encerrada.estado.itens.map((item) =>
          item.item_id === "i-legado" ? { ...item, status: "preparando" as const } : item,
        ),
        tickets: encerrada.estado.tickets.map((ticket) =>
          ticket.ticket_id === "t-legado" ? { ...ticket, status: "preparando" as const } : ticket,
        ),
      },
    }),
    (erro: { code?: string }) => erro.code === "BAD_REQUEST",
    "historia encerrada nao pode ser alterada como producao ativa",
  );
  assert.equal((await gerencia.comanda.estado()).estado.tickets.find((ticket) => ticket.ticket_id === "t-legado")?.status, "enviado");

  const paraEnviar = await gerencia.comanda.estado();
  const itemAtual = paraEnviar.estado.itens.find((item) => item.item_id === "i-novo");
  assert.ok(itemAtual);
  const enviadoEm = new Date().toISOString();
  await gerencia.comanda.persistir({
    versao: paraEnviar.versao,
    acao: "enviar_pedido",
    entidadeId: "4",
    estado: {
      ...paraEnviar.estado,
      itens: paraEnviar.estado.itens.map((item) =>
        item.item_id === itemAtual.item_id
          ? { ...item, pedido_id: "pd-novo", status: "enviado" as const,
              enviado_em: enviadoEm, atualizado_em: enviadoEm }
          : item,
      ),
      tickets: [...paraEnviar.estado.tickets, {
        organizacao_id: "valhalla",
        ticket_id: "t-novo",
        pedido_id: "pd-novo",
        atendimento_id: atendimentoId,
        mesa_id: 4,
        balcao_id: null,
        destino_producao: itemAtual.destino_producao,
        status: "enviado" as const,
        linhas: [{
          item_id: itemAtual.item_id,
          produto_id: itemAtual.produto_id,
          name: itemAtual.name,
          qty: itemAtual.quantidade,
          pessoa: COMPARTILHADO,
          observacao: itemAtual.observacao,
        }],
        itemIds: [itemAtual.item_id],
        funcionario_id: sessao.funcionario.funcionario_id,
        funcionario_nome: sessao.funcionario.funcionario_nome,
        criado_em: enviadoEm,
        enviado_em: enviadoEm,
        atualizado_em: enviadoEm,
      }],
    },
  });

  await historico.execute({
    sql: `UPDATE fichas_producao SET linhas_json = ?
      WHERE organizacao_id = ? AND ticket_id = ?`,
    args: [linhasLegadas, "valhalla", "t-legado"],
  });
  const paraFechar = await gerencia.comanda.estado();
  const subtotalCentavos = Math.round(itemAtual.price * 100);
  const servicoCentavos = Math.round(subtotalCentavos * 0.1);
  await gerencia.comanda.persistir({
    versao: paraFechar.versao,
    acao: "fechar_conta",
    entidadeId: "4",
    estado: {
      ...paraFechar.estado,
      mesas: paraFechar.estado.mesas.map((mesa) =>
        mesa.mesa_id === 4
          ? {
              ...mesa,
              status: "livre" as const,
              ativa: false,
              atendimento_id: null,
              abertaEm: null,
              garcom_id: null,
              contaSolicitada: false,
              servicoIncluso: true,
            }
          : mesa,
      ),
      itens: paraFechar.estado.itens.filter((item) => item.atendimento_id !== atendimentoId),
      tickets: paraFechar.estado.tickets.filter((ticket) => ticket.atendimento_id !== atendimentoId),
      fechamentos: [...paraFechar.estado.fechamentos, {
        organizacao_id: "valhalla",
        fechamento_id: "f-novo",
        atendimento_id: atendimentoId,
        mesa_id: 4,
        balcao_id: null,
        hora: "10:10",
        subtotal: subtotalCentavos / 100,
        servico: servicoCentavos / 100,
        total: (subtotalCentavos + servicoCentavos) / 100,
        servicoIncluso: true,
        divisao: [{
          pessoa_id: `${atendimentoId}-sem-identificacao`,
          pessoa: "Consumo sem identificação",
          valor: (subtotalCentavos + servicoCentavos) / 100,
        }],
        nfce: "nao_solicitada" as const,
        funcionario_nome: sessao.funcionario.funcionario_nome,
        garcom_nome: sessao.funcionario.funcionario_nome,
      }],
    },
  });
  const aposFechamento = await gerencia.comanda.estado();
  assert.equal(aposFechamento.estado.itens.some((item) => item.item_id === "i-novo"), false);
  assert.equal(aposFechamento.estado.itens.some((item) => item.item_id === "i-legado"), true);
  assert.equal(aposFechamento.estado.tickets.some((ticket) => ticket.ticket_id === "t-legado"), true);
  assert.equal(aposFechamento.estado.fechamentos.some((registro) => registro.fechamento_id === "f-novo"), true);
} finally {
  historico.close();
}

console.log("Legado operacional: historico preservado, abertura e item novos validados.");
