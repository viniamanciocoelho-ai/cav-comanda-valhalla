import { imprimirNoNavegador, serializarEscPos, type PaginaCodigo } from "./recibo";

export type MetodoImpressaoLocal = "bluetooth" | "rawbt" | "navegador";

export interface ConfiguracaoImpressaoLocal {
  metodo: MetodoImpressaoLocal;
  paginaCodigo: PaginaCodigo;
  dispositivoId?: string;
  dispositivoNome?: string;
  servicoUuid?: string;
  caracteristicaUuid?: string;
}

export interface EstadoImpressaoLocal {
  bluetoothDisponivel: boolean;
  contextoSeguro: boolean;
  chromeVersao: string;
  conectado: boolean;
  dispositivoNome: string;
  servicos: string[];
  caracteristicas: string[];
  servicoEscolhido: string;
  caracteristicaEscolhida: string;
  ultimoErro: string;
  temTrabalhoPendente: boolean;
}

export interface OpcoesImpressaoLocal {
  texto: string;
  largura: 58 | 80;
  metodo?: MetodoImpressaoLocal;
}

interface BluetoothCharacteristicLike {
  uuid: string;
  properties: {
    write?: boolean;
    writeWithoutResponse?: boolean;
  };
  writeValueWithoutResponse?: (valor: BufferSource) => Promise<void>;
  writeValue?: (valor: BufferSource) => Promise<void>;
  writeValueWithResponse?: (valor: BufferSource) => Promise<void>;
}

interface BluetoothServiceLike {
  uuid: string;
  getCharacteristics: () => Promise<BluetoothCharacteristicLike[]>;
}

interface BluetoothServerLike {
  getPrimaryServices: () => Promise<BluetoothServiceLike[]>;
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<BluetoothServerLike>;
  };
  addEventListener: (tipo: string, ouvinte: EventListener) => void;
}

interface BluetoothApiLike {
  requestDevice: (opcoes: {
    acceptAllDevices: boolean;
    optionalServices: string[];
  }) => Promise<BluetoothDeviceLike>;
  getDevices?: () => Promise<BluetoothDeviceLike[]>;
}

interface NavegadorBluetooth extends Navigator {
  bluetooth?: BluetoothApiLike;
}

const CHAVE_CONFIGURACAO = "cav:impressao-local:v1";
export const EVENTO_IMPRESSAO_LOCAL = "cav:estado-impressao-local";
export const SERVICOS_BLE_IMPRESSORAS = [
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "00001101-0000-1000-8000-00805f9b34fb",
];

const configuracaoPadrao: ConfiguracaoImpressaoLocal = {
  metodo: "bluetooth",
  paginaCodigo: 3,
};

let dispositivoAtual: BluetoothDeviceLike | undefined;
let caracteristicaAtual: BluetoothCharacteristicLike | undefined;
let trabalhoPendente: { bytes: Uint8Array; opcoes: OpcoesImpressaoLocal } | undefined;
const dispositivosObservados = new WeakSet<object>();

const estadoAtual: EstadoImpressaoLocal = {
  bluetoothDisponivel: false,
  contextoSeguro: false,
  chromeVersao: "",
  conectado: false,
  dispositivoNome: "",
  servicos: [],
  caracteristicas: [],
  servicoEscolhido: "",
  caracteristicaEscolhida: "",
  ultimoErro: "",
  temTrabalhoPendente: false,
};

function navegadorBluetooth() {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as NavegadorBluetooth).bluetooth;
}

function versaoChrome() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent.match(/(?:Chrome|CriOS)\/([\d.]+)/)?.[1] ?? "não identificado";
}

function publicarEstado(parcial: Partial<EstadoImpressaoLocal> = {}) {
  Object.assign(estadoAtual, parcial, {
    bluetoothDisponivel: Boolean(navegadorBluetooth()),
    contextoSeguro: typeof window !== "undefined" && window.isSecureContext,
    chromeVersao: versaoChrome(),
    temTrabalhoPendente: Boolean(trabalhoPendente),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_IMPRESSAO_LOCAL));
  }
}

export function lerConfiguracaoImpressaoLocal(): ConfiguracaoImpressaoLocal {
  if (typeof window === "undefined") return { ...configuracaoPadrao };
  try {
    const salva = JSON.parse(window.localStorage.getItem(CHAVE_CONFIGURACAO) ?? "{}");
    return {
      ...configuracaoPadrao,
      ...(salva && typeof salva === "object" ? salva : {}),
      metodo: ["bluetooth", "rawbt", "navegador"].includes(salva?.metodo)
        ? salva.metodo
        : configuracaoPadrao.metodo,
      paginaCodigo: [2, 3, 16, 19].includes(salva?.paginaCodigo)
        ? salva.paginaCodigo
        : configuracaoPadrao.paginaCodigo,
    };
  } catch {
    return { ...configuracaoPadrao };
  }
}

export function salvarConfiguracaoImpressaoLocal(parcial: Partial<ConfiguracaoImpressaoLocal>) {
  const configuracao = { ...lerConfiguracaoImpressaoLocal(), ...parcial };
  try {
    window.localStorage.setItem(CHAVE_CONFIGURACAO, JSON.stringify(configuracao));
  } catch {
    // A impressão continua disponível durante a sessão mesmo sem armazenamento local.
  }
  publicarEstado();
  return configuracao;
}

export function estadoImpressaoLocal(): EstadoImpressaoLocal {
  const configuracao = lerConfiguracaoImpressaoLocal();
  return {
    ...estadoAtual,
    bluetoothDisponivel: Boolean(navegadorBluetooth()),
    contextoSeguro: typeof window !== "undefined" && window.isSecureContext,
    chromeVersao: versaoChrome(),
    temTrabalhoPendente: Boolean(trabalhoPendente),
    dispositivoNome: estadoAtual.dispositivoNome || configuracao.dispositivoNome || "",
    servicos: [...estadoAtual.servicos],
    caracteristicas: [...estadoAtual.caracteristicas],
    servicoEscolhido: estadoAtual.servicoEscolhido || configuracao.servicoUuid || "",
    caracteristicaEscolhida:
      estadoAtual.caracteristicaEscolhida || configuracao.caracteristicaUuid || "",
  };
}

function mensagemBluetooth(erro: unknown) {
  const nome = erro instanceof DOMException ? erro.name : "";
  if (nome === "NotFoundError") {
    return "Nenhuma impressora foi selecionada.";
  }
  if (nome === "NotAllowedError") {
    return "O Chrome não recebeu permissão para acessar o Bluetooth.";
  }
  if (nome === "AbortError") {
    return "A seleção da impressora Bluetooth foi cancelada.";
  }
  if (nome === "NotSupportedError") {
    return "Este aparelho ou navegador não oferece o recurso Bluetooth necessário. Use RawBT.";
  }
  if (nome === "SecurityError") {
    return "O Bluetooth exige HTTPS e permissão do Chrome.";
  }
  if (nome === "NetworkError") {
    return "A impressora não respondeu. Ligue-a novamente, confirme Bluetooth e localização e tente de novo.";
  }
  if (erro instanceof Error && erro.message) return erro.message;
  return "Não foi possível conectar à impressora Bluetooth.";
}

function observarDesconexao(dispositivo: BluetoothDeviceLike) {
  if (dispositivosObservados.has(dispositivo)) return;
  dispositivosObservados.add(dispositivo);
  dispositivo.addEventListener("gattserverdisconnected", () => {
    caracteristicaAtual = undefined;
    publicarEstado({
      conectado: false,
      ultimoErro: "A impressora foi desconectada. A próxima impressão tentará reconectar.",
    });
  });
}

async function descobrirCaracteristica(
  dispositivo: BluetoothDeviceLike,
): Promise<BluetoothCharacteristicLike> {
  if (!dispositivo.gatt) {
    throw new Error("Este dispositivo não oferece BLE/GATT. Use RawBT para Bluetooth clássico.");
  }
  const servidor = await dispositivo.gatt.connect();
  const servicos = await servidor.getPrimaryServices();
  const caracteristicasEncontradas: string[] = [];
  let escolhida:
    | { servico: BluetoothServiceLike; caracteristica: BluetoothCharacteristicLike }
    | undefined;
  for (const servico of servicos) {
    const caracteristicas = await servico.getCharacteristics();
    for (const caracteristica of caracteristicas) {
      caracteristicasEncontradas.push(`${servico.uuid} / ${caracteristica.uuid}`);
      if (
        !escolhida &&
        (caracteristica.properties.write || caracteristica.properties.writeWithoutResponse)
      ) {
        escolhida = { servico, caracteristica };
      }
    }
  }
  publicarEstado({
    conectado: dispositivo.gatt.connected,
    dispositivoNome: dispositivo.name ?? "Impressora sem nome",
    servicos: servicos.map((servico) => servico.uuid),
    caracteristicas: caracteristicasEncontradas,
  });
  if (!escolhida) {
    throw new Error(
      "O dispositivo foi encontrado, mas não oferece um canal BLE de escrita. Use RawBT para Bluetooth clássico.",
    );
  }
  salvarConfiguracaoImpressaoLocal({
    dispositivoId: dispositivo.id,
    dispositivoNome: dispositivo.name ?? "Impressora sem nome",
    servicoUuid: escolhida.servico.uuid,
    caracteristicaUuid: escolhida.caracteristica.uuid,
  });
  publicarEstado({
    conectado: true,
    servicoEscolhido: escolhida.servico.uuid,
    caracteristicaEscolhida: escolhida.caracteristica.uuid,
    ultimoErro: "",
  });
  return escolhida.caracteristica;
}

async function conectarDispositivo(dispositivo: BluetoothDeviceLike) {
  dispositivoAtual = dispositivo;
  observarDesconexao(dispositivo);
  caracteristicaAtual = await descobrirCaracteristica(dispositivo);
}

export function conectarImpressoraBluetooth(): Promise<void> {
  const bluetooth = navegadorBluetooth();
  if (!bluetooth) {
    const erro = new Error(
      "Este Chrome não oferece Web Bluetooth. Use RawBT para Bluetooth clássico.",
    );
    publicarEstado({ ultimoErro: erro.message });
    return Promise.reject(erro);
  }
  if (!window.isSecureContext) {
    const erro = new Error("Abra o Valhalla pelo endereço HTTPS para usar Bluetooth.");
    publicarEstado({ ultimoErro: erro.message });
    return Promise.reject(erro);
  }

  const selecao = bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [...SERVICOS_BLE_IMPRESSORAS],
  });
  return selecao.then(conectarDispositivo).catch((falha) => {
    const erro = new Error(mensagemBluetooth(falha));
    publicarEstado({ conectado: false, ultimoErro: erro.message });
    throw erro;
  });
}

async function dispositivoAutorizado() {
  if (dispositivoAtual) return dispositivoAtual;
  const bluetooth = navegadorBluetooth();
  const configuracao = lerConfiguracaoImpressaoLocal();
  if (!bluetooth?.getDevices || !configuracao.dispositivoId) {
    throw new Error("Toque em Conectar impressora antes de imprimir por Bluetooth.");
  }
  const dispositivos = await bluetooth.getDevices();
  const dispositivo = dispositivos.find((item) => item.id === configuracao.dispositivoId);
  if (!dispositivo) {
    throw new Error("A autorização da impressora não está mais disponível. Conecte-a novamente.");
  }
  dispositivoAtual = dispositivo;
  observarDesconexao(dispositivo);
  return dispositivo;
}

async function caracteristicaGravavel() {
  if (caracteristicaAtual && dispositivoAtual?.gatt?.connected) {
    return caracteristicaAtual;
  }
  const dispositivo = await dispositivoAutorizado();
  caracteristicaAtual = await descobrirCaracteristica(dispositivo);
  return caracteristicaAtual;
}

export function fatiarBytes(bytes: Uint8Array, tamanho: number) {
  if (!Number.isInteger(tamanho) || tamanho < 1) {
    throw new Error("O tamanho do bloco deve ser um inteiro positivo.");
  }
  const blocos: Uint8Array[] = [];
  for (let inicio = 0; inicio < bytes.length; inicio += tamanho) {
    blocos.push(bytes.slice(inicio, inicio + tamanho));
  }
  return blocos;
}

function erroDeTamanho(erro: unknown) {
  return (
    (erro instanceof DOMException &&
      ["InvalidModificationError", "DataError"].includes(erro.name)) ||
    (erro instanceof Error && /tamanho|length|size|too long|attribute value/i.test(erro.message))
  );
}

async function aguardar(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function enviarEmBlocos(
  caracteristica: BluetoothCharacteristicLike,
  bytes: Uint8Array,
  tamanhoInicial = 100,
  intervaloMs = 20,
) {
  let tamanho = tamanhoInicial;
  let inicio = 0;
  while (inicio < bytes.length) {
    const bloco = bytes.slice(inicio, inicio + tamanho);
    try {
      if (
        caracteristica.properties.writeWithoutResponse &&
        caracteristica.writeValueWithoutResponse
      ) {
        await caracteristica.writeValueWithoutResponse(bloco);
      } else if (caracteristica.writeValue) {
        await caracteristica.writeValue(bloco);
      } else if (caracteristica.writeValueWithResponse) {
        await caracteristica.writeValueWithResponse(bloco);
      } else {
        throw new Error("A característica BLE não aceita escrita.");
      }
    } catch (erro) {
      if (tamanho > 20 && erroDeTamanho(erro)) {
        tamanho = 20;
        continue;
      }
      throw erro;
    }
    inicio += bloco.length;
    if (inicio < bytes.length && intervaloMs > 0) {
      await aguardar(intervaloMs);
    }
  }
}

async function imprimirBluetooth(bytes: Uint8Array) {
  let ultimaFalha: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      const caracteristica = await caracteristicaGravavel();
      await enviarEmBlocos(caracteristica, bytes);
      publicarEstado({ conectado: true, ultimoErro: "" });
      return;
    } catch (erro) {
      ultimaFalha = erro;
      caracteristicaAtual = undefined;
      publicarEstado({ conectado: false, ultimoErro: mensagemBluetooth(erro) });
    }
  }
  throw new Error(mensagemBluetooth(ultimaFalha));
}

function base64(bytes: Uint8Array) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let resultado = "";
  for (let indice = 0; indice < bytes.length; indice += 3) {
    const a = bytes[indice];
    const temB = indice + 1 < bytes.length;
    const temC = indice + 2 < bytes.length;
    const b = temB ? bytes[indice + 1] : 0;
    const c = temC ? bytes[indice + 2] : 0;
    resultado += alfabeto[a >> 2];
    resultado += alfabeto[((a & 0x03) << 4) | (b >> 4)];
    resultado += temB ? alfabeto[((b & 0x0f) << 2) | (c >> 6)] : "=";
    resultado += temC ? alfabeto[c & 0x3f] : "=";
  }
  return resultado;
}

export function montarIntentRawBt(bytes: Uint8Array) {
  const loja = encodeURIComponent(
    "https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter",
  );
  return `intent:base64,${base64(bytes)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=${loja};end;`;
}

function abrirRawBt(bytes: Uint8Array) {
  window.location.href = montarIntentRawBt(bytes);
  publicarEstado({
    ultimoErro: "O RawBT foi acionado. Se ele não estiver instalado, o Chrome abrirá a Play Store.",
  });
}

function imprimir(bytes: Uint8Array, opcoes: OpcoesImpressaoLocal): Promise<void> {
  const metodo = opcoes.metodo ?? lerConfiguracaoImpressaoLocal().metodo;
  if (metodo === "rawbt") {
    trabalhoPendente = undefined;
    abrirRawBt(bytes);
    return Promise.resolve();
  }
  if (metodo === "navegador") {
    trabalhoPendente = undefined;
    imprimirNoNavegador(opcoes.texto, opcoes.largura);
    publicarEstado({ ultimoErro: "" });
    return Promise.resolve();
  }

  trabalhoPendente = { bytes: bytes.slice(), opcoes: { ...opcoes } };
  publicarEstado();
  return imprimirBluetooth(bytes)
    .then(() => {
      trabalhoPendente = undefined;
      publicarEstado();
    })
    .catch((erro) => {
      publicarEstado({ ultimoErro: mensagemBluetooth(erro) });
      throw erro;
    });
}

function testar() {
  const configuracao = lerConfiguracaoImpressaoLocal();
  const texto = [
    "VALHALLA CHOPERIA",
    "TESTE BLUETOOTH 58 MM",
    "--------------------------------",
    "áàâã éê í óôõ úü ç",
    "ÁÀÂÃ ÉÊ Í ÓÔÕ ÚÜ Ç",
    "TOTAL              R$ 10,00",
    "12345678901234567890123456789012",
  ].join("\n");
  return imprimir(serializarEscPos(texto, configuracao.paginaCodigo), {
    texto,
    largura: 58,
  });
}

export function usarRawBtPendente() {
  if (!trabalhoPendente) {
    throw new Error("Não há uma impressão pendente para enviar ao RawBT.");
  }
  const pendente = trabalhoPendente;
  trabalhoPendente = undefined;
  salvarConfiguracaoImpressaoLocal({ metodo: "rawbt" });
  abrirRawBt(pendente.bytes);
}

export const adaptadorImpressao = {
  imprimir,
  testar,
  estado: estadoImpressaoLocal,
};

publicarEstado();
