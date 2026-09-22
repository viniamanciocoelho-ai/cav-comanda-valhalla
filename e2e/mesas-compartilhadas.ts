import assert from "node:assert/strict";
import { createRouterClient } from "../packages/web/node_modules/@orpc/server/dist/index.mjs";
import { PIN_GERENCIA_TESTE, prepararBancoTeste } from "./test-database";

await prepararBancoTeste("mesas-compartilhadas");
const { default: app, router } = await import("../packages/web/src/api");

const publico = createRouterClient(router, {
  context: { headers: new Headers() },
});
const sessaoGerencia = await publico.auth.login({
  organizacao: "valhalla",
  pin: PIN_GERENCIA_TESTE,
});
const gerencia = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoGerencia.token}` }),
  },
});

await gerencia.comanda.funcionarioSalvar({
  funcionarioId: "f-dennis",
  nome: "Dennis",
  perfil: "garcom",
  pin: "5274",
  ativo: true,
});
const sessaoDennis = await publico.auth.login({
  organizacao: "valhalla",
  pin: "5274",
});
const dennisInterno = createRouterClient(router, {
  context: {
    headers: new Headers({ authorization: `Bearer ${sessaoDennis.token}` }),
  },
});
const { createORPCClient } = await import(
  "../packages/web/node_modules/@orpc/client/dist/index.mjs"
);
const { RPCLink } = await import(
  "../packages/web/node_modules/@orpc/client/dist/adapters/fetch/index.mjs"
);
let ultimoStatusHttp = 0;
const dennis = createORPCClient(
  new RPCLink({
    url: "http://teste.local/api/rpc",
    headers: () => ({
      authorization: `Bearer ${sessaoDennis.token}`,
    }),
    fetch: async (request) => {
      const resposta = await app.fetch(request);
      ultimoStatusHttp = resposta.status;
      return resposta;
    },
  }),
);

const estadoInicial = await gerencia.comanda.estado();
const mesa08 = estadoInicial.estado.mesas.find((mesa) => mesa.mesa_id === 8);
assert.ok(mesa08);
const mesaAberta = {
  ...estadoInicial.estado,
  mesas: estadoInicial.estado.mesas.map((mesa) =>
    mesa.mesa_id === 8
      ? {
          ...mesa,
          status: "ocupada" as const,
          ativa: true,
          atendimento_id: "at-mesa-08",
          abertaEm: new Date().toISOString(),
          garcom_id: sessaoGerencia.funcionario.funcionario_id,
        }
      : mesa,
  ),
};
const abertura = await gerencia.comanda.persistir({
  versao: estadoInicial.versao,
  acao: "abrir_mesa",
  entidadeId: "8",
  estado: mesaAberta,
});

const estadoDoDennis = await dennis.comanda.estado();
const mesa08DoDennis = estadoDoDennis.estado.mesas.find((mesa) => mesa.mesa_id === 8);
assert.ok(mesa08DoDennis?.ativa);
assert.equal(mesa08DoDennis?.status, "ocupada");
assert.equal(mesa08DoDennis?.garcom_id, sessaoGerencia.funcionario.funcionario_id);

const produto = estadoDoDennis.cardapio.find((item) => item.produto_id === "m1");
assert.ok(produto);
const agora = new Date().toISOString();
const pessoa = {
  pessoa_id: "m8-dennis",
  nome: "Cliente Mesa 08",
  atendimento_id: "at-mesa-08",
  mesa_id: 8,
  balcao_id: null,
};
const item = {
  organizacao_id: estadoDoDennis.organizacaoId,
  item_id: "i-m8-dennis",
  pedido_id: null,
  atendimento_id: "at-mesa-08",
  mesa_id: 8,
  balcao_id: null,
  pessoa_id: pessoa.pessoa_id,
  produto_id: produto.produto_id,
  name: produto.name,
  price: produto.price,
  quantidade: 1,
  observacao: "",
  destino_producao: produto.destino_producao,
  status: "novo" as const,
  funcionario_id: sessaoDennis.funcionario.funcionario_id,
  funcionario_nome: sessaoDennis.funcionario.funcionario_nome,
  funcionario_perfil: sessaoDennis.funcionario.funcionario_perfil,
  criado_em: agora,
  enviado_em: null,
  atualizado_em: agora,
};
const comItem = {
  ...estadoDoDennis.estado,
  pessoas: [...estadoDoDennis.estado.pessoas, pessoa],
  itens: [...estadoDoDennis.estado.itens, item],
};
const lancamento = await dennis.comanda.persistir({
  versao: abertura.versao,
  acao: "alterar_comanda",
  entidadeId: "8",
  estado: comItem,
});
assert.equal(lancamento.versao, abertura.versao + 1);
assert.equal(ultimoStatusHttp, 200);

const pedidoId = "pd-m8-dennis";
const enviado = await dennis.comanda.persistir({
  versao: lancamento.versao,
  acao: "enviar_pedido",
  entidadeId: "8",
  estado: {
    ...comItem,
    itens: [
      {
        ...item,
        pedido_id: pedidoId,
        status: "enviado" as const,
        enviado_em: agora,
        atualizado_em: agora,
      },
    ],
    tickets: [
      {
        organizacao_id: estadoDoDennis.organizacaoId,
        ticket_id: "t-m8-dennis",
        pedido_id: pedidoId,
        atendimento_id: "at-mesa-08",
        mesa_id: 8,
        balcao_id: null,
        destino_producao: produto.destino_producao,
        status: "enviado" as const,
        linhas: [
          {
            item_id: item.item_id,
            produto_id: item.produto_id,
            name: item.name,
            qty: item.quantidade,
            pessoa: pessoa.nome,
            observacao: item.observacao,
          },
        ],
        itemIds: [item.item_id],
        funcionario_id: sessaoDennis.funcionario.funcionario_id,
        funcionario_nome: sessaoDennis.funcionario.funcionario_nome,
        criado_em: agora,
        enviado_em: agora,
        atualizado_em: agora,
      },
      ...comItem.tickets,
    ],
  },
});
assert.equal(enviado.versao, lancamento.versao + 1);
assert.equal(ultimoStatusHttp, 200);

const estadoAposEnvio = await dennis.comanda.estado();
assert.equal(estadoAposEnvio.versao, enviado.versao);
const itemPersistido = estadoAposEnvio.estado.itens.find(
  (registro) => registro.item_id === item.item_id,
);
assert.equal(itemPersistido?.funcionario_id, sessaoDennis.funcionario.funcionario_id);
assert.equal(itemPersistido?.organizacao_id, estadoDoDennis.organizacaoId);
const ticketPersistido = estadoAposEnvio.estado.tickets.find(
  (registro) => registro.ticket_id === "t-m8-dennis",
);
assert.equal(ticketPersistido?.funcionario_id, sessaoDennis.funcionario.funcionario_id);
assert.equal(ticketPersistido?.organizacao_id, estadoDoDennis.organizacaoId);
const solicitacaoFechamento = {
  ...estadoAposEnvio.estado,
  mesas: estadoAposEnvio.estado.mesas.map((mesa) =>
    mesa.mesa_id === 8
      ? {
          ...mesa,
          status: "aguardando" as const,
          contaSolicitada: true,
        }
      : mesa,
  ),
};
await assert.rejects(
  () =>
    dennisInterno.comanda.persistir({
      versao: enviado.versao,
      acao: "solicitar_fechamento",
      entidadeId: "8",
      estado: solicitacaoFechamento,
    }),
  /Garçom não pode alterar mesa de outro funcionário/,
);

console.log(
  "Mesas compartilhadas: gerência abriu a Mesa 08, Dennis leu, lançou item e enviou pedido com sucesso.",
);
