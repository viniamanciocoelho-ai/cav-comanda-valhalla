// Estrutura de todas as telas: navegacao por perfil, barra superior com a sessao atual
// e painel do roteiro demonstrativo. Cada perfil ve apenas as rotas que sao dele
// (ver lib/perfis.ts).

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChefHat,
  LayoutGrid,
  Moon,
  ReceiptText,
  ScrollText,
  SlidersHorizontal,
  Sun,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { perfilNome } from "../lib/format";
import { useAgora } from "../lib/hooks";
import { podeAcessar } from "../lib/perfis";
import { useComanda } from "./comanda-provider";
import { useTema } from "./theme-provider";
import { BrandMark } from "./ui/brand-mark";
import { IconAction } from "./ui/action";
import { DemoTag } from "./ui/pieces";
import { PerfilSheet, PerfilTrigger } from "./perfil-sheet";
import { RoteiroPanel, RoteiroTrigger } from "./roteiro-panel";
import { ToastHost } from "./toast-host";

interface Destino {
  href: string;
  titulo: string;
  curto: string;
  icone: LucideIcon;
}

const todosDestinos: Destino[] = [
  { href: "/", titulo: "Salão", curto: "Salão", icone: LayoutGrid },
  { href: "/garcom", titulo: "Minhas mesas", curto: "Mesas", icone: ScrollText },
  { href: "/producao", titulo: "Cozinha e bar", curto: "Produção", icone: ChefHat },
  { href: "/caixa", titulo: "Caixa", curto: "Caixa", icone: Wallet },
  { href: "/fechamentos", titulo: "Fechamentos", curto: "Contas", icone: ReceiptText },
  { href: "/configuracao", titulo: "Configuração", curto: "Ajustes", icone: SlidersHorizontal },
];

/**
 * Faixa livre reservada embaixo da navegacao inferior para o selo da plataforma
 * ("Made with Runable": fixo em bottom 20px, ~37px de altura). Exportada porque o conteudo
 * da pagina e os avisos usam a mesma medida.
 */
export const ALTURA_SELO = 64;

function ativo(rota: string, href: string) {
  if (href === "/") return rota === "/";
  return rota.startsWith(href);
}

function Marca({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className={`text-gold ${compacto ? "size-8" : "size-11"}`} />
      <div className="min-w-0">
        <p
          className={`font-brand text-parchment leading-none tracking-[0.2em] ${compacto ? "text-[13px]" : "text-[17px]"}`}
        >
          VALHALLA
        </p>
        <p className="font-display text-gold mt-1 text-[12px] leading-none tracking-[0.2em] uppercase">
          CAV Comanda
        </p>
      </div>
    </div>
  );
}

/** Contador exibido ao lado de cada destino, conforme o que exige atencao naquela tela. */
function useContadores() {
  const { filaAberta, prontosParaEntrega, filaCaixa, cancelamentosPendentes } = useComanda();
  return (href: string): number => {
    if (href === "/producao") return filaAberta;
    if (href === "/garcom") return prontosParaEntrega;
    if (href === "/caixa") return filaCaixa.length;
    if (href === "/") return cancelamentosPendentes.length;
    return 0;
  };
}

function useDestinos() {
  const { perfilAtivo } = useComanda();
  return todosDestinos.filter((destino) => podeAcessar(perfilAtivo, destino.href));
}

function Navegacao() {
  const [rota] = useLocation();
  const destinos = useDestinos();
  const contador = useContadores();

  return (
    <nav className="flex flex-col gap-1" aria-label="Navegação principal">
      {destinos.map((destino) => {
        const selecionado = ativo(rota, destino.href);
        const Icone = destino.icone;
        const numero = contador(destino.href);

        return (
          <Link
            key={destino.href}
            to={destino.href}
            aria-current={selecionado ? "page" : undefined}
            className={`font-display flex min-h-11 items-center gap-3 rounded-md px-3 text-[13px] tracking-[0.1em] uppercase transition-colors duration-150 ${
              selecionado
                ? "bg-surface-3 text-parchment shadow-[inset_3px_0_0_0_var(--vh-gold)]"
                : "text-muted hover:bg-surface-2 hover:text-parchment"
            }`}
          >
            <Icone className={`size-[18px] shrink-0 ${selecionado ? "text-gold" : ""}`} />
            <span className="truncate">{destino.titulo}</span>
            {numero > 0 ? (
              <span className="bg-gold text-on-accent vh-tabular ml-auto min-w-6 rounded-sm px-1.5 py-0.5 text-center text-[12px] leading-tight">
                {numero}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function BarraInferior() {
  const [rota] = useLocation();
  const destinos = useDestinos();
  const contador = useContadores();

  return (
    // O selo "Made with Runable" da plataforma e fixo no canto inferior direito (bottom 20px,
    // altura ~37px) e fica acima de tudo. O selo NAO e escondido nem deslocado: em vez disso a
    // barra reserva uma faixa livre embaixo (ALTURA_SELO), onde o selo pousa sobre o fundo da
    // propria barra, sem cobrir nenhum botao. Soma com safe-area-inset-bottom no iPhone.
    <nav
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-40 grid border-t lg:hidden"
      aria-label="Navegação principal"
      data-testid="nav-inferior"
      style={{
        paddingBottom: `calc(${ALTURA_SELO}px + env(safe-area-inset-bottom))`,
        gridTemplateColumns: `repeat(${destinos.length}, minmax(0, 1fr))`,
      }}
    >
      {destinos.map((destino) => {
        const selecionado = ativo(rota, destino.href);
        const Icone = destino.icone;
        const numero = contador(destino.href);

        return (
          <Link
            key={destino.href}
            to={destino.href}
            aria-current={selecionado ? "page" : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors duration-150 ${
              selecionado ? "text-gold bg-surface-2" : "text-muted"
            }`}
          >
            {selecionado ? (
              <span className="bg-gold absolute inset-x-3 top-0 h-0.5" aria-hidden="true" />
            ) : null}
            <span className="relative">
              <Icone className="size-5" />
              {numero > 0 ? (
                <span className="bg-ember text-on-accent vh-tabular absolute -top-1.5 -right-2 min-w-4 rounded-full px-1 text-center text-[12px] leading-4">
                  {numero}
                </span>
              ) : null}
            </span>
            <span className="font-display text-[12px] leading-none tracking-[0.06em] uppercase">
              {destino.curto}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function BarraSuperior({
  titulo,
  subtitulo,
  onTrocarPerfil,
}: {
  titulo: string;
  subtitulo?: string;
  onTrocarPerfil: () => void;
}) {
  const { tema, alternarTema } = useTema();
  const { funcionarioAtivo, alternarRoteiro, roteiroAberto, passoAtual } = useComanda();
  // Data e hora reais do dispositivo, atualizadas sozinhas (lib/hooks.ts).
  const agora = useAgora();

  return (
    <header className="border-line bg-void/95 vh-plate sticky top-0 z-30 border-b backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <p
            className="font-display text-gold mb-1 truncate text-[12px] tracking-[0.18em] uppercase"
            data-testid="data-hora"
          >
            {agora.data} · {agora.hora}
          </p>
          <h1 className="text-parchment truncate text-[19px] tracking-[0.06em] sm:text-[22px]">
            {titulo}
          </h1>
          {subtitulo ? <p className="text-muted mt-0.5 truncate text-[12px]">{subtitulo}</p> : null}
        </div>

        {/* Quem esta operando: sempre visivel, porque a producao precisa saber a autoria. */}
        <PerfilTrigger funcionario={funcionarioAtivo} onClick={onTrocarPerfil} />

        <RoteiroTrigger
          aberto={roteiroAberto}
          passo={passoAtual}
          onClick={() => alternarRoteiro()}
        />

        <BrandMark className="text-gold hidden size-9 shrink-0 xl:block" />

        <IconAction
          label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          onClick={alternarTema}
          data-testid="theme-toggle"
        >
          {tema === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </IconAction>
      </div>
    </header>
  );
}

export function AppShell({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  const { perfilAtivo, funcionarioAtivo, roteiroAberto } = useComanda();
  const [perfilAberto, setPerfilAberto] = useState(false);

  // A guarda de acesso por perfil fica em components/guarda-rota.tsx, aplicada a todas as
  // rotas de uma vez. Aqui nao se repete regra de permissao.

  return (
    // Com o roteiro aberto no desktop, o conteudo recua 360px: o painel e lateral, nao
    // cobre a barra superior nem esconde botao nenhum.
    <div
      className={`bg-void min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)] ${
        roteiroAberto ? "sm:pr-[360px]" : ""
      }`}
    >
      <aside className="border-line vh-wood vh-grain relative hidden h-dvh flex-col gap-7 border-r px-4 py-6 lg:sticky lg:top-0 lg:flex">
        <div className="px-2">
          <Marca />
        </div>

        <Navegacao />

        <div className="mt-auto grid gap-3">
          <button
            type="button"
            onClick={() => setPerfilAberto(true)}
            className="border-line bg-surface/80 hover:border-gold/70 rounded-md border p-3.5 text-left transition-colors duration-150"
            data-testid="trocar-perfil-lateral"
          >
            <p className="font-display text-muted text-[12px] tracking-[0.18em] uppercase">
              Operando como
            </p>
            <p className="text-parchment mt-1 text-[15px] tracking-[0.04em]">
              {funcionarioAtivo.funcionario_nome}
            </p>
            <p className="text-gold font-display mt-1 text-[12px] tracking-[0.14em] uppercase">
              {perfilNome[perfilAtivo]} · trocar
            </p>
          </button>

          <div className="border-line bg-surface/80 rounded-md border p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="bg-moss size-1.5 rounded-full" aria-hidden="true" />
              <p className="font-display text-parchment text-[12px] tracking-[0.14em] uppercase">
                Operação persistida
              </p>
            </div>
            <p className="text-muted text-[12px] leading-relaxed">
              Dados sincronizados entre dispositivos. O cardápio e a operação ficam gravados no
              banco; emissão fiscal e pagamento integrado permanecem fora desta fase.
            </p>
            <DemoTag className="mt-3">Brasão provisório</DemoTag>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <BarraSuperior
          titulo={titulo}
          subtitulo={subtitulo}
          onTrocarPerfil={() => setPerfilAberto(true)}
        />
        {/* pb no celular = altura da barra inferior + faixa do selo, para nada ficar encoberto. */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-5 pb-[calc(136px+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      <BarraInferior />
      <PerfilSheet open={perfilAberto} onClose={() => setPerfilAberto(false)} />
      <RoteiroPanel />
      <ToastHost />
    </div>
  );
}
