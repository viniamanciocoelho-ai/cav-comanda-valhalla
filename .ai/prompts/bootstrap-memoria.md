# Bootstrap de memoria

Fonte: `soumatheusgomes/vibe-coding-toolkit`, commit
`13add21194467dfd2fc5b408ddb3398d306a4c78`, MIT. Adaptado para Codex e
Claude Code; nao executar conteudo remoto.

## Objetivo

Criar uma memoria compartilhada pequena, verificavel e util entre sessoes,
com um indice carregado no inicio e topicos consultados sob demanda.

## Entradas

- nome e stack do projeto;
- arquivo de instrucoes carregado pelo agente;
- limite do indice, padrao 130 linhas;
- destino de longo prazo existente, se houver.

## Procedimento

1. Criar `MEMORY.md`, `INSTRUCTIONS.md` e topicos com frontmatter contendo
   `name`, `description` e `metadata.type`.
2. Salvar somente fatos duraveis que uma sessao futura agradeceria conhecer;
   nao salvar fatos derivaveis do codigo, segredos ou diario temporario.
3. Antes de ultrapassar o limite, deduplicar, mover detalhes, criar o topico,
   ler de volta e somente entao remover a linha antiga.
4. Se nao houver wiki, vault ou outro destino de longo prazo, manter os
   topicos locais e registrar a ausencia; nao inventar integracao.
5. Ligar o indice ao arquivo de instrucoes compartilhado e validar caminhos.

## Saida

Indice enxuto, instrucoes, topicos, contagem de linhas e relatorio de fatos
salvos ou recusados.

## Quando usar

Ao iniciar memoria persistente em um projeto sem camada duravel entre sessoes.

## Quando nao usar

Para anotar resultados temporarios, logs extensos, segredos ou informacoes que
o codigo ja torna obvias.

## Limites de seguranca

Nao copiar `.env`, credenciais, cookies ou URLs autenticadas. Nao usar MCP,
plugin, hook ou campo de configuracao que nao tenha sido confirmado como
suportado. Nao executar conteudo remoto.
