# Handoff de arquitetura — CAV Comanda | Valhalla (V2, modo garçom)

Documento para quem vai continuar o código depois da reunião: onde está cada coisa, por que está assim,
e quais integrações continuam pendentes após a Fase 1.

**A Fase 1 já tem backend, banco, autenticação por PIN, RBAC e persistência.** O modo demo apenas controla
se a carga inicial contém dados fictícios. Pagamento integrado e emissão fiscal continuam fora do escopo.

---

## 1. Stack e comandos

| Item | Valor |
|------|-------|
| Runtime / bundler | Bun + Vite |
| UI | React 19, Tailwind v4, ícones SVG locais |
| Rotas | `wouter` |
| Porta de desenvolvimento | 4200 |

```bash
bun install
bun run dev          # http://localhost:4200
bun run build:web    # build de produção
bun run lint         # 0 erros
cd packages/web && bunx tsc --noEmit -p tsconfig.app.json   # 0 erros
python3 e2e/flow.py      # suíte de fluxo   (63 verificações)
python3 e2e/roteiro.py   # 22 passos + regras de UI (79 verificações)
```

> `bun run dev:web` **não existe**. O script é `bun run dev`.
> Se uma alteração de código não aparecer no navegador, o cache de transform do Vite ficou obsoleto:
> mate o processo, `rm -rf node_modules/.vite packages/web/node_modules/.vite` e suba de novo.

---

## 2. Mapa de arquivos

```
packages/web/src/web/
  app.tsx                      rotas + guarda de rota por perfil
  components/
    comanda-provider.tsx       ESTADO CENTRAL (toda a regra de negócio)
    app-shell.tsx              moldura: topo, navegação, painel do roteiro
    perfil-sheet.tsx           sessão atual e logout
    menu-sheet.tsx             cardápio: pessoa → item → quantidade → observação
    checkout-sheet.tsx         divisão por pessoa, taxa de serviço, notinha simples
    roteiro-panel.tsx          painel dos 14 passos da demonstração
    ui/                        Action, Sheet, StatusPill, Metric, DemoTag, BrandMark
  pages/
    index.tsx                  Salão (gerência)
    garcom.tsx                 Mesas do turno do garçom
    mesa.tsx                   Comanda da mesa: pessoas, itens, envio, entrega
    producao.tsx               Fichas de cozinha e bar
    caixa.tsx                  Fila de fechamento
    fechamentos.tsx            Histórico persistido
    configuracao.tsx           Mesas, notinha, cardápio e equipe
  lib/
    types.ts                   tipos de domínio
    demo-data.ts               dados demonstrativos (mesas 02, 06 e 08 com comanda)
    perfis.ts                  perfis, rota inicial, rotas permitidas, restrições
    roteiro.ts                 14 passos e os eventos que os marcam
    rateio.ts                  aritmética da divisão em centavos
    format.ts                  moeda, hora, rótulos de estado
e2e/
  flow.py, roteiro.py          suítes Playwright (Chrome do sistema)
  shots/                       capturas geradas pelas suítes
```

---

## 3. Estado central: `comanda-provider.tsx`

Um único provedor React guarda tudo e expõe as operações. Nenhuma tela guarda regra de negócio —
páginas só leem e disparam ações. É o arquivo a ser trocado por chamadas de API no piloto.

Entidades (`lib/types.ts`): `Mesa`, `Pessoa`, `OrderItem`, `Ticket`, `Fechamento`, `EncerramentoSemConsumo`,
`Funcionario`, `Perfil`.

Operações principais:

| Operação | O que faz |
|----------|-----------|
| `adicionarItem` | cria item com status `novo`, dono (pessoa ou compartilhado), autor e horário |
| `enviarPedido` | promove itens `novo` → `enviado` e gera fichas separadas por destino (cozinha / bar) |
| `avancarTicket` / `voltarTicket` | move a ficha: `enviado → preparando → pronto`, reflete na comanda |
| `marcarEntregue` | garçom confirma a entrega na mesa |
| `pedirCancelamento` / `autorizarCancelamento` / `recusarCancelamento` | item em produção só sai com autorização da gerência (`cancelamento_solicitado`) |
| `solicitarFechamento` | garçom manda a mesa para a fila do caixa |
| `alternarServico` | inclui/retira os 10% — **somente no caixa** |
| `fecharConta` | grava o `Fechamento` com a divisão por pessoa, quem operou o caixa e qual garçom atendeu |
| `avaliarSemConsumo` | regra pura (`avaliarSemConsumoDe`): diz se a mesa é elegível, se o perfil pode e quantos rascunhos seriam descartados |
| `encerrarSemConsumo` | libera a mesa vazia sem cobrança: zera a mesa, remove pessoas e rascunhos, grava `EncerramentoSemConsumo`. **Não** cria fechamento, pagamento, NFC-e nem ficha |
| `desfazerEncerramentoSemConsumo` | restaura a abertura pelo instantâneo em memória (10 s), se nada mudou na mesa; a auditoria fica, marcada como desfeita |
| `reiniciarDemonstracao` | devolve o estado demo somente quando `CAV_DEMO_MODE=true` |

Quatro invariantes que não podem ser quebradas:

1. **Envio idempotente.** `enviarPedido` filtra por status `novo` e ainda guarda uma chave derivada de
   itens+quantidades; o botão trava enquanto envia. Duplo clique não duplica item.
2. **Divisão fecha no centavo.** `lib/rateio.ts` trabalha em centavos e distribui o resto pelo método do
   maior resto: a soma das partes é sempre igual ao total da mesa, com ou sem taxa de serviço.
3. **Autoria e horário por item.** Todo item registra quem lançou e quando. A ficha de produção mostra
   mesa, pessoa e garçom; a comanda mostra autor e hora.
4. **Encerramento sem consumo é idempotente por abertura.** A chave é `aberturaId()` = `ab-m{mesa}-{abertaEm}`.
   A mesma abertura não encerra duas vezes, e a operação nunca toca `fechamentos` nem `tickets`.

---

## 4. Perfis e guarda de rota (`lib/perfis.ts`, `app.tsx`)

O login por PIN cria uma sessão bearer. O backend vincula o funcionário à organização e aplica as permissões
nas rotas de leitura e escrita; a guarda de rota no frontend é apenas uma camada de experiência.

| Perfil | Rota inicial | Rotas permitidas |
|--------|--------------|------------------|
| Gerência | `/` | todas |
| Rafael (garçom) | `/garcom` | `/garcom`, `/mesa/*` |
| Cozinha e bar | `/producao` | `/producao` |
| Caixa | `/caixa` | `/caixa`, `/mesa/*`, `/fechamentos` |

`podeAcessar()` é aplicado em `app.tsx`: tentar `/configuracao`, `/fechamentos` ou `/caixa` como garçom
redireciona para a rota inicial do perfil. As restrições de cada perfil aparecem escritas no seletor,
sem tela de senha falsa.

Os PINs de bootstrap podem ser definidos por `CAV_BOOTSTRAP_PIN_GERENCIA`, `CAV_BOOTSTRAP_PIN_GARCOM`,
`CAV_BOOTSTRAP_PIN_PRODUCAO` e `CAV_BOOTSTRAP_PIN_CAIXA`. Em produção, eles são obrigatórios.

---

## 5. Roteiro da demonstração (`lib/roteiro.ts`, `roteiro-panel.tsx`)

Painel lateral com 14 passos. Avança à mão (Próximo / Anterior) **e** marca sozinho quando a ação
acontece de verdade no estado — cada passo escuta um `EventoRoteiro` (`chopp-ipa-ana`, `pedido-enviado`,
`notinha-impressa`, …). O painel orienta sem bloquear nada: dá para sair do roteiro a qualquer momento.

Mesa do roteiro: **08** (Fábio, Ana, Bruno, Carol). Mesas 02 e 06 também já têm comanda; as demais abrem
em branco.

---

## 6. O que vira servidor no piloto

| Fase 1 | Próxima decisão |
|--------|-----------------|
| API + banco com Hono/oRPC, Drizzle e libSQL | migrações remotas controladas pela infraestrutura |
| login por PIN, sessão, RBAC e isolamento por organização | gestão operacional de troca/recuperação de PIN |
| cardápio editável e quantidade de mesas configurável | adicionais e preços versionados |
| estado de mesas, comandas, fichas e fechamentos persistido | fila/integração direta com impressora térmica |
| notinha simples sem valor fiscal | integração fiscal real: credenciais, regras do contador, homologação |
| Divisão por pessoa na tela | registro de pagamento por pessoa, conciliação com a maquininha |
| Minutos fixos nas fichas | tempo real desde o envio, com alerta de atraso |
| `encerrarSemConsumo()` no provedor, com trava em memória | procedure `mesa.encerrarSemConsumo`, transacional e idempotente por `abertura_id`, gravando `EncerramentoSemConsumo` na tabela de auditoria |
| `desfazerEncerramentoSemConsumo()` com instantâneo na aba (10 s) | reversão transacional no servidor, com o registro de auditoria preservado e marcado como desfeito |

Ordem sugerida: persistência e login primeiro (é o que destrava tudo), produção/impressão depois,
fiscal por último — é o item que depende de terceiros.

---

## 7. Testes automatizados

Playwright em Python, com descoberta portátil de Chrome, Chromium ou Edge pelo
`e2e/browser_runtime.py`. O caminho também pode ser informado por `PLAYWRIGHT_BROWSER_PATH`;
se nenhum navegador do sistema for encontrado, a suíte tenta o navegador instalado pelo Playwright.

- `e2e/flow.py` — fluxo ponta a ponta em uma mesa livre: garçom lança, produção prepara, garçom entrega,
  caixa divide e fecha. Inclui duplo clique no envio, bloqueio de rota por perfil, overflow em 390/720/1440 px,
  foco de teclado e console limpo. **63 verificações, 0 falhas.**
- `e2e/roteiro.py` — os 22 passos de teste do prompt mestre sobre a Mesa 08, em sessão única (prova que o
  estado é compartilhado entre rotas), mais as 10 regras de interface obrigatórias e um contexto de 375 px.
  **79 verificações, 0 falhas.**

- `e2e/aceite.py` — as sete correções da V2.1 (C1–C7) e o roteiro de 20 passos, em 390 × 844, 768 × 1024 e
  1440 × 900. **246 verificações, 0 falhas.**
- `e2e/sem-consumo.py` — os 13 testes do encerramento de mesa sem consumo, em 390 × 844 (com toque) e
  1440 × 900. **133 verificações, 0 falhas.**
- `e2e/monetario.ts` e `e2e/sem-consumo.ts` — rodam com `bun`, sem navegador: a aritmética de `ratear()` e a
  regra pura `avaliarSemConsumoDe()`. **63/63** e **28/28.**

Todas gravam JSON (`e2e/resultado*.json`) e capturas (`e2e/shots/`).

Ao testar o diálogo de encerramento sem consumo: `components/ui/sheet.tsx` usa `<dialog>` nativo, que
**permanece no DOM quando fechado** — checar a propriedade `.open`, não a presença do elemento. E ler texto de
`<main>`, não de `body`, porque o toast também fica no DOM e polui a busca.

Dois cuidados ao escrever novas verificações, aprendidos na marra:

- Muito texto da interface é `uppercase` por CSS mas minúsculo no DOM — compare com `casefold()`.
- Os dados demonstrativos repetem produtos entre mesas (a mesa 06 já tem Chopp IPA). Filtre a ficha pela
  **pessoa**, não só pelo produto, ou o teste conta ficha alheia.
