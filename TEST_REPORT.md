# TEST_REPORT | CAV Comanda | Valhalla — V2.1 (correção cirúrgica final)

Data da execução: 13 de setembro de 2026
Versão: V2.1 — V2 (perfis, tela do garçom, caixa, cancelamento com autorização, roteiro guiado) com as sete correções pré-apresentação
Navegador: Google Chrome 153.0.8010.36 (headless), automação via Playwright (Python)
Servidor: `bun run dev` em `http://localhost:4200`
Suítes: `e2e/aceite.py`, `e2e/monetario.ts`, `e2e/flow.py`, `e2e/roteiro.py` · Capturas: `e2e/shots/` · Saída bruta: `e2e/resultado-aceite.json`, `e2e/resultado.json`, `e2e/resultado-roteiro.json`

## 0. Resumo

| Suíte | O que cobre | Verificações | Falhas | Console |
|-------|-------------|--------------|--------|---------|
| `e2e/aceite.py` | as sete correções desta rodada (C1–C7) + roteiro de 20 passos, em 390×844, 768×1024 e 1440×900 | 246 | **0** | 0 erro, 0 aviso |
| `e2e/monetario.ts` | os 10 casos monetários obrigatórios + invariantes + 18.009 combinações exaustivas + 5.000 sorteios | 63 | **0** | — |
| `e2e/flow.py` | fluxo ponta a ponta em mesa livre, perfis, bloqueio de rota, responsividade | 63 | **0** | 0 erro, 0 aviso |
| `e2e/roteiro.py` | os 22 passos de teste do prompt mestre + as 10 regras de interface | 79 | **0** | 0 erro, 0 aviso |

| Verificação de código | Resultado |
|-----------------------|-----------|
| `bun run lint` | 19 arquivos, **0 erro, 0 aviso** |
| `bunx tsc --noEmit -p tsconfig.app.json` | **0 erro** |
| `bun run build:web` | aprovado — CSS 44,70 KB (8,43 KB gzip), JS 671,10 KB (186,33 KB gzip) |

As seções 1 a 7 são o relatório da V2, revalidado sem alteração nesta rodada. As **seções 8 a 10** cobrem as
sete correções da V2.1: aceite por correção, os 10 casos monetários e as limitações declaradas.

## 1. Os 22 passos do prompt mestre (`e2e/roteiro.py`)

Rodados em **uma única sessão do navegador**, sem recarregar a página entre as rotas — é assim que se prova
que o estado é compartilhado entre garçom, produção, caixa e gerência.

| Passo | Verificação | Resultado |
|-------|-------------|-----------|
| 1–2 | Salão abre, dez mesas, mesas 02 / 06 / 08 com comanda e as demais livres | aprovado |
| 3 | Troca para o perfil Rafael (garçom) leva direto à tela do garçom | aprovado |
| 4 | Mesas do turno listadas com estado e total por mesa | aprovado |
| 5 | Mesa 08 abre com Fábio, Ana, Bruno e Carol | aprovado |
| 6 | Selecionar Ana antes do item; o cardápio mostra para quem está lançando | aprovado |
| 7 | Chopp IPA 500 ml lançado para Ana, quantidade 1 | aprovado |
| 8 | Tábua para dois lançada como compartilhada, com observação "Sem cebola" | aprovado |
| 9 | Revisão antes do envio: itens em "Novo item", total conferido | aprovado |
| 10 | **Duplo clique no envio não duplica item**: total antes = total depois, Chopp IPA segue em uma linha | aprovado |
| 11 | Comanda mostra autor e horário de cada item | aprovado |
| 12 | Perfil Cozinha e bar abre a fila de produção | aprovado |
| 13 | Fichas separadas por destino; a ficha da Ana identifica mesa 08, pessoa e garçom Rafael; observação chega na cozinha | aprovado |
| 14 | Ficha avança enviado → preparando → pronto e volta atrás quando preciso | aprovado |
| 15 | Garçom vê "pronto" na comanda e confirma a entrega na mesa | aprovado |
| 16 | Garçom solicita o fechamento; a mesa muda para "aguardando conta" | aprovado |
| 17 | Perfil Caixa encontra a Mesa 08 na fila de fechamento | aprovado |
| 18 | Divisão lista as 4 pessoas; consumo + rateio + serviço confere pessoa por pessoa e a soma fecha com o total da mesa (R$ 244,20) | aprovado |
| 19 | Retirar a taxa de serviço tira exatamente 10% (244,20 → 222,00) e recolocar volta ao valor original | aprovado |
| 20 | NFC-e simulada: resultado marcado como simulação, aviso de integração prevista permanece, registro entra no histórico com o garçom que atendeu | aprovado |
| 21 | Botão de reiniciar a demonstração presente em Ajustes | aprovado |
| 22 | Reiniciar devolve o estado inicial: mesa aberta no teste volta a livre, mesas 02/06/08 restauradas, histórico de fechamentos vazio | aprovado |

Conferência aritmética do passo 18, com e sem taxa de serviço (valores em reais):

| Pessoa | Consumo | Rateio do compartilhado | Serviço | Total |
|--------|---------|-------------------------|---------|-------|
| Fábio | 46,00 | 29,50 | 7,55 | 83,05 |
| Ana | 58,00 | 29,50 | 8,75 | 96,25 |
| Bruno | 0,00 | 29,50 | 2,95 | 32,45 |
| Carol | 0,00 | 29,50 | 2,95 | 32,45 |
| **Soma** | | | | **244,20 = total da mesa** |

Sem serviço: 75,50 + 87,50 + 29,50 + 29,50 = **222,00**, também igual ao total. Nenhum centavo sobrando ou
inventado — o rateio trabalha em centavos com distribuição pelo maior resto (`lib/rateio.ts`).

## 2. Fluxo ponta a ponta em mesa livre (`e2e/flow.py`)

Mesa livre escolhida, pessoa criada na hora, pedido lançado, preparado, entregue, dividido e fechado, com o
caixa retirando e recolocando o serviço. Cobre também:

- **Duplo clique no envio**: botão travado durante o envio e guarda de idempotência no provedor; nenhum item duplicado.
- **Bloqueio de rota por perfil**: como garçom, forçar `/configuracao`, `/fechamentos` e `/caixa` por `pushState`
  devolve para `/garcom`. O garçom não vê faturamento nem configuração.
- **Histórico**: o fechamento registra quem operou o caixa **e** qual garçom atendeu a mesa, e marca a NFC-e como simulada.
- **Marcas de demonstração**: "Dados demonstrativos", "Cardápio provisório" e "Mesa do roteiro" presentes nas telas.

## 3. Regras de interface obrigatórias

| # | Regra | Verificação | Resultado |
|---|-------|-------------|-----------|
| 1 | Título da aba `CAV Comanda \| Valhalla` | leitura de `document.title` | aprovado (corrigido nesta rodada) |
| 2 | Interface em português do Brasil, `lang="pt-BR"` | atributo do `<html>` e varredura de texto | aprovado |
| 3 | Data e hora dinâmicas, sem valor cravado | horário dos itens e "há X min" nas fichas | aprovado |
| 4 | Nenhum texto abaixo de 12 px | varredura de `font-size` computado em todos os nós de texto | aprovado |
| 5 | Foco visível ao navegar por teclado | seis paradas de `Tab`, contorno dourado de 2 px | aprovado |
| 6 | Alvos de toque ≥ 44 px | varredura de `getBoundingClientRect` em todo elemento interativo | aprovado (corrigido nesta rodada) |
| 7 | Zero overflow horizontal em 375 px | `scrollWidth` vs `clientWidth` nas sete rotas | aprovado (375/375 em todas) |
| 8 | `prefers-reduced-motion: reduce` respeitado | duração de animação computada cai a ~0 | aprovado |
| 9 | Marca do Runable preservada | selo da plataforma intacto | aprovado |
| 10 | Autoria e horário por item | comanda e ficha de produção mostram quem lançou e quando | aprovado |

Responsividade medida também em 320, 360, 390, 720 (zoom 200%) e 1440 px, em `/`, `/garcom`, `/mesa/8`,
`/producao`, `/caixa`, `/fechamentos` e `/configuracao`: nenhum estouro horizontal em nenhuma combinação.

## 4. Defeitos encontrados e corrigidos nesta rodada

| # | Defeito | Correção |
|---|---------|----------|
| 1 | Título da aba era `CAV Comanda · Valhalla Choperia`, fora da regra 1 | `packages/web/index.html` → `CAV Comanda \| Valhalla` |
| 2 | Botões +/− de quantidade no cardápio mediam 40 px, abaixo do mínimo de 44 px | `menu-sheet.tsx`: `size-10` → `size-11` |
| 3 | O histórico de fechamentos não guardava qual garçom atendeu a mesa — só quem operou o caixa. O gerente não conseguia saber de quem foi o atendimento | campo `garcom_nome` em `Fechamento`, populado em `fecharConta` e exibido em `/fechamentos` |
| 4 | Painel do roteiro cobria um botão de ação (rodada anterior) | `app-shell.tsx`, espaçamento reservado |
| 5 | Overflow horizontal na linha de item da comanda e no cartão de mesa (rodada anterior) | `min-w-0` em `pages/mesa.tsx` e `pages/index.tsx` |

Também foram adicionados `data-testid` nos filtros de categoria do cardápio e no botão de reiniciar a
demonstração, para que os testes cliquem no elemento certo — a interface não mudou por causa disso.

## 5. Critérios bloqueantes do projeto

| Critério bloqueante | Estado |
|---------------------|--------|
| Fluxo anterior quebrado pela V2 | não ocorre |
| Pedido do garçom não aparece na produção | não ocorre |
| Item duplicado por duplo clique | não ocorre |
| Garçom acessa configuração ou faturamento | não ocorre |
| Produção não identifica mesa, pessoa e garçom | não ocorre |
| Estado não compartilhado entre rotas | não ocorre |
| Divisão de conta matematicamente incorreta | não ocorre |
| NFC-e parecendo emissão real | não ocorre — marcada como simulada, sem documento emitido |
| Erro ou aviso no console | nenhum nas duas suítes |
| Overflow horizontal | nenhum de 320 a 1440 px |
| Botão importante escondido | nenhum |
| Dados sem marca de demonstrativo | nenhum |

## 6. Restrições técnicas confirmadas

| Restrição | Verificação |
|-----------|-------------|
| Sem backend, banco ou autenticação | nenhuma chamada de rede além dos arquivos estáticos |
| Sem `localStorage` / `sessionStorage` | nenhum uso no código; recarregar devolve o estado inicial |
| Sem pagamento ou NFC-e real | somente simulação de interface, rotulada |
| Fontes auto-hospedadas | `.woff2` no projeto; roda sem internet |
| Sem imagem de terceiro | texturas, brasão e ícones em CSS e SVG |

## 7. Pendências conhecidas

- As rotas e dependências principais foram divididas em chunks; o maior arquivo JavaScript do build
  revisado ficou abaixo de 500 KB.
- Os minutos das fichas partem de valores fixos dos dados demonstrativos; não são cronômetros reais.
- As capturas mostram o selo "Made with Runable" da plataforma de pré-visualização — não faz parte da interface.

---

## 8. Aceite das sete correções da V2.1 (`e2e/aceite.py`)

246 verificações, **0 falha**, 0 erro e 0 aviso de console. Rodado em **390 × 844**, **768 × 1024** e
**1440 × 900**, e cada resolução numa **única sessão do navegador** — sem `goto` depois do carregamento
inicial, o que prova que o estado continua compartilhado entre perfis e rotas.

| # | Correção | Como foi verificada | Resultado |
|---|----------|---------------------|-----------|
| C1 | Data e hora dinâmicas | data e hora da barra superior comparadas com o relógio do sistema em `pt-BR`; nenhum valor cravado no código | aprovado |
| C2 | Permissão por perfil | como Rafael (garçom), `/caixa`, `/fechamentos` e `/configuracao` forçadas por `pushState`: volta para `/garcom`, aviso "Esta área não está disponível para este perfil", itens da comanda preservados, sem laço de redirecionamento | aprovado |
| C3 | Navegação por perfil | nos quatro perfis, os links visíveis na barra inferior conferem exatamente com a tabela de permissão | aprovado |
| C4 | Divisão sem diferença de centavos | divisão da Mesa 08 com e sem serviço: soma das parcelas igual ao total exibido, centavo por centavo (detalhe na seção 9) | aprovado |
| C5 | Duplo clique | dois cliques imediatos em **Enviar pedido**, **Solicitar fechamento**, **Confirmar fechamento**, **Entreguei** e avançar ficha: nenhuma duplicação, nenhum salto de estado | aprovado |
| C6 | Selo "Made with Runable" | selo presente, visível e 100% clicável, sem CSS/JS/sobreposição escondendo-o, em 360 × 800, 390 × 844 e 430 × 932 | aprovado |
| C7 | Contadores consistentes | contador da fila de produção e da fila do caixa conferidos contra a contagem real de fichas/mesas na própria tela, depois de cada ação | aprovado |

Medição do selo contra a barra inferior (folga positiva = não há colisão):

| Viewport | Selo | Barra inferior | Colisões | Folga |
|----------|------|----------------|----------|-------|
| 360 × 800 | y=743, h=37 | y=679, h=121 | nenhuma | 20 px |
| 390 × 844 | y=787, h=37 | y=723, h=121 | nenhuma | 20 px |
| 430 × 932 | y=875, h=37 | y=811, h=121 | nenhuma | 20 px |

Nenhuma rolagem horizontal em nenhuma das três resoluções móveis.

### Roteiro de 20 passos do pedido

Rafael entra → Mesa 08 → Ana selecionada → Chopp IPA lançado → item compartilhado → observação "sem cebola" →
duplo clique em Enviar → fila de produção com a observação → preparando → pronto → entrega confirmada →
fechamento solicitado → caixa encontra a mesa → divisão por pessoa → serviço retirado e recolocado →
duplo clique em Confirmar fechamento (um único fechamento registrado) → contadores atualizados no mesmo
instante. **Todos os 20 passos aprovados nas três resoluções.**

## 9. Os 10 casos monetários obrigatórios (`e2e/monetario.ts`)

63/63 verificações aprovadas. Toda a aritmética em **centavos inteiros** — nenhum ponto flutuante entra na
divisão. Em cada caso foram checadas as invariantes: soma exata, sem `NaN`, valores inteiros, sem negativo
indevido e diferença máxima de 1 centavo quando os pesos são iguais.

| # | Caso | Resultado | Soma |
|---|------|-----------|------|
| 1 | R$ 10,00 ÷ 3 | 334 + 333 + 333 → R$ 3,34 / 3,33 / 3,33 | 1000 = 1000 |
| 2 | R$ 0,01 ÷ 2 | 1 + 0 | 1 = 1 |
| 3 | R$ 99,99 ÷ 7 | 3 × 1429 + 4 × 1428 | 9999 = 9999 |
| 4 | Item individual (não entra em rateio) | base da Ana = 2450, rateio compartilhado = 0 | 2450 = 2450 |
| 5 | Item compartilhado R$ 68,90 ÷ 3 | 2297 + 2297 + 2296 | 6890 = 6890 |
| 6 | Taxa de serviço de 10% | consumo + serviço por pessoa fecha com subtotal + serviço, saldo restante zero | 11374 = 11374 |
| 7 | Retirada da taxa de serviço | total sem serviço volta a ser exatamente o subtotal, nenhum serviço cobrado | 10340 = 10340 |
| 8 | Desconto / estorno (valor negativo) | −1000 → −334 − 333 − 333, determinístico | −1000 = −1000 |
| 9 | Soma de vários itens compartilhados (4 itens ÷ 4 pessoas) | soma dos rateios igual à soma dos itens | 8669 = 8669 |
| 10 | Sobras em pessoas diferentes conforme os pesos | pesos iguais → [3333, 3333, 3334]; pesos 2:1:1 → [50, 25, 25] vs iguais → [34, 33, 33]; mesmo resultado em execuções repetidas | 10000 = 10000 |

Além dos 10 casos: **varredura exaustiva** de 0 a 2000 centavos × 1 a 9 pessoas (**18.009 divisões**, 0 falha)
e **5.000 sorteios** com pesos aleatórios (0 falha). Nenhum centavo perdido ou inventado em nenhuma delas.

## 10. Limitações declaradas ao fim da rodada V2.1

1. **Recarregar a página devolve o perfil para Gerência.** A demonstração não tem autenticação — o perfil
   ativo vive na memória da aba, como todo o resto do estado. Não é falha da guarda de rota: a guarda barra
   corretamente o perfil que está ativo. Na apresentação, trocar de perfil pelo seletor do topo, sem `F5`.
   Sessão persistente é trabalho de servidor, fora do escopo desta demonstração.
2. **Desconto não existe como funcionalidade.** O pedido mandava testá-lo "caso já exista no sistema" — não
   existe (nenhum código de desconto no produto). O que foi coberto é a **aritmética** de valor negativo em
   `ratear()`, para que a base já esteja correta quando o recurso for construído. Não aplicável, não pendente.
3. As rotas e dependências principais foram divididas em chunks; o build revisado não emite mais o aviso
   de arquivo JavaScript acima de 500 KB.
4. Os minutos das fichas partem de valores fixos dos dados demonstrativos; não são cronômetros reais. A data
   e a hora da barra superior, por outro lado, são do dispositivo e se atualizam sozinhas (correção 1).
5. Nada de backend, domínio ou camada fiscal foi alterado nesta rodada, e não houve publicação em produção.

---

# TEST_REPORT — Correção "Encerramento de mesa sem consumo"

Data da execução: 13 de setembro de 2026
Base: V2.1 aprovada, sem reescrita de componentes e sem alteração de design
Navegador: Google Chrome (headless), automação via Playwright (Python)
Servidor: `bun run dev` em `http://localhost:4200`
Novas suítes: `e2e/sem-consumo.ts`, `e2e/sem-consumo.py` · Saída bruta: `e2e/resultado-sem-consumo.json` · Capturas: `e2e/shots/sc-*.png`

## 11. Resumo desta rodada

| Suíte | O que cobre | Verificações | Falhas | Console |
|-------|-------------|--------------|--------|---------|
| `e2e/sem-consumo.py` | os 13 testes obrigatórios do pedido, em 390 × 844 (celular, com toque) e 1440 × 900 | 133 | **0** | 0 erro, 0 aviso |
| `e2e/sem-consumo.ts` | regra de elegibilidade e permissão direto na função pura: 4 perfis, bloqueios, rascunhos, idempotência | 28 | **0** | — |

Regressão, com as suítes anteriores **sem uma linha alterada**:

| Suíte | Verificações | Falhas | Console |
|-------|--------------|--------|---------|
| `e2e/monetario.ts` | 63 | **0** | — |
| `e2e/roteiro.py` | 79 | **0** | 0 |
| `e2e/aceite.py` | 246 | **0** | 0 (3 notas pré-existentes sobre folga do selo) |
| `e2e/flow.py` | 63 | **0** | 0 |

| Verificação de código | Resultado |
|-----------------------|-----------|
| `bunx tsc --noEmit -p tsconfig.app.json` | **0 erro** |
| `bun run lint` | 19 arquivos, **0 erro, 0 aviso** |
| `bun run build:web` | aprovado (`✓ built in 2.43s`) |

## 12. Os 13 testes obrigatórios (`e2e/sem-consumo.py`)

Cada resolução roda numa **única sessão SPA**, sem recarregar a página — é assim que se prova que o estado
compartilhado entre garçom, produção, caixa e gerência reage no mesmo instante.

| # | Teste | O que foi verificado | Resultado |
|---|-------|----------------------|-----------|
| 1 | Mesa livre → aberta → encerrada sem consumo | mesa 09 aberta pelo garçom, ação presente, encerramento conclui | aprovado |
| 2 | Mesa com pessoas e nenhum item | duas pessoas adicionadas, total zero, ação continua disponível | aprovado |
| 3 | Diálogo de confirmação | título, texto "A mesa será liberada sem gerar cobrança, pagamento ou documento fiscal.", cinco motivos, observação opcional, **Voltar** sem efeito, confirmar sem motivo bloqueado com aviso, confirmação com toast "Mesa liberada sem consumo" | aprovado |
| 4 | Mesa volta a livre e pode reabrir | estado `livre` no salão, pessoas limpas, reabertura imediata funciona | aprovado |
| 5 | Nada fiscal ou financeiro criado | nenhum `Fechamento` novo, nenhum pagamento, nenhuma NFC-e simulada, nenhuma ficha de produção | aprovado |
| 6 | Contadores | mesas em consumo, badges de produção / caixa / garçom, mesas abertas e livres do garçom — todos conferidos contra a contagem real da tela | aprovado |
| 7 | Auditoria | registro em "Mesas liberadas sem consumo" com motivo, observação, hora, responsável, perfil, duração da abertura e selo **Sem cobrança** | aprovado |
| 8 | Duplo clique / repetição | dois cliques instantâneos em **Confirmar e liberar mesa**: **um único** registro, nenhum fechamento, ação não reaparece para a mesma abertura | aprovado |
| 9 | Borda do rascunho | item em `novo` → aviso de descarte, confirmação exigida por caixa de seleção, mesa liberada, nenhuma ficha na produção, auditoria grava o descarte e o motivo | aprovado |
| 10 | Borda do bloqueio | mesas 02 e 08 (item enviado) e mesa 06 (fechamento solicitado): a ação **não** aparece e o fluxo normal de fechamento segue intacto | aprovado |
| 11 | Permissões | garçom encerra a mesa que abriu; gerência encerra qualquer mesa vazia; produção é barrada na rota; caixa não vê a ação | aprovado |
| 12 | Celular 390 × 844 | sem rolagem horizontal, alvos de toque ≥ 44 px, diálogo cabe na largura da tela | aprovado |
| 13 | Console | zero erro e zero aviso nas duas resoluções, do início ao fim da sessão | aprovado |

Extra fora da lista: o **Desfazer** de 10 s foi exercitado de verdade na mesa 03 — restaura a abertura com as
pessoas que existiam, e o registro de auditoria **permanece**, marcado como **Desfeito**.

## 13. Matriz de regra (`e2e/sem-consumo.ts`)

A demonstração tem um garçom por turno, então a interface sozinha não prova a matriz de permissão inteira.
O teste chama `avaliarSemConsumoDe()` direto, com estados montados à mão.

| Grupo | Casos | Resultado |
|-------|-------|-----------|
| Elegibilidade | mesa aberta sem pessoas e sem itens; mesa com pessoas sem itens | permitido |
| Permissão | gerência sempre; garçom dono sim; garçom de outra mesa não; produção não; caixa não; gerência em mesa de outro garçom sim | conforme a tabela |
| Bloqueio | item enviado, preparando, pronto ou entregue; ficha na produção; conta solicitada; mesa com total lançado; mesa livre; mesa inexistente | bloqueado |
| Rascunho | soma de quantidades em `novo` reportada corretamente | aprovado |
| Idempotência | mesma abertura = mesma chave; nova abertura = chave nova; mesa diferente = chave diferente; prefixo `ab-m7-` | aprovado |

**28/28 verificações aprovadas.**

## 14. Limitações declaradas nesta correção

1. **O "Desfazer" de 10 segundos é recurso de demonstração.** O instantâneo da mesa vive na memória da aba e
   só é restaurado se nada tiver mudado na mesa depois do encerramento. Recarregar a página descarta a janela
   de desfazer. Em produção isso é uma reversão transacional no servidor, com a mesma auditoria.
2. **A auditoria também vive na memória da aba**, como todo o resto do estado da demonstração. Na arquitetura
   final é a saída da procedure `mesa.encerrarSemConsumo`, idempotente por `abertura_id`.
3. `e2e/sem-consumo.py` depende do estado inicial de `demo-data.ts` (mesas 02, 06 e 08 ocupadas; as demais
   livres). Mudar os dados demonstrativos exige ajustar o teste.
4. O aviso do Vite sobre pacote acima de 500 KB foi eliminado com carregamento sob demanda das rotas e
   divisão dos principais grupos de dependências.
5. **Nenhum deploy foi feito.** Backend, domínio e camada fiscal não foram tocados nesta rodada.
