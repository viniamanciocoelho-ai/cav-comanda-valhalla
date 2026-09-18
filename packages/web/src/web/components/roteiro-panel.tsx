// Painel do roteiro da reuniao. Orienta sem bloquear: avanca a mao (Anterior/Proximo) e
// tambem marca o passo sozinho quando a acao acontece de verdade no estado.

import { Check, ChevronLeft, ChevronRight, ListChecks, X } from "lucide-react";
import { passosRoteiro } from "../lib/roteiro";
import { perfilNome } from "../lib/format";
import { useComanda } from "./comanda-provider";
import { Action, IconAction } from "./ui/action";
import { DemoTag } from "./ui/pieces";

export function RoteiroTrigger({
  aberto,
  passo,
  onClick,
}: {
  aberto: boolean;
  passo: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aberto}
      data-testid="alternar-roteiro"
      aria-label={`${aberto ? "Fechar" : "Abrir"} roteiro da demonstração. Passo ${passo} de ${passosRoteiro.length}`}
      className={`font-display flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-2.5 text-[12px] tracking-[0.12em] uppercase transition-colors duration-150 sm:px-3 ${
        aberto
          ? "border-gold/70 bg-surface-3 text-gold"
          : "border-line bg-surface-2 text-muted hover:border-gold/70 hover:text-parchment"
      }`}
    >
      <ListChecks className="size-[18px] shrink-0" aria-hidden="true" />
      <span className="hidden lg:inline">Roteiro</span>
      <span className="vh-tabular">
        {passo}/{passosRoteiro.length}
      </span>
    </button>
  );
}

export function RoteiroPanel() {
  const { roteiroAberto, alternarRoteiro, passoAtual, irParaPasso, concluidos } = useComanda();

  if (!roteiroAberto) return null;

  const total = passosRoteiro.length;
  const feitos = passosRoteiro.filter((p) => concluidos.includes(p.evento)).length;
  const emFoco = passosRoteiro.find((p) => p.numero === passoAtual);

  return (
    <>
      {/* No celular o painel cobre a tela; do tablet em diante fica encostado na direita. */}
      <div
        className="bg-void/60 fixed inset-0 z-40 lg:hidden"
        onClick={() => alternarRoteiro(false)}
        aria-hidden="true"
      />

      <aside
        className="border-line bg-surface fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col rounded-t-lg border-t shadow-[var(--vh-shadow)] sm:inset-x-auto sm:right-0 sm:bottom-0 sm:top-0 sm:max-h-none sm:w-[360px] sm:rounded-none sm:border-t-0 sm:border-l"
        aria-label="Roteiro da demonstração"
        data-testid="painel-roteiro"
      >
        <header className="border-line vh-plate flex items-start gap-3 border-b px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="font-display text-gold text-[12px] tracking-[0.2em] uppercase">
              Roteiro da reunião
            </p>
            <p className="text-parchment mt-1 text-[17px] tracking-[0.05em]">
              Passo {passoAtual} de {total}
            </p>
            <p className="text-muted mt-1 text-[12px]">
              {feitos} {feitos === 1 ? "ação confirmada" : "ações confirmadas"} no sistema
            </p>
          </div>
          <IconAction label="Fechar roteiro" onClick={() => alternarRoteiro(false)}>
            <X className="size-[18px]" />
          </IconAction>
        </header>

        {emFoco ? (
          <div className="border-line bg-surface-2 border-b px-4 py-3.5">
            <p className="font-display text-muted text-[12px] tracking-[0.16em] uppercase">
              Agora · perfil {perfilNome[emFoco.perfil]}
            </p>
            <p className="text-parchment mt-1.5 text-[15px] leading-snug">{emFoco.titulo}</p>
            <p className="text-muted mt-1.5 text-[13px] leading-relaxed">{emFoco.detalhe}</p>
          </div>
        ) : null}

        <ol className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {passosRoteiro.map((passo) => {
            const concluido = concluidos.includes(passo.evento);
            const foco = passo.numero === passoAtual;

            return (
              <li key={passo.numero}>
                <button
                  type="button"
                  onClick={() => irParaPasso(passo.numero)}
                  aria-current={foco ? "step" : undefined}
                  data-testid={`roteiro-passo-${passo.numero}`}
                  className={`flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors duration-150 ${
                    foco ? "bg-surface-3" : "hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`font-display vh-tabular mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border text-[12px] ${
                      concluido
                        ? "border-moss/60 bg-moss/15 text-moss"
                        : foco
                          ? "border-gold/70 text-gold"
                          : "border-line text-muted"
                    }`}
                    aria-hidden="true"
                  >
                    {concluido ? <Check className="size-4" /> : passo.numero}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13px] leading-snug ${
                        concluido ? "text-muted line-through" : "text-parchment"
                      }`}
                    >
                      {passo.titulo}
                    </span>
                    <span className="font-display text-muted mt-1 block text-[12px] tracking-[0.12em] uppercase">
                      {perfilNome[passo.perfil]}
                      {concluido ? " · feito" : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <footer
          className="border-line bg-surface-2 border-t px-4 py-3.5"
          style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-2">
            <Action
              full
              onClick={() => irParaPasso(passoAtual - 1)}
              disabled={passoAtual <= 1}
              data-testid="roteiro-anterior"
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Action>
            <Action
              variante="primaria"
              full
              onClick={() => irParaPasso(passoAtual + 1)}
              disabled={passoAtual >= total}
              data-testid="roteiro-proximo"
            >
              Próximo
              <ChevronRight className="size-4" />
            </Action>
          </div>
          <DemoTag className="mt-3">Roteiro orienta, não bloqueia</DemoTag>
        </footer>
      </aside>
    </>
  );
}
