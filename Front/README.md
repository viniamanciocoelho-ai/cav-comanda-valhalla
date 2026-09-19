# Front

Entrada de referência para a interface do CAV Comanda Valhalla.

O código canônico continua em `packages/web/src/web` porque `index.html`, os
aliases do Vite e os arquivos protegidos do Runable dependem desse caminho. O
briefing visual permanece em `design.md`.

## Mapa

- `packages/web/src/web/pages/`: telas e rotas da aplicação.
- `packages/web/src/web/components/`: componentes e estado compartilhado.
- `packages/web/src/web/lib/`: tipos, cliente da API, formatação e rateio.
- `packages/web/src/web/styles.css`: tokens e estilos globais.
- `packages/web/public/`: fontes e recursos estáticos.

## Limites para edição visual

- Preserve os contratos existentes da API, RBAC e `organizacao_id`.
- Não simule sucesso quando uma operação do backend falhar.
- Não altere schema, migrations, autenticação ou cálculo financeiro durante
  refinamentos exclusivamente visuais.
- Mantenha responsividade, foco visível, contraste e controles acessíveis.
- Dados fictícios só podem aparecer quando o modo demo estiver ativo.

## Validação

Na raiz do repositório:

```bash
bun run typecheck
bun run build:web
```
