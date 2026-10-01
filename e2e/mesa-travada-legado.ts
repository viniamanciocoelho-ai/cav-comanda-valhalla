import assert from "node:assert/strict";
import path from "node:path";
import { createClient } from "@libsql/client";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { COMPARTILHADO, compartilhadoId } from "../packages/web/src/web/lib/operacao";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

const arquivo = await prepararBancoTeste("mesa-travada-legado");
const banco = createClient({ url: `file:${arquivo.replaceAll("\\", "/")}` });
const { router } = await import("../packages/web/src/api");
const publico = createRouterClient(router, { context: { headers: new Headers() } });
const sessao = await publico.auth.login({ organizacao: "valhalla", pin: PIN_GERENCIA_TESTE });
const gerencia = createRouterClient(router, {
  context: { headers: new Headers({ authorization: `Bearer ${sessao.token}` }) },
});

try {
  await gerencia.comanda.estado();
  await banco.execute({
    sql: `INSERT INTO encerramentos_sem_consumo
      (organizacao_id, encerramento_id, atendimento_id, mesa_id, abertura_id, motivo, observacao,
       rascunhos_descartados, funcionario_id, funcionario_nome, funcionario_perfil,
       aberta_em, encerrada_em, duracao_segundos)
      VALUES (?, ?, ?, ?, ?, ?, '', 0, ?, ?, 'gerencia', ?, ?, 60)`,
    args: ["valhalla", "sc-antigo-2", "at-antigo-2", 2, "ab-antigo-2", "outro",
      sessao.funcionario.funcionario_id, sessao.funcionario.funcionario_nome,
      "2026-09-01T10:00:00.000Z", "2026-09-01T10:01:00.000Z"],
  });
  const encerramentosAntes = await banco.execute("SELECT COUNT(*) AS total FROM encerramentos_sem_consumo");
  const fechamentosAntes = await banco.execute("SELECT COUNT(*) AS total FROM fechamentos");
  await banco.execute({
    sql: "UPDATE mesas SET atendimento_id = ? WHERE organizacao_id = ? AND mesa_id = ? AND status = 'livre' AND ativa = 0",
    args: ["at-antigo-2", "valhalla", 2],
  });
  const antes = await gerencia.comanda.estado();
  const estado = { ...antes.estado, mesas: antes.estado.mesas.map((mesa) => mesa.mesa_id === 2
    ? { ...mesa, atendimento_id: "at-novo-2", status: "ocupada" as const, ativa: true,
        abertaEm: new Date().toISOString(), garcom_id: sessao.funcionario.funcionario_id }
    : mesa) };
  await gerencia.comanda.persistir({ versao: antes.versao, acao: "abrir_mesa", entidadeId: "2", estado });
  console.log("abertura OK");
  assert.equal((await gerencia.comanda.estado()).estado.mesas.find((mesa) => mesa.mesa_id === 2)?.atendimento_id, "at-novo-2");

  const produto = (await gerencia.comanda.estado()).cardapio[0];
  assert.ok(produto);
  const criadoEm = new Date().toISOString();
  const leitura = await gerencia.comanda.estado();
  const item = {
    organizacao_id: "valhalla", item_id: "i-07a", pedido_id: null, atendimento_id: "at-novo-2",
    mesa_id: 2, balcao_id: null, pessoa_id: compartilhadoId("at-novo-2"),
    produto_id: produto.produto_id, name: produto.name, price: produto.price, quantidade: 1,
    observacao: "", destino_producao: produto.destino_producao, status: "novo" as const,
    funcionario_id: sessao.funcionario.funcionario_id, funcionario_nome: sessao.funcionario.funcionario_nome,
    funcionario_perfil: sessao.funcionario.funcionario_perfil, criado_em: criadoEm,
    enviado_em: null, atualizado_em: criadoEm,
  };
  await gerencia.comanda.persistir({ versao: leitura.versao, acao: "alterar_comanda", entidadeId: "2",
    estado: { ...leitura.estado, itens: [...leitura.estado.itens, item] } });
  console.log("rascunho OK");
  const rascunho = await gerencia.comanda.estado();
  await gerencia.comanda.persistir({ versao: rascunho.versao, acao: "enviar_pedido", entidadeId: "2",
    estado: { ...rascunho.estado,
      itens: rascunho.estado.itens.map((registro) => registro.item_id === item.item_id
        ? { ...registro, pedido_id: "pd-07a", status: "enviado" as const, enviado_em: criadoEm,
            atualizado_em: criadoEm } : registro),
      tickets: [...rascunho.estado.tickets, {
        organizacao_id: "valhalla", ticket_id: "t-07a", pedido_id: "pd-07a",
        atendimento_id: "at-novo-2", mesa_id: 2, balcao_id: null,
        destino_producao: produto.destino_producao, status: "enviado" as const,
        linhas: [{ item_id: item.item_id, produto_id: item.produto_id, name: item.name, qty: 1,
          pessoa: COMPARTILHADO, observacao: "" }], itemIds: [item.item_id],
        funcionario_id: sessao.funcionario.funcionario_id,
        funcionario_nome: sessao.funcionario.funcionario_nome,
        criado_em: criadoEm, enviado_em: criadoEm, atualizado_em: criadoEm,
      }],
    } });
  console.log("envio OK");
  const enviado = await gerencia.comanda.estado();
  assert.equal(enviado.estado.tickets.filter((ticket) => ticket.atendimento_id === "at-novo-2").length, 1);
  const subtotal = Math.round(produto.price * 100);
  const servico = Math.round(subtotal * 0.1);
  await gerencia.comanda.persistir({ versao: enviado.versao, acao: "fechar_conta", entidadeId: "2",
    estado: { ...enviado.estado,
      mesas: enviado.estado.mesas.map((mesa) => mesa.mesa_id === 2
        ? { ...mesa, status: "livre" as const, ativa: false, atendimento_id: null,
            abertaEm: null, garcom_id: null, contaSolicitada: false } : mesa),
      itens: enviado.estado.itens.filter((registro) => registro.atendimento_id !== "at-novo-2"),
      tickets: enviado.estado.tickets.filter((registro) => registro.atendimento_id !== "at-novo-2"),
      fechamentos: [...enviado.estado.fechamentos, {
        organizacao_id: "valhalla", fechamento_id: "f-07a", atendimento_id: "at-novo-2",
        mesa_id: 2, balcao_id: null, hora: "10:10", subtotal: subtotal / 100,
        servico: servico / 100, total: (subtotal + servico) / 100, servicoIncluso: true,
        divisao: [{ pessoa_id: `${item.atendimento_id}-sem-identificacao`, pessoa: "Consumo sem identificação",
          valor: (subtotal + servico) / 100 }], nfce: "nao_solicitada" as const,
        funcionario_nome: sessao.funcionario.funcionario_nome,
        garcom_nome: sessao.funcionario.funcionario_nome,
      }],
    } });
  assert.equal((await gerencia.comanda.estado()).estado.mesas.find((mesa) => mesa.mesa_id === 2)?.atendimento_id, null);

  await banco.execute({ sql: "UPDATE mesas SET atendimento_id = ? WHERE organizacao_id = ? AND mesa_id = ?",
    args: ["at-antigo-5", "valhalla", 5] });

  const migracao = await Bun.file(path.resolve(import.meta.dir, "../packages/web/drizzle/0006_limpar_mesas_travadas.sql")).text();
  await banco.executeMultiple(migracao.replaceAll("--> statement-breakpoint", "\n"));
  await banco.executeMultiple(migracao.replaceAll("--> statement-breakpoint", "\n"));
  const reparada = await banco.execute({ sql: "SELECT atendimento_id FROM mesas WHERE organizacao_id = ? AND mesa_id = ?",
    args: ["valhalla", 5] });
  assert.equal(reparada.rows[0]?.atendimento_id, null);
  assert.equal(Number((await banco.execute("SELECT COUNT(*) AS total FROM encerramentos_sem_consumo")).rows[0]?.total), Number(encerramentosAntes.rows[0]?.total));
  assert.equal(Number((await banco.execute("SELECT COUNT(*) AS total FROM fechamentos")).rows[0]?.total), Number(fechamentosAntes.rows[0]?.total) + 1);
  await banco.execute({ sql: "UPDATE mesas SET atendimento_id = ? WHERE organizacao_id = ? AND mesa_id = ?",
    args: ["at-ainda-vinculado", "valhalla", 6] });
  await banco.execute({ sql: `INSERT INTO pessoas_da_comanda
    (organizacao_id, pessoa_id, atendimento_id, mesa_id, balcao_id, nome)
    VALUES (?, ?, ?, ?, NULL, ?)`, args: ["valhalla", "p-ativo", "at-ainda-vinculado", 6, "Cliente teste"] });
  const bloqueada = await gerencia.comanda.estado();
  await assert.rejects(gerencia.comanda.persistir({ versao: bloqueada.versao, acao: "abrir_mesa",
    entidadeId: "6", estado: { ...bloqueada.estado, mesas: bloqueada.estado.mesas.map((mesa) =>
      mesa.mesa_id === 6 ? { ...mesa, status: "ocupada" as const, ativa: true,
        atendimento_id: "at-novo-6", abertaEm: new Date().toISOString(),
        garcom_id: sessao.funcionario.funcionario_id } : mesa) } }),
  (erro: { code?: string }) => erro.code === "BAD_REQUEST");
  console.log("mesa-travada-legado: abertura, item, produção, fechamento, migration idempotente e histórico OK");
} finally {
  banco.close();
}
