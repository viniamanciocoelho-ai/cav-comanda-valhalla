// Caixa: fila compartilhada de mesas e balcões, divisão por pessoa, taxa de serviço
// e encerramento. Só o caixa encerra pagamento e altera a taxa de serviço.

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Clock, Percent, ReceiptText, Users, Wallet } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { CheckoutSheet } from "../components/checkout-sheet";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { Metric, SectionHeading, StatusPill } from "../components/ui/pieces";
import { TAXA_SERVICO } from "../lib/operacao";
import {
  desde,
  localLabel,
  mesaStatusColor,
  mesaStatusLabel,
  money,
} from "../lib/format";
import type { CSSProperties } from "react";
import type { LocalAtendimento } from "../lib/types";

export default function CaixaPage() {
  const [, navegar] = useLocation();
  const {
    mesas,
    balcoes,
    filaCaixa,
    pessoasDoAtendimento,
    resumoAtendimento,
    fechamentos,
    notificar,
  } = useComanda();
  const [atendimentoAberto, setAtendimentoAberto] = useState<string | null>(null);

  const locais = useMemo<LocalAtendimento[]>(
    () => [
      ...mesas.flatMap((mesa) =>
        mesa.atendimento_id
          ? [
              {
                organizacao_id: mesa.organizacao_id,
                atendimento_id: mesa.atendimento_id,
                mesa_id: mesa.mesa_id,
                balcao_id: null,
                status: mesa.status,
                ativa: mesa.ativa,
                abertaEm: mesa.abertaEm,
                garcom_id: mesa.garcom_id,
                contaSolicitada: mesa.contaSolicitada,
                servicoIncluso: mesa.servicoIncluso,
              },
            ]
          : [],
      ),
      ...balcoes.flatMap((balcao) =>
        balcao.atendimento_id
          ? [
              {
                organizacao_id: balcao.organizacao_id,
                atendimento_id: balcao.atendimento_id,
                mesa_id: null,
                balcao_id: balcao.balcao_id,
                status: balcao.status,
                ativa: balcao.ativa,
                abertaEm: balcao.abertaEm,
                garcom_id: balcao.garcom_id,
                contaSolicitada: balcao.contaSolicitada,
                servicoIncluso: balcao.servicoIncluso,
              },
            ]
          : [],
      ),
    ],
    [balcoes, mesas],
  );
  const abertas = locais.filter((local) => local.ativa && !local.contaSolicitada);
  const totalFila = filaCaixa.reduce(
    (soma, local) => soma + resumoAtendimento(local.atendimento_id).total,
    0,
  );
  const recebido = fechamentos.reduce((soma, registro) => soma + registro.total, 0);

  function abrirFechamento(local: LocalAtendimento) {
    if (!local.ativa) {
      notificar(`${localLabel(local)} está livre.`, "atencao");
      return;
    }
    setAtendimentoAberto(local.atendimento_id);
  }

  function CartaoConta({
    local,
    naFila,
  }: {
    local: LocalAtendimento;
    naFila: boolean;
  }) {
    const conta = resumoAtendimento(local.atendimento_id);
    const pessoas = pessoasDoAtendimento(local.atendimento_id).length;
    const cor = naFila ? mesaStatusColor.aguardando : mesaStatusColor.ocupada;
    const rota =
      local.mesa_id !== null ? `/mesa/${local.mesa_id}` : `/balcao/${local.balcao_id}`;

    return (
      <li
        className="vh-edge bg-surface border-line rounded-md border"
        style={{ "--vh-edge-color": cor } as CSSProperties}
        data-testid={`conta-${local.atendimento_id}`}
      >
        <div className="border-line flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-muted text-[12px] tracking-[0.22em] uppercase">
              Atendimento
            </p>
            <p className="font-display vh-tabular text-parchment text-[27px] leading-none tracking-[0.02em]">
              {localLabel(local)}
            </p>
          </div>
          <StatusPill
            label={naFila ? "Pediu a conta" : mesaStatusLabel[local.status]}
            color={cor}
            strong={naFila}
            pulse={naFila}
          />
          <p className="font-display vh-tabular text-gold-bright w-full text-right text-[22px] tracking-[0.03em] sm:w-auto">
            {money(conta.total)}
          </p>
        </div>

        <div className="px-4 py-3">
          <p className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden="true" />
              {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden="true" />
              aberto há {desde(local.abertaEm)}
            </span>
            <span className="vh-tabular">
              {conta.itens} {conta.itens === 1 ? "item" : "itens"}
            </span>
          </p>

          <dl className="text-muted mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[12px] sm:max-w-[280px]">
            <dt>Consumo</dt>
            <dd className="vh-tabular text-right">{money(conta.subtotal)}</dd>
            <dt className="inline-flex items-center gap-1.5">
              <Percent className="size-3" aria-hidden="true" />
              Serviço {Math.round(TAXA_SERVICO * 100)}%
            </dt>
            <dd className="vh-tabular text-right">
              {conta.servicoIncluso ? money(conta.servico) : "retirado"}
            </dd>
            <dt className="text-parchment">Total</dt>
            <dd className="vh-tabular text-parchment text-right">{money(conta.total)}</dd>
          </dl>

          {conta.novos ? (
            <p className="text-gold mt-3 text-[12px] leading-snug">
              {conta.novos} {conta.novos === 1 ? "item ainda não foi" : "itens ainda não foram"}{" "}
              para a produção. Confirme com o atendimento antes de encerrar.
            </p>
          ) : null}

          <div className="mt-3.5 flex flex-wrap gap-2">
            <Action
              variante={naFila ? "primaria" : "secundaria"}
              onClick={() => abrirFechamento(local)}
              data-testid={`dividir-${local.atendimento_id}`}
            >
              <Wallet className="size-4" />
              Dividir e encerrar
            </Action>
            <Action variante="fantasma" onClick={() => navegar(rota)}>
              Ver comanda
            </Action>
          </div>
        </div>
      </li>
    );
  }

  return (
    <AppShell titulo="Caixa" subtitulo="Divisão por pessoa, taxa de serviço e encerramento">
      <section className="border-line bg-surface mb-7 grid grid-cols-2 divide-y divide-[var(--vh-border)] overflow-hidden rounded-md border sm:grid-cols-4 sm:divide-y-0">
        <div className="border-line border-r">
          <Metric
            label="Na fila"
            value={String(filaCaixa.length)}
            accent={filaCaixa.length ? "var(--vh-blood)" : undefined}
          />
        </div>
        <div className="sm:border-line sm:border-r">
          <Metric label="A receber na fila" value={money(totalFila)} />
        </div>
        <div className="border-line border-r">
          <Metric label="Em consumo" value={String(abertas.length)} />
        </div>
        <div>
          <Metric label="Fechado na sessão" value={money(recebido)} />
        </div>
      </section>

      <SectionHeading
        eyebrow="Fila de fechamento"
        title="Atendimentos que pediram a conta"
        hint="Mesas e balcões entram na mesma fila. A conta é sempre dividida por pessoa."
        action={
          <Action variante="fantasma" onClick={() => navegar("/fechamentos")}>
            <ReceiptText className="size-4" />
            Fechamentos
          </Action>
        }
      />

      {filaCaixa.length ? (
        <ul className="grid gap-3 xl:grid-cols-2">
          {filaCaixa.map((local) => (
            <CartaoConta key={local.atendimento_id} local={local} naFila />
          ))}
        </ul>
      ) : (
        <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
          Nenhum atendimento na fila.
        </div>
      )}

      <SectionHeading
        eyebrow="Operação"
        title="Atendimentos em consumo"
        hint="O caixa também pode encerrar direto, sem esperar a solicitação."
      />

      {abertas.length ? (
        <ul className="grid gap-3 xl:grid-cols-2">
          {abertas.map((local) => (
            <CartaoConta key={local.atendimento_id} local={local} naFila={false} />
          ))}
        </ul>
      ) : (
        <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
          Nenhum atendimento em consumo neste momento.
        </div>
      )}

      <p className="text-muted mt-6 text-[12px] leading-relaxed">
        A forma de pagamento continua na maquininha: o sistema mostra quanto cada pessoa deve e o
        caixa marca quem já pagou. A notinha é apenas um resumo sem valor fiscal.
      </p>

      {atendimentoAberto ? (
        <CheckoutSheet
          open
          onClose={() => setAtendimentoAberto(null)}
          atendimento_id={atendimentoAberto}
        />
      ) : null}
    </AppShell>
  );
}
