# Fase 5 - Preparação para produção

Data: 2026-09-19

## Realizado

- Validação fail-fast antes de importar a API ou abrir a porta.
- Verificação de `DATABASE_URL`, token de banco remoto, código da organização, PIN inicial,
  URL pública, origens CORS, fuso e porta.
- Conexão e bootstrap do banco confirmados antes de iniciar o servidor.
- PM2 e script do pacote redirecionados para o wrapper validado.
- Arquivo protegido `packages/web/src/__server.ts` preservado sem alteração.
- Endpoint `GET /api/health/ready` com consulta real `SELECT 1`.
- HTTP 503 quando o banco não responde, sem mensagem interna ou credencial no corpo.
- `.env.template` atualizado sem valores secretos.
- Documentação completa em `docs/IMPLANTACAO.md`.

## Ambientes

- Desenvolvimento aceita banco `file:` e URL pública opcional.
- Produção exige `WEBSITE_URL` absoluta em HTTPS.
- Banco remoto exige `DATABASE_AUTH_TOKEN`.
- CORS de produção aceita a própria origem e somente a allowlist configurada.
- Backup possui suas próprias variáveis S3 e continua documentado separadamente.

## Evidências e testes

- `e2e/producao.ts`
  - ausência de `DATABASE_URL` falha;
  - banco remoto sem token falha;
  - ausência de código da organização falha;
  - PIN fraco ou ausente falha;
  - produção sem URL pública falha;
  - HTTP público em produção falha;
  - fuso inválido falha;
  - configuração de desenvolvimento com banco local passa;
  - saúde simulada retorna 200 com banco disponível;
  - saúde simulada retorna 503 sem vazar a mensagem do driver;
  - endpoint real responde 200 no SQLite temporário.
- `bun run typecheck`: aprovado nos pacotes web, desktop e mobile.
- `bun run build`: aprovado para web e desktop.
- `cd packages/web && bunx drizzle-kit check`: aprovado.
- Todos os arquivos `e2e/*.ts`: aprovados.
- `bunx oxlint . --deny-warnings --no-error-on-unmatched-pattern`: aprovado.
- `bunx konsistent check --config-package @runablehq/runkit`: aprovado, com avisos de depreciação da configuração externa.
- `git diff --check`: aprovado.

## Scans finais

- Padrões de chaves privadas, tokens GitHub/OpenAI/AWS e secrets preenchidos: nenhum.
- Padrões de CPF, e-mail e telefone: somente falsos positivos em hashes, UUIDs e metadados.
- Arquivos maiores que 50 MB fora de dependências/builds: nenhum.
- `.env` reais: ignorados pelo Git.
- Arquivos protegidos e `__ports.cjs`: idênticos ao commit-base da execução.

## Fora do escopo

- Deploy e provisionamento.
- Dockerfile.
- CI/CD.
- Escolha de provedor, proxy, domínio ou certificado.

## Perguntas pendentes

- Nenhuma para a Fase 5.
