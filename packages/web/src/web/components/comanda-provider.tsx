// Estado operacional sincronizado com o backend. O modo demo apenas controla a carga
// inicial ficticia; as operacoes autenticadas sao persistidas no banco.
//
// Desenho: um objeto `Dados` com todas as entidades e um espelho em `ref` para leitura
// sincrona. Toda acao le o estado atual, calcula o proximo e grava os dois de uma vez.
// Isso mantem operacoes que tocam varias entidades (envio de pedido, cancelamento,
// fechamento) atomicas e torna o duplo clique inofensivo.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  COMPARTILHADO,
  MESA_DEMO,
  TAXA_SERVICO,
  cardapio,
  compartilhadoId,
  ehCompartilhado,
  fechamentosIniciais,
  itensIniciais,
  mesasIniciais,
  pessoasIniciais,
  ticketsIniciais,
} from "../lib/demo-data";
import { paraCentavos, paraReais, ratear } from "../lib/rateio";
import { passosRoteiro } from "../lib/roteiro";
import type { EventoRoteiro } from "../lib/roteiro";
import { horaAgora } from "../lib/format";
import { client } from "../lib/api";
import { useSessao } from "./sessao-provider";
import type {
  EncerramentoSemConsumo,
  Fechamento,
  Funcionario,
  ItemStatus,
  LinhaDivisao,
  Mesa,
  MenuItem,
  MotivoSemConsumo,
  OrderItem,
  Perfil,
  Pessoa,
  ResumoMesa,
  Ticket,
  TicketStatus,
} from "../lib/types";

export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "sucesso" | "atencao";
}

export interface Dados {
  mesas: Mesa[];
  pessoas: Pessoa[];
  itens: OrderItem[];
  tickets: Ticket[];
  fechamentos: Fechamento[];
  /** Auditoria das mesas liberadas sem consumo. Nunca gera cobranca nem NFC-e. */
  encerramentos: EncerramentoSemConsumo[];
  /** Estado que o item tinha antes do pedido de cancelamento, para poder voltar. */
  anteriores: Record<string, ItemStatus>;
}

/** Leitura de elegibilidade da acao "encerrar sem consumo" para uma mesa. */
export interface AvaliacaoSemConsumo {
  /** Mesa aberta, sem item enviado, sem pagamento e sem fechamento em curso. */
  elegivel: boolean;
  /** O perfil ativo pode executar a acao nesta mesa. */
  permitido: boolean;
  /** Itens em rascunho (status "novo") que seriam descartados. */
  rascunhos: number;
  /** Motivo de a acao estar bloqueada, em texto para a tela. */
  impedimento: string | null;
}

interface EntradaSemConsumo {
  mesa_id: number;
  motivo: MotivoSemConsumo;
  observacao?: string;
}

export type ResultadoSemConsumo =
  | { ok: true; registro: EncerramentoSemConsumo }
  | { ok: false; erro: string };

interface NovoItem {
  mesa_id: number;
  pessoa_id: string;
  produto: MenuItem;
  quantidade?: number;
  observacao?: string;
}

interface ComandaState {
  // quem esta operando
  perfilAtivo: Perfil;
  funcionarioAtivo: Funcionario;
  trocarPerfil: (funcionario_id: string) => Funcionario | null;
  sair: () => void;
  cardapio: MenuItem[];
  quantidadeMesas: number;
  larguraRecibo: 58 | 80;
  funcionarios: Funcionario[];
  modoDemo: boolean;
  recarregarConfiguracao: () => Promise<void>;
  configurarOperacao: (quantidade: number, largura: 58 | 80) => Promise<void>;
  salvarProduto: (produto: MenuItem) => Promise<void>;
  salvarFuncionario: (entrada: {
    funcionarioId: string;
    nome: string;
    perfil: Perfil;
    pin: string;
  }) => Promise<void>;

  // dados
  mesas: Mesa[];
  pessoas: Pessoa[];
  itens: OrderItem[];
  tickets: Ticket[];
  fechamentos: Fechamento[];
  encerramentosSemConsumo: EncerramentoSemConsumo[];
  toasts: ToastMessage[];

  // leitura
  pessoasDaMesa: (mesa_id: number) => Pessoa[];
  itensDaMesa: (mesa_id: number) => OrderItem[];
  nomeDaPessoa: (pessoa_id: string) => string;
  resumo: (mesa_id: number) => ResumoMesa;
  avaliarSemConsumo: (mesa_id: number) => AvaliacaoSemConsumo;
  mesasDoGarcom: (funcionario_id: string) => Mesa[];
  filaCaixa: Mesa[];
  filaAberta: number;
  prontosParaEntrega: number;
  contasEmAberto: number;
  cancelamentosPendentes: OrderItem[];

  // escrita
  abrirMesa: (mesa_id: number) => void;
  adicionarPessoa: (mesa_id: number, nome: string) => Pessoa | null;
  adicionarItem: (novo: NovoItem) => void;
  alterarQuantidade: (item_id: string, delta: number) => void;
  definirObservacao: (item_id: string, texto: string) => void;
  removerItem: (item_id: string) => void;
  enviarPedido: (mesa_id: number) => number;
  enviandoMesa: number | null;
  avancarTicket: (ticket_id: string) => void;
  voltarTicket: (ticket_id: string) => void;
  marcarEntregue: (item_id: string) => void;
  solicitarCancelamento: (item_id: string) => void;
  autorizarCancelamento: (item_id: string) => void;
  recusarCancelamento: (item_id: string) => void;
  solicitarFechamento: (mesa_id: number) => boolean;
  alternarServico: (mesa_id: number) => void;
  fecharConta: (mesa_id: number, nfceSimulada: boolean) => Fechamento | null;
  encerrarSemConsumo: (entrada: EntradaSemConsumo) => ResultadoSemConsumo;
  desfazerEncerramentoSemConsumo: (encerramento_id: string) => boolean;
  reiniciarDemonstracao: () => void;
  notificar: (text: string, tone?: ToastMessage["tone"]) => void;
  descartarToast: (id: number) => void;

  // roteiro demonstrativo
  roteiroAberto: boolean;
  alternarRoteiro: (valor?: boolean) => void;
  passoAtual: number;
  irParaPasso: (numero: number) => void;
  concluidos: EventoRoteiro[];
  registrarEvento: (evento: EventoRoteiro) => void;
}

const ComandaContext = createContext<ComandaState | null>(null);
export const DESFAZER_SEM_CONSUMO_MS = 10_000;
const MOTIVOS_SEM_CONSUMO = new Set<MotivoSemConsumo>([
  "desistiram",
  "nao_encontraram",
  "engano",
  "troca_mesa",
  "outro",
]);

const avanco: Record<TicketStatus, TicketStatus | null> = {
  enviado: "preparando",
  preparando: "pronto",
  pronto: null,
  entregue: null,
};

const retorno: Record<TicketStatus, TicketStatus | null> = {
  enviado: null,
  preparando: "enviado",
  pronto: "preparando",
  entregue: null,
};

function estadoInicial(organizacaoId: string): Dados {
  return {
    mesas: mesasIniciais.map((m) => ({ ...m, organizacao_id: organizacaoId })),
    pessoas: pessoasIniciais.map((p) => ({ ...p })),
    itens: itensIniciais.map((i) => ({ ...i, organizacao_id: organizacaoId })),
    tickets: ticketsIniciais.map((t) => ({
      ...t,
      organizacao_id: organizacaoId,
      linhas: t.linhas.map((l) => ({ ...l })),
    })),
    fechamentos: fechamentosIniciais.map((f) => ({
      ...f,
      organizacao_id: organizacaoId,
    })),
    encerramentos: [],
    anteriores: {},
  };
}

function podeOperarMesa(funcionario: Funcionario, mesa: Mesa): boolean {
  return (
    funcionario.funcionario_perfil === "gerencia" ||
    (funcionario.funcionario_perfil === "garcom" &&
      mesa.garcom_id === funcionario.funcionario_id)
  );
}

function podeOperarProducao(funcionario: Funcionario): boolean {
  return (
    funcionario.funcionario_perfil === "gerencia" ||
    funcionario.funcionario_perfil === "producao"
  );
}

function podeOperarCaixa(funcionario: Funcionario): boolean {
  return (
    funcionario.funcionario_perfil === "gerencia" ||
    funcionario.funcionario_perfil === "caixa"
  );
}

/** Identifica a abertura da mesa: base da idempotencia do encerramento sem consumo. */
export function aberturaId(mesa: Mesa): string {
  return `ab-m${mesa.mesa_id}-${mesa.abertaEm ?? "sem-hora"}`;
}

/**
 * Decide se a mesa pode ser liberada sem consumo e quem pode fazer isso.
 * Bloqueia quando existe item enviado, ficha de producao, fechamento pedido ou consumo
 * lancado: nesses casos o fluxo normal de cancelamento e fechamento continua valendo.
 */
export function avaliarSemConsumoDe(
  dados: Dados,
  mesa_id: number,
  funcionario: Funcionario,
): AvaliacaoSemConsumo {
  const mesa = dados.mesas.find((m) => m.mesa_id === mesa_id);
  if (!mesa || !mesa.ativa || mesa.status === "livre" || !mesa.abertaEm) {
    return { elegivel: false, permitido: false, rascunhos: 0, impedimento: null };
  }

  const itens = dados.itens.filter((i) => i.mesa_id === mesa_id);
  const rascunhos = itens.filter((i) => i.status === "novo");
  const enviados = itens.length - rascunhos.length;
  const fichas = dados.tickets.filter((t) => t.mesa_id === mesa_id).length;

  let impedimento: string | null = null;
  if (enviados > 0 || fichas > 0) {
    impedimento =
      "Esta mesa já tem item enviado à produção. Use o cancelamento item a item ou o fechamento normal.";
  } else if (mesa.contaSolicitada) {
    impedimento = "O fechamento desta mesa já foi iniciado. A conclusão é no caixa.";
  } else if (mesa.totalFixo > 0) {
    impedimento = "Esta mesa já tem consumo lançado.";
  }

  const permitido = podeOperarMesa(funcionario, mesa);

  return {
    elegivel: impedimento === null,
    permitido,
    rascunhos: rascunhos.reduce((soma, i) => soma + i.quantidade, 0),
    impedimento,
  };
}

/** Itens que contam para a conta: cancelamento pedido segue contando ate a gerencia decidir. */
function itensCobraveis(itens: OrderItem[], mesa_id: number): OrderItem[] {
  return itens.filter((i) => i.mesa_id === mesa_id);
}

function calcularResumo(dados: Dados, mesa_id: number): ResumoMesa {
  const mesa = dados.mesas.find((m) => m.mesa_id === mesa_id);
  const itens = itensCobraveis(dados.itens, mesa_id);
  const pessoas = dados.pessoas.filter((p) => p.mesa_id === mesa_id);
  const servicoIncluso = mesa?.servicoIncluso ?? true;

  const centavosDoItem = (i: OrderItem) => paraCentavos(i.price) * i.quantidade;
  const subtotalCent = itens.reduce((soma, i) => soma + centavosDoItem(i), 0);
  const servicoCent = servicoIncluso ? Math.round(subtotalCent * TAXA_SERVICO) : 0;

  let divisao: LinhaDivisao[] = [];
  if (pessoas.length) {
    const individuaisCent = pessoas.map((p) =>
      itens.filter((i) => i.pessoa_id === p.pessoa_id).reduce((s, i) => s + centavosDoItem(i), 0),
    );
    const compartilhadoCent = itens
      .filter((i) => ehCompartilhado(i.pessoa_id))
      .reduce((s, i) => s + centavosDoItem(i), 0);

    // Rateio do compartilhado em partes iguais, com os centavos que sobram distribuidos.
    const rateiosCent = ratear(
      compartilhadoCent,
      pessoas.map(() => 1),
    );
    const basesCent = individuaisCent.map((v, indice) => v + rateiosCent[indice]);
    // Servico rateado proporcionalmente a base de cada pessoa: a soma fecha com o total.
    const servicosCent = ratear(servicoCent, basesCent);

    divisao = pessoas.map((p, indice) => ({
      pessoa_id: p.pessoa_id,
      pessoa: p.nome,
      individual: paraReais(individuaisCent[indice]),
      rateio: paraReais(rateiosCent[indice]),
      servico: paraReais(servicosCent[indice]),
      total: paraReais(basesCent[indice] + servicosCent[indice]),
    }));
  }

  return {
    mesa_id,
    subtotal: paraReais(subtotalCent),
    servico: paraReais(servicoCent),
    total: paraReais(subtotalCent + servicoCent),
    servicoIncluso,
    itens: itens.length,
    novos: itens.filter((i) => i.status === "novo").length,
    prontos: itens.filter((i) => i.status === "pronto").length,
    divisao,
  };
}

export function ComandaProvider({ children }: { children: React.ReactNode }) {
  const { sessao, sair } = useSessao();
  const organizacaoId = sessao!.organizacaoId;
  const [dados, setDados] = useState<Dados>(() => estadoInicial(organizacaoId));
  const espelho = useRef<Dados>(dados);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [funcionarioAtivo] = useState<Funcionario>(sessao!.funcionario);
  const [cardapioAtual, setCardapioAtual] = useState<MenuItem[]>(cardapio);
  const [quantidadeMesas, setQuantidadeMesas] = useState(15);
  const [larguraRecibo, setLarguraRecibo] = useState<58 | 80>(80);
  const [funcionariosAtuais, setFuncionariosAtuais] = useState<Funcionario[]>([]);
  const [modoDemo, setModoDemo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const versao = useRef(0);
  const hidratado = useRef(false);
  const escritasPendentes = useRef(0);
  const epocaPersistencia = useRef(0);
  const filaPersistencia = useRef<Promise<void>>(Promise.resolve());
  const [enviandoMesa, setEnviandoMesa] = useState<number | null>(null);
  const [roteiroAberto, setRoteiroAberto] = useState(false);
  const [passoAtual, setPassoAtual] = useState(1);
  const [concluidos, setConcluidos] = useState<EventoRoteiro[]>([]);

  // Sequencial para ids unicos, mesmo com dois lancamentos no mesmo milissegundo.
  const sequencia = useRef(0);
  // Pedidos ja enviados nesta sessao: guarda de idempotencia por pedido_id.
  const pedidosEnviados = useRef<Set<string>>(new Set());
  const travaEnvio = useRef<Set<number>>(new Set());
  const travaTicket = useRef<Set<string>>(new Set());
  // Encerramento sem consumo: trava de clique e guarda por abertura ja encerrada.
  const travaSemConsumo = useRef<Set<number>>(new Set());
  const aberturasEncerradas = useRef<Set<string>>(new Set());
  // Estado da mesa antes do encerramento, para o "Desfazer" de 10 s da demonstracao.
  const snapshotsSemConsumo = useRef<
    Map<string, { mesa: Mesa; pessoas: Pessoa[]; itens: OrderItem[] }>
  >(new Map());

  const carregarRemoto = useCallback(async (forcar = false) => {
    const remoto = await client.comanda.estado();
    if (remoto.versao >= versao.current && (forcar || escritasPendentes.current === 0)) {
      versao.current = remoto.versao;
      espelho.current = remoto.estado as Dados;
      setDados(remoto.estado as Dados);
    }
    setCardapioAtual(remoto.cardapio);
    setQuantidadeMesas(remoto.configuracao.quantidadeMesas);
    setLarguraRecibo(remoto.configuracao.larguraRecibo === 58 ? 58 : 80);
    setFuncionariosAtuais(remoto.funcionarios);
    setModoDemo(remoto.modoDemo);
    hidratado.current = true;
    setCarregando(false);
  }, []);

  useEffect(() => {
    // A carga inicial sincroniza a sessao com a API antes de habilitar persistencia.
    // oxlint-disable-next-line react/set-state-in-effect
    void carregarRemoto().catch(() => sair());
    const intervalo = window.setInterval(() => {
      if (escritasPendentes.current === 0) void carregarRemoto().catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(intervalo);
  }, [carregarRemoto, sair]);

  const persistir = useCallback(
    (proximo: Dados, acao: Parameters<typeof client.comanda.persistir>[0]["acao"]) => {
      if (!hidratado.current) return;
      const epoca = epocaPersistencia.current;
      escritasPendentes.current += 1;
      filaPersistencia.current = filaPersistencia.current
        .then(async () => {
          if (epoca !== epocaPersistencia.current) return;
          const resultado = await client.comanda.persistir({
            versao: versao.current,
            acao,
            entidadeId: proximo.mesas.find((mesa) => mesa.status !== "livre")?.mesa_id.toString(),
            estado: proximo,
          });
          versao.current = resultado.versao;
        })
        .catch(async () => {
          epocaPersistencia.current += 1;
          pedidosEnviados.current.clear();
          travaEnvio.current.clear();
          travaTicket.current.clear();
          setEnviandoMesa(null);
          setToasts((atual) => [
            ...atual.slice(-2),
            {
              id: Date.now(),
              text: "Não foi possível confirmar a alteração. O estado mais recente foi recarregado.",
              tone: "atencao",
            },
          ]);
          await carregarRemoto(true);
        })
        .finally(() => {
          escritasPendentes.current = Math.max(0, escritasPendentes.current - 1);
        });
    },
    [carregarRemoto],
  );

  const aplicar = useCallback((
    fn: (prev: Dados) => Dados,
    acao: Parameters<typeof client.comanda.persistir>[0]["acao"] = "alterar_comanda",
  ) => {
    const proximo = fn(espelho.current);
    if (proximo === espelho.current) return;
    espelho.current = proximo;
    setDados(proximo);
    persistir(proximo, acao);
  }, [persistir]);

  const novoId = useCallback((prefixo: string) => {
    sequencia.current += 1;
    return `${prefixo}${Date.now().toString(36)}${sequencia.current}`;
  }, []);

  const notificar = useCallback((text: string, tone: ToastMessage["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((atual) => [...atual.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((atual) => atual.filter((t) => t.id !== id));
    }, 4600);
  }, []);

  const descartarToast = useCallback((id: number) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  // ----------------------------------------------------------------- roteiro

  const registrarEvento = useCallback((evento: EventoRoteiro) => {
    setConcluidos((atual) => (atual.includes(evento) ? atual : [...atual, evento]));
    setPassoAtual((atual) => {
      const passo = passosRoteiro.find((p) => p.numero === atual);
      // Marcacao automatica: se a acao do passo em foco aconteceu, o painel anda sozinho.
      if (passo && passo.evento === evento) return Math.min(atual + 1, passosRoteiro.length);
      return atual;
    });
  }, []);

  const alternarRoteiro = useCallback((valor?: boolean) => {
    setRoteiroAberto((atual) => valor ?? !atual);
  }, []);

  const irParaPasso = useCallback((numero: number) => {
    setPassoAtual(Math.min(Math.max(numero, 1), passosRoteiro.length));
  }, []);

  // ----------------------------------------------------------------- perfis

  const trocarPerfil = useCallback(
    (funcionario_id: string) => {
      return funcionario_id === funcionarioAtivo.funcionario_id ? funcionarioAtivo : null;
    },
    [funcionarioAtivo],
  );

  // ----------------------------------------------------------------- leitura

  const pessoasDaMesa = useCallback(
    (mesa_id: number) => dados.pessoas.filter((p) => p.mesa_id === mesa_id),
    [dados.pessoas],
  );

  const itensDaMesa = useCallback(
    (mesa_id: number) => dados.itens.filter((i) => i.mesa_id === mesa_id),
    [dados.itens],
  );

  const nomeDaPessoa = useCallback(
    (pessoa_id: string) => {
      if (ehCompartilhado(pessoa_id)) return COMPARTILHADO;
      return dados.pessoas.find((p) => p.pessoa_id === pessoa_id)?.nome ?? pessoa_id;
    },
    [dados.pessoas],
  );

  const resumo = useCallback((mesa_id: number) => calcularResumo(dados, mesa_id), [dados]);

  const avaliarSemConsumo = useCallback(
    (mesa_id: number) => avaliarSemConsumoDe(dados, mesa_id, funcionarioAtivo),
    [dados, funcionarioAtivo],
  );

  const mesasDoGarcom = useCallback(
    (funcionario_id: string) =>
      dados.mesas.filter((m) => m.garcom_id === funcionario_id || m.status === "livre"),
    [dados.mesas],
  );

  const filaCaixa = useMemo(
    () => dados.mesas.filter((m) => m.contaSolicitada),
    [dados.mesas],
  );

  const filaAberta = useMemo(
    () => dados.tickets.filter((t) => t.status === "enviado" || t.status === "preparando").length,
    [dados.tickets],
  );

  const prontosParaEntrega = useMemo(
    () => dados.itens.filter((i) => i.status === "pronto").length,
    [dados.itens],
  );

  const cancelamentosPendentes = useMemo(
    () => dados.itens.filter((i) => i.status === "cancelamento_solicitado"),
    [dados.itens],
  );

  const contasEmAberto = useMemo(() => {
    return dados.mesas.reduce((soma, mesa) => {
      if (mesa.status === "livre") return soma;
      if (mesa.ativa) return soma + calcularResumo(dados, mesa.mesa_id).total;
      return soma + mesa.totalFixo;
    }, 0);
  }, [dados]);

  // ----------------------------------------------------------------- escrita

  const abrirMesa = useCallback(
    (mesa_id: number) => {
      const atual = espelho.current.mesas.find((m) => m.mesa_id === mesa_id);
      if (
        !atual ||
        atual.ativa ||
        atual.status !== "livre" ||
        (funcionarioAtivo.funcionario_perfil !== "gerencia" &&
          funcionarioAtivo.funcionario_perfil !== "garcom")
      ) {
        return;
      }
      const agora = new Date().toISOString();
      aplicar((prev) => ({
        ...prev,
        mesas: prev.mesas.map((m) =>
          m.mesa_id === mesa_id
            ? {
                ...m,
                status: "ocupada",
                ativa: true,
                abertaEm: agora,
                pessoasFixas: 0,
                totalFixo: 0,
                contaSolicitada: false,
                servicoIncluso: true,
                garcom_id:
                  funcionarioAtivo.funcionario_perfil === "garcom"
                    ? funcionarioAtivo.funcionario_id
                    : (m.garcom_id ?? funcionarioAtivo.funcionario_id),
              }
            : m,
        ),
      }), "abrir_mesa");
    },
    [aplicar, funcionarioAtivo],
  );

  const adicionarPessoa = useCallback(
    (mesa_id: number, nome: string) => {
      const limpo = nome.trim();
      if (!limpo) return null;
      const mesa = espelho.current.mesas.find((m) => m.mesa_id === mesa_id);
      if (!mesa || !mesa.ativa || !podeOperarMesa(funcionarioAtivo, mesa)) return null;
      const pessoa: Pessoa = {
        pessoa_id: `m${mesa_id}-${novoId("p")}`,
        nome: limpo,
        mesa_id,
      };
      aplicar((prev) => ({ ...prev, pessoas: [...prev.pessoas, pessoa] }));
      return pessoa;
    },
    [aplicar, funcionarioAtivo, novoId],
  );

  const adicionarItem = useCallback(
    ({ mesa_id, pessoa_id, produto, quantidade = 1, observacao = "" }: NovoItem) => {
      const atual = espelho.current;
      const mesa = atual.mesas.find((m) => m.mesa_id === mesa_id);
      const destinatarioValido =
        pessoa_id === compartilhadoId(mesa_id) ||
        atual.pessoas.some((p) => p.mesa_id === mesa_id && p.pessoa_id === pessoa_id);
      const quantidadeValida = Number.isInteger(quantidade) && quantidade > 0 && quantidade <= 20;
      const produtoValido =
        Number.isFinite(produto.price) &&
        produto.price >= 0 &&
        cardapioAtual.some(
          (item) =>
            item.produto_id === produto.produto_id &&
            item.name === produto.name &&
            item.price === produto.price &&
            item.destino_producao === produto.destino_producao,
        );
      if (
        !mesa ||
        !mesa.ativa ||
        mesa.contaSolicitada ||
        !podeOperarMesa(funcionarioAtivo, mesa) ||
        !destinatarioValido ||
        !quantidadeValida ||
        !produtoValido
      ) {
        return;
      }

      const agora = new Date().toISOString();
      const obs = observacao.trim();

      aplicar((prev) => {
        // Mesmo produto, mesma pessoa, mesma observacao e ainda nao enviado: soma quantidade.
        const existente = prev.itens.find(
          (i) =>
            i.status === "novo" &&
            i.mesa_id === mesa_id &&
            i.pessoa_id === pessoa_id &&
            i.produto_id === produto.produto_id &&
            i.observacao === obs,
        );
        if (existente) {
          return {
            ...prev,
            itens: prev.itens.map((i) =>
              i.item_id === existente.item_id
                ? { ...i, quantidade: i.quantidade + quantidade, atualizado_em: agora }
                : i,
            ),
          };
        }

        const item: OrderItem = {
          organizacao_id: organizacaoId,
          item_id: novoId("i"),
          pedido_id: null,
          mesa_id,
          pessoa_id,
          produto_id: produto.produto_id,
          name: produto.name,
          price: produto.price,
          quantidade,
          observacao: obs,
          destino_producao: produto.destino_producao,
          status: "novo",
          funcionario_id: funcionarioAtivo.funcionario_id,
          funcionario_nome: funcionarioAtivo.funcionario_nome,
          funcionario_perfil: funcionarioAtivo.funcionario_perfil,
          criado_em: agora,
          enviado_em: null,
          atualizado_em: agora,
        };
        return { ...prev, itens: [...prev.itens, item] };
      }, "alterar_comanda");

      // Passos do roteiro que dependem do item lancado. A deteccao usa o nome da pessoa
      // (nao o id semeado), para funcionar tambem com pessoas criadas durante a reuniao.
      const nomePessoa = espelho.current.pessoas
        .find((p) => p.pessoa_id === pessoa_id)
        ?.nome.trim()
        .toLowerCase();
      if (mesa_id === MESA_DEMO && produto.produto_id === "m2" && nomePessoa === "ana") {
        registrarEvento("chopp-ipa-ana");
      }
      if (mesa_id === MESA_DEMO && produto.produto_id === "m12" && obs) {
        registrarEvento("tabua-observacao");
      }
    },
    [aplicar, cardapioAtual, funcionarioAtivo, novoId, organizacaoId, registrarEvento],
  );

  const alterarQuantidade = useCallback(
    (item_id: string, delta: number) => {
      if (!Number.isInteger(delta) || Math.abs(delta) !== 1) return;
      const agora = new Date().toISOString();
      aplicar((prev) => {
        const item = prev.itens.find((i) => i.item_id === item_id);
        const mesa = item ? prev.mesas.find((m) => m.mesa_id === item.mesa_id) : null;
        if (
          !item ||
          item.status !== "novo" ||
          !mesa ||
          mesa.contaSolicitada ||
          !podeOperarMesa(funcionarioAtivo, mesa)
        ) {
          return prev;
        }
        const quantidade = item.quantidade + delta;
        if (quantidade <= 0) {
          return { ...prev, itens: prev.itens.filter((i) => i.item_id !== item_id) };
        }
        return {
          ...prev,
          itens: prev.itens.map((i) =>
            i.item_id === item_id ? { ...i, quantidade, atualizado_em: agora } : i,
          ),
        };
      }, "alterar_comanda");
    },
    [aplicar, funcionarioAtivo],
  );

  const definirObservacao = useCallback(
    (item_id: string, texto: string) => {
      const agora = new Date().toISOString();
      aplicar((prev) => {
        const item = prev.itens.find((i) => i.item_id === item_id);
        const mesa = item ? prev.mesas.find((m) => m.mesa_id === item.mesa_id) : null;
        if (
          !item ||
          item.status !== "novo" ||
          !mesa ||
          mesa.contaSolicitada ||
          !podeOperarMesa(funcionarioAtivo, mesa)
        ) {
          return prev;
        }
        return {
          ...prev,
          itens: prev.itens.map((i) =>
            i.item_id === item_id ? { ...i, observacao: texto, atualizado_em: agora } : i,
          ),
        };
      }, "alterar_comanda");
    },
    [aplicar, funcionarioAtivo],
  );

  const removerItem = useCallback(
    (item_id: string) => {
      aplicar((prev) => {
        const item = prev.itens.find((i) => i.item_id === item_id);
        const mesa = item ? prev.mesas.find((m) => m.mesa_id === item.mesa_id) : null;
        if (
          !item ||
          item.status !== "novo" ||
          !mesa ||
          mesa.contaSolicitada ||
          !podeOperarMesa(funcionarioAtivo, mesa)
        ) {
          return prev;
        }
        return { ...prev, itens: prev.itens.filter((i) => i.item_id !== item_id) };
      }, "alterar_comanda");
    },
    [aplicar, funcionarioAtivo],
  );

  /**
   * Envia os itens novos da mesa e abre uma ficha por destino (cozinha e bar separados).
   * Idempotente: o mesmo conjunto de itens nunca gera dois pedidos, mesmo com duplo clique.
   */
  const enviarPedido = useCallback(
    (mesa_id: number) => {
      if (travaEnvio.current.has(mesa_id)) return 0;

      const atual = espelho.current;
      const mesa = atual.mesas.find((m) => m.mesa_id === mesa_id);
      if (
        !mesa ||
        !mesa.ativa ||
        mesa.contaSolicitada ||
        !podeOperarMesa(funcionarioAtivo, mesa)
      ) {
        return 0;
      }
      const novos = atual.itens.filter((i) => i.mesa_id === mesa_id && i.status === "novo");
      if (!novos.length) return 0;

      const chave = `pd-m${mesa_id}-${novos
        .map((i) => `${i.item_id}x${i.quantidade}`)
        .sort()
        .join(".")}`;
      if (pedidosEnviados.current.has(chave)) return 0;
      pedidosEnviados.current.add(chave);

      travaEnvio.current.add(mesa_id);
      setEnviandoMesa(mesa_id);
      window.setTimeout(() => {
        travaEnvio.current.delete(mesa_id);
        setEnviandoMesa((m) => (m === mesa_id ? null : m));
      }, 500);

      const agora = new Date().toISOString();
      const pedido_id = novoId("pd");
      const ids = new Set(novos.map((i) => i.item_id));

      const porDestino = new Map<string, OrderItem[]>();
      for (const item of novos) {
        porDestino.set(item.destino_producao, [
          ...(porDestino.get(item.destino_producao) ?? []),
          item,
        ]);
      }

      const fichas: Ticket[] = [...porDestino.entries()].map(([destino, itens]) => ({
        organizacao_id: organizacaoId,
        ticket_id: novoId("t"),
        pedido_id,
        mesa_id,
        destino_producao: destino as Ticket["destino_producao"],
        status: "enviado",
        linhas: itens.map((item) => ({
          item_id: item.item_id,
          produto_id: item.produto_id,
          name: item.name,
          qty: item.quantidade,
          pessoa: ehCompartilhado(item.pessoa_id)
            ? COMPARTILHADO
            : (atual.pessoas.find((p) => p.pessoa_id === item.pessoa_id)?.nome ?? "—"),
          observacao: item.observacao,
        })),
        itemIds: itens.map((item) => item.item_id),
        funcionario_id: funcionarioAtivo.funcionario_id,
        funcionario_nome: funcionarioAtivo.funcionario_nome,
        criado_em: agora,
        enviado_em: agora,
        atualizado_em: agora,
      }));

      aplicar((prev) => ({
        ...prev,
        itens: prev.itens.map((i) =>
          ids.has(i.item_id)
            ? { ...i, status: "enviado", pedido_id, enviado_em: agora, atualizado_em: agora }
            : i,
        ),
        tickets: [...fichas, ...prev.tickets],
      }), "enviar_pedido");

      if (mesa_id === MESA_DEMO) registrarEvento("pedido-enviado");
      return novos.reduce((soma, i) => soma + i.quantidade, 0);
    },
    [aplicar, funcionarioAtivo, novoId, organizacaoId, registrarEvento],
  );

  /** Sincroniza a ficha e os itens da comanda vinculados a ela. */
  const moverTicket = useCallback(
    (ticket_id: string, destinoStatus: TicketStatus | null) => {
      if (!destinoStatus) return;
      const agora = new Date().toISOString();
      aplicar((prev) => {
        const ficha = prev.tickets.find((t) => t.ticket_id === ticket_id);
        if (!ficha) return prev;
        const ids = new Set(ficha.itemIds);
        return {
          ...prev,
          tickets: prev.tickets.map((t) =>
            t.ticket_id === ticket_id
              ? { ...t, status: destinoStatus, atualizado_em: agora }
              : t,
          ),
          itens: prev.itens.map((i) =>
            ids.has(i.item_id) &&
            i.status !== "entregue" &&
            i.status !== "cancelamento_solicitado"
              ? { ...i, status: destinoStatus as ItemStatus, atualizado_em: agora }
              : i,
          ),
        };
      }, "mover_producao");
    },
    [aplicar],
  );

  const avancarTicket = useCallback(
    (ticket_id: string) => {
      if (!podeOperarProducao(funcionarioAtivo) || travaTicket.current.has(ticket_id)) return;
      const ficha = espelho.current.tickets.find((t) => t.ticket_id === ticket_id);
      if (!ficha) return;
      const proximo = avanco[ficha.status];
      if (!proximo) return;
      travaTicket.current.add(ticket_id);
      window.setTimeout(() => travaTicket.current.delete(ticket_id), 600);
      moverTicket(ticket_id, proximo);
      if (ficha.mesa_id === MESA_DEMO) registrarEvento("producao-avancou");
    },
    [funcionarioAtivo, moverTicket, registrarEvento],
  );

  const voltarTicket = useCallback(
    (ticket_id: string) => {
      if (!podeOperarProducao(funcionarioAtivo) || travaTicket.current.has(ticket_id)) return;
      const ficha = espelho.current.tickets.find((t) => t.ticket_id === ticket_id);
      if (!ficha) return;
      const anterior = retorno[ficha.status];
      if (!anterior) return;
      travaTicket.current.add(ticket_id);
      window.setTimeout(() => travaTicket.current.delete(ticket_id), 600);
      moverTicket(ticket_id, anterior);
    },
    [funcionarioAtivo, moverTicket],
  );

  const marcarEntregue = useCallback(
    (item_id: string) => {
      const agora = new Date().toISOString();
      aplicar((prev) => {
        const item = prev.itens.find((i) => i.item_id === item_id);
        const mesa = item ? prev.mesas.find((m) => m.mesa_id === item.mesa_id) : null;
        if (
          !item ||
          item.status !== "pronto" ||
          !mesa ||
          !podeOperarMesa(funcionarioAtivo, mesa)
        ) {
          return prev;
        }
        const itens = prev.itens.map((i) =>
          i.item_id === item_id
            ? { ...i, status: "entregue" as ItemStatus, atualizado_em: agora }
            : i,
        );
        // Ficha com todos os itens entregues sai da fila de producao.
        const tickets = prev.tickets.map((t) => {
          if (!t.itemIds.includes(item_id)) return t;
          const todos = t.itemIds.every(
            (id) => itens.find((i) => i.item_id === id)?.status === "entregue",
          );
          return todos ? { ...t, status: "entregue" as TicketStatus, atualizado_em: agora } : t;
        });
        return { ...prev, itens, tickets };
      }, "entregar_item");
      const item = espelho.current.itens.find((i) => i.item_id === item_id);
      if (item?.mesa_id === MESA_DEMO) registrarEvento("item-entregue");
    },
    [aplicar, funcionarioAtivo, registrarEvento],
  );

  const solicitarCancelamento = useCallback(
    (item_id: string) => {
      const agora = new Date().toISOString();
      aplicar((prev) => {
        const item = prev.itens.find((i) => i.item_id === item_id);
        const mesa = item ? prev.mesas.find((m) => m.mesa_id === item.mesa_id) : null;
        if (
          !item ||
          item.status === "novo" ||
          item.status === "entregue" ||
          item.status === "cancelamento_solicitado" ||
          !mesa ||
          !podeOperarMesa(funcionarioAtivo, mesa)
        ) {
          return prev;
        }
        return {
          ...prev,
          anteriores: { ...prev.anteriores, [item_id]: item.status },
          itens: prev.itens.map((i) =>
            i.item_id === item_id
              ? { ...i, status: "cancelamento_solicitado" as ItemStatus, atualizado_em: agora }
              : i,
          ),
        };
      }, "solicitar_cancelamento");
    },
    [aplicar, funcionarioAtivo],
  );

  const autorizarCancelamento = useCallback(
    (item_id: string) => {
      const agora = new Date().toISOString();
      aplicar((prev) => {
        const item = prev.itens.find((i) => i.item_id === item_id);
        if (
          !item ||
          item.status !== "cancelamento_solicitado" ||
          funcionarioAtivo.funcionario_perfil !== "gerencia"
        ) {
          return prev;
        }
        const { [item_id]: _removido, ...anteriores } = prev.anteriores;
        const itensRestantes = prev.itens.filter((i) => i.item_id !== item_id);
        return {
          ...prev,
          anteriores,
          itens: itensRestantes,
          tickets: prev.tickets
            .map((t) => {
              if (!t.itemIds.includes(item_id)) return t;
              const itemIds = t.itemIds.filter((id) => id !== item_id);
              const statusItens = itemIds
                .map((id) => itensRestantes.find((i) => i.item_id === id)?.status)
                .filter((status): status is ItemStatus => Boolean(status));
              const status: TicketStatus =
                statusItens.length > 0 && statusItens.every((status) => status === "entregue")
                  ? "entregue"
                  : t.status;
              return {
                ...t,
                status,
                itemIds,
                linhas: t.linhas.filter((l) => l.item_id !== item_id),
                atualizado_em: agora,
              };
            })
            .filter((t) => t.linhas.length > 0),
        };
      }, "decidir_cancelamento");
    },
    [aplicar, funcionarioAtivo],
  );

  const recusarCancelamento = useCallback(
    (item_id: string) => {
      const agora = new Date().toISOString();
      aplicar((prev) => {
        const item = prev.itens.find((i) => i.item_id === item_id);
        if (
          !item ||
          item.status !== "cancelamento_solicitado" ||
          funcionarioAtivo.funcionario_perfil !== "gerencia"
        ) {
          return prev;
        }
        const anterior = prev.anteriores[item_id] ?? "enviado";
        const fichaAtual = prev.tickets.find((ticket) => ticket.itemIds.includes(item_id));
        const restaurado: ItemStatus =
          fichaAtual && fichaAtual.status !== "entregue" ? fichaAtual.status : anterior;
        const { [item_id]: _removido, ...anteriores } = prev.anteriores;
        return {
          ...prev,
          anteriores,
          itens: prev.itens.map((i) =>
            i.item_id === item_id ? { ...i, status: restaurado, atualizado_em: agora } : i,
          ),
        };
      }, "decidir_cancelamento");
    },
    [aplicar, funcionarioAtivo],
  );

  const solicitarFechamento = useCallback(
    (mesa_id: number) => {
      const mesa = espelho.current.mesas.find((m) => m.mesa_id === mesa_id);
      if (
        !mesa ||
        !mesa.ativa ||
        mesa.contaSolicitada ||
        !podeOperarMesa(funcionarioAtivo, mesa)
      ) {
        return false;
      }
      const itens = espelho.current.itens.filter((item) => item.mesa_id === mesa_id);
      const temPessoas = espelho.current.pessoas.some((p) => p.mesa_id === mesa_id);
      if (
        !itens.length ||
        !temPessoas ||
        itens.some(
          (item) => item.status === "novo" || item.status === "cancelamento_solicitado",
        )
      ) {
        return false;
      }
      aplicar((prev) => ({
        ...prev,
        mesas: prev.mesas.map((m) =>
          m.mesa_id === mesa_id ? { ...m, contaSolicitada: true, status: "aguardando" } : m,
        ),
      }), "solicitar_fechamento");
      if (mesa_id === MESA_DEMO) registrarEvento("fechamento-solicitado");
      return true;
    },
    [aplicar, funcionarioAtivo, registrarEvento],
  );

  const alternarServico = useCallback(
    (mesa_id: number) => {
      if (!podeOperarCaixa(funcionarioAtivo)) return;
      const mesa = espelho.current.mesas.find((m) => m.mesa_id === mesa_id);
      if (!mesa?.ativa) return;
      aplicar((prev) => ({
        ...prev,
        mesas: prev.mesas.map((m) =>
          m.mesa_id === mesa_id ? { ...m, servicoIncluso: !m.servicoIncluso } : m,
        ),
      }), "alterar_servico");
    },
    [aplicar, funcionarioAtivo],
  );

  const fecharConta = useCallback(
    (mesa_id: number, nfceSimulada: boolean) => {
      const atual = espelho.current;
      const mesa = atual.mesas.find((m) => m.mesa_id === mesa_id);
      if (!mesa || !mesa.ativa || !podeOperarCaixa(funcionarioAtivo)) return null;
      const calculo = calcularResumo(atual, mesa_id);
      const temCancelamentoPendente = atual.itens.some(
        (item) => item.mesa_id === mesa_id && item.status === "cancelamento_solicitado",
      );
      if (
        !calculo.itens ||
        calculo.novos > 0 ||
        !calculo.divisao.length ||
        temCancelamentoPendente
      ) {
        return null;
      }

      const registro: Fechamento = {
        organizacao_id: organizacaoId,
        fechamento_id: novoId("f"),
        mesa_id,
        hora: horaAgora(),
        subtotal: calculo.subtotal,
        servico: calculo.servico,
        total: calculo.total,
        servicoIncluso: calculo.servicoIncluso,
        divisao: calculo.divisao.map((l) => ({
          pessoa_id: l.pessoa_id,
          pessoa: l.pessoa,
          valor: l.total,
        })),
        nfce: nfceSimulada ? "simulada" : "nao_solicitada",
        funcionario_nome: funcionarioAtivo.funcionario_nome,
        // O garcom vem de quem lancou os itens da mesa; a mesa de apoio pode nao ter nenhum.
        garcom_nome:
          atual.itens.find(
            (i) => i.mesa_id === mesa_id && i.funcionario_perfil === "garcom",
          )?.funcionario_nome ??
          funcionariosAtuais.find((f) => f.funcionario_id === mesa.garcom_id)
            ?.funcionario_nome ??
          null,
      };

      aplicar((prev) => ({
        ...prev,
        fechamentos: [registro, ...prev.fechamentos],
        mesas: prev.mesas.map((m) =>
          m.mesa_id === mesa_id
            ? {
                ...m,
                status: "livre",
                ativa: false,
                contaSolicitada: false,
                abertaEm: null,
                garcom_id: null,
                servicoIncluso: true,
                pessoasFixas: 0,
                totalFixo: 0,
              }
            : m,
        ),
        itens: prev.itens.filter((i) => i.mesa_id !== mesa_id),
        tickets: prev.tickets.filter((t) => t.mesa_id !== mesa_id),
        pessoas: prev.pessoas.filter((p) => p.mesa_id !== mesa_id),
        anteriores: Object.fromEntries(
          Object.entries(prev.anteriores).filter(
            ([item_id]) => !atual.itens.some((i) => i.mesa_id === mesa_id && i.item_id === item_id),
          ),
        ),
      }), "fechar_conta");
      return registro;
    },
    [aplicar, funcionarioAtivo, funcionariosAtuais, novoId, organizacaoId],
  );

  /**
   * Libera uma mesa aberta que nao consumiu nada. NAO cria fechamento, pagamento, NFC-e
   * nem ficha de producao: grava so o registro de auditoria, devolve a mesa para "livre"
   * e limpa as pessoas daquela abertura.
   *
   * Idempotente: a trava por mesa barra o duplo clique e a chave de abertura barra a
   * repeticao da operacao. Equivale a procedure `mesa.encerrarSemConsumo` prevista na
   * arquitetura final (ver ARCHITECTURE_HANDOFF.md).
   */
  const encerrarSemConsumo = useCallback(
    ({ mesa_id, motivo, observacao = "" }: EntradaSemConsumo): ResultadoSemConsumo => {
      const atual = espelho.current;
      const mesa = atual.mesas.find((m) => m.mesa_id === mesa_id);
      if (!mesa) return { ok: false, erro: "Mesa não encontrada." };
      if (!MOTIVOS_SEM_CONSUMO.has(motivo)) {
        return { ok: false, erro: "Motivo de encerramento inválido." };
      }

      const abertura_id = aberturaId(mesa);
      if (travaSemConsumo.current.has(mesa_id) || aberturasEncerradas.current.has(abertura_id)) {
        return { ok: false, erro: "Esta mesa já foi liberada sem consumo." };
      }

      const avaliacao = avaliarSemConsumoDe(atual, mesa_id, funcionarioAtivo);
      if (!avaliacao.elegivel) {
        return {
          ok: false,
          erro: avaliacao.impedimento ?? "Esta mesa não está aberta para ser liberada.",
        };
      }
      if (!avaliacao.permitido) {
        return {
          ok: false,
          erro: "Somente a gerência ou o garçom responsável pela mesa pode liberá-la sem consumo.",
        };
      }

      travaSemConsumo.current.add(mesa_id);
      aberturasEncerradas.current.add(abertura_id);
      window.setTimeout(() => travaSemConsumo.current.delete(mesa_id), 600);

      const agora = new Date();
      const encerrada_em = agora.toISOString();
      const rascunhos = atual.itens.filter((i) => i.mesa_id === mesa_id);
      const pessoasDaAbertura = atual.pessoas.filter((p) => p.mesa_id === mesa_id);

      const registro: EncerramentoSemConsumo = {
        organizacao_id: organizacaoId,
        encerramento_id: novoId("sc"),
        mesa_id,
        abertura_id,
        encerrada_sem_consumo: true,
        motivo,
        observacao: observacao.trim(),
        rascunhos_descartados: rascunhos.reduce((soma, i) => soma + i.quantidade, 0),
        funcionario_id: funcionarioAtivo.funcionario_id,
        funcionario_nome: funcionarioAtivo.funcionario_nome,
        funcionario_perfil: funcionarioAtivo.funcionario_perfil,
        aberta_em: mesa.abertaEm,
        encerrada_em,
        duracao_segundos: mesa.abertaEm
          ? Math.max(
              0,
              Math.round((agora.getTime() - new Date(mesa.abertaEm).getTime()) / 1000),
            )
          : 0,
        desfeito_em: null,
      };

      // Guarda o estado anterior para o "Desfazer" da demonstracao.
      snapshotsSemConsumo.current.set(registro.encerramento_id, {
        mesa: { ...mesa },
        pessoas: pessoasDaAbertura.map((p) => ({ ...p })),
        itens: rascunhos.map((i) => ({ ...i })),
      });
      window.setTimeout(
        () => snapshotsSemConsumo.current.delete(registro.encerramento_id),
        DESFAZER_SEM_CONSUMO_MS + 1_000,
      );

      aplicar((prev) => ({
        ...prev,
        encerramentos: [registro, ...prev.encerramentos],
        mesas: prev.mesas.map((m) =>
          m.mesa_id === mesa_id
            ? {
                ...m,
                status: "livre",
                ativa: false,
                contaSolicitada: false,
                abertaEm: null,
                garcom_id: null,
                servicoIncluso: true,
                pessoasFixas: 0,
                totalFixo: 0,
              }
            : m,
        ),
        pessoas: prev.pessoas.filter((p) => p.mesa_id !== mesa_id),
        itens: prev.itens.filter((i) => i.mesa_id !== mesa_id),
      }), "encerrar_sem_consumo");

      return { ok: true, registro };
    },
    [aplicar, funcionarioAtivo, novoId, organizacaoId],
  );

  /**
   * Desfaz um encerramento sem consumo dentro da janela da demonstracao. Só age se a mesa
   * continuou livre e ninguem lancou nada nela nesse intervalo. O registro de auditoria
   * nao e apagado: fica marcado como desfeito.
   */
  const desfazerEncerramentoSemConsumo = useCallback(
    (encerramento_id: string) => {
      const atual = espelho.current;
      const registro = atual.encerramentos.find((e) => e.encerramento_id === encerramento_id);
      const guardado = snapshotsSemConsumo.current.get(encerramento_id);
      if (!registro || registro.desfeito_em || !guardado) return false;
      const encerradaEm = new Date(registro.encerrada_em).getTime();
      if (
        !Number.isFinite(encerradaEm) ||
        Date.now() - encerradaEm > DESFAZER_SEM_CONSUMO_MS
      ) {
        snapshotsSemConsumo.current.delete(encerramento_id);
        return false;
      }

      const mesa = atual.mesas.find((m) => m.mesa_id === registro.mesa_id);
      const mexeram =
        !mesa ||
        mesa.ativa ||
        atual.itens.some((i) => i.mesa_id === registro.mesa_id) ||
        atual.pessoas.some((p) => p.mesa_id === registro.mesa_id);
      if (mexeram) return false;

      const desfeito_em = new Date().toISOString();
      snapshotsSemConsumo.current.delete(encerramento_id);
      aberturasEncerradas.current.delete(registro.abertura_id);

      aplicar((prev) => ({
        ...prev,
        encerramentos: prev.encerramentos.map((e) =>
          e.encerramento_id === encerramento_id ? { ...e, desfeito_em } : e,
        ),
        mesas: prev.mesas.map((m) =>
          m.mesa_id === registro.mesa_id ? { ...guardado.mesa } : m,
        ),
        pessoas: [...prev.pessoas, ...guardado.pessoas.map((p) => ({ ...p }))],
        itens: [...prev.itens, ...guardado.itens.map((i) => ({ ...i }))],
      }), "desfazer_sem_consumo");
      return true;
    },
    [aplicar],
  );

  const reiniciarDemonstracao = useCallback(() => {
    if (!modoDemo) {
      notificar("Reiniciar demonstração só está disponível com CAV_DEMO_MODE=true.", "atencao");
      return;
    }
    pedidosEnviados.current.clear();
    travaEnvio.current.clear();
    travaTicket.current.clear();
    travaSemConsumo.current.clear();
    aberturasEncerradas.current.clear();
    snapshotsSemConsumo.current.clear();
    sequencia.current = 0;
    const inicial = estadoInicial(organizacaoId);
    espelho.current = inicial;
    setDados(inicial);
    setToasts([]);
    setEnviandoMesa(null);
    setRoteiroAberto(false);
    setConcluidos([]);
    setPassoAtual(1);
    persistir(inicial, "reiniciar");
    notificar("Operação reiniciada: mesas, fichas e roteiro voltaram ao início.", "info");
  }, [modoDemo, notificar, organizacaoId, persistir]);

  const configurarOperacao = useCallback(
    async (quantidade: number, largura: 58 | 80) => {
      const resultado = await client.comanda.configurar({
        versao: versao.current,
        quantidadeMesas: quantidade,
        larguraRecibo: largura,
      });
      versao.current = resultado.versao;
      await carregarRemoto(true);
    },
    [carregarRemoto],
  );

  const salvarProduto = useCallback(async (produto: MenuItem) => {
    await client.comanda.produtoSalvar(produto);
    await carregarRemoto();
  }, [carregarRemoto]);

  const salvarFuncionario = useCallback(
    async (entrada: {
      funcionarioId: string;
      nome: string;
      perfil: Perfil;
      pin: string;
    }) => {
      await client.comanda.funcionarioSalvar(entrada);
      await carregarRemoto();
    },
    [carregarRemoto],
  );

  const valor: ComandaState = {
    perfilAtivo: funcionarioAtivo.funcionario_perfil,
    funcionarioAtivo,
    trocarPerfil,
    sair,
    cardapio: cardapioAtual,
    quantidadeMesas,
    larguraRecibo,
    funcionarios: funcionariosAtuais,
    modoDemo,
    recarregarConfiguracao: carregarRemoto,
    configurarOperacao,
    salvarProduto,
    salvarFuncionario,

    mesas: dados.mesas,
    pessoas: dados.pessoas,
    itens: dados.itens,
    tickets: dados.tickets,
    fechamentos: dados.fechamentos,
    encerramentosSemConsumo: dados.encerramentos,
    toasts,

    pessoasDaMesa,
    itensDaMesa,
    nomeDaPessoa,
    resumo,
    avaliarSemConsumo,
    mesasDoGarcom,
    filaCaixa,
    filaAberta,
    prontosParaEntrega,
    contasEmAberto,
    cancelamentosPendentes,

    abrirMesa,
    adicionarPessoa,
    adicionarItem,
    alterarQuantidade,
    definirObservacao,
    removerItem,
    enviarPedido,
    enviandoMesa,
    avancarTicket,
    voltarTicket,
    marcarEntregue,
    solicitarCancelamento,
    autorizarCancelamento,
    recusarCancelamento,
    solicitarFechamento,
    alternarServico,
    fecharConta,
    encerrarSemConsumo,
    desfazerEncerramentoSemConsumo,
    reiniciarDemonstracao,
    notificar,
    descartarToast,

    roteiroAberto,
    alternarRoteiro,
    passoAtual,
    irParaPasso,
    concluidos,
    registrarEvento,
  };

  if (carregando) {
    return (
      <div className="bg-void text-muted grid min-h-dvh place-items-center text-[13px]">
        Carregando operação…
      </div>
    );
  }
  return <ComandaContext.Provider value={valor}>{children}</ComandaContext.Provider>;
}

export function useComanda(): ComandaState {
  const contexto = useContext(ComandaContext);
  if (!contexto) throw new Error("useComanda precisa estar dentro de ComandaProvider");
  return contexto;
}

/** Atalho para o cardapio provisorio, exposto junto do estado por conveniencia. */
export { cardapio, compartilhadoId, ehCompartilhado };
