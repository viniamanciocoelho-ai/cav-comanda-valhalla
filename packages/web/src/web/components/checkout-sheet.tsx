// Diálogo do caixa: divisão por pessoa, controle da taxa de serviço e impressão manual.
// O mesmo atendimento pode estar em uma mesa ou no balcão.

import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Circle, Info, Printer } from "lucide-react";
import { TAXA_SERVICO } from "../lib/operacao";
import { localLabel, money } from "../lib/format";
import { useAcaoUnica } from "../lib/hooks";
import {
  adaptadorImpressao,
  lerConfiguracaoImpressaoLocal,
} from "../lib/impressao-local";
import { montarRecibo, serializarEscPos } from "../lib/recibo";
import { useComanda } from "./comanda-provider";
import { Action } from "./ui/action";
import { Sheet } from "./ui/sheet";
import { RuneDivider } from "./ui/pieces";

export function CheckoutSheet({
  open,
  onClose,
  atendimento_id,
}: {
  open: boolean;
  onClose: () => void;
  atendimento_id: string;
}) {
  const [, navegar] = useLocation();
  const {
    mesas,
    balcoes,
    resumoAtendimento,
    itensDoAtendimento,
    alternarServicoAtendimento,
    fecharAtendimento,
    notificar,
    pessoasDoAtendimento,
  } = useComanda();
  const [pagos, setPagos] = useState<string[]>([]);
  const encerramento = useAcaoUnica();
  const servico = useAcaoUnica();

  const mesa = mesas.find((registro) => registro.atendimento_id === atendimento_id);
  const balcao = balcoes.find((registro) => registro.atendimento_id === atendimento_id);
  const local = mesa
    ? { mesa_id: mesa.mesa_id, balcao_id: null }
    : { mesa_id: null, balcao_id: balcao?.balcao_id ?? null };
  const rotulo = localLabel(local);
  const conta = resumoAtendimento(atendimento_id);
  const itens = itensDoAtendimento(atendimento_id);
  const pessoas = pessoasDoAtendimento(atendimento_id);
  const cancelamentoPendente = itens.some(
    (item) => item.status === "cancelamento_solicitado",
  );
  const faltam = conta.divisao.filter((linha) => !pagos.includes(linha.pessoa_id)).length;

  function fechar() {
    setPagos([]);
    onClose();
  }

  function alternarPago(pessoa_id: string) {
    setPagos((atual) =>
      atual.includes(pessoa_id) ? atual.filter((id) => id !== pessoa_id) : [...atual, pessoa_id],
    );
  }

  function imprimir() {
    try {
      const texto = montarRecibo(local, pessoas, itens, conta.divisao, 58);
      const configuracao = lerConfiguracaoImpressaoLocal();
      const envio = adaptadorImpressao.imprimir(
        serializarEscPos(texto, configuracao.paginaCodigo),
        { texto, largura: 58 },
      );
      void envio
        .then(() => notificar("Notinha enviada para impressão.", "sucesso"))
        .catch((erro) =>
          notificar(
            erro instanceof Error ? erro.message : "Não foi possível imprimir.",
            "atencao",
          ),
        );
    } catch (erro) {
      notificar(erro instanceof Error ? erro.message : "Não foi possível imprimir.", "atencao");
    }
  }

  function confirmar() {
    if (conta.novos > 0) {
      notificar(
        `${conta.novos} ${conta.novos === 1 ? "item ainda não foi enviado" : "itens ainda não foram enviados"} para a produção. Envie ou remova antes de fechar.`,
        "atencao",
      );
      return;
    }
    if (cancelamentoPendente) {
      notificar(
        "Resolva os cancelamentos pendentes com a gerência antes de fechar a conta.",
        "atencao",
      );
      return;
    }
    if (!conta.divisao.length) {
      notificar("Não há consumo para dividir neste atendimento.", "atencao");
      return;
    }
    const registro = fecharAtendimento(atendimento_id, false);
    if (!registro) {
      notificar(`Não há consumo para fechar em ${rotulo}.`, "atencao");
      return;
    }
    notificar(
      `${rotulo} fechado às ${registro.hora} · ${money(registro.total)}. Registro gravado.`,
      "sucesso",
    );
    fechar();
    navegar("/fechamentos");
  }

  return (
    <Sheet
      open={open}
      onClose={fechar}
      testId="dialogo-fechamento"
      eyebrow={rotulo}
      title="Dividir e fechar a conta"
      hint="Itens individuais ficam com cada pessoa. Itens compartilhados são rateados igualmente. Cada pessoa paga a parte dela na forma que preferir."
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted text-[12px]">
            {faltam
              ? `${faltam} ${faltam === 1 ? "pessoa ainda não pagou" : "pessoas ainda não pagaram"} (marcação opcional).`
              : "Todas as partes foram marcadas como pagas."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Action variante="tracejada" onClick={imprimir} data-testid="imprimir-notinha">
              <Printer className="size-4" />
              Imprimir notinha
            </Action>
            <Action
              variante="primaria"
              onClick={() => encerramento.executar(confirmar)}
              disabled={encerramento.processando}
              aria-disabled={encerramento.processando}
              data-testid="confirmar-fechamento"
            >
              <CheckCircle2 className="size-4" />
              {encerramento.processando ? "Fechando…" : "Confirmar fechamento"}
            </Action>
          </div>
        </div>
      }
    >
      <div className="border-line bg-surface-2 mb-5 rounded-md border">
        <div className="divide-line divide-y">
          <div className="flex items-center justify-between px-4 py-2.5">
            <p className="text-muted text-[13px]">Consumo</p>
            <p className="font-display vh-tabular text-parchment text-[15px]">
              {money(conta.subtotal)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-muted text-[13px]">
                Serviço {Math.round(TAXA_SERVICO * 100)}%{" "}
                {conta.servicoIncluso ? "(incluso)" : "(retirado)"}
              </p>
              <p className="text-muted mt-0.5 text-[12px]">
                O caixa é quem inclui ou retira a taxa, a pedido do cliente.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-display vh-tabular text-parchment text-[15px]">
                {money(conta.servico)}
              </p>
              <Action
                variante={conta.servicoIncluso ? "secundaria" : "tracejada"}
                onClick={() =>
                  servico.executar(() => alternarServicoAtendimento(atendimento_id))
                }
                disabled={servico.processando}
                aria-disabled={servico.processando}
                data-testid="alternar-servico"
              >
                {conta.servicoIncluso ? "Retirar serviço" : "Incluir serviço"}
              </Action>
            </div>
          </div>
          <div className="bg-surface-3 flex items-center justify-between px-4 py-3">
            <p className="font-display text-parchment text-[13px] tracking-[0.14em] uppercase">
              Total do atendimento
            </p>
            <p className="font-display vh-tabular text-gold-bright text-[22px] tracking-[0.03em]">
              {money(conta.total)}
            </p>
          </div>
        </div>
      </div>

      <p className="font-display text-gold mb-3 text-[12px] tracking-[0.2em] uppercase">
        Quanto cada pessoa paga
      </p>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {conta.divisao.map((linha) => {
          const pago = pagos.includes(linha.pessoa_id);
          return (
            <li
              key={linha.pessoa_id}
              className="border-line bg-surface rounded-md border p-3.5"
              data-testid={`divisao-${linha.pessoa}`}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="font-display text-parchment text-[14px] tracking-[0.08em] uppercase">
                  {linha.pessoa}
                </p>
                <p className="font-display vh-tabular text-gold-bright text-[18px] tracking-[0.03em]">
                  {money(linha.total)}
                </p>
              </div>
              <dl className="text-muted grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[12px]">
                <dt>Consumo individual</dt>
                <dd className="vh-tabular text-right">{money(linha.individual)}</dd>
                <dt>Parte do compartilhado</dt>
                <dd className="vh-tabular text-right">{money(linha.rateio)}</dd>
                <dt>Serviço</dt>
                <dd className="vh-tabular text-right">{money(linha.servico)}</dd>
              </dl>
              <button
                type="button"
                onClick={() => alternarPago(linha.pessoa_id)}
                aria-pressed={pago}
                data-testid={`pago-${linha.pessoa}`}
                className={`font-display mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border text-[12px] tracking-[0.12em] uppercase transition-colors duration-150 ${
                  pago
                    ? "border-moss/60 text-moss bg-surface-2"
                    : "border-line text-muted hover:border-gold/70 hover:text-parchment"
                }`}
              >
                {pago ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                {pago ? "Parte paga" : "Marcar como paga"}
              </button>
            </li>
          );
        })}
      </ul>

      {!conta.divisao.length ? (
        <div className="border-line text-muted rounded-md border border-dashed p-6 text-center text-[13px]">
          Este atendimento não tem consumo para dividir.
        </div>
      ) : null}

      <RuneDivider className="my-5" />

      <div
        className="border-bronze/50 bg-surface-2 flex items-start gap-3 rounded-md border border-dashed p-3.5"
        data-testid="aviso-notinha"
      >
        <span className="text-gold mt-0.5 shrink-0" aria-hidden="true">
          <Info className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-parchment text-[12px] tracking-[0.12em] uppercase">
            Recibo simples
          </p>
          <p className="text-muted mt-1 text-[12px] leading-relaxed">
            A notinha é um resumo do consumo. A impressão manual via RawBT permanece disponível
            neste botão e não interfere na fila automática da produção.
          </p>
        </div>
      </div>

      {!(mesa?.contaSolicitada ?? balcao?.contaSolicitada) ? (
        <p className="text-muted mt-4 text-[12px] leading-relaxed">
          Este atendimento não passou pela solicitação do garçom. O caixa também pode fechar
          diretamente quando o cliente vem pagar.
        </p>
      ) : null}
    </Sheet>
  );
}
