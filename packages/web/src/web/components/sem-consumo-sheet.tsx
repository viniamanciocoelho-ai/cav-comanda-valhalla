// Dialogo de encerramento de mesa sem consumo: o cliente sentou e saiu sem pedir nada.
// Nao gera cobranca, pagamento, NFC-e nem ficha de producao — so libera a mesa e grava a
// auditoria. O motivo e obrigatorio; rascunhos ainda nao enviados exigem confirmacao.

import { useEffect, useState } from "react";
import { AlertTriangle, DoorClosed } from "lucide-react";
import { mesaLabel, motivoSemConsumoLabel } from "../lib/format";
import { useAcaoUnica } from "../lib/hooks";
import type { MotivoSemConsumo } from "../lib/types";
import { Action } from "./ui/action";
import { Sheet } from "./ui/sheet";

const motivos = Object.keys(motivoSemConsumoLabel) as MotivoSemConsumo[];

export function SemConsumoSheet({
  open,
  onClose,
  mesa_id,
  rascunhos,
  onConfirmar,
}: {
  open: boolean;
  onClose: () => void;
  mesa_id: number;
  /** Itens em rascunho que serao descartados junto. */
  rascunhos: number;
  onConfirmar: (motivo: MotivoSemConsumo, observacao: string) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoSemConsumo | null>(null);
  const [observacao, setObservacao] = useState("");
  const [descartar, setDescartar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Uma execucao por clique: o duplo toque nao encerra a mesa duas vezes (lib/hooks.ts).
  const confirmacao = useAcaoUnica();

  // Cada abertura do dialogo comeca em branco: nenhum motivo herdado do encerramento anterior.
  useEffect(() => {
    if (!open) return;
    setMotivo(null);
    setObservacao("");
    setDescartar(false);
    setAviso(null);
  }, [open]);

  function tentarConfirmar() {
    if (!motivo) {
      setAviso("Escolha o motivo do encerramento.");
      return;
    }
    if (rascunhos > 0 && !descartar) {
      setAviso("Confirme o descarte dos lançamentos em rascunho.");
      return;
    }
    setAviso(null);
    confirmacao.executar(() => onConfirmar(motivo, observacao));
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      testId="dialogo-sem-consumo"
      eyebrow={`Mesa ${mesaLabel(mesa_id)}`}
      title="Encerrar mesa sem consumo?"
      hint="A mesa será liberada sem gerar cobrança, pagamento ou documento fiscal."
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Action variante="fantasma" onClick={onClose} data-testid="sem-consumo-voltar">
            Voltar
          </Action>
          <Action
            variante="primaria"
            onClick={tentarConfirmar}
            disabled={confirmacao.processando}
            aria-disabled={confirmacao.processando}
            data-testid="sem-consumo-confirmar"
          >
            <DoorClosed className="size-4" />
            {confirmacao.processando ? "Liberando…" : "Confirmar e liberar mesa"}
          </Action>
        </div>
      }
    >
      {rascunhos > 0 ? (
        <div
          className="border-ember/60 bg-surface-2 mb-5 rounded-md border p-3.5"
          data-testid="sem-consumo-rascunhos"
        >
          <p className="text-parchment flex items-start gap-2 text-[13px] leading-relaxed">
            <AlertTriangle className="text-ember mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Existem {rascunhos} {rascunhos === 1 ? "lançamento" : "lançamentos"} em rascunho
              nesta comanda. Nada foi enviado à produção, mas o encerramento descarta{" "}
              {rascunhos === 1 ? "esse item" : "esses itens"}.
            </span>
          </p>
          <label className="text-parchment mt-3 flex min-h-11 items-center gap-2.5 text-[13px]">
            <input
              type="checkbox"
              checked={descartar}
              onChange={(evento) => setDescartar(evento.target.checked)}
              aria-label="Descartar os lançamentos em rascunho e liberar a mesa"
              data-testid="sem-consumo-descartar"
              className="accent-ember size-4"
            />
            Descartar {rascunhos === 1 ? "o rascunho" : "os rascunhos"} e liberar a mesa
          </label>
        </div>
      ) : null}

      <fieldset className="min-w-0">
        <legend className="font-display text-muted mb-2 text-[12px] tracking-[0.16em] uppercase">
          Motivo (obrigatório)
        </legend>
        <div className="grid gap-2">
          {motivos.map((chave) => {
            const selecionado = chave === motivo;
            return (
              <label
                key={chave}
                data-testid={`sem-consumo-motivo-${chave}`}
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2 text-[13px] transition-colors duration-150 ${
                  selecionado
                    ? "border-gold bg-surface-3 text-parchment"
                    : "border-line bg-surface-2 text-muted hover:border-bronze hover:text-parchment"
                }`}
              >
                <input
                  type="radio"
                  name="motivo-sem-consumo"
                  value={chave}
                  aria-label={motivoSemConsumoLabel[chave]}
                  checked={selecionado}
                  onChange={() => {
                    setMotivo(chave);
                    setAviso(null);
                  }}
                  className="accent-gold size-4"
                />
                {motivoSemConsumoLabel[chave]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 min-w-0">
        <label
          htmlFor="observacao-sem-consumo"
          className="font-display text-muted mb-2 block text-[12px] tracking-[0.16em] uppercase"
        >
          Observação (opcional)
        </label>
        <input
          id="observacao-sem-consumo"
          aria-label="Observação do encerramento sem consumo"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
          placeholder="Ex.: preferiram esperar no balcão"
          data-testid="sem-consumo-observacao"
          className="border-line bg-surface text-parchment placeholder:text-muted focus:border-gold/70 min-h-11 w-full rounded-md border px-3 text-[14px] outline-none"
        />
      </div>

      {aviso ? (
        <p className="text-ember mt-4 text-[13px]" role="alert" data-testid="sem-consumo-aviso">
          {aviso}
        </p>
      ) : null}

      <p className="text-muted mt-4 text-[12px] leading-relaxed">
        Nenhum fechamento de R$ 0,00 é criado: a ocorrência fica registrada como mesa liberada
        sem consumo, com o motivo e o responsável.
      </p>
    </Sheet>
  );
}
