// Tipos do dominio operacional compartilhados entre frontend e API.
// Cada registro carrega identificadores estaveis e autoria para persistencia auditavel.

export type Destino = "cozinha" | "bar";
export type DestinoImpressao = Destino | "caixa";
export type TipoImpressao = "ficha" | "recibo";
export type StatusImpressao =
  | "pendente"
  | "imprimindo"
  | "impresso"
  | "falhou"
  | "sem_configuracao";

/** Estados de um item da comanda. */
export type ItemStatus =
  | "novo"
  | "enviado"
  | "preparando"
  | "pronto"
  | "entregue"
  | "cancelamento_solicitado";

/** Estados que uma ficha de producao pode assumir. */
export type TicketStatus = "enviado" | "preparando" | "pronto" | "entregue";

/** Estados de uma mesa no salao. */
export type MesaStatus = "livre" | "ocupada" | "aguardando";

/** Perfis autenticados usados pelo RBAC do frontend e da API. */
export type Perfil = "gerencia" | "garcom" | "producao" | "caixa";

export interface Funcionario {
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_perfil: Perfil;
  /** Rotulo exibido na sessao atual. */
  rotulo: string;
  /** Descricao curta do que o perfil enxerga. */
  resumo: string;
  turno?: string;
  ativo?: boolean;
}

export interface Pessoa {
  pessoa_id: string;
  nome: string;
  mesa_id: number;
}

export interface OrderItem {
  organizacao_id: string;
  item_id: string;
  /** Agrupa os itens lancados no mesmo envio. Itens novos ficam sem pedido. */
  pedido_id: string | null;
  mesa_id: number;
  pessoa_id: string;
  produto_id: string;
  name: string;
  /** Preco unitario. O valor da linha e price * quantidade. */
  price: number;
  quantidade: number;
  observacao: string;
  destino_producao: Destino;
  status: ItemStatus;
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_perfil: Perfil;
  criado_em: string;
  enviado_em: string | null;
  atualizado_em: string;
}

export interface Mesa {
  organizacao_id: string;
  mesa_id: number;
  status: MesaStatus;
  ativa: boolean;
  /** Número de pessoas registradas quando a mesa está ativa. */
  pessoasFixas: number;
  /** Total parcial persistido para compatibilidade de leitura. */
  totalFixo: number;
  abertaEm: string | null;
  garcom_id: string | null;
  /** Garcom pediu o fechamento: a mesa entra na fila do caixa. */
  contaSolicitada: boolean;
  /** Taxa de servico: controlada apenas pelo caixa. */
  servicoIncluso: boolean;
}

export const MENU_CATEGORIAS = [
  "Bebidas alcoólicas",
  "Bebidas sem álcool",
  "Porções",
  "Lanche artesanal",
  "Complementos",
  "Energético",
] as const;

export type MenuCategoria = (typeof MENU_CATEGORIAS)[number];

export interface MenuItem {
  produto_id: string;
  name: string;
  price: number;
  destino_producao: Destino;
  categoria: MenuCategoria;
}

export interface ProdutoConfiguracao extends MenuItem {
  ativo: boolean;
}

export interface ConfiguracaoImpressora {
  destino: DestinoImpressao;
  nome: string;
  host: string;
  porta: number;
  largura: 58 | 80;
  ativa: boolean;
}

export interface Impressao {
  organizacao_id: string;
  impressao_id: string;
  destino: DestinoImpressao;
  tipo: TipoImpressao;
  referencia_id: string;
  mesa_id: number;
  status: StatusImpressao;
  tentativas: number;
  ultimo_erro: string | null;
  texto: string;
  largura: 58 | 80;
  criado_em: string;
  atualizado_em: string;
}

export interface TicketLinha {
  item_id: string;
  produto_id: string;
  name: string;
  qty: number;
  pessoa: string;
  observacao: string;
}

export interface Ticket {
  organizacao_id: string;
  ticket_id: string;
  pedido_id: string;
  mesa_id: number;
  destino_producao: Destino;
  status: TicketStatus;
  linhas: TicketLinha[];
  /** Itens da comanda vinculados a esta ficha, para sincronizar estados. */
  itemIds: string[];
  funcionario_id: string;
  funcionario_nome: string;
  criado_em: string;
  enviado_em: string;
  atualizado_em: string;
}

export interface LinhaDivisao {
  pessoa_id: string;
  pessoa: string;
  individual: number;
  rateio: number;
  servico: number;
  total: number;
}

export interface ResumoMesa {
  mesa_id: number;
  subtotal: number;
  servico: number;
  total: number;
  servicoIncluso: boolean;
  itens: number;
  novos: number;
  prontos: number;
  divisao: LinhaDivisao[];
}

/** Motivos previstos para liberar uma mesa sem nenhum consumo. */
export type MotivoSemConsumo =
  | "desistiram"
  | "nao_encontraram"
  | "engano"
  | "troca_mesa"
  | "outro";

/**
 * Auditoria de mesa liberada sem consumo. NAO e fechamento: nao gera cobranca, pagamento
 * nem documento fiscal. Existe so para a gerencia saber o que aconteceu com a mesa.
 * Na arquitetura final e a saida da procedure `mesa.encerrarSemConsumo`
 * (transacional e idempotente por `abertura_id`). Ver Beck/README.md.
 */
export interface EncerramentoSemConsumo {
  organizacao_id: string;
  encerramento_id: string;
  mesa_id: number;
  /** Abertura encerrada (mesa + horario de abertura). Chave de idempotencia da operacao. */
  abertura_id: string;
  encerrada_sem_consumo: true;
  motivo: MotivoSemConsumo;
  observacao: string;
  /** Quantidade de itens em rascunho descartados no encerramento. Zero no caso normal. */
  rascunhos_descartados: number;
  /** Quem encerrou. */
  funcionario_id: string;
  funcionario_nome: string;
  /** Perfil responsavel pela operacao. */
  funcionario_perfil: Perfil;
  aberta_em: string | null;
  encerrada_em: string;
  duracao_segundos: number;
  /** Preenchido quando o encerramento foi desfeito dentro da janela permitida. */
  desfeito_em: string | null;
}

export interface Fechamento {
  organizacao_id: string;
  fechamento_id: string;
  mesa_id: number;
  hora: string;
  subtotal: number;
  servico: number;
  total: number;
  servicoIncluso: boolean;
  divisao: { pessoa_id: string; pessoa: string; valor: number }[];
  nfce: "simulada" | "nao_solicitada";
  /** Quem operou o caixa e encerrou a conta. */
  funcionario_nome: string;
  /** Garcom que atendeu a mesa, para o gerente saber de quem foi o atendimento. */
  garcom_nome: string | null;
}

export interface RelatorioDiario {
  data: string;
  faturamentoCentavos: number;
  mesasAtendidas: number;
  ticketMedioCentavos: number;
  servicoCentavos: number;
  destinos: {
    destino: Destino;
    quantidade: number;
    subtotalCentavos: number;
    totalCentavos: number;
  }[];
  produtos: {
    produto_id: string;
    nome: string;
    quantidade: number;
    valorCentavos: number;
  }[];
  fechamentos: {
    fechamento_id: string;
    mesa_id: number;
    hora: string;
    totalCentavos: number;
    funcionario_nome: string;
  }[];
  encerramentosSemConsumo: {
    encerramento_id: string;
    mesa_id: number;
    motivo: MotivoSemConsumo;
    observacao: string;
    funcionario_nome: string;
    encerrada_em: string;
  }[];
  cancelamentos: {
    cancelamento_id: string;
    mesa_id: number;
    nome: string;
    quantidade: number;
    valorCentavos: number;
    autorizado_por_nome: string;
    autorizado_em: string;
  }[];
}
