# Revisao tecnica ampliada do CAV Comanda Valhalla

Revisao iniciada em 2026-09-24 e fechada em 2026-09-25.

## Status

Versao candidata para homologacao externa. A homologacao da Utria e o deploy no
Render continuam pendentes. Esta revisao nao acessou banco, servico, variaveis
ou dados reais.

## Baseline

- Branch: `feat/persistencia-notinha-pin-cardapio`
- Base inspecionada: `ef718342411a65224f08023b7e17edef944f9516`
- Ajuste de teste: `359192f600153ad88a22bc4f9caf1117705d1884`
- Commit final desta revisao: conferir `git rev-parse HEAD` apos os commits
  locais; o SHA da base nao inclui estes documentos nem o teste de bootstrap.
- Estado local: checkout limpo no inicio da revisao
- Main: nao alterada
- Stack: Bun 1.3.14, React 19, Vite, Hono/oRPC, Drizzle/libSQL e SQLite isolado
- O remote local apontava a branch candidata para o mesmo SHA no inicio da revisao

## Limites respeitados

Nao foram executados deploy, merge, push, migration remota, limpeza do salao,
cobranca, notificacao, impressao fisica ou acesso a dados de clientes. O
checkout de validacao nao continha `.env` real nem recebeu `DATABASE_URL` ou
`DATABASE_AUTH_TOKEN` do shell.

## Diagnostico do incidente

O defeito conhecido foi reproduzido e corrigido antes deste ciclo. A causa
confirmada era composta por quatro pontos:

1. O destinatario de item compartilhado podia ser derivado de um identificador
   de mesa que nao era aceito pelo backend.
2. A validacao comparava colecoes por ordem do array, embora o banco pudesse
   devolve-las em ordem diferente.
3. Uma versao obsoleta podia chegar a validacao de transicao antes de ser
   classificada como conflito de CAS.
4. Falha de resposta depois da gravacao podia induzir uma nova escrita.

O caminho ativo confirmado no bundle e:

`mesa.tsx -> MenuSheet -> adicionarItemAtendimento -> aplicar -> confirmarRegistro -> client.comanda.persistir -> salvarEstado`

Nao foi encontrado um segundo escritor legado no bundle de producao gerado.
A fila offline existente apenas reaplica a intencao com controle de
versao; ela nao foi adicionada nesta revisao.

## Revisao por risco

### Persistencia e concorrencia

Inspecionados `comanda-provider.tsx`, `persistencia.ts`, `offline.ts`,
`comanda.ts`, `comanda-store.ts` e os testes de concorrencia. A escrita usa
transacao e compare-and-swap por `organizacao_id` e `versao`. Conflitos
confirmados podem ser rebaseados; rede, 5xx e leitura de reconciliacao incerta
nao fazem retry automatico da escrita. O estado pendente permanece identificavel
apos reload.

### Tenant e autorizacao

As leituras operacionais, gravacoes, filas de impressao, relatorios, sessoes,
configuracao, cardapio, funcionarios e auditoria foram rastreadas. As queries
operacionais carregam `organizacao_id`; o servidor toma tenant e perfil da
sessao, sem confiar no tenant enviado no estado. As suites de tenant e RBAC
passaram.

### Financeiro

Rateio, taxa de servico, fechamento com nomes, sem nomes e misto foram
verificados. O rateio usa centavos inteiros e as somas fecham exatamente. Nao
foi alterado schema nem regra financeira nesta revisao.

### Interface, sessao e bundle

Login, logout, tela principal, snapshot legado, storage indisponivel, sessao
offline e navegacao por perfil foram verificados no bundle de producao. O
identificador `sair` esta definido no `SessaoProvider` e presente no caminho de
logout testado; nao foi reproduzida a tela preta antiga.

### Impressao

Foram verificados serializacao ESC/POS, fila, reimpressao, falha nao bloqueante,
balcao, BLE simulado e alternativa RawBT. A impressora fisica Bluetooth nao foi
acionada; essa etapa continua pendente de homologacao com o aparelho real.

## Mapa de cobertura

| Modulo | Inspecionado e testado | Correcao nesta rodada | Pendente |
| --- | --- | --- | --- |
| PIN, sessao e RBAC | API, bootstrap, login/logout, quatro perfis e rotas protegidas | Teste de bootstrap isolado | Homologacao externa |
| Mesas, pedidos e sincronizacao | Persistencia, CAS, fila local, duas sessoes, reload, resposta perdida, item sem nome e envio | Nenhuma alteracao do aplicativo | Correlacionar eventual incidente real com SHA e `operacaoId` |
| Balcao | Operacao compartilhada, transferencia, fechamento, reuso e impressao por atendimento | Nenhuma | Homologacao externa |
| Producao e impressao | Fichas, fila, reimpressao, ESC/POS, BLE simulado e RawBT | Nenhuma | Dispositivo fisico 58 mm |
| Caixa e relatorio | Fechamento anonimo/misto, centavos, recibo, historico e relatorio diario | Nenhuma | Verificacao operacional autorizada |
| Cadastros/configuracao | Contratos de produto, funcionario, PIN e configuracao no teste de API | Nenhuma | Refinamento visual externo |
| Interface web | Bundle Vite, PIN, mesa, caixa, Bluetooth, tela movel 390 px e console | Nenhuma | Navegacao visual completa em varios aparelhos |
| Infra, backup e limpeza | Docker runtime, deploy-setup, saude, backup/restore e leitura da rotina de limpeza | Nenhuma | Nenhuma operacao executada em producao |

Os testes Python historicos e os arquivos gerados nao foram tratados como
evidencia atual do fluxo autenticado por PIN. A matriz nao representa uma
garantia de ausencia de bugs em todos os aparelhos e redes.

## Achados e classificacao

Nao foi encontrado novo defeito critico de perda, duplicacao, autorizacao ou
isolamento durante esta rodada.

Observacoes que nao foram tratadas como falhas de codigo:

- `docs/architecture/` nao existe neste checkout, embora tenha sido solicitado
  como fonte documental. O mapa equivalente esta em `Beck/README.md` e
  `Front/README.md`.
- `bun run lint` direto falha no Windows com `EFTYPE/uv_spawn` no wrapper
  `runkit`. O gate usa os binarios fixados e passou com 0 warnings e 0 errors.
- `e2e/bootstrap-seguro.ts` falhava isolado sem `DATABASE_URL` porque
  importava o cliente de banco antes de configurar o teste. Agora ele usa
  `file::memory:` por conta propria e foi incluido no gate.

Antes da correcao do teste: `URL_INVALID` com URL `undefined` ao executa-lo
sem ambiente herdado. Depois: `Bootstrap seguro` aprovado sem configuracao
externa. Nenhum arquivo de aplicacao precisou ser alterado.

## Arquivos de codigo envolvidos na correcao ja presente

- `packages/web/src/api/lib/comanda-store.ts`
- `packages/web/src/api/routes/comanda.ts`
- `packages/web/src/web/components/comanda-provider.tsx`
- `packages/web/src/web/components/menu-sheet.tsx`
- `packages/web/src/web/components/app-shell.tsx`
- `packages/web/src/web/components/checkout-sheet.tsx`
- `packages/web/src/web/lib/offline.ts`
- `packages/web/src/web/lib/operacao.ts`
- `packages/web/src/web/lib/persistencia.ts`
- `packages/web/src/web/lib/recibo.ts`
- `packages/web/src/web/pages/mesa.tsx`
- `packages/web/src/web/pages/relatorio-diario.tsx`

Nesta rodada de auditoria nao foi necessaria nova alteracao do aplicativo.
O teste `e2e/bootstrap-seguro.ts` e o gate de QA foram ajustados.

## Validacoes executadas

No checkout isolado `.tmp/entrega-validacao`, sem ambiente real:

- `bun e2e/verificar-confirmacao-pedidos.ts` com Bun 1.3.14 no commit
  `359192f`: aprovado. `bun run` direto usa o Bun global 1.4.2 neste Windows;
  o gate exige e foi executado pelo binario local 1.3.14.
- O gate aprovou typecheck, build, convencoes do Runkit, Oxlint, dez suites
  de regressao e Playwright 13/13 no bundle final.
- `bun x turbo build --force`: aprovado no mesmo commit, sem tarefas Turbo em
  cache; Playwright foi repetido depois da build forcada: 13/13.
- O HTML recem-gerado referencia `/assets/index-BY2olVyR.js`, SHA-256
  `2EF1DB8D09606785D8FC8C1E4AF0C47FBDB507D467F1964DD9940AB25AE91646`.
- `e2e/balcao.ts`: aprovado.
- `e2e/impressao.ts`: aprovado.
- `e2e/impressao-bluetooth.ts`: aprovado.
- `e2e/impressao-balcao.ts`: aprovado.
- `e2e/relatorio-diario.ts`: aprovado.
- `e2e/saude.ts`: aprovado.
- `e2e/hono-security.ts`: aprovado.
- `e2e/producao.ts`: aprovado.
- `e2e/deploy-setup.ts`: aprovado.
- `e2e/docker-runtime.ts`: aprovado.
- `e2e/backup.ts`: aprovado.
- `e2e/historico-persistencia.ts`: aprovado.
- `e2e/bootstrap-seguro.ts` com banco em memoria configurado pelo proprio
  teste: aprovado.
- `e2e/static-path.ts`: aprovado.
- `e2e/regressao-fina.ts`: aprovado.
- `e2e/sem-consumo.ts`: aprovado, 28/28 verificacoes.
- `e2e/monetario.ts`: aprovado, 64/64 verificacoes.
- `git diff --check 692a089..HEAD`: aprovado.
- Scan de segredos de alta confianca: nenhum resultado.
- Scan de arquivos versionados acima de 50 MB: nenhum resultado.

O comando `bun run lint` sem o workaround do gate foi registrado como falha de
invocacao do wrapper Windows, nao como falha do Oxlint.

## Exclusoes da revisao linha a linha

Dependencias em `node_modules`, builds em `dist`, caches Turbo, bancos SQLite de
`.tmp`, screenshots e resultados JSON gerados foram excluidos por serem artefatos
gerados ou dependencias de terceiros. O bundle novo foi inspecionado quanto a
segredos, referencias do fluxo de persistencia e existencia do logout.

## Riscos restantes

- Homologacao com Utria ainda nao realizada.
- Teste fisico da impressora Bluetooth ainda nao realizado.
- O SHA efetivamente ativo no Render ainda precisa ser confirmado no painel e
  em `/api/health/ready` pelo responsavel pelo deploy.
- Se uma escrita tiver resultado incerto em producao, nao repetir a operacao
  antes de consultar o estado autorizado.
- Reverter codigo nao restaura dados e nao resolve uma gravacao incerta.

## Decisao

Resultado: **aprovacao tecnica condicionada a homologacao externa**. A branch
pode ser entregue para a Utria e para o Quintino validar, mas esta revisao nao
autoriza deploy automatico nem declara que a versao esta ativa no Render.
