# Revisão técnica Codex

Data: 13 de setembro de 2026

## Escopo

Revisão estática e validação de build do monorepo, com foco no aplicativo web executado pelo Runable e
checagem dos pacotes mobile e desktop do template.

## Correções aplicadas

- Guardas de permissão também na camada de estado para ações de garçom, produção, gerência e caixa.
- Rotas permitidas agora usam correspondência exata; prefixos parecidos não passam pela guarda.
- Fechamento bloqueado com rascunho, cancelamento pendente ou sem pessoas para dividir.
- Telas de mesa e caixa explicam corretamente quando um cancelamento pendente impede o fechamento.
- Fechamento limpa pessoas, garçom, itens, fichas e metadados da abertura encerrada.
- Cancelamento não pode ser pedido em item entregue e só a gerência autoriza ou recusa.
- Ficha remanescente é marcada como entregue quando todas as linhas restantes já foram entregues.
- Avanço e retorno de ficha têm trava central contra repetição instantânea.
- Desfazer de encerramento sem consumo expira também na regra central depois de 10 segundos.
- Reinício da demonstração limpa avisos, roteiro aberto, travas e sequência interna.
- Datas inválidas não quebram a renderização.
- Identificadores acessíveis de diálogo e brasão não se repetem no DOM.
- Alvo de toque para fechar avisos ampliado para 44 px.
- Bundle web dividido em chunks de React, dados e ícones.
- Referência inexistente de Open Graph removida.
- URL padrão do desktop alinhada à porta 4200 do Runable.
- Desktop empacota o build web e remove IPC de leitura/escrita arbitrária sem uso no produto.
- Desktop usa rotas por hash e caminhos relativos no modo `file://`, sem carregar analytics do Runable.
- Metadados mobile deixam de apontar para imagens ausentes e usam identificadores válidos.
- URL da API mobile é normalizada para evitar `//api/rpc`.

## Arquivos protegidos

Os 16 arquivos listados em `.runable/protected-files.json` permaneceram inalterados e com SHA-256 válido.

## Validações

- TypeScript web (`tsconfig.app.json`): aprovado.
- TypeScript web/runtime (`tsconfig.node.json`): aprovado.
- Build Vite de produção: aprovado.
- Testes monetários: aprovados.
- Testes da regra de encerramento sem consumo: aprovados.
- Testes adicionais de regressão fina: aprovados.
- TypeScript e build do pacote desktop: aprovados.
- Suítes de navegador: `flow.py` 63/63, `roteiro.py` 79/79, `aceite.py` 246/246 e
  `sem-consumo.py` 133/133, todas sem falhas.
- Sintaxe das suítes Python e configuração JSON do aplicativo mobile: aprovadas.

A validação `file://` foi feita em um navegador Chromium local. O binário nativo do Electron não estava disponível no ambiente, então o shell Electron foi validado por TypeScript e build, enquanto o bundle offline foi validado diretamente no navegador.
