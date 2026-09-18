// Caixa: fila de mesas que pediram a conta, divisao por pessoa, controle da taxa de servico
// e encerramento. Só o caixa encerra pagamento e só aqui a taxa de servico pode ser retirada.

import { useState } from "react";
import { useLocation } from "wouter";
import { Clock, Percent, ReceiptText, Users, Wallet } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { CheckoutSheet } from "../components/checkout-sheet";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { DemoTag, Metric, SectionHeading, StatusPill } from "../components/ui/pieces";
import { TAXA_SERVICO } from "../lib/demo-data";
import { desde, mesaLabel, mesaStatusColor, mesaStatusLabel, money } from "../lib/format";
import type { CSSProperties } from "react";
import type { Mesa } from "../lib/types";

export default function CaixaPage() {
  const [, navegar] = useLocation();
  const { mesas, filaCaixa, pessoasDaMesa, resumo, fechamentos, notificar, registrarEvento } =
    useComanda();
  const [mesaAberta, setMesaAberta] = useState<number | null>(null);

  const abertas = mesas.filter((mesa) => mesa.ativa && !mesa.contaSolicitada);
  const totalFila = filaCaixa.reduce(
    (soma, mesa) => soma + (mesa.ativa ? resumo(mesa.mesa_id).total : mesa.totalFixo),
    0,
  );
  const recebido = fechamentos.reduce((soma, registro) => soma + registro.total, 0);

  function abrirFechamento(mesa: Mesa) {
    if (!mesa.ativa) {
      notificar(
        `Mesa ${mesaLabel(mesa.mesa_id)} é uma mesa de apoio desta demonstração: ela não tem comanda detalhada para dividir.`,
        "atencao",
      );
      return;
    }
    registrarEvento("caixa-dividiu");
    setMesaAberta(mesa.mesa_id);
  }

  function CartaoConta({ mesa, naFila }: { mesa: Mesa; naFila: boolean }) {
    const conta = resumo(mesa.mesa_id);
    const pessoas = mesa.ativa ? pessoasDaMesa(mesa.mesa_id).length : mesa.pessoasFixas;
    const total = mesa.ativa ? conta.total : mesa.totalFixo;
    const cor = naFila ? mesaStatusColor.aguardando : mesaStatusColor.ocupada;

    return (
      <li
        className="vh-edge bg-surface border-line rounded-md border"
        style={{ "--vh-edge-color": cor } as CSSProperties}
        data-testid={`conta-${mesa.mesa_id}`}
      >
        <div className="border-line flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-muted text-[12px] tracking-[0.22em] uppercase">Mesa</p>
            <p className="font-display vh-tabular text-parchment text-[32px] leading-none tracking-[0.02em]">
              {mesaLabel(mesa.mesa_id)}
            </p>
          </div>
          <StatusPill
            label={naFila ? "Pediu a conta" : mesaStatusLabel[mesa.status]}
            color={cor}
            strong={naFila}
            pulse={naFila}
          />
          <p className="font-display vh-tabular text-gold-bright w-full text-right text-[22px] tracking-[0.03em] sm:w-auto">
            {money(total)}
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
              aberta há {desde(mesa.abertaEm)}
            </span>
            {mesa.ativa ? (
              <span className="vh-tabular">
                {conta.itens} {conta.itens === 1 ? "item" : "itens"}
              </span>
            ) : (
              <span>mesa de apoio · sem comanda detalhada</span>
            )}
          </p>

          {mesa.ativa ? (
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
          ) : null}

          {mesa.ativa && conta.novos ? (
            <p className="text-gold mt-3 text-[12px] leading-snug">
              {conta.novos} {conta.novos === 1 ? "item ainda não foi" : "itens ainda não foram"} para
              a produção. Confirme com o garçom antes de encerrar.
            </p>
          ) : null}

          <div className="mt-3.5 flex flex-wrap gap-2">
            <Action
              variante={naFila ? "primaria" : "secundaria"}
              onClick={() => abrirFechamento(mesa)}
              data-testid={`dividir-${mesa.mesa_id}`}
            >
              <Wallet className="size-4" />
              Dividir e encerrar
            </Action>
            <Action variante="fantasma" onClick={() => navegar(`/mesa/${mesa.mesa_id}`)}>
              Ver comanda
            </Action>
          </div>
        </div>
      </li>
    );
  }

  return (
    <AppShell titulo="Caixa" subtitulo="Divisão por pessoa, taxa de serviço e encerramento">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <DemoTag>Dados sincronizados</DemoTag>
        <DemoTag>Integração fiscal prevista</DemoTag>
      </div>

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
          <Metric label="Mesas em consumo" value={String(abertas.length)} />
        </div>
        <div>
          <Metric label="Fechado na sessão" value={money(recebido)} />
        </div>
      </section>

      <SectionHeading
        eyebrow="Fila de fechamento"
        title="Mesas que pediram a conta"
        hint="O garçom solicita o fechamento e a mesa cai aqui. A conta é sempre dividida por pessoa."
        action={
          <Action variante="fantasma" onClick={() => navegar("/fechamentos")}>
            <ReceiptText className="size-4" />
            Fechamentos
          </Action>
        }
      />

      {filaCaixa.length ? (
        <ul className="grid gap-3 xl:grid-cols-2">
          {filaCaixa.map((mesa) => (
            <CartaoConta key={mesa.mesa_id} mesa={mesa} naFila />
          ))}
        </ul>
      ) : (
        <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
          Nenhuma mesa na fila. Quando o garçom solicitar o fechamento, a mesa aparece aqui.
        </div>
      )}

      <SectionHeading
        eyebrow="Salão"
        title="Mesas em consumo"
        hint="O caixa também pode encerrar direto, sem esperar o pedido do garçom."
      />

      {abertas.length ? (
        <ul className="grid gap-3 xl:grid-cols-2">
          {abertas.map((mesa) => (
            <CartaoConta key={mesa.mesa_id} mesa={mesa} naFila={false} />
          ))}
        </ul>
      ) : (
        <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
          Nenhuma mesa em consumo neste momento.
        </div>
      )}

      <p className="text-muted mt-6 text-[12px] leading-relaxed">
        A forma de pagamento continua na maquininha de hoje: o sistema mostra quanto cada pessoa
        deve e o caixa marca quem já pagou. A notinha é apenas um resumo sem valor fiscal.
      </p>

      {mesaAberta !== null ? (
        <CheckoutSheet open onClose={() => setMesaAberta(null)} mesa_id={mesaAberta} />
      ) : null}
    </AppShell>
  );
}
