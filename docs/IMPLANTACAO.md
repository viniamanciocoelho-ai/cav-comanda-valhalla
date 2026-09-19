# Implantação do CAV Comanda Valhalla

Este documento prepara o código para o servidor. Ele não escolhe provedor, domínio, proxy ou
processo de deploy.

## Requisitos

- Bun na versão declarada em `package.json`;
- banco SQLite/Turso acessível pelo servidor;
- acesso de rede às impressoras térmicas, se usadas;
- bucket S3 compatível para os backups;
- somente um `.env`, na raiz do repositório.

## Variáveis da aplicação

```env
NODE_ENV=production
WEBSITE_URL=https://comanda.exemplo.site
PORT=3000

DATABASE_URL=libsql://banco.turso.io
DATABASE_AUTH_TOKEN=token-do-banco

CAV_ORGANIZACAO_CODIGO=valhalla
CAV_BOOTSTRAP_PIN_GERENCIA=8462
CAV_ALLOWED_ORIGINS=https://comanda.exemplo.site
CAV_TIMEZONE=America/Cuiaba
```

- `DATABASE_URL`: obrigatória. Em desenvolvimento pode ser `file:./local.sqlite`.
- `DATABASE_AUTH_TOKEN`: obrigatória quando o banco não usa `file:`.
- `CAV_ORGANIZACAO_CODIGO`: código digitado no login inicial.
- `CAV_BOOTSTRAP_PIN_GERENCIA`: PIN inicial de quatro dígitos, não sequencial e sem default.
- `WEBSITE_URL`: URL pública absoluta e HTTPS em produção.
- `CAV_ALLOWED_ORIGINS`: origens adicionais autorizadas pelo CORS, separadas por vírgula. A
  própria origem da requisição já é aceita.
- `CAV_TIMEZONE`: fuso IANA usado no fechamento diário.
- `PORT`: porta local do processo.

O servidor valida essas variáveis e a conexão com o banco antes de abrir a porta. Uma mensagem
de erro identifica a variável inválida.

## Desenvolvimento e produção

| Item | Desenvolvimento | Produção |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` |
| Banco | arquivo local ou banco isolado | banco remoto com token |
| `WEBSITE_URL` | HTTP local | HTTPS público |
| CORS | localhost é aceito | somente mesma origem e allowlist |
| PIN inicial | secret local sem default | secret do servidor sem default |
| Backup | diretório e bucket de teste | diretório protegido e bucket de produção |

## Instalação e build

Na raiz:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run build
```

## Banco novo

Com o `.env` da raiz configurado:

```sh
cd packages/web
bun run db:migrate
```

Não use `db:push` em produção. As migrações `0000` a `0004` devem aparecer como aplicadas.

## Primeiro acesso

1. Inicie a aplicação com o banco vazio e o PIN de gerência no ambiente.
2. A organização e o usuário `Gerência` são criados no primeiro acesso à API.
3. Abra a URL pública.
4. Informe `CAV_ORGANIZACAO_CODIGO` e `CAV_BOOTSTRAP_PIN_GERENCIA`.
5. Na tela de configuração, crie os PINs individuais de garçom, produção e caixa.
6. Troque o PIN inicial da gerência após confirmar o acesso.

O sistema não possui PIN padrão. Sem a variável correta, o processo não inicia.

## Impressoras

Depois do primeiro login:

1. entre como gerência;
2. abra `Configuração`;
3. configure bar, cozinha e caixa;
4. informe nome, IP ou hostname, porta, largura 58/80 mm e ative;
5. use o botão de teste de cada destino;
6. se a rede falhar, mantenha o fallback do navegador até corrigir a conectividade.

O servidor precisa alcançar as impressoras na porta configurada, normalmente 9100.

## Backup

Configure as variáveis S3 descritas em [BACKUP-E-RESTAURACAO.md](./BACKUP-E-RESTAURACAO.md).
O cron sugerido é:

```cron
10 3 * * * cd /srv/cav-comanda-valhalla/packages/web && /usr/local/bin/bun run backup >> /var/log/cav-backup.log 2>&1
```

Teste a restauração em banco isolado antes de liberar produção.

## Saúde

- `GET /api/health`: processo HTTP vivo.
- `GET /api/health/ready`: aplicação e consulta real ao banco.

Resposta pronta:

```json
{"status":"ok","app":"ok","database":"ok","timestamp":"2026-09-19T00:00:00.000Z"}
```

Quando o banco não responde, `/api/health/ready` devolve HTTP 503 sem expor credenciais nem a
mensagem interna do driver.

## Checklist

- `bun install --frozen-lockfile` concluído;
- typecheck e build verdes;
- migrações aplicadas;
- `/api/health/ready` em HTTP 200;
- login inicial da gerência funcionando;
- PINs individuais criados;
- cardápio e preços conferidos;
- teste das três impressoras concluído;
- abertura, pedido, produção e fechamento de uma mesa de teste concluídos;
- relatório diário fechando com o valor da mesa;
- backup local e S3 criados;
- restauração validada em banco isolado;
- `.env`, banco local, logs e backups fora do Git.
