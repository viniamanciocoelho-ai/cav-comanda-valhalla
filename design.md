# CAV Comanda | Valhalla — Design

Sistema de comandas por mesa e por pessoa para a **Valhalla Choperia** (Três Lagoas/MS).
Plataforma: web (navegador, usada em celular, tablet e computador), conectada à API e ao banco da organização.

Direção visual: choperia temática premium. Base quase preta e madeira escura, destaques em dourado envelhecido,
bronze e laranja queimado, textos de apoio em pergaminho. Atmosfera nórdica e artesanal expressa em **materiais,
bordas, divisores e estados** — nunca em ornamento gratuito. A camada operacional (pedidos, preços, ações)
permanece limpa, rápida e de alta legibilidade.

Fonte da identidade: as duas capturas do Instagram da Valhalla em `references/` (cartazes de inauguração:
fundo preto, madeira, brasão circular, tipografia condensada de impacto, dourado e laranja de chama).

## Brand & Colors

Token set único em `packages/web/src/web/styles.css` (`:root` = tema escuro padrão, `[data-theme="light"]` = pergaminho).

| Token | Escuro (padrão) | Claro (pergaminho) | Uso |
|-------|-----------------|--------------------|-----|
| `--vh-void` | #0A0908 | #E7DBC4 | Fundo da aplicação |
| `--vh-surface` | #16120E | #F6EEDE | Cartões, painéis |
| `--vh-surface-2` | #1E1811 | #EDE2CD | Campos, linhas alternadas |
| `--vh-surface-3` | #2A2117 | #E0D2B6 | Hover, estados ativos |
| `--vh-border` | #382C1E | #C9B590 | Fios, divisores |
| `--vh-border-strong` | #4A3A26 | #B29B72 | Bordas de foco e cartões destacados |
| `--vh-text` | #F2E6CE | #1E1710 | Texto principal (pergaminho) |
| `--vh-muted` | #A7977C | #6A5B45 | Texto de apoio |
| `--vh-gold` | #C9A24A | #8A6520 | Destaque principal, marca |
| `--vh-gold-bright` | #E8C87E | #6E4E14 | Números, hover de destaque |
| `--vh-bronze` | #8A6A3B | #A1854F | Detalhes de metal, fios |
| `--vh-ember` | #C9762B | #A8551B | Ação primária, laranja queimado |
| `--vh-moss` | #83975C | #55703B | Livre / pronto / sucesso |
| `--vh-blood` | #B04A34 | #93372A | Aguardando conta / atenção |

Contraste: texto principal sobre fundo escuro ≈ 12:1; texto de apoio ≈ 5:1; botão âmbar usa texto quase preto
(#140E07) para manter ≈ 8:1.

### Estados operacionais (cor + rótulo, nunca só cor)

| Estado | Cor | Onde aparece |
|--------|-----|--------------|
| Livre | `--vh-moss` | mesa |
| Ocupada | `--vh-gold` | mesa |
| Aguardando conta | `--vh-blood` | mesa |
| Novo item | `--vh-ember` | item da comanda |
| Enviado | `--vh-bronze` | item, ficha de produção |
| Preparando | `--vh-gold-bright` | item, ficha de produção |
| Pronto | `--vh-moss` | item, ficha de produção |

## Typography

Auto-hospedada em `packages/web/public/fonts/` (Google Fonts, SIL OFL 1.1) e declarada em `src/web/fonts.css`.
As fontes são auto-hospedadas para a interface não depender de rede externa.

- **Cinzel 700** — exclusivamente no lockup da marca (VALHALLA). Serifa gravada, remete ao brasão dos cartazes.
- **Oswald 500/600/700** — títulos, números de mesa, totais, rótulos de estado. Condensada, de cartaz, ótima
  para números grandes. Sempre em caixa alta com `letter-spacing` de 0.04em a 0.16em.
- **Manrope 400/500/600/700/800** — toda a camada operacional: nomes de itens, pessoas, preços, botões, ajuda.
  Números com `font-variant-numeric: tabular-nums` para alinhar colunas de preço.

Escala: 11/12/13 px apoio · 15/16 px corpo · 20/24 px títulos de seção · 32/40 px números de mesa e totais.

## Materiais e texturas (100% geradas em CSS, sem imagem externa)

- **Grão de madeira**: gradientes lineares repetidos de baixa opacidade na barra lateral e no cabeçalho.
- **Grão de filme**: `feTurbulence` em SVG inline (data URI) a 3–4% de opacidade sobre o fundo.
- **Cantoneiras de metal**: pseudo-elementos com fios em dourado nos quatro cantos do painel de destaque.
- **Divisor rúnico**: um único losango entre dois fios de bronze, usado com parcimônia em cabeçalhos.
- **Emblema da marca** (`brand-mark.tsx`): SVG autoral com elmo, machados e fio circular.

## Componentes

- `app-shell` — barra lateral fixa no desktop, barra inferior fixa no celular (5 destinos, alvo ≥ 56 px).
- `top-bar` — data operacional, estado da operação, alternância de tema.
- `table-card` — número em Oswald, fio de estado à esquerda, pessoas, tempo, valor parcial.
- `order-row` — nome do item, pessoa, estado, preço em coluna tabular.
- `guest-chips` — filtro por pessoa (Todos, Fábio, Ana, Bruno, Carol, Compartilhado).
- `production-ticket` — ficha de cozinha/bar legível a distância: mesa em 40 px, itens em 18 px.
- `sheet` — diálogo nativo (`<dialog>`) centralizado no desktop e ancorado ao rodapé no celular.
- `status-pill`, `rune-divider`, `section-heading`, `metric`, `toast`.

## Páginas

- **Salão** (`pages/index.tsx`) — visão operacional: indicadores, mesas configuradas, fila do caixa e legenda.
- **Mesa** (`pages/mesa.tsx`) — comanda da mesa: pessoas, itens individuais e compartilhados, envio, resumo.
- **Cozinha e bar** (`pages/producao.tsx`) — fila separada por destino, avanço de estado por ficha.
- **Fechamentos** (`pages/fechamentos.tsx`) — contas encerradas, com rateio e auditoria registrados.
- **Configuração** (`pages/configuracao.tsx`) — mesas, cardápio, equipe, PIN pessoal e preferências.

## Fluxos

1. Salão → abrir uma mesa → adicionar item para uma pessoa → enviar para cozinha e bar → ficha aparece na produção.
2. Produção → avançar estado (enviado → preparando → pronto) → o estado volta para a comanda.
3. Mesa → dividir e fechar conta → rateio por pessoa com compartilhados e serviço → imprimir recibo.
4. Fechamento é registrado em Fechamentos.
5. Tema claro/escuro em qualquer tela, persistido apenas na sessão (sem `localStorage`).

## Acessibilidade e desempenho

- Alvos de toque ≥ 44 px (navegação móvel ≥ 56 px).
- Foco visível: contorno duplo em dourado, nunca removido.
- Navegação por teclado em todas as ações; diálogos nativos com `Esc` e retorno de foco.
- `prefers-reduced-motion: reduce` desliga transições e animações.
- Sem rolagem horizontal em 1365×900, 768×1024 e 375×812.
- Animações: apenas transições funcionais de 120–200 ms (estado, hover, entrada de ficha).

## Proibições respeitadas

Sem gradiente roxo ou azul-neon, sem glassmorphism, sem brilho artificial, sem blobs, sem cartão flutuante
genérico, sem raio de canto exagerado (máximo 12 px, 999 px apenas em chips), sem ícone dentro de círculo
colorido, sem texto gigante decorativo, sem imagem de viking gerada por IA, sem excesso de runas, sem cara de
template SaaS.

## Estado da operação

Dados, cardápio, equipe, mesas e fechamentos exibidos na interface vêm da organização autenticada e são
persistidos pelo backend. Recursos fiscais e pagamentos integrados dependem de infraestrutura externa.
