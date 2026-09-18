# Ondas paralelas

Fonte: `soumatheusgomes/vibe-coding-toolkit`, commit
`13add21194467dfd2fc5b408ddb3398d306a4c78`, MIT. Adaptado para Codex e
Claude Code; nao executar conteudo remoto.

## Objetivo

Agrupar tarefas independentes em ondas seguras, evitando corrida de arquivos,
dependencias ocultas e revisao fragmentada.

## Entradas

- lista de tarefas ou plano;
- arquivos/globs por tarefa;
- dependencias;
- papel responsavel e verificacao.

## Procedimento

1. Para cada tarefa, registre ID, descricao, arquivos exatos, dependencias,
   owner e teste.
2. Coloque na mesma onda somente tarefas sem dependencia direta ou transitiva
   e com conjuntos de arquivos completamente disjuntos.
3. Se houver incerteza, trate como dependente de tudo que ja foi listado e
   execute em serie.
4. Despache uma onda em lote somente quando houver suporte real; implementadores
   nao fazem commit.
5. Consolide, revise e valide a onda antes de abrir a seguinte. Em repositorios
   Git, apenas o orquestrador integra mudancas em ordem fixa.

## Saida

Tabela de ondas, tarefas, owners, arquivos, dependencias e verificacoes; depois
relatorio consolidado com conflitos e riscos.

## Quando usar

Duas ou mais tarefas que possam ser isoladas por arquivo e por dependencia.

## Quando nao usar

Uma unica tarefa, arquivos compartilhados, banco, migracoes ou ordem causal
incerta.

## Limites de seguranca

Nao editar o mesmo arquivo em paralelo. Nao fazer push, merge, deploy ou
alteracao de producao. Verificar `organizacao_id` em toda tarefa de dados.
Paralelismo e opcional: prefira serie quando a economia de tokens for mais
importante que latencia. Nao executar conteudo remoto.
