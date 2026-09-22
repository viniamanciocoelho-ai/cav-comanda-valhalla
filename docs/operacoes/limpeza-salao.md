# Limpeza administrativa do salao

Esta rotina prepara o salao para o uso real removendo apenas os atendimentos
operacionais vinculados às mesas e balcões informados. Ela não exclui cadastro
de mesa ou balcao.

**Importante:** a rotina foi preparada e testada. A limpeza no banco do cliente
não foi executada por este trabalho.

## Escopo real

O projeto não possui uma tabela separada de salões. O alvo é identificado por:

- `organizacao_id`;
- lista explícita de `mesa_id`;
- lista explícita de `balcao_id`.

A lista deve representar o salao que o Quintino conferiu no banco. IDs
ausentes, organização inexistente ou seleção vazia interrompem a operação.

São removidos os registros vinculados aos atendimentos encontrados até o marco:
itens, pessoas, fichas de produção, fechamentos, itens de fechamento,
cancelamentos autorizados, encerramentos sem consumo e fila de impressão.
Mesas e balcões selecionados são liberados e continuam cadastrados.

São preservados usuários, PINs, sessões, cardápio, produtos, configurações,
impressoras, auditoria existente, demais mesas/balcões e outras organizações.

## Pré-requisitos

1. Usar o mesmo commit da branch `feat/limpeza-operacional-salao`.
2. Executar na raiz do repositório, com Bun `1.3.14`.
3. Configurar `DATABASE_URL` e, quando o banco for remoto, `DATABASE_AUTH_TOKEN`
   no ambiente do processo. Nunca coloque valores no comando, shell history ou
   Git.
4. Obter os IDs da organização, mesas, balcões e de um funcionário ativo com
   perfil `gerencia`.
5. Suspender novas operações, fechar a aplicação nas estações e aguardar filas
   de impressão. O script não consegue apagar filas offline guardadas no
   navegador de uma aba que continue aberta.

Não é necessária migration estrutural. Não é necessário publicar uma nova
versão da aplicação para executar o script administrativo, desde que o commit
do script esteja disponível no diretório.

## Simulação

Use um marco explícito em UTC. O modo padrão é simulação e não altera o banco:

```sh
bun --env-file=.env packages/web/scripts/limpar-operacao.ts \
  --organizacao=CODIGO_DA_ORGANIZACAO \
  --mesas=1,2,3,4,5,6,7,8 \
  --balcoes=1,2,3,4 \
  --marco=2026-09-22T23:59:59.000Z
```

O JSON mostra ambiente, organização, seleção, marco, versão operacional,
atendimentos encontrados, contagens por entidade, dados preservados e o valor
`confirmacao`. Revise especialmente as contagens e o marco. Não use uma
confirmação copiada de outra simulação.

Se houver dados posteriores ao marco nas mesas/balcões selecionados, a
simulação para. Escolha um marco anterior ao novo uso ou aguarde o atendimento
ser encerrado e gere uma nova simulação.

## Backup e execução

Use um diretório privado fora do repositório e com acesso restrito. O script
gera um backup JSON completo do banco, valida sua estrutura relendo o arquivo e
somente então inicia a transação de limpeza:

```sh
bun --env-file=.env packages/web/scripts/limpar-operacao.ts \
  --organizacao=CODIGO_DA_ORGANIZACAO \
  --mesas=1,2,3,4,5,6,7,8 \
  --balcoes=1,2,3,4 \
  --marco=2026-09-22T23:59:59.000Z \
  --executar \
  --responsavel=ID_DO_GERENTE \
  --backup-dir=C:/caminho-privado/backups \
  --confirmar=CONFIRMACAO_EXATA_DA_SIMULACAO
```

O código de confirmação incorpora organização, versão, marco e seleção.
Durante o backup o plano é revalidado. A execução usa transação de escrita,
compare-and-swap da versão operacional e rollback em erro. A auditoria registra
responsável, seleção, marco/versão e momento.

O resultado informa `backupArquivo`, `auditoriaId` e as contagens. Guarde o
arquivo de backup e não o envie ao GitHub, chat ou diretório público. O backup
contém dados sensíveis, incluindo hashes de PIN e sessões.

## Verificação posterior

1. Rode novamente o comando sem `--executar`; as contagens operacionais devem
   estar zeradas e a confirmação refletirá a nova versão.
2. Consulte a aplicação com uma nova sessão ou recarregue as telas abertas.
3. Confirme que as mesas e balcões continuam cadastrados e aparecem livres.
4. Confirme que cozinha, fila de impressão e sincronização não têm tarefas
   executáveis dos atendimentos removidos.
5. Abra uma nova mesa/balcão, lance um item sintético e confirme que ele pode
   ser enviado e fechado normalmente.
6. Remova somente as chaves offline da organização em abas antigas, se ainda
   existirem operações pendentes. Não use `localStorage.clear()` nem apague
   dados de outras organizações.

## Restauração e conflitos

Reverter o commit não recupera dados apagados. Para recuperar dados, use o
backup criado antes da limpeza em um banco isolado primeiro:

```sh
bun --env-file=.env packages/web/scripts/restore.ts \
  --arquivo=C:/caminho-privado/backups/cav-comanda-ARQUIVO.json \
  --confirmar=CODIGO_DA_ORGANIZACAO
```

O restore existente é integral para as organizações confirmadas e não deve ser
executado diretamente sobre produção sem análise. Se já houver operações novas,
não sobrescreva o banco: exporte o backup e o estado atual, compare as tabelas
por organização/atendimento e faça restauração seletiva em procedimento separado.
O script de limpeza não aciona cobranças, estornos, impressões físicas ou
notificações externas.
