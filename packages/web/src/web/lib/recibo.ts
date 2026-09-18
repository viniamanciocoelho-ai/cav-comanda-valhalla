import type { LinhaDivisao, OrderItem, Pessoa } from "./types";
import { ehCompartilhado } from "./demo-data";
import { money } from "./format";
import { paraCentavos, paraReais, ratear } from "./rateio";

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
    const compartilhados = itens.filter((registro) => ehCompartilhado(registro.pessoa_id));
    for (const item of compartilhados) {
      const partes = ratear(
        paraCentavos(item.price * item.quantidade),
        pessoas.map(() => 1),
      );
      const indice = pessoas.findIndex((registro) => registro.pessoa_id === pessoa.pessoa_id);
      linhas.push(`Rateio ${item.name}  ${money(paraReais(partes[indice] ?? 0))}`);
    }
    if (total?.servico) linhas.push(`Servico  ${money(total.servico)}`);
    linhas.push(`TOTAL  ${money(total?.total ?? 0)}`);
  }
  linhas.push("", "Resumo de consumo - sem valor fiscal");
  return linhas.join("\n");
}

export function imprimirRecibo(texto: string, largura: 58 | 80) {
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
