import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, Printer, ReceiptText, UtensilsCrossed } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { Action } from "../components/ui/action";
import { Metric, SectionHeading } from "../components/ui/pieces";
import { client } from "../lib/api";
import {
  destinoLabel,
  hora,
  mesaLabel,
  moneyCentavos,
  motivoSemConsumoLabel,
} from "../lib/format";
import { imprimirNoNavegador } from "../lib/recibo";
import type { RelatorioDiario } from "../lib/types";

function hojeOperacional() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function RelatorioDiarioPage() {
  const [data, setData] = useState(hojeOperacional);
  const [relatorio, setRelatorio] = useState<RelatorioDiario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [imprimindo, setImprimindo] = useState(false);

  const carregar = useCallback(async (dataSelecionada: string) => {
    try {
      setRelatorio(await client.relatorio.diario({ data: dataSelecionada }));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o relatório.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void carregar(data);
  }, [carregar, data]);

  async function imprimir() {
    setImprimindo(true);
    setErro(null);
    try {
      const resultado = await client.relatorio.imprimir({ data });
      if (resultado.modo === "navegador" && resultado.texto) {
        imprimirNoNavegador(resultado.texto, resultado.largura);
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível imprimir o relatório.");
    } finally {
      setImprimindo(false);
    }
  }

  const semMovimento = relatorio?.mesasAtendidas === 0;

  return (
    <AppShell titulo="Fechamento diário" subtitulo="Faturamento persistido por dia">
      <SectionHeading
        eyebrow="Financeiro"
        title="Resumo do dia"
        hint="Valores consolidados a partir dos fechamentos registrados no banco."
        action={
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-muted grid gap-1 text-[12px]">
              Data
              <span className="border-line bg-surface flex min-h-11 items-center gap-2 rounded-md border px-3">
                <CalendarDays className="text-gold size-4" aria-hidden="true" />
                <input
                  type="date"
                  value={data}
                  onChange={(evento) => {
                    setCarregando(true);
                    setErro(null);
                    setData(evento.target.value);
                  }}
                  className="text-parchment min-w-0 bg-transparent text-[13px] outline-none"
                />
              </span>
            </label>
            <Action
              variante="secundaria"
              onClick={() => void imprimir()}
              disabled={carregando || imprimindo || !relatorio}
            >
              <Printer className="size-4" />
              {imprimindo ? "Imprimindo" : "Imprimir"}
            </Action>
          </div>
        }
      />

      {erro ? (
        <div className="border-ember/60 bg-ember/10 text-parchment mb-5 rounded-md border px-4 py-3 text-[13px]">
          {erro}
        </div>
      ) : null}

      {carregando ? (
        <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
          Carregando fechamento do dia…
        </div>
      ) : relatorio ? (
        <>
          <section className="border-line bg-surface mb-7 grid grid-cols-2 overflow-hidden rounded-md border lg:grid-cols-4">
            <div className="border-line border-r border-b lg:border-b-0">
              <Metric
                label="Faturamento"
                value={moneyCentavos(relatorio.faturamentoCentavos)}
                accent="var(--vh-gold-bright)"
              />
            </div>
            <div className="border-line border-b lg:border-r lg:border-b-0">
              <Metric label="Mesas atendidas" value={String(relatorio.mesasAtendidas)} />
            </div>
            <div className="border-line border-r">
              <Metric label="Ticket médio" value={moneyCentavos(relatorio.ticketMedioCentavos)} />
            </div>
            <div>
              <Metric label="Taxa de serviço" value={moneyCentavos(relatorio.servicoCentavos)} />
            </div>
          </section>

          {semMovimento ? (
            <section className="border-line bg-surface rounded-md border p-8 text-center">
              <ReceiptText className="text-gold mx-auto size-8" aria-hidden="true" />
              <h2 className="text-parchment mt-3 text-xl">Sem movimento neste dia</h2>
              <p className="text-muted mt-2 text-[13px]">
                Nenhuma conta foi fechada na data escolhida.
              </p>
            </section>
          ) : (
            <>
              <SectionHeading
                eyebrow="Produção"
                title="Saída por destino"
                hint="O serviço é distribuído em centavos entre os destinos para fechar com o faturamento."
              />
              <section className="mb-7 grid gap-3 sm:grid-cols-2">
                {relatorio.destinos.map((destino) => (
                  <div
                    key={destino.destino}
                    className="border-line bg-surface flex items-center gap-4 rounded-md border p-4"
                  >
                    <span className="border-line bg-surface-2 text-gold grid size-11 shrink-0 place-items-center rounded-md border">
                      {destino.destino === "bar" ? (
                        <BarChart3 className="size-5" />
                      ) : (
                        <UtensilsCrossed className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-parchment tracking-[0.08em] uppercase">
                        {destinoLabel[destino.destino]}
                      </p>
                      <p className="text-muted text-[12px]">
                        {destino.quantidade} itens · consumo{" "}
                        {moneyCentavos(destino.subtotalCentavos)}
                      </p>
                    </div>
                    <p className="font-display vh-tabular text-gold-bright text-xl">
                      {moneyCentavos(destino.totalCentavos)}
                    </p>
                  </div>
                ))}
              </section>

              <div className="grid gap-7 xl:grid-cols-2">
                <section>
                  <SectionHeading eyebrow="Produtos" title="Mais vendidos" />
                  <ul className="border-line bg-surface divide-y divide-[var(--vh-border)] rounded-md border">
                    {relatorio.produtos.map((produto) => (
                      <li
                        key={produto.produto_id}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"
                      >
                        <span className="text-parchment min-w-0 truncate">{produto.nome}</span>
                        <span className="text-muted vh-tabular shrink-0">
                          {produto.quantidade}x · {moneyCentavos(produto.valorCentavos)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <SectionHeading eyebrow="Caixa" title="Fechamentos" />
                  <ul className="border-line bg-surface divide-y divide-[var(--vh-border)] rounded-md border">
                    {relatorio.fechamentos.map((fechamento) => (
                      <li
                        key={fechamento.fechamento_id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13px]"
                      >
                        <span className="font-display text-parchment">
                          Mesa {mesaLabel(fechamento.mesa_id)}
                        </span>
                        <span className="text-muted">
                          {fechamento.hora} · {fechamento.funcionario_nome}
                        </span>
                        <span className="text-gold vh-tabular ml-auto">
                          {moneyCentavos(fechamento.totalCentavos)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          )}

          {relatorio.encerramentosSemConsumo.length ? (
            <section className="mt-8">
              <SectionHeading eyebrow="Auditoria" title="Encerramentos sem consumo" />
              <ul className="border-line bg-surface divide-y divide-[var(--vh-border)] rounded-md border">
                {relatorio.encerramentosSemConsumo.map((registro) => (
                  <li key={registro.encerramento_id} className="px-4 py-3 text-[13px]">
                    <p className="text-parchment">
                      Mesa {mesaLabel(registro.mesa_id)} ·{" "}
                      {motivoSemConsumoLabel[registro.motivo]}
                    </p>
                    <p className="text-muted mt-1">
                      {hora(registro.encerrada_em)} · {registro.funcionario_nome}
                      {registro.observacao ? ` · ${registro.observacao}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {relatorio.cancelamentos.length ? (
            <section className="mt-8">
              <SectionHeading eyebrow="Auditoria" title="Cancelamentos autorizados" />
              <ul className="border-line bg-surface divide-y divide-[var(--vh-border)] rounded-md border">
                {relatorio.cancelamentos.map((cancelamento) => (
                  <li
                    key={cancelamento.cancelamento_id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13px]"
                  >
                    <span className="text-parchment">
                      Mesa {mesaLabel(cancelamento.mesa_id)} · {cancelamento.quantidade}x{" "}
                      {cancelamento.nome}
                    </span>
                    <span className="text-muted">
                      {hora(cancelamento.autorizado_em)} · autorizado por{" "}
                      {cancelamento.autorizado_por_nome}
                    </span>
                    <span className="text-ember vh-tabular ml-auto">
                      {moneyCentavos(cancelamento.valorCentavos)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
