// Visao da gerencia: o salao inteiro, os numeros do turno e os pedidos de cancelamento
// que dependem de autorizacao. Toque na mesa para abrir a comanda.

import { useLocation } from "wouter";
import { ArrowRight, Check, Clock, ShieldAlert, Undo2, Users } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { DemoTag, Metric, RuneDivider, SectionHeading, StatusPill } from "../components/ui/pieces";
import { MESA_DEMO } from "../lib/demo-data";
import {
  desde,
  destinoLabel,
  itemStatusColor,
  mesaLabel,
  mesaStatusColor,
  mesaStatusLabel,
  money,
} from "../lib/format";
import type { CSSProperties } from "react";
import type { Mesa, ResumoMesa } from "../lib/types";

function CartaoMesa({
  mesa,
  conta,
  pessoas,
  onAbrir,
}: {
  mesa: Mesa;
  conta: ResumoMesa | null;
  pessoas: number;
  onAbrir: (mesa: Mesa) => void;
}) {
  const cor = mesaStatusColor[mesa.status];
  const total = conta ? conta.total : mesa.totalFixo;
  const destaque = mesa.demonstracao;

  return (
    <button
      type="button"
      onClick={() => onAbrir(mesa)}
      data-testid={`mesa-${mesa.mesa_id}`}
      aria-label={`Mesa ${mesaLabel(mesa.mesa_id)} — ${mesaStatusLabel[mesa.status]}`}
      className={`vh-edge group bg-surface relative flex min-h-[148px] min-w-0 flex-col items-start gap-2 rounded-md border p-4 text-left transition-[border-color,transform,background-color] duration-150 hover:-translate-y-0.5 ${
        destaque ? "border-gold/60 bg-surface-2" : "border-line hover:border-bronze/70"
      }`}
      style={{ "--vh-edge-color": cor } as CSSProperties}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div>
          <p className="font-display text-muted text-[12px] tracking-[0.22em] uppercase">Mesa</p>
          <p
            className="font-display vh-tabular mt-0.5 text-[40px] leading-none tracking-[0.02em]"
            style={{ color: mesa.status === "livre" ? "var(--vh-muted)" : "var(--vh-text)" }}
          >
            {mesaLabel(mesa.mesa_id)}
          </p>
        </div>
        <span
          className="mt-1 size-2 shrink-0 rounded-full"
          style={{ background: cor }}
          aria-hidden="true"
        />
      </div>

      <p className="font-display text-[12px] tracking-[0.14em] uppercase" style={{ color: cor }}>
        {mesa.contaSolicitada ? "Pediu a conta" : mesaStatusLabel[mesa.status]}
      </p>

      <div className="mt-auto w-full">
        {mesa.status === "livre" ? (
          <p className="text-muted text-[12px]">Pronta para abrir</p>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <p className="text-muted flex min-w-0 flex-col gap-1 text-[12px]">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden="true" />
                {desde(mesa.abertaEm)}
              </span>
            </p>
            <p className="font-display vh-tabular text-parchment text-[15px] tracking-[0.04em]">
              {money(total)}
            </p>
          </div>
        )}
        {destaque ? <DemoTag className="mt-3">Mesa do roteiro</DemoTag> : null}
        {!mesa.ativa && mesa.status !== "livre" ? (
          <p className="text-muted mt-2 text-[12px]">Mesa de apoio · sem comanda detalhada</p>
        ) : null}
      </div>
    </button>
  );
}

export default function SalaoPage() {
  const [, navegar] = useLocation();
  const {
    mesas,
    resumo,
    pessoasDaMesa,
    filaAberta,
    prontosParaEntrega,
    contasEmAberto,
    cancelamentosPendentes,
    quantidadeMesas,
    filaCaixa,
    nomeDaPessoa,
    autorizarCancelamento,
    recusarCancelamento,
    notificar,
  } = useComanda();

  const ocupadas = mesas.filter((mesa) => mesa.status !== "livre").length;
  const mesaDemo = mesas.find((mesa) => mesa.mesa_id === MESA_DEMO);
  const contaDemo = mesaDemo?.ativa ? resumo(MESA_DEMO) : null;

  function abrir(mesa: Mesa) {
    if (!mesa.ativa && mesa.status !== "livre") {
      notificar(
        `Mesa ${mesaLabel(mesa.mesa_id)} é uma mesa de apoio desta demonstração: ela aparece no salão, mas não tem comanda detalhada.`,
        "info",
      );
      return;
    }
    navegar(`/mesa/${mesa.mesa_id}`);
  }

  return (
    <AppShell titulo="Visão do salão" subtitulo="Toque em uma mesa para abrir a comanda">
      {/* Painel de abertura: impacto visual sem deixar de ser leitura operacional. */}
      <section className="vh-wood vh-grain vh-brackets border-line relative mb-6 overflow-hidden rounded-lg border">
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="font-display text-gold text-[12px] tracking-[0.28em] uppercase">
              Valhalla Choperia · Três Lagoas
            </p>
            <h2 className="text-parchment mt-3 max-w-[15ch] text-[34px] leading-[0.95] tracking-[0.02em] sm:text-[44px] lg:text-[52px]">
              Comanda por mesa
              <span className="text-gold-bright"> e por pessoa</span>
            </h2>
            <RuneDivider className="mt-4 max-w-sm" />
            <p className="text-muted mt-4 max-w-lg text-[13px] leading-relaxed">
              Cada pessoa da mesa tem o consumo separado, os itens compartilhados são rateados e o
              pedido segue direto para cozinha e bar. Sem papel, sem soma de cabeça na hora de
              fechar.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <DemoTag>Dados sincronizados</DemoTag>
              <DemoTag>Cardápio provisório</DemoTag>
              <DemoTag>Integração fiscal prevista</DemoTag>
            </div>
          </div>

          <div className="lg:w-[260px]">
            <div className="border-line bg-void/70 rounded-md border p-4">
              <p className="font-display text-muted text-[12px] tracking-[0.2em] uppercase">
                Mesa do roteiro
              </p>
              <p className="font-display text-parchment mt-1 text-[26px] leading-none tracking-[0.04em]">
                MESA {mesaLabel(MESA_DEMO)}
              </p>
              <p className="text-muted mt-2 text-[12px]">
                {contaDemo
                  ? `${pessoasDaMesa(MESA_DEMO).length} pessoas · ${desde(mesaDemo?.abertaEm ?? null)} · ${contaDemo.itens} itens`
                  : "Conta encerrada nesta demonstração."}
              </p>
              <Action
                variante="primaria"
                full
                className="mt-4"
                onClick={() => navegar(`/mesa/${MESA_DEMO}`)}
                data-testid="abrir-mesa-08"
              >
                Abrir comanda
                <ArrowRight className="size-4" />
              </Action>
            </div>
          </div>
        </div>
      </section>

      {/* Indicadores da operação */}
      <section className="border-line bg-surface mb-7 grid grid-cols-2 divide-y divide-[var(--vh-border)] overflow-hidden rounded-md border sm:grid-cols-4 sm:divide-y-0">
        <div className="border-line border-r">
          <Metric label="Mesas ocupadas" value={String(ocupadas)} sub={`/ ${mesas.length}`} />
        </div>
        <div className="sm:border-line sm:border-r">
          <Metric label="Contas em aberto" value={money(contasEmAberto)} />
        </div>
        <div className="border-line border-r">
          <Metric
            label="Fichas na produção"
            value={String(filaAberta)}
            accent={filaAberta ? "var(--vh-gold-bright)" : undefined}
          />
        </div>
        <div>
          <Metric
            label="Prontos p/ entrega"
            value={String(prontosParaEntrega)}
            accent={prontosParaEntrega ? "var(--vh-moss)" : undefined}
          />
        </div>
      </section>

      {/* Autorizacao de cancelamento: o garcom pede, a gerencia decide. */}
      {cancelamentosPendentes.length ? (
        <section className="mb-7">
          <SectionHeading
            eyebrow="Autorização da gerência"
            title={`${cancelamentosPendentes.length} ${cancelamentosPendentes.length === 1 ? "pedido de cancelamento" : "pedidos de cancelamento"}`}
            hint="O item continua na conta até a gerência decidir. Nada sai da comanda sem autorização."
          />
          <ul className="grid gap-2">
            {cancelamentosPendentes.map((item) => (
              <li
                key={item.item_id}
                className="vh-edge bg-surface border-line flex flex-wrap items-center gap-3 rounded-md border py-2.5 pr-2.5 pl-4"
                style={
                  { "--vh-edge-color": itemStatusColor.cancelamento_solicitado } as CSSProperties
                }
                data-testid={`cancelamento-${item.item_id}`}
              >
                <span
                  className="border-line bg-surface-2 grid size-10 shrink-0 place-items-center rounded-md border"
                  style={{ color: itemStatusColor.cancelamento_solicitado }}
                  aria-hidden="true"
                >
                  <ShieldAlert className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-parchment text-[14px]">
                    <span className="font-display vh-tabular text-gold mr-1.5">
                      {item.quantidade}×
                    </span>
                    {item.name}
                  </p>
                  <p className="text-muted mt-0.5 text-[12px] tracking-[0.06em] uppercase">
                    Mesa {mesaLabel(item.mesa_id)} · {nomeDaPessoa(item.pessoa_id)} ·{" "}
                    {destinoLabel[item.destino_producao]}
                  </p>
                  <p className="text-muted mt-0.5 text-[12px]">
                    Pedido por {item.funcionario_nome} · {money(item.price * item.quantidade)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Action
                    variante="primaria"
                    onClick={() => {
                      autorizarCancelamento(item.item_id);
                      notificar(`${item.name} cancelado e retirado da conta.`, "sucesso");
                    }}
                    data-testid={`autorizar-${item.item_id}`}
                  >
                    <Check className="size-4" />
                    Autorizar
                  </Action>
                  <Action
                    onClick={() => {
                      recusarCancelamento(item.item_id);
                      notificar(`${item.name} mantido na conta.`, "info");
                    }}
                    data-testid={`manter-${item.item_id}`}
                  >
                    <Undo2 className="size-4" />
                    Manter
                  </Action>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SectionHeading
        eyebrow="Salão"
        title="Mesas"
        hint={`${quantidadeMesas} mesas configuradas para a operação.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {(["livre", "ocupada", "aguardando"] as const).map((estado) => (
              <StatusPill
                key={estado}
                label={mesaStatusLabel[estado]}
                color={mesaStatusColor[estado]}
              />
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {mesas.map((mesa) => (
          <CartaoMesa
            key={mesa.mesa_id}
            mesa={mesa}
            conta={mesa.ativa ? resumo(mesa.mesa_id) : null}
            pessoas={mesa.ativa ? pessoasDaMesa(mesa.mesa_id).length : mesa.pessoasFixas}
            onAbrir={abrir}
          />
        ))}
      </div>

      {filaCaixa.length ? (
        <p className="text-muted mt-5 text-[12px] leading-relaxed">
          {filaCaixa.length}{" "}
          {filaCaixa.length === 1
            ? "mesa está na fila do caixa aguardando o fechamento."
            : "mesas estão na fila do caixa aguardando o fechamento."}{" "}
          O pagamento é sempre encerrado no caixa.
        </p>
      ) : null}
    </AppShell>
  );
}
