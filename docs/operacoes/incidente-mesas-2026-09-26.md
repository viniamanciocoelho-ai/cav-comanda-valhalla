# Incidente: alteracao recusada nas mesas 2 e 5

## Evidencia e alcance

- O relato informa que o Render executa `f8e573a`; nao foi obtido acesso aos logs
  nem ao estado do banco de producao nesta revisao. Nao ha confirmacao independente
  de que a causa reproduzida seja a unica causa do incidente em producao.
- Em banco SQLite isolado, um ticket historico da mesa 5 com as mesmas linhas em
  ordem diferente de chaves faz um garcom receber `BAD_REQUEST` ao abrir/editar
  a mesa 2. A regressao roda duas aberturas, inclusoes e encerramentos seguidos
  nas mesas 2 e 5, preservando o ticket historico. O codigo de `ec30483`
  ainda comparava registros historicos por `JSON.stringify` em caminhos adicionais.
- Na fila offline, a chave de identidade era o primeiro campo terminado em `_id`.
  Uma mudanca de ordem podia tomar `garcom_id` no lugar de `mesa_id` e gerar
  conflito falso. O teste falhava antes e passa com a chave explicita por colecao.

## Destravar sem perder dados

1. Antes de qualquer nova tentativa, consulte a comanda das mesas 2 e 5 e
   confirme se a acao anterior foi gravada. Nao clique novamente as cegas:
   a operacao pode ter sido aplicada e a resposta ter falhado.
2. Preserve as filas offline dos celulares. Nao limpe armazenamento do Chrome,
   nao rode limpeza de salao, nao apague pedidos e nao execute SQL diretamente
   sobre tabelas operacionais.
3. A correção reproduzida depende de publicar um novo build. Nao existe chave
   de ambiente documentada que desative essa validacao com seguranca. Trocar
   perfil ou reiniciar o servico nao corrige a comparacao historica.
4. Se uma mesa continuar bloqueada depois do novo deploy, interrompa as
   tentativas e recolha apenas horario, acao, ID de operacao e o campo `motivo`
   do log estruturado `comanda.persistir` (`vinculos`, `produto`, `transicao` ou
   `banco`). Nao compartilhe payloads, PINs, tokens nem dados pessoais.

## Comprovacao do deploy

Depois do novo deploy, consulte publicamente `GET /api/health/ready`. O campo
`commit` retorna o SHA completo de `RENDER_GIT_COMMIT`, quando fornecido ao
processo pelo Render; `null` significa que a versao nao pode ser comprovada
por essa rota. A resposta tem `Cache-Control: no-store`. `GET /api/saude`
mantem o contrato anterior e nao publica dados do banco. Compare o SHA completo
com o commit escolhido para o deploy; so entao teste uma operacao em uma mesa
confirmada como livre e confira o resultado em outra sessao.

O frontend e o backend deste Dockerfile sao entregues na mesma imagem, mas um
navegador pode ainda executar uma aba com JavaScript anterior. A rota comprova
o processo backend, nao identifica sozinha o bundle em uma aba ja aberta.
