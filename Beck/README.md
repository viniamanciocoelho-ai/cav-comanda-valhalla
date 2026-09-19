# Beck

Entrada de referência para o backend do CAV Comanda Valhalla.

O código canônico continua em `packages/web/src/api` porque o servidor, o Vite e
o Runable dependem desses caminhos. Esta pasta organiza a responsabilidade sem
duplicar arquivos nem quebrar imports.

## Mapa

- `packages/web/src/__server.ts`: servidor Bun/Hono e entrega do frontend.
- `packages/web/src/api/index.ts`: composição da API e procedimentos oRPC.
- `packages/web/src/api/routes/`: contratos HTTP e regras de autorização.
- `packages/web/src/api/lib/`: persistência, validação e regras operacionais.
- `packages/web/src/api/database/schema.ts`: schema Drizzle.
- `packages/web/drizzle/`: migrations locais versionadas.
- `e2e/`: regressões de API, segurança, rateio e isolamento entre organizações.

## Invariantes

- Toda leitura e escrita persistida deve ser limitada por `organizacao_id`.
- O tenant e o perfil autorizado vêm da sessão; valores enviados pelo cliente
  não substituem a identidade autenticada.
- Valores monetários são processados em centavos inteiros.
- Operações críticas usam transação, idempotência ou controle de versão conforme
  o contrato existente.
- Migrations remotas e operações de produção não fazem parte do fluxo local.

## Validação

Na raiz do repositório:

```bash
bun run typecheck
bun e2e/security-regressao.ts
bun e2e/tenant-isolation.ts
bun e2e/fase1-api.ts
bun e2e/monetario.ts
```
