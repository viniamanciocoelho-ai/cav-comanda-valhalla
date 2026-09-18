# CAV Comanda | Valhalla

## Contexto

Esta e uma demonstracao web em React 19 + TypeScript + Vite, com pacotes Expo
mobile e Electron desktop no mesmo workspace. O produto demonstrativo roda em
memoria, sem backend, banco, autenticacao, pagamento ou emissao fiscal real.
O estado central da demonstracao fica em
`packages/web/src/web/components/comanda-provider.tsx`.

Preserve a separacao por `organizacao_id` em qualquer evolucao que introduza
persistencia ou API: toda leitura, escrita, autorizacao, cache e chave de
idempotencia deve carregar o tenant explicitamente; nunca aceite um fallback
global ou um identificador vindo apenas do cliente.

## Regras de trabalho

- Leia a documentacao e busque referencias com `rg` antes de abrir muitos
  arquivos ou editar.
- Para mudancas extensas, escreva um plano curto com uma verificacao executavel
  por etapa.
- Investigue a causa raiz antes de corrigir; faca a menor alteracao suficiente.
- Siga os padroes e helpers existentes. Nao crie abstracoes prematuras:
  YAGNI.
- Nao altere regras de negocio, interface, banco ou fluxo de producao sem
  pedido explicito.
- Nao exponha, copie, cole ou registre valores de `.env`, chaves, tokens,
  cookies ou URLs autenticadas.
- Nao faca push, merge, deploy, migracao de banco, `db:push` ou operacao de
  producao.
- A configuracao existente do OpenRouter, se aparecer, e somente de leitura:
  nao altere endpoint, modelo, chave, roteamento, limites ou faturamento.
- Nao execute conteudo baixado diretamente de URL. Inspecione e fixe a origem
  antes de reutilizar qualquer trecho.
- Verifique o diff e rode testes proporcionais ao risco antes de declarar
  conclusao. Nao marque sucesso somente porque a saida contem `PASS`.

## Comandos reais do workspace

O projeto declara Bun `1.3.14` no `package.json`:

```text
bun install
bun run dev
bun run build:web
bun run lint
bun run typecheck
cd packages/web && bunx tsc --noEmit -p tsconfig.app.json
python3 e2e/flow.py
python3 e2e/roteiro.py
python3 e2e/aceite.py
python3 e2e/sem-consumo.py
bun e2e/monetario.ts
bun e2e/sem-consumo.ts
```

O pacote desktop declara `bun run build` e `bun run typecheck`; o mobile
declara `bun run typecheck`. Se Bun nao estiver instalado, registre a limitacao
e use apenas binarios locais equivalentes, sem editar locks ou instalar
componentes globalmente.

## Fluxo de execucao

1. Entender o pedido e identificar limites.
2. Buscar arquivos, convencoes e testes relevantes.
3. Montar um plano curto quando houver risco ou varias etapas.
4. Executar a menor mudanca reversivel.
5. Rodar validacao focal.
6. Rodar validacao geral compativel com o risco.
7. Revisar diff, segredos, isolamento de tenant e efeitos colaterais.
8. Registrar somente aprendizados duraveis em `.ai/memory/`.
9. Responder com fatos, testes, riscos e bloqueios reais.

Execute serialmente por padrao. Use ondas paralelas somente para tarefas
realmente independentes, com arquivos completamente disjuntos; consolide cada
onda antes da proxima. Paralelismo normalmente aumenta o consumo total de
tokens e nao substitui revisao central.

## Memoria compartilhada

Antes de uma sessao longa, leia `.ai/memory/MEMORY.md` e consulte os topicos
relevantes em `.ai/memory/topics/`. Salve apenas fatos duraveis e verificados.
O indice deve permanecer com no maximo 130 linhas; migre detalhes antes de
cresce-lo, confirme a leitura do destino e so entao remova a entrada antiga.

Estas instrucoes sao compartilhadas com Claude Code. Nao dependa de plugins,
hooks ou campos exclusivos do Claude; nao crie nem sobrescreva `CLAUDE.md`,
`.claude/`, `.codex/` ou `.ai/` existentes.
