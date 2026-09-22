// Atendimento rápido sem mesa física. Reutiliza comanda, produção, caixa e cálculo existentes.

import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRightLeft,
  BellRing,
  Check,
  Clock,
  Minus,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { MenuSheet } from "../components/menu-sheet";
import { useComanda } from "../components/comanda-provider";
import { Action, IconAction } from "../components/ui/action";
import { RuneDivider, SectionHeading, StatusPill } from "../components/ui/pieces";
import { TAXA_SERVICO } from "../lib/operacao";
import {
  desde,
  itemStatusColor,
  itemStatusLabel,
  mesaLabel,
  money,
} from "../lib/format";
import { useAcaoUnica } from "../lib/hooks";

export default function BalcaoPage() {
  const params = useParams<{ id: string }>();
  const [, navegar] = useLocation();
  const {
    perfilAtivo,
    balcoes,
    mesas,
    abrirBalcao,
    pessoasDoAtendimento,
    itensDoAtendimento,
    resumoAtendimento,
    nomeDaPessoa,
    alterarQuantidade,
    removerItem,
    enviarPedidoAtendimento,
    enviandoAtendimento,
    marcarEntregue,
    solicitarCancelamento,
    autorizarCancelamento,
    recusarCancelamento,
    solicitarFechamentoAtendimento,
    transferirBalcaoParaMesa,
    notificar,
  } = useComanda();
  const balcao_id = Number(params.id);
  const balcao = balcoes.find((registro) => registro.balcao_id === balcao_id);
  const [cardapioAberto, setCardapioAberto] = useState(false);
  const [mesaDestino, setMesaDestino] = useState("");
  const envio = useAcaoUnica();
  const fechamento = useAcaoUnica();
  const transferencia = useAcaoUnica();

  if (!Number.isFinite(balcao_id) || !balcao) {
    return (
      <AppShell titulo="Balcão não encontrado">
        <Action onClick={() => navegar("/")}>
          <ArrowLeft className="size-4" />
          Voltar
        </Action>
      </AppShell>
    );
  }

  const atendimento_id = balcao.atendimento_id;
  const pessoas = atendimento_id ? pessoasDoAtendimento(atendimento_id) : [];
  const itens = atendimento_id ? itensDoAtendimento(atendimento_id) : [];
  const conta = atendimento_id ? resumoAtendimento(atendimento_id) : null;
  const podeLancar = perfilAtivo === "garcom" || perfilAtivo === "gerencia";
  const mesasLivres = mesas.filter(
    (mesa) => mesa.status === "livre" && !mesa.ativa && mesa.atendimento_id === null,
  );
  const enviando = atendimento_id !== null && enviandoAtendimento === atendimento_id;

  function enviar() {
    if (!atendimento_id) return;
    const enviados = enviarPedidoAtendimento(atendimento_id);
    notificar(
      enviados
        ? `${enviados} ${enviados === 1 ? "item enviado" : "itens enviados"} para produção.`
        : "Nenhum item novo para enviar.",
      enviados ? "sucesso" : "atencao",
    );
  }

  function pedirFechamento() {
    if (!atendimento_id || !conta) return;
    if (!conta.itens || conta.novos) {
      notificar("Envie todos os itens antes de pedir o fechamento.", "atencao");
      return;
    }
    const ok = solicitarFechamentoAtendimento(atendimento_id);
    notificar(
      ok ? `Balcão ${balcao_id} entrou na fila do caixa.` : "O fechamento não pôde ser solicitado.",
      ok ? "sucesso" : "atencao",
    );
  }

  function transferir() {
    const destino = Number(mesaDestino);
    if (!Number.isFinite(destino)) {
      notificar("Escolha uma mesa livre.", "atencao");
      return;
    }
    const ok = transferirBalcaoParaMesa(balcao_id, destino);
    if (!ok) {
      notificar("A transferência não pôde ser concluída. Atualize e tente novamente.", "atencao");
      return;
    }
    notificar(`Atendimento transferido para a Mesa ${mesaLabel(destino)}.`, "sucesso");
    navegar(`/mesa/${destino}`);
  }

  return (
    <AppShell
      titulo={`Balcão ${balcao_id} · comanda`}
      subtitulo={
        balcao.ativa
          ? `${pessoas.length} ${pessoas.length === 1 ? "pessoa" : "pessoas"} · aberto há ${desde(balcao.abertaEm)}`
          : "Posição livre"
      }
    >
      <Action variante="fantasma" onClick={() => navegar("/")} data-testid="voltar">
        <ArrowLeft className="size-4" />
        Voltar ao salão
      </Action>

      {!balcao.ativa || !atendimento_id || !conta ? (
        <section className="border-line bg-surface mt-4 rounded-lg border p-8 text-center">
          <p className="font-display text-gold text-[12px] tracking-[0.22em] uppercase">
            Balcão {balcao_id}
          </p>
          <h2 className="text-parchment mt-3 text-[30px]">Atendimento disponível</h2>
          <p className="text-muted mx-auto mt-3 max-w-md text-[13px] leading-relaxed">
            Abra uma comanda rápida sem ocupar mesa. O cliente pode pagar no balcão ou continuar
            depois em uma mesa livre.
          </p>
          {podeLancar ? (
            <Action
              variante="primaria"
              className="mt-6"
              onClick={() => {
                abrirBalcao(balcao_id);
                notificar(`Balcão ${balcao_id} aberto.`, "sucesso");
              }}
              data-testid="abrir-balcao"
            >
              Abrir atendimento
            </Action>
          ) : null}
        </section>
      ) : (
        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_336px]">
          <section className="min-w-0">
            <SectionHeading
              eyebrow="Comanda"
              title={`${conta.itens} ${conta.itens === 1 ? "item" : "itens"}`}
              hint="Itens novos só seguem para a produção depois do envio do pedido."
              action={
                podeLancar && !balcao.contaSolicitada ? (
                  <Action variante="tracejada" onClick={() => setCardapioAberto(true)}>
                    <Plus className="size-4" />
                    Adicionar item
                  </Action>
                ) : null
              }
            />

            {itens.length ? (
              <ul className="grid gap-2">
                {itens.map((item) => {
                  const novo = item.status === "novo";
                  return (
                    <li
                      key={item.item_id}
                      className="vh-edge bg-surface border-line rounded-md border py-3 pr-3 pl-4"
                      style={{ "--vh-edge-color": itemStatusColor[item.status] } as React.CSSProperties}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-parchment text-[14px]">
                            <span className="font-display text-gold mr-1.5">{item.quantidade}×</span>
                            {item.name}
                          </p>
                          <p className="text-muted mt-1 text-[12px]">
                            {nomeDaPessoa(item.pessoa_id)} · lançado por {item.funcionario_nome}
                          </p>
                          {item.observacao ? (
                            <p className="text-gold mt-1 text-[12px]">Obs.: {item.observacao}</p>
                          ) : null}
                        </div>
                        <StatusPill
                          label={itemStatusLabel[item.status]}
                          color={itemStatusColor[item.status]}
                          strong
                        />
                        <p className="font-display text-parchment">{money(item.price * item.quantidade)}</p>
                        {novo && podeLancar ? (
                          <div className="flex gap-1">
                            <IconAction
                              label={`Diminuir ${item.name}`}
                              onClick={() => alterarQuantidade(item.item_id, -1)}
                            >
                              <Minus className="size-4" />
                            </IconAction>
                            <IconAction
                              label={`Aumentar ${item.name}`}
                              onClick={() => alterarQuantidade(item.item_id, 1)}
                            >
                              <Plus className="size-4" />
                            </IconAction>
                            <IconAction
                              label={`Remover ${item.name}`}
                              onClick={() => removerItem(item.item_id)}
                            >
                              <Trash2 className="size-4" />
                            </IconAction>
                          </div>
                        ) : null}
                      </div>
                      {!novo && podeLancar ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.status === "pronto" ? (
                            <Action onClick={() => marcarEntregue(item.item_id)}>
                              <Check className="size-4" />
                              Entreguei
                            </Action>
                          ) : null}
                          {item.status === "cancelamento_solicitado" ? (
                            perfilAtivo === "gerencia" ? (
                              <>
                                <Action onClick={() => autorizarCancelamento(item.item_id)}>
                                  Autorizar cancelamento
                                </Action>
                                <Action onClick={() => recusarCancelamento(item.item_id)}>
                                  Manter item
                                </Action>
                              </>
                            ) : null
                          ) : item.status !== "entregue" ? (
                            <Action variante="fantasma" onClick={() => solicitarCancelamento(item.item_id)}>
                              Pedir cancelamento
                            </Action>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
                Nenhum item lançado neste atendimento.
              </div>
            )}
          </section>

          <aside className="border-line bg-surface-2 h-fit rounded-lg border xl:sticky xl:top-24">
            <div className="divide-line divide-y">
              <div className="px-4 py-3.5">
                <p className="font-display text-gold text-[12px] tracking-[0.2em] uppercase">
                  Resumo do balcão
                </p>
              </div>
              <dl className="text-muted grid grid-cols-[1fr_auto] gap-y-2 px-4 py-3 text-[13px]">
                <dt>Consumo</dt>
                <dd className="text-parchment text-right">{money(conta.subtotal)}</dd>
                <dt>Serviço {Math.round(TAXA_SERVICO * 100)}%</dt>
                <dd className="text-parchment text-right">{money(conta.servico)}</dd>
                <dt className="text-parchment">Total</dt>
                <dd className="text-gold-bright text-right text-[20px]">{money(conta.total)}</dd>
              </dl>
              {podeLancar ? (
                <div className="grid gap-2 px-4 py-4">
                  <Action
                    variante="primaria"
                    full
                    disabled={enviando || !conta.novos || balcao.contaSolicitada}
                    onClick={() => envio.executar(enviar)}
                    data-testid="enviar-pedido"
                  >
                    <Send className="size-4" />
                    {enviando ? "Enviando…" : "Enviar pedido"}
                  </Action>
                  <Action
                    full
                    disabled={balcao.contaSolicitada}
                    onClick={() => fechamento.executar(pedirFechamento)}
                    data-testid="solicitar-fechamento"
                  >
                    <BellRing className="size-4" />
                    {balcao.contaSolicitada ? "Na fila do caixa" : "Solicitar fechamento"}
                  </Action>
                </div>
              ) : null}
            </div>
          </aside>

          {perfilAtivo === "gerencia" && !balcao.contaSolicitada ? (
            <section className="border-line bg-surface rounded-md border p-4 xl:col-span-2">
              <p className="font-display text-gold text-[12px] tracking-[0.2em] uppercase">
                Continuar em uma mesa
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={mesaDestino}
                  onChange={(evento) => setMesaDestino(evento.target.value)}
                  aria-label="Mesa de destino"
                  className="border-line bg-surface-2 text-parchment min-h-11 min-w-[190px] rounded-md border px-3"
                >
                  <option value="">Escolha uma mesa livre</option>
                  {mesasLivres.map((mesa) => (
                    <option key={mesa.mesa_id} value={mesa.mesa_id}>
                      Mesa {mesaLabel(mesa.mesa_id)}
                    </option>
                  ))}
                </select>
                <Action
                  variante="tracejada"
                  disabled={transferencia.processando}
                  onClick={() => transferencia.executar(transferir)}
                  data-testid="transferir-para-mesa"
                >
                  <ArrowRightLeft className="size-4" />
                  Transferir atendimento
                </Action>
              </div>
              <p className="text-muted mt-2 flex items-center gap-1.5 text-[12px]">
                <Clock className="size-3.5" />
                Os mesmos pedidos, itens e autoria seguem para a mesa.
              </p>
            </section>
          ) : null}
        </div>
      )}

      <RuneDivider className="my-6" />

      {atendimento_id ? (
        <MenuSheet
          open={cardapioAberto}
          onClose={() => setCardapioAberto(false)}
          atendimento_id={atendimento_id}
          localRotulo={`Balcão ${balcao_id}`}
        />
      ) : null}
    </AppShell>
  );
}
