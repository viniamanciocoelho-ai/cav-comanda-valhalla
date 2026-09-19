// Dialogo de lancamento de item: escolhe a pessoa, a quantidade e a observacao antes de
// lancar um produto do catalogo persistido.

import { useMemo, useState } from "react";
import { Beer, Minus, Plus, UserPlus, UtensilsCrossed } from "lucide-react";
import { COMPARTILHADO, compartilhadoId } from "../lib/operacao";
import { destinoLabel, mesaLabel, money } from "../lib/format";
import { MENU_CATEGORIAS } from "../lib/types";
import type { MenuItem } from "../lib/types";
import { useComanda } from "./comanda-provider";
import { Action } from "./ui/action";
import { Sheet } from "./ui/sheet";

const categorias = ["Todos", ...MENU_CATEGORIAS] as const;

export function MenuSheet({
  open,
  onClose,
  mesa_id,
}: {
  open: boolean;
  onClose: () => void;
  mesa_id: number;
}) {
  const { pessoasDaMesa, adicionarPessoa, adicionarItem, notificar, cardapio } = useComanda();
  const pessoas = pessoasDaMesa(mesa_id);
  const compartilhado = compartilhadoId(mesa_id);

  const [para, setPara] = useState<string>(pessoas[0]?.pessoa_id ?? compartilhado);
  const [categoria, setCategoria] = useState<(typeof categorias)[number]>("Todos");
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");
  const [novaPessoa, setNovaPessoa] = useState("");
  const [adicionados, setAdicionados] = useState(0);

  const itens = useMemo(
    () => (categoria === "Todos" ? cardapio : cardapio.filter((i) => i.categoria === categoria)),
    [cardapio, categoria],
  );
  const destinoAtual =
    para === compartilhado || pessoas.some((pessoa) => pessoa.pessoa_id === para)
      ? para
      : (pessoas[0]?.pessoa_id ?? compartilhado);

  const nomeSelecionado =
    destinoAtual === compartilhado
      ? COMPARTILHADO
      : (pessoas.find((p) => p.pessoa_id === destinoAtual)?.nome ?? "—");

  function selecionar(pessoa_id: string) {
    setPara(pessoa_id);
  }

  function criarPessoa() {
    const pessoa = adicionarPessoa(mesa_id, novaPessoa);
    if (!pessoa) {
      notificar("Informe o nome da pessoa antes de adicionar.", "atencao");
      return;
    }
    setNovaPessoa("");
    setPara(pessoa.pessoa_id);
    notificar(`${pessoa.nome} entrou na Mesa ${mesaLabel(mesa_id)}.`, "sucesso");
  }

  function adicionar(item: MenuItem) {
    adicionarItem({ mesa_id, pessoa_id: destinoAtual, produto: item, quantidade, observacao });
    setAdicionados((n) => n + quantidade);
    notificar(
      `${quantidade}× ${item.name} lançado para ${
        destinoAtual === compartilhado ? "a mesa (compartilhado)" : nomeSelecionado
      }${observacao.trim() ? ` · ${observacao.trim()}` : ""}.`,
      "sucesso",
    );
    setQuantidade(1);
    setObservacao("");
  }

  function fechar() {
    setAdicionados(0);
    setQuantidade(1);
    setObservacao("");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={fechar}
      testId="dialogo-cardapio"
      eyebrow={`Mesa ${mesaLabel(mesa_id)}`}
      title="Lançar item"
      hint="Escolha para quem é o item, ajuste quantidade e observação, depois toque no produto. O lançamento só vai para a produção quando você enviar o pedido."
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted text-[12px]">
            {adicionados
              ? `${adicionados} ${adicionados === 1 ? "item lançado" : "itens lançados"} nesta abertura`
              : "Nenhum item lançado ainda"}
          </p>
          <Action variante="primaria" onClick={fechar} data-testid="concluir-cardapio">
            Concluir
          </Action>
        </div>
      }
    >
      <fieldset className="mb-5 min-w-0">
        <legend className="font-display text-muted mb-2 text-[12px] tracking-[0.16em] uppercase">
          Item para
        </legend>
        <div className="flex flex-wrap gap-2">
          {pessoas.map((pessoa) => {
            const selecionado = pessoa.pessoa_id === destinoAtual;
            return (
              <button
                key={pessoa.pessoa_id}
                type="button"
                onClick={() => selecionar(pessoa.pessoa_id)}
                aria-pressed={selecionado}
                data-testid={`destinatario-${pessoa.nome}`}
                className={`font-display min-h-11 rounded-md border px-3.5 text-[12px] tracking-[0.1em] uppercase transition-colors duration-150 ${
                  selecionado
                    ? "border-gold bg-gold text-on-accent"
                    : "border-line bg-surface-2 text-muted hover:border-bronze hover:text-parchment"
                }`}
              >
                {pessoa.nome}
              </button>
            );
          })}
            <button
              type="button"
              onClick={() => selecionar(compartilhado)}
              aria-pressed={destinoAtual === compartilhado}
            data-testid="destinatario-Compartilhado"
            className={`font-display min-h-11 rounded-md border px-3.5 text-[12px] tracking-[0.1em] uppercase transition-colors duration-150 ${
              destinoAtual === compartilhado
                ? "border-gold bg-gold text-on-accent"
                : "border-bronze/60 bg-surface-2 text-muted border-dashed hover:text-parchment"
            }`}
          >
            Compartilhado
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="nova-pessoa">
            Nome da nova pessoa
          </label>
          <input
            id="nova-pessoa"
            aria-label="Nome da nova pessoa"
            value={novaPessoa}
            onChange={(evento) => setNovaPessoa(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                criarPessoa();
              }
            }}
            placeholder="Adicionar pessoa na mesa"
            data-testid="campo-nova-pessoa"
            className="border-line bg-surface text-parchment placeholder:text-muted focus:border-gold/70 min-h-11 min-w-0 flex-1 rounded-md border px-3 text-[14px] outline-none"
          />
          <Action variante="tracejada" onClick={criarPessoa} data-testid="adicionar-pessoa">
            <UserPlus className="size-4" />
            Incluir
          </Action>
        </div>
      </fieldset>

      <div className="mb-5 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <fieldset className="min-w-0">
          <legend className="font-display text-muted mb-2 text-[12px] tracking-[0.16em] uppercase">
            Quantidade
          </legend>
          <div className="border-line bg-surface flex items-center gap-1 rounded-md border p-1">
            <button
              type="button"
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              aria-label="Diminuir quantidade"
              disabled={quantidade <= 1}
              className="text-parchment hover:bg-surface-3 grid size-11 place-items-center rounded-sm disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span
              className="font-display vh-tabular text-parchment w-10 text-center text-[16px]"
              data-testid="quantidade-lancamento"
              aria-live="polite"
            >
              {quantidade}
            </span>
            <button
              type="button"
              onClick={() => setQuantidade((q) => Math.min(20, q + 1))}
              aria-label="Aumentar quantidade"
              className="text-parchment hover:bg-surface-3 grid size-11 place-items-center rounded-sm"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </fieldset>

        <div className="min-w-0">
          <label
            htmlFor="observacao-item"
            className="font-display text-muted mb-2 block text-[12px] tracking-[0.16em] uppercase"
          >
            Observação da cozinha
          </label>
          <input
            id="observacao-item"
            aria-label="Observação da cozinha"
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
            placeholder="Ex.: sem cebola, ponto da carne"
            data-testid="campo-observacao"
            className="border-line bg-surface text-parchment placeholder:text-muted focus:border-gold/70 min-h-11 w-full rounded-md border px-3 text-[14px] outline-none"
          />
        </div>
      </div>

      <fieldset className="mb-4 min-w-0">
        <legend className="font-display text-muted mb-2 text-[12px] tracking-[0.16em] uppercase">
          Categoria
        </legend>
        <div className="flex flex-wrap gap-2">
          {categorias.map((item) => {
            const selecionado = item === categoria;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategoria(item)}
                aria-pressed={selecionado}
                data-testid={`categoria-${item}`}
                className={`font-display min-h-11 rounded-md border px-3.5 text-[12px] tracking-[0.1em] uppercase transition-colors duration-150 ${
                  selecionado
                    ? "border-gold/70 bg-surface-3 text-gold"
                    : "border-line text-muted hover:text-parchment"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </fieldset>

      <ul className="divide-line divide-y">
        {itens.map((item) => (
          <li key={item.produto_id} className="flex items-center gap-3 py-2.5">
            <span
              className="border-line bg-surface-2 text-muted grid size-10 shrink-0 place-items-center rounded-md border"
              aria-hidden="true"
            >
              {item.destino_producao === "bar" ? (
                <Beer className="size-[18px]" />
              ) : (
                <UtensilsCrossed className="size-[18px]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-parchment truncate text-[14px]">{item.name}</p>
              <p className="text-muted text-[12px] tracking-[0.08em] uppercase">
                {destinoLabel[item.destino_producao]} · {item.categoria}
              </p>
            </div>
            <p className="font-display vh-tabular text-parchment shrink-0 text-[14px] tracking-[0.04em]">
              {money(item.price)}
            </p>
            <Action
              variante="secundaria"
              onClick={() => adicionar(item)}
              aria-label={`Lançar ${quantidade} ${item.name} para ${nomeSelecionado}`}
              data-testid={`add-${item.produto_id}`}
              className="shrink-0 px-3"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Lançar</span>
            </Action>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
