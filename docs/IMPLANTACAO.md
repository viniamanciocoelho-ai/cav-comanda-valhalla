# Implantação do CAV Comanda Valhalla

Este guia cobre duas alternativas de produção. Escolha Docker ou instalação direta na VPS;
não execute os dois caminhos ao mesmo tempo.

## Requisitos comuns

- Bun na versão declarada em `package.json`;
- domínio apontado para a VPS;
- banco SQLite local ou Turso/libSQL acessível;
- rede entre o servidor e as impressoras térmicas;
- bucket S3 compatível para backup;
- somente um `.env`, na raiz do repositório.

Copie `.env.example` para `.env` e substitua todos os valores fictícios. O
`.env.example` é a fonte única das variáveis, obrigatoriedade, padrões e mensagens de erro.
Nunca versione o `.env`.

## Preparação do banco

O comando abaixo valida o ambiente, aplica somente migrations pendentes e confirma uma
consulta real ao banco:

```sh
bun run deploy:setup
```

Ele é idempotente e pode ser executado novamente a cada atualização. Em sucesso, informa
quantas migrations foram aplicadas e termina com código `0`. Em falha, interrompe na etapa
afetada, não inicia a aplicação e indica a configuração que precisa ser corrigida.

## Caminhos de deploy

| Docker | VPS direta |
| --- | --- |
| Usa `Dockerfile` e `docker-compose.yml`. | Usa Bun no host, `systemd` e nginx. |
| Persiste banco local e backups em volumes nomeados. | Persiste nos caminhos definidos no `.env`. |
| O contêiner executa `deploy:setup` antes do servidor. | O unit `systemd` executa `deploy:setup` antes do servidor. |
| Atualização: reconstruir e recriar o serviço. | Atualização: instalar, buildar e reiniciar o serviço. |

### Caminho A: Docker

Na raiz do repositório:

```sh
cp .env.example .env
# Edite o .env.
docker compose up -d --build
docker compose ps
```

Quando `DATABASE_URL` usar `file:./.data/...`, o banco fica no volume `cav_database`. Os
backups ficam no volume `cav_backups`. O health check do contêiner consulta
`GET /api/health/ready`.

Para atualizar:

```sh
git pull
docker compose up -d --build
```

### Caminho B: VPS direta

Instale a versão de Bun declarada pelo projeto e, na raiz:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run build:web
bun run deploy:setup
```

Crie o usuário dedicado `cav-comanda`, ajuste os placeholders e instale o unit:

```sh
sudo cp deploy/cav-comanda.service.example /etc/systemd/system/cav-comanda.service
sudo systemctl daemon-reload
sudo systemctl enable --now cav-comanda
sudo systemctl status cav-comanda
```

O exemplo usa `Restart=always`, lê o `.env` e roda sem privilégios de root. O
`ecosystem.config.cjs` permanece disponível para instalações que já usam PM2 e também lê o
`.env` da raiz.

Para o proxy:

```sh
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/cav-comanda
sudo ln -s /etc/nginx/sites-available/cav-comanda /etc/nginx/sites-enabled/cav-comanda
sudo nginx -t
sudo systemctl reload nginx
```

Substitua o domínio e mantenha a porta do `proxy_pass` igual ao `PORT` do `.env`. Depois,
execute o certbot para o domínio e confirme o redirecionamento HTTPS.

## Primeiro acesso

1. Abra a URL pública.
2. Entre com `CAV_ORGANIZACAO_CODIGO` e o PIN inicial de gerência.
3. Troque o PIN inicial.
4. Cadastre os PINs individuais de garçom, produção e caixa.
5. Confira mesas, cardápio e preços.

Não existe PIN padrão. Os PINs de garçom, produção e caixa não vêm do ambiente.

## Impressoras

Na tela `Configuração`, cadastre bar, cozinha e caixa com IP ou hostname, porta e largura
58/80 mm. O servidor precisa alcançar os três destinos pela rede. Faça o teste físico em cada
impressora antes da abertura da operação.

## Backup

Instale o agendamento de `deploy/cav-backup.cron.example`, monitore o código de saída e o log,
e siga [BACKUP-E-RESTAURACAO.md](./BACKUP-E-RESTAURACAO.md). Uma cópia local não transforma
falha no S3 em sucesso: o comando termina com erro e preserva o caminho do arquivo criado.

## Saúde

- `GET /api/health`: processo HTTP vivo.
- `GET /api/health/ready`: aplicação e consulta real ao banco.

O endpoint de readiness retorna HTTP `200` quando o banco responde e `503` quando está
indisponível, sem expor credenciais.

## Checklist final de go-live

- [ ] Domínio apontado para a VPS.
- [ ] TLS ativo, válido e com redirecionamento HTTPS.
- [ ] `.env` preenchido a partir de `.env.example` e fora do Git.
- [ ] `bun run deploy:setup` executado com sucesso.
- [ ] `GET /api/health/ready` respondendo HTTP `200`.
- [ ] Login da gerência e os quatro perfis verificados.
- [ ] Cardápio, preços, mesas e fuso horário conferidos.
- [ ] **OBRIGATÓRIO ANTES DE OPERAR: cron de backup instalado, execução confirmada e restauração real testada em banco isolado.**
- [ ] **OBRIGATÓRIO ANTES DE OPERAR: IP ou hostname das impressoras de bar, cozinha e caixa preenchidos na configuração.**
- [ ] **OBRIGATÓRIO ANTES DE OPERAR: impressão física testada com sucesso nos três destinos.**
- [ ] Fluxo completo de abertura, pedido, produção, caixa e fechamento validado.
- [ ] Relatório diário conferido contra um fechamento de teste.
