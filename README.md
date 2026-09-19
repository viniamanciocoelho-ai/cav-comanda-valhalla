# CAV Comanda Valhalla

Sistema de comandas para a operação do Valhalla Choperia. Reúne atendimento por mesa e
pessoa, produção de bar e cozinha, caixa, impressão térmica, operação offline do garçom,
relatório diário e backup.

Cada instalação atende uma única organização, definida por
`CAV_ORGANIZACAO_CODIGO`. O sistema não emite documento fiscal ou NFC-e.

## Stack

- Bun 1.3.14
- Vite e React 19
- Hono e oRPC
- Drizzle ORM
- SQLite local ou Turso/libSQL

## Desenvolvimento

```sh
cp .env.example .env
# Preencha o .env com valores locais seguros.
bun install
bun run dev
```

A interface de desenvolvimento usa `http://localhost:4200`.

## Produção

Preencha `.env` a partir de `.env.example` e escolha somente um caminho:

### Docker

```sh
docker compose up -d --build
docker compose ps
```

### VPS direta

Use os exemplos em `deploy/` para `systemd`, nginx e cron. O procedimento completo,
incluindo TLS, banco, saúde e impressoras, está em
[docs/IMPLANTACAO.md](./docs/IMPLANTACAO.md).

## Backup e restauração

O formato, os comandos, a retenção e a restauração segura estão em
[docs/BACKUP-E-RESTAURACAO.md](./docs/BACKUP-E-RESTAURACAO.md). O agendamento diário de
exemplo está em `deploy/cav-backup.cron.example`.

## Validação

```sh
bun run typecheck
bun run build
cd packages/web && bunx drizzle-kit check && cd ../..
for arquivo in e2e/*.ts; do
  [ "$arquivo" = "e2e/test-database.ts" ] || bun --env-file=.env "$arquivo"
done
```
