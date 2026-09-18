import { useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useSessao } from "./sessao-provider";
import { Action } from "./ui/action";
import { BrandMark } from "./ui/brand-mark";

export function Login() {
  const { entrar } = useSessao();
  const [organizacao, setOrganizacao] = useState("valhalla");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setErro("Informe o PIN de 4 dígitos.");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      await entrar(organizacao, pin);
    } catch {
      setErro("Organização ou PIN inválido.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="bg-void text-parchment grid min-h-dvh place-items-center px-4 py-10">
      <form
        onSubmit={enviar}
        className="border-line bg-surface w-full max-w-sm rounded-lg border p-6"
        data-testid="login-pin"
      >
        <div className="mb-6 flex items-center gap-3">
          <BrandMark className="size-12" />
          <div>
            <p className="font-display text-gold text-[12px] tracking-[0.2em] uppercase">
              CAV Comanda
            </p>
            <h1 className="text-[24px] leading-tight">Valhalla</h1>
          </div>
        </div>

        <label
          htmlFor="organizacao"
          className="font-display text-muted mb-2 block text-[12px] tracking-[0.14em] uppercase"
        >
          Organização
        </label>
        <input
          id="organizacao"
          value={organizacao}
          onChange={(evento) => setOrganizacao(evento.target.value)}
          autoComplete="organization"
          className="border-line bg-surface-2 text-parchment focus:border-gold/70 min-h-11 w-full rounded-md border px-3 outline-none"
        />

        <label
          htmlFor="pin"
          className="font-display text-muted mt-4 mb-2 block text-[12px] tracking-[0.14em] uppercase"
        >
          PIN
        </label>
        <input
          id="pin"
          value={pin}
          onChange={(evento) => setPin(evento.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="current-password"
          type="password"
          maxLength={4}
          data-testid="campo-pin"
          className="border-line bg-surface-2 text-parchment focus:border-gold/70 min-h-12 w-full rounded-md border px-3 text-center text-[24px] tracking-[0.35em] outline-none"
        />

        {erro ? (
          <p className="text-blood mt-3 text-[13px]" role="alert">
            {erro}
          </p>
        ) : null}

        <Action
          variante="primaria"
          type="submit"
          disabled={carregando}
          className="mt-5 w-full"
        >
          {carregando ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          Entrar
        </Action>
      </form>
    </main>
  );
}
