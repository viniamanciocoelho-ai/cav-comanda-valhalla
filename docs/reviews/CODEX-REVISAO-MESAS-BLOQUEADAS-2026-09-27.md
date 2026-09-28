# Revisão: Mesas bloqueadas e pedidos

Data: 2026-09-27
Repositório: `viniamanciocoelho-ai/cav-comanda-valhalla`
Branch de trabalho: `feat/restaurant-ops-2026-09-27`
Commit técnico: `ce8d5ba` (`fix(mesas): vincular feedback à operação confirmada`)

## Resultado

O hotfix de persistência já publicado separadamente foi mantido no histórico desta
branch: `6a95070` corrige comparações de estado sensíveis à ordem das chaves,
`dc0ece4` corrige chaves instáveis na fila offline e `3a6ab44` expõe a versão
ativa e um motivo seguro para recusas. Este ciclo acrescenta a identificação da
entidade realmente alterada, feedback ligado ao ID da operação e regressão de
reabertura. Nenhuma alteração foi feita na branch de deploy automático, no
Render ou no banco de produção.

## Causa e correção

O incidente reproduzido no fluxo de histórico legado vinha da comparação de
coleções serializadas: objetos equivalentes podiam ser tratados como diferentes
quando o banco devolvia suas propriedades em outra ordem. A correção estrutural
e a chave estável evitam essa recusa falsa e preservam a intenção offline.

Também foi encontrado no frontend um `entidadeId` escolhido pela primeira mesa
ocupada, que não necessariamente era a mesa da operação. Agora o ID vem do delta
real de mesa, item ou balcão. A interface substitui o aviso pendente da mesma
operação por confirmado, recusado ou resultado incerto; não anuncia sucesso
antes da resposta do servidor. A mensagem otimista duplicada foi removida dos
botões de abrir mesa e adicionar item.

## Regressões e validações

- E2E de API: concorrência, resposta perdida, conflito e identificação da mesa/item alterado.
- E2E de histórico legado, fila offline, mesas compartilhadas e isolamento multi-tenant.
- 16 cenários de autorização e integridade; 29 verificações de encerramento sem consumo.
- Playwright do bundle de produção local: 15 testes passaram, incluindo login sem erro de console, falha real de abertura, lançamento de pedido, mobile e duas sequências de abrir mesa, lançar rascunho, encerrar e reabrir.
- Typecheck forçado com Turbo: 3 pacotes passaram.
- Build forçado sem cache do Turbo: web e desktop passaram.
- `konsistent` e `oxlint` fixados pelo lockfile passaram.
- Rateio: 18.009 divisões exaustivas e 5.000 sorteios ponderados passaram; recibo e cenários de fechamento também passaram.
- `git diff --check` passou. A varredura dos arquivos alterados não encontrou segredos nem dados pessoais reais; o padrão genérico de telefone marcou somente valores determinísticos fictícios do teste de health. Nenhum arquivo alterado excede 50 MB.

O ambiente tem Bun `1.4.2`, mas o projeto declara `1.3.14`. Por isso o gate
integrado `e2e/verificar-confirmacao-pedidos.ts` recusou iniciar; as mesmas
suítes foram executadas manualmente com banco SQLite isolado. `bun run lint`
também não iniciou no Windows (`uv_spawn`/`EFTYPE`); os binários fixados de
`konsistent` e `oxlint` foram executados diretamente e passaram. A validação
com a versão exata de Bun permanece pendente.

Nenhum `.env` real foi usado. Testes e banco eram locais e descartáveis; não
houve consulta, escrita, migration, limpeza, reinício ou deploy em produção.

## Escopo restante do pedido amplo

| Frente | Situação nesta entrega |
| --- | --- |
| R01 — persistência/reabertura de mesas | Corrigida e coberta nos commits herdados e nos novos testes; sem prova de produção até o deploy controlado. |
| R02 — identificar versão ativa | Rota de versão já está no histórico herdado; validar no serviço publicado depois do deploy. |
| R03 — meios de pagamento, gorjeta, troco e estorno | Pendente. O caixa atual registra quem pagou e orienta usar a maquininha; não há contrato/schema para capturar esses valores. Não foi inventada regra financeira nem criada migration. |
| R04 — preparo parcial por item/unidade | Pendente. O fluxo atual move a ficha e os itens vinculados juntos; divisão parcial requer regra operacional e contrato explícitos. |
| R05 — autoria do lançamento | Os itens e fichas mantêm o funcionário autor no modelo e a produção já exibe o autor da ficha; este ciclo não alterou essa trilha. |
| R06 — feedback correlacionado à operação | Implementado para abrir mesa e incluir item; estados incerto e recusado continuam sem falso sucesso. |
| R07 — agrupamento visual de lançamentos | O rascunho já soma produto/pessoa/observação equivalentes; itens enviados mantêm seus registros. Nenhuma consolidação destrutiva foi feita. |
| R08 — pedidos mais recentes no topo | Decisão pendente: “mais recentes” pode ordenar fichas da produção ou comandas/atendimentos. Não alterei a ordenação para não mudar o fluxo errado. |
| R09 — notificação em segundo plano | Pendente. Não há fluxo Web Push completo nem configuração de chaves/assinaturas do serviço disponível para validar entrega autenticada por organização. |

## Arquivos alterados neste commit

- `packages/web/src/web/components/comanda-provider.tsx`
- `packages/web/src/web/lib/feedback-operacao.ts`
- `packages/web/src/web/components/menu-sheet.tsx`
- `packages/web/src/web/pages/garcom.tsx`
- `packages/web/src/web/pages/mesa.tsx`
- `e2e/confirmacao-pedidos.ts`
- `e2e/login-producao.spec.cjs`

O relatório está registrado em um commit de documentação separado do commit
técnico. Esta branch não é o hotfix já publicado no GitHub,
não está conectada ao deploy automático e não foi mesclada à `main`.

## Complemento de validação e entrega — 2026-09-28

Checkout limpo baseado no histórico de `feat/persistencia-notinha-pin-cardapio`
e no hotfix `3a6ab44`; nenhuma variável de `.env` foi lida. Bun `1.3.14` foi
instalado somente em `.tmp/bun-runtime` e as dependências foram instaladas com
`bun install --frozen-lockfile --ignore-scripts`.

### Portabilidade do lint

`bun run lint` falhava no Windows com `EFTYPE` porque o Runkit tentava iniciar
scripts `.js` e o shim sem extensão do Oxlint como executáveis nativos. Além
disso, `core.autocrlf=true` convertia os arquivos protegidos para CRLF, fazendo
o Runkit reportar falsamente uma edição em `__ports.cjs`. A correção preserva
as três etapas originais (Konsistent, arquivos protegidos e Oxlint):
`packages/web/scripts/lint.ts` encaminha os scripts pelo Bun no Windows e `.gitattributes`
fixa LF somente nos arquivos listados em `.runable/protected-files.json`.
`bun run lint` passou integralmente após a correção; nenhuma proteção foi
desativada.

### Gate executado

Executado em 2026-09-28 com Bun `1.3.14` e banco SQLite temporário:

- `bun install --frozen-lockfile --ignore-scripts`: passou.
- `bun e2e/verificar-confirmacao-pedidos.ts`: passou.
- Typecheck Turbo: 3 pacotes, `--force`, zero cache.
- Build Turbo: web e desktop, `--force`, zero cache; build Vite de produção criado.
- Lint oficial `bun run lint`: Runkit, Konsistent, proteção de arquivos e Oxlint passaram.
- 11 suítes E2E existentes passaram: bootstrap, confirmação, legado, offline,
  mesas compartilhadas, tenant isolation, segurança, API, sem consumo, recibo e
  monetário.
- Playwright contra servidor e bundle de produção novos: 15/15 passaram,
  incluindo reabertura repetida da Mesa 05, resposta perdida, histórico legado,
  mobile e impressão simulada.
- `git diff --check` e revisão de segredos/dados pessoais dos arquivos alterados
  precisam ser repetidos depois da inclusão deste complemento e antes do push.

### Estado dos requisitos

| Requisito | Estado comprovado neste checkout |
| --- | --- |
| R01 — abertura/reutilização | Correção e regressão de reabertura no cenário sintético passaram. A matriz de todas as mesas configuradas ainda não foi executada. Sem acesso ao cadastro de produção. |
| R02 — confirmação/sincronização | Feedback correlacionado e gate de concorrência/resposta perdida passaram em teste local. SHA ativo no Render não foi consultado. |
| R03 — pagamentos | NÃO IMPLEMENTADO. Modalidades, pagamentos parciais persistidos, dinheiro recebido/troco, estorno e discriminação nos relatórios ainda não existem no contrato atual. |
| R04 — preparo individual/parcial | NÃO IMPLEMENTADO. O status atual avança ficha/itens vinculados; não há quantidades prontas parciais. |
| R05 — autoria por lançamento | INCOMPLETO. Autor e horário existem por item e ficha, mas incrementos de um rascunho equivalente são somados na mesma linha, sem trilha individual de cada incremento. |
| R06 — feedback visual | Implementado para as operações revisadas e validado nos E2E/Playwright já listados. |
| R07 — agrupamento/+ | INCOMPLETO. Rascunhos equivalentes são somados no cliente; isso apaga a autoria individual do incremento. A exibição agregada preservando lotes/autores não foi concluída. |
| R08 — ordenação | AGUARDANDO decisão: qual tela/lista deve ordenar pedidos mais recentes? Não alterado. |
| R09 — alertas | NÃO IMPLEMENTADO. Não há Web Push, gestão autenticada de assinaturas, fila de eventos deduplicada, controles de ativação nem teste físico. |

Consequentemente, esta branch **não está completa nem recomendada para deploy**.
R03, R04, R05, R07 e R09 são trabalho de implementação restante, não passos
que devam ser delegados a Quintino como configuração de produção. R08 aguarda
somente a decisão indicada. Nenhuma migration nova foi criada ou aplicada. Não
houve acesso a Render, banco, dados de clientes ou hardware real.

Commit desta continuação: `4524f84` (`fix(tooling): run full bun lint on Windows`),
descendente do hotfix `3a6ab44`. O SHA remoto final será conferido após o push
da revisão. Não fazer merge nem deploy; a publicação GitHub não comprova a
versão ativa em produção.
