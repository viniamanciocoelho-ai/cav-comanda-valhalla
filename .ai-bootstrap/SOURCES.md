# Fontes auditadas

## Toolkit de referencia

- Projeto: `soumatheusgomes/vibe-coding-toolkit`
- URL: `https://github.com/soumatheusgomes/vibe-coding-toolkit`
- Commit utilizado: `13add21194467dfd2fc5b408ddb3398d306a4c78`
- Licenca verificada no arquivo `LICENSE`: MIT
- Data da auditoria: 14 de setembro de 2026
- Copia temporaria local: `work/vibe-coding-toolkit-audit`

O repositorio foi clonado, fixado no commit acima e inspecionado antes de
qualquer reutilizacao. Foram procurados downloads remotos, execucao de
processos, hooks, telemetria, credenciais, escrita externa e comandos
destrutivos. Os scripts do toolkit nao foram executados.

## Conteudo reutilizado

Somente os quatro fluxos aprovados foram adaptados para `.ai/prompts/`:

- `docs/prompts/03-multi-agent-code-review.md` ->
  `revisao-multilente.md`
- `docs/prompts/04-brainstorm-to-plan.md` ->
  `brainstorm-plano.md`
- `docs/prompts/05-parallel-wave-dispatch.md` ->
  `ondas-paralelas.md`
- `docs/prompts/06-memory-bootstrap.md` ->
  `bootstrap-memoria.md`

Os prompts locais preservam objetivo, entradas, saida, quando usar, limites de
seguranca e a proibicao de executar conteudo remoto, mas nao instalam plugins,
hooks ou ferramentas especificas do Claude Code.

## Fontes locais

- `package.json` e `packages/*/package.json`: scripts e runtimes declarados.
- `REVISAO-CODEX.md` e `TEST_REPORT.md`: resultados de validacao ja registrados.
- `.runable/protected-files.json`: hashes dos arquivos protegidos.
- Ajuda local do Codex `0.154.0-alpha.6.2`: opcoes reconhecidas e comandos
  disponiveis, sem criar configuracao adicional.
