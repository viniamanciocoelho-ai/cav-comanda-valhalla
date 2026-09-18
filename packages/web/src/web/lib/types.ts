// Tipos do dominio da demonstracao. Nenhum dado sai do navegador.
// V2: cada registro carrega identificadores estaveis (nunca indice de array) e autoria,
// para que a migracao para banco de dados seja direta. Ver ARCHITECTURE_HANDOFF.md.

/** Identificador da organizacao. Fixo na demonstracao; vira chave de isolamento no banco. */
export const ORGANIZACAO_ID = "valhalla";

export type Destino = "cozinha" | "bar";

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

/** Perfis de acesso da demonstracao. Sem autenticacao real. */
export type Perfil = "gerencia" | "garcom" | "producao" | "caixa";

export interface Funcionario {
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_perfil: Perfil;
  /** Rotulo exibido no seletor de perfil. */
  rotulo: string;
  /** Descricao curta do que o perfil enxerga. */
  resumo: string;
  turno?: string;
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
  /** Mesa com comanda real nesta demonstracao (02, 06, 08 e as abertas pelo garcom). */
  ativa: boolean;
  /** Mesa 08: roteiro principal da reuniao. */
  demonstracao?: boolean;
  /** Numero de pessoas das mesas de apoio, que nao tem comanda detalhada. */
  pessoasFixas: number;
  /** Total parcial fixo das mesas de apoio. */
  totalFixo: number;
  abertaEm: string | null;
  garcom_id: string | null;
  /** Garcom pediu o fechamento: a mesa entra na fila do caixa. */
  contaSolicitada: boolean;
  /** Taxa de servico: controlada apenas pelo caixa. */
  servicoIncluso: boolean;
}

export interface MenuItem {
  produto_id: string;
  name: string;
  price: number;
  destino_producao: Destino;
  categoria: "Chopes" | "Bebidas" | "Petiscos" | "Cozinha";
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
 * (transacional e idempotente por `abertura_id`). Ver ARCHITECTURE_HANDOFF.md.
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
  /** Preenchido quando o encerramento foi desfeito na janela de 10 s da demonstracao. */
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
