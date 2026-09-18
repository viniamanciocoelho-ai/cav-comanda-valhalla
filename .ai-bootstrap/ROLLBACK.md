# Rollback do bootstrap

Este bootstrap criou somente arquivos de governanca. Nao houve arquivo
preexistente para restaurar e nenhum arquivo de aplicacao foi alterado.

## Antes de remover

1. Rode `git status --short` se a pasta estiver dentro de um repositorio Git.
2. Preserve manualmente qualquer edicao feita depois de 14 de setembro de
   2026 nos caminhos abaixo.
3. Nao remova `.env`, caches, dependencias ou arquivos do produto.

## Arquivos criados

- `AGENTS.md`
- `.ai/`
- `.ai-bootstrap/`

## Remocao segura

A partir da raiz do projeto, remova somente os tres caminhos acima depois de
confirmar que nao contem mudancas posteriores:

```powershell
$root = (Get-Location).Path
$paths = @(
  (Join-Path $root 'AGENTS.md'),
  (Join-Path $root '.ai'),
  (Join-Path $root '.ai-bootstrap')
)
foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}
```

Se `AGENTS.md`, `.ai` ou `.ai-bootstrap` tiverem sido adotados e mesclados
com conteudo novo, restaure manualmente apenas os trechos deste bootstrap e
nao use a remocao integral.
