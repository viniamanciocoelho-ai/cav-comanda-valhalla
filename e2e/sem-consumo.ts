// Testes da regra de encerramento de mesa sem consumo. Rodar com: bun e2e/sem-consumo.ts
//
// Cobre o que a interface nao consegue provar sozinha: a matriz de permissao por perfil e por dono da mesa, e os
// bloqueios de elegibilidade (item enviado, ficha de producao, fechamento pedido,
// consumo lancado). Tambem confere a chave de idempotencia da abertura.

import {
  aberturaId,
  avaliarSemConsumoDe,
  type Dados,
} from "../packages/web/src/web/components/comanda-provider";
import { funcionarios } from "./fixtures-funcionarios";
import type { Funcionario, Mesa, OrderItem, Pessoa, Ticket } from "../packages/web/src/web/lib/types";

const ORG = "org-valhalla";

let falhas = 0;
let total = 0;

function checar(nome: string, condicao: boolean, detalhe = "") {
  total += 1;
  if (condicao) {
    console.log(`  ok   ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

function quem(perfil: string): Funcionario {
  const achado = funcionarios.find((f) => f.funcionario_perfil === perfil);
  if (!achado) throw new Error(`perfil ${perfil} inexistente`);
  return achado;
}

const outroGarcom: Funcionario = {
  funcionario_id: "f-livia",
  funcionario_nome: "Lívia",
  funcionario_perfil: "garcom",
  rotulo: "Lívia (garçom)",
  resumo: "Turno da tarde",
};

function mesa(extra: Partial<Mesa> = {}): Mesa {
  return {
    organizacao_id: ORG,
    mesa_id: 7,
    atendimento_id: "at-mesa-7",
    status: "ocupada",
    ativa: true,
    pessoasFixas: 0,
    totalFixo: 0,
    abertaEm: new Date(Date.now() - 12 * 60_000).toISOString(),
    garcom_id: "f-atendimento",
    contaSolicitada: false,
    servicoIncluso: true,
    ...extra,
  };
}

function item(extra: Partial<OrderItem> = {}): OrderItem {
  return {
    organizacao_id: ORG,
    item_id: "it-1",
    pedido_id: null,
    atendimento_id: "at-mesa-7",
    mesa_id: 7,
    balcao_id: null,
    pessoa_id: "p-1",
    produto_id: "pr-1",
    name: "Chope",
    price: 22,
    quantidade: 1,
    destino_producao: "bar",
    status: "novo",
    observacao: "",
    funcionario_id: "f-atendimento",
    funcionario_nome: "Atendimento",
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...extra,
  } as OrderItem;
}

function pessoa(pessoa_id: string): Pessoa {
  return {
    pessoa_id, nome: pessoa_id, atendimento_id: "at-mesa-7", mesa_id: 7, balcao_id: null,
  };
}

function dados(extra: Partial<Dados> = {}): Dados {
  return {
    mesas: [mesa()],
    balcoes: [],
    pessoas: [],
    itens: [],
    tickets: [],
    fechamentos: [],
    encerramentos: [],
    anteriores: {},
    ...extra,
  } as Dados;
}

console.log("\n1. Mesa aberta, sem pessoas e sem itens");
{
  const a = avaliarSemConsumoDe(dados(), 7, quem("garcom"));
  checar("elegivel", a.elegivel === true);
  checar("permitido para o garcom da mesa", a.permitido === true);
  checar("sem rascunho", a.rascunhos === 0);
  checar("sem impedimento", a.impedimento === null);
}

console.log("\n2. Mesa aberta com pessoas cadastradas e nenhum item");
{
  const a = avaliarSemConsumoDe(
    dados({ pessoas: [pessoa("p-1"), pessoa("p-2"), pessoa("p-3")] }),
    7,
    quem("garcom"),
  );
  checar("elegivel com pessoas na comanda", a.elegivel === true);
  checar("sem rascunho", a.rascunhos === 0);
}

console.log("\n3. Permissao por perfil");
{
  const base = dados();
  const g = avaliarSemConsumoDe(base, 7, quem("gerencia"));
  const garcomDono = avaliarSemConsumoDe(base, 7, quem("garcom"));
  const garcomOutro = avaliarSemConsumoDe(base, 7, outroGarcom);
  const producao = avaliarSemConsumoDe(base, 7, quem("producao"));
  const caixa = avaliarSemConsumoDe(base, 7, quem("caixa"));
  checar("gerencia encerra qualquer mesa vazia", g.permitido === true);
  checar("garcom dono da mesa encerra", garcomDono.permitido === true);
  checar("garcom de outra mesa NAO encerra", garcomOutro.permitido === false);
  checar("producao NAO encerra", producao.permitido === false);
  checar("caixa NAO encerra", caixa.permitido === false);
  checar(
    "gerencia encerra mesa aberta por outro garcom",
    avaliarSemConsumoDe(dados({ mesas: [mesa({ garcom_id: "f-livia" })] }), 7, quem("gerencia"))
      .permitido === true,
  );
}

console.log("\n4. Rascunhos (itens nao enviados)");
{
  const a = avaliarSemConsumoDe(
    dados({
      pessoas: [pessoa("p-1")],
      itens: [item({ item_id: "it-1", quantidade: 2 }), item({ item_id: "it-2", quantidade: 1 })],
    }),
    7,
    quem("garcom"),
  );
  checar("segue elegivel com rascunho", a.elegivel === true);
  checar("conta as quantidades em rascunho", a.rascunhos === 3, String(a.rascunhos));
}

console.log("\n5. Bloqueios de elegibilidade");
{
  const enviado = avaliarSemConsumoDe(
    dados({ itens: [item({ status: "enviado", pedido_id: "pd-1" })] }),
    7,
    quem("garcom"),
  );
  checar("item enviado bloqueia", enviado.elegivel === false);
  checar(
    "mensagem aponta o fluxo normal",
    (enviado.impedimento ?? "").includes("cancelamento"),
    enviado.impedimento ?? "",
  );

  const pronto = avaliarSemConsumoDe(
    dados({ itens: [item({ status: "pronto", pedido_id: "pd-1" })] }),
    7,
    quem("garcom"),
  );
  checar("item pronto bloqueia", pronto.elegivel === false);

  const entregue = avaliarSemConsumoDe(
    dados({ itens: [item({ status: "entregue", pedido_id: "pd-1" })] }),
    7,
    quem("garcom"),
  );
  checar("item entregue bloqueia", entregue.elegivel === false);

  const ficha = avaliarSemConsumoDe(
    dados({ tickets: [{ mesa_id: 7, atendimento_id: "at-mesa-7" } as Ticket] }),
    7,
    quem("garcom"),
  );
  checar("ficha de producao bloqueia", ficha.elegivel === false);

  const historico = avaliarSemConsumoDe(
    dados({
      itens: [item({ item_id: "it-antigo", atendimento_id: "at-antigo", status: "enviado" })],
      tickets: [{ mesa_id: 7, atendimento_id: "at-antigo" } as Ticket],
    }),
    7,
    quem("gerencia"),
  );
  checar("historico de outra abertura nao bloqueia a mesa atual", historico.elegivel === true);

  const fechando = avaliarSemConsumoDe(
    dados({ mesas: [mesa({ contaSolicitada: true })] }),
    7,
    quem("garcom"),
  );
  checar("fechamento pedido bloqueia", fechando.elegivel === false);
  checar(
    "mensagem manda concluir no caixa",
    (fechando.impedimento ?? "").includes("caixa"),
    fechando.impedimento ?? "",
  );

  const apoio = avaliarSemConsumoDe(
    dados({ mesas: [mesa({ totalFixo: 148.6, pessoasFixas: 5 })] }),
    7,
    quem("garcom"),
  );
  checar("mesa com consumo lancado bloqueia", apoio.elegivel === false);

  const livre = avaliarSemConsumoDe(
    dados({ mesas: [mesa({ status: "livre", ativa: false, abertaEm: null, garcom_id: null })] }),
    7,
    quem("gerencia"),
  );
  checar("mesa livre nao e elegivel", livre.elegivel === false);

  const inexistente = avaliarSemConsumoDe(dados(), 99, quem("gerencia"));
  checar("mesa inexistente nao e elegivel", inexistente.elegivel === false);
}

console.log("\n6. Chave de idempotencia da abertura");
{
  const m = mesa();
  checar("mesma abertura, mesma chave", aberturaId(m) === aberturaId({ ...m }));
  checar(
    "abertura nova gera chave nova",
    aberturaId(m) !== aberturaId({ ...m, abertaEm: new Date().toISOString() }),
  );
  checar(
    "mesa diferente gera chave diferente",
    aberturaId(m) !== aberturaId({ ...m, mesa_id: 9 }),
  );
  checar("chave nomeia a mesa", aberturaId(m).startsWith("ab-m7-"), aberturaId(m));
}

console.log(`\n${total - falhas}/${total} verificacoes passaram.`);
if (falhas) {
  console.log(`${falhas} falha(s).`);
  process.exit(1);
}
console.log("Regra de encerramento sem consumo: tudo certo.");
