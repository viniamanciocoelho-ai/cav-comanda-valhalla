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
import { ehCompartilhado, participantesDoRateio } from "./operacao";
import { ratear } from "./rateio";

export function montarRecibo(
  local: number | { mesa_id: number | null; balcao_id: number | null },
  pessoas: Pessoa[],
  itens: OrderItem[],
  divisao: LinhaDivisao[],
  largura: 58 | 80,
): string {
  const localTexto =
    typeof local === "number"
      ? `MESA ${String(local).padStart(2, "0")}`
      : local.mesa_id !== null
        ? `MESA ${String(local.mesa_id).padStart(2, "0")}`
        : `BALCAO ${local.balcao_id}`;
  const linhas: string[] = [
    "VALHALLA CHOPERIA",
    localTexto,
    "-".repeat(largura === 58 ? 32 : 42),
  ];
  for (const total of divisao) {
    linhas.push("", total.pessoa.toUpperCase());
    for (const item of itens.filter((registro) =>
      registro.pessoa_id === total.pessoa_id ||
      (!pessoas.length && ehCompartilhado(registro.pessoa_id))
    )) {
      linhas.push(`${item.quantidade}x ${item.name}  ${money(item.price * item.quantidade)}`);
    }
    if (total.rateio && pessoas.length) linhas.push(`Rateio compartilhados  ${money(total.rateio)}`);
    if (total.servico) linhas.push(`Servico  ${money(total.servico)}`);
    linhas.push(`TOTAL  ${money(total.total)}`);
  }
  linhas.push("", "Resumo de consumo - sem valor fiscal");
  return linhas.join("\n");
}

export function montarFichaProducao(ticket: Ticket, largura: 58 | 80): string {
  const local =
    ticket.mesa_id !== null
      ? `MESA ${String(ticket.mesa_id).padStart(2, "0")}`
      : `BALCAO ${ticket.balcao_id}`;
  const linhas: string[] = [
    "VALHALLA CHOPERIA",
    `FICHA ${ticket.destino_producao === "bar" ? "BAR" : "COZINHA"}`,
    local,
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
        `${localAbreviado(fechamento)} ${fechamento.hora} ${moneyCentavos(fechamento.totalCentavos)} ${fechamento.funcionario_nome}`,
      );
    }
  }
  if (relatorio.encerramentosSemConsumo.length) {
    linhas.push("", "SEM CONSUMO");
    for (const registro of relatorio.encerramentosSemConsumo) {
      linhas.push(
        `${localAbreviado(registro)} ${motivoSemConsumoLabel[registro.motivo]}`,
      );
    }
  }
  if (relatorio.cancelamentos.length) {
    linhas.push("", "CANCELAMENTOS");
    for (const cancelamento of relatorio.cancelamentos) {
      linhas.push(
        `${localAbreviado(cancelamento)} ${cancelamento.quantidade}x ${cancelamento.nome} - ${cancelamento.autorizado_por_nome}`,
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

function localAbreviado(local: { mesa_id: number | null; balcao_id: number | null }) {
  return local.mesa_id !== null
    ? `M${String(local.mesa_id).padStart(2, "0")}`
    : `B${local.balcao_id ?? "?"}`;
}

export function divisaoDoFechamento(
  fechamento: Fechamento,
  pessoas: Pessoa[],
  itens: OrderItem[],
): LinhaDivisao[] {
  const participantes = participantesDoRateio(pessoas, fechamento.atendimento_id);
  const centavosDoItem = (item: OrderItem) => Math.round(item.price * 100) * item.quantidade;
  const individuais = participantes.map((pessoa) =>
    itens
      .filter((item) => item.pessoa_id === pessoa.pessoa_id)
      .reduce((soma, item) => soma + centavosDoItem(item), 0),
  );
  const compartilhado = itens
    .filter((item) => ehCompartilhado(item.pessoa_id))
    .reduce((soma, item) => soma + centavosDoItem(item), 0);
  const rateios = ratear(compartilhado, participantes.map(() => 1));
  const bases = individuais.map((valor, indice) => valor + rateios[indice]);
  const servicos = ratear(Math.round(fechamento.servico * 100), bases);
  return participantes.map((pessoa, indice) => ({
    pessoa_id: pessoa.pessoa_id,
    pessoa: pessoa.nome,
    individual: individuais[indice] / 100,
    rateio: rateios[indice] / 100,
    servico: servicos[indice] / 100,
    total: (bases[indice] + servicos[indice]) / 100,
  }));
}

export type PaginaCodigo = 2 | 3 | 16 | 19;

const caracteresEstendidos: Record<PaginaCodigo, string> = {
  2: "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00f8\u00a3\u00d8\u00d7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u00ae\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u00c1\u00c2\u00c0\u00a9\u2563\u2551\u2557\u255d\u00a2\u00a5\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u00e3\u00c3\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u00a4\u00f0\u00d0\u00ca\u00cb\u00c8\u0131\u00cd\u00ce\u00cf\u2518\u250c\u2588\u2584\u00a6\u00cc\u2580\u00d3\u00df\u00d4\u00d2\u00f5\u00d5\u00b5\u00fe\u00de\u00da\u00db\u00d9\u00fd\u00dd\u00af\u00b4\u00ad\u00b1\u2017\u00be\u00b6\u00a7\u00f7\u00b8\u00b0\u00a8\u00b7\u00b9\u00b3\u00b2\u25a0\u00a0",
  3: "\u00c7\u00fc\u00e9\u00e2\u00e3\u00e0\u00c1\u00e7\u00ea\u00ca\u00e8\u00cd\u00d4\u00ec\u00c3\u00c2\u00c9\u00c0\u00c8\u00f4\u00f5\u00f2\u00da\u00f9\u00cc\u00d5\u00dc\u00a2\u00a3\u00d9\u20a7\u00d3\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u00d2\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0",
  16: "\u20ac\ufffd\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\ufffd\u017d\ufffd\ufffd\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\ufffd\u017e\u0178\u00a0\u00a1\u00a2\u00a3\u00a4\u00a5\u00a6\u00a7\u00a8\u00a9\u00aa\u00ab\u00ac\u00ad\u00ae\u00af\u00b0\u00b1\u00b2\u00b3\u00b4\u00b5\u00b6\u00b7\u00b8\u00b9\u00ba\u00bb\u00bc\u00bd\u00be\u00bf\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c6\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d0\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d7\u00d8\u00d9\u00da\u00db\u00dc\u00dd\u00de\u00df\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e6\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f0\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f7\u00f8\u00f9\u00fa\u00fb\u00fc\u00fd\u00fe\u00ff",
  19: "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00f8\u00a3\u00d8\u00d7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u00ae\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u00c1\u00c2\u00c0\u00a9\u2563\u2551\u2557\u255d\u00a2\u00a5\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u00e3\u00c3\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u00a4\u00f0\u00d0\u00ca\u00cb\u00c8\u20ac\u00cd\u00ce\u00cf\u2518\u250c\u2588\u2584\u00a6\u00cc\u2580\u00d3\u00df\u00d4\u00d2\u00f5\u00d5\u00b5\u00fe\u00de\u00da\u00db\u00d9\u00fd\u00dd\u00af\u00b4\u00ad\u00b1\u2017\u00be\u00b6\u00a7\u00f7\u00b8\u00b0\u00a8\u00b7\u00b9\u00b3\u00b2\u25a0\u00a0",
};

const mapasPaginas = new Map<PaginaCodigo, Map<string, number>>();

function mapaDaPagina(pagina: PaginaCodigo) {
  const existente = mapasPaginas.get(pagina);
  if (existente) return existente;
  const mapa = new Map<string, number>();
  [...caracteresEstendidos[pagina]].forEach((caractere, indice) => {
    if (caractere !== "\ufffd") mapa.set(caractere, indice + 0x80);
  });
  mapasPaginas.set(pagina, mapa);
  return mapa;
}

export function codificarPagina(texto: string, pagina: PaginaCodigo): Uint8Array {
  const mapa = mapaDaPagina(pagina);
  const bytes: number[] = [];
  for (const caractereOriginal of texto.normalize("NFC").replace(/×/g, "x")) {
    const codigo = caractereOriginal.codePointAt(0) ?? 0x3f;
    if (codigo <= 0x7f) {
      bytes.push(codigo);
      continue;
    }
    const byte = mapa.get(caractereOriginal);
    if (byte !== undefined) {
      bytes.push(byte);
      continue;
    }
    const equivalente = caractereOriginal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (equivalente && equivalente !== caractereOriginal) {
      bytes.push(...codificarPagina(equivalente, pagina));
    } else {
      bytes.push(0x3f);
    }
  }
  return new Uint8Array(bytes);
}

export function quebrarTextoTermico(texto: string, colunas = 32) {
  const resultado: string[] = [];
  for (const linhaOriginal of texto.replace(/\r/g, "").split("\n")) {
    let linha = linhaOriginal.trimEnd();
    if (!linha) {
      resultado.push("");
      continue;
    }
    while (linha.length > colunas) {
      const trecho = linha.slice(0, colunas + 1);
      const ultimoEspaco = trecho.lastIndexOf(" ");
      const corte = ultimoEspaco > 0 ? ultimoEspaco : colunas;
      resultado.push(linha.slice(0, corte).trimEnd());
      linha = linha.slice(corte).trimStart();
    }
    resultado.push(linha);
  }
  return resultado.join("\n");
}

export function serializarEscPos(
  texto: string,
  pagina: PaginaCodigo = 3,
): Uint8Array {
  const corpo = codificarPagina(`${quebrarTextoTermico(texto)}\n`, pagina);
  const prefixo = new Uint8Array([
    0x1b, 0x40,
    0x1b, 0x74, pagina,
    0x1b, 0x61, 0x00,
  ]);
  const alimentacao = new Uint8Array([0x1b, 0x64, 0x04]);
  const resultado = new Uint8Array(prefixo.length + corpo.length + alimentacao.length);
  resultado.set(prefixo, 0);
  resultado.set(corpo, prefixo.length);
  resultado.set(alimentacao, prefixo.length + corpo.length);
  return resultado;
}

export function imprimirNoNavegador(texto: string, largura: 58 | 80) {
  const quadro = document.createElement("iframe");
  quadro.dataset.cavImpressao = "navegador";
  quadro.setAttribute("aria-hidden", "true");
  Object.assign(quadro.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    border: "0",
    right: "0",
    bottom: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(quadro);
  const documento = quadro.contentDocument;
  const janela = quadro.contentWindow;
  if (!documento || !janela) {
    quadro.remove();
    throw new Error(
      "O Chrome não conseguiu preparar a impressão. Conecte a impressora Bluetooth ou use o RawBT.",
    );
  }
  const seguro = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  documento.open();
  documento.write(`<!doctype html><html><head><title>Notinha Valhalla</title>
<style>@page{size:${largura}mm auto;margin:0}html,body{margin:0;padding:0;width:${largura}mm}
body{box-sizing:border-box;padding:3mm 5mm;width:${largura}mm;font:11px/1.3 monospace;color:#000}
pre{box-sizing:border-box;margin:0;width:${largura === 58 ? 48 : 70}mm;white-space:pre-wrap;overflow-wrap:anywhere}</style>
</head><body><pre>${seguro}</pre></body></html>`);
  documento.close();
  window.dispatchEvent(
    new CustomEvent("cav:impressao-navegador", {
      detail: { ativacaoUsuario: navigator.userActivation?.isActive ?? null },
    }),
  );
  const removerQuadro = () => quadro.remove();
  janela.addEventListener("afterprint", removerQuadro, { once: true });
  janela.focus();
  janela.print();
  window.setTimeout(removerQuadro, 60_000);
}

/** Compatibilidade com o botão manual existente no caixa. */
export const imprimirRecibo = imprimirNoNavegador;
