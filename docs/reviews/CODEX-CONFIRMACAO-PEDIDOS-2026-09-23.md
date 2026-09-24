# Confirmacao de pedidos - revisao de 2026-09-23

## Escopo e origem

- Branch de trabalho: `fix/confirmacao-pedidos`, criada a partir de `692a089` (`feat/limpeza-operacional-salao`). A branch de origem remota de persistencia estava em `8439fc9`; este trabalho preserva os commits anteriores. Commit de codigo/testes: `2a737da32c833953dc57dd2e8cc6064b313c9469`.
- Somente banco SQLite isolado em `.tmp` e servidor local foram usados. Nao houve acesso ao banco do cliente, aos logs do Render, ao navegador da captura nem a impressora fisica. A captura relatada e de 2026-09-23, perto de 18h17; confirmar o fuso do aparelho e do Render antes de cruzar os horarios.
- A frase original aparecia em um unico `catch` de `persistir` no provedor web. O clique no cardapio tambem mostrava sucesso antes da resposta da API. Duas notificacoes na captura nao provam dois requests; a causa daquela ocorrencia especifica permanece sem logs HTTP correlacionados.

## Evidencias reproduzidas

1. O teste Playwright com o bundle de producao abriu uma mesa sem pessoa e adicionou item compartilhado; a API respondeu 500 e, apos reload, o item sumiu. O frontend usava `m<mesa_id>-compartilhado`, enquanto o servidor aceitava `atendimento_id-compartilhado` para itens novos.
2. Corrigido o destinatario, a mesma reproducao ainda retornou 500. Instrumentacao temporaria no banco isolado mostrou `A acao alterar_comanda nao pode alterar mesas`: a leitura devolveu as mesas em outra ordem e a validacao comparava arrays por `JSON.stringify`, tratando reordenacao como mutacao. Essa instrumentacao temporaria foi removida.
3. Com duas sessoes na mesma versao, a primeira adicao persistia e a segunda recebia `CONFLICT`. O teste de API/banco agora reconcilia as alteracoes independentes e confirma os dois IDs no banco. Duas aberturas concorrentes de mesas diferentes revelaram outro defeito: a versao obsoleta era validada antes do CAS e devolvia `BAD_REQUEST`. Agora a leitura compara a versao primeiro, devolve `CONFLICT` e o rebase preserva ambas as mesas.
4. Simulando gravacao bem-sucedida seguida de resposta HTTP perdida, a leitura confirmou o item uma unica vez. Antes da correcao, uma resposta de rede sem gravacao causava uma segunda tentativa automatica; o teste red/green comprovou duas chamadas antes e uma depois. O teste de navegador confirmou um item/ficha/fila de impressao, mesmo com resposta perdida.
5. Em falha antes da gravacao, o banco permanece com zero itens e a fila local conserva a intencao como `incerto`, inclusive apos reload; nenhuma nova escrita e disparada automaticamente. Falha na leitura de reconciliacao tambem permanece incerta.
6. Transicao operacional invalida era tratada como erro generico 500. Agora devolve `BAD_REQUEST` sanitizado; autorizacao, organizacao e CAS continuam validando antes da escrita. O teste de mesas compartilhadas foi ajustado para afirmar o codigo, nao a mensagem interna.

## Correcao

- Destinatario compartilhado de mesa derivado do atendimento ativo na pagina e no cardapio. Mesa pode abrir e receber itens sem cadastrar nome; nenhuma regra de fechamento ou divisao foi alterada.
- Comparacao das colecoes do estado por identificador na verificacao de campos imutaveis; ainda detecta registros faltantes, extras e campos efetivamente modificados. A versao lida e conferida antes da validacao para nao classificar snapshot obsoleto como entrada invalida; o CAS transacional permanece como defesa final.
- Rebase limitado apos `CONFLICT` confirmado. Erro de rede, 5xx ou falha no refetch nao autorizam retry de escrita; operacao fica em fila local para consulta sem reenviar. Estado confirmado e intencoes pendentes sobrevivem ao reload e a respostas antigas.
- Feedback distingue salvando, sincronizado, recusado e aguardando confirmacao. ID aleatorio da operacao correlaciona logs sanitizados de cliente e servidor; nao e chave de idempotencia no banco. Nao registrar payload, PIN, token ou dados de comanda.
- Rejeicao de transicao identificada antes da transacao responde `BAD_REQUEST`; falha de infraestrutura continua incerta. A impressao continua depois da gravacao e nao bloqueia a confirmacao.
- Arquivos de codigo: `packages/web/src/api/lib/comanda-store.ts`, `packages/web/src/api/routes/comanda.ts`, `packages/web/src/web/components/app-shell.tsx`, `packages/web/src/web/components/comanda-provider.tsx`, `packages/web/src/web/components/menu-sheet.tsx`, `packages/web/src/web/lib/offline.ts`, `packages/web/src/web/lib/persistencia.ts`, `packages/web/src/web/pages/mesa.tsx`.
- Testes: `e2e/confirmacao-pedidos.ts`, `e2e/login-producao.spec.cjs`, `e2e/mesas-compartilhadas.ts`.

## Validacao

- Antes: Playwright mesa sem nome falhou (500/sem item apos reload); teste de resultado desconhecido mostrou 2 chamadas; transicao invalida nao retornava `BAD_REQUEST`; abertura concorrente com versao obsoleta retornava `BAD_REQUEST` em vez de `CONFLICT`.
- Depois: `bun run typecheck`, `bun run build` e `git diff --check` passaram. Playwright no servidor/bundle de producao: 11/11 testes, incluindo viewport 390x844, reload, segunda sessao, resposta perdida e banco SQLite real.
- Passaram `bun e2e/confirmacao-pedidos.ts`, `offline.ts`, `mesas-compartilhadas.ts`, `fase1-api.ts`, `tenant-isolation.ts`, `security-regressao.ts` (16 cenarios), `producao.ts`, `impressao.ts` e `balcao.ts`.
- `bun run lint` nao inicia no Windows (`EFTYPE` no spawn do runkit). `oxlint` 1.69.0 do lockfile rodado diretamente passou nos arquivos alterados; no repositorio inteiro aponta erro preexistente `jsx-a11y/control-has-associated-label` em `packages/web/src/web/pages/relatorio-diario.tsx:92`. `bun test ./packages` nao encontra arquivos com nome de teste nesse caminho; as suites deste fluxo ficam em `e2e/`.
- Scan heuristico de 247 arquivos rastreados/novos: zero `.env` real, bancos, builds ou arquivos acima de 50 MB; zero padrao de dado pessoal. Uma URL `libsql://` de exemplo em `e2e/producao.ts` foi revisada como fixture ficticia. Scan heuristico nao substitui ferramenta dedicada de segredos.
- Bun local 1.4.2; o projeto e o Dockerfile declaram 1.3.14. Os testes locais nao sao uma validacao fisica do Android, Turso ou Render.

## Limites e operacao

- A causa da captura em producao nao esta comprovada sem status HTTP, corpo sanitizado da resposta, ID da operacao e logs correspondentes. Nao houve consulta nem alteracao do banco operacional.
- Uma escrita incerta cujo estado remoto ainda nao prova a gravacao fica pendente; **nao clicar novamente nem reenviar automaticamente**. Um operador deve verificar no banco autorizado, por organizacao/atendimento/item, se gravou antes de resolver a intencao. Nao existe idempotencia transacional generica para repeticao arbitraria de escrita; nenhuma migration foi criada.
- Duas adicoes intencionais do mesmo produto somam a quantidade do rascunho. Um toque acidental e uma segunda adicao intencional nao sao distinguiveis sem regra de produto; nao foi inventado bloqueio de toque duplo. O fechamento com consumo ainda exige pessoa cadastrada pela regra preexistente; a abertura e os lancamentos compartilhados nao exigem nome.
- A branch ainda nao foi publicada nem houve merge/deploy. A URL futura sera `https://github.com/viniamanciocoelho-ai/cav-comanda-valhalla/tree/fix/confirmacao-pedidos` somente apos push confirmado. Antes de publicar, confirmar que a nova branch nao aciona deploy automatico; `AGENTS.md` do repositorio tambem proibe push nesta sessao.

## Passagem ao Quintino

1. Revisar a branch e os commits; repetir `bun run typecheck`, `bun run build`, `bun e2e/confirmacao-pedidos.ts` e `bun run test:e2e:production` com Bun 1.3.14. Nao ha migration nem variavel nova. O Dockerfile usa `oven/bun:1.3.14` e `deploy/docker-entrypoint.sh`; a preparacao normal do deploy verifica/aplica apenas as migrations existentes. Nenhum script de limpeza operacional foi executado.
2. Confirmar a politica de autodeploy do Render antes de publicar/selecionar a branch. Backend e frontend devem vir da mesma imagem Docker; validar `/api/health/ready`, abrir mesa sem nome, adicionar item compartilhado, recarregar e consultar em outra sessao antes de liberar trafego. A branch parte de `692a089`, que tambem contem a funcionalidade administrativa de limpeza (manual); revisar essa diferenca antes de promover.
3. Se ocorrer novamente no Chrome Android: anotar data, horario/fuso, acao e `operacaoId` do aviso no console; coletar apenas status, duracao e codigo da chamada `/api/rpc/comanda/persistir` e logs `comanda.persistir` com o mesmo ID. Consultar quantidade/estado do item no tenant correto com acesso autorizado. Nao enviar PIN, token, cookie, payload completo ou dados de clientes.
4. Reversao: retornar ao deploy/imagem anterior no Render apos verificar as operacoes pendentes; nao restaurar banco nem limpar dados. Como nao houve migration nova, nao ha rollback de schema. Nao usar force push.

**Recomendacao original (2026-09-23):** pronto para revisao do Quintino em ambiente controlado; os bloqueios de lint e versao local seriam resolvidos na etapa seguinte. A evidencia da ocorrencia real e a validacao de producao continuavam pendentes.

## Complemento da entrega local (2026-09-24)

- O erro global de oxlint `jsx-a11y/control-has-associated-label` na linha do
  campo de data de `relatorio-diario.tsx` ja existia em `692a089`. Um
  `aria-label` foi adicionado em commit isolado, sem mudar a interface. O
  `runkit lint` do Windows falha ao iniciar subprocessos (`EFTYPE`); o gate
  usa `konsistent` e `oxlint` 1.69.0 fixados pelo lockfile, com as regras
  integrais do projeto. Ambos passaram. Fora do Windows, roda `runkit lint`.
- `e2e/login-producao.spec.cjs` agora cobre, apos o envio com resposta
  perdida, a recusa de fechamento sem pessoa, o cadastro posterior e o
  fechamento persistido, sem mudar a regra de negocio. Teardown do servidor
  espera o processo sair antes de remover o SQLite no Windows.
- Validacao em clone limpo com Bun 1.3.14: `bun install --frozen-lockfile`,
  `bun run verify:confirmacao-pedidos` passaram (typecheck 3/3, build 2/2,
  lint, sete suites de API/unidade e Playwright 11/11). O checkout principal
  tem `.env` local, nao lido nem copiado; o gate o recusa intencionalmente.
- Continua pendente a comprovacao da ocorrencia especifica no Render, a
  politica de autodeploy, a revisao das migrations preexistentes do entrypoint
  e a validacao fisica no Chrome Android/Turso. Nao houve acesso a producao,
  push, limpeza operacional ou aprovacao de deploy.
- Guia de verificacao, importacao e reversao:
  `docs/operacoes/deploy-confirmacao-pedidos.md`.

## Complemento: fechamento sem nome (2026-09-24)

- A restricao de pessoa cadastrada descrita acima era verdadeira na revisao
  anterior e foi removida agora a pedido do usuario. Antes da correcao, a
  regressao de producao aguardou sem sucesso a chamada de
  `solicitar_fechamento` em mesa com itens enviados e zero pessoas.
- Front e API agora permitem solicitar e concluir a conta sem pessoas. Nesse
  caso, o resumo e a validacao financeira usam uma unica linha virtual
  `Consumo sem identificação`, sem criar pessoa no banco; a fila de recibo
  inclui os itens compartilhados e o total. Se a operacao exigir rateio entre
  varias pessoas, o atendente pode incluir nomes ou deixar o campo vazio:
  participantes anonimos recebem `Cliente 1`, `Cliente 2` etc. O backend
  continua comparando os centavos e nomes da divisao ao fechar.
- Playwright com bundle de producao e SQLite isolado: mesa sem nomes, mesa com
  todos os nomes e mesa mista passaram, com solicitação, fechamento, divisao
  persistida e recibo. A abertura, a persistencia depois de reload, a leitura
  em outra sessao e a recuperacao de resposta perdida continuam cobertas.
  Teste de recibo exercita 3 centavos divididos entre dois participantes,
  preservando a soma exata e o centavo excedente.
- Em clone limpo com Bun 1.3.14, `bun run verify:confirmacao-pedidos`
  passou: typecheck 3/3, build 2/2, lint com zero erros, nove suites de
  regressao e Playwright 13/13. Nenhuma migration, schema, limpeza de salao ou
  conexao ao banco do cliente foi executada. Resta a validacao fisica no
  Chrome Android/Turso e a revisao da politica de deploy pelo Quintino.
- Este complemento permanece na branch local `fix/confirmacao-pedidos`.
  O `AGENTS.md` proibe push nesta sessao; nao afirmar URL de branch publicada
  sem push confirmado. O bundle de transferencia esta em
  `.tmp/entrega-quintino/confirmacao-pedidos.bundle`.

## Nova captura e verificacao da entrega (2026-09-24)

- Uma captura do Chrome Android marcada 12:36 mostra avisos de confirmacao e
  uma notificacao de item lancado, enquanto a lista exibida permanece vazia.
  Ela nao mostra o SHA do deploy, os status HTTP, os IDs de operacao ou os
  logs do servidor. Portanto nao permite afirmar que o hotfix publicado
  `bbcc97f` estava ativo, nem atribuir essa ocorrencia a uma causa unica.
- O hotfix `hotfix/confirmacao-pedidos` foi publicado separadamente no GitHub
  no SHA `bbcc97fe058bda7de1b1faa72054d7b4979e83e7`. A branch completa
  `fix/confirmacao-pedidos` continua somente local; inclui tambem o fechamento
  sem nomes, que nao faz parte do hotfix. Nenhuma das branches foi validada
  no banco do cliente por esta revisao.
- Em checkout limpo com Bun 1.3.14, sem `.env` ou conexao remota herdada,
  `bun install --frozen-lockfile` e `bun run verify:confirmacao-pedidos`
  passaram novamente: typecheck 3/3, build 2/2, lint sem avisos, nove suites
  de regressao e Playwright 13/13. Isto nao substitui a verificacao do SHA
  implantado e dos logs da ocorrencia real.

## Rastreio do fluxo publicado (2026-09-24)

- O botao de adicionar item em `mesa.tsx` abre `MenuSheet`. Para mesas, o
  componente chama `adicionarItemAtendimento` com o `atendimento_id` ativo;
  o adaptador `adicionarItem` somente resolve a mesa para esse mesmo ID e
  delega para a mesma funcao. Nao existe um segundo writer usado pelo botao.
- A funcao atualiza o espelho local por `aplicar`, registra uma unica
  `FilaOfflineItem` e converge para `confirmarRegistro`. Tanto o caminho online
  serializado como a fila offline chamam `client.comanda.persistir`; a leitura
  periodica e os listeners `online`/`offline` chamam somente `estado()` ou
  `drenarFila`, respeitando escritas pendentes, versao e resultado incerto.
- A API monta o mesmo procedimento em `routes/comanda.ts`, que chama
  `salvarEstado` no `comanda-store.ts`. O build Vite inclui `menu-sheet`,
  `mesa`, `comanda-provider`, `persistencia` e `offline` no bundle principal;
  o runtime Docker usa o `dist` e copia apenas `src/api` e bibliotecas
  necessarias ao servidor. Nao foram encontrados listeners, rotas ou imports
  antigos que sobrescrevam a gravacao corrigida.
- O teste Playwright de login agora baixa o script principal servido pelo
  servidor e verifica que a mensagem nova de resultado incerto esta no bundle
  e que o texto antigo da captura nao esta. Isso evita declarar que um build
  novo esta correto apenas por testar o codigo-fonte.
- O build forcado em checkout limpo usou `turbo run build --force`: frontend e
  desktop executaram com `Cached: 0`. O teste Playwright contra esse `dist`
  passou 13/13; o teste de concorrencia e resposta perdida passou. O hash do
  asset principal dessa execucao foi registrado no guia operacional.
