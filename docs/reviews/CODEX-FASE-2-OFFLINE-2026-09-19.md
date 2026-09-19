# Fase 2 - Operação offline do garçom

Data: 2026-09-19

## Realizado

- Fila local persistente por organização para abertura de mesa, alteração de comanda, envio de pedido e solicitação de fechamento.
- Persistência em `localStorage`, suficiente para o volume limitado de ações e snapshots deste cliente e disponível após recarregar ou fechar o navegador.
- Reenvio automático em ordem, com backoff exponencial limitado a 30 segundos.
- Falha de rede mantém a ação na fila.
- Rejeição de regra de negócio remove a ação e registra aviso com os itens ou mesas envolvidos.
- Conflito de versão busca o estado mais recente e reaplica somente as alterações locais compatíveis.
- Snapshot local do último estado, cardápio e configuração conhecidos.
- Restauração da última sessão conhecida sem permitir login novo sem servidor.
- Indicadores visíveis: `Sincronizado`, `Pendente` e `Sem conexão`.
- Totais em modo sem conexão usam exclusivamente o último estado confirmado pelo servidor.

## Evidências e testes

- `e2e/offline.ts`
  - fila sobrevive à recriação do armazenamento;
  - backoff cresce e respeita o limite;
  - falha de rede é distinguida de rejeição do servidor;
  - rebase preserva alteração remota independente;
  - conflito sobre a mesma entidade é detectado;
  - item somente local não entra no total durante indisponibilidade.
- `bun run typecheck`: aprovado nos pacotes web, desktop e mobile.
- `bun run build`: aprovado para web e desktop.
- `cd packages/web && bunx drizzle-kit check`: aprovado.
- Todos os arquivos `e2e/*.ts`: aprovados.
- `bunx oxlint . --deny-warnings --no-error-on-unmatched-pattern`: aprovado.
- `bunx konsistent check --config-package @runablehq/runkit`: aprovado, com avisos de depreciação da configuração externa.
- `git diff --check`: aprovado.
- Arquivos maiores que 50 MB: nenhum.
- `.env` detectados: somente raiz e pacote mobile; ambos ignorados pelo Git e não incluídos na alteração.

## Decisões

- O servidor permanece fonte da verdade.
- A fila offline não executa fechamento de conta, alteração da taxa de serviço, produção, cancelamento gerencial ou configuração.
- A tela pode mostrar itens pendentes para o garçom, mas os totais durante indisponibilidade vêm do snapshot confirmado.
- Conflito na mesma entidade não sobrescreve silenciosamente o servidor; vira falha visível para correção manual.

## Fora do escopo

- Login inicial sem conexão.
- Sincronização distribuída entre múltiplos navegadores sem passagem pelo servidor.
- Fechamento financeiro ou cálculo definitivo a partir de dados somente locais.

## Perguntas pendentes

- Nenhuma para a Fase 2.
