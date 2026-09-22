import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "../../api";

export const SESSION_TOKEN_KEY = "cav-comanda-session";
let tokenEmMemoria: string | null = null;

export function lerTokenSessao(): string | null {
  if (typeof window === "undefined") return tokenEmMemoria;
  try {
    const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
    if (token) tokenEmMemoria = token;
    return token ?? tokenEmMemoria;
  } catch {
    return tokenEmMemoria;
  }
}

export function salvarTokenSessao(token: string) {
  tokenEmMemoria = token;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // A sessão continua válida nesta aba quando o navegador bloquear o armazenamento.
  }
}

export function removerTokenSessao() {
  tokenEmMemoria = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Não há armazenamento persistente para limpar.
  }
}

const link = new RPCLink({
  url: `${typeof window === "undefined" ? "http://localhost" : window.location.origin}/api/rpc`,
  headers: () => {
    if (typeof window === "undefined") return {};
    const token = lerTokenSessao();
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});

/** Direct typed client: await client.ping() */
export const client: AppRouterClient = createORPCClient(link);

/** TanStack Query helpers: useQuery(orpc.ping.queryOptions()) */
export const orpc = createTanstackQueryUtils(client);
