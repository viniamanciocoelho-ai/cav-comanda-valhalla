import assert from "node:assert/strict";
import { validarTransicao, type EstadoPersistido } from "../packages/web/src/api/lib/comanda-store";
import { funcionarios } from "./fixtures-funcionarios";
import type {
  Fechamento,
  Funcionario,
  Mesa,
  OrderItem,
  Ticket,
} from "../packages/web/src/web/lib/types";

const mesa: Mesa = {
  organizacao_id: "valhalla",
  mesa_id: 1,
  status: "ocupada",
  ativa: true,
  pessoasFixas: 0,
  totalFixo: 0,
  abertaEm: new Date().toISOString(),
  garcom_id: "f-atendimento",
  contaSolicitada: false,
  servicoIncluso: true,
};

const item: OrderItem = {
  organizacao_id: "valhalla",
  item_id: "i-1",
  pedido_id: null,
  mesa_id: 1,
  pessoa_id: "m1-ana",
  produto_id: "m1",
  name: "CHOOP PIL 500ML",
  price: 15,
  quantidade: 1,
  observacao: "",
  destino_producao: "bar",
  status: "enviado",
  funcionario_id: "f-atendimento",
  funcionario_nome: "Atendimento",
  funcionario_perfil: "garcom",
  criado_em: new Date().toISOString(),
  enviado_em: new Date().toISOString(),
  atualizado_em: new Date().toISOString(),
};

const base: EstadoPersistido = {
  mesas: [mesa],
  pessoas: [
    {
      pessoa_id: "m1-ana",
      nome: "Ana",
      mesa_id: 1,
    },
  ],
  itens: [item],
  tickets: [],
  fechamentos: [],
  encerramentos: [],
  anteriores: {},
};

const perfil = (nome: Funcionario["funcionario_nome"]): Funcionario => {
  const funcionario = funcionarios.find((entrada) => entrada.funcionario_nome === nome);
  assert.ok(funcionario);
  return funcionario;
};

const fechamentoMalicioso: Fechamento = {
  organizacao_id: "valhalla",
  fechamento_id: "f-malicioso",
  mesa_id: 1,
  hora: "20:00",
  subtotal: 15,
  servico: 0,
  total: 15,
  servicoIncluso: false,
  divisao: [{ pessoa_id: "m1-ana", pessoa: "Ana", valor: 15 }],
  nfce: "nao_solicitada",
  funcionario_nome: "Atendimento",
  garcom_nome: "Atendimento",
};

const mesaLivre: Mesa = {
  ...mesa,
  status: "livre",
  ativa: false,
  abertaEm: null,
  garcom_id: null,
};
const baseLivre: EstadoPersistido = {
  ...base,
  mesas: [mesaLivre],
  pessoas: [],
  itens: [],
};
assert.doesNotThrow(
  () =>
    validarTransicao(
      baseLivre,
      {
        ...baseLivre,
        mesas: [
          {
            ...mesaLivre,
            status: "ocupada",
            ativa: true,
            abertaEm: new Date().toISOString(),
            garcom_id: perfil("Gerência").funcionario_id,
          },
        ],
      },
      perfil("Gerência"),
      "abrir_mesa",
    ),
  "gerencia pode abrir mesa em seu proprio nome",
);
assert.throws(
  () =>
    validarTransicao(
      baseLivre,
      {
        ...baseLivre,
        mesas: [
          {
            ...mesaLivre,
            status: "ocupada",
            ativa: true,
            abertaEm: new Date().toISOString(),
            garcom_id: "funcionario-inexistente",
          },
        ],
      },
      perfil("Gerência"),
      "abrir_mesa",
    ),
  /abertura de mesa inválida/i,
  "abertura nao pode atribuir a mesa a um funcionario arbitrario",
);

const gerencia = perfil("Gerência");
const atendimento = perfil("Atendimento");
const encerradaEm = new Date();
const encerramento = {
  organizacao_id: "valhalla",
  encerramento_id: "e-1",
  mesa_id: 1,
  abertura_id: `ab-m1-${mesa.abertaEm}`,
  encerrada_sem_consumo: true as const,
  motivo: "desistiram" as const,
  observacao: "",
  rascunhos_descartados: 1,
  funcionario_id: gerencia.funcionario_id,
  funcionario_nome: gerencia.funcionario_nome,
  funcionario_perfil: gerencia.funcionario_perfil,
  aberta_em: mesa.abertaEm,
  encerrada_em: encerradaEm.toISOString(),
  duracao_segundos: 1,
  desfeito_em: null,
};
assert.doesNotThrow(
  () =>
    validarTransicao(
      {
        ...baseLivre,
        encerramentos: [encerramento],
      },
      {
        ...base,
        itens: [{ ...item, status: "novo", enviado_em: null }],
        encerramentos: [
          {
            ...encerramento,
            desfeito_em: new Date(encerradaEm.getTime() + 1_000).toISOString(),
          },
        ],
      },
      gerencia,
      "desfazer_sem_consumo",
      [gerencia, atendimento],
    ),
  "desfazer preserva autoria valida do garcom que criou o rascunho",
);

assert.throws(
  () =>
    validarTransicao(
      base,
      { ...base, fechamentos: [fechamentoMalicioso] },
      perfil("Atendimento"),
      "alterar_comanda",
    ),
  /fechamento|caixa|permit/i,
  "garcom nao pode inserir fechamento pela acao de comanda",
);

assert.throws(
  () =>
    validarTransicao(
      base,
      {
        ...base,
        itens: [{ ...item, price: 999 }],
      },
      perfil("Produção"),
      "mover_producao",
    ),
  /produção|item|alterar|permit/i,
  "producao nao pode alterar preco de item",
);

assert.throws(
  () =>
    validarTransicao(
      base,
      {
        ...base,
        itens: [{ ...item, price: 999 }],
      },
      perfil("Caixa"),
      "alterar_servico",
    ),
  /caixa|item|alterar|permit/i,
  "caixa nao pode alterar preco de item",
);

assert.throws(
  () =>
    validarTransicao(
      base,
      {
        ...base,
        itens: [{ ...item, quantidade: 99 }],
      },
      perfil("Atendimento"),
      "alterar_comanda",
    ),
  /rascunho|campos|permit/i,
  "garcom nao pode editar quantidade de item ja enviado",
);

const rascunho: OrderItem = {
  ...item,
  item_id: "i-2",
  pedido_id: null,
  status: "novo",
  enviado_em: null,
};
const ticketAnterior: Ticket = {
  organizacao_id: "valhalla",
  ticket_id: "t-1",
  pedido_id: "pd-1",
  mesa_id: 1,
  destino_producao: "bar",
  status: "enviado",
  linhas: [
    {
      item_id: item.item_id,
      produto_id: item.produto_id,
      name: item.name,
      qty: item.quantidade,
      pessoa: "Ana",
      observacao: "",
    },
  ],
  itemIds: [item.item_id],
  funcionario_id: "f-atendimento",
  funcionario_nome: "Atendimento",
  criado_em: item.criado_em,
  enviado_em: item.enviado_em!,
  atualizado_em: item.atualizado_em,
};
const itemEnviado: OrderItem = {
  ...rascunho,
  pedido_id: "pd-2",
  status: "enviado",
  enviado_em: item.enviado_em,
};
const ticketNovo: Ticket = {
  ...ticketAnterior,
  ticket_id: "t-2",
  pedido_id: "pd-2",
  linhas: [
    {
      item_id: rascunho.item_id,
      produto_id: rascunho.produto_id,
      name: rascunho.name,
      qty: rascunho.quantidade,
      pessoa: "Ana",
      observacao: rascunho.observacao,
    },
  ],
  itemIds: [rascunho.item_id],
};

const pendente: OrderItem = {
  ...item,
  status: "cancelamento_solicitado",
};
const baseCancelamento: EstadoPersistido = {
  ...base,
  itens: [pendente],
  tickets: [ticketAnterior],
  anteriores: { [pendente.item_id]: "enviado" },
};
assert.doesNotThrow(
  () =>
    validarTransicao(
      baseCancelamento,
      {
        ...baseCancelamento,
        itens: [{ ...pendente, status: "enviado", atualizado_em: new Date().toISOString() }],
        anteriores: {},
      },
      perfil("Gerência"),
      "decidir_cancelamento",
    ),
  "gerencia pode recusar um cancelamento sem alterar a ficha",
);
assert.doesNotThrow(
  () =>
    validarTransicao(
      baseCancelamento,
      {
        ...baseCancelamento,
        itens: [],
        tickets: [],
        anteriores: {},
      },
      perfil("Gerência"),
      "decidir_cancelamento",
    ),
  "gerencia pode autorizar e remover a ficha vazia",
);
assert.throws(
  () =>
    validarTransicao(
      baseCancelamento,
      {
        ...baseCancelamento,
        itens: [
          {
            ...pendente,
            status: "enviado",
            quantidade: 99,
            atualizado_em: new Date().toISOString(),
          },
        ],
        anteriores: {},
      },
      perfil("Gerência"),
      "decidir_cancelamento",
    ),
  /campos|cancelamento|indevidos/i,
  "decisao de cancelamento nao pode adulterar quantidade",
);

assert.doesNotThrow(
  () =>
    validarTransicao(
      { ...base, itens: [item, rascunho], tickets: [ticketAnterior] },
      {
        ...base,
        itens: [item, itemEnviado],
        tickets: [ticketNovo, ticketAnterior],
      },
      perfil("Atendimento"),
      "enviar_pedido",
    ),
  "envio valido preserva fichas anteriores e cria a nova ficha",
);
assert.throws(
  () =>
    validarTransicao(
      { ...base, itens: [item, rascunho], tickets: [ticketAnterior] },
      {
        ...base,
        itens: [item, itemEnviado],
        tickets: [
          {
            ...ticketNovo,
            linhas: [{ ...ticketNovo.linhas[0], pessoa: "Pessoa adulterada" }],
          },
          ticketAnterior,
        ],
      },
      perfil("Atendimento"),
      "enviar_pedido",
    ),
  /ficha|itens enviados|corresponde/i,
  "ficha nova nao pode adulterar o nome da pessoa",
);

assert.doesNotThrow(
  () =>
    validarTransicao(
      base,
      {
        ...base,
        mesas: [{ ...mesa, status: "aguardando", contaSolicitada: true }],
      },
      perfil("Atendimento"),
      "solicitar_fechamento",
    ),
  "garcom pode solicitar fechamento de mesa com consumo enviado",
);
assert.throws(
  () =>
    validarTransicao(
      { ...base, itens: [rascunho] },
      {
        ...base,
        mesas: [{ ...mesa, status: "aguardando", contaSolicitada: true }],
        itens: [rascunho],
      },
      perfil("Atendimento"),
      "solicitar_fechamento",
    ),
  /fechamento inválida/i,
  "rascunho impede solicitar fechamento",
);

const fechamentoValido: Fechamento = {
  ...fechamentoMalicioso,
  funcionario_nome: "Caixa",
  servico: 1.5,
  total: 16.5,
  servicoIncluso: true,
  divisao: [{ pessoa_id: "m1-ana", pessoa: "Ana", valor: 16.5 }],
};
const estadoFechado = {
  ...base,
  mesas: [
    {
      ...mesa,
      status: "livre" as const,
      ativa: false,
      abertaEm: null,
      garcom_id: null,
      contaSolicitada: false,
      servicoIncluso: true,
      pessoasFixas: 0,
      totalFixo: 0,
    },
  ],
  pessoas: [],
  itens: [],
  tickets: [],
  fechamentos: [fechamentoValido],
};
assert.doesNotThrow(
  () => validarTransicao(base, estadoFechado, perfil("Caixa"), "fechar_conta"),
  "fechamento correto em centavos deve ser aceito",
);

assert.throws(
  () =>
    validarTransicao(
      base,
      {
        ...estadoFechado,
        fechamentos: [
          {
            ...fechamentoValido,
            subtotal: 0.01,
            servico: 0,
            total: 0.01,
            divisao: [{ pessoa_id: "m1-ana", pessoa: "Ana", valor: 0.01 }],
          },
        ],
      },
      perfil("Caixa"),
      "fechar_conta",
    ),
  /totais|divisão|conferem/i,
  "caixa nao pode enviar totais ou divisão adulterados",
);

console.log("Regressao de seguranca: 16 cenarios de autorização e integridade aprovados.");
