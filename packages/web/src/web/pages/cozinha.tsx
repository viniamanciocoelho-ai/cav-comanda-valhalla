// Tela fixa da cozinha: exibe somente fichas sem valores e drena a fila local
// em ordem. O servidor continua sendo a autoridade sobre a fila e a confirmação.

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChefHat, Clock, Printer, RefreshCw, Volume2 } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { SectionHeading, StatusPill } from "../components/ui/pieces";
import {
  desde,
  destinoLabel,
  hora,
  localLabel,
  ticketStatusColor,
  ticketStatusLabel,
} from "../lib/format";
import {
  adaptadorImpressao,
  lerConfiguracaoImpressaoLocal,
  montarIntentRawBt,
} from "../lib/impressao-local";
import { serializarEscPos } from "../lib/recibo";
import { client } from "../lib/api";
import type { Impressao, Ticket } from "../lib/types";

interface PendenteRawBt {
  impressaoId: string;
  ocultou: boolean;
  iniciadoEm: number;
}

const CHAVE_RAWBT_PENDENTE = "cav:cozinha:rawbt-pendente:v1";

function lerPendenteRawBt(): PendenteRawBt | null {
  try {
    const valor = JSON.parse(window.localStorage.getItem(CHAVE_RAWBT_PENDENTE) ?? "null");
    return valor &&
      typeof valor.impressaoId === "string" &&
      typeof valor.ocultou === "boolean" &&
      typeof valor.iniciadoEm === "number"
      ? valor
      : null;
  } catch {
    return null;
  }
}

function salvarPendenteRawBt(pendente: PendenteRawBt | null) {
  if (pendente) {
    window.localStorage.setItem(CHAVE_RAWBT_PENDENTE, JSON.stringify(pendente));
  } else {
    window.localStorage.removeItem(CHAVE_RAWBT_PENDENTE);
  }
}

function Ficha({ ficha }: { ficha: Ticket }) {
  return (
    <li
      className="vh-edge bg-surface border-line rounded-md border"
      style={{ "--vh-edge-color": ticketStatusColor[ficha.status] } as React.CSSProperties}
      data-testid={`ficha-cozinha-${ficha.ticket_id}`}
    >
      <div className="border-line flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-muted text-[12px] tracking-[0.22em] uppercase">
            {localLabel(ficha)}
          </p>
          <p className="font-display vh-tabular text-parchment mt-1 text-[28px] leading-none">
            {destinoLabel[ficha.destino_producao]}
          </p>
          <p className="text-muted mt-1.5 text-[12px]">
            {ficha.funcionario_nome} · enviado {hora(ficha.enviado_em)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill
            label={ticketStatusLabel[ficha.status]}
            color={ticketStatusColor[ficha.status]}
            strong
            pulse={ficha.status === "preparando"}
          />
          <p className="text-muted vh-tabular text-[12px]">{desde(ficha.enviado_em)}</p>
        </div>
      </div>
      <ul className="px-4 py-3">
        {ficha.linhas.map((linha) => (
          <li key={linha.item_id} className="py-1.5">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display vh-tabular text-gold text-[17px]">{linha.qty}×</span>
              <span className="text-parchment min-w-0 flex-1 text-[16px] leading-snug">
                {linha.name}
              </span>
              {linha.pessoa ? (
                <span className="text-muted shrink-0 text-[12px] uppercase">{linha.pessoa}</span>
              ) : null}
            </div>
            {linha.observacao ? (
              <p className="text-gold mt-0.5 pl-8 text-[13px]">Obs.: {linha.observacao}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function CozinhaPage() {
  const { perfilAtivo, tickets, impressoes, reimprimir, notificar } = useComanda();
  const [impressaoPendente, setImpressaoPendente] = useState<Impressao | null>(null);
  const [erroImpressao, setErroImpressao] = useState("");
  const [wakeLockAtivo, setWakeLockAtivo] = useState(false);
  const [pendenteRawBt, setPendenteRawBt] = useState<PendenteRawBt | null>(lerPendenteRawBt);
  const processando = useRef(false);
  const alertaSonoro = useRef<AudioContext | null>(null);

  const tocarAlerta = useCallback(() => {
    try {
      const AudioContextCtor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const contexto = (alertaSonoro.current ??= new AudioContextCtor());
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();
      oscilador.frequency.value = 880;
      ganho.gain.value = 0.035;
      oscilador.connect(ganho);
      ganho.connect(contexto.destination);
      oscilador.start();
      oscilador.stop(contexto.currentTime + 0.16);
    } catch {
      // O som é apenas um alerta auxiliar e não pode interromper a operação.
    }
  }, []);

  const reservarEImprimir = useCallback(async () => {
    if (
      processando.current ||
      lerPendenteRawBt() ||
      (perfilAtivo !== "producao" && perfilAtivo !== "gerencia")
    ) {
      return;
    }
    processando.current = true;
    let reservada: Impressao | null = null;
    try {
      const resultado = await client.impressao.impressaoLocalReservar({ destino: "cozinha" });
      const fila = resultado.impressao;
      if (!fila) return;
      reservada = fila;
      setImpressaoPendente(fila);
      setErroImpressao("");
      const configuracao = lerConfiguracaoImpressaoLocal();
      const bytes = serializarEscPos(fila.texto, configuracao.paginaCodigo);
      if (configuracao.metodo === "rawbt") {
        const pendente = {
          impressaoId: fila.impressao_id,
          ocultou: false,
          iniciadoEm: Date.now(),
        };
        salvarPendenteRawBt(pendente);
        setPendenteRawBt(pendente);
        window.location.href = montarIntentRawBt(bytes);
        window.setTimeout(() => {
          const atual = lerPendenteRawBt();
          if (atual && !atual.ocultou) {
            setErroImpressao("O Chrome bloqueou a abertura automática. Toque para enviar a ficha.");
            tocarAlerta();
          }
        }, 1_500);
        return;
      }
      await adaptadorImpressao.imprimir(bytes, {
        texto: fila.texto,
        largura: fila.largura,
        metodo: configuracao.metodo,
      });
      await client.impressao.impressaoLocalConcluir({
        impressaoId: fila.impressao_id,
        sucesso: true,
      });
      setImpressaoPendente(null);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "A ficha não foi impressa.";
      setErroImpressao(mensagem);
      tocarAlerta();
      notificar(`A ficha da cozinha não imprimiu: ${mensagem}`, "atencao");
      if (reservada) {
        await client.impressao.impressaoLocalConcluir({
          impressaoId: reservada.impressao_id,
          sucesso: false,
          erro: mensagem,
        }).catch(() => undefined);
      }
    } finally {
      processando.current = false;
    }
  }, [notificar, perfilAtivo, tocarAlerta]);

  const concluirRetornoRawBt = useCallback(async () => {
    const pendente = lerPendenteRawBt();
    if (!pendente?.ocultou) return;
    await client.impressao.impressaoLocalConcluir({
      impressaoId: pendente.impressaoId,
      sucesso: true,
    });
    salvarPendenteRawBt(null);
    setPendenteRawBt(null);
    setImpressaoPendente(null);
    setErroImpressao("");
  }, []);

  useEffect(() => {
    const aoMudarVisibilidade = () => {
      const pendente = lerPendenteRawBt();
      if (!pendente) return;
      if (document.visibilityState === "hidden") {
        const atualizado = { ...pendente, ocultou: true };
        salvarPendenteRawBt(atualizado);
        setPendenteRawBt(atualizado);
        return;
      }
      if (pendente.ocultou) void concluirRetornoRawBt();
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    const verificarRetorno = window.setTimeout(() => {
      if (document.visibilityState === "visible") void concluirRetornoRawBt();
    }, 0);
    return () => {
      window.clearTimeout(verificarRetorno);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [concluirRetornoRawBt]);

  useEffect(() => {
    const iniciarFila = window.setTimeout(() => void reservarEImprimir(), 0);
    const intervalo = window.setInterval(() => void reservarEImprimir(), 2_000);
    return () => {
      window.clearTimeout(iniciarFila);
      window.clearInterval(intervalo);
    };
  }, [reservarEImprimir]);

  useEffect(() => {
    let sentinela: WakeLockSentinel | null = null;
    const solicitar = async () => {
      try {
        sentinela = await navigator.wakeLock.request("screen");
        setWakeLockAtivo(true);
        sentinela.addEventListener("release", () => setWakeLockAtivo(false));
      } catch {
        setWakeLockAtivo(false);
      }
    };
    void solicitar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void solicitar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      void sentinela?.release().catch(() => undefined);
    };
  }, []);

  const fichas = tickets.filter((ticket) => ticket.destino_producao === "cozinha");
  const abertas = fichas.filter((ticket) => ticket.status === "enviado" || ticket.status === "preparando");
  const impressasRecentes = impressoes
    .filter((item) => item.destino === "cozinha" && item.status === "impresso")
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))
    .slice(0, 8);
  const fichaPendente =
    impressaoPendente ??
    (pendenteRawBt
      ? impressoes.find((item) => item.impressao_id === pendenteRawBt.impressaoId) ?? null
      : null);

  return (
    <AppShell
      titulo="Cozinha"
      subtitulo="Fichas sem valores, impressão automática e acompanhamento do preparo"
    >
      <section className="border-line bg-surface mb-6 grid gap-3 rounded-md border p-4 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <span className="border-line bg-surface-2 text-gold grid size-10 place-items-center rounded-md border">
            <ChefHat className="size-5" />
          </span>
          <div>
            <p className="font-display text-muted text-[12px] uppercase">Em aberto</p>
            <p className="font-display vh-tabular text-parchment text-[24px]">{abertas.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="border-line bg-surface-2 text-gold grid size-10 place-items-center rounded-md border">
            <Printer className="size-5" />
          </span>
          <div>
            <p className="font-display text-muted text-[12px] uppercase">Impressão</p>
            <p className="text-parchment text-[13px]">
              {wakeLockAtivo ? "Tela ativa" : "Mantenha a tela ativa"}
            </p>
          </div>
        </div>
        <Action variante="tracejada" onClick={() => void reservarEImprimir()}>
          <RefreshCw className="size-4" />
          Verificar fila
        </Action>
      </section>

      {erroImpressao || impressaoPendente ? (
        <section
          className="border-ember/70 bg-ember/10 mb-6 flex flex-wrap items-center gap-3 rounded-md border p-4"
          aria-live="assertive"
          data-testid="alerta-impressao-cozinha"
        >
          <AlertTriangle className="text-ember size-5 shrink-0" />
          <p className="text-parchment min-w-0 flex-1 text-[14px]">
            {erroImpressao || "Enviando a próxima ficha para a impressora."}
          </p>
          {fichaPendente && pendenteRawBt && !pendenteRawBt.ocultou ? (
            <Action
              variante="primaria"
              onClick={() => {
                const configuracao = lerConfiguracaoImpressaoLocal();
                window.location.href = montarIntentRawBt(
                  serializarEscPos(fichaPendente.texto, configuracao.paginaCodigo),
                );
              }}
              data-testid="liberar-impressao-cozinha"
            >
              <Printer className="size-4" />
              Imprimir agora
            </Action>
          ) : null}
          <Volume2 className="text-ember size-5 shrink-0" aria-label="Alerta sonoro ativo" />
        </section>
      ) : null}

      <SectionHeading
        eyebrow="Fila"
        title="Pedidos da cozinha"
        hint="Os pedidos aparecem automaticamente. Nenhum valor financeiro é exibido nesta tela."
      />
      {fichas.length ? (
        <ul className="grid gap-3 xl:grid-cols-2">
          {fichas.map((ficha) => <Ficha key={ficha.ticket_id} ficha={ficha} />)}
        </ul>
      ) : (
        <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
          Nenhum pedido para a cozinha.
        </div>
      )}

      {impressasRecentes.length ? (
        <section className="mt-8">
          <SectionHeading
            eyebrow="Histórico"
            title="Últimas fichas impressas"
            hint="O registro evita duplicação após recarregar a tela."
          />
          <ul className="grid gap-2">
            {impressasRecentes.map((impressao) => (
              <li
                key={impressao.impressao_id}
                className="border-line bg-surface flex flex-wrap items-center gap-3 rounded-md border px-4 py-3"
              >
                <Clock className="text-muted size-4" />
                <span className="text-parchment flex-1 text-[13px]">
                  {impressao.mesa_id !== null
                    ? localLabel(impressao)
                    : `Balcão ${impressao.balcao_id ?? "?"}`}
                </span>
                <span className="text-muted text-[12px]">
                  {hora(impressao.impresso_em ?? impressao.atualizado_em)}
                </span>
                <Action
                  variante="fantasma"
                  onClick={() => void reimprimir(impressao.impressao_id)}
                  data-testid={`reimprimir-cozinha-${impressao.impressao_id}`}
                >
                  <Printer className="size-4" />
                  Reimprimir
                </Action>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
