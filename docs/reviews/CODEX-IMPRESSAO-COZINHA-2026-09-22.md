# Revisão técnica: balcão e impressão automática da cozinha

## Identificação

- Projeto: `cav-comanda-valhalla`
- Branch: `feat/persistencia-notinha-pin-cardapio`
- Commit funcional: `16cb425`
- Commit anterior da branch: `55572bd`
- Base preservada: `main` não foi alterada e não houve merge.
- Branch publicada: <https://github.com/viniamanciocoelho-ai/cav-comanda-valhalla/tree/feat/persistencia-notinha-pin-cardapio>

## Escopo executado

Foi concluída a integração do fluxo de atendimento no balcão e da impressão automática da cozinha, mantendo a impressão manual da comanda e o isolamento por `organizacao_id`.

### Balcão

- Criada a tela de operação `/balcao/:id`.
- Criados quatro balcões persistidos no banco.
- Implementados abertura, inclusão de itens, transferência para mesa, fechamento e reuso do balcão.
- Permissões mantidas por perfil: atendimento para garçom/gerência e transferência controlada pela gerência.
- O `funcionario_id` continua registrado para auditoria de cada item/pedido.
- O estado ativo passou a usar `atendimento_id`, permitindo compartilhamento correto entre dispositivos da mesma organização.

### Impressão automática da cozinha

- Criada a tela `/cozinha`.
- A fila de fichas é consultada em polling curto e processada sequencialmente.
- A reserva local é atômica e recupera reservas antigas após timeout.
- A conclusão da impressão é idempotente e registra `impresso_em`.
- O fluxo usa RawBT como ponte para impressoras ESC/POS quando não existe característica BLE gravável.
- Foi preservado o fallback visível `Imprimir agora`.
- A tela mantém o dispositivo acordado durante o atendimento e exibe falhas sem bloquear a operação.
- O recibo financeiro continua separado das fichas da cozinha e não exibe valores na tela da cozinha.

### Persistência e operação

- Criada a migration `0005_atendimento_balcao.sql`.
- Atualizados schema, bootstrap, índices e snapshot do Drizzle.
- Backup/restauração passou a transportar balcões, `atendimento_id`, `balcao_id` e `impresso_em`.
- Backups legados v1 são normalizados sem perder o vínculo histórico.
- A limpeza operacional agora remove filas e vínculos de balcão dentro do tenant correto.

## Problema encontrado e correção

### Vazamento entre atendimentos de balcão

Problema reproduzido antes da correção: ao fechar um balcão, `enfileirarImpressoesTx()` filtrava pessoas e itens somente por `mesa_id`. Como dois atendimentos de balcão possuem `mesa_id = null`, o recibo do primeiro balcão podia incluir o cliente e os itens do segundo balcão.

Correção aplicada em `packages/web/src/api/lib/impressao.ts`:

- pessoas e itens do recibo passaram a ser filtrados por `atendimento_id`;
- a organização continua sendo aplicada no escopo das consultas;
- foi criado `e2e/impressao-balcao.ts`, que abre dois atendimentos simultâneos e garante que o recibo de um não contenha dados do outro.

O problema foi registrado no Codex Security como achado médio no snapshot anterior e está marcado como corrigido na árvore atual.

## Arquivos alterados

### Backend, banco e operação

- `packages/web/drizzle/0005_atendimento_balcao.sql`
- `packages/web/drizzle/meta/0005_snapshot.json`
- `packages/web/drizzle/meta/_journal.json`
- `packages/web/scripts/backup-core.ts`
- `packages/web/scripts/limpar-operacao.ts`
- `packages/web/src/api/database/bootstrap.ts`
- `packages/web/src/api/database/schema.ts`
- `packages/web/src/api/lib/comanda-schema.ts`
- `packages/web/src/api/lib/comanda-store.ts`
- `packages/web/src/api/lib/impressao.ts`
- `packages/web/src/api/lib/mesa-inicial.ts`
- `packages/web/src/api/lib/relatorio-diario.ts`
- `packages/web/src/api/routes/comanda.ts`
- `packages/web/src/api/routes/impressao.ts`

### Frontend

- `packages/web/src/web/app.tsx`
- `packages/web/src/web/components/checkout-sheet.tsx`
- `packages/web/src/web/components/comanda-provider.tsx`
- `packages/web/src/web/components/menu-sheet.tsx`
- `packages/web/src/web/lib/format.ts`
- `packages/web/src/web/lib/offline.ts`
- `packages/web/src/web/lib/operacao.ts`
- `packages/web/src/web/lib/perfis.ts`
- `packages/web/src/web/lib/recibo.ts`
- `packages/web/src/web/lib/types.ts`
- `packages/web/src/web/pages/balcao.tsx`
- `packages/web/src/web/pages/caixa.tsx`
- `packages/web/src/web/pages/cozinha.tsx`
- `packages/web/src/web/pages/fechamentos.tsx`
- `packages/web/src/web/pages/garcom.tsx`
- `packages/web/src/web/pages/index.tsx`
- `packages/web/src/web/pages/producao.tsx`
- `packages/web/src/web/pages/relatorio-diario.tsx`

### Testes

- `e2e/backup.ts`
- `e2e/balcao.ts`
- `e2e/fase1-api.ts`
- `e2e/historico-persistencia.ts`
- `e2e/impressao-balcao.ts`
- `e2e/impressao.ts`
- `e2e/limpeza-operacional.ts`
- `e2e/mesas-compartilhadas.ts`
- `e2e/migracao-legado.ts`
- `e2e/offline.ts`
- `e2e/relatorio-diario.ts`
- `e2e/security-regressao.ts`
- `e2e/tenant-isolation.ts`

## Validações

Passaram:

- `bun run typecheck`
- `bun run build`
- `bunx oxlint packages/web/src packages/web/scripts e2e --deny-warnings`
- `drizzle-kit check --config drizzle.config.ts`
- 25 scripts E2E, incluindo balcão, fila, impressão, migração, isolamento, RBAC, saúde e rateio monetário
- `bun run test:e2e:production`
- 5 testes Playwright no bundle de produção:
  - login por PIN e saída sem erro no console;
  - conexão BLE, envio em blocos e reconexão;
  - fallback RawBT sem característica gravável;
  - impressão via iframe sem popup;
  - configuração compatível com Chrome móvel.
- `git diff --check`
- scan de segredos
- scan de arquivos acima de 50 MB
- scan de artefatos proibidos versionados

Resultados relevantes:

- Rateio: 64 verificações, 18.009 divisões exaustivas e 5.000 sorteios ponderados sem centavo perdido.
- Segurança: 16 cenários de autorização e integridade aprovados.
- Isolamento: cenários multi-tenant aprovados.
- Migração legada: registros históricos preservam o vínculo de atendimento.
- Não foram encontrados segredos de alta confiança, bancos locais, builds, caches ou logs versionados.

## Limitações registradas

- `bun test ./packages` não encontrou arquivos no padrão nativo do Bun; o projeto executa a suíte existente como scripts `e2e/*.ts`.
- `bun run lint` falhou antes de iniciar o linter por `EFTYPE: inappropriate file type or format, uv_spawn` no wrapper `runkit`. O Oxlint direto passou sem warnings.
- O daemon Docker não estava disponível neste ambiente; não foi possível executar `docker build`/`docker run`.
- A instalação do CodeRabbit CLI não foi possível porque o host do instalador não respondeu DNS.
- Não foi possível validar fisicamente Android Chrome + RawBT + impressora Bluetooth/KPrinter nesta máquina Windows. A validação física deve ser feita no celular e na impressora de produção.
- Nenhuma migration remota, deploy ou alteração de produção foi executada.

## Commits

1. `16cb425 feat: concluir balcao e impressao automatica da cozinha`
2. Este relatório integra o commit documental desta revisão.

## Decisão

O código está pronto para seguir para a revisão final e para o pipeline de deploy controlado da branch. A integração de código, contratos, banco local, fila, RBAC, isolamento, bundle de produção e regressões está validada. A única pendência operacional é a aceitação física do conjunto Android Chrome + RawBT + impressora térmica e a confirmação do build Docker no ambiente que possui o daemon do Render/CI.
