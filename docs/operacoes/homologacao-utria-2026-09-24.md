# Roteiro de homologacao para a Utria

## Versao

- Projeto: CAV Comanda Valhalla
- Branch: `feat/persistencia-notinha-pin-cardapio`
- Base de codigo: `ef718342411a65224f08023b7e17edef944f9516`
- Ajuste de teste: `359192f600153ad88a22bc4f9caf1117705d1884`
- Commit final a homologar: HEAD da branch entregue, obtido com
  `git rev-parse HEAD`; os commits posteriores a base nao alteram o aplicativo.
- Ambiente: homologacao isolada, com banco e integracoes de teste
- Endereco: preencher somente com a URL de homologacao realmente fornecida
  pelo responsavel. Nao usar uma URL inventada nem o banco do cliente.
- Disponibilidade externa: ainda nao verificada; a Utria nao consegue testar
  somente com o servidor local deste checkout.

## Preparacao

1. Confirmar no Render ou ambiente de homologacao o SHA final da branch antes
   de testar; nao selecionar o SHA da base por engano.
2. Confirmar que `NODE_ENV=production` e que as variaveis apontam para banco,
   armazenamento e integracoes de teste.
3. Usar uma organizacao de teste separada, sem dados de clientes.
4. Provisionar quatro contas de teste, uma por perfil: gerencia, garcom,
   producao e caixa. Os PINs devem ser entregues fora do Git e nunca copiados
   para o relatorio.
5. No Chrome Android, recarregar o HTML do mesmo deploy antes do primeiro caso.
6. Registrar horario e fuso, perfil, organizacao de teste, SHA e evidencia.

## Fluxo principal

### Login e sessao

Pre-condicao: contas de teste ativas.

1. Entrar com cada perfil.
2. Recarregar a pagina.
3. Bloquear/sair e entrar novamente.
4. Repetir com storage local indisponivel apenas no ambiente de teste.

Esperado: a tela de PIN e a tela principal aparecem sem tela preta ou erro no
console; cada perfil recebe apenas suas rotas; sair remove a sessao local e
retorna ao PIN.

### Mesa e persistencia

1. Gerencia abre a Mesa 08 sem cadastrar pessoa.
2. Garcom consulta as mesas abertas em outra sessao.
3. Garcom adiciona item compartilhado, altera quantidade e observacao.
4. Envia o pedido uma vez e depois recarrega.
5. Confirma a mesma comanda em uma segunda sessao.

Esperado: a mesa aparece para a organizacao correta, o item sobrevive ao reload,
existe uma unica linha/ficha e a autoria do item fica registrada.

### Concorrencia e falha de rede

1. Abra duas sessoes independentes na mesma mesa de teste.
2. Faca alteracoes diferentes em cada sessao.
3. Em ambiente local isolado, execute
   `bun x playwright test e2e/login-producao.spec.cjs --workers=1`. A suite
   intercepta a rota de escrita para simular separadamente resposta perdida
   depois da gravacao e falha antes da gravacao.
4. Na homologacao externa, marque esses dois casos como bloqueados se nao houver
   o mesmo harness isolado. Nao provoque falhas em pedidos reais.
5. Nao clique novamente em uma operacao marcada como aguardando confirmacao;
   consulte primeiro o estado persistido.

Esperado: alteracoes independentes sao preservadas; conflito fica explicito;
resposta perdida nao duplica item, pedido, ficha ou impressao; falha antes da
gravacao nao e apresentada como confirmada.

### Producao e entrega

1. Produzir e entregar o item com o perfil apropriado.
2. Confirmar a fila do garcom e a retirada.
3. Tentar acessar uma acao de producao com o perfil caixa e vice-versa.

Esperado: RBAC e aplicado no servidor, e a interface nao e a unica barreira.

### Caixa e fechamento

Executar tres atendimentos de teste:

1. Mesa sem nenhum nome.
2. Mesa com todos os nomes.
3. Mesa com nomes misturados e item compartilhado.

Esperado: fechamento, resumo, rateio e recibo fecham exatamente em centavos;
nomes ausentes recebem identificacao generica sem alterar o total.

### Isolamento entre organizacoes

1. Solicitar ao responsavel uma segunda organizacao preparada em banco isolado
   com fixture de teste; nao existe cadastro de organizacao nessa interface.
2. Criar mesa, produto e funcionario em cada tenant.
3. Consultar, alterar e imprimir usando sessoes cruzadas.

Esperado: nenhuma mesa, pessoa, item, funcionario, fila, relatorio ou
configuracao atravessa `organizacao_id`; tentativas indevidas retornam erro.

### Impressao

1. Validar geracao do recibo e fila sem impressora fisica.
2. No Chrome Android, testar a impressora BLE ESC/POS de 58 mm real.
3. Interromper e reconectar o dispositivo.
4. Testar RawBT somente se o modelo nao expuser uma caracteristica gravavel.

Esperado: conteudo, largura, acentuacao, quantidade e total sao legiveis. A
impressao fisica deve ser marcada como aprovada somente apos teste real.

## Evidencias obrigatorias

- SHA exibido no ambiente.
- URL e horario do ambiente de homologacao.
- Perfil usado em cada caso.
- Screenshot sem PIN, token ou dados pessoais.
- Console sem `pageerror` e sem erro de rede inesperado.
- Estado antes/depois da operacao usando IDs anonimizados.
- Resultado da fila de producao/impressao.
- Resultado do fechamento em centavos.
- Modelo e resultado da impressora fisica, quando aplicavel.

## Limpeza

Usar somente a rotina controlada do ambiente de teste ou apagar os dados pela
administracao da organizacao de teste. Nao executar limpeza no cliente
Valhalla. Nao usar `localStorage.clear()`, nao apagar a fila offline de outras
organizacoes e nao reutilizar o banco de homologacao para producao.

## Modelo de incidente

```text
ID:
Ambiente e URL:
SHA:
Data, hora e fuso:
Organizacao de teste:
Perfil:
Fluxo:
Passos:
Esperado:
Observado:
Frequencia:
Impacto:
Status HTTP/codigo sanitizado:
operacaoId, se houver:
Evidencias sem dados sensiveis:
Classificacao: bug | sugestao | teste bloqueado
```
