// Registro persistido de fechamentos e liberações sem consumo da organização autenticada.

import { useLocation } from "wouter";
import { DoorClosed, FileCheck2, ReceiptText } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { Metric, SectionHeading, StatusPill } from "../components/ui/pieces";
import {
  duracao,
  hora,
  mesaLabel,
  money,
  motivoSemConsumoLabel,
  perfilNome,
} from "../lib/format";

export default function FechamentosPage() {
  const [, navegar] = useLocation();
  const { fechamentos, encerramentosSemConsumo } = useComanda();

  const somaTotal = fechamentos.reduce((soma, f) => soma + f.total, 0);
  const somaServico = fechamentos.reduce((soma, f) => soma + f.servico, 0);

  return (
    <AppShell titulo="Fechamentos" subtitulo="Contas fechadas nesta operação">
      <SectionHeading
        eyebrow="Caixa"
        title="Contas fechadas"
        hint="Histórico persistido da organização, com divisão por pessoa e valores registrados."
      />

      {fechamentos.length ? (
        <>
          <section className="border-line bg-surface mb-6 grid grid-cols-2 overflow-hidden rounded-md border sm:grid-cols-3">
            <div className="border-line border-r">
              <Metric label="Contas fechadas" value={String(fechamentos.length)} />
            </div>
            <div className="sm:border-line sm:border-r">
              <Metric label="Total recebido" value={money(somaTotal)} />
            </div>
            <div className="border-line col-span-2 border-t sm:col-span-1 sm:border-t-0">
              <Metric label="Serviço no período" value={money(somaServico)} />
            </div>
          </section>

          <ul className="grid gap-3">
            {fechamentos.map((registro) => (
              <li
                key={registro.fechamento_id}
                className="border-line bg-surface rounded-md border"
                data-testid={`fechamento-${registro.fechamento_id}`}
              >
                <div className="border-line flex flex-wrap items-center gap-3 border-b px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="border-line bg-surface-2 text-gold grid size-10 shrink-0 place-items-center rounded-md border"
                      aria-hidden="true"
                    >
                      <ReceiptText className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-parchment text-[15px] tracking-[0.06em] uppercase">
                        Mesa {mesaLabel(registro.mesa_id)}
                      </p>
                      <p className="text-muted text-[12px]">
                        Fechada às {registro.hora} no caixa por {registro.funcionario_nome}
                        {registro.garcom_nome ? ` · atendida por ${registro.garcom_nome}` : ""}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    label="Recibo operacional"
                    color="var(--vh-bronze)"
                  />
                  <p className="font-display vh-tabular text-gold-bright text-[22px] tracking-[0.03em]">
                    {money(registro.total)}
                  </p>
                </div>

                <div className="grid gap-4 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="font-display text-muted mb-2 text-[12px] tracking-[0.2em] uppercase">
                      Divisão paga
                    </p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {registro.divisao.map((linha) => (
                        <li
                          key={`${registro.fechamento_id}-${linha.pessoa_id}`}
                          className="flex items-baseline justify-between gap-3 sm:max-w-[220px]"
                        >
                          <span className="text-parchment truncate text-[13px]">
                            {linha.pessoa}
                          </span>
                          <span className="vh-tabular text-muted text-[13px]">
                            {money(linha.valor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <dl className="text-muted grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[12px] sm:min-w-[180px]">
                    <dt>Consumo</dt>
                    <dd className="vh-tabular text-right">{money(registro.subtotal)}</dd>
                    <dt>Serviço</dt>
                    <dd className="vh-tabular text-right">
                      {registro.servicoIncluso ? money(registro.servico) : "retirado"}
                    </dd>
                    <dt className="text-parchment">Total</dt>
                    <dd className="vh-tabular text-parchment text-right">{money(registro.total)}</dd>
                  </dl>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-muted mt-5 text-[12px] leading-relaxed">
            Os fechamentos e seus valores permanecem registrados para a organização autenticada.
          </p>
        </>
      ) : encerramentosSemConsumo.length ? null : (
        <section className="border-line bg-surface vh-grain relative overflow-hidden rounded-lg border p-6 text-center sm:p-10">
          <span
            className="border-line bg-surface-2 text-gold mx-auto mb-4 grid size-12 place-items-center rounded-md border"
            aria-hidden="true"
          >
            <FileCheck2 className="size-5" />
          </span>
          <h2 className="text-parchment text-[24px] leading-tight sm:text-[28px]">
            Nenhuma conta fechada ainda
          </h2>
          <p className="text-muted mx-auto mt-3 max-w-md text-[13px] leading-relaxed">
            O garçom solicita o fechamento na comanda e o caixa divide a conta por pessoa. O
            registro aparece aqui com a divisão de cada um.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Action variante="primaria" onClick={() => navegar("/caixa")}>
              Ir para o caixa
            </Action>
          </div>
        </section>
      )}

      {/* Mesas liberadas sem consumo: auditoria, nao fechamento. Nenhum valor foi cobrado. */}
      {encerramentosSemConsumo.length ? (
        <section className="mt-8" data-testid="auditoria-sem-consumo">
          <SectionHeading
            eyebrow="Auditoria"
            title="Mesas liberadas sem consumo"
            hint="Ocorrências sem cobrança, pagamento ou documento fiscal. Não entram no faturamento."
            action={<span className="font-display text-muted text-[13px]">{encerramentosSemConsumo.length}</span>}
          />
          <ul className="grid gap-2">
            {encerramentosSemConsumo.map((registro) => (
              <li
                key={registro.encerramento_id}
                className="border-line bg-surface flex flex-wrap items-center gap-3 rounded-md border px-4 py-3"
                data-testid={`sem-consumo-${registro.mesa_id}`}
              >
                <span
                  className="border-line bg-surface-2 text-gold grid size-10 shrink-0 place-items-center rounded-md border"
                  aria-hidden="true"
                >
                  <DoorClosed className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-parchment text-[15px] tracking-[0.06em] uppercase">
                    Mesa {mesaLabel(registro.mesa_id)}
                  </p>
                  <p className="text-muted text-[12px] leading-relaxed">
                    {motivoSemConsumoLabel[registro.motivo]}
                    {registro.observacao ? ` · ${registro.observacao}` : ""} · liberada às{" "}
                    {hora(registro.encerrada_em)} por {registro.funcionario_nome} (
                    {perfilNome[registro.funcionario_perfil]}) · mesa aberta por{" "}
                    {duracao(Math.round(registro.duracao_segundos / 60))}
                    {registro.rascunhos_descartados
                      ? ` · ${registro.rascunhos_descartados} ${
                          registro.rascunhos_descartados === 1
                            ? "rascunho descartado"
                            : "rascunhos descartados"
                        }`
                      : ""}
                  </p>
                </div>
                <StatusPill
                  label={registro.desfeito_em ? "Desfeito" : "Sem cobrança"}
                  color={registro.desfeito_em ? "var(--vh-muted)" : "var(--vh-moss)"}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
