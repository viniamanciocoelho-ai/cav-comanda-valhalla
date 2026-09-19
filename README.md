# CAV Comanda | Valhalla

Sistema de comandas **por mesa e por pessoa** para a
**Valhalla Choperia** (Três Lagoas/MS). A Fase 1 adiciona API Hono/oRPC, persistência Drizzle/libSQL,
sessão por PIN, RBAC e isolamento por `organizacao_id`.

Versão **Fase 1 — persistência, PIN e notinha**: o garçom registra o pedido pelo celular escolhendo
mesa e pessoa, a cozinha e o bar recebem a ficha, o gerente acompanha o salão e o caixa divide e encerra a
conta. O estado é compartilhado entre telas e persistido no banco.

Roda no navegador, em celular, tablet ou computador. Pagamento integrado e emissão fiscal continuam fora desta
fase. O banco inicia com o cardápio operacional e mesas livres, sem dados de atendimento.

## Executar

```bash
bun install
bun run dev
```

Abra `http://localhost:4200`. As fontes estão dentro do projeto para manter a interface disponível sem internet.

Outros comandos: `bun run build:web` (produção), `bun run lint`, `bun run start` / `bun run stop`.

Validações principais: `bun e2e/monetario.ts`, `bun e2e/security-regressao.ts`,
`bun e2e/tenant-isolation.ts`, `bun e2e/fase1-api.ts`, `bun e2e/bootstrap-seguro.ts`,
`bun e2e/limpeza-operacional.ts`, `bun e2e/recibo.ts` e `bun e2e/sem-consumo.ts`.

## Perfis

Cada funcionário entra com PIN de quatro dígitos. O backend vincula a sessão ao perfil e aplica as permissões
também nas gravações, não apenas na navegação.

| Perfil | Abre em | Enxerga | Não faz |
|--------|---------|---------|---------|
| Gerência | Salão | tudo: salão, valores, produção, caixa, fechamentos, configuração | — |
| Garçom | Mesas do turno | mesas do turno, comanda, lançamento, entrega | faturamento, configuração, caixa, NFC-e |
| Cozinha e bar | Produção | fichas por destino, sem valores | cardápio, configuração |
| Caixa | Fila de fechamento | divisão por pessoa, taxa de serviço, notinha simples | lançar item, configuração |

## Telas

| Rota | Tela | O que mostra |
|------|------|--------------|
| `/` | Salão | Mesas configuradas com estado (livre, ocupada, aguardando conta) e indicadores do turno. |
| `/garcom` | Mesas do turno | A visão do garçom no celular: as mesas dele, estado e total de cada uma. |
| `/mesa/:id` | Comanda | Pessoas da mesa, itens individuais e compartilhados, autor e hora de cada item, envio do pedido, entrega, pedido de cancelamento, solicitação de fechamento e **encerramento sem consumo** quando a mesa está vazia. |
| `/producao` | Cozinha e bar | Fichas separadas por destino, com mesa, pessoa, garçom, observação e avanço de estado. |
| `/caixa` | Caixa | Fila das mesas que pediram a conta, divisão por pessoa, taxa de serviço e impressão da notinha. |
| `/fechamentos` | Contas fechadas | Histórico persistido, com a divisão de cada pessoa, autoria do caixa e auditoria das **mesas liberadas sem consumo**. |
| `/configuracao` | Ajustes | Mesas, cardápio, equipe, PIN pessoal e preferências de tela. |

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
6. **Navegação mobile estável** — a barra inferior respeita `safe-area-inset-bottom` sem cobrir ações.
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

## Limitações conhecidas

- **O PIN de bootstrap da gerência deve ser definido no ambiente** em `CAV_BOOTSTRAP_PIN_GERENCIA` e não pode
  ser sequencial ou repetido.
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

## Documentação

- [`Beck/README.md`](./Beck/README.md) — mapa do backend, persistência e invariantes de segurança.
- [`Front/README.md`](./Front/README.md) — mapa do frontend e limites para refinamento visual.
- [`design.md`](./design.md) — briefing visual canônico usado pelo Runable.
- [`docs/reviews/CODEX-AUDITORIA-PROFUNDA-VALHALLA-2026-09-18.md`](./docs/reviews/CODEX-AUDITORIA-PROFUNDA-VALHALLA-2026-09-18.md) — auditoria técnica consolidada.
- `e2e/monetario.ts` — casos monetários, invariantes e varredura exaustiva (`bun`).
- `e2e/security-regressao.ts`, `e2e/tenant-isolation.ts` — autorização, integridade e isolamento.
- `e2e/sem-consumo.ts` — matriz de permissão e bloqueio da regra de encerramento sem consumo (`bun`).
- `e2e/aceite.py`, `e2e/sem-consumo.py`, `e2e/flow.py`, `e2e/roteiro.py` — suítes históricas de navegador;
  requerem atualização para autenticar por PIN.
- `e2e/shots/`, `docs/screenshots/` — capturas.

## Estrutura

```
Beck/                       mapa e limites do backend
Front/                      mapa e limites do frontend
packages/web/src/api/       Hono, oRPC, Drizzle, autenticação e persistência
packages/web/src/web/
  pages/          Salão, Garçom, Comanda, Cozinha e bar, Caixa, Fechamentos, Configuração
  components/     app-shell, provedor de estado, cardápio e divisão da conta
  lib/            tipos, operação, perfis, rateio e formatação
  styles.css      tokens de cor, materiais, animações
  fonts.css       fontes auto-hospedadas (Oswald, Manrope, Cinzel)
public/fonts/     arquivos .woff2
```

O monorepo também traz os pacotes `mobile` (Expo) e `desktop` (Electron) do template. Eles não foram usados
no fluxo web atual.
