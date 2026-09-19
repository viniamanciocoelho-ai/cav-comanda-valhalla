import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Funcionario } from "../lib/types";
import { client, SESSION_TOKEN_KEY } from "../lib/api";
import { carregarSessaoOffline, salvarSessaoOffline } from "../lib/offline";

interface Sessao {
  token: string;
  organizacaoId: string;
  funcionario: Funcionario;
}

interface SessaoContextValue {
  sessao: Sessao | null;
  verificando: boolean;
  estadoRestaurado: EstadoRemoto | null;
  carregarEstadoInicial: () => Promise<EstadoRemoto>;
  entrar: (organizacao: string, pin: string) => Promise<void>;
  sair: () => void;
}

type EstadoRemoto = Awaited<ReturnType<typeof client.comanda.estado>>;

const SessaoContext = createContext<SessaoContextValue | null>(null);
let estadoEmCache:
  | { token: string; expiraEm: number; promessa: Promise<EstadoRemoto> }
  | undefined;

function estadoDaSessao(token: string) {
  if (
    estadoEmCache?.token === token &&
    estadoEmCache.expiraEm > Date.now()
  ) {
    return estadoEmCache.promessa;
  }
  const promessa = client.comanda.estado();
  estadoEmCache = {
    token,
    expiraEm: Date.now() + 5_000,
    promessa,
  };
  void promessa.catch(() => {
    if (estadoEmCache?.promessa === promessa) estadoEmCache = undefined;
  });
  return promessa;
}

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [estadoRestaurado, setEstadoRestaurado] = useState<EstadoRemoto | null>(null);
  const [verificando, setVerificando] = useState(() =>
    typeof window !== "undefined" && Boolean(window.localStorage.getItem(SESSION_TOKEN_KEY)),
  );

  useEffect(() => {
    const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return;
    estadoDaSessao(token)
      .then((resultado) => {
        setEstadoRestaurado(resultado);
        setSessao({
          token,
          organizacaoId: resultado.organizacaoId,
          funcionario: resultado.funcionario,
        });
        salvarSessaoOffline({
          token,
          organizacaoId: resultado.organizacaoId,
          funcionario: resultado.funcionario,
        });
      })
      .catch(() => {
        const conhecida = carregarSessaoOffline(token);
        if (conhecida) {
          setSessao(conhecida);
        } else {
          window.localStorage.removeItem(SESSION_TOKEN_KEY);
        }
      })
      .finally(() => setVerificando(false));
  }, []);

  async function entrar(organizacao: string, pin: string) {
    const resultado = await client.auth.login({ organizacao, pin });
    window.localStorage.setItem(SESSION_TOKEN_KEY, resultado.token);
    estadoEmCache = undefined;
    setEstadoRestaurado(null);
    salvarSessaoOffline(resultado);
    setSessao(resultado);
    setVerificando(false);
  }

  function sair() {
    const revogacao = window.localStorage.getItem(SESSION_TOKEN_KEY)
      ? client.auth.logout()
      : Promise.resolve();
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    estadoEmCache = undefined;
    setEstadoRestaurado(null);
    setSessao(null);
    void revogacao.catch(() => undefined);
  }

  const carregarEstadoInicial = useCallback(() => {
    const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return Promise.reject(new Error("Sessão não encontrada."));
    return estadoDaSessao(token);
  }, []);

  return (
    <SessaoContext.Provider
      value={{
        sessao,
        verificando,
        estadoRestaurado,
        carregarEstadoInicial,
        entrar,
        sair,
      }}
    >
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao() {
  const contexto = useContext(SessaoContext);
  if (!contexto) throw new Error("useSessao precisa estar dentro de SessaoProvider");
  return contexto;
}
