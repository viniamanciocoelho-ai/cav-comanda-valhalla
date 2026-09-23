import type { Dados } from "../components/comanda-provider";
import {
  codigoDoErro,
  erroDeRede,
  reaplicarAcao,
  type AcaoPersistencia,
} from "./offline";

interface Alteracao {
  operacaoId: string;
  versao: number;
  acao: AcaoPersistencia;
  entidadeId?: string;
  antes: Dados;
  depois: Dados;
}

interface EntradaPersistencia {
  versao: number;
  acao: AcaoPersistencia;
  entidadeId?: string;
  estado: Dados;
}

interface EstadoRemoto {
  versao: number;
  estado: Dados;
}

export interface ResultadoConfirmacao {
  versao: number;
  estado: Dados;
  reconciliado: boolean;
}

export class ConflitoAlteracaoError extends Error {
  constructor(
    readonly operacaoId: string,
    readonly conflitos: string[],
  ) {
    super("A alteração conflita com outra operação confirmada.");
    this.name = "ConflitoAlteracaoError";
  }
}

export class ResultadoAlteracaoDesconhecidoError extends Error {
  constructor(
    readonly operacaoId: string,
    causa: unknown,
  ) {
    super("Não foi possível verificar se a alteração foi gravada.");
    this.name = "ResultadoAlteracaoDesconhecidoError";
    this.causa = causa;
  }
  readonly causa: unknown;
}

function mesmoEstado(a: Dados, b: Dados) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resultadoIncerto(erro: unknown) {
  return erroDeRede(erro) || [
    "INTERNAL_SERVER_ERROR",
    "BAD_GATEWAY",
    "SERVICE_UNAVAILABLE",
    "GATEWAY_TIMEOUT",
  ].includes(codigoDoErro(erro) ?? "");
}

export async function confirmarAlteracao({
  alteracao,
  persistir,
  carregarEstado,
  baseConfirmada = alteracao.antes,
  somenteConciliar = false,
}: {
  alteracao: Alteracao;
  persistir: (entrada: EntradaPersistencia) => Promise<{ versao: number }>;
  carregarEstado: () => Promise<EstadoRemoto>;
  baseConfirmada?: Dados;
  somenteConciliar?: boolean;
}): Promise<ResultadoConfirmacao> {
  if (somenteConciliar) {
    try {
      const remoto = await carregarEstado();
      const rebase = reaplicarAcao(remoto.estado, alteracao);
      if (!rebase.conflitos.length && mesmoEstado(rebase.estado, remoto.estado)) {
        return { versao: remoto.versao, estado: remoto.estado, reconciliado: true };
      }
      throw new ResultadoAlteracaoDesconhecidoError(alteracao.operacaoId, null);
    } catch (erro) {
      if (erro instanceof ResultadoAlteracaoDesconhecidoError) throw erro;
      throw new ResultadoAlteracaoDesconhecidoError(alteracao.operacaoId, erro);
    }
  }
  const preparada = reaplicarAcao(baseConfirmada, alteracao);
  if (preparada.conflitos.length) {
    throw new ConflitoAlteracaoError(alteracao.operacaoId, preparada.conflitos);
  }
  if (mesmoEstado(preparada.estado, baseConfirmada)) {
    return { versao: alteracao.versao, estado: baseConfirmada, reconciliado: true };
  }

  let versao = alteracao.versao;
  let antes = baseConfirmada;
  let depois = preparada.estado;
  let reconciliado = false;

  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      const resultado = await persistir({
        versao,
        acao: alteracao.acao,
        entidadeId: alteracao.entidadeId,
        estado: depois,
      });
      return { versao: resultado.versao, estado: depois, reconciliado };
    } catch (erro) {
      const conflitoConfirmado = codigoDoErro(erro) === "CONFLICT";
      if (!conflitoConfirmado && !resultadoIncerto(erro)) throw erro;

      let remoto: EstadoRemoto;
      try {
        remoto = await carregarEstado();
      } catch (erroLeitura) {
        throw new ResultadoAlteracaoDesconhecidoError(
          alteracao.operacaoId,
          erroLeitura,
        );
      }

      const rebase = reaplicarAcao(remoto.estado, { antes, depois });
      if (rebase.conflitos.length) {
        if (!conflitoConfirmado) {
          throw new ResultadoAlteracaoDesconhecidoError(alteracao.operacaoId, erro);
        }
        throw new ConflitoAlteracaoError(alteracao.operacaoId, rebase.conflitos);
      }
      if (mesmoEstado(rebase.estado, remoto.estado)) {
        return {
          versao: remoto.versao,
          estado: remoto.estado,
          reconciliado: true,
        };
      }
      if (!conflitoConfirmado) {
        throw new ResultadoAlteracaoDesconhecidoError(alteracao.operacaoId, erro);
      }
      if (tentativa === 1) throw new ConflitoAlteracaoError(alteracao.operacaoId, []);

      versao = remoto.versao;
      antes = remoto.estado;
      depois = rebase.estado;
      reconciliado = true;
    }
  }

  throw new ResultadoAlteracaoDesconhecidoError(
    alteracao.operacaoId,
    new Error("Limite de tentativas atingido."),
  );
}
