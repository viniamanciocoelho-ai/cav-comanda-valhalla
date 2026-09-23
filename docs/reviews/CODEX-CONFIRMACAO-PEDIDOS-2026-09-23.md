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

**Recomendacao:** pronto para revisao do Quintino em ambiente controlado; aprovacao de producao bloqueada ate a verificacao do lint global, do Bun fixado e da evidencia da ocorrencia real.
