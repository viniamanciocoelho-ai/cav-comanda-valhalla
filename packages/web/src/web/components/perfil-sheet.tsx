import { ChefHat, LogOut, ScrollText, ShieldCheck, UserCog, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { perfilNome } from "../lib/format";
import type { Funcionario, Perfil } from "../lib/types";
import { useComanda } from "./comanda-provider";
import { Action } from "./ui/action";
import { Sheet } from "./ui/sheet";

const icones: Record<Perfil, LucideIcon> = {
  gerencia: ShieldCheck,
  garcom: ScrollText,
  producao: ChefHat,
  caixa: Wallet,
};

/** Botao da barra superior. No celular mostra so o brasao do perfil, para nao roubar largura. */
export function PerfilTrigger({
  funcionario,
  onClick,
}: {
  funcionario: Funcionario;
  onClick: () => void;
}) {
  const Icone = icones[funcionario.funcionario_perfil];

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="trocar-perfil"
      aria-label={`Operando como ${funcionario.funcionario_nome}. Trocar perfil`}
      className="border-line bg-surface-2 text-parchment hover:border-gold/70 hover:bg-surface-3 flex min-h-11 shrink-0 items-center gap-2.5 rounded-md border px-2.5 transition-colors duration-150 sm:px-3"
    >
      <Icone className="text-gold size-[18px] shrink-0" aria-hidden="true" />
      <span className="hidden min-w-0 text-left md:block">
        <span className="font-display text-muted block text-[12px] leading-none tracking-[0.14em] uppercase">
          {perfilNome[funcionario.funcionario_perfil]}
        </span>
        <span className="text-parchment mt-1 block truncate text-[13px] leading-none">
          {funcionario.funcionario_nome}
        </span>
      </span>
      <UserCog className="text-muted size-4 shrink-0" aria-hidden="true" />
    </button>
  );
}

export function PerfilSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { funcionarioAtivo, sair } = useComanda();
  const Icone = icones[funcionarioAtivo.funcionario_perfil];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      testId="dialogo-perfil"
      eyebrow="Sessão"
      title="Funcionário autenticado"
      hint="O perfil e as permissões são definidos pelo PIN usado na entrada."
      footer={
        <Action variante="tracejada" onClick={sair}>
          <LogOut className="size-4" />
          Sair
        </Action>
      }
    >
      <div className="border-line bg-surface flex items-center gap-3.5 rounded-md border p-4">
        <span
          className="border-line bg-surface-2 text-gold grid size-11 shrink-0 place-items-center rounded-md border"
          aria-hidden="true"
        >
          <Icone className="size-[18px]" />
        </span>
        <div>
          <p className="text-parchment text-[15px]">{funcionarioAtivo.funcionario_nome}</p>
          <p className="text-muted mt-1 text-[13px]">
            {perfilNome[funcionarioAtivo.funcionario_perfil]}
          </p>
        </div>
      </div>
    </Sheet>
  );
}
