---
name: workflow
description: Rotina verificavel para alterar o projeto com baixo consumo e baixo risco.
metadata:
  type: reference
---

# Fluxo

- Buscar com `rg` e ler somente trechos necessarios antes de editar.
- Fazer plano curto antes de mudancas extensas e anexar uma verificacao a cada
  etapa.
- Executar serialmente por padrao; paralelizar somente arquivos disjuntos e
  tarefas independentes.
- Rodar typecheck, build e testes diretamente relacionados ao risco; revisar o
  diff e procurar segredos antes de concluir.
- Registrar aprendizados duraveis no indice e nos topicos, sem transformar a
  memoria em diario de sessao.
