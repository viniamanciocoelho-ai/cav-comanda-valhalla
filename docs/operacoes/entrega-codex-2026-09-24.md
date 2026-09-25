# Entrega tecnica para o Quintino

## Candidato

- Branch: `feat/persistencia-notinha-pin-cardapio`
- Base validada: `ef718342411a65224f08023b7e17edef944f9516`
- Teste isolado: `359192f600153ad88a22bc4f9caf1117705d1884`
- Commit das correcoes publicadas: `ec30483cade23f1d20bf4a940db1aa7a97ce5118`.
- Branch no GitHub: `https://github.com/viniamanciocoelho-ai/cav-comanda-valhalla/tree/feat/persistencia-notinha-pin-cardapio`.
- Servico afetado: imagem Docker raiz contendo frontend Vite e backend
  Hono/oRPC em `packages/web`.
- Main: nao alterada.
- Migrations novas: nenhuma nesta entrega.

## O que foi validado

A correcao trata persistencia concorrente de pedidos, ordenacao variavel das
colecoes, respostas perdidas, itens compartilhados sem nome, fechamento com
nomes opcionais, RBAC, tenant, fila de impressao e o bundle final. O resultado
completo esta em `docs/reviews/CODEX-REVISAO-AMPLIADA-2026-09-24.md`.

O commit `ec30483` corrige tambem a reabertura de mesas que mantem pessoas,
itens e fichas historicas de atendimentos encerrados. O backend preserva esses
registros sem aceitar novos vinculos invalidos; o frontend exibe apenas o
atendimento ativo, usa o funcionario atual ao abrir a mesa e sinaliza uma
gravacao recusada em vez de exibir sucesso ou sincronizacao falsa.

## Validacao local

No checkout limpo, sem `.env` real e com banco SQLite temporario:

```sh
bun install --frozen-lockfile
bun run verify:confirmacao-pedidos
bun x turbo run typecheck build --force
git diff --check
```

No Windows, inicie o gate pelo executavel Bun 1.3.14 efetivo quando o comando
`bun` global apontar para outra versao. O gate interrompe a execucao em caso
de versao diferente; nao desative essa verificacao.

No Windows, o gate usa os executaveis fixados de Konsistent e Oxlint porque o
wrapper `bun run lint` pode falhar com `EFTYPE/uv_spawn`. Isso nao substitui o
lint: o Oxlint fixado passou com 0 warnings e 0 errors.
O gate executou 14 testes Playwright contra o bundle de producao, incluindo
mesa reutilizada com historico, gravacao de item apos reload e recusa HTTP 400.

## Ordem controlada de publicacao

1. Confirmar que o servico esta apontando para a branch e SHA candidatos.
2. Confirmar que as variaveis privadas continuam no painel do servico; nao
   colocar valores em commit, comando, ticket ou chat.
3. Confirmar que o banco de homologacao/cliente e as integracoes estao no alvo
   correto antes de iniciar qualquer deploy.
4. Publicar uma unica imagem Docker desse SHA.
5. Conferir logs de inicializacao sem copiar segredos.
6. Conferir `/api/health/ready` e depois o fluxo de login em Chrome Android.
7. Conferir o SHA exibido no deploy e o nome/hash do asset servido pelo HTML.

O entrypoint executa a validacao de ambiente, aplica somente migrations
pendentes existentes e verifica o banco antes de iniciar. Esta branch nao
adiciona migration; ainda assim, confirme o conjunto pendente no ambiente antes
de publicar.

## Variaveis

Nao ha variavel nova obrigatoria. Permanecem as configuracoes existentes:
`NODE_ENV`, `WEBSITE_URL`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`,
`CAV_ORGANIZACAO_CODIGO`, `CAV_BOOTSTRAP_PIN_GERENCIA`, `PORT`,
`CAV_ALLOWED_ORIGINS`, `CAV_TIMEZONE` e os parametros opcionais de limite/backup.

## Compatibilidade e rollback

Nao ha alteracao estrutural de banco nesta entrega. Reverter o codigo nao
restaura dados e nao resolve uma operacao com resposta incerta. Antes de rollback,
verificar operacoes pendentes no navegador e o estado autorizado da comanda.
Selecionar a imagem anterior no Render somente depois de registrar o SHA e
confirmar que nao ha migration nova incompativel.

Nao usar force push, nao fazer merge na main e nao executar limpeza operacional
como parte desta publicacao.

## Branch publicada

O push normal atualizou somente `feat/persistencia-notinha-pin-cardapio` no
GitHub. Confirme o commit de ponta da branch antes de selecionar a revisao no
Render; nao use o SHA `ef71834`, que e apenas a base antiga. Nao houve merge
na `main`, deploy ou operacao no banco de producao nesta entrega. Confira a
politica de autodeploy antes de publicar em horario de operacao do cliente.

## Verificacao pos-publicacao

- `/api/health/ready` responde saudavel.
- Login e logout funcionam.
- Mesa sem nome recebe item compartilhado e sobrevive a reload.
- Segunda sessao ve a mesa e o item no mesmo tenant.
- Pedido nao duplica apos duplo clique ou resposta perdida.
- Fechamento sem nome, completo e misto fecha centavos.
- Perfil sem permissao recebe bloqueio do servidor.
- Mesa livre com historico antigo abre normalmente; item novo persiste apos
  recarga, ficha antiga nao aparece na producao e historico nao e apagado.
- Uma recusa de gravacao mostra "Gravacao recusada" e reverte a alteracao local;
  a fila offline com resultado incerto nao deve ser limpa no Chrome.
- Nenhum teste destrutivo e feito no banco real.
