// Fila de producao: cozinha e bar recebem fichas separadas, com mesa, pessoa e garcom.
// Tipografia grande porque a tela fica longe de quem opera. A producao nao ve valores.

import { useState } from "react";
import { Beer, Check, ChefHat, Flame, RotateCcw } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { DemoTag, SectionHeading, StatusPill } from "../components/ui/pieces";
import { useAcaoUnica } from "../lib/hooks";
import {
  desde,
  destinoLabel,
  hora,
  mesaLabel,
  ticketStatusColor,
  ticketStatusLabel,
} from "../lib/format";
import type { CSSProperties } from "react";
import type { Destino, Ticket, TicketStatus } from "../lib/types";

/** Acao principal de cada estado. "pronto" e "entregue" saem da mao da producao. */
const avanco: Record<TicketStatus, { texto: string; icone: typeof Check } | null> = {
  enviado: { texto: "Iniciar preparo", icone: Flame },
  preparando: { texto: "Marcar pronto", icone: Check },
  pronto: null,
  entregue: null,
};

function CartaoFicha({
  ficha,
  onAvancar,
  onVoltar,
}: {
  ficha: Ticket;
  onAvancar: (ticket_id: string) => void;
  onVoltar: (ticket_id: string) => void;
}) {
  const cor = ticketStatusColor[ficha.status];
  const acao = avanco[ficha.status];
  const podeVoltar = ficha.status === "preparando" || ficha.status === "pronto";
  // Um avanco de estado por clique: o duplo clique nao pula "preparando" direto para "pronto".
  const passo = useAcaoUnica();

  return (
    <li
      className="vh-edge bg-surface border-line flex flex-col rounded-md border"
      style={{ "--vh-edge-color": cor } as CSSProperties}
      data-testid={`ficha-${ficha.ticket_id}`}
    >
      <div className="border-line flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-muted text-[12px] tracking-[0.22em] uppercase">Mesa</p>
          <p className="font-display vh-tabular text-parchment text-[30px] leading-none tracking-[0.02em]">
            {mesaLabel(ficha.mesa_id)}
          </p>
          <p className="text-muted mt-1.5 truncate text-[12px]">
            {ficha.funcionario_nome} · enviado {hora(ficha.enviado_em)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill
            label={ticketStatusLabel[ficha.status]}
            color={cor}
            strong
            pulse={ficha.status === "preparando"}
          />
          <p className="text-muted vh-tabular text-[12px] tracking-[0.1em] uppercase">
            {desde(ficha.enviado_em)}
          </p>
        </div>
      </div>

      <ul className="flex-1 px-4 py-3">
        {ficha.linhas.map((linha) => (
          <li key={linha.item_id} className="py-1">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display vh-tabular text-gold text-[15px]">{linha.qty}×</span>
              <span className="text-parchment min-w-0 flex-1 text-[15px] leading-snug">
                {linha.name}
              </span>
              {linha.pessoa ? (
                <span className="text-muted shrink-0 text-[12px] tracking-[0.08em] uppercase">
                  {linha.pessoa}
                </span>
              ) : null}
            </div>
            {linha.observacao ? (
              <p className="text-gold mt-0.5 pl-7 text-[13px] leading-snug">
                Obs.: {linha.observacao}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {acao ? (
          <Action
            variante="primaria"
            full
            onClick={() => passo.executar(() => onAvancar(ficha.ticket_id))}
            disabled={passo.processando}
            aria-disabled={passo.processando}
            data-testid={`avancar-${ficha.ticket_id}`}
          >
            <acao.icone className="size-4" />
            {passo.processando ? "Registrando…" : acao.texto}
          </Action>
        ) : (
          <p className="text-muted w-full text-[13px] leading-snug">
            {ficha.status === "pronto"
              ? "Aguardando o garçom retirar e confirmar a entrega na mesa."
              : "Entregue na mesa pelo garçom."}
          </p>
        )}
        {podeVoltar ? (
          <Action
            variante="fantasma"
            full
            onClick={() => passo.executar(() => onVoltar(ficha.ticket_id))}
            disabled={passo.processando}
            aria-disabled={passo.processando}
            data-testid={`voltar-${ficha.ticket_id}`}
          >
            <RotateCcw className="size-4" />
            {ficha.status === "pronto" ? "Voltar para preparo" : "Voltar para a fila"}
          </Action>
        ) : null}
      </div>
    </li>
  );
}

function Coluna({
  destino,
  fichas,
  onAvancar,
  onVoltar,
}: {
  destino: Destino;
  fichas: Ticket[];
  onAvancar: (ticket_id: string) => void;
  onVoltar: (ticket_id: string) => void;
}) {
  const Icone = destino === "bar" ? Beer : ChefHat;
  const abertas = fichas.filter((f) => f.status === "enviado" || f.status === "preparando").length;

  return (
    <section className="min-w-0">
      <div className="border-line mb-3 flex items-center gap-3 border-b pb-2.5">
        <span
          className="border-line bg-surface-2 text-gold grid size-10 shrink-0 place-items-center rounded-md border"
          aria-hidden="true"
        >
          <Icone className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-parchment text-[17px] tracking-[0.08em]">{destinoLabel[destino]}</h2>
          <p className="text-muted text-[12px]">
            {fichas.length} {fichas.length === 1 ? "ficha" : "fichas"} · {abertas} em aberto
          </p>
        </div>
      </div>

      {fichas.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {fichas.map((ficha) => (
            <CartaoFicha
              key={ficha.ticket_id}
              ficha={ficha}
              onAvancar={onAvancar}
              onVoltar={onVoltar}
            />
          ))}
        </ul>
      ) : (
        <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
          Nenhuma ficha na fila do {destinoLabel[destino].toLowerCase()}.
        </div>
      )}
    </section>
  );
}

export default function ProducaoPage() {
  const { tickets, avancarTicket, voltarTicket } = useComanda();
  const [somenteAbertas, setSomenteAbertas] = useState(false);

  const lista = somenteAbertas
    ? tickets.filter((f) => f.status === "enviado" || f.status === "preparando")
    : tickets;
  const cozinha = lista.filter((f) => f.destino_producao === "cozinha");
  const bar = lista.filter((f) => f.destino_producao === "bar");

  return (
    <AppShell
      titulo="Cozinha e bar"
      subtitulo="Cada ponto de produção vê somente as fichas que são dele"
    >
      <SectionHeading
        eyebrow="Produção"
        title="Fila de fichas"
        hint="O pedido enviado na comanda cai aqui na hora, separado por destino, com mesa e pessoa."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DemoTag>Dados sincronizados</DemoTag>
            <Action
              variante={somenteAbertas ? "primaria" : "secundaria"}
              onClick={() => setSomenteAbertas((v) => !v)}
              aria-pressed={somenteAbertas}
              data-testid="filtro-abertas"
            >
              {somenteAbertas ? "Mostrando em aberto" : "Só em aberto"}
            </Action>
          </div>
        }
      />

      <div className="grid gap-7 xl:grid-cols-2 xl:gap-6">
        <Coluna
          destino="cozinha"
          fichas={cozinha}
          onAvancar={avancarTicket}
          onVoltar={voltarTicket}
        />
        <Coluna destino="bar" fichas={bar} onAvancar={avancarTicket} onVoltar={voltarTicket} />
      </div>
    </AppShell>
  );
}
