import type { ConfiguracaoImpressora, Funcionario, Impressao, MenuItem, ProdutoConfiguracao } from "./types";
import type { Dados } from "../components/comanda-provider";

export type AcaoPersistencia =
  | "abrir_mesa"
  | "alterar_comanda"
  | "enviar_pedido"
  | "mover_producao"
  | "entregar_item"
  | "solicitar_cancelamento"
  | "decidir_cancelamento"
  | "solicitar_fechamento"
  | "alterar_servico"
  | "fechar_conta"
  | "encerrar_sem_consumo"
  | "desfazer_sem_consumo";

export type Conectividade = "sincronizado" | "pendente" | "offline";

export interface FilaOfflineItem {
  id: string;
  organizacaoId: string;
  acao: AcaoPersistencia;
  entidadeId?: string;
  antes: Dados;
  depois: Dados;
  tentativas: number;
  proximaTentativaEm: number;
  criadoEm: string;
}

export interface FalhaOffline {
  id: string;
  acao: AcaoPersistencia;
  mensagem: string;
  itens: string[];
  criadoEm: string;
}

export interface SnapshotOffline {
  organizacaoId: string;
  versao: number;
  estado: Dados;
  cardapio: MenuItem[];
  produtos: ProdutoConfiguracao[];
  funcionarios: Funcionario[];
  impressoras: ConfiguracaoImpressora[];
  impressoes: Impressao[];
  quantidadeMesas: number;
  larguraRecibo: 58 | 80;
  atualizadoEm: string;
}

export interface SessaoOffline {
  token: string;
  organizacaoId: string;
  funcionario: Funcionario;
}

export interface ArmazenamentoOffline {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

const PREFIXO = "cav-comanda-offline:v1:";
const SESSAO_PREFIXO = "cav-comanda-sessao:v1:";

function armazenamentoNativo(): ArmazenamentoOffline | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function lerJson<T>(armazenamento: ArmazenamentoOffline | null, chave: string, fallback: T): T {
  if (!armazenamento) return fallback;
  try {
    const bruto = armazenamento.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : fallback;
  } catch {
    return fallback;
  }
}

function gravarJson(armazenamento: ArmazenamentoOffline | null, chave: string, valor: unknown) {
  if (!armazenamento) return;
  try {
    armazenamento.setItem(chave, JSON.stringify(valor));
  } catch {
    // A operação segue para a rede se o navegador bloquear ou lotar o armazenamento local.
  }
}

function chave(organizacaoId: string, sufixo: string) {
  return `${PREFIXO}${organizacaoId}:${sufixo}`;
}

export function carregarSnapshot(
  organizacaoId: string,
  armazenamento = armazenamentoNativo(),
): SnapshotOffline | null {
  return lerJson<SnapshotOffline | null>(armazenamento, chave(organizacaoId, "snapshot"), null);
}

export function salvarSnapshot(
  snapshot: SnapshotOffline,
  armazenamento = armazenamentoNativo(),
) {
  gravarJson(armazenamento, chave(snapshot.organizacaoId, "snapshot"), snapshot);
}

export function carregarFila(
  organizacaoId: string,
  armazenamento = armazenamentoNativo(),
): FilaOfflineItem[] {
  return lerJson<FilaOfflineItem[]>(armazenamento, chave(organizacaoId, "fila"), []);
}

export function salvarFila(
  organizacaoId: string,
  fila: FilaOfflineItem[],
  armazenamento = armazenamentoNativo(),
) {
  gravarJson(armazenamento, chave(organizacaoId, "fila"), fila);
}

export function carregarFalhas(
  organizacaoId: string,
  armazenamento = armazenamentoNativo(),
): FalhaOffline[] {
  return lerJson<FalhaOffline[]>(armazenamento, chave(organizacaoId, "falhas"), []);
}

export function salvarFalhas(
  organizacaoId: string,
  falhas: FalhaOffline[],
  armazenamento = armazenamentoNativo(),
) {
  gravarJson(armazenamento, chave(organizacaoId, "falhas"), falhas.slice(-20));
}

export function salvarSessaoOffline(
  sessao: SessaoOffline,
  armazenamento = armazenamentoNativo(),
) {
  gravarJson(armazenamento, `${SESSAO_PREFIXO}${sessao.token}`, sessao);
}

export function carregarSessaoOffline(
  token: string,
  armazenamento = armazenamentoNativo(),
): SessaoOffline | null {
  return lerJson<SessaoOffline | null>(armazenamento, `${SESSAO_PREFIXO}${token}`, null);
}

export function backoffMs(tentativas: number): number {
  return Math.min(30_000, 500 * 2 ** Math.max(0, tentativas));
}

export function erroDeRede(erro: unknown): boolean {
  if (erro instanceof TypeError) return true;
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /failed to fetch|network|fetch|offline|connection|econn|timed out/i.test(mensagem);
}

export function codigoDoErro(erro: unknown): string | null {
  if (!erro || typeof erro !== "object") return null;
  const valor = erro as { code?: unknown; cause?: { code?: unknown } };
  if (typeof valor.code === "string") return valor.code;
  return typeof valor.cause?.code === "string" ? valor.cause.code : null;
}

type Colecao = Exclude<keyof Dados, "anteriores">;
const colecoes: Colecao[] = [
  "mesas",
  "pessoas",
  "itens",
  "tickets",
  "fechamentos",
  "encerramentos",
];

function idDoRegistro(registro: object): string {
  const id = Object.entries(registro).find(
    ([chave]) => chave.endsWith("_id") && chave !== "organizacao_id",
  );
  return String(id?.[1] ?? JSON.stringify(registro));
}

function mesmo(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Reaplica somente a mudanca local que ainda e baseada no servidor.
 * Alteracoes remotas diferentes permanecem intactas e viram conflito para exibicao.
 */
export function reaplicarAcao(
  remoto: Dados,
  acao: Pick<FilaOfflineItem, "antes" | "depois">,
): { estado: Dados; conflitos: string[] } {
  const conflitos: string[] = [];
  const resultado: Dados = {
    ...remoto,
    mesas: [...remoto.mesas],
    pessoas: [...remoto.pessoas],
    itens: [...remoto.itens],
    tickets: [...remoto.tickets],
    fechamentos: [...remoto.fechamentos],
    encerramentos: [...remoto.encerramentos],
    anteriores: { ...remoto.anteriores },
  };

  for (const colecao of colecoes) {
    const antes = new Map(acao.antes[colecao].map((registro) => [idDoRegistro(registro), registro]));
    const depois = new Map(acao.depois[colecao].map((registro) => [idDoRegistro(registro), registro]));
    const atual = new Map(resultado[colecao].map((registro) => [idDoRegistro(registro), registro]));
    const ids = new Set([...antes.keys(), ...depois.keys()]);

    for (const id of ids) {
      const registroAntes = antes.get(id);
      const registroDepois = depois.get(id);
      if (mesmo(registroAntes, registroDepois)) continue;
      const registroAtual = atual.get(id);
      if (!mesmo(registroAtual, registroAntes) && !mesmo(registroAtual, registroDepois)) {
        conflitos.push(`${colecao}:${id}`);
        continue;
      }
      if (registroDepois) atual.set(id, registroDepois);
      else atual.delete(id);
    }

    resultado[colecao] = Array.from(atual.values()) as never;
  }

  const idsAnteriores = new Set([
    ...Object.keys(acao.antes.anteriores),
    ...Object.keys(acao.depois.anteriores),
  ]);
  for (const id of idsAnteriores) {
    const antes = acao.antes.anteriores[id];
    const depois = acao.depois.anteriores[id];
    const atual = resultado.anteriores[id];
    if (antes === depois) continue;
    if (atual !== undefined && atual !== antes && atual !== depois) {
      conflitos.push(`anteriores:${id}`);
      continue;
    }
    if (depois === undefined) delete resultado.anteriores[id];
    else resultado.anteriores[id] = depois;
  }

  return { estado: resultado, conflitos };
}

export function nomesDosItensAlterados(acao: Pick<FilaOfflineItem, "antes" | "depois">): string[] {
  const antes = new Map(acao.antes.itens.map((item) => [item.item_id, item]));
  const depois = new Map(acao.depois.itens.map((item) => [item.item_id, item]));
  const nomes = new Set<string>();
  for (const id of new Set([...antes.keys(), ...depois.keys()])) {
    const anterior = antes.get(id);
    const atual = depois.get(id);
    if (mesmo(anterior, atual)) continue;
    const item = atual ?? anterior;
    if (item) nomes.add(`${item.name} (${item.quantidade}x, mesa ${item.mesa_id})`);
  }
  if (nomes.size) return Array.from(nomes);
  const mesas = new Set<number>();
  for (const mesa of [...acao.antes.mesas, ...acao.depois.mesas]) {
    if (JSON.stringify(acao.antes.mesas.find((item) => item.mesa_id === mesa.mesa_id)) !==
      JSON.stringify(acao.depois.mesas.find((item) => item.mesa_id === mesa.mesa_id))) {
      mesas.add(mesa.mesa_id);
    }
  }
  return Array.from(mesas).map((mesa) => `Mesa ${mesa}`);
}

export function estadoConfirmadoParaResumo(
  conectividade: Conectividade,
  confirmado: Dados,
  atual: Dados,
): Dados {
  return conectividade === "offline" ? confirmado : atual;
}
