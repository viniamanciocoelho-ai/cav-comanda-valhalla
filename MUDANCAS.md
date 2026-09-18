# Lista de mudanças em relação ao protótipo original

Origem: protótipo estático de três arquivos (`index.html`, `styles.css`, `app.js`), com fontes e ícones
carregados de CDN, navegação por troca de `display` e dados globais soltos no script.

Nada de fluxo foi removido. Tudo que o protótipo fazia continua fazendo, com a mesma linguagem operacional.

## Identidade visual

1. Paleta reconstruída a partir das capturas reais da Valhalla em `references/`: base quase preta, madeira
   escura, dourado envelhecido, bronze e laranja de chama. Antes: âmbar genérico sobre cinza neutro.
2. Tema claro refeito como pergaminho (papel envelhecido, tinta marrom escura), em vez de branco de painel.
3. Tipografia trocada: Cinzel apenas no lockup da marca, Oswald condensada em títulos e números, Manrope em
   toda a camada operacional. Antes: Satoshi e Boska, ambas de CDN.
4. Materiais em lugar de enfeite: grão de madeira, grão de filme em SVG, cantoneiras de metal e um divisor
   rúnico discreto. Sem nenhuma imagem de terceiro.
5. Brasão autoral em SVG (elmo, machados, fio circular), marcado como provisório na interface.
6. Números de mesa, totais e tempos em coluna tabular, com peso de cartaz — legíveis a distância no balcão.
7. Estados operacionais ganharam cor própria e rótulo escrito (livre, ocupada, aguardando conta, novo item,
   enviado, preparando, pronto). Antes o estado dependia mais da cor do que do texto.

## Proibições visuais aplicadas

8. Removidos o `backdrop-filter: blur(14px)` da barra superior e o halo de `box-shadow` colorido nos pontos de
   estado — os dois pontos de glassmorphism e brilho artificial do protótipo.
9. Removida a sombra difusa de 50 px (`0 18px 50px`) dos cartões: profundidade agora vem de borda e superfície.
10. Removido o gradiente diagonal do cartão em destaque da Mesa 08.
11. Raio máximo reduzido de 14 px para 12 px; 999 px ficou restrito aos chips de pessoa.
12. Removida a malha quadriculada de fundo da área principal, substituída por grão sutil.

## Estrutura e código

13. Migrado para o stack gerenciado da Runable: Bun, Vite, React e Tailwind v4, no monorepo do template.
    É o formato que permite publicar e evoluir o projeto depois da reunião.
14. Navegação por rotas reais (`/`, `/mesa/8`, `/producao`, `/fechamentos`, `/configuracao`) em vez de
    alternância de `display`. Cada tela tem endereço próprio, útil para abrir direto numa tela do salão.
15. Estado centralizado em um provedor React em memória (`comanda-provider.tsx`), com tipos de domínio
    declarados (`lib/types.ts`) e dados demonstrativos isolados (`lib/demo-data.ts`).
16. Fontes auto-hospedadas: 20 arquivos `.woff2` no projeto. A demonstração roda sem internet — a reunião não
    depende do wi-fi do estabelecimento.
17. Ícones desenhados como SVG local; a dependência de `unpkg.com/lucide` foi eliminada pelo mesmo motivo.
18. Diálogos passaram a usar `<dialog>` nativo, com `Esc`, foco contido e retorno de foco ao gatilho.

## Fluxos ampliados

19. A fila de produção virou tela própria, separada por cozinha e bar, com filtro "só em aberto" e avanço de
    estado por ficha (enviado → preparando → pronto), refletido de volta na comanda.
20. Fechamentos passou a registrar cada conta encerrada na sessão, com o rateio de cada pessoa, e tem estado
    vazio explicativo com atalho para a Mesa 08.
21. A comanda ganhou abas por pessoa incluindo "Compartilhado", tela de conta encerrada e ação de reiniciar a
    demonstração sem recarregar a página.
22. Configuração virou a lista dos pontos a confirmar no diagnóstico presencial, com estado de cada um, mais a
    seção "fora do piloto" — alinhada ao que a proposta comercial promete e ao que ela não promete.
23. A simulação de NFC-e ficou explícita: o aviso de integração prevista aparece antes da confirmação.

## Acessibilidade e responsividade

24. Todo elemento interativo tem alvo de 44 px ou mais; a navegação móvel usa 56 px.
25. Barra inferior no celular com os cinco destinos visíveis ao mesmo tempo, sem menu escondido.
26. Foco visível dourado em `:focus-visible`, nunca removido.
27. `prefers-reduced-motion: reduce` desliga transições e animações.
28. Rolagem horizontal eliminada em 1365 × 900, 768 × 1024 e 375 × 812, inclusive com diálogo aberto.

## Documentação

29. `DESIGN_SYSTEM.md`, `TEST_REPORT.md`, `MUDANCAS.md` e `PROVISORIO.md` criados; `README.md` reescrito.
30. Capturas das três resoluções em `docs/screenshots/` e roteiro de teste automatizado em `docs/test-flow.py`.

---

# V2 — modo garçom

Segunda rodada, pedida depois da primeira revisão: o sistema tinha que mostrar o garçom trabalhando no celular,
não só a comanda vista de cima. Nada foi reconstruído e nada da V1 foi removido — as mudanças são cirúrgicas.

## Perfis e permissão

31. Quatro perfis com troca no topo da tela: Gerência, Rafael (garçom), Cozinha e bar, Caixa. Cada um abre na
    própria tela inicial e o seletor escreve o que aquele perfil **não** faz.
32. Guarda de rota real por perfil (`lib/perfis.ts` + `app.tsx`): o garçom que tentar alcançar `/configuracao`,
    `/fechamentos` ou `/caixa` volta para a tela dele. Sem tela de senha falsa — o aviso diz que o acesso é
    demonstrativo e que na implantação cada funcionário terá usuário ou PIN.

## Telas novas

33. `/garcom` — as mesas do turno do garçom, com estado e total de cada uma, pensada para o celular.
34. `/caixa` — fila das mesas que pediram a conta, com a divisão por pessoa, a taxa de serviço e a NFC-e
    simulada. `/fechamentos` ficou sendo só o histórico da sessão.

## Fluxo do garçom

35. A comanda passou a registrar **autoria e horário de cada item** e a mostrar os dois na linha do item.
36. A ficha de produção identifica mesa, pessoa e garçom, e carrega a observação até a cozinha.
37. Entrega confirmada pelo garçom na mesa, depois de a produção marcar "pronto".
38. **Cancelamento de item em produção passa por autorização**: o garçom pede (`cancelamento_solicitado`), a
    gerência autoriza ou recusa. Até a decisão, o item continua contando na conta.
39. O garçom **solicita o fechamento** e a mesa entra na fila do caixa. Quem divide e encerra é o caixa.
40. Envio à prova de duplo clique: o botão trava durante o envio e o provedor tem guarda de idempotência por
    chave derivada dos itens e quantidades, além do filtro por status "novo".

## Caixa e conta

41. A divisão é sempre **por pessoa, cada um pagando a sua parte na forma que preferir** — sem falsa
    integração com adquirente e sem lista de formas de pagamento que o sistema não processa.
42. **Taxa de serviço de 10% só o caixa inclui ou retira.** Gerência e garçom apenas visualizam.
43. O rateio foi reescrito em centavos com distribuição pelo maior resto (`lib/rateio.ts`): a soma das partes
    fecha exatamente com o total da mesa, com ou sem serviço. Conferido item por item no relatório de testes.
44. O registro de fechamento passou a guardar **qual garçom atendeu a mesa**, além de quem operou o caixa, para
    o gerente saber de quem foi o atendimento.

## Roteiro da reunião

45. Painel lateral com os 14 passos da apresentação, com avanço manual (Próximo / Anterior) e marcação
    automática quando a ação acontece de verdade no estado. Orienta sem bloquear.
46. Mesas 02, 06 e 08 já vêm com comanda aberta; as demais abrem em branco, para mostrar o início do atendimento.

## Interface

47. Tipografia: só o que estava abaixo de 12 px subiu; a densidade atual foi preservada de propósito.
48. Título da aba corrigido para `CAV Comanda | Valhalla`.
49. Botões de quantidade do cardápio subiram de 40 px para 44 px, dentro do mínimo de alvo de toque.
50. Três estouros horizontais corrigidos (linha de item da comanda, cartão de mesa) e o painel do roteiro
    deixou de cobrir um botão de ação.

## Testes e documentação

51. Duas suítes Playwright: `e2e/flow.py` (63 verificações) e `e2e/roteiro.py` (79 verificações, cobrindo os
    22 passos do prompt mestre e as 10 regras de interface obrigatórias). Zero falha, zero erro de console.
52. `ARCHITECTURE_HANDOFF.md` criado com o mapa do código, as invariantes do estado central e a lista do que
    vira servidor no piloto. `README.md`, `TEST_REPORT.md` e `PROVISORIO.md` atualizados para a V2.

---

# V2.1 — correção cirúrgica final (pré-apresentação)

Terceira rodada, pedida no dia da reunião: sete correções pontuais sobre a versão V2 em execução.
Nada foi reescrito, nenhuma funcionalidade removida, nenhuma mudança de identidade visual, nenhuma
alteração de backend, domínio ou camada fiscal. Checkpoint do código tirado antes de qualquer edição.

## 1. Data e hora dinâmicas

53. Hook reutilizável `lib/hooks.ts` → `useAgora()`: lê o relógio do dispositivo, formata em `pt-BR` com o
    fuso local e se atualiza sozinho a cada minuto (limpa o timer ao desmontar). A barra superior deixou de
    ter qualquer data ou hora cravada — mostra `DOMINGO, 13 DE SETEMBRO` e `03:00` conforme o aparelho.

## 2. Permissão por perfil, centralizada

54. `components/guarda-rota.tsx` → `<GuardaRota>` envolve o `<Switch>` de rotas em `app.tsx`. A decisão de
    acesso passou a existir em **um** lugar, derivada da tabela de perfis, em vez de espalhada por tela.
55. A guarda duplicada que existia dentro de `app-shell.tsx` foi removida — era a fonte de comportamento
    divergente entre as duas verificações.
56. Rota bloqueada agora: redireciona para a tela inicial **do próprio perfil**, mostra o aviso
    "Esta área não está disponível para este perfil", **não apaga nada do estado** e não entra em laço de
    redirecionamento.

## 3. Navegação coerente com o perfil

57. A barra inferior e o menu lateral listam somente os destinos que aquele perfil pode abrir. O garçom não
    vê mais o link de `/caixa`, `/fechamentos` ou `/configuracao` — antes o link aparecia e só era barrado
    no clique.

## 4. Divisão monetária sem diferença de centavos

58. `lib/rateio.ts` → `ratear()` reescrita para aritmética **100% inteira**: multiplicação e resto exatos por
    módulo, sem nenhum `Math.floor` sobre número de ponto flutuante. Não existe mais caminho em que um
    arredondamento de float entre na conta.
59. Sinal extraído antes do rateio, o que torna determinístico também o caso de valor negativo (estorno).
60. Distribuição das sobras pelo **maior resto**, com desempate estável pelo índice da pessoa: o mesmo
    conjunto de entradas produz sempre exatamente a mesma divisão.
61. Invariante garantida por teste: a soma das parcelas é **igual** ao valor original em todos os casos, e
    quando os pesos são iguais a diferença entre a maior e a menor parcela nunca passa de 1 centavo.

## 5. Proteção contra duplo clique

62. `lib/hooks.ts` → `useAcaoUnica()`: enquanto a ação roda, o botão fica `disabled` + `aria-disabled` e o
    rótulo muda para o estado de progresso. Aplicado em **Enviar pedido**, **Solicitar fechamento** e
    **Entreguei na mesa** (`pages/mesa.tsx`), **Confirmar fechamento** (`components/checkout-sheet.tsx`),
    avançar e voltar ficha (`pages/producao.tsx`).
63. Na lista do garçom, o botão "Entreguei" de cada linha não tinha proteção nenhuma. Virou o componente
    `BotaoEntregar`, com estado próprio por item — travar uma linha não trava as outras.

## 6. Selo "Made with Runable" sempre visível

64. O selo da plataforma **não** é escondido por CSS, JS ou sobreposição. O que mudou foi o espaçamento do
    nosso próprio layout: `ALTURA_SELO = 64`, `paddingBottom` calculado na barra inferior, `<main>` com
    `pb-[calc(136px+env(safe-area-inset-bottom))]` e o `toast-host` reposicionado. `safe-area-inset-bottom`
    respeitado. Medido em 360 × 800, 390 × 844 e 430 × 932: zero colisão, selo 100% clicável nas três.

## 7. Contadores consistentes

65. Todos os contadores (fila de produção, fila do caixa, mesas em consumo, badges da navegação) derivam do
    mesmo estado central do provedor, sem cópia local — mudam no mesmo instante em que a ação acontece.

## Testes desta rodada

66. `e2e/monetario.ts` (`bun e2e/monetario.ts`): os 10 casos monetários do pedido, mais invariantes gerais,
    mais varredura exaustiva de 0 a 2000 centavos × 1 a 9 pessoas (18.009 combinações) e 5.000 sorteios com
    pesos aleatórios. **63/63 verificações aprovadas.**
67. `e2e/aceite.py` (`python3 e2e/aceite.py`): as sete correções (C1–C7) e o roteiro de 20 passos do pedido,
    em 390 × 844, 768 × 1024 e 1440 × 900, cada resolução numa única sessão SPA sem recarregar a página.
    **246 verificações, 0 falha, 0 erro de console.**
68. As suítes anteriores continuam passando sem alteração: `e2e/roteiro.py` 79/79 e `e2e/flow.py` 63/63.

---

# Correção incremental — Encerramento de mesa sem consumo

Rodada feita **sobre a V2.1**, sem reescrever componente nenhum, sem mexer no design e sem alterar os fluxos
que já existiam. As quatro suítes anteriores continuam rodando sem uma linha alterada.

## 8. A ação de liberar mesa sem cobrança

69. `lib/types.ts` → tipo `MotivoSemConsumo` com os cinco motivos (`desistiram`, `nao_encontraram`, `engano`,
    `troca_mesa`, `outro`) e interface `EncerramentoSemConsumo`, o registro de auditoria da liberação.
    `lib/format.ts` → `motivoSemConsumoLabel`: "Clientes desistiram", "Não encontraram o que procuravam",
    "Mesa aberta por engano", "Troca de mesa", "Outro".
70. `components/comanda-provider.tsx` → `avaliarSemConsumoDe(dados, mesa_id, funcionario)`: a regra única de
    elegibilidade e permissão, uma função pura, sem React, testável fora da interface. Devolve `elegivel`,
    `permitido`, `bloqueio` e `rascunhos`.
71. Bloqueio da ação quando existe qualquer item **enviado, preparando, pronto ou entregue**, quando existe
    ficha na produção, quando a conta já foi solicitada ou quando a mesa já tem total lançado. Nesses casos a
    mesa segue **exatamente** pelo fluxo normal de fechamento — nada mudou para ela.
72. Permissão: gerência libera qualquer mesa vazia; garçom libera **somente a mesa que ele abriu**; produção e
    caixa não executam a ação e não a veem.
73. `encerrarSemConsumo()` **não** cria `Fechamento`, não registra pagamento, não emite NFC-e simulada e não
    gera ficha de produção. Ela zera a mesa (`status: "livre"`, `ativa: false`, `contaSolicitada: false`,
    `abertaEm: null`, `garcom_id: null`, `pessoasFixas: 0`, `totalFixo: 0`) e remove as pessoas e os
    rascunhos daquela abertura. Os contadores mudam no mesmo instante, porque derivam do estado central.
74. Idempotência por **chave de abertura** (`aberturaId()` = `ab-m{mesa}-{abertaEm}`): a mesma abertura não
    pode ser encerrada duas vezes. Duplo clique fica travado no `useAcaoUnica()` do botão **e** na chave, em
    duas camadas independentes.
75. `components/sem-consumo-sheet.tsx` (**novo, único componente criado**): o diálogo de confirmação com o
    título "Encerrar mesa sem consumo?", o texto "A mesa será liberada sem gerar cobrança, pagamento ou
    documento fiscal.", motivo obrigatório em rádio, observação opcional e os botões **Voltar** /
    **Confirmar e liberar mesa**. Confirmar sem motivo não fecha nada — mostra aviso e mantém o diálogo.
76. Borda do rascunho: se a mesa tem item em `novo` (lançado, nunca enviado), o diálogo avisa quantos itens
    serão descartados e exige um **segundo consentimento explícito** por caixa de seleção. O descarte fica
    gravado na auditoria (`rascunhos_descartados`), junto do motivo.
77. `pages/mesa.tsx` → botão secundário **"Encerrar sem consumo"**, no mesmo bloco de ações da mesa, visível
    só quando a mesa é elegível e o perfil tem permissão. Nenhum botão existente foi movido ou reestilizado.
78. **Desfazer por 10 segundos** na própria tela da mesa, com contagem regressiva. Restaura a abertura a
    partir de um instantâneo em memória e só age se nada tiver mudado na mesa depois — é recurso de
    demonstração, não de produção (ver limitações no TEST_REPORT).
79. `pages/fechamentos.tsx` → seção **"Mesas liberadas sem consumo"**, separada dos fechamentos de verdade.
    Cada linha mostra motivo, observação, hora, responsável, perfil, duração da abertura, rascunhos
    descartados e o selo **Sem cobrança** (ou **Desfeito**). A auditoria **não** é apagada pelo Desfazer:
    o registro permanece, marcado como desfeito.
80. Campos do registro de auditoria, todos em `snake_case`, como o resto do modelo de dados:
    `organizacao_id`, `encerramento_id`, `mesa_id`, `abertura_id`, `encerrada_sem_consumo`, `motivo`,
    `observacao`, `rascunhos_descartados`, `funcionario_id`, `funcionario_nome`, `funcionario_perfil`,
    `aberta_em`, `encerrada_em`, `duracao_segundos`, `desfeito_em`.
81. Únicos ajustes de superfície em código já existente: `interface Dados`, `aberturaId()` e
    `avaliarSemConsumoDe()` passaram a ser exportadas de `comanda-provider.tsx`, para que a regra pudesse ser
    testada por fora da interface. Nenhuma mudança de comportamento em tempo de execução.

## Testes desta correção

82. `e2e/sem-consumo.ts` (`bun e2e/sem-consumo.ts`): a matriz de permissão e de bloqueio direto na função de
    regra — os quatro perfis, garçom dono e garçom de outra mesa, cada motivo de bloqueio, contagem de
    rascunhos e a chave de idempotência. **28/28 verificações aprovadas.**
83. `e2e/sem-consumo.py` (`python3 e2e/sem-consumo.py`): os 13 testes obrigatórios do pedido em
    **390 × 844** (celular, com toque) e **1440 × 900**, cada resolução numa única sessão SPA.
    **133/133 verificações aprovadas, 0 erro de console.**
84. Regressão sem nenhuma alteração nas suítes: `e2e/monetario.ts` 63/63, `e2e/roteiro.py` 79/79,
    `e2e/aceite.py` 246 verificações / 0 falha, `e2e/flow.py` 63/63.
