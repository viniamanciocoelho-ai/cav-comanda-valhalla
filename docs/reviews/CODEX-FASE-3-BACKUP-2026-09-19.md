# Fase 3 - Backup automático do banco

Data: 2026-09-19

## Realizado

- Exportação integral das 14 tabelas de aplicação para JSON datado.
- Relação explícita das organizações incluídas e preservação de `organizacao_id` em todos os registros.
- Cópia local validada antes do envio externo.
- Envio para S3 compatível com endpoint customizado.
- Código de saída diferente de zero quando o S3 falha, sem apagar o arquivo local.
- Retenção local e remota, padrão 30, configurável por `CAV_BACKUP_RETENTION`.
- Restauração transacional de todas as tabelas.
- Confirmação obrigatória com a lista exata de organizações do arquivo.
- Verificação de formato, versão, data, tabelas e colunas antes de restaurar.
- Comandos `bun run backup` e `bun run restore`.
- Documentação de variáveis, execução manual, restauração, cron e verificação periódica.

## Decisão de formato

O arquivo é integral, não um arquivo independente por organização. Cada registro mantém seu
`organizacao_id` e o cabeçalho lista as organizações incluídas. Essa forma permite restaurar o
banco inteiro em uma transação e evita estados cruzados incompletos entre tabelas globais e
operacionais.

## Evidências e testes

- `e2e/backup.ts`
  - confirmou presença de todas as tabelas esperadas;
  - gravou, releu e validou o arquivo;
  - simulou falha de S3 e confirmou o arquivo local;
  - criou cinco arquivos e reteve somente os dois mais recentes;
  - bloqueou restauração sem confirmação;
  - removeu dados e restaurou organização e auditoria no banco temporário.
- `bun run typecheck`: aprovado nos pacotes web, desktop e mobile.
- `bun run build`: aprovado para web e desktop.
- `cd packages/web && bunx drizzle-kit check`: aprovado.
- Todos os arquivos `e2e/*.ts`: aprovados.
- `bunx oxlint . --deny-warnings --no-error-on-unmatched-pattern`: aprovado.
- `bunx konsistent check --config-package @runablehq/runkit`: aprovado, com avisos de depreciação da configuração externa.
- `git diff --check`: aprovado.

## Segurança

- Credenciais S3 não são gravadas no backup, logs ou documentação.
- Valores restaurados são enviados ao banco como argumentos parametrizados.
- Nomes de tabelas e colunas vêm de uma lista fixa no código.
- O diretório `backups/` foi incluído no `.gitignore`.
- O backup contém dados sensíveis operacionais, hashes de PIN e sessões; o acesso ao diretório e
  bucket deve ser restrito.

## Fora do escopo

- Scheduler dentro da aplicação.
- Criptografia adicional do arquivo além da proteção do disco e do bucket.
- Teste contra o bucket real, para não escrever nem apagar objetos externos durante a auditoria.

## Perguntas pendentes

- Nenhuma para a Fase 3.
