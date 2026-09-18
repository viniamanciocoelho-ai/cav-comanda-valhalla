# Decisoes do bootstrap

## D001 - Instrucoes compartilhadas em `AGENTS.md`

Contexto: Codex e Claude Code precisam de regras comuns, mas nao havia arquivo
de governanca no projeto.

Escolha: criar somente `AGENTS.md` na raiz, sem duplicar `CLAUDE.md`.

Consequencia: os dois agentes compartilham limites, comandos e fluxo; recursos
exclusivos do Claude continuam fora do projeto.

## D002 - Nenhuma configuracao especifica do Codex

Contexto: a versao local aceita perfis e configuracao global, mas nao havia
necessidade de um campo de projeto adicional confirmada pela ajuda.

Escolha: usar `AGENTS.md` e nao inventar `config.toml`, hooks ou plugins.

Consequencia: a adocao e reversivel e nao altera a configuracao global.

## D003 - Context7 adiado

Contexto: a demonstracao ja tem dependencias instaladas e a tarefa de
bootstrap nao exige consultar uma API recente.

Escolha: nao adicionar MCP ou credencial.

Consequencia: reavaliar somente quando uma tarefa depender de documentacao
versionada que nao possa ser confirmada localmente.

## D004 - Memoria local em duas camadas

Contexto: nao existe wiki, vault ou MCP de memoria no projeto.

Escolha: `MEMORY.md` como indice pequeno, `topics/` como detalhes e
`INSTRUCTIONS.md` como politica.

Consequencia: a memoria e compartilhavel e portavel, mas migracao para um
destino de longo prazo ainda sera manual quando esse destino existir.

## D005 - Sem ferramentas de qualidade novas

Contexto: o projeto usa scripts existentes, TypeScript e o tooling do template;
nao possui ESLint e nao precisa de Graphify.

Escolha: nao instalar ESLint, Graphify, RTK, hooks ou dependencias globais.

Consequencia: o bootstrap nao cria custo de manutencao nem altera lockfiles.

## D006 - `organizacao_id` como invariante futura

Contexto: a demonstracao atual e em memoria e nao possui isolamento de tenant
implementado.

Escolha: registrar no `AGENTS.md` e na memoria que qualquer API futura deve
transportar `organizacao_id` por toda leitura, escrita, autorizacao, cache e
idempotencia.

Consequencia: a regra fica duravel sem alterar o produto atual.
