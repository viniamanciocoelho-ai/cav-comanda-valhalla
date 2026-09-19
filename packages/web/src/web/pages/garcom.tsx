// Tela do garcom no celular: as mesas do turno, o que esta pronto para levar na mesa
// e o atalho para abrir uma mesa livre. Sem faturamento do salao e sem fechamento de conta.

import { useLocation } from "wouter";
import { ArrowRight, BellRing, Check, Clock, DoorOpen, Send, Users } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { Metric, SectionHeading, StatusPill } from "../components/ui/pieces";
import {
  desde,
  destinoLabel,
  itemStatusColor,
  itemStatusLabel,
  mesaLabel,
  mesaStatusColor,
  mesaStatusLabel,
  money,
} from "../lib/format";
import { useAcaoUnica } from "../lib/hooks";
import type { CSSProperties } from "react";

/**
 * Botao de entrega com trava propria: cada linha da lista tem a sua, portanto um duplo
 * clique rapido registra a entrega uma unica vez, sem travar as outras linhas.
 */
function BotaoEntregar({ item_id, aoEntregar }: { item_id: string; aoEntregar: () => void }) {
  const entrega = useAcaoUnica();
  return (
    <Action
      variante="primaria"
      onClick={() => entrega.executar(aoEntregar)}
      disabled={entrega.processando}
      aria-disabled={entrega.processando}
      data-testid={`entregar-${item_id}`}
    >
      <Check className="size-4" />
      {entrega.processando ? "Registrando…" : "Entreguei"}
    </Action>
  );
}

export default function GarcomPage() {
  const [, navegar] = useLocation();
  const {
    perfilAtivo,
    funcionarioAtivo,
    mesas,
    mesasDoGarcom,
    pessoasDaMesa,
    itens,
    resumo,
    nomeDaPessoa,
    marcarEntregue,
    abrirMesa,
    notificar,
  } = useComanda();

  // A gerencia enxerga o salao inteiro; o garcom, apenas as mesas do turno dele e as livres.
  const doTurno = mesasDoGarcom(funcionarioAtivo.funcionario_id);
  const base = perfilAtivo === "gerencia" ? mesas : doTurno;
  const minhas = base.filter((mesa) => mesa.ativa);
  const livres = base.filter((mesa) => mesa.status === "livre");

  const meusIds = minhas.map((mesa) => mesa.mesa_id);
  const prontos = itens.filter(
    (item) => item.status === "pronto" && meusIds.includes(item.mesa_id),
  );
  const naoEnviados = minhas.reduce((soma, mesa) => soma + resumo(mesa.mesa_id).novos, 0);
  const pedindoConta = minhas.filter((mesa) => mesa.contaSolicitada).length;

  function abrir(mesa_id: number) {
    abrirMesa(mesa_id);
    notificar(`Mesa ${mesaLabel(mesa_id)} aberta. Adicione as pessoas da mesa.`, "sucesso");
    navegar(`/mesa/${mesa_id}`);
  }

  return (
    <AppShell
      titulo="Minhas mesas"
      subtitulo={`${funcionarioAtivo.funcionario_nome}${funcionarioAtivo.turno ? ` · ${funcionarioAtivo.turno}` : ""}`}
    >
      {/* Indicadores da operação do garçom: nada de faturamento do salão. */}
      <section className="border-line bg-surface mb-7 grid grid-cols-2 divide-y divide-[var(--vh-border)] overflow-hidden rounded-md border sm:grid-cols-4 sm:divide-y-0">
        <div className="border-line border-r">
          <Metric label="Mesas abertas" value={String(minhas.length)} />
        </div>
        <div className="sm:border-line sm:border-r">
          <Metric
            label="Prontos p/ levar"
            value={String(prontos.length)}
            accent={prontos.length ? "var(--vh-moss)" : undefined}
          />
        </div>
        <div className="border-line border-r">
          <Metric
            label="Não enviados"
            value={String(naoEnviados)}
            accent={naoEnviados ? "var(--vh-ember)" : undefined}
          />
        </div>
        <div>
          <Metric
            label="Pedindo a conta"
            value={String(pedindoConta)}
            accent={pedindoConta ? "var(--vh-blood)" : undefined}
          />
        </div>
      </section>

      {/* Fila de retirada: o item que a produção marcou como pronto. */}
      <SectionHeading
        eyebrow="Retirada"
        title="Prontos para levar na mesa"
        hint="A cozinha e o bar marcam o item como pronto. Você confirma a entrega depois de levar."
      />

      {prontos.length ? (
        <ul className="mb-8 grid gap-2">
          {prontos.map((item) => (
            <li
              key={item.item_id}
              className="vh-edge bg-surface border-line flex flex-wrap items-center gap-3 rounded-md border py-2.5 pr-2.5 pl-4"
              style={{ "--vh-edge-color": itemStatusColor.pronto } as CSSProperties}
              data-testid={`retirada-${item.item_id}`}
            >
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
                {item.observacao ? (
                  <p className="text-gold mt-1 text-[12px] leading-snug">Obs.: {item.observacao}</p>
                ) : null}
              </div>
              <StatusPill label={itemStatusLabel.pronto} color={itemStatusColor.pronto} strong />
              <div className="flex flex-wrap gap-2">
                <BotaoEntregar
                  item_id={item.item_id}
                  aoEntregar={() => {
                    marcarEntregue(item.item_id);
                    notificar(
                      `${item.name} entregue na Mesa ${mesaLabel(item.mesa_id)}.`,
                      "sucesso",
                    );
                  }}
                />
                <Action onClick={() => navegar(`/mesa/${item.mesa_id}`)}>Abrir comanda</Action>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-line text-muted mb-8 rounded-md border border-dashed p-8 text-center text-[13px]">
          Nada pronto para retirada neste momento.
        </div>
      )}

      {/* Mesas do turno */}
      <SectionHeading
        eyebrow="Turno"
        title="Mesas abertas"
        hint="Toque na mesa para lançar item, conferir o consumo por pessoa e pedir o fechamento."
      />

      {minhas.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {minhas.map((mesa) => {
            const conta = resumo(mesa.mesa_id);
            const pessoas = pessoasDaMesa(mesa.mesa_id).length;
            const cor = mesaStatusColor[mesa.status];
            return (
              <li key={mesa.mesa_id}>
                <button
                  type="button"
                  onClick={() => navegar(`/mesa/${mesa.mesa_id}`)}
                  data-testid={`mesa-${mesa.mesa_id}`}
                  aria-label={`Abrir comanda da Mesa ${mesaLabel(mesa.mesa_id)}`}
                  className="vh-edge bg-surface border-line hover:border-gold/60 flex w-full flex-col items-start gap-3 rounded-md border p-4 text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5"
                  style={{ "--vh-edge-color": cor } as CSSProperties}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-muted text-[12px] tracking-[0.22em] uppercase">
                        Mesa
                      </p>
                      <p className="font-display vh-tabular text-parchment mt-0.5 text-[38px] leading-none tracking-[0.02em]">
                        {mesaLabel(mesa.mesa_id)}
                      </p>
                    </div>
                    <StatusPill
                      label={mesa.contaSolicitada ? "Na fila do caixa" : mesaStatusLabel[mesa.status]}
                      color={cor}
                      strong={mesa.contaSolicitada}
                    />
                  </div>

                  <p className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" aria-hidden="true" />
                      {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {desde(mesa.abertaEm)}
                    </span>
                    <span className="vh-tabular">
                      {conta.itens} {conta.itens === 1 ? "item" : "itens"}
                    </span>
                  </p>

                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {conta.novos ? (
                        <StatusPill
                          label={`${conta.novos} a enviar`}
                          color={itemStatusColor.novo}
                          strong
                        />
                      ) : null}
                      {conta.prontos ? (
                        <StatusPill
                          label={`${conta.prontos} pronto${conta.prontos === 1 ? "" : "s"}`}
                          color={itemStatusColor.pronto}
                          strong
                        />
                      ) : null}
                    </div>
                    <p className="font-display vh-tabular text-parchment text-[16px] tracking-[0.04em]">
                      {money(conta.total)}
                    </p>
                  </div>

                  <span className="font-display text-gold mt-1 inline-flex items-center gap-1.5 text-[12px] tracking-[0.14em] uppercase">
                    {conta.novos ? (
                      <>
                        <Send className="size-3.5" aria-hidden="true" />
                        Revisar e enviar
                      </>
                    ) : (
                      <>
                        Abrir comanda
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
          Nenhuma mesa aberta no seu turno. Abra uma mesa livre abaixo.
        </div>
      )}

      {/* Mesas livres: abrir comanda em branco */}
      <SectionHeading
        eyebrow="Salão"
        title="Mesas livres"
        hint="Abrir a mesa inicia uma comanda em branco: você adiciona as pessoas e lança os itens."
        action={
          <span className="text-muted inline-flex items-center gap-2 text-[12px]">
            <BellRing className="size-3.5" aria-hidden="true" />
            {livres.length} {livres.length === 1 ? "mesa livre" : "mesas livres"}
          </span>
        }
      />

      {livres.length ? (
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-5 xl:grid-cols-8">
          {livres.map((mesa) => (
            <button
              key={mesa.mesa_id}
              type="button"
              onClick={() => abrir(mesa.mesa_id)}
              data-testid={`abrir-${mesa.mesa_id}`}
              aria-label={`Abrir Mesa ${mesaLabel(mesa.mesa_id)}`}
              className="border-line bg-surface-2 text-muted hover:border-gold/60 hover:text-parchment grid min-h-[84px] place-items-center gap-1 rounded-md border border-dashed transition-colors duration-150"
            >
              <DoorOpen className="size-4" aria-hidden="true" />
              <span className="font-display vh-tabular text-[22px] leading-none">
                {mesaLabel(mesa.mesa_id)}
              </span>
              <span className="font-display text-[12px] tracking-[0.14em] uppercase">Abrir</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="border-line text-muted mt-4 rounded-md border border-dashed p-6 text-center text-[13px]">
          Nenhuma mesa livre no momento.
        </div>
      )}
    </AppShell>
  );
}
