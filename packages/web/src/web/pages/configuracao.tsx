// Configuracao operacional da organizacao autenticada.

import { useState } from "react";
import { KeyRound, Moon, Save, Sun, UserPlus, Users } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { SectionHeading, StatusPill } from "../components/ui/pieces";
import { useTema } from "../components/theme-provider";
import { MENU_CATEGORIAS } from "../lib/types";
import type { Destino, Perfil, ProdutoConfiguracao } from "../lib/types";

const perfis: { value: Perfil; label: string }[] = [
  { value: "garcom", label: "Garçom" },
  { value: "caixa", label: "Caixa" },
  { value: "producao", label: "Cozinha e bar" },
  { value: "gerencia", label: "Gerência" },
];

function idDe(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function campoProduto(produto?: ProdutoConfiguracao) {
  return {
    nome: produto?.name ?? "",
    preco: produto ? String(produto.price).replace(".", ",") : "",
    categoria: produto?.categoria ?? MENU_CATEGORIAS[0],
    destino: produto?.destino_producao ?? ("bar" as Destino),
    ativo: produto?.ativo ?? true,
  };
}

export default function ConfiguracaoPage() {
  const { tema, alternarTema } = useTema();
  const {
    funcionarioAtivo,
    quantidadeMesas,
    larguraRecibo,
    produtos,
    funcionarios,
    configurarOperacao,
    salvarProduto,
    salvarFuncionario,
    alterarPin,
    notificar,
  } = useComanda();

  const [mesas, setMesas] = useState(String(quantidadeMesas));
  const [largura, setLargura] = useState<58 | 80>(larguraRecibo);
  const [produtoId, setProdutoId] = useState("");
  const [produto, setProduto] = useState(campoProduto());
  const [funcionarioId, setFuncionarioId] = useState("");
  const [funcionario, setFuncionario] = useState({
    nome: "",
    pin: "",
    perfil: "garcom" as Perfil,
    ativo: true,
  });
  const [pinAtual, setPinAtual] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function executar(tarefa: () => Promise<void>, sucesso: string) {
    setSalvando(true);
    try {
      await tarefa();
      notificar(sucesso, "sucesso");
    } catch (erro) {
      notificar(erro instanceof Error ? erro.message : "Não foi possível salvar.", "atencao");
    } finally {
      setSalvando(false);
    }
  }

  function selecionarProduto(id: string) {
    setProdutoId(id);
    setProduto(campoProduto(produtos.find((item) => item.produto_id === id)));
  }

  function selecionarFuncionario(id: string) {
    setFuncionarioId(id);
    const selecionado = funcionarios.find((item) => item.funcionario_id === id);
    setFuncionario(
      selecionado
        ? {
            nome: selecionado.funcionario_nome,
            pin: "",
            perfil: selecionado.funcionario_perfil,
            ativo: selecionado.ativo !== false,
          }
        : { nome: "", pin: "", perfil: "garcom", ativo: true },
    );
  }

  return (
    <AppShell
      titulo="Configuração"
      subtitulo="Mesas, cardápio, equipe e credenciais da operação"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="border-line bg-surface rounded-md border p-5">
          <SectionHeading
            eyebrow="Operação"
            title="Parâmetros do salão"
            hint="A configuração é salva para a organização autenticada."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-muted text-[12px]">
              Quantidade de mesas
              <input
                type="number"
                aria-label="Quantidade de mesas"
                min={1}
                max={200}
                value={mesas}
                onChange={(evento) => setMesas(evento.target.value)}
                className="border-line bg-surface-2 text-parchment mt-2 min-h-11 w-full rounded-md border px-3 text-[14px]"
              />
            </label>
            <label className="text-muted text-[12px]">
              Largura do recibo
              <select
                value={largura}
                onChange={(evento) => setLargura(Number(evento.target.value) === 58 ? 58 : 80)}
                className="border-line bg-surface-2 text-parchment mt-2 min-h-11 w-full rounded-md border px-3 text-[14px]"
              >
                <option value={58}>58 mm</option>
                <option value={80}>80 mm</option>
              </select>
            </label>
          </div>
          <Action
            variante="primaria"
            className="mt-4"
            disabled={salvando}
            onClick={() =>
              void executar(
                () => configurarOperacao(Number(mesas), largura),
                "Configuração da operação salva.",
              )
            }
          >
            <Save className="size-4" />
            Salvar operação
          </Action>
        </section>

        <section className="border-line bg-surface rounded-md border p-5">
          <SectionHeading
            eyebrow="Preferências"
            title="Aparência da tela"
            hint="A escolha fica vinculada à sessão atual deste dispositivo."
          />
          <Action onClick={alternarTema}>
            {tema === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          </Action>
        </section>

        <section className="border-line bg-surface rounded-md border p-5">
          <SectionHeading
            eyebrow="Cardápio"
            title="Produtos"
            hint={`${produtos.filter((item) => item.ativo).length} ativos · ${produtos.length} cadastrados`}
            action={
              <Action
                variante="fantasma"
                onClick={() => {
                  selecionarProduto("");
                }}
              >
                <Save className="size-4" />
                Novo produto
              </Action>
            }
          />
          <label className="text-muted block text-[12px]">
            Produto selecionado
            <select
              value={produtoId}
              onChange={(evento) => selecionarProduto(evento.target.value)}
              className="border-line bg-surface-2 text-parchment mt-2 min-h-11 w-full rounded-md border px-3 text-[14px]"
            >
              <option value="">Novo produto</option>
              {produtos.map((item) => (
                <option key={item.produto_id} value={item.produto_id}>
                  {item.name} {item.ativo ? "" : "(inativo)"}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              aria-label="Nome do produto"
              placeholder="Nome do produto"
              value={produto.nome}
              onChange={(evento) => setProduto((atual) => ({ ...atual, nome: evento.target.value }))}
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            />
            <input
              aria-label="Preço do produto"
              placeholder="Preço"
              inputMode="decimal"
              value={produto.preco}
              onChange={(evento) => setProduto((atual) => ({ ...atual, preco: evento.target.value }))}
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            />
            <select
              aria-label="Categoria do produto"
              value={produto.categoria}
              onChange={(evento) =>
                setProduto((atual) => ({
                  ...atual,
                  categoria: evento.target.value as ProdutoConfiguracao["categoria"],
                }))
              }
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            >
              {MENU_CATEGORIAS.map((categoria) => (
                <option key={categoria}>{categoria}</option>
              ))}
            </select>
            <select
              aria-label="Destino de produção"
              value={produto.destino}
              onChange={(evento) =>
                setProduto((atual) => ({ ...atual, destino: evento.target.value as Destino }))
              }
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            >
              <option value="bar">Bar</option>
              <option value="cozinha">Cozinha</option>
            </select>
          </div>
          <label className="text-muted mt-3 flex min-h-11 items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              aria-label="Produto disponível para lançamento"
              checked={produto.ativo}
              onChange={(evento) => setProduto((atual) => ({ ...atual, ativo: evento.target.checked }))}
            />
            Produto disponível para lançamento
          </label>
          <Action
            variante="primaria"
            className="mt-4"
            disabled={salvando}
            onClick={() =>
              void executar(async () => {
                const preco = Number(produto.preco.replace(",", "."));
                if (!produto.nome.trim() || !Number.isFinite(preco) || preco < 0) {
                  throw new Error("Informe nome e preço válidos.");
                }
                await salvarProduto({
                  produto_id: produtoId || `produto-${idDe(produto.nome)}`,
                  name: produto.nome.trim(),
                  price: preco,
                  categoria: produto.categoria,
                  destino_producao: produto.destino,
                  ativo: produto.ativo,
                });
              }, "Produto salvo.")
            }
          >
            <Save className="size-4" />
            Salvar produto
          </Action>
        </section>

        <section className="border-line bg-surface rounded-md border p-5">
          <SectionHeading
            eyebrow="Equipe"
            title="Acessos"
            hint={`${funcionarios.filter((item) => item.ativo !== false).length} ativos · PIN individual por funcionário`}
            action={
              <Action
                variante="fantasma"
                onClick={() => {
                  selecionarFuncionario("");
                }}
              >
                <UserPlus className="size-4" />
                Novo funcionário
              </Action>
            }
          />
          <label className="text-muted block text-[12px]">
            Funcionário selecionado
            <select
              value={funcionarioId}
              onChange={(evento) => selecionarFuncionario(evento.target.value)}
              className="border-line bg-surface-2 text-parchment mt-2 min-h-11 w-full rounded-md border px-3 text-[14px]"
            >
              <option value="">Novo funcionário</option>
              {funcionarios.map((item) => (
                <option key={item.funcionario_id} value={item.funcionario_id}>
                  {item.funcionario_nome} · {item.funcionario_perfil}
                  {item.ativo === false ? " (inativo)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              aria-label="Nome do funcionário"
              placeholder="Nome"
              value={funcionario.nome}
              onChange={(evento) =>
                setFuncionario((atual) => ({ ...atual, nome: evento.target.value }))
              }
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            />
            <input
              aria-label="PIN do funcionário"
              placeholder={funcionarioId ? "Novo PIN (opcional)" : "PIN de 4 dígitos"}
              inputMode="numeric"
              type="password"
              maxLength={4}
              value={funcionario.pin}
              onChange={(evento) =>
                setFuncionario((atual) => ({
                  ...atual,
                  pin: evento.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            />
            <select
              aria-label="Perfil do funcionário"
              value={funcionario.perfil}
              onChange={(evento) =>
                setFuncionario((atual) => ({ ...atual, perfil: evento.target.value as Perfil }))
              }
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px] sm:col-span-2"
            >
              {perfis.map((perfil) => (
                <option key={perfil.value} value={perfil.value}>
                  {perfil.label}
                </option>
              ))}
            </select>
          </div>
          <label className="text-muted mt-3 flex min-h-11 items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              aria-label="Funcionário ativo"
              checked={funcionario.ativo}
              onChange={(evento) =>
                setFuncionario((atual) => ({ ...atual, ativo: evento.target.checked }))
              }
            />
            Funcionário ativo
          </label>
          <Action
            variante="primaria"
            className="mt-4"
            disabled={salvando}
            onClick={() =>
              void executar(async () => {
                if (!funcionario.nome.trim()) throw new Error("Informe o nome do funcionário.");
                if (!funcionarioId && !/^\d{4}$/.test(funcionario.pin)) {
                  throw new Error("Um funcionário novo precisa de PIN de 4 dígitos.");
                }
                await salvarFuncionario({
                  funcionarioId: funcionarioId || `funcionario-${idDe(funcionario.nome)}`,
                  nome: funcionario.nome.trim(),
                  perfil: funcionario.perfil,
                  ...(funcionario.pin ? { pin: funcionario.pin } : {}),
                  ativo: funcionario.ativo,
                });
              }, "Funcionário salvo.")
            }
          >
            <Users className="size-4" />
            Salvar funcionário
          </Action>
        </section>

        <section className="border-line bg-surface rounded-md border p-5 lg:col-span-2">
          <SectionHeading
            eyebrow="Segurança"
            title="Meu PIN"
            hint={`Alteração para ${funcionarioAtivo.funcionario_nome}. O PIN atual é exigido.`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              aria-label="PIN atual"
              placeholder="PIN atual"
              inputMode="numeric"
              type="password"
              maxLength={4}
              value={pinAtual}
              onChange={(evento) => setPinAtual(evento.target.value.replace(/\D/g, "").slice(0, 4))}
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            />
            <input
              aria-label="Novo PIN"
              placeholder="Novo PIN"
              inputMode="numeric"
              type="password"
              maxLength={4}
              value={pinNovo}
              onChange={(evento) => setPinNovo(evento.target.value.replace(/\D/g, "").slice(0, 4))}
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            />
          </div>
          <Action
            variante="primaria"
            className="mt-4"
            disabled={salvando}
            onClick={() =>
              void executar(async () => {
                if (!/^\d{4}$/.test(pinAtual) || !/^\d{4}$/.test(pinNovo)) {
                  throw new Error("Informe o PIN atual e o novo PIN com 4 dígitos.");
                }
                await alterarPin(pinAtual, pinNovo);
                setPinAtual("");
                setPinNovo("");
              }, "PIN alterado.")
            }
          >
            <KeyRound className="size-4" />
            Alterar PIN
          </Action>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill label="PBKDF2" color="var(--vh-moss)" strong />
            <StatusPill label="PIN individual" color="var(--vh-gold)" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
