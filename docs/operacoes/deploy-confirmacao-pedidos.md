# Entrega da confirmacao de pedidos ao Quintino

Esta entrega corrige o destinatario compartilhado de mesa, a comparacao de
mesas reordenadas na persistencia, conflitos de versao e respostas HTTP
perdidas. Uma escrita sem resposta nao e reenviada automaticamente. Veja
`docs/reviews/CODEX-CONFIRMACAO-PEDIDOS-2026-09-23.md`,
`e2e/confirmacao-pedidos.ts` e `e2e/login-producao.spec.cjs`.

## Revisao e verificacao local

- Trabalhe na raiz de um checkout **limpo**, na branch
  `fix/confirmacao-pedidos`, com Bun `1.3.14` e Git. O checkout de verificacao
  nao pode conter `.env` real, nem receber `DATABASE_URL` ou
  `DATABASE_AUTH_TOKEN` do shell. Nunca mova credenciais para o checkout de
  verificacao. Instale um navegador Playwright ou configure
  `PLAYWRIGHT_BROWSER_PATH` para Chrome/Edge local.
- Instale e execute, na raiz:

```sh
bun install --frozen-lockfile
bun run verify:confirmacao-pedidos
git diff --check
```

O gate exige Bun `1.3.14`, usa SQLite temporario sob `.tmp`, limpa o ambiente
dos subprocessos, recusa `.env` e conexao remota herdada, roda typecheck,
build, lint e regressao de API e navegador no bundle de producao. Falha em
qualquer etapa obrigatoria interrompe o comando. No Windows, executa as
mesmas ferramentas fixadas do `runkit` diretamente porque o invólucro
`bun run lint` falha com `EFTYPE`; nao silencia regras. Nao executa
`deploy:setup`, migrations, limpeza ou deploy.

Uma comanda pode ser aberta, receber itens compartilhados e ser fechada sem
nome. Sem cadastro de pessoa, a divisao tem uma linha "Consumo sem identificação"
com o total integral. Para ratear entre varias pessoas, inclua participantes;
o campo de nome pode ficar vazio, gerando "Cliente 1", "Cliente 2" etc. O
teste cobre envio, resposta perdida, fechamento sem pessoa, pessoas com nome
e mistura de nomeados e anonimos. Nao foi introduzida migration estrutural
nem variavel nova.

## Publicacao controlada

O deploy no Render usa **uma** imagem Docker da raiz para backend Hono/oRPC e
frontend Vite; publique **ambos do mesmo commit**, nunca somente o frontend.
Antes de selecionar/publicar a branch, confirme no painel do servico se a
configuracao de autodeploy a executaria imediatamente. Quintino escolhe a
janela e o fluxo autorizados. Nao faca merge nesta entrega.

1. Revise os commits desde `8439fc9`, inclusive `692a089` (rotina de limpeza
   administrativa **manual**), execute o gate e confirme o HEAD a publicar.
2. Confirme no servico a branch e o SHA do commit em build/deploy; publique a
   unica imagem Docker desse SHA, aguarde a preparacao normal de deploy e
   verifique `/api/health/ready` e logs sem segredos. O entrypoint existente
   executa `deploy-setup.ts`, que aplica migrations **pendentes existentes**
   antes de iniciar o servidor. Esta entrega nao adiciona migration. Verifique
   o conjunto pendente antes de autorizar o deploy; nao execute migrations
   remotas como parte da revisao local.
3. Compare o SHA exibido no Render com `git rev-parse HEAD` no checkout
   aprovado. Nao assuma que uma mensagem de build atesta o commit efetivamente
   em execucao; confirme a revisao ativa no painel e nos logs de deploy.

Mantenha as variaveis de producao **no painel privado do servico**, sem valores
em comandos/documentos: `NODE_ENV=production`, `WEBSITE_URL`, `DATABASE_URL`
e, para Turso, `DATABASE_AUTH_TOKEN`, `CAV_ORGANIZACAO_CODIGO` e
`CAV_BOOTSTRAP_PIN_GERENCIA`. `PORT` vem do servico; confira-o. Opcionais
existentes: `CAV_ALLOWED_ORIGINS`, `CAV_TIMEZONE`, `CAV_LIMITE_BANCO_MB` e
configuracao de backup em `.env.example`. Nao mude credenciais ou parametros
para esta correcao. **Esta publicacao nao deve executar a limpeza do salao**:
nao execute `limpar:operacao` nem `packages/web/scripts/limpar-operacao.ts`.

## Validacao operacional

No Chrome Android, em tenant autorizado e dados de teste controlados: entre
com PIN; abra mesa sem nome; adicione item compartilhado; confira
`Sincronizado`, recarregue e leia em outra sessao; envie a producao e confirme
uma unica ficha/fila; solicite a conta sem pessoa e confira no caixa a divisao
"Consumo sem identificação" e o recibo com itens e total. Em outro atendimento
de teste, inclua participantes nomeados e anonimos e confira o rateio e o
fechamento em ambiente de validacao.
Nao crie consumo ou pagamento ficticio no banco do cliente. Verifique tambem
o comportamento de erro de rede sem tocar novamente na operacao incerta.

Se o aviso reaparecer, anote horario e fuso, acao, `operacaoId`, status,
duracao e codigo sanitizado de `/api/rpc/comanda/persistir`; correlacione com
logs `comanda.persistir` e verifique o item no tenant/atendimento corretos por
acesso autorizado. Nao compartilhe payload, PIN, cookie, token, nome ou dados
de clientes. A captura original nao tem logs HTTP suficientes para provar a
causa especifica da ocorrencia em producao.

Para reverter, selecione a imagem/commit anterior no Render **apos** apurar as
operacoes incertas; o codigo anterior pode nao interpretar da mesma forma o
estado local pendente no navegador. Como esta entrega nao traz migration, nao
ha rollback de schema dela, mas o entrypoint pode aplicar migrations
preexistentes se houver pendencias. Reverter codigo **nao restaura dados** nem
resolve automaticamente uma gravacao incerta. Nao use force push.

## Transferencia sem publicar

O arquivo `../../.tmp/entrega-quintino/confirmacao-pedidos.bundle`, contado a
partir desta pasta `docs/operacoes`, contem a branch local a partir do requisito
`8439fc9` (`feat/persistencia-notinha-pin-cardapio`), inclusive a dependencia
`692a089`. Quintino precisa receber o arquivo por canal privado **somente se**
nao estiver usando este mesmo checkout. O bundle nao e upload nem push.

Na maquina de Quintino, na raiz do repositorio que ja contem `8439fc9`:

```sh
git status --short --branch
git cat-file -t 8439fc9
git bundle verify /CAMINHO/PRIVADO/confirmacao-pedidos.bundle
git fetch /CAMINHO/PRIVADO/confirmacao-pedidos.bundle refs/heads/fix/confirmacao-pedidos:refs/remotes/transfer/fix/confirmacao-pedidos
git log --oneline 8439fc9..refs/remotes/transfer/fix/confirmacao-pedidos
git diff --stat 8439fc9..refs/remotes/transfer/fix/confirmacao-pedidos
git switch -c fix/confirmacao-pedidos refs/remotes/transfer/fix/confirmacao-pedidos
```

Substitua `/CAMINHO/PRIVADO/confirmacao-pedidos.bundle`. `git switch -c`
falha sem sobrescrever caso a branch ja exista; antes de escolher outra branch
ou integrar alteracoes locais, compare-as e preserve-as. Nada nessa sequencia
publica. No mesmo checkout local da entrega, nao importe bundle: basta
`git status`, `git log` e o gate. Quintino publica pelo fluxo autorizado apos
revisar a branch, o autodeploy e a validacao no ambiente dele.
