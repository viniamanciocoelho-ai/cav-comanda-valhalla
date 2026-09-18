import { lazy, Suspense } from "react";
import { Route, Router, Switch } from "wouter";
import { useBrowserLocation } from "wouter/use-browser-location";
import { useHashLocation } from "wouter/use-hash-location";
import { Provider } from "./components/provider";
import { GuardaRota } from "./components/guarda-rota";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

const Index = lazy(() => import("./pages/index"));
const Mesa = lazy(() => import("./pages/mesa"));
const Garcom = lazy(() => import("./pages/garcom"));
const Caixa = lazy(() => import("./pages/caixa"));
const Producao = lazy(() => import("./pages/producao"));
const Fechamentos = lazy(() => import("./pages/fechamentos"));
const Configuracao = lazy(() => import("./pages/configuracao"));

const executandoDeArquivo =
  typeof window !== "undefined" && window.location.protocol === "file:";
const locationHook = executandoDeArquivo ? useHashLocation : useBrowserLocation;

function App() {
  return (
    <Router hook={locationHook}>
      <Provider>
        {/* Toda rota passa pela guarda: a tela proibida para o perfil ativo nem chega a montar. */}
        <GuardaRota>
          <Suspense
            fallback={
              <div className="bg-void text-muted grid min-h-dvh place-items-center text-[13px]">
                Carregando tela…
              </div>
            }
          >
            <Switch>
              <Route path="/" component={Index} />
              <Route path="/garcom" component={Garcom} />
              <Route path="/mesa/:id" component={Mesa} />
              <Route path="/caixa" component={Caixa} />
              <Route path="/producao" component={Producao} />
              <Route path="/fechamentos" component={Fechamentos} />
              <Route path="/configuracao" component={Configuracao} />
              <Route component={Index} />
            </Switch>
          </Suspense>
        </GuardaRota>
        {/* Do not remove — off by default, activated by parent iframe via postMessage */}
        {import.meta.env.DEV && <AgentFeedback />}
        {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
        {!executandoDeArquivo && <RunableBadge />}
      </Provider>
    </Router>
  );
}

export default App;
