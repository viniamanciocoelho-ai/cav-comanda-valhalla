import type { Funcionario, Perfil } from "../packages/web/src/web/lib/types";

export const funcionarios: Funcionario[] = [
  {
    funcionario_id: "f-gerencia",
    funcionario_nome: "Gerência",
    funcionario_perfil: "gerencia",
    rotulo: "Gerência",
    resumo: "",
    ativo: true,
  },
  {
    funcionario_id: "f-atendimento",
    funcionario_nome: "Atendimento",
    funcionario_perfil: "garcom",
    rotulo: "Atendimento",
    resumo: "",
    ativo: true,
  },
  {
    funcionario_id: "f-producao",
    funcionario_nome: "Produção",
    funcionario_perfil: "producao",
    rotulo: "Produção",
    resumo: "",
    ativo: true,
  },
  {
    funcionario_id: "f-caixa",
    funcionario_nome: "Caixa",
    funcionario_perfil: "caixa",
    rotulo: "Caixa",
    resumo: "",
    ativo: true,
  },
];

export function funcionarioDoPerfil(perfil: Perfil): Funcionario {
  const funcionario = funcionarios.find(
    (entrada) => entrada.funcionario_perfil === perfil,
  );
  if (!funcionario) throw new Error(`Perfil de teste ausente: ${perfil}`);
  return funcionario;
}
