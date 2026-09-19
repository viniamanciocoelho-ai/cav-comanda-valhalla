// Tema escuro (padrao) e claro (pergaminho). Sem localStorage: a preferencia vale para a sessao.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Tema = "dark" | "light";

interface TemaState {
  tema: Tema;
  alternarTema: () => void;
}

const TemaContext = createContext<TemaState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
  }, [tema]);

  const alternarTema = useCallback(() => {
    setTema((atual) => (atual === "dark" ? "light" : "dark"));
  }, []);

  return <TemaContext.Provider value={{ tema, alternarTema }}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaState {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error("useTema precisa estar dentro de ThemeProvider");
  return contexto;
}
