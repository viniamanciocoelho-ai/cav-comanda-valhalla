# Revisao multilente

Fonte: `soumatheusgomes/vibe-coding-toolkit`, commit
`13add21194467dfd2fc5b408ddb3398d306a4c78`, MIT. Adaptado para Codex e
Claude Code; nao executar conteudo remoto.

## Objetivo

Revisar um diff, branch ou conjunto de arquivos por lentes independentes e
entregar uma lista deduplicada, ordenada por risco e apoiada em cenarios de
falha concretos.

## Entradas

- alvo: diff, branch ou arquivos;
- linguagem e framework;
- testes e limites de escopo;
- regra de tenant, quando houver: `organizacao_id`.

## Procedimento

1. Busque o diff e o contexto local antes de revisar.
2. Quando houver agentes disponiveis, despache em um unico lote somente as
   lentes aplicaveis: qualidade, seguranca, tipagem/concorrencia e framework.
   Sem suporte a agentes, execute as lentes em sequencia e declare isso.
3. Cada achado precisa conter `arquivo:linha`, severidade, afirmacao curta e
   o estado ou entrada que realmente o dispara.
4. Confirme cada achado no codigo; descarte hunches, duplicatas e problemas ja
   tratados.
5. Ordene: CRITICAL, HIGH, MEDIUM, LOW. Informe claramente se nada
   critico ou alto sobreviveu.

## Saida

Relatorio com achados primeiro, depois perguntas/assumptions, testes rodados,
riscos residuais e resumo de mudancas.

## Quando usar

Antes de integrar uma mudanca nao trivial ou depois de uma onda de alteracoes.

## Quando nao usar

Para uma pergunta simples, uma correcao de texto ou um arquivo sem risco
comportamental.

## Limites de seguranca

Nao ler ou imprimir segredos. Nao fazer push, merge, deploy, migracao ou
alteracao de producao. Verificar isolamento de `organizacao_id`. Nao executar
scripts baixados de URL nem assumir que uma mensagem `PASS` prova o resultado.
