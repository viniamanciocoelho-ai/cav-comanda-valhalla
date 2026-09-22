import { compartilhadoId, ehCompartilhado } from "./operacao";
import type {
  Balcao,
  ConfiguracaoImpressora,
  EncerramentoSemConsumo,
  Fechamento,
  Funcionario,
  Impressao,
  MenuItem,
  Mesa,
  OrderItem,
  Pessoa,
  ProdutoConfiguracao,
  Ticket,
} from "./types";
import type { Dados } from "../components/comanda-provider";

export type AcaoPersistencia =
  | "abrir_mesa"
  | "abrir_balcao"
  | "transferir_balcao_mesa"
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
  schemaVersao?: 2;
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
const SCHEMA_OFFLINE_ATUAL = 2;
const ACOES_PERSISTENCIA = new Set<AcaoPersistencia>([
  "abrir_mesa",
  "abrir_balcao",
  "transferir_balcao_mesa",
  "alterar_comanda",
  "enviar_pedido",
  "mover_producao",
  "entregar_item",
  "solicitar_cancelamento",
  "decidir_cancelamento",
  "solicitar_fechamento",
  "alterar_servico",
  "fechar_conta",
  "encerrar_sem_consumo",
  "desfazer_sem_consumo",
]);

type Registro = Record<string, unknown>;

function registro(valor: unknown): Registro | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

function inteiro(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) ? valor : null;
}

function atendimentoLegado(mesaId: number) {
  return `mesa:${mesaId}:legado`;
}

function criarBalcaoVazio(organizacaoId: string, balcaoId: number): Balcao {
  return {
    organizacao_id: organizacaoId,
    balcao_id: balcaoId,
    atendimento_id: null,
    status: "livre",
    ativa: false,
    abertaEm: null,
    garcom_id: null,
    contaSolicitada: false,
    servicoIncluso: true,
  };
}

function normalizarMesas(
  valor: unknown,
  organizacaoId: string,
): { mesas: Mesa[]; atendimentos: Map<number, string> } | null {
  if (!Array.isArray(valor)) return null;
  const mesas: Mesa[] = [];
  const atendimentos = new Map<number, string>();
  for (const entrada of valor) {
    const atual = registro(entrada);
    const mesaId = inteiro(atual?.mesa_id);
    if (!atual || mesaId === null || typeof atual.ativa !== "boolean") return null;
    const atendimentoExistente = texto(atual.atendimento_id);
    const atendimentoId =
      atendimentoExistente ?? (atual.ativa ? atendimentoLegado(mesaId) : null);
    if (atendimentoId) atendimentos.set(mesaId, atendimentoId);
    mesas.push({
      ...(atual as unknown as Mesa),
      organizacao_id: organizacaoId,
      mesa_id: mesaId,
      atendimento_id: atendimentoId,
    });
  }
  return { mesas, atendimentos };
}

function normalizarBalcoes(valor: unknown, organizacaoId: string): Balcao[] | null {
  if (valor === undefined) {
    return Array.from({ length: 4 }, (_, indice) =>
      criarBalcaoVazio(organizacaoId, indice + 1),
    );
  }
  if (!Array.isArray(valor)) return null;
  const balcoes: Balcao[] = [];
  for (const entrada of valor) {
    const atual = registro(entrada);
    const balcaoId = inteiro(atual?.balcao_id);
    if (!atual || balcaoId === null || typeof atual.ativa !== "boolean") return null;
    balcoes.push({
      ...(atual as unknown as Balcao),
      organizacao_id: organizacaoId,
      balcao_id: balcaoId,
      atendimento_id: texto(atual.atendimento_id),
    });
  }
  return balcoes;
}

function vinculo(
  atual: Registro,
  atendimentos: Map<number, string>,
): { atendimentoId: string; mesaId: number | null; balcaoId: number | null } | null {
  const mesaId = atual.mesa_id === null ? null : inteiro(atual.mesa_id);
  const balcaoId = atual.balcao_id === null ? null : inteiro(atual.balcao_id);
  if ((mesaId === null) === (balcaoId === null)) return null;
  const atendimentoId =
    texto(atual.atendimento_id) ??
    (mesaId !== null ? atendimentos.get(mesaId) ?? atendimentoLegado(mesaId) : null);
  return atendimentoId ? { atendimentoId, mesaId, balcaoId } : null;
}

function normalizarPessoas(
  valor: unknown,
  atendimentos: Map<number, string>,
): Pessoa[] | null {
  if (!Array.isArray(valor)) return null;
  const pessoas: Pessoa[] = [];
  for (const entrada of valor) {
    const atual = registro(entrada);
    const pessoaId = texto(atual?.pessoa_id);
    const ligacao = atual ? vinculo(atual, atendimentos) : null;
    if (!atual || !pessoaId || !ligacao) return null;
    pessoas.push({
      ...(atual as unknown as Pessoa),
      pessoa_id: pessoaId,
      atendimento_id: ligacao.atendimentoId,
      mesa_id: ligacao.mesaId,
      balcao_id: ligacao.balcaoId,
    });
  }
  return pessoas;
}

function normalizarItens(
  valor: unknown,
  organizacaoId: string,
  atendimentos: Map<number, string>,
): OrderItem[] | null {
  if (!Array.isArray(valor)) return null;
  const itens: OrderItem[] = [];
  for (const entrada of valor) {
    const atual = registro(entrada);
    const itemId = texto(atual?.item_id);
    const pessoaId = texto(atual?.pessoa_id);
    const ligacao = atual ? vinculo(atual, atendimentos) : null;
    if (!atual || !itemId || !pessoaId || !ligacao) return null;
    itens.push({
      ...(atual as unknown as OrderItem),
      organizacao_id: organizacaoId,
      item_id: itemId,
      pessoa_id: ehCompartilhado(pessoaId)
        ? compartilhadoId(ligacao.atendimentoId)
        : pessoaId,
      atendimento_id: ligacao.atendimentoId,
      mesa_id: ligacao.mesaId,
      balcao_id: ligacao.balcaoId,
    });
  }
  return itens;
}

function normalizarTickets(
  valor: unknown,
  organizacaoId: string,
  atendimentos: Map<number, string>,
): Ticket[] | null {
  if (!Array.isArray(valor)) return null;
  const tickets: Ticket[] = [];
  for (const entrada of valor) {
    const atual = registro(entrada);
    const ticketId = texto(atual?.ticket_id);
    const ligacao = atual ? vinculo(atual, atendimentos) : null;
    if (!atual || !ticketId || !ligacao) return null;
    tickets.push({
      ...(atual as unknown as Ticket),
      organizacao_id: organizacaoId,
      ticket_id: ticketId,
      atendimento_id: ligacao.atendimentoId,
      mesa_id: ligacao.mesaId,
      balcao_id: ligacao.balcaoId,
    });
  }
  return tickets;
}

function normalizarFechamentos(
  valor: unknown,
  organizacaoId: string,
  atendimentos: Map<number, string>,
): Fechamento[] | null {
  if (!Array.isArray(valor)) return null;
  const fechamentos: Fechamento[] = [];
  for (const entrada of valor) {
    const atual = registro(entrada);
    const fechamentoId = texto(atual?.fechamento_id);
    const ligacao = atual ? vinculo(atual, atendimentos) : null;
    if (!atual || !fechamentoId || !ligacao) return null;
    fechamentos.push({
      ...(atual as unknown as Fechamento),
      organizacao_id: organizacaoId,
      fechamento_id: fechamentoId,
      atendimento_id: ligacao.atendimentoId,
      mesa_id: ligacao.mesaId,
      balcao_id: ligacao.balcaoId,
    });
  }
  return fechamentos;
}

function normalizarEncerramentos(
  valor: unknown,
  organizacaoId: string,
  atendimentos: Map<number, string>,
): EncerramentoSemConsumo[] | null {
  if (!Array.isArray(valor)) return null;
  const encerramentos: EncerramentoSemConsumo[] = [];
  for (const entrada of valor) {
    const atual = registro(entrada);
    const encerramentoId = texto(atual?.encerramento_id);
    const ligacao = atual ? vinculo(atual, atendimentos) : null;
    if (!atual || !encerramentoId || !ligacao) return null;
    encerramentos.push({
      ...(atual as unknown as EncerramentoSemConsumo),
      organizacao_id: organizacaoId,
      encerramento_id: encerramentoId,
      atendimento_id: ligacao.atendimentoId,
      mesa_id: ligacao.mesaId,
      balcao_id: ligacao.balcaoId,
    });
  }
  return encerramentos;
}

function normalizarDados(valor: unknown, organizacaoId: string): Dados | null {
  const atual = registro(valor);
  if (!atual) return null;
  const mesasNormalizadas = normalizarMesas(atual.mesas, organizacaoId);
  if (!mesasNormalizadas) return null;
  const balcoes = normalizarBalcoes(atual.balcoes, organizacaoId);
  const pessoas = normalizarPessoas(atual.pessoas, mesasNormalizadas.atendimentos);
  const itens = normalizarItens(atual.itens, organizacaoId, mesasNormalizadas.atendimentos);
  const tickets = normalizarTickets(
    atual.tickets,
    organizacaoId,
    mesasNormalizadas.atendimentos,
  );
  const fechamentos = normalizarFechamentos(
    atual.fechamentos,
    organizacaoId,
    mesasNormalizadas.atendimentos,
  );
  const encerramentos = normalizarEncerramentos(
    atual.encerramentos,
    organizacaoId,
    mesasNormalizadas.atendimentos,
  );
  if (!balcoes || !pessoas || !itens || !tickets || !fechamentos || !encerramentos) {
    return null;
  }
  const anteriores = registro(atual.anteriores);
  if (!anteriores) return null;
  return {
    mesas: mesasNormalizadas.mesas,
    balcoes,
    pessoas,
    itens,
    tickets,
    fechamentos,
    encerramentos,
    anteriores: anteriores as Dados["anteriores"],
  };
}

function normalizarImpressoes(
  valor: unknown,
  organizacaoId: string,
): Impressao[] | null {
  if (!Array.isArray(valor)) return null;
  const impressoes: Impressao[] = [];
  for (const entrada of valor) {
    const atual = registro(entrada);
    const impressaoId = texto(atual?.impressao_id);
    const mesaId = atual?.mesa_id === null ? null : inteiro(atual?.mesa_id);
    const balcaoId = atual?.balcao_id === null ? null : inteiro(atual?.balcao_id);
    const atendimentoId =
      texto(atual?.atendimento_id) ??
      (mesaId !== null ? atendimentoLegado(mesaId) : null);
    if (!atual || !impressaoId || !atendimentoId) return null;
    impressoes.push({
      ...(atual as unknown as Impressao),
      organizacao_id: organizacaoId,
      impressao_id: impressaoId,
      atendimento_id: atendimentoId,
      mesa_id: mesaId,
      balcao_id: balcaoId,
      impresso_em: texto(atual.impresso_em),
    });
  }
  return impressoes;
}

function normalizarSnapshot(valor: unknown, organizacaoId: string): SnapshotOffline | null {
  const atual = registro(valor);
  if (
    !atual ||
    atual.organizacaoId !== organizacaoId ||
    typeof atual.versao !== "number" ||
    !Array.isArray(atual.cardapio) ||
    !Array.isArray(atual.produtos) ||
    !Array.isArray(atual.funcionarios) ||
    !Array.isArray(atual.impressoras) ||
    typeof atual.quantidadeMesas !== "number" ||
    (atual.larguraRecibo !== 58 && atual.larguraRecibo !== 80) ||
    typeof atual.atualizadoEm !== "string"
  ) {
    return null;
  }
  const estado = normalizarDados(atual.estado, organizacaoId);
  const impressoes = normalizarImpressoes(atual.impressoes, organizacaoId);
  if (!estado || !impressoes) return null;
  return {
    schemaVersao: SCHEMA_OFFLINE_ATUAL,
    organizacaoId,
    versao: atual.versao,
    estado,
    cardapio: atual.cardapio as MenuItem[],
    produtos: atual.produtos as ProdutoConfiguracao[],
    funcionarios: atual.funcionarios as Funcionario[],
    impressoras: atual.impressoras as ConfiguracaoImpressora[],
    impressoes,
    quantidadeMesas: atual.quantidadeMesas,
    larguraRecibo: atual.larguraRecibo,
    atualizadoEm: atual.atualizadoEm,
  };
}

function normalizarFilaItem(valor: unknown, organizacaoId: string): FilaOfflineItem | null {
  const atual = registro(valor);
  const acao = texto(atual?.acao) as AcaoPersistencia | null;
  const antes = atual ? normalizarDados(atual.antes, organizacaoId) : null;
  const depois = atual ? normalizarDados(atual.depois, organizacaoId) : null;
  if (
    !atual ||
    !texto(atual.id) ||
    atual.organizacaoId !== organizacaoId ||
    !acao ||
    !ACOES_PERSISTENCIA.has(acao) ||
    !antes ||
    !depois ||
    typeof atual.tentativas !== "number" ||
    typeof atual.proximaTentativaEm !== "number" ||
    typeof atual.criadoEm !== "string"
  ) {
    return null;
  }
  return {
    id: atual.id as string,
    organizacaoId,
    acao,
    ...(typeof atual.entidadeId === "string" ? { entidadeId: atual.entidadeId } : {}),
    antes,
    depois,
    tentativas: atual.tentativas,
    proximaTentativaEm: atual.proximaTentativaEm,
    criadoEm: atual.criadoEm,
  };
}

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
  const chaveSnapshot = chave(organizacaoId, "snapshot");
  const bruto = lerJson<unknown>(armazenamento, chaveSnapshot, null);
  const snapshot = normalizarSnapshot(bruto, organizacaoId);
  if (snapshot) gravarJson(armazenamento, chaveSnapshot, snapshot);
  return snapshot;
}

export function salvarSnapshot(
  snapshot: SnapshotOffline,
  armazenamento = armazenamentoNativo(),
) {
  gravarJson(armazenamento, chave(snapshot.organizacaoId, "snapshot"), {
    ...snapshot,
    schemaVersao: SCHEMA_OFFLINE_ATUAL,
  });
}

export function carregarFila(
  organizacaoId: string,
  armazenamento = armazenamentoNativo(),
): FilaOfflineItem[] {
  const chaveFila = chave(organizacaoId, "fila");
  const bruto = lerJson<unknown>(armazenamento, chaveFila, []);
  if (!Array.isArray(bruto)) return [];
  const fila: FilaOfflineItem[] = [];
  for (const entrada of bruto) {
    const item = normalizarFilaItem(entrada, organizacaoId);
    if (!item) return [];
    fila.push(item);
  }
  gravarJson(armazenamento, chaveFila, fila);
  return fila;
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
  "balcoes",
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
    balcoes: [...remoto.balcoes],
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
