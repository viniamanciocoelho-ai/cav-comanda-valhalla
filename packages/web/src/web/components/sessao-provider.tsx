import { createContext, useContext, useEffect, useState } from "react";
import type { Funcionario } from "../lib/types";
import { client, SESSION_TOKEN_KEY } from "../lib/api";

interface Sessao {
  token: string;
  organizacaoId: string;
  funcionario: Funcionario;
}

interface SessaoContextValue {
  sessao: Sessao | null;
  verificando: boolean;
  entrar: (organizacao: string, pin: string) => Promise<void>;
  sair: () => void;
}

const SessaoContext = createContext<SessaoContextValue | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [verificando, setVerificando] = useState(() =>
    typeof window !== "undefined" && Boolean(window.localStorage.getItem(SESSION_TOKEN_KEY)),
  );

  useEffect(() => {
    const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return;
    client.comanda
      .estado()
      .then((resultado) => {
        setSessao({
          token,
          organizacaoId: resultado.organizacaoId,
          funcionario: resultado.funcionario,
        });
      })
      .catch(() => {
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
      })
      .finally(() => setVerificando(false));
  }, []);

  async function entrar(organizacao: string, pin: string) {
    const resultado = await client.auth.login({ organizacao, pin });
    window.localStorage.setItem(SESSION_TOKEN_KEY, resultado.token);
    setSessao(resultado);
    setVerificando(false);
  }

  function sair() {
    const revogacao = window.localStorage.getItem(SESSION_TOKEN_KEY)
      ? client.auth.logout()
      : Promise.resolve();
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    setSessao(null);
    void revogacao.catch(() => undefined);
  }

  return (
    <SessaoContext.Provider value={{ sessao, verificando, entrar, sair }}>
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao() {
  const contexto = useContext(SessaoContext);
  if (!contexto) throw new Error("useSessao precisa estar dentro de SessaoProvider");
  return contexto;
}
