import type {
  Destino,
  Fechamento,
  LinhaDivisao,
  OrderItem,
  Pessoa,
  RelatorioDiario,
  Ticket,
} from "./types";
import { money, moneyCentavos, motivoSemConsumoLabel } from "./format";
import { ehCompartilhado } from "./operacao";
import { ratear } from "./rateio";

export function montarRecibo(
  mesaId: number,
  pessoas: Pessoa[],
  itens: OrderItem[],
  divisao: LinhaDivisao[],
  largura: 58 | 80,
): string {
  const linhas: string[] = [
    "VALHALLA CHOPERIA",
    `MESA ${String(mesaId).padStart(2, "0")}`,
    "-".repeat(largura === 58 ? 32 : 42),
  ];
  for (const pessoa of pessoas) {
    const total = divisao.find((linha) => linha.pessoa_id === pessoa.pessoa_id);
    linhas.push("", pessoa.nome.toUpperCase());
    for (const item of itens.filter((registro) => registro.pessoa_id === pessoa.pessoa_id)) {
      linhas.push(`${item.quantidade}x ${item.name}  ${money(item.price * item.quantidade)}`);
    }
    if (total?.rateio) linhas.push(`Rateio compartilhados  ${money(total.rateio)}`);
    if (total?.servico) linhas.push(`Servico  ${money(total.servico)}`);
    linhas.push(`TOTAL  ${money(total?.total ?? 0)}`);
  }
  linhas.push("", "Resumo de consumo - sem valor fiscal");
  return linhas.join("\n");
}

export function montarFichaProducao(ticket: Ticket, largura: 58 | 80): string {
  const linhas: string[] = [
    "VALHALLA CHOPERIA",
    `FICHA ${ticket.destino_producao === "bar" ? "BAR" : "COZINHA"}`,
    `MESA ${String(ticket.mesa_id).padStart(2, "0")}`,
    "-".repeat(largura === 58 ? 32 : 42),
  ];
  for (const linha of ticket.linhas) {
    linhas.push(`${linha.qty}x ${linha.name}`);
    if (linha.pessoa) linhas.push(`  ${linha.pessoa}`);
    if (linha.observacao) linhas.push(`  OBS: ${linha.observacao}`);
  }
  linhas.push("", `Destino: ${destinoLabel(ticket.destino_producao)}`);
  return linhas.join("\n");
}

export function montarRelatorioDiario(
  relatorio: RelatorioDiario,
  largura: 58 | 80,
): string {
  const separador = "-".repeat(largura === 58 ? 32 : 42);
  const linhas = [
    "VALHALLA CHOPERIA",
    "FECHAMENTO DIARIO",
    relatorio.data.split("-").reverse().join("/"),
    separador,
    `FATURAMENTO ${moneyCentavos(relatorio.faturamentoCentavos)}`,
    `MESAS ${relatorio.mesasAtendidas}`,
    `TICKET MEDIO ${moneyCentavos(relatorio.ticketMedioCentavos)}`,
    `SERVICO ${moneyCentavos(relatorio.servicoCentavos)}`,
    "",
    "POR DESTINO",
  ];
  for (const destino of relatorio.destinos) {
    linhas.push(
      `${destino.destino === "bar" ? "BAR" : "COZINHA"} ${moneyCentavos(destino.totalCentavos)}`,
    );
  }
  if (relatorio.produtos.length) {
    linhas.push("", "PRODUTOS MAIS VENDIDOS");
    for (const produto of relatorio.produtos.slice(0, 20)) {
      linhas.push(
        `${produto.quantidade}x ${produto.nome} ${moneyCentavos(produto.valorCentavos)}`,
      );
    }
  }
  if (relatorio.fechamentos.length) {
    linhas.push("", "FECHAMENTOS");
    for (const fechamento of relatorio.fechamentos) {
      linhas.push(
        `M${String(fechamento.mesa_id).padStart(2, "0")} ${fechamento.hora} ${moneyCentavos(fechamento.totalCentavos)} ${fechamento.funcionario_nome}`,
      );
    }
  }
  if (relatorio.encerramentosSemConsumo.length) {
    linhas.push("", "SEM CONSUMO");
    for (const registro of relatorio.encerramentosSemConsumo) {
      linhas.push(
        `M${String(registro.mesa_id).padStart(2, "0")} ${motivoSemConsumoLabel[registro.motivo]}`,
      );
    }
  }
  if (relatorio.cancelamentos.length) {
    linhas.push("", "CANCELAMENTOS");
    for (const cancelamento of relatorio.cancelamentos) {
      linhas.push(
        `M${String(cancelamento.mesa_id).padStart(2, "0")} ${cancelamento.quantidade}x ${cancelamento.nome} - ${cancelamento.autorizado_por_nome}`,
      );
    }
  }
  if (!relatorio.mesasAtendidas) linhas.push("", "SEM MOVIMENTO NO DIA");
  linhas.push("", separador, "Relatorio operacional");
  return linhas.join("\n");
}

function destinoLabel(destino: Destino) {
  return destino === "bar" ? "BAR" : "COZINHA";
}

export function divisaoDoFechamento(
  fechamento: Fechamento,
  pessoas: Pessoa[],
  itens: OrderItem[],
): LinhaDivisao[] {
  const centavosDoItem = (item: OrderItem) => Math.round(item.price * 100) * item.quantidade;
  const individuais = pessoas.map((pessoa) =>
    itens
      .filter((item) => item.pessoa_id === pessoa.pessoa_id)
      .reduce((soma, item) => soma + centavosDoItem(item), 0),
  );
  const compartilhado = itens
    .filter((item) => ehCompartilhado(item.pessoa_id))
    .reduce((soma, item) => soma + centavosDoItem(item), 0);
  const rateios = ratear(compartilhado, pessoas.map(() => 1));
  const bases = individuais.map((valor, indice) => valor + rateios[indice]);
  const servicos = ratear(Math.round(fechamento.servico * 100), bases);
  return pessoas.map((pessoa, indice) => ({
    pessoa_id: pessoa.pessoa_id,
    pessoa: pessoa.nome,
    individual: individuais[indice] / 100,
    rateio: rateios[indice] / 100,
    servico: servicos[indice] / 100,
    total: (bases[indice] + servicos[indice]) / 100,
  }));
}

export function serializarEscPos(texto: string): Uint8Array {
  const semAcentos = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/×/g, "x");
  const corpo = new TextEncoder().encode(`${semAcentos}\n`);
  const prefixo = new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 0x00]);
  const alimentacao = new Uint8Array([0x1b, 0x64, 0x03]);
  const corte = new Uint8Array([0x1d, 0x56, 0x00]);
  const resultado = new Uint8Array(
    prefixo.length + corpo.length + alimentacao.length + corte.length,
  );
  resultado.set(prefixo, 0);
  resultado.set(corpo, prefixo.length);
  resultado.set(alimentacao, prefixo.length + corpo.length);
  resultado.set(corte, prefixo.length + corpo.length + alimentacao.length);
  return resultado;
}

export function imprimirNoNavegador(texto: string, largura: 58 | 80) {
  const janela = window.open("", "_blank", "noopener,noreferrer,width=460,height=720");
  if (!janela) throw new Error("O navegador bloqueou a janela de impressão.");
  const seguro = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  janela.document.write(`<!doctype html><html><head><title>Notinha Valhalla</title>
<style>@page{size:${largura}mm auto;margin:3mm}body{margin:0;font:12px/1.35 monospace;color:#000}
pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><pre>${seguro}</pre>
<script>window.onload=()=>{window.print();window.close()}</script></body></html>`);
  janela.document.close();
}

/** Compatibilidade com o botão manual existente no caixa. */
export const imprimirRecibo = imprimirNoNavegador;
