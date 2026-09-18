# Entrega — V2.1, correção cirúrgica final (pré-apresentação)

Data: 13 de setembro de 2026 · Base: V2 em execução · Checkpoint do código tirado antes da primeira edição.

Nada foi reescrito, nenhuma funcionalidade removida, nenhuma alteração de identidade visual.
**Nenhuma mudança em backend, domínio ou camada fiscal. Nenhuma publicação em produção.**

## 1. As sete correções

| # | Pedido | O que foi feito | Onde |
|---|--------|-----------------|------|
| 1 | Data e hora dinâmicas | `useAgora()`: relógio do dispositivo, `pt-BR`, fuso local, atualização automática a cada minuto, timer limpo no desmonte. `DOMINGO, 13 DE SETEMBRO` / `03:00`. Nenhum valor cravado | `lib/hooks.ts`, `components/app-shell.tsx` |
| 2 | Permissões do modo demo | Proteção centralizada em um único componente derivado da tabela de perfis; a guarda duplicada dentro do shell foi removida. Rota bloqueada → tela inicial do perfil + aviso "Esta área não está disponível para este perfil", sem apagar estado e sem laço | `components/guarda-rota.tsx`, `app.tsx`, `components/app-shell.tsx` |
| 3 | Navegação por perfil | A barra inferior e o menu listam só os destinos autorizados; o garçom não vê mais link para `/caixa`, `/fechamentos`, `/configuracao` | `components/app-shell.tsx` |
| 4 | Divisão sem diferença de centavos | `ratear()` reescrita em aritmética 100% inteira (produto e resto exatos por módulo, zero `Math.floor` sobre float), sinal extraído antes, sobras pelo maior resto com desempate estável por índice. Soma das parcelas sempre igual ao valor original | `lib/rateio.ts` |
| 5 | Proteção contra duplo clique | `useAcaoUnica()` em **Enviar pedido**, **Solicitar fechamento**, **Entreguei na mesa**, **Confirmar fechamento**, avançar/voltar ficha. O "Entreguei" da lista do garçom, que não tinha proteção nenhuma, virou `BotaoEntregar` com estado por linha | `lib/hooks.ts`, `pages/mesa.tsx`, `pages/garcom.tsx`, `pages/producao.tsx`, `components/checkout-sheet.tsx` |
| 6 | Selo "Made with Runable" visível | O selo **não** é escondido por CSS, JS ou sobreposição. Ajustado o espaçamento do nosso layout: `ALTURA_SELO = 64`, `paddingBottom` calculado na barra inferior, `<main>` com `pb-[calc(136px+env(safe-area-inset-bottom))]`, toasts reposicionados. `safe-area-inset-bottom` respeitado | `components/app-shell.tsx`, `components/toast-host.tsx` |
| 7 | Contadores consistentes | Todos os contadores derivam do mesmo estado central do provedor, sem cópia local; atualizam no mesmo instante da ação | `components/comanda-provider.tsx` (consumidores) |

## 2. Arquivos criados

| Arquivo | Papel |
|---------|-------|
| `packages/web/src/web/lib/hooks.ts` | `useAgora()` (correção 1) e `useAcaoUnica()` (correção 5) |
| `packages/web/src/web/components/guarda-rota.tsx` | `GuardaRota` e `AVISO_ROTA_BLOQUEADA` (correção 2) |
| `e2e/monetario.ts` | os 10 casos monetários obrigatórios + invariantes + varredura exaustiva |
| `e2e/aceite.py` | aceite das sete correções (C1–C7) + roteiro de 20 passos, em três resoluções |
| `e2e/diag.py` | diagnóstico de colisão do selo e de bloqueio de rota |

## 3. Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `packages/web/src/web/app.tsx` | `<Switch>` envolvido por `<GuardaRota>` |
| `packages/web/src/web/components/app-shell.tsx` | guarda duplicada removida; barra superior usa `useAgora()`; `ALTURA_SELO = 64`; `paddingBottom` da barra inferior; `pb-[calc(136px+env(safe-area-inset-bottom))]` no `<main>`; navegação filtrada por perfil |
| `packages/web/src/web/components/toast-host.tsx` | `bottom` ajustado para não colidir com o selo (celular e desktop) |
| `packages/web/src/web/lib/rateio.ts` | `ratear()` reescrita em aritmética inteira determinística |
| `packages/web/src/web/pages/mesa.tsx` | `useAcaoUnica` em Enviar pedido, Solicitar fechamento, Entreguei na mesa |
| `packages/web/src/web/pages/garcom.tsx` | `BotaoEntregar` extraído com proteção por linha |
| `packages/web/src/web/pages/producao.tsx` | `useAcaoUnica` em avançar/voltar ficha |
| `packages/web/src/web/components/checkout-sheet.tsx` | `useAcaoUnica` em Confirmar fechamento |
| `README.md`, `MUDANCAS.md`, `TEST_REPORT.md` | documentação da rodada |

## 4. Testes executados

| Verificação | Comando | Resultado |
|-------------|---------|-----------|
| Lint | `bun run lint` | 19 arquivos, **0 erro, 0 aviso** |
| Tipos | `bunx tsc --noEmit -p tsconfig.app.json` | **0 erro** |
| Build | `bun run build:web` | aprovado — CSS 44,70 KB (8,43 gzip), JS 671,10 KB (186,33 gzip) |
| Aceite das 7 correções + 20 passos | `python3 e2e/aceite.py` | **246 verificações, 0 falha**, 3 notas informativas, 0 erro/aviso de console |
| Aritmética monetária | `bun e2e/monetario.ts` | **63/63**, incluindo 18.009 divisões exaustivas e 5.000 sorteios ponderados |
| Roteiro da V2 (regressão) | `python3 e2e/roteiro.py` | **79/79**, 0 falha |
| Fluxo ponta a ponta (regressão) | `python3 e2e/flow.py` | **63/63**, 0 falha |

Resoluções: 390 × 844, 768 × 1024 e 1440 × 900 no aceite (cada uma em sessão única, sem recarregar a página),
mais 360 × 800, 390 × 844 e 430 × 932 na checagem dedicada do selo. Zero colisão com o selo, selo 100%
clicável nas três, nenhuma rolagem horizontal.

Detalhamento por correção e caso monetário: [`TEST_REPORT.md`](./TEST_REPORT.md), seções 8 a 10.

## 5. Limitações remanescentes

1. **Recarregar a página devolve o perfil para Gerência.** Não há autenticação — o perfil ativo vive na
   memória da aba, como todo o resto do estado. A guarda de rota barra corretamente o perfil ativo; o que
   se perde no `F5` é qual perfil estava ativo. Na apresentação, trocar de perfil pelo seletor do topo.
   Sessão persistente é trabalho de servidor, fora do escopo desta demonstração.
2. **Desconto não existe como funcionalidade.** O pedido mandava testá-lo "caso já exista no sistema"; não
   existe. A aritmética de valor negativo já está coberta em `ratear()` para quando o recurso for
   construído. Não aplicável, não é pendência.
3. O pacote JavaScript passa de 500 KB e o Vite avisa. Não afeta a demonstração; se for hospedado, vale
   dividir em chunks.
4. Os minutos das fichas de produção partem de valores fixos dos dados demonstrativos; não são cronômetros
   reais. Data e hora da barra superior, sim, são do dispositivo.

## 6. Fora do escopo desta rodada (não executado, por decisão)

Nada no pedido exigia reestruturação ampla, então nada foi deixado de fora por esse motivo. Permanecem
intocados, como determinado: backend, domínio, camada fiscal e qualquer publicação em produção.
