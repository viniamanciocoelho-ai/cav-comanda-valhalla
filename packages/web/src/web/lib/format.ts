import type {
  Destino,
  ItemStatus,
  MesaStatus,
  MotivoSemConsumo,
  Perfil,
  TicketStatus,
} from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(value: number): string {
  return brl.format(value);
}

export function moneyCentavos(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("O valor deve ser um inteiro seguro em centavos.");
  }
  return brl.format(value / 100);
}

export function duracao(minutos: number): string {
  if (minutos <= 0) return "agora";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export function mesaLabel(id: number): string {
  return String(id).padStart(2, "0");
}

const hhmm = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Hora de um registro (ISO) no formato 19:42. */
export function hora(iso: string | null): string {
  if (!iso) return "--:--";
  const data = new Date(iso);
  return Number.isFinite(data.getTime()) ? hhmm.format(data) : "--:--";
}

/** Minutos decorridos desde um registro (ISO). */
export function minutosDesde(iso: string | null): number {
  if (!iso) return 0;
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
}

/** Tempo decorrido em texto curto, a partir de um ISO. */
export function desde(iso: string | null): string {
  return duracao(minutosDesde(iso));
}

export const itemStatusLabel: Record<ItemStatus, string> = {
  novo: "Novo item",
  enviado: "Enviado",
  preparando: "Preparando",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelamento_solicitado: "Cancelar?",
};

export const ticketStatusLabel: Record<TicketStatus, string> = {
  enviado: "Na fila",
  preparando: "Preparando",
  pronto: "Pronto",
  entregue: "Entregue",
};

export const mesaStatusLabel: Record<MesaStatus, string> = {
  livre: "Livre",
  ocupada: "Ocupada",
  aguardando: "Aguardando conta",
};

export const destinoLabel: Record<Destino, string> = {
  cozinha: "Cozinha",
  bar: "Bar",
};

/** Motivos de mesa liberada sem consumo, na ordem em que aparecem no formulario. */
export const motivoSemConsumoLabel: Record<MotivoSemConsumo, string> = {
  desistiram: "Clientes desistiram",
  nao_encontraram: "Não encontraram o que procuravam",
  engano: "Mesa aberta por engano",
  troca_mesa: "Troca de mesa",
  outro: "Outro",
};

export const perfilNome: Record<Perfil, string> = {
  gerencia: "Gerência",
  garcom: "Garçom",
  producao: "Cozinha e bar",
  caixa: "Caixa",
};

/** Cor do estado, lida dos tokens do tema. Cor sempre acompanhada de rotulo em texto. */
export const itemStatusColor: Record<ItemStatus, string> = {
  novo: "var(--vh-ember)",
  enviado: "var(--vh-bronze)",
  preparando: "var(--vh-gold-bright)",
  pronto: "var(--vh-moss)",
  entregue: "var(--vh-muted)",
  cancelamento_solicitado: "var(--vh-blood)",
};

export const ticketStatusColor: Record<TicketStatus, string> = {
  enviado: "var(--vh-bronze)",
  preparando: "var(--vh-gold-bright)",
  pronto: "var(--vh-moss)",
  entregue: "var(--vh-muted)",
};

export const mesaStatusColor: Record<MesaStatus, string> = {
  livre: "var(--vh-moss)",
  ocupada: "var(--vh-gold)",
  aguardando: "var(--vh-blood)",
};

export function horaAgora(): string {
  return hhmm.format(new Date());
}

export function dataOperacional(): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
