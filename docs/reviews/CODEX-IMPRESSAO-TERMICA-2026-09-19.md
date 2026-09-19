# Revisão Codex — Impressão térmica operacional

Data: 19 de setembro de 2026

## Escopo

Implementação do prompt `PROMPT-CODEX-01-impressao-termica.md` na branch
`feat/persistencia-notinha-pin-cardapio`, sem merge, deploy ou alteração da `main`.

Base recebida: `7382630`
Commit de implementação: `1c485ff` — `feat: adicionar impressao termica operacional`

## Entrega

- Criada a migration `packages/web/drizzle/0003_certain_lila_cheney.sql`, sem alterar as migrations `0000`, `0001` ou `0002`.
- Adicionadas as tabelas por organização `impressoras` e `fila_impressoes`, com chaves, índices e unicidade por tipo/referência.
- Criada a configuração independente para `bar`, `cozinha` e `caixa`, com nome, host, porta, largura, ativo/inativo e teste.
- Implementado envio ESC/POS pelo servidor Hono/Bun via TCP para a porta configurada, com timeout de 3 segundos e comando de corte.
- O layout existente de recibo foi preservado e reutilizado. A ficha de produção usa o mesmo módulo de layout; a serialização ESC/POS fica ao lado dele.
- O pedido e o fechamento são gravados primeiro. A fila de impressão é criada na mesma transação e processada depois, sem bloquear nem invalidar a operação.
- Falhas ficam marcadas como `falhou`, com tentativas e erro resumido; a tela exibe aviso não bloqueante.
- Sem impressora de rede ativa, o item fica disponível para fallback no navegador com CSS térmico.
- Adicionados botões de reimpressão de ficha na produção e de recibo nos fechamentos.
- Reimpressões respeitam o RBAC: produção reimprime bar/cozinha; caixa reimprime caixa; gerência pode operar todos os destinos.
- A configuração e a fila permanecem isoladas por `organizacao_id`.

## Testes obrigatórios

| Validação | Resultado |
|---|---|
| `bun run typecheck` | PASSOU |
| `bun run build` | PASSOU para web e desktop |
| `cd packages/web && bunx drizzle-kit check` | PASSOU |
| Todas as suítes `bun --env-file=.env e2e/<arquivo>.ts` | PASSARAM |
| `e2e/impressao.ts` | PASSOU |
| `bunx oxlint . --deny-warnings --no-error-on-unmatched-pattern` | PASSOU |
| `bunx konsistent check --config-package @runablehq/runkit` | PASSOU, somente avisos de depreciação da configuração |
| `git diff --check` | PASSOU |
| Scan de segredos e PII | LIMPO |
| Scan de arquivos maiores que 50 MB | LIMPO |
| Scan de textos removidos no código web | LIMPO |

A nova suíte cobre:

- conteúdo da ficha, mesa, destino e comando de corte nos bytes ESC/POS;
- separação de itens bar/cozinha;
- falha de conexão sem perda do pedido;
- fila marcada para reimpressão;
- reimpressão manual pelo fallback do navegador;
- geração automática de fila para o recibo do caixa;
- rejeição de host vazio quando ativo e porta inválida.

## Limitação conhecida

O comando oficial `bun run lint` não conclui no Windows porque o wrapper `runkit`
falha em `uv_spawn` (`EFTYPE: inappropriate file type or format`). A análise direta
do Oxlint e do Konsistent passou. Nenhum arquivo protegido com prefixo `__` foi
alterado para contornar essa limitação.

Não houve impressora física disponível neste ambiente para homologar a saída de
papel. Foi validada a serialização, o corte, o timeout, o caminho de falha TCP e
o fallback do navegador. A configuração dos IPs/hosts reais ainda precisa ser
preenchida pela gerência na tela de configuração.

## Segurança e operação

- Nenhuma migration remota foi executada.
- Nenhum banco de produção foi alterado.
- Nenhum deploy ou merge foi realizado.
- A `main` permanece intacta.
- Não foram adicionados segredos, tokens, chaves, dados pessoais ou dados de clientes.
- O tráfego ESC/POS sobre TCP 9100 é o protocolo operacional esperado pela impressora
  configurada; a rede local deve ser controlada pelo ambiente de infraestrutura.

## Estado final

O código está pronto para homologação com as três impressoras reais do Valhalla.
A aprovação final de produção permanece condicionada ao teste físico de impressão
no bar, na cozinha e no caixa.
