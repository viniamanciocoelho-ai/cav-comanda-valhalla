# CAV Comanda | Valhalla

Demonstração navegável de um sistema de comandas **por mesa e por pessoa**, feita para a reunião comercial com a
**Valhalla Choperia** (Três Lagoas/MS). A Fase 1 adiciona API Hono/oRPC, persistência Drizzle/libSQL,
sessão por PIN, RBAC e isolamento por `organizacao_id`.

Versão **Fase 1 — persistência, PIN e notinha**: o garçom registra o pedido pelo celular escolhendo
mesa e pessoa, a cozinha e o bar recebem a ficha, o gerente acompanha o salão e o caixa divide e encerra a
conta. O estado é compartilhado entre telas e persistido no banco.

Roda no navegador, em celular, tablet ou computador. Pagamento integrado e emissão fiscal continuam fora desta
fase. O modo demo é habilitado por `CAV_DEMO_MODE=true`; fora dele, o banco inicia sem dados fictícios.

## Executar

```bash
bun install
bun run dev
```

Abra `http://localhost:4200`. As fontes estão dentro do projeto, então a demonstração funciona sem internet.

Outros comandos: `bun run build:web` (produção), `bun run lint`, `bun run start` / `bun run stop`.

Validações atuais: `bun e2e/monetario.ts` (64), `bun e2e/security-regressao.ts` (16),
`bun e2e/tenant-isolation.ts`, `bun e2e/fase1-api.ts`, `bun e2e/recibo.ts` e
`bun e2e/demo-mode.ts`, `bun e2e/sem-consumo.ts`. As suítes Python históricas ainda dependem do fluxo
anterior sem login e precisam ser adaptadas ao acesso por PIN antes de voltar ao gate. Resultados em
[`TEST_REPORT.md`](./TEST_REPORT.md).

## Perfis

Cada funcionário entra com PIN de quatro dígitos. O backend vincula a sessão ao perfil e aplica as permissões
também nas gravações, não apenas na navegação.

| Perfil | Abre em | Enxerga | Não faz |
|--------|---------|---------|---------|
| Gerência | Salão | tudo: salão, valores, produção, caixa, fechamentos, configuração | — |
| Rafael (garçom) | Mesas do turno | mesas do turno, comanda, lançamento, entrega | faturamento, configuração, caixa, NFC-e |
| Cozinha e bar | Produção | fichas por destino, sem valores | cardápio, configuração |
| Caixa | Fila de fechamento | divisão por pessoa, taxa de serviço, notinha simples | lançar item, configuração |

## Telas

| Rota | Tela | O que mostra |
|------|------|--------------|
| `/` | Salão | Dez mesas com estado (livre, ocupada, aguardando conta) e indicadores do turno. |
| `/garcom` | Mesas do turno | A visão do garçom no celular: as mesas dele, estado e total de cada uma. |
| `/mesa/:id` | Comanda | Pessoas da mesa, itens individuais e compartilhados, autor e hora de cada item, envio do pedido, entrega, pedido de cancelamento, solicitação de fechamento e **encerramento sem consumo** quando a mesa está vazia. |
| `/producao` | Cozinha e bar | Fichas separadas por destino, com mesa, pessoa, garçom, observação e avanço de estado. |
| `/caixa` | Caixa | Fila das mesas que pediram a conta, divisão por pessoa, taxa de serviço e impressão da notinha. |
| `/fechamentos` | Contas fechadas | Histórico da sessão, com a divisão de cada pessoa, quem operou o caixa e qual garçom atendeu, e a auditoria das **mesas liberadas sem consumo**. |
| `/configuracao` | Ajustes | Pontos a confirmar no diagnóstico presencial, o que fica fora do piloto e o botão de reiniciar. |

Mesas **02, 06 e 08** já têm comanda aberta. As outras abrem em branco, para mostrar o início do atendimento.

## Roteiro da reunião

O painel lateral **Roteiro** traz os 14 passos em ordem. Ele avança à mão (Próximo / Anterior) e também marca
sozinho quando a ação acontece de verdade na tela. Dá para sair dele a qualquer momento: ele orienta, não bloqueia.

1. **Salão** — dez mesas e o estado de cada uma em uma tela.
2. **Trocar para Rafael (garçom)** — a tela muda para as mesas do turno dele.
3. **Mesa 08** — Fábio, Ana, Bruno e Carol na mesma mesa.
4. **Lançar para Ana** — escolher a pessoa antes do item é o ponto central da proposta.
5. **Lançar um compartilhado com observação** — "PORÇÃO MISTA", sem cebola.
6. **Revisar e enviar** — o garçom confere antes de mandar para a produção.
7. **Cozinha e bar** — a ficha chega separada por destino, com mesa, pessoa e garçom; avançar até "pronto".
8. **Entregar na mesa** — o garçom vê "pronto" e confirma a entrega.
9. **Pedir a conta** — a mesa entra na fila do caixa.
10. **Caixa** — divisão por pessoa, com a fração dos compartilhados; retirar e recolocar os 10% de serviço.
11. **Imprimir notinha** — mostrar o resumo sem valor fiscal em 58 ou 80 mm.
12. **Fechamentos** — o registro da conta, com o garçom que atendeu.
13. **Configuração** — usar a lista de pontos a confirmar como pauta das perguntas ao dono.
14. **Reiniciar demonstração** — disponível somente quando `CAV_DEMO_MODE=true`.

## Correções da V2.1

Sete correções pontuais aplicadas sobre a V2 no dia da apresentação, sem reescrever nada e sem mexer na
identidade visual:

1. **Data e hora dinâmicas** — do relógio do dispositivo, em `pt-BR`, com fuso local, atualizando sozinhas
   (`lib/hooks.ts` → `useAgora()`). Nenhum valor cravado.
2. **Permissão por perfil centralizada** — `components/guarda-rota.tsx` decide em um único lugar; rota
   bloqueada devolve à tela inicial do perfil, avisa "Esta área não está disponível para este perfil" e não
   apaga estado nem entra em laço.
3. **Navegação por perfil** — a barra só mostra os destinos que aquele perfil pode abrir.
4. **Divisão monetária exata** — `lib/rateio.ts` trabalha só com centavos inteiros, distribui sobras pelo
   maior resto com desempate estável; a soma das parcelas é sempre igual ao valor original.
5. **Duplo clique bloqueado** — `useAcaoUnica()` em Enviar pedido, Solicitar fechamento, Confirmar
   fechamento, Entreguei (por linha) e avanço de ficha.
6. **Selo "Made with Runable" sempre visível** — o espaçamento da barra inferior respeita o selo e o
   `safe-area-inset-bottom`; nada é escondido por CSS, JS ou sobreposição.
7. **Contadores consistentes** — todos derivam do mesmo estado central e mudam no mesmo instante.

## Encerramento de mesa sem consumo

Mesa aberta que não consumiu nada é liberada sem virar conta. Na comanda (`/mesa/:id`), quando o total é zero
e não existe item enviado, aparece a ação secundária **Encerrar sem consumo**.

- **Quem pode:** gerência em qualquer mesa vazia; garçom somente na mesa que ele abriu. Produção e caixa não
  executam e não veem a ação.
- **O que pede:** motivo obrigatório (clientes desistiram, não encontraram o que procuravam, mesa aberta por
  engano, troca de mesa, outro) e observação opcional.
- **O que NÃO gera:** fechamento, pagamento, NFC-e e ficha de produção. Nada de cobrança, nada de fiscal.
- **O que faz:** devolve a mesa para `livre`, limpa as pessoas da abertura, atualiza os contadores no mesmo
  instante e grava um registro de auditoria em `/fechamentos`, na seção "Mesas liberadas sem consumo".
- **Rascunho:** item lançado e nunca enviado é descartado, mas só depois de uma confirmação explícita; o
  descarte fica registrado na auditoria.
- **Mesa com item enviado, ficha na produção ou conta pedida:** a ação nem aparece — essa mesa segue pelo
  fluxo normal de fechamento.
- **Duplo clique:** travado duas vezes, no botão e por chave de abertura. Uma abertura não encerra duas vezes.
- **Desfazer:** 10 segundos na própria tela da mesa, válido enquanto nada mudou depois. O registro de
  auditoria permanece, marcado como desfeito.

Detalhes em [`MUDANCAS.md`](./MUDANCAS.md) e o aceite em [`TEST_REPORT.md`](./TEST_REPORT.md).

## Limitações conhecidas

- **Os quatro PINs de bootstrap devem ser definidos no ambiente.** Em desenvolvimento/testes, os padrões são
  `1111`, `2222`, `3333` e `4444`; em produção os quatro `CAV_BOOTSTRAP_PIN_*` são obrigatórios.
- **Frontend e API em origens diferentes exigem allowlist.** Defina `CAV_ALLOWED_ORIGINS` com origens
  completas separadas por vírgula. A própria origem é aceita automaticamente.
- **Não existe desconto no sistema.** A aritmética de valor negativo já é tratada em `ratear()`, mas o
  recurso em si não foi construído.
- **O "Desfazer" do encerramento sem consumo vive na memória da aba.** São 10 segundos, válidos enquanto
  nada mudou na mesa; recarregar a página descarta a janela. Em produção é reversão transacional no servidor.
- Pagamento integrado e emissão fiscal real continuam fora desta fase.

## Decisões de operação embutidas na V2

- **Cada um paga a sua parte.** A conta é sempre dividida por pessoa e cada um escolhe a forma na maquininha
  de hoje. A tela não finge integração com adquirente.
- **Taxa de serviço só no caixa.** Gerência e garçom veem o valor; incluir ou retirar os 10% é ação do caixa.
- **Cancelar item em produção exige autorização.** O garçom pede, a gerência autoriza ou recusa.
- **Envio à prova de duplo clique.** O botão trava e o provedor tem guarda de idempotência: item não duplica.
- **Autoria e hora em todo item.** A comanda e a ficha mostram quem lançou e quando.

## Avisos permanentes na interface

- **Dados sincronizados** — o estado operacional é persistido e isolado por organização.
- **Cardápio provisório** — os itens serão substituídos pelo cardápio real.
- **Integração fiscal prevista** — a NFC-e é simulação de interface.
- **Acesso por PIN** — cada funcionário tem PIN individual e permissões de perfil.
- **Brasão provisório** — o símbolo atual é marcador, não o logotipo final.

A lista completa está em [`PROVISORIO.md`](./PROVISORIO.md).

## Documentação

- [`ARCHITECTURE_HANDOFF.md`](./ARCHITECTURE_HANDOFF.md) — mapa do código, estado central, invariantes e o que vira servidor no piloto.
- [`TEST_REPORT.md`](./TEST_REPORT.md) — as quatro suítes, o aceite das sete correções, os 10 casos monetários, limitações declaradas.
- [`MUDANCAS.md`](./MUDANCAS.md) — o que mudou no protótipo original e o que a V2 e a V2.1 acrescentaram.
- [`PROVISORIO.md`](./PROVISORIO.md) — o que é provisório, o que não existe e o que confirmar no local.
- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — paleta, tipografia, materiais, componentes e proibições visuais.
- `e2e/monetario.ts` — casos monetários, invariantes e varredura exaustiva (`bun`).
- `e2e/security-regressao.ts`, `e2e/tenant-isolation.ts` — autorização, integridade e isolamento.
- `e2e/sem-consumo.ts` — matriz de permissão e bloqueio da regra de encerramento sem consumo (`bun`).
- `e2e/aceite.py`, `e2e/sem-consumo.py`, `e2e/flow.py`, `e2e/roteiro.py` — suítes históricas de navegador;
  requerem atualização para autenticar por PIN.
- `e2e/shots/`, `docs/screenshots/` — capturas.

## Estrutura

```
packages/web/src/web/
  pages/          Salão, Garçom, Comanda, Cozinha e bar, Caixa, Fechamentos, Configuração
  components/     app-shell, provedor de estado, cardápio, divisão da conta, painel do roteiro
  lib/            tipos, dados demonstrativos, perfis, roteiro, rateio, formatação
  styles.css      tokens de cor, materiais, animações
  fonts.css       fontes auto-hospedadas (Oswald, Manrope, Cinzel)
public/fonts/     arquivos .woff2
```

O monorepo também traz os pacotes `mobile` (Expo) e `desktop` (Electron) do template. Eles não foram usados
nesta demonstração; ela é web.
