# Revisão e correção técnica — CAV Comanda Valhalla

Data: 18 de setembro de 2026

## Escopo

Foi revisado o conteúdo do pacote `cav-comanda-valhalla-codigo (1).zip`, mantendo a interface
existente e sem executar hooks desconhecidos. O repositório extraído não continha histórico Git
utilizável; por isso, não há commit recebido do fornecedor para comparar.

Branch local criada: `feat/persistencia-notinha-pin-cardapio`

## Problemas encontrados e evidências

1. O estado operacional vivia apenas no provedor React. Recarregar a página perdia comandas,
   fichas e fechamentos.
2. O perfil podia ser trocado livremente no frontend, sem autenticação ou sessão.
3. O backend inexistente deixava autorização e isolamento por `organizacao_id` sem enforcement.
4. O fluxo do caixa ainda oferecia simulação de NFC-e em vez de um recibo simples.
5. O reset da demonstração podia gravar dados fictícios caso fosse reutilizado fora do modo demo.
6. A quantidade de mesas e o cardápio eram estáticos.
7. A documentação afirmava que não havia backend, banco ou autenticação depois que esses recursos
   foram implementados.

## Correções realizadas

- Adicionado schema Drizzle/libSQL com organização, funcionários, sessões, versão otimista,
  mesas, pessoas, itens, fichas, fechamentos, encerramentos, cardápio e auditoria.
- Adicionado bootstrap idempotente do banco, sem migration remota ou `db:push`.
- Adicionado login por PIN com PBKDF2, bearer session, RBAC e validação de `organizacao_id`.
- Adicionada persistência do estado com controle otimista de concorrência e auditoria.
- Adicionado modo demo explícito; fora dele o bootstrap não cria pessoas, itens ou fichas fictícias.
- Bloqueado o reset de demonstração no backend e na interface quando `CAV_DEMO_MODE=false`.
- Adicionada configuração persistida de 15 mesas, largura 58/80 mm, cardápio e funcionários.
- Substituída a simulação de NFC-e por notinha simples na janela de impressão do sistema.
- Corrigido o roteiro para acompanhar a impressão da notinha.
- Atualizados README, handoff de arquitetura e lista de itens provisórios.
- Adicionados testes de API, concorrência, PIN, RBAC, modo demo e recibo.

## Validações

| Comando | Resultado |
|---|---|
| `bun install --frozen-lockfile` | aprovado; dependências já instaladas sem alterar lock |
| `bun run typecheck` | aprovado; desktop, mobile e web |
| `bun run build` | aprovado; web e desktop |
| `bun e2e/fase1-api.ts` | aprovado; 14 verificações |
| `bun e2e/recibo.ts` | aprovado; 6 verificações |
| `bun e2e/monetario.ts` | aprovado; 63/63 |
| `bun e2e/sem-consumo.ts` | aprovado; 28/28 |
| `bun e2e/regressao-fina.ts` | aprovado; 10 verificações |
| `bun test ./packages` | sem arquivos reconhecidos pelo filtro do Bun |
| `bun run lint` | bloqueado pelo `runkit` no Windows: `EFTYPE: inappropriate file type or format, uv_spawn` |
| `bunx drizzle-kit check --config packages/web/drizzle.config.ts` | bloqueado pela mensagem da ferramenta para instalar versão mais recente de `drizzle-orm`; versão instalada confirmada: `drizzle-orm 0.45.2`, `drizzle-kit 0.31.10` |
| `git diff --check` | executado sem erro de whitespace após inicialização Git |

Também foram feitos scan textual de segredos, scan de arquivos grandes e revisão dos arquivos
incluídos no pacote. `.env`, bancos locais, `node_modules`, builds, caches e temporários ficam fora
do artefato final.

## Arquivos principais alterados

- `packages/web/src/api/database/schema.ts`
- `packages/web/src/api/database/bootstrap.ts`
- `packages/web/src/api/lib/security.ts`
- `packages/web/src/api/lib/comanda-store.ts`
- `packages/web/src/api/routes/comanda.ts`
- `packages/web/src/api/index.ts`
- `packages/web/src/web/components/sessao-provider.tsx`
- `packages/web/src/web/components/login.tsx`
- `packages/web/src/web/components/comanda-provider.tsx`
- `packages/web/src/web/components/app-shell.tsx`
- `packages/web/src/web/components/checkout-sheet.tsx`
- `packages/web/src/web/pages/configuracao.tsx`
- `packages/web/src/web/lib/recibo.ts`
- `e2e/fase1-api.ts`
- `e2e/recibo.ts`

## Riscos e bloqueios restantes

- O lint oficial continua bloqueado por incompatibilidade do `runkit`/`uv_spawn` no Windows.
- A checagem Drizzle não conclui pelo aviso da ferramenta, embora o typecheck e o runtime do
  adapter estejam verdes com as versões instaladas.
- A impressão usa a janela de impressão do navegador; integração ESC/POS direta depende do modelo
  e da conexão da impressora.
- NFC-e, pagamento integrado, estoque, delivery e migrações remotas permanecem fora da fase.
- A validade operacional dos PINs de bootstrap depende de configuração segura no ambiente.

## Decisões pendentes

- Definir impressora, conexão e fluxo de impressão local.
- Definir credenciais e homologação fiscal para uma fase posterior.
- Definir política operacional de troca, revogação e recuperação de PIN.

## Entrega

Commit local: `d928506` (`feat: adicionar persistencia e operacao da fase 1`).

Não houve push, merge, deploy, alteração de produção ou migration remota.

Recomendação: **aprovado para avaliação no Runable em ambiente de teste**, condicionado à
configuração dos quatro PINs, validação da impressora e resolução dos dois bloqueios de ferramenta
descritos acima. Não declarar pronto para produção fiscal.
