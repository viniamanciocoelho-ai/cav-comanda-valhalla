# Impressao Bluetooth no Android

## Antes de imprimir

1. Carregue a impressora e coloque o papel de 58 mm.
2. Ligue a impressora. Ela pode desligar sozinha depois de 10 minutos sem uso.
3. No Android, ligue o Bluetooth e a localizacao.
4. Abra o Valhalla no Chrome pelo endereco HTTPS.

## Bluetooth direto

1. Entre com um perfil de gerencia.
2. Abra `Configuracao`.
3. Em `Impressora deste celular`, mantenha `Bluetooth direto (BLE)`.
4. Toque em `Conectar impressora`.
5. Escolha `KPrinter_xxxx` no seletor do Chrome.
6. Toque em `Teste de impressao`.

O Chrome precisa que `Conectar impressora` seja acionado por um toque. Se a
impressora desligar, ligue-a novamente e tente imprimir; o sistema tenta
reconectar uma vez.

## Bluetooth classico com RawBT

Se o diagnostico informar que nao existe canal BLE de escrita:

1. Instale o RawBT pela Play Store.
2. No RawBT, escolha a impressora `KPrinter_xxxx`.
3. No Valhalla, selecione `RawBT (Bluetooth classico)`.
4. Toque novamente em `Teste de impressao` ou no botao da notinha.

Quando uma impressao BLE falha, o Valhalla mantem a notinha e oferece
`Usar RawBT` sem precisar montar o pedido outra vez.

## Se nao imprimir

- Confirme que a impressora esta ligada e perto do celular.
- Desligue e ligue novamente Bluetooth e localizacao.
- Reabra o Chrome e use `Conectar impressora`.
- Teste outra pagina de codigo: PC850, PC858 ou WPC1252. O padrao e PC860.
- Abra `Diagnostico da impressora`, toque em `Copiar diagnostico` e envie o
  texto para o suporte.
- Use `Impressao do navegador` apenas como ultimo recurso.
