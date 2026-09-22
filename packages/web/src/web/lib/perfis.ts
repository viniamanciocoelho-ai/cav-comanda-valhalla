// Perfis autorizados pelo backend. Cada funcionario entra com PIN individual e a sessao
// determina as rotas e a identidade usada nas operacoes.

import type { Perfil } from "./types";

export const AVISO_ACESSO =
  "Acesso protegido por PIN individual e permissões do perfil.";

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
  gerencia: ["/", "/mesa", "/balcao", "/producao", "/cozinha", "/fechamentos", "/relatorio-diario", "/configuracao", "/caixa", "/garcom"],
  garcom: ["/garcom", "/mesa", "/balcao"],
  producao: ["/producao", "/cozinha"],
  caixa: ["/caixa", "/mesa", "/fechamentos", "/relatorio-diario"],
};

export function podeAcessar(perfil: Perfil, rota: string): boolean {
  const permitidas = rotasPermitidas[perfil];
  if (rota === "/") return permitidas.includes("/");

  return permitidas.some((permitida) => {
    if (permitida === "/") return false;
    if (permitida === "/mesa") return /^\/mesa\/\d+$/.test(rota);
    if (permitida === "/balcao") return /^\/balcao\/\d+$/.test(rota);
    return rota === permitida;
  });
}

/** O que cada perfil nao pode fazer. Exibido no seletor de sessao. */
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
