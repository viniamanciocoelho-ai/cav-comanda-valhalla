---
name: architecture
description: Estrutura duravel do monorepo CAV Comanda e fronteiras entre demonstracao web, mobile e desktop.
metadata:
  type: architecture
---

# Arquitetura

- A demonstracao web usa React 19, TypeScript, Vite e wouter.
- O estado de mesas, pessoas, itens, fichas e fechamentos vive no provedor
  central em `packages/web/src/web/components/comanda-provider.tsx`.
- A demonstracao nao persiste dados e nao deve ser descrita como backend,
  autenticacao, pagamento ou emissao fiscal real.
- O desktop copia o build web para `packages/desktop/web-dist` e precisa manter
  caminhos relativos quando executado por `file://`.
- Qualquer futura persistencia deve tornar `organizacao_id` explicito em cada
  procedure, consulta, mutacao, cache e chave de idempotencia.
