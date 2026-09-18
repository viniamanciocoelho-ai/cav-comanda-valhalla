---
name: decisions
description: Decisoes de governanca e seguranca que devem continuar validas em sessoes futuras.
metadata:
  type: feedback
---

# Decisoes

- A camada compartilhada e `AGENTS.md` + `.ai/memory/`; nao criar uma copia
  paralela de `CLAUDE.md`.
- Nao adicionar configuracao especifica do Codex sem confirmar o campo na
  versao instalada e sem necessidade comprovada.
- Nao instalar MCP, plugins, hooks, ESLint ou Graphify apenas por conveniencia.
- A configuracao de OpenRouter, se encontrada no ambiente, e preservada
  integralmente e nunca deve ser impressa.
- Mudancas de governanca devem ser locais, reversiveis, sem producao e sem
  alterar a logica do produto.
