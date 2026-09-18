// O que ainda depende de decisao ou levantamento no local. Tela honesta de escopo.

import { useState } from "react";
import {
  ChefHat,
  FileCheck2,
  MonitorSmartphone,
  Printer,
  Save,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useComanda } from "../components/comanda-provider";
import { Action } from "../components/ui/action";
import { DemoTag, RuneDivider, SectionHeading, StatusPill } from "../components/ui/pieces";
import { useTema } from "../components/theme-provider";
import { configuracaoPrevista } from "../lib/demo-data";
import { client } from "../lib/api";
import type { Destino, MenuItem, Perfil } from "../lib/types";

const icones: Record<string, LucideIcon> = {
  "monitor-smartphone": MonitorSmartphone,
  printer: Printer,
  "file-check-2": FileCheck2,
  utensils: UtensilsCrossed,
  "chef-hat": ChefHat,
  users: Users,
};

const naoIncluido = [
  "Emissão real de NFC-e (prevista, depende de credenciais e homologação)",
  "Pagamento dentro do sistema (maquininha segue como está hoje)",
  "Controle de estoque e ficha técnica",
  "Aplicativo para o cliente pedir sozinho",
  "Integração com delivery e marketplaces",
];

export default function ConfiguracaoPage() {
  const { tema, alternarTema } = useTema();
  const {
    reiniciarDemonstracao,
    quantidadeMesas,
    larguraRecibo,
    cardapio,
    funcionarios,
    modoDemo,
    configurarOperacao,
    salvarProduto,
    salvarFuncionario,
    notificar,
  } = useComanda();
  const [mesas, setMesas] = useState(String(quantidadeMesas));
  const [largura, setLargura] = useState<58 | 80>(larguraRecibo);
  const [produto, setProduto] = useState({
    nome: "",
    preco: "",
    categoria: "Bebidas" as MenuItem["categoria"],
    destino: "bar" as Destino,
  });
  const [funcionario, setFuncionario] = useState({
    nome: "",
    pin: "",
    perfil: "garcom" as Perfil,
  });
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

  function idDe(texto: string) {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  return (
    <AppShell
      titulo="Configuração"
      subtitulo="O que já está definido e o que ainda será levantado na Valhalla"
    >
      <SectionHeading
        eyebrow="Escopo"
        title="Pontos a confirmar"
        hint="Preferimos deixar visível o que depende de decisão de vocês em vez de prometer pronto."
        action={<DemoTag>Integração fiscal prevista</DemoTag>}
      />

      <ul className="grid gap-3 lg:grid-cols-2">
        {configuracaoPrevista.map((item) => {
          const Icone = icones[item.icone] ?? MonitorSmartphone;
          const cor = item.tipo === "atencao" ? "var(--vh-ember)" : "var(--vh-moss)";
          return (
            <li
              key={item.titulo}
              className="border-line bg-surface flex gap-3.5 rounded-md border p-4"
              data-testid={`config-${item.titulo}`}
            >
              <span
                className="border-line bg-surface-2 text-gold grid size-11 shrink-0 place-items-center rounded-md border"
                aria-hidden="true"
              >
                <Icone className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <h3 className="text-parchment text-[15px] tracking-[0.06em]">{item.titulo}</h3>
                  <StatusPill label={item.estado} color={cor} />
                </div>
                <p className="text-muted text-[13px] leading-relaxed">{item.texto}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <RuneDivider className="my-8" />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="border-line bg-surface rounded-md border p-5">
          <h2 className="text-parchment text-[17px] tracking-[0.06em]">Operação</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-muted text-[12px]">
              Quantidade de mesas
              <input
                type="number"
                min={1}
                max={200}
                value={mesas}
                onChange={(evento) => setMesas(evento.target.value)}
                className="border-line bg-surface-2 text-parchment mt-2 min-h-11 w-full rounded-md border px-3 text-[14px]"
              />
            </label>
            <label className="text-muted text-[12px]">
              Largura da notinha
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
          <h2 className="text-parchment text-[17px] tracking-[0.06em]">Fora do piloto</h2>
          <p className="text-muted mt-1.5 text-[13px] leading-relaxed">
            Itens que não entram nesta primeira etapa. Podem ser avaliados depois, com o sistema já
            rodando no salão.
          </p>
          <ul className="mt-4 grid gap-2">
            {naoIncluido.map((texto) => (
              <li key={texto} className="text-muted flex gap-2.5 text-[13px] leading-relaxed">
                <span className="border-bronze mt-[7px] size-1.5 shrink-0 rotate-45 border" aria-hidden="true" />
                {texto}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-line bg-surface rounded-md border p-5">
          <h2 className="text-parchment text-[17px] tracking-[0.06em]">Cardápio</h2>
          <p className="text-muted mt-1 text-[12px]">{cardapio.length} itens ativos</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              aria-label="Nome do item"
              placeholder="Nome do item"
              value={produto.nome}
              onChange={(evento) => setProduto((atual) => ({ ...atual, nome: evento.target.value }))}
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            />
            <input
              aria-label="Preço do item"
              placeholder="Preço"
              inputMode="decimal"
              value={produto.preco}
              onChange={(evento) => setProduto((atual) => ({ ...atual, preco: evento.target.value }))}
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            />
            <select
              aria-label="Categoria do item"
              value={produto.categoria}
              onChange={(evento) =>
                setProduto((atual) => ({
                  ...atual,
                  categoria: evento.target.value as MenuItem["categoria"],
                }))
              }
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px]"
            >
              {["Chopes", "Bebidas", "Petiscos", "Cozinha"].map((categoria) => (
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
          <Action
            className="mt-4"
            disabled={salvando}
            onClick={() =>
              void executar(async () => {
                const preco = Number(produto.preco.replace(",", "."));
                if (!produto.nome.trim() || !Number.isFinite(preco) || preco < 0) {
                  throw new Error("Informe nome e preço válidos.");
                }
                await salvarProduto({
                  produto_id: `cad-${idDe(produto.nome)}`,
                  name: produto.nome.trim(),
                  price: preco,
                  categoria: produto.categoria,
                  destino_producao: produto.destino,
                });
                setProduto((atual) => ({ ...atual, nome: "", preco: "" }));
              }, "Item do cardápio salvo.")
            }
          >
            <Save className="size-4" />
            Salvar item
          </Action>
        </section>

        <section className="border-line bg-surface rounded-md border p-5">
          <h2 className="text-parchment text-[17px] tracking-[0.06em]">Equipe e acessos</h2>
          <p className="text-muted mt-1 text-[12px]">{funcionarios.length} funcionários ativos</p>
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
              placeholder="PIN de 4 dígitos"
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
                setFuncionario((atual) => ({
                  ...atual,
                  perfil: evento.target.value as Perfil,
                }))
              }
              className="border-line bg-surface-2 text-parchment min-h-11 rounded-md border px-3 text-[14px] sm:col-span-2"
            >
              <option value="garcom">Garçom</option>
              <option value="caixa">Caixa</option>
              <option value="producao">Cozinha e bar</option>
              <option value="gerencia">Gerência</option>
            </select>
          </div>
          <Action
            className="mt-4"
            disabled={salvando}
            onClick={() =>
              void executar(async () => {
                if (!funcionario.nome.trim() || !/^\d{4}$/.test(funcionario.pin)) {
                  throw new Error("Informe nome e PIN de 4 dígitos.");
                }
                await salvarFuncionario({
                  funcionarioId: `f-${idDe(funcionario.nome)}`,
                  nome: funcionario.nome.trim(),
                  perfil: funcionario.perfil,
                  pin: funcionario.pin,
                });
                setFuncionario((atual) => ({ ...atual, nome: "", pin: "" }));
              }, "Funcionário salvo.")
            }
          >
            <Users className="size-4" />
            Salvar funcionário
          </Action>
        </section>

        <section className="border-line bg-surface rounded-md border p-5">
          <h2 className="text-parchment text-[17px] tracking-[0.06em]">Preferências da tela</h2>
          <p className="text-muted mt-1.5 text-[13px] leading-relaxed">
            O tema claro serve para ambientes com muita luz. O escuro é o padrão, pensado para o
            salão à noite. A escolha vale apenas para esta sessão.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Action onClick={alternarTema}>
              {tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            </Action>
            {modoDemo ? (
              <Action
                variante="tracejada"
                onClick={reiniciarDemonstracao}
                data-testid="reiniciar-demonstracao"
              >
                Reiniciar demonstração
              </Action>
            ) : null}
          </div>

          <div className="border-bronze/50 bg-surface-2 mt-5 rounded-md border border-dashed p-3.5">
            <p className="font-display text-parchment text-[12px] tracking-[0.14em] uppercase">
              Brasão provisório
            </p>
            <p className="text-muted mt-1.5 text-[12px] leading-relaxed">
              O símbolo usado nesta demonstração é um desenho provisório feito para a apresentação.
              Com o logotipo oficial da Valhalla em arquivo, ele é substituído sem mudar o layout.
            </p>
          </div>
        </section>
      </div>

      <p className="text-muted mt-7 text-[12px] leading-relaxed">
        Dados operacionais persistidos no banco e sincronizados entre dispositivos. NFC-e e
        pagamento integrado continuam fora desta fase.
      </p>
    </AppShell>
  );
}
