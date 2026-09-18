import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ComandaProvider } from "./comanda-provider";
import { Login } from "./login";
import { SessaoProvider, useSessao } from "./sessao-provider";
import { ThemeProvider } from "./theme-provider";

const queryClient = new QueryClient();

interface ProviderProps {
  children: React.ReactNode;
}

// App-level providers — add theme/context providers here, wrapping children.
// QueryClientProvider must stay (all API calls run through TanStack Query).
export function Provider({ children }: ProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessaoProvider>
          <SessaoGate>{children}</SessaoGate>
        </SessaoProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function SessaoGate({ children }: ProviderProps) {
  const { sessao, verificando } = useSessao();
  if (verificando) {
    return (
      <div className="bg-void text-muted grid min-h-dvh place-items-center text-[13px]">
        Restaurando sessão…
      </div>
    );
  }
  if (!sessao) return <Login />;
  return <ComandaProvider>{children}</ComandaProvider>;
}
