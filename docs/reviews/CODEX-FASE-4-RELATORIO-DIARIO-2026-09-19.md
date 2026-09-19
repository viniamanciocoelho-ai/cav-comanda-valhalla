# Fase 4 - Relatório de fechamento diário

Data: 2026-09-19

## Realizado

- Nova tela `Fechamento diário`, disponível somente para gerência e caixa.
- Seleção de data com o dia operacional atual como padrão.
- Faturamento, mesas atendidas, ticket médio e taxa de serviço em centavos inteiros.
- Quebra de faturamento entre bar e cozinha com rateio exato do serviço.
- Produtos mais vendidos por quantidade e valor.
- Lista de fechamentos com mesa, hora, valor e operador.
- Lista de encerramentos sem consumo e seus motivos.
- Lista de cancelamentos autorizados com responsável.
- Impressão na térmica do caixa, reutilizando a camada de rede e ESC/POS da Fase 1.
- Fallback para impressão pelo navegador quando a impressora do caixa não está configurada.
- Estado claro para dia sem movimento.

## Persistência adicionada

- `itens_fechamento`: snapshot append-only dos itens existentes no momento do fechamento.
- `cancelamentos_autorizados`: item cancelado, valor, mesa, destino, data e gerente autorizador.
- Migração nova `0004_relatorio_diario.sql`; migrações `0000` a `0003` não foram alteradas.
- As novas tabelas foram incluídas no bootstrap e na rotina integral de backup/restauração.

## Evidências e testes

- `e2e/relatorio-diario.ts`
  - soma das quebras por destino igual ao faturamento;
  - ticket médio exato em centavos;
  - dia vazio retorna zeros e listas vazias;
  - garçom recebe `FORBIDDEN`;
  - cancelamento autorizado persiste autoria;
  - fechamento persiste somente o item remanescente;
  - consulta diária lê os dados persistidos;
  - impressão sem térmica configurada retorna o documento para o navegador.
- `bun run typecheck`: aprovado nos pacotes web, desktop e mobile.
- `bun run build`: aprovado para web e desktop.
- `cd packages/web && bunx drizzle-kit check`: aprovado com 16 tabelas.
- Todos os arquivos `e2e/*.ts`: aprovados, inclusive backup com as novas tabelas.
- `bunx oxlint . --deny-warnings --no-error-on-unmatched-pattern`: aprovado.
- `bunx konsistent check --config-package @runablehq/runkit`: aprovado, com avisos de depreciação da configuração externa.
- `git diff --check`: aprovado.

## Decisões

- Produtos usam o valor de consumo sem serviço.
- A quebra por destino inclui uma parcela do serviço rateada pelo peso do consumo de cada destino.
  Assim, a soma de bar e cozinha fecha exatamente com o faturamento total.
- Datas operacionais usam `America/Cuiaba` por padrão e podem ser substituídas por
  `CAV_TIMEZONE` no servidor.
- Registros históricos são append-only e isolados por `organizacao_id`.

## Fora do escopo

- Documento fiscal.
- Formas de pagamento e conciliação com maquininha.
- Estorno financeiro, que não existe no domínio atual e não foi inventado.

## Perguntas pendentes

- Nenhuma para a Fase 4.
