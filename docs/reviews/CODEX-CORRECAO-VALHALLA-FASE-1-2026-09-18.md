# Revisão e correção técnica — CAV Comanda Valhalla

Data: 18 de setembro de 2026

## Escopo

Foi revisado o pacote `cav-comanda-valhalla-codigo (1).zip` e o prompt de fechamento da
Fase 1. A interface existente foi preservada. Não foram executados hooks desconhecidos,
migrations remotas, deploy ou alteração de produção.

Branch de entrega: `feat/persistencia-notinha-pin-cardapio`

## Problemas encontrados

1. O estado operacional era somente React e era perdido ao recarregar a página.
2. A troca de perfil podia ocorrer no frontend sem sessão, RBAC ou enforcement no backend.
3. Não havia persistência, isolamento por `organizacao_id` nem controle de concorrência.
4. O caixa ainda simulava NFC-e em vez de fornecer uma notinha operacional.
5. O reset de demonstração não estava restrito de forma suficiente ao modo demo.
6. Configuração de mesas, funcionários e cardápio não era persistida.
7. A API foi composta com exports individuais que não atendiam à convenção de rotas do RunKit.
8. A entrega tinha lint direto com quatro ocorrências de `react(set-state-in-effect)`.
9. O cardápio inicial era fictício e uma instalação existente não receberia o cardápio real
   apenas com a atualização do código.

## Correções realizadas

- Adicionado schema Drizzle/libSQL com organização, funcionários, sessões, versão otimista,
  mesas, pessoas, itens, fichas, fechamentos, encerramentos, cardápio e auditoria.
- Adicionado bootstrap idempotente com isolamento por `organizacao_id`.
- Adicionado login por PIN com PBKDF2, sessão bearer, RBAC e validação de tenant.
- Adicionada persistência com controle otimista de concorrência e auditoria.
- Restringido o reset ao `CAV_DEMO_MODE=true`; fora do demo não são criados dados fictícios.
- Adicionada configuração persistida de mesas, largura de recibo, cardápio e funcionários.
- Substituída a simulação de NFC-e por notinha simples na janela de impressão.
- Corrigida a composição da API para exportar `comanda` como feature do roteador.
- Corrigidos os quatro avisos reais do Oxlint com supressões locais e justificadas.
- Importado o cardápio do PDF `valhalla.pdf`: 43 produtos em seis categorias, com preços e
  destinos `bar`/`cozinha`.
- Mantidos os IDs `m1` a `m12` usados pelos fluxos existentes e adicionados IDs estáveis para
  os demais produtos.
- Adicionada sincronização idempotente para instalações já inicializadas: atualiza os produtos
  oficiais e preserva produtos customizados.
- Atualizados roteiros de aceite, documentação e expectativas monetárias para os nomes/preços
  reais.

## Evidências específicas

- `konsistent`: 20 arquivos verificados, nenhuma violação.
- Oxlint direto: nenhuma ocorrência com `--deny-warnings`.
- Drizzle: `drizzle-orm 0.45.2` e `drizzle-kit 0.31.10`; compatibilidade local confirmada e
  `drizzle-kit check` aprovado a partir de `packages/web`.
- Migração local: os SQL `0000_fase1.sql` e `0001_cancelamento-anterior.sql` foram aplicados
  em SQLite temporário e removidos ao final.
- Produção: 14 verificações da API aprovadas com banco temporário limpo.
- Demo: `CAV_DEMO_MODE=true` confirmou 11 itens fictícios e 43 produtos de cardápio.
- Legado: banco temporário com produto antigo foi sincronizado para 43 produtos e o `m1`
  voltou para `CHOOP PIL 500ML` a R$ 15,00.
- O PDF é image-only; os nomes e preços foram conferidos visualmente nas 17 páginas renderizadas.

## Validações

| Comando | Resultado |
|---|---|
| `bun install --frozen-lockfile` | aprovado; nenhuma alteração |
| `bun run typecheck` | aprovado; desktop, mobile e web |
| `bun run build` | aprovado; web e desktop |
| `bunx konsistent check --config-package @runablehq/runkit` | aprovado; sem violações |
| `bunx oxlint . --deny-warnings --no-error-on-unmatched-pattern` | aprovado |
| `bunx drizzle-kit check --config drizzle.config.ts` em `packages/web` | aprovado |
| migração SQL em SQLite temporário | aprovado |
| `bun e2e/fase1-api.ts` | aprovado; 14 verificações |
| `bun e2e/recibo.ts` | aprovado; 6 verificações |
| `bun e2e/monetario.ts` | aprovado; 63/63 |
| `bun e2e/sem-consumo.ts` | aprovado; 28/28 |
| `bun e2e/regressao-fina.ts` | aprovado; 10 verificações |
| `bun test ./packages` | não executou testes; Bun não reconheceu arquivos com padrão de teste |
| `bun run lint` | bloqueado no Windows pelo launcher RunKit: `EFTYPE: inappropriate file type or format, uv_spawn` |
| `git diff --check` | aprovado |
| scan textual de segredos | nenhum segredo real encontrado; apenas tokens/campos de código e senha vazia de script |
| scan de dados pessoais | nenhum dado clínico/paciente real encontrado |
| scan de arquivos maiores que 50 MB | nenhum arquivo rastreado acima do limite |

## Arquivos alterados

Principais arquivos:

- `packages/web/src/api/database/schema.ts`
- `packages/web/src/api/lib/comanda-store.ts`
- `packages/web/src/api/routes/comanda.ts`
- `packages/web/src/api/index.ts`
- `packages/web/src/web/lib/demo-data.ts`
- `packages/web/src/web/lib/types.ts`
- `packages/web/src/web/components/menu-sheet.tsx`
- `packages/web/src/web/components/comanda-provider.tsx`
- `packages/web/src/web/components/sessao-provider.tsx`
- `packages/web/src/web/components/sem-consumo-sheet.tsx`
- `packages/web/src/web/pages/configuracao.tsx`
- `packages/web/src/web/pages/mesa.tsx`
- `packages/mobile/hooks/use-color-scheme.web.ts`
- `e2e/fase1-api.ts`
- `e2e/aceite.py`
- `e2e/flow.py`
- `e2e/roteiro.py`
- `README.md`
- `ARCHITECTURE_HANDOFF.md`

## Riscos e bloqueios restantes

- `bun run lint` permanece bloqueado pelo `uv_spawn` do wrapper RunKit no Windows. Os dois
  estágios internos foram executados diretamente e passaram.
- `bun test ./packages` não é uma validação útil enquanto os testes permanecerem fora dos
  padrões de descoberta do Bun.
- A notinha usa a janela de impressão do navegador; ESC/POS direto depende do modelo e conexão.
- NFC-e, pagamento integrado, estoque, delivery e migrations remotas permanecem fora da Fase 1.
- Os PINs de bootstrap devem ser fornecidos por segredo de ambiente em produção.

## Commits criados

- `d928506` — `feat: adicionar persistencia e operacao da fase 1`
- `8d5f2ce` — `docs: registrar auditoria e limites da fase 1`
- `8f34f25` — `fix: sincronizar cardapio real e lint do CRM`

## Decisões pendentes

- Definir impressora e fluxo operacional de impressão.
- Definir homologação fiscal e credenciais para fase posterior.
- Definir política de troca, revogação e recuperação de PIN.
- Decidir se o CI Linux substituirá a execução local do wrapper RunKit no Windows.

## Recomendação

**Aprovado para avaliação no Runable em ambiente de teste.** O código não deve ser tratado como
pronto para produção fiscal até que impressora, PINs de produção e integrações fiscais sejam
homologados.

O branch está pronto para publicação. A `main` não foi alterada, não houve merge, deploy ou
migration remota.
