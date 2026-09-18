// Perfis autorizados pelo backend. Cada funcionario entra com PIN individual e a sessao
// determina as rotas e a identidade usada nas operacoes.

import type { Funcionario, Perfil } from "./types";

export const AVISO_ACESSO =
  "Acesso protegido por PIN individual e permissões do perfil.";

export const funcionarios: Funcionario[] = [
  {
    funcionario_id: "f-gerencia",
    funcionario_nome: "Gerência",
    funcionario_perfil: "gerencia",
    rotulo: "Gerência",
    resumo: "Salão inteiro, valores, produção, fechamentos e configuração",
  },
  {
    funcionario_id: "f-rafael",
    funcionario_nome: "Rafael",
    funcionario_perfil: "garcom",
    rotulo: "Rafael (garçom)",
    resumo: "Mesas do turno, lançamento de pedido e acompanhamento",
    turno: "Turno da noite · 18h às 00h",
  },
  {
    funcionario_id: "f-producao",
    funcionario_nome: "Cozinha e bar",
    funcionario_perfil: "producao",
    rotulo: "Cozinha e bar",
    resumo: "Fichas de preparo separadas por destino",
  },
  {
    funcionario_id: "f-caixa",
    funcionario_nome: "Caixa",
    funcionario_perfil: "caixa",
    rotulo: "Caixa",
    resumo: "Fila de fechamento, divisão da conta, serviço e NFC-e",
  },
];

export const perfilLabel: Record<Perfil, string> = {
  gerencia: "Gerência",
  garcom: "Garçom",
  producao: "Cozinha e bar",
  caixa: "Caixa",
};

/** Rota inicial de cada perfil. */
export const rotaInicial: Record<Perfil, string> = {
  gerencia: "/",
  garcom: "/garcom",
  producao: "/producao",
  caixa: "/caixa",
};

/** Rotas permitidas por perfil. Prefixos: "/mesa" cobre "/mesa/8". */
export const rotasPermitidas: Record<Perfil, string[]> = {
  gerencia: ["/", "/mesa", "/producao", "/fechamentos", "/configuracao", "/caixa", "/garcom"],
  garcom: ["/garcom", "/mesa"],
  producao: ["/producao"],
  caixa: ["/caixa", "/mesa", "/fechamentos"],
};

export function podeAcessar(perfil: Perfil, rota: string): boolean {
  const permitidas = rotasPermitidas[perfil];
  if (rota === "/") return permitidas.includes("/");

  return permitidas.some((permitida) => {
    if (permitida === "/") return false;
    if (permitida === "/mesa") return /^\/mesa\/\d+$/.test(rota);
    return rota === permitida;
  });
}

/** O que cada perfil nao pode fazer. Exibido no seletor, sem tela de senha falsa. */
export const restricoes: Record<Perfil, string[]> = {
  gerencia: [],
  garcom: [
    "Não vê faturamento geral do salão",
    "Não altera cardápio nem configuração",
    "Não emite nem simula NFC-e",
    "Não encerra pagamento",
    "Não altera item em produção sem autorização",
  ],
  producao: ["Não vê valores", "Não altera cardápio nem configuração"],
  caixa: ["Não altera cardápio nem configuração", "Não lança item na comanda"],
};
