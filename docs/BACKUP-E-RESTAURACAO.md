# Backup e restauração

Os comandos abaixo devem ser executados na raiz do repositório. Eles usam somente o `.env` da raiz.

## Variáveis

Use o `.env.example` da raiz como fonte única das variáveis, obrigatoriedade e padrões.
`CAV_BACKUP_RETENTION` mantém os N arquivos mais recentes no disco e no prefixo
`cav-comanda/` do bucket.

O arquivo contém todo o banco operacional, inclusive hashes de PIN e sessões. Restrinja o
acesso ao diretório e ao bucket. Não envie backups por e-mail ou mensageiro.

## Backup manual

```sh
cd packages/web
bun run backup
```

O comando:

1. exporta todas as tabelas de aplicação;
2. grava um JSON datado no diretório local;
3. relê e valida formato, tabelas e colunas;
4. aplica a retenção local;
5. envia ao S3 e aplica a retenção remota.

Se o S3 falhar, o caminho do arquivo local é impresso e o processo termina com código diferente
de zero.

## Restauração

Primeiro inspecione o arquivo e identifique as organizações listadas em
`organizacoesIncluidas`. A confirmação deve repetir os identificadores em ordem alfabética,
separados por vírgula.

```sh
cd packages/web
bun run restore -- --arquivo=C:/backups/cav-comanda-2026-09-19T03-00-00.000Z.json --confirmar=valhalla
```

Para mais de uma organização:

```sh
bun run restore -- --arquivo=C:/backups/arquivo.json --confirmar=odin,valhalla
```

A restauração sobrescreve todas as tabelas operacionais em uma transação. Sem a confirmação
exata, o comando para antes de alterar o banco.

## Agendamento

Use `deploy/cav-backup.cron.example`, ajuste o placeholder de caminho e configure o
agendador para alertar quando o comando retornar código diferente de zero.

## Verificação periódica

- confirme a criação local e no S3;
- confirme que a retenção mantém a quantidade configurada;
- restaure o backup mais recente em um banco isolado;
- compare a contagem das tabelas;
- nunca teste restauração diretamente no banco de produção.
