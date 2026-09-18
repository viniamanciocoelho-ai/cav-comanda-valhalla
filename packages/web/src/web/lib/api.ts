import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "../../api";

export const SESSION_TOKEN_KEY = "cav-comanda-session";

const link = new RPCLink({
  url: `${typeof window === "undefined" ? "http://localhost" : window.location.origin}/api/rpc`,
  headers: () => {
    if (typeof window === "undefined") return {};
    const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});

/** Direct typed client: await client.ping() */
export const client: AppRouterClient = createORPCClient(link);

/** TanStack Query helpers: useQuery(orpc.ping.queryOptions()) */
export const orpc = createTanstackQueryUtils(client);
