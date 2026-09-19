// Comanda de uma mesa: consumo por pessoa, itens compartilhados, envio para producao,
// entrega na mesa e pedido de fechamento.

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  BellRing,
  Check,
  Clock,
  DoorClosed,
  DoorOpen,
  Minus,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Undo2,
  XCircle,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import {
  DESFAZER_SEM_CONSUMO_MS,
  useComanda,
} from "../components/comanda-provider";
import { MenuSheet } from "../components/menu-sheet";
import { SemConsumoSheet } from "../components/sem-consumo-sheet";
import { Action, IconAction } from "../components/ui/action";
import { RuneDivider, SectionHeading, StatusPill } from "../components/ui/pieces";
import { COMPARTILHADO, TAXA_SERVICO, compartilhadoId } from "../lib/operacao";
import {
  desde,
  destinoLabel,
  hora,
  itemStatusColor,
  itemStatusLabel,
  mesaLabel,
  money,
  perfilNome,
} from "../lib/format";
import { useAcaoUnica } from "../lib/hooks";
import { rotaInicial } from "../lib/perfis";
import type { MotivoSemConsumo, OrderItem, Perfil } from "../lib/types";

function LinhaItem({
  item,
  perfil,
  pessoa,
  onQuantidade,
  onRemover,
  onEntregar,
  onCancelar,
  onAutorizar,
  onRecusar,
}: {
  item: OrderItem;
  perfil: Perfil;
  pessoa: string;
  onQuantidade: (item: OrderItem, delta: number) => void;
  onRemover: (item: OrderItem) => void;
  onEntregar: (item: OrderItem) => void;
  onCancelar: (item: OrderItem) => void;
  onAutorizar: (item: OrderItem) => void;
  onRecusar: (item: OrderItem) => void;
}) {
  const cor = itemStatusColor[item.status];
  const novo = item.status === "novo";
  const podeLancar = perfil === "garcom" || perfil === "gerencia";
  const pedeCancelamento = item.status === "cancelamento_solicitado";
  // Uma entrega por clique: o duplo toque no celular nao registra duas vezes.
  const entrega = useAcaoUnica();

  // O min-w-0 da <li> e obrigatorio: item de grid herda min-content e furaria a largura no celular.
  return (
    <li
      className="vh-edge bg-surface border-line min-w-0 rounded-md border py-2.5 pr-2.5 pl-4"
      style={{ "--vh-edge-color": cor } as CSSProperties}
      data-testid={`item-${item.item_id}`}
    >
      <div className="flex items-start gap-3 md:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-parchment text-[14px]">
            <span className="font-display vh-tabular text-gold mr-1.5">{item.quantidade}×</span>
            {item.name}
          </p>
          <p className="text-muted mt-0.5 text-[12px] tracking-[0.06em] uppercase">
            {pessoa} · {destinoLabel[item.destino_producao]}
          </p>
          {/* Autoria e horario por item: a producao e o caixa precisam saber quem lancou e quando. */}
          <p className="text-muted mt-0.5 text-[12px]">
            {item.funcionario_nome} ({perfilNome[item.funcionario_perfil]}) ·{" "}
            {novo ? `lançado ${hora(item.criado_em)}` : `enviado ${hora(item.enviado_em)}`}
          </p>
          {item.observacao ? (
            <p className="text-gold mt-1 text-[12px] leading-snug">Obs.: {item.observacao}</p>
          ) : null}

          <div className="mt-2 md:hidden">
            <StatusPill
              label={itemStatusLabel[item.status]}
              color={cor}
              strong={item.status !== "enviado"}
              pulse={item.status === "preparando"}
            />
          </div>
        </div>

        <div className="hidden shrink-0 md:block">
          <StatusPill
            label={itemStatusLabel[item.status]}
            color={cor}
            strong={item.status !== "enviado"}
            pulse={item.status === "preparando"}
          />
        </div>

        <p className="font-display vh-tabular text-parchment mt-0.5 w-[80px] shrink-0 text-right text-[14px] tracking-[0.04em] md:mt-0">
          {money(item.price * item.quantidade)}
        </p>

        {novo && podeLancar ? (
          <div className="flex shrink-0 items-center gap-1">
            <IconAction
              label={`Diminuir ${item.name}`}
              onClick={() => onQuantidade(item, -1)}
              data-testid={`menos-${item.item_id}`}
            >
              <Minus className="size-4" />
            </IconAction>
            <IconAction
              label={`Aumentar ${item.name}`}
              onClick={() => onQuantidade(item, 1)}
              data-testid={`mais-${item.item_id}`}
            >
              <Plus className="size-4" />
            </IconAction>
            <IconAction
              label={`Remover ${item.name}`}
              onClick={() => onRemover(item)}
              className="hover:border-blood/60 hover:text-blood"
              data-testid={`remover-${item.item_id}`}
            >
              <Trash2 className="size-4" />
            </IconAction>
          </div>
        ) : null}
      </div>

      {/* Acoes de fluxo: entrega na mesa e cancelamento com autorizacao da gerencia. */}
      {!novo ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {item.status === "pronto" && podeLancar ? (
            <Action
              variante="primaria"
              onClick={() => entrega.executar(() => onEntregar(item))}
              disabled={entrega.processando}
              aria-disabled={entrega.processando}
              data-testid={`entregar-${item.item_id}`}
            >
              <Check className="size-4" />
              {entrega.processando ? "Registrando…" : "Entreguei na mesa"}
            </Action>
          ) : null}

          {pedeCancelamento ? (
            perfil === "gerencia" ? (
              <>
                <Action
                  onClick={() => onAutorizar(item)}
                  data-testid={`autorizar-${item.item_id}`}
                >
                  <XCircle className="size-4" />
                  Autorizar cancelamento
                </Action>
                <Action variante="fantasma" onClick={() => onRecusar(item)}>
                  <Undo2 className="size-4" />
                  Manter item
                </Action>
              </>
            ) : (
              <p className="text-muted text-[12px]">
                Cancelamento pedido. Aguardando a gerência autorizar.
              </p>
            )
          ) : item.status !== "entregue" && podeLancar ? (
            <Action
              variante="fantasma"
              onClick={() => onCancelar(item)}
              data-testid={`cancelar-${item.item_id}`}
            >
              <XCircle className="size-4" />
              Pedir cancelamento
            </Action>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function MesaPage() {
  const params = useParams<{ id: string }>();
  const [, navegar] = useLocation();
  const {
    perfilAtivo,
    mesas,
    pessoasDaMesa,
    itensDaMesa,
    nomeDaPessoa,
    resumo,
    abrirMesa,
    adicionarPessoa,
    alterarQuantidade,
    removerItem,
    enviarPedido,
    enviandoMesa,
    marcarEntregue,
    solicitarCancelamento,
    autorizarCancelamento,
    recusarCancelamento,
    solicitarFechamento,
    avaliarSemConsumo,
    encerrarSemConsumo,
    desfazerEncerramentoSemConsumo,
    notificar,
  } = useComanda();

  const mesa_id = Number(params.id);
  const mesa = mesas.find((m) => m.mesa_id === mesa_id);

  const [aba, setAba] = useState<string>("todos");
  const [cardapioAberto, setCardapioAberto] = useState(false);
  const [novaPessoa, setNovaPessoa] = useState("");
  const [semConsumoAberto, setSemConsumoAberto] = useState(false);
  // Encerramento sem consumo recente: alimenta a acao "Desfazer".
  const [desfazer, setDesfazer] = useState<{ encerramento_id: string; ate: number } | null>(null);
  const [restante, setRestante] = useState(0);
  // Uma operacao por clique nos dois botoes que gravam (lib/hooks.ts).
  const envio = useAcaoUnica();
  const fechamento = useAcaoUnica();

  const pessoas = pessoasDaMesa(mesa_id);
  const itens = itensDaMesa(mesa_id);
  const conta = resumo(mesa_id);
  const compartilhado = compartilhadoId(mesa_id);
  const podeLancar = perfilAtivo === "garcom" || perfilAtivo === "gerencia";
  const enviando = enviandoMesa === mesa_id || envio.processando;
  const fechando = fechamento.processando;
  const semConsumo = avaliarSemConsumo(mesa_id);

  // Contagem regressiva do "Desfazer": passados 10 s a oferta desaparece.
  useEffect(() => {
    if (!desfazer) {
      // O contador precisa ser zerado quando a oferta de desfazer desaparece.
      // oxlint-disable-next-line react/set-state-in-effect
      setRestante(0);
      return;
    }
    const revisar = () => {
      const segundos = Math.ceil((desfazer.ate - Date.now()) / 1000);
      if (segundos <= 0) {
        setDesfazer(null);
        setRestante(0);
        return;
      }
      setRestante(segundos);
    };
    revisar();
    const intervalo = window.setInterval(revisar, 250);
    return () => window.clearInterval(intervalo);
  }, [desfazer]);

  const porPessoa = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of itens) {
      mapa.set(item.pessoa_id, (mapa.get(item.pessoa_id) ?? 0) + item.price * item.quantidade);
    }
    return mapa;
  }, [itens]);

  const visiveis = useMemo(
    () => (aba === "todos" ? itens : itens.filter((item) => item.pessoa_id === aba)),
    [aba, itens],
  );

  const voltar = () => navegar(rotaInicial[perfilAtivo]);

  if (!Number.isFinite(mesa_id) || !mesa) {
    return (
      <AppShell titulo="Mesa não encontrada">
        <section className="border-line bg-surface rounded-lg border p-8 text-center">
          <p className="text-parchment text-[17px]">Esta mesa não existe nesta configuração.</p>
          <p className="text-muted mx-auto mt-2 max-w-md text-[13px] leading-relaxed">
            Confira a configuração da operação para ver as mesas disponíveis.
          </p>
          <Action variante="primaria" className="mt-5" onClick={voltar}>
            <ArrowLeft className="size-4" />
            Voltar
          </Action>
        </section>
      </AppShell>
    );
  }

  const abas: { chave: string; rotulo: string; valor: number }[] = [
    { chave: "todos", rotulo: "Todos", valor: conta.subtotal },
    ...pessoas.map((p) => ({
      chave: p.pessoa_id,
      rotulo: p.nome,
      valor: porPessoa.get(p.pessoa_id) ?? 0,
    })),
    { chave: compartilhado, rotulo: "Compart.", valor: porPessoa.get(compartilhado) ?? 0 },
  ];

  function enviar() {
    const enviados = enviarPedido(mesa_id);
    if (!enviados) {
      notificar("Nenhum item novo para enviar. Lance um item antes.", "atencao");
      return;
    }
    notificar(
      `${enviados} ${enviados === 1 ? "item enviado" : "itens enviados"} para cozinha e bar.`,
      "sucesso",
    );
  }

  function pedirFechamento() {
    if (!conta.itens) {
      notificar("A comanda está vazia. Lance itens antes de pedir o fechamento.", "atencao");
      return;
    }
    if (conta.novos) {
      notificar(
        `${conta.novos} ${conta.novos === 1 ? "item ainda não foi enviado" : "itens ainda não foram enviados"} para a produção.`,
        "atencao",
      );
      return;
    }
    if (itens.some((item) => item.status === "cancelamento_solicitado")) {
      notificar(
        "Resolva os cancelamentos pendentes com a gerência antes de pedir o fechamento.",
        "atencao",
      );
      return;
    }
    if (!pessoas.length) {
      notificar("Adicione pelo menos uma pessoa antes de pedir o fechamento.", "atencao");
      return;
    }
    const ok = solicitarFechamento(mesa_id);
    notificar(
      ok
        ? `Mesa ${mesaLabel(mesa_id)} entrou na fila do caixa. O pagamento é encerrado no caixa.`
        : `Mesa ${mesaLabel(mesa_id)} já está na fila do caixa.`,
      ok ? "sucesso" : "info",
    );
  }

  function encerrarSemConsumoDaMesa(motivo: MotivoSemConsumo, observacao: string) {
    const resultado = encerrarSemConsumo({ mesa_id, motivo, observacao });
    if (!resultado.ok) {
      notificar(resultado.erro, "atencao");
      setSemConsumoAberto(false);
      return;
    }
    setSemConsumoAberto(false);
    setAba("todos");
    setDesfazer({
      encerramento_id: resultado.registro.encerramento_id,
      ate: Date.now() + DESFAZER_SEM_CONSUMO_MS,
    });
    notificar("Mesa liberada sem consumo.", "sucesso");
  }

  function desfazerLiberacao() {
    if (!desfazer) return;
    const ok = desfazerEncerramentoSemConsumo(desfazer.encerramento_id);
    setDesfazer(null);
    notificar(
      ok
        ? `Mesa ${mesaLabel(mesa_id)} reaberta como estava antes do encerramento.`
        : "Não foi possível desfazer: a mesa já foi usada de novo.",
      ok ? "sucesso" : "atencao",
    );
  }

  function criarPessoa() {
    const pessoa = adicionarPessoa(mesa_id, novaPessoa);
    if (!pessoa) {
      notificar("Escreva o nome ou o apelido da pessoa.", "atencao");
      return;
    }
    setNovaPessoa("");
    setAba(pessoa.pessoa_id);
    notificar(`${pessoa.nome} entrou na Mesa ${mesaLabel(mesa_id)}.`, "sucesso");
  }

  const subtitulo = mesa.ativa
    ? `${pessoas.length} ${pessoas.length === 1 ? "pessoa" : "pessoas"} · aberta há ${desde(mesa.abertaEm)} · consumo separado por pessoa`
    : "Mesa livre";

  return (
    <AppShell titulo={`Mesa ${mesaLabel(mesa_id)} · comanda`} subtitulo={subtitulo}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Action variante="fantasma" onClick={voltar} data-testid="voltar">
          <ArrowLeft className="size-4" />
          {perfilAtivo === "gerencia" ? "Salão" : "Minhas mesas"}
        </Action>
      </div>

      {desfazer ? (
        <section
          className="border-bronze/60 bg-surface-2 mb-4 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3"
          data-testid="desfazer-sem-consumo"
        >
          <p className="text-parchment min-w-0 flex-1 text-[13px] leading-relaxed">
            Mesa {mesaLabel(mesa_id)} liberada sem consumo. Nenhuma cobrança, pagamento ou NFC-e
            foi gerada.
          </p>
          <Action onClick={desfazerLiberacao} data-testid="botao-desfazer-sem-consumo">
            <Undo2 className="size-4" />
            Desfazer ({restante}s)
          </Action>
        </section>
      ) : null}

      {!mesa.ativa ? (
        <section className="border-line bg-surface vh-grain relative overflow-hidden rounded-lg border p-6 text-center sm:p-10">
          <p className="font-display text-gold text-[12px] tracking-[0.26em] uppercase">
            Mesa {mesaLabel(mesa_id)}
          </p>
          <h2 className="text-parchment mt-3 text-[28px] leading-tight sm:text-[34px]">
            {conta.itens ? "Comanda encerrada" : "Mesa livre"}
          </h2>
          <RuneDivider className="mx-auto mt-4 max-w-xs" />
          <p className="text-muted mx-auto mt-4 max-w-md text-[13px] leading-relaxed">
            {podeLancar
              ? "Abrir a mesa inicia uma comanda em branco: você adiciona as pessoas e lança os itens."
              : "Esta mesa não tem comanda aberta neste momento."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {podeLancar ? (
              <Action
                variante="primaria"
                onClick={() => {
                  abrirMesa(mesa_id);
                  notificar(`Mesa ${mesaLabel(mesa_id)} aberta.`, "sucesso");
                }}
                data-testid="abrir-mesa"
              >
                <DoorOpen className="size-4" />
                Abrir mesa
              </Action>
            ) : null}
            <Action onClick={voltar}>Voltar</Action>
          </div>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_336px] xl:items-start">
          <section className="min-w-0">
            {/* Abas por pessoa: rolagem horizontal no celular, nada escondido em menu. */}
            <div className="border-line -mx-4 mb-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
              <div
                className="flex min-w-max gap-1 lg:min-w-0 lg:flex-wrap"
                role="tablist"
                aria-label="Filtrar itens por pessoa"
              >
                {abas.map((item) => {
                  const selecionado = item.chave === aba;
                  return (
                    <button
                      key={item.chave}
                      type="button"
                      role="tab"
                      aria-selected={selecionado}
                      onClick={() => setAba(item.chave)}
                      data-testid={`aba-${item.rotulo}`}
                      className={`font-display min-h-11 rounded-t-md px-3.5 pb-2.5 text-[12px] tracking-[0.1em] whitespace-nowrap uppercase transition-colors duration-150 ${
                        selecionado
                          ? "text-gold border-gold border-b-2"
                          : "text-muted hover:text-parchment border-b-2 border-transparent"
                      }`}
                    >
                      {item.rotulo}
                      <span className="vh-tabular text-muted ml-2 text-[12px] normal-case">
                        {money(item.valor)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <SectionHeading
              eyebrow={
                aba === "todos"
                  ? "Comanda completa"
                  : `Consumo · ${aba === compartilhado ? COMPARTILHADO : nomeDaPessoa(aba)}`
              }
              title={`${visiveis.length} ${visiveis.length === 1 ? "item" : "itens"}`}
              hint="Itens novos ainda não foram para a produção. Só saem quando você envia o pedido."
              action={
                podeLancar ? (
                  <Action
                    variante="tracejada"
                    onClick={() => setCardapioAberto(true)}
                    data-testid="adicionar-item"
                  >
                    <Plus className="size-4" />
                    Adicionar item
                  </Action>
                ) : null
              }
            />

            {visiveis.length ? (
              <ul className="grid gap-2">
                {visiveis.map((item) => (
                  <LinhaItem
                    key={item.item_id}
                    item={item}
                    perfil={perfilAtivo}
                    pessoa={nomeDaPessoa(item.pessoa_id)}
                    onQuantidade={(i, delta) => alterarQuantidade(i.item_id, delta)}
                    onRemover={(i) => removerItem(i.item_id)}
                    onEntregar={(i) => {
                      marcarEntregue(i.item_id);
                      notificar(`${i.name} marcado como entregue na mesa.`, "sucesso");
                    }}
                    onCancelar={(i) => {
                      solicitarCancelamento(i.item_id);
                      notificar(
                        "Cancelamento pedido. A gerência autoriza antes de sair da conta.",
                        "atencao",
                      );
                    }}
                    onAutorizar={(i) => {
                      autorizarCancelamento(i.item_id);
                      notificar(`${i.name} cancelado e retirado da conta.`, "sucesso");
                    }}
                    onRecusar={(i) => {
                      recusarCancelamento(i.item_id);
                      notificar(`${i.name} mantido na conta.`, "info");
                    }}
                  />
                ))}
              </ul>
            ) : (
              <div className="border-line text-muted rounded-md border border-dashed p-8 text-center text-[13px]">
                Nenhum item {aba === "todos" ? "na comanda" : "para esta pessoa"} ainda.
              </div>
            )}

            {podeLancar ? (
              <div className="border-line bg-surface-2 mt-4 rounded-md border p-3.5">
                <p className="font-display text-muted text-[12px] tracking-[0.18em] uppercase">
                  Chegou mais gente na mesa
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <input
                    value={novaPessoa}
                    onChange={(evento) => setNovaPessoa(evento.target.value)}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter") criarPessoa();
                    }}
                    placeholder="Nome ou apelido"
                    aria-label="Nome da pessoa que entrou na mesa"
                    data-testid="nova-pessoa"
                    className="border-line bg-surface text-parchment placeholder:text-muted/70 focus:border-gold min-h-11 min-w-0 flex-1 rounded-md border px-3 text-[14px] outline-none"
                  />
                  <Action onClick={criarPessoa} data-testid="adicionar-pessoa">
                    <UserPlus className="size-4" />
                    Adicionar pessoa
                  </Action>
                </div>
              </div>
            ) : null}

            <RuneDivider className="mt-6 xl:hidden" />
          </section>

          {/* Resumo e acoes. No celular vira bloco no fim da pagina, sem cartao flutuante. */}
          <aside className="border-line bg-surface-2 mt-2 rounded-lg border xl:sticky xl:top-24 xl:mt-0">
            <div className="divide-line divide-y">
              <div className="px-4 py-3.5">
                <p className="font-display text-gold text-[12px] tracking-[0.22em] uppercase">
                  Resumo da mesa
                </p>
              </div>

              <div className="px-4 py-3">
                <dl className="text-muted grid grid-cols-[1fr_auto] gap-y-2 text-[13px]">
                  <dt>Consumo</dt>
                  <dd className="vh-tabular text-parchment text-right">{money(conta.subtotal)}</dd>
                  <dt>
                    Serviço {Math.round(TAXA_SERVICO * 100)}%
                    {conta.servicoIncluso ? "" : " (retirado)"}
                  </dt>
                  <dd className="vh-tabular text-parchment text-right">{money(conta.servico)}</dd>
                </dl>
                <p className="text-muted mt-2 text-[12px] leading-relaxed">
                  Incluir ou retirar a taxa de serviço é decisão do caixa.
                </p>
              </div>

              <div className="bg-surface-3 flex items-baseline justify-between px-4 py-3">
                <p className="font-display text-parchment text-[12px] tracking-[0.14em] uppercase">
                  Total
                </p>
                <p
                  className="font-display vh-tabular text-gold-bright text-[26px] tracking-[0.03em]"
                  data-testid="total-mesa"
                >
                  {money(conta.total)}
                </p>
              </div>

              <div className="px-4 py-3">
                <p className="font-display text-muted mb-2 text-[12px] tracking-[0.2em] uppercase">
                  Prévia por pessoa
                </p>
                {conta.divisao.length ? (
                  <ul className="grid gap-1.5">
                    {conta.divisao.map((linha) => (
                      <li
                        key={linha.pessoa_id}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <span className="text-parchment truncate text-[13px]">{linha.pessoa}</span>
                        <span className="vh-tabular text-muted text-[13px]">
                          {money(linha.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted text-[12px]">
                    Adicione as pessoas da mesa para ver a divisão.
                  </p>
                )}
              </div>

              {conta.prontos ? (
                <div className="px-4 py-3">
                  <StatusPill
                    label={`${conta.prontos} ${conta.prontos === 1 ? "item pronto" : "itens prontos"} para levar`}
                    color="var(--vh-moss)"
                    strong
                  />
                </div>
              ) : null}

              {podeLancar ? (
                <div className="grid gap-2 px-4 py-4">
                  <Action
                    variante="primaria"
                    full
                    onClick={() => envio.executar(enviar)}
                    disabled={enviando || !conta.novos}
                    aria-disabled={enviando || !conta.novos}
                    data-testid="enviar-pedido"
                  >
                    <Send className="size-4" />
                    {enviando ? "Enviando…" : "Enviar pedido"}
                    {conta.novos ? (
                      <span className="bg-void/25 vh-tabular ml-1 rounded-sm px-1.5 text-[12px]">
                        {conta.novos}
                      </span>
                    ) : null}
                  </Action>
                  <Action
                    full
                    onClick={() => fechamento.executar(pedirFechamento)}
                    disabled={mesa.contaSolicitada || fechando}
                    aria-disabled={mesa.contaSolicitada || fechando}
                    data-testid="solicitar-fechamento"
                  >
                    <BellRing className="size-4" />
                    {mesa.contaSolicitada
                      ? "Na fila do caixa"
                      : fechando
                        ? "Enviando…"
                        : "Solicitar fechamento"}
                  </Action>
                  {/* Mesa aberta que nao consumiu nada: libera sem cobranca, pagamento ou NFC-e.
                      Aparece so quando nada foi enviado a producao e o fechamento nao comecou. */}
                  {semConsumo.elegivel && semConsumo.permitido ? (
                    <Action
                      full
                      onClick={() => setSemConsumoAberto(true)}
                      data-testid="encerrar-sem-consumo"
                    >
                      <DoorClosed className="size-4" />
                      Encerrar sem consumo
                    </Action>
                  ) : null}
                  <p className="text-muted mt-1 flex items-start gap-1.5 text-[12px] leading-relaxed">
                    <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    O garçom pede o fechamento; a divisão e o encerramento acontecem no caixa.
                  </p>
                  {semConsumo.elegivel && semConsumo.permitido ? (
                    <p className="text-muted text-[12px] leading-relaxed">
                      Sem nenhum consumo lançado, a mesa pode ser liberada sem gerar cobrança nem
                      documento fiscal.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-muted text-[12px] leading-relaxed">
                    Perfil {perfilNome[perfilAtivo]}: esta tela é somente leitura. O lançamento de
                    itens é do garçom.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <MenuSheet
        open={cardapioAberto}
        onClose={() => setCardapioAberto(false)}
        mesa_id={mesa_id}
      />

      <SemConsumoSheet
        open={semConsumoAberto}
        onClose={() => setSemConsumoAberto(false)}
        mesa_id={mesa_id}
        rascunhos={semConsumo.rascunhos}
        onConfirmar={encerrarSemConsumoDaMesa}
      />
    </AppShell>
  );
}
