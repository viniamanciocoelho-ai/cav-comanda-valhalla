import { useEffect, useState } from "react";
import { Bluetooth, Copy, Printer, Smartphone } from "lucide-react";
import {
  adaptadorImpressao,
  conectarImpressoraBluetooth,
  EVENTO_IMPRESSAO_LOCAL,
  estadoImpressaoLocal,
  lerConfiguracaoImpressaoLocal,
  salvarConfiguracaoImpressaoLocal,
  type ConfiguracaoImpressaoLocal,
  type EstadoImpressaoLocal,
  type MetodoImpressaoLocal,
} from "../lib/impressao-local";
import type { PaginaCodigo } from "../lib/recibo";
import { Action } from "./ui/action";
import { StatusPill } from "./ui/pieces";

const metodos: { value: MetodoImpressaoLocal; label: string }[] = [
  { value: "bluetooth", label: "Bluetooth direto (BLE)" },
  { value: "rawbt", label: "RawBT (Bluetooth clássico)" },
  { value: "navegador", label: "Impressão do navegador" },
];

const paginas: { value: PaginaCodigo; label: string }[] = [
  { value: 3, label: "PC860 (3)" },
  { value: 2, label: "PC850 (2)" },
  { value: 19, label: "PC858 (19)" },
  { value: 16, label: "WPC1252 (16)" },
];

function textoDiagnostico(configuracao: ConfiguracaoImpressaoLocal, estado: EstadoImpressaoLocal) {
  return [
    "CAV Valhalla - diagnóstico da impressora",
    `Método: ${configuracao.metodo}`,
    `Página de código: ${configuracao.paginaCodigo}`,
    `Web Bluetooth: ${estado.bluetoothDisponivel ? "sim" : "não"}`,
    `Contexto HTTPS seguro: ${estado.contextoSeguro ? "sim" : "não"}`,
    `Chrome: ${estado.chromeVersao}`,
    `Conectada: ${estado.conectado ? "sim" : "não"}`,
    `Dispositivo: ${estado.dispositivoNome || "não selecionado"}`,
    `Serviços: ${estado.servicos.join(", ") || "nenhum"}`,
    `Características: ${estado.caracteristicas.join(", ") || "nenhuma"}`,
    `Serviço escolhido: ${estado.servicoEscolhido || "nenhum"}`,
    `Característica escolhida: ${estado.caracteristicaEscolhida || "nenhuma"}`,
    `Último erro: ${estado.ultimoErro || "nenhum"}`,
  ].join("\n");
}

export function ImpressoraLocalPanel({
  notificar,
}: {
  notificar: (texto: string, tom?: "info" | "sucesso" | "atencao") => void;
}) {
  const [configuracao, setConfiguracao] = useState(lerConfiguracaoImpressaoLocal);
  const [estado, setEstado] = useState(estadoImpressaoLocal);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    const atualizar = () => {
      // oxlint-disable-next-line react/set-state-in-effect
      setConfiguracao(lerConfiguracaoImpressaoLocal());
      setEstado(estadoImpressaoLocal());
    };
    window.addEventListener(EVENTO_IMPRESSAO_LOCAL, atualizar);
    return () => window.removeEventListener(EVENTO_IMPRESSAO_LOCAL, atualizar);
  }, []);

  function atualizarConfiguracao(parcial: Partial<ConfiguracaoImpressaoLocal>) {
    setConfiguracao(salvarConfiguracaoImpressaoLocal(parcial));
    setEstado(estadoImpressaoLocal());
  }

  function conectar() {
    setProcessando(true);
    const tentativa = conectarImpressoraBluetooth();
    void tentativa
      .then(() => {
        notificar("Impressora Bluetooth conectada.", "sucesso");
      })
      .catch((erro) => {
        notificar(
          erro instanceof Error ? erro.message : "Não foi possível conectar à impressora.",
          "atencao",
        );
      })
      .finally(() => {
        setProcessando(false);
        setEstado(estadoImpressaoLocal());
      });
  }

  function testar() {
    setProcessando(true);
    const teste = adaptadorImpressao.testar();
    void teste
      .then(() => {
        notificar("Teste de impressão enviado.", "sucesso");
      })
      .catch((erro) => {
        notificar(erro instanceof Error ? erro.message : "Não foi possível imprimir.", "atencao");
      })
      .finally(() => {
        setProcessando(false);
        setEstado(estadoImpressaoLocal());
      });
  }

  function copiarDiagnostico() {
    const copia = navigator.clipboard?.writeText(textoDiagnostico(configuracao, estado));
    if (!copia) {
      notificar("O Chrome não permitiu copiar. Selecione o diagnóstico manualmente.", "atencao");
      return;
    }
    void copia
      .then(() => notificar("Diagnóstico copiado.", "sucesso"))
      .catch(() => notificar("O Chrome não permitiu copiar o diagnóstico.", "atencao"));
  }

  const sugerirRawBt =
    configuracao.metodo === "bluetooth" &&
    /BLE|canal|característica|Bluetooth clássico|Web Bluetooth/i.test(estado.ultimoErro);

  return (
    <div className="border-line mb-6 border-b pb-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-parchment text-[14px] tracking-[0.08em] uppercase">
            Impressora deste celular
          </p>
          <p className="text-muted mt-1 max-w-3xl text-[12px] leading-relaxed">
            A conexão fica somente neste aparelho. Para a KPrinter, tente BLE; se ela aparecer
            apenas como Bluetooth clássico, use o RawBT.
          </p>
        </div>
        <StatusPill
          label={estado.conectado ? "Bluetooth conectado" : "Sem conexão BLE"}
          color={estado.conectado ? "var(--vh-moss)" : "var(--vh-bronze)"}
          strong={estado.conectado}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
        <label className="text-muted text-[12px]">
          Método de impressão
          <select
            aria-label="Método de impressão"
            value={configuracao.metodo}
            onChange={(evento) =>
              atualizarConfiguracao({
                metodo: evento.target.value as MetodoImpressaoLocal,
              })
            }
            className="border-line bg-surface-2 text-parchment mt-2 min-h-11 w-full rounded-md border px-3 text-[14px]"
          >
            {metodos.map((metodo) => (
              <option key={metodo.value} value={metodo.value}>
                {metodo.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted text-[12px]">
          Página de código
          <select
            aria-label="Página de código da impressora"
            value={configuracao.paginaCodigo}
            onChange={(evento) =>
              atualizarConfiguracao({
                paginaCodigo: Number(evento.target.value) as PaginaCodigo,
              })
            }
            className="border-line bg-surface-2 text-parchment mt-2 min-h-11 w-full rounded-md border px-3 text-[14px]"
          >
            {paginas.map((pagina) => (
              <option key={pagina.value} value={pagina.value}>
                {pagina.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          {configuracao.metodo === "bluetooth" ? (
            <Action
              variante="secundaria"
              disabled={processando}
              onClick={conectar}
              data-testid="conectar-impressora-bluetooth"
            >
              <Bluetooth className="size-4" />
              Conectar impressora
            </Action>
          ) : null}
          <Action
            variante="tracejada"
            disabled={processando}
            onClick={testar}
            data-testid="teste-impressora-local"
          >
            <Printer className="size-4" />
            Teste de impressão
          </Action>
        </div>
      </div>

      {estado.ultimoErro ? (
        <div
          className="border-ember/60 bg-ember/10 text-parchment mt-4 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-[13px]"
          data-testid="erro-impressora-local"
        >
          <p className="min-w-0 flex-1">{estado.ultimoErro}</p>
          {sugerirRawBt ? (
            <Action variante="tracejada" onClick={() => atualizarConfiguracao({ metodo: "rawbt" })}>
              <Smartphone className="size-4" />
              Usar RawBT
            </Action>
          ) : null}
        </div>
      ) : null}

      <details className="border-line mt-4 border-t pt-4">
        <summary className="font-display text-gold cursor-pointer text-[12px] tracking-[0.12em] uppercase">
          Diagnóstico da impressora
        </summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <pre className="border-line bg-surface-2 text-muted max-h-64 overflow-auto rounded-md border p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
            {textoDiagnostico(configuracao, estado)}
          </pre>
          <Action variante="secundaria" onClick={copiarDiagnostico}>
            <Copy className="size-4" />
            Copiar diagnóstico
          </Action>
        </div>
      </details>
    </div>
  );
}
