# Correcao da tela preta

Data: 2026-09-22

Branch: `feat/persistencia-notinha-pin-cardapio`

Base auditada: `23d82ee`

## Causa confirmada

O frontend restaurava o snapshot offline com conversao direta de JSON para os
tipos atuais, sem validar ou migrar o formato. Snapshots gravados antes da
introducao dos balcoes e do identificador `atendimento_id` nao continham esses
campos. Quando a leitura remota de `comanda.estado` falhava, o estado antigo era
usado e a primeira renderizacao tentava executar `.map` sobre `balcoes`
indefinido, interrompendo o React e deixando a pagina preta.

A falha foi reproduzida no bundle de producao com:

`Cannot read properties of undefined (reading 'map')`

A guia anonima nao possuia sessao nem snapshot anterior e, portanto, exibia o
login. Ela nao representava o mesmo estado autenticado da guia normal.

Tambem foi comprovado um segundo risco de inicializacao: acesso direto a
`window.localStorage` derrubava a aplicacao quando o navegador bloqueava o
armazenamento.

Nao existe registro de Service Worker, PWA, IndexedDB ou cache de consultas no
codigo atual. Nao houve evidencia de falha de asset ou import dinamico.

## Correcao

- O snapshot e a fila offline agora sao lidos como dados desconhecidos,
  validados e migrados de forma idempotente para o schema local 2.
- Mesas ativas antigas recebem um `atendimento_id` deterministico.
- Pessoas, itens, tickets, fechamentos e encerramentos preservam seus vinculos.
- Quatro balcoes vazios sao adicionados somente quando o campo nao existia.
- Rascunhos e operacoes pendentes permanecem na fila; nenhuma chave e apagada.
- O token de sessao passou a usar funcoes tolerantes a falhas de storage, com
  memoria apenas para a aba atual quando a persistencia estiver indisponivel.

Nao houve alteracao no schema do banco, migrations, autorizacao, regras de
negocio ou isolamento por `organizacao_id`.

## Arquivos alterados

- `packages/web/src/web/lib/offline.ts`
- `packages/web/src/web/lib/api.ts`
- `packages/web/src/web/components/sessao-provider.tsx`
- `e2e/offline.ts`
- `e2e/login-producao.spec.cjs`
- `docs/reviews/CODEX-CORRECAO-TELA-PRETA-2026-09-22.md`

## Validacao

- `bun run typecheck`: aprovado.
- `bun run build`: aprovado.
- `bun run test:e2e:production`: 7/7 aprovados no bundle de producao.
- Scripts funcionais `e2e/*.ts`: aprovados, incluindo tenant, RBAC, balcao,
  cozinha, impressao, saude, backup e operacao offline.
- `bun e2e/offline.ts`: migracao e fila pendente aprovadas.
- `oxlint` nos arquivos alterados: aprovado sem avisos.
- `git diff --check`: aprovado.
- Scan de segredos e arquivos maiores que 50 MB: aprovado.
- `bun test ./packages`: o repositorio nao possui arquivos no padrao nativo do
  Bun Test nessa pasta; os testes oficiais sao scripts E2E e Playwright.

O primeiro Playwright executado ao mesmo tempo que outro build sofreu disputa
na pasta `dist`. A repeticao isolada, que representa a validacao correta,
reconstruiu o bundle e aprovou os sete testes.

## Deploy e reversao

Nao ha configuracao nova nem migration. O deploy deve usar esta branch no
Render. A migracao ocorre no navegador ao carregar o snapshot antigo e grava o
resultado na mesma chave, sem limpeza geral.

Para reverter, reverta o commit desta correcao e publique novamente. O formato
migrado mantem os campos antigos e acrescenta os novos, sem apagar operacoes.

## Limitacoes

Nao houve acesso ao perfil real afetado nem a URL de producao, portanto o
console real nao foi inspecionado. A falha foi reproduzida localmente com o
bundle de producao e o formato legado correspondente. O teste fisico de
Bluetooth/RawBT em Android continua pendente; os testes atuais usam simulacao.

## Validacao manual apos o deploy

1. Abra o mesmo perfil normal que apresentava a tela preta, sem limpar dados.
2. Atualize a pagina e confirme que a tela do salao aparece.
3. Confira mesas, balcoes e rascunhos pendentes.
4. Saia e entre novamente pelo PIN.
5. Confirme que o console nao registra excecao na inicializacao.
