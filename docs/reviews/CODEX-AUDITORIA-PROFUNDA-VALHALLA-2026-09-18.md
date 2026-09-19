# Auditoria profunda — CAV Comanda Valhalla

Data: 18 de setembro de 2026

## Identificação

- Repositório: `viniamanciocoelho-ai/cav-comanda-valhalla`
- Branch auditada e corrigida: `feat/persistencia-notinha-pin-cardapio`
- Commit inicial recebido: `55a4fd1`
- Base funcional anterior registrada: `e8049ac`
- Destino: branch remota homônima, sem merge na `main`
- URL: `https://github.com/viniamanciocoelho-ai/cav-comanda-valhalla/tree/feat/persistencia-notinha-pin-cardapio`

## Escopo

Revisão direta da árvore local, sem workers separados, cobrindo Hono, oRPC, Drizzle,
autenticação por PIN, RBAC, isolamento por `organizacao_id`, concorrência otimista,
persistência operacional, histórico, CORS, servidor estático, rateio de centavos e recibo.

Não foram executados deploy, force push, merge na `main` ou migrations remotas.

## Problemas comprovados

1. A API aceitava um snapshot completo controlado pelo cliente com validação baseada
   principalmente na permissão da ação. Um cliente autenticado podia adulterar coleções,
   autoria, totais e transições que não pertenciam à ação declarada.
2. `enviarPedido` passava `"enviar_pedido"` como segundo argumento de `Array.map`, não
   para a função de persistência. O backend recebia a ação padrão `alterar_comanda`.
3. Novos registros operacionais usavam `organizacao_id` fixo em vez do tenant autenticado.
4. Configuração de mesas e largura do recibo não participava da mesma comparação de versão
   do estado, permitindo perda de atualização concorrente.
5. O fechamento confiava em subtotal, serviço, divisão e total enviados pelo cliente.
6. O recibo recalculava itens compartilhados por conta própria e podia distribuir o centavo
   residual de forma diferente da divisão canônica exibida no caixa.
7. `ratear`, `paraCentavos` e `paraReais` aceitavam entradas fora do domínio seguro.
8. Login não tinha limitação de tentativas, mantinha diferenças de custo entre organização
   existente e inexistente, e o logout não revogava a sessão.
9. A gravação reescrevia todo o histórico financeiro em cada operação, alterando timestamps
   e aumentando o volume de escrita no Turso.
10. CORS aceitava configuração excessivamente aberta e o servidor estático não normalizava
    de forma segura caminhos codificados ou com travessia.
11. Abertura de mesa por gerência aceitava `garcom_id` arbitrário.
12. O desfazer de encerramento sem consumo rejeitava rascunhos originalmente criados por
    outro funcionário ativo, contrariando a restauração integral prometida pela interface.
13. Os testes de integração importavam o cliente antes de isolar `DATABASE_URL`, permitindo
    uso acidental do endereço `libsql:` carregado automaticamente pelo Bun.
14. Dependências diretas continham versões com correções de segurança disponíveis.
15. README e testes históricos de navegador divergiam do fluxo atual com autenticação por PIN.

## Correções realizadas

- Adicionado schema Zod estrito para todo estado recebido pela procedure oRPC.
- Adicionada validação de transição por ação, coleção, campo, perfil, mesa, ficha e autoria.
- Fechamentos agora são recalculados no backend em centavos inteiros, incluindo serviço,
  compartilhados, pessoas e soma final.
- Corrigida a ação real de envio de pedido e removido o tenant fixo do frontend.
- Configuração agora usa transação e compare-and-swap da versão operacional.
- Rateio passou a rejeitar totais, pesos e conversões inválidas; a soma permanece exata.
- Recibo passou a consumir a divisão canônica do fechamento.
- Login recebeu limite por origem e organização, hash fictício para falha uniforme e
  reserva da tentativa antes do PBKDF2; logout revoga a sessão.
- PIN de funcionário é derivado uma vez e gravado em transação.
- Histórico passou a inserir somente novos registros e atualizar apenas o desfazer.
- CORS foi limitado à própria origem e a `CAV_ALLOWED_ORIGINS`.
- Caminho estático passou por resolução canônica e bloqueio de travessia/má codificação.
- Abertura exige o `funcionario_id` da sessão.
- Desfazer aceita autoria preservada somente quando corresponde a funcionário ativo do tenant.
- Testes de banco agora criam SQLite único, aplicam migrations locais e importam a API depois
  de sobrescrever o ambiente.
- Atualizadas dependências diretas de Hono, oRPC, libSQL, Electron, electron-builder, Vite,
  Sharp, AWS SDK e PM2; o lockfile recebeu correções transitivas compatíveis.

## Evidências e regressões

- `e2e/security-regressao.ts`: 16 cenários de autorização e integridade.
- `e2e/tenant-isolation.ts`: dois tenants, tentativa de troca de `organizacao_id` e limite de PIN.
- `e2e/fase1-api.ts`: login, logout, sessão, abertura, rascunho, envio, concorrência e configuração.
- `e2e/historico-persistencia.ts`: timestamp de fechamento preservado após nova operação.
- `e2e/hono-security.ts`: mesma origem/allowlist aceitas e origem arbitrária bloqueada.
- `e2e/static-path.ts`: sete casos de caminho válido, codificado, travessia, byte nulo e
  codificação inválida.
- `e2e/demo-mode.ts`: 11 itens fictícios somente com demo habilitado.
- `e2e/monetario.ts`: 64 verificações, 18.009 divisões exaustivas e 5.000 rateios ponderados.
- `e2e/recibo.ts`: seis verificações do recibo térmico.
- Teste visual local: os quatro PINs abriram somente as rotas do perfil; tentativas diretas
  foram redirecionadas. Viewport de 1270 px ficou sem overflow e sem erro no console.

## Incidente de isolamento durante a auditoria

Uma repetição inicial dos testes de integração, sem variável explícita, herdou o
`DATABASE_URL` de protocolo `libsql:` do ambiente local. A suíte abortou no estado real e o
teste multi-tenant criou apenas a organização sintética `odin`.

- A mesa 1 de `valhalla` foi verificada como livre, sem pessoas e sem itens; não houve alteração
  operacional persistida nela.
- Todas as linhas do tenant sintético `odin` foram removidas em transação e a ausência foi
  confirmada.
- Logins de teste criaram sessões temporárias que expiram pela política existente; não foram
  removidas em lote para não revogar sessões legítimas concorrentes.
- As três suítes foram corrigidas para usar somente SQLite exclusivo e passaram em paralelo.

## Validação final

| Comando | Resultado |
|---|---|
| `bunx bun@1.3.14 install --frozen-lockfile` | aprovado |
| `bunx bun@1.3.14 run typecheck` | aprovado, 3 pacotes |
| `bunx bun@1.3.14 run build` | aprovado, web e desktop |
| `bunx oxlint . --deny-warnings --no-error-on-unmatched-pattern` | aprovado |
| `bunx konsistent check --config-package @runablehq/runkit` | aprovado, 20 arquivos |
| `bunx drizzle-kit check --config drizzle.config.ts` | aprovado |
| suítes TypeScript listadas acima | aprovadas |
| `git diff --check` | aprovado; somente avisos de conversão LF/CRLF |
| scan textual de segredos rastreados | nenhum achado de alta confiança |
| scan de dados clínicos/pacientes | nenhum dado real encontrado |
| arquivos rastreados acima de 50 MB | nenhum |
| `bun test ./packages` | não descobre testes pelo padrão atual de nomes |
| `bun run lint` | launcher RunKit falha no Windows com `uv_spawn`; etapas internas aprovadas |
| `bun audit` | 10 alertas: 5 altos e 5 moderados; nenhum crítico |

## CodeRabbit

O CLI não estava instalado. O instalador oficial foi consultado novamente com rede funcional,
mas declara suporte somente a Linux x64/ARM64 e exige shell POSIX, indisponível neste Windows.
Nenhum resultado deste relatório é atribuído ao CodeRabbit.

## Dependências restantes

Os 10 alertas transitivos restantes estão em cadeias de Expo/React Native, PM2,
electron-builder e ferramentas de desenvolvimento: `decode-uri-component`, `esbuild`,
`image-size`, `js-yaml`, `postcss` e `uuid`. A remoção completa exige atualização coordenada
de dependências principais ou correção dos publicadores; não foi aplicado override global
sem comprovação de compatibilidade.

## Arquivos principais alterados

- `packages/web/src/api/lib/comanda-schema.ts`
- `packages/web/src/api/lib/comanda-store.ts`
- `packages/web/src/api/lib/static-path.ts`
- `packages/web/src/api/routes/comanda.ts`
- `packages/web/src/api/__core/app.ts`
- `packages/web/src/__server.ts`
- `packages/web/src/web/components/comanda-provider.tsx`
- `packages/web/src/web/components/sessao-provider.tsx`
- `packages/web/src/web/components/guarda-rota.tsx`
- `packages/web/src/web/lib/rateio.ts`
- `packages/web/src/web/lib/recibo.ts`
- `e2e/test-database.ts`
- `e2e/security-regressao.ts`
- `e2e/tenant-isolation.ts`
- `e2e/fase1-api.ts`
- `e2e/historico-persistencia.ts`
- `e2e/demo-mode.ts`
- `e2e/hono-security.ts`
- `e2e/static-path.ts`
- `package.json`, pacotes e `bun.lock`

## Commits criados

- `3612fb8` — `fix: blindar persistencia e operacao multi-tenant`
- `db5f44f` — `chore: atualizar dependencias de seguranca`
- Relatório e atualização do README: commit documental que contém este arquivo.

## Riscos e decisões pendentes

- O estado operacional ativo ainda é persistido como snapshot por mutação. A versão otimista
  evita sobrescrita silenciosa, mas o volume de escrita deve ser medido no Turso antes de escala.
- O limitador de login é local ao processo. Uma implantação com múltiplas instâncias exige
  armazenamento compartilhado ou proteção equivalente na borda.
- As suítes Python de navegador ainda usam o fluxo anterior sem PIN e não integram o gate atual.
- Mobile real, impressora térmica, fluxo fiscal e infraestrutura de produção não foram homologados.
- Os 10 alertas transitivos precisam de aceite de risco ou atualização coordenada antes de
  declarar prontidão de produção.

## Recomendação

**Aprovado para Quintino/Runable em ambiente de desenvolvimento ou homologação.**

**Não aprovado para deploy de produção** enquanto os alertas transitivos, testes móveis,
impressora/fiscal e estratégia de rate limit distribuído não forem resolvidos ou formalmente aceitos.

A `main` não foi alterada.
