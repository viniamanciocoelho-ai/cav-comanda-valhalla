// Visao da gerencia: o salao, os indicadores do turno e os pedidos de cancelamento.

import { useLocation } from "wouter";
import { ArrowRight, Check, Clock, ShieldAlert, Undo2, Users } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { Metric, SectionHeading, StatusPill } from "../components/ui/pieces";
import {
  desde,
  destinoLabel,
  itemStatusColor,
  localLabel,
  mesaLabel,
  mesaStatusColor,
  mesaStatusLabel,
  money,
} from "../lib/format";
import type { CSSProperties } from "react";
import type { Balcao, Mesa, ResumoMesa } from "../lib/types";

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

  return (
    <button
      type="button"
      onClick={() => onAbrir(mesa)}
      data-testid={`mesa-${mesa.mesa_id}`}
      aria-label={`Mesa ${mesaLabel(mesa.mesa_id)} — ${mesaStatusLabel[mesa.status]}`}
      className="vh-edge group bg-surface border-line relative flex min-h-[148px] min-w-0 flex-col items-start gap-2 rounded-md border p-4 text-left transition-[border-color,transform,background-color] duration-150 hover:-translate-y-0.5 hover:border-bronze/70"
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
      </div>
    </button>
  );
}

function CartaoBalcao({
  balcao,
  total,
  pessoas,
  onAbrir,
}: {
  balcao: Balcao;
  total: number;
  pessoas: number;
  onAbrir: (balcao: Balcao) => void;
}) {
  const cor = mesaStatusColor[balcao.status];
  return (
    <button
      type="button"
      onClick={() => onAbrir(balcao)}
      data-testid={`balcao-${balcao.balcao_id}`}
      aria-label={`Balcão ${balcao.balcao_id} — ${mesaStatusLabel[balcao.status]}`}
      className="vh-edge group bg-surface border-line relative flex min-h-[148px] min-w-0 flex-col items-start gap-2 rounded-md border p-4 text-left transition-[border-color,transform,background-color] duration-150 hover:-translate-y-0.5 hover:border-bronze/70"
      style={{ "--vh-edge-color": cor } as CSSProperties}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div>
          <p className="font-display text-muted text-[12px] tracking-[0.22em] uppercase">Balcão</p>
          <p className="font-display vh-tabular mt-0.5 text-[40px] leading-none tracking-[0.02em]">
            {String(balcao.balcao_id).padStart(2, "0")}
          </p>
        </div>
        <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: cor }} aria-hidden="true" />
      </div>
      <p className="font-display text-[12px] tracking-[0.14em] uppercase" style={{ color: cor }}>
        {balcao.contaSolicitada ? "Pediu a conta" : mesaStatusLabel[balcao.status]}
      </p>
      <div className="mt-auto flex w-full items-end justify-between gap-2">
        <p className="text-muted text-[12px]">
          {balcao.ativa ? `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"}` : "Pronto para abrir"}
        </p>
        {balcao.ativa ? (
          <p className="font-display vh-tabular text-parchment text-[15px]">{money(total)}</p>
        ) : null}
      </div>
    </button>
  );
}

export default function SalaoPage() {
  const [, navegar] = useLocation();
  const {
    mesas,
    balcoes,
    resumo,
    resumoAtendimento,
    pessoasDaMesa,
    pessoasDoAtendimento,
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
  const proximaLocal = filaCaixa[0];
  const proximaConta = proximaLocal ? resumoAtendimento(proximaLocal.atendimento_id) : null;

  return (
    <AppShell titulo="Visão do salão" subtitulo="Acompanhe mesas, produção e solicitações do turno">
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

      <section className="border-line bg-surface mb-7 flex flex-wrap items-center justify-between gap-4 rounded-md border p-4">
        <div className="min-w-0">
          <p className="font-display text-gold text-[12px] tracking-[0.22em] uppercase">
            Próxima conta
          </p>
          <p className="text-parchment mt-1 text-[18px]">
            {proximaLocal ? localLabel(proximaLocal) : "Nenhuma conta solicitada"}
          </p>
          <p className="text-muted mt-1 text-[13px]">
            {proximaConta
              ? `${proximaConta.divisao.length} pessoas · ${money(proximaConta.total)}`
              : "As solicitações de fechamento aparecem aqui."}
          </p>
        </div>
        {proximaLocal ? (
          <Action variante="primaria" onClick={() => navegar("/caixa")}>
            Abrir caixa
            <ArrowRight className="size-4" />
          </Action>
        ) : null}
      </section>

      {cancelamentosPendentes.length ? (
        <section className="mb-7">
          <SectionHeading
            eyebrow="Autorização da gerência"
            title={`${cancelamentosPendentes.length} ${cancelamentosPendentes.length === 1 ? "pedido de cancelamento" : "pedidos de cancelamento"}`}
            hint="O item continua na conta até a gerência decidir."
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
                    {localLabel(item)} · {nomeDaPessoa(item.pessoa_id)} ·{" "}
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
            onAbrir={(atual) => navegar(`/mesa/${atual.mesa_id}`)}
          />
        ))}
      </div>

      {filaCaixa.length ? (
        <p className="text-muted mt-5 text-[12px] leading-relaxed">
          {filaCaixa.length}{" "}
          {filaCaixa.length === 1
            ? "atendimento está na fila do caixa aguardando o fechamento."
            : "atendimentos estão na fila do caixa aguardando o fechamento."}
        </p>
      ) : null}

      <SectionHeading
        eyebrow="Atendimento rápido"
        title="Balcões"
        hint="Abra uma comanda sem ocupar uma mesa. O atendimento pode permanecer no balcão ou seguir para uma mesa."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {balcoes.map((balcao) => (
          <CartaoBalcao
            key={balcao.balcao_id}
            balcao={balcao}
            total={
              balcao.atendimento_id
                ? resumoAtendimento(balcao.atendimento_id).total
                : 0
            }
            pessoas={
              balcao.atendimento_id
                ? pessoasDoAtendimento(balcao.atendimento_id).length
                : 0
            }
            onAbrir={(atual) => navegar(`/balcao/${atual.balcao_id}`)}
          />
        ))}
      </div>
    </AppShell>
  );
}
