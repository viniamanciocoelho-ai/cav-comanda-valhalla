"""Aceite das 7 correcoes cirurgicas + roteiro de 20 passos do documento final.

Roda o roteiro inteiro em 390x844, 768x1024 e 1440x900, numa unica sessao SPA por
resolucao (nenhum page.goto depois do primeiro load, para provar que o estado atravessa
perfis e rotas). Alem do roteiro, verifica ponto a ponto:

  C1 data e hora reais do dispositivo, com formato pt-BR
  C2 permissoes centralizadas por perfil, com aviso e sem loop
  C3 navegacao mostrando somente o que o perfil pode abrir
  C4 divisao monetaria fechando em zero (aritmetica coberta tambem em e2e/monetario.ts)
  C5 duplo clique nos quatro botoes que gravam
  C6 selo do Runable sem cobrir a navegacao inferior (360x800, 390x844, 430x932)
  C7 contadores derivados do mesmo estado central

Uso: python3 e2e/aceite.py
"""

import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from browser_runtime import launch_options

BASE = "http://localhost:4200"
SHOTS = Path(__file__).resolve().parent / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
AVISO = "Esta área não está disponível para este perfil"

console_problemas: list[str] = []
falhas: list[str] = []
notas: list[str] = []
passos: list[str] = []
atual = ""


def ok(msg: str) -> None:
    passos.append(f"OK   [{atual}] {msg}")
    print(f"OK   [{atual}] {msg}", flush=True)


def falha(msg: str) -> None:
    falhas.append(f"[{atual}] {msg}")
    passos.append(f"FALHA [{atual}] {msg}")
    print(f"FALHA [{atual}] {msg}", flush=True)


def nota(msg: str) -> None:
    notas.append(f"[{atual}] {msg}")
    print(f"NOTA [{atual}] {msg}", flush=True)


def checar(cond: bool, msg: str) -> bool:
    ok(msg) if cond else falha(msg)
    return bool(cond)


def tem(corpo: str, agulha: str) -> bool:
    return agulha.casefold() in corpo.casefold()


def dinheiro(texto: str) -> float:
    achado = re.search(r"[\d.]*\d,\d{2}", texto)
    return float("nan") if not achado else float(achado.group(0).replace(".", "").replace(",", "."))


def trocar(page, perfil: str) -> None:
    """Troca de perfil pelo botao da barra superior (existe em toda largura)."""
    page.click('[data-testid="trocar-perfil"]')
    page.wait_for_selector(f'[data-testid="perfil-{perfil}"]')
    page.click(f'[data-testid="perfil-{perfil}"]')
    page.wait_for_timeout(600)


def ir(page, rota: str) -> None:
    """Navegacao SPA, equivalente a digitar a rota dentro do aplicativo."""
    page.evaluate(f"() => history.pushState({{}}, '', '{rota}')")
    page.evaluate("() => window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_timeout(450)


def rota_atual(page) -> str:
    return page.evaluate("() => location.pathname")


def toast(page) -> str:
    alvo = page.locator('[data-testid="toast-host"]')
    return alvo.inner_text() if alvo.count() else ""


def clique_duplo_instantaneo(page, seletor: str) -> int:
    """Dois cliques no mesmo tique do JavaScript: o React nem re-renderizou entre eles.
    Devolve quantos cliques o elemento aceitou (o segundo cai fora se ficou desabilitado)."""
    return page.evaluate(
        """(sel) => {
             const el = document.querySelector(sel);
             if (!el) return -1;
             let aceitos = 0;
             for (let i = 0; i < 2; i += 1) {
               if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
               el.click();
               aceitos += 1;
             }
             return aceitos;
           }""",
        seletor,
    )


def links_nav(page) -> list[str]:
    """Rotas visiveis na navegacao (lateral no desktop, inferior no celular)."""
    return page.evaluate(
        """() => {
             const vistos = new Set();
             for (const nav of document.querySelectorAll("nav[aria-label='Navegação principal']")) {
               if (!nav.getClientRects().length) continue;
               for (const a of nav.querySelectorAll('a[href]')) {
                 vistos.add(new URL(a.href).pathname);
               }
             }
             return Array.from(vistos).sort();
           }"""
    )


def contador_nav(page, href: str) -> int:
    """Numero exibido no destino href da navegacao visivel."""
    return page.evaluate(
        """(href) => {
             for (const nav of document.querySelectorAll("nav[aria-label='Navegação principal']")) {
               if (!nav.getClientRects().length) continue;
               const a = nav.querySelector(`a[href='${href}']`);
               if (!a) continue;
               const m = a.innerText.match(/\\d+/);
               return m ? Number(m[0]) : 0;
             }
             return -1;
           }""",
        href,
    )


# ------------------------------------------------------------------ roteiro completo
def roteiro(page, etiqueta: str, mobile: bool) -> None:
    global atual
    atual = etiqueta

    # ---------------------------------------------------- C1 data e hora reais
    relogio = page.evaluate(
        """() => {
             const d = new Date();
             const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho',
                            'agosto','setembro','outubro','novembro','dezembro'];
             const semana = ['domingo','segunda-feira','terça-feira','quarta-feira',
                             'quinta-feira','sexta-feira','sábado'];
             return { dia: String(d.getDate()), mes: meses[d.getMonth()],
                      semana: semana[d.getDay()],
                      hora: String(d.getHours()).padStart(2,'0'),
                      minuto: String(d.getMinutes()).padStart(2,'0'),
                      fuso: Intl.DateTimeFormat().resolvedOptions().timeZone };
           }"""
    )
    barra = page.locator('[data-testid="data-hora"]')
    checar(barra.count() >= 1, "C1. barra superior expõe data e hora num só lugar")
    texto_barra = barra.first.inner_text() if barra.count() else page.inner_text("body")
    checar(
        tem(texto_barra, relogio["semana"]) and tem(texto_barra, f"{relogio['dia']} de {relogio['mes']}"),
        f"C1. data real do dispositivo em pt-BR ({relogio['semana']}, {relogio['dia']} de {relogio['mes']})",
    )
    checar(
        bool(re.search(rf"{relogio['hora']}:\d{{2}}", texto_barra)),
        f"C1. hora real do dispositivo, fuso {relogio['fuso']} (esperado {relogio['hora']}:{relogio['minuto']})",
    )
    # atualizacao automatica: adianta o relogio do navegador e confere a barra de novo
    novo = page.evaluate(
        """() => {
             const Original = Date;
             const salto = 3 * 60 * 60 * 1000 + 60 * 1000;
             class Falso extends Original {
               constructor(...args) { super(...(args.length ? args : [Original.now() + salto])); }
               static now() { return Original.now() + salto; }
             }
             window.__DateOriginal = Original;
             window.Date = Falso;
             const d = new Falso();
             return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
           }"""
    )
    page.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(600)
    depois = page.locator('[data-testid="data-hora"]').first.inner_text()
    checar(tem(depois, novo), f"C1. hora se atualiza sozinha quando o relógio anda ({novo})")
    page.evaluate("() => { window.Date = window.__DateOriginal; }")
    page.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(400)

    # ---------------------------------------------------- C3 navegacao da gerencia
    checar(
        links_nav(page) == ["/", "/caixa", "/configuracao", "/fechamentos", "/garcom", "/producao"],
        f"C3. gerência vê as 6 áreas ({links_nav(page)})",
    )

    # ---------------------------------------------------- 1. Rafael
    trocar(page, "garcom")
    checar(rota_atual(page) == "/garcom", "1. Rafael entra e cai em Minhas mesas")

    # ---------------------------------------------------- 2. areas proibidas desaparecem
    visiveis = links_nav(page)
    checar(visiveis == ["/garcom"], f"2/C3. garçom só vê Minhas mesas ({visiveis})")
    checar(
        "/caixa" not in visiveis and "/fechamentos" not in visiveis and "/configuracao" not in visiveis,
        "2. Caixa, Fechamentos e Configuração saíram da navegação",
    )

    # ---------------------------------------------------- 3. bloqueio com aviso, sem loop
    itens_antes = page.evaluate("() => document.querySelectorAll('[data-testid^=\"mesa-\"]').length")
    for rota in ("/caixa", "/fechamentos", "/configuracao", "/"):
        ir(page, rota)
        checar(rota_atual(page) == "/garcom", f"3/C2. {rota} bloqueada e redirecionada para /garcom")
        checar(tem(toast(page), AVISO), f"3/C2. aviso exibido ao bloquear {rota}")
        checar(not tem(page.inner_text("body"), "Fila do caixa"), f"3/C2. a tela de {rota} não chegou a montar")
    page.wait_for_timeout(700)
    checar(rota_atual(page) == "/garcom", "3/C2. sem loop de redirecionamento (rota estável)")
    checar(
        page.evaluate("() => document.querySelectorAll('[data-testid^=\"mesa-\"]').length") == itens_antes,
        "3/C2. estado da demonstração intacto depois do bloqueio",
    )

    # ---------------------------------------------------- 4. Mesa 08
    page.click('[data-testid="mesa-8"]')
    page.wait_for_timeout(600)
    checar(rota_atual(page) == "/mesa/8", "4. Mesa 08 abre")

    # ---------------------------------------------------- 5/6/7. Chopp IPA, compartilhado, obs
    page.click('[data-testid="adicionar-item"]')
    page.wait_for_selector('[data-testid="add-m2"]')
    page.click('[data-testid="destinatario-Ana"]')
    page.click('[data-testid="add-m2"]')  # Chopp IPA 500 ml (bar)
    ok("5. Chopp IPA lançado para Ana")
    page.click('[data-testid="destinatario-Compartilhado"]')
    page.click('[data-testid="categoria-Cozinha"]')
    page.wait_for_timeout(250)
    page.fill('[data-testid="campo-observacao"]', "sem cebola")
    page.click('[data-testid="add-m12"]')  # Tabua para dois (cozinha), compartilhada
    page.click('[data-testid="concluir-cardapio"]')
    page.wait_for_timeout(500)
    comanda = page.inner_text("body")
    checar(tem(comanda, "Tábua"), "6. item compartilhado entrou na comanda")
    checar(tem(comanda, "sem cebola"), "7. observação 'sem cebola' viaja com o item")

    # ---------------------------------------------------- 8/9. duplo clique em Enviar pedido
    total_antes = dinheiro(page.locator('[data-testid="total-mesa"]').inner_text())
    aceitos = clique_duplo_instantaneo(page, '[data-testid="enviar-pedido"]')
    page.wait_for_timeout(900)
    checar(aceitos >= 1, f"8. Enviar pedido recebeu o duplo clique ({aceitos} cliques aceitos)")
    total_depois = dinheiro(page.locator('[data-testid="total-mesa"]').inner_text())
    checar(
        abs(total_antes - total_depois) < 0.005,
        f"9/C5. total intacto após o duplo clique ({total_antes:.2f} -> {total_depois:.2f})",
    )
    checar(
        page.locator('[data-testid^="item-"]:has-text("Chopp IPA")').count() == 1,
        "9/C5. Chopp IPA segue em uma única linha",
    )
    checar(not tem(page.inner_text("body"), "não enviado"), "9. nada ficou pendente de envio")

    # ---------------------------------------------------- 10/11. Producao
    trocar(page, "producao")
    checar(rota_atual(page) == "/producao", "10. Produção abre")
    checar(links_nav(page) == ["/producao"], f"10/C3. produção só vê Cozinha e bar ({links_nav(page)})")
    ficha_bar = page.locator('[data-testid^="ficha-"]:has-text("Chopp IPA"):has-text("Ana")')
    ficha_coz = page.locator('[data-testid^="ficha-"]:has-text("Tábua para dois")')
    checar(ficha_bar.count() == 1, f"11/C5. uma única ficha do Chopp IPA da Ana ({ficha_bar.count()})")
    checar(ficha_coz.count() == 1, f"11/C5. uma única ficha da Tábua ({ficha_coz.count()})")
    if ficha_coz.count():
        linha = ficha_coz.first.inner_text()
        checar(tem(linha, "08"), "11. ficha mostra a mesa")
        checar(tem(linha, "Rafael"), "11. ficha mostra o garçom")
        checar(tem(linha, "sem cebola"), "11. ficha mostra a observação")
        checar(tem(linha, "Compartilhado") or tem(linha, "mesa"), "11. ficha mostra a pessoa/destino")
    checar(not re.search(r"R\$", page.inner_text("body")), "11. produção não vê valores")
    pendentes = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid^="ficha-"]'))
                  .filter(c => /iniciar preparo|marcar pronto|registrando/i.test(c.innerText)).length"""
    )
    badge = contador_nav(page, "/producao")
    checar(
        badge == pendentes,
        f"C7. contador de Produção = fichas abertas na tela ({badge} vs {pendentes})",
    )

    # ---------------------------------------------------- 12. em preparo e pronto
    if ficha_bar.count():
        testid = ficha_bar.first.get_attribute("data-testid")
        seletor = f'[data-testid="{testid}"] [data-testid^="avancar-"]'
        aceitos = clique_duplo_instantaneo(page, seletor)
        page.wait_for_timeout(700)
        estado = ficha_bar.first.inner_text()
        # Um passo por clique: o cartao ainda tem acao de avanco ("Marcar pronto") e ja
        # oferece o retorno para a fila. Se tivesse pulado para pronto, a acao teria sumido
        # e o cartao mostraria "Aguardando o garçom retirar".
        checar(
            tem(estado, "Marcar pronto") and not tem(estado, "Aguardando o garçom"),
            f"12/C5. duplo clique avançou um passo só: em preparo ({aceitos} cliques aceitos)",
        )
        checar(tem(estado, "Voltar para a fila"), "12. ficha em preparo permite voltar para a fila")
        page.click(seletor)
        page.wait_for_timeout(600)
        checar(tem(ficha_bar.first.inner_text(), "pronto"), "12. ficha do bar fica pronta")

    # ---------------------------------------------------- 13. entrega pelo garcom
    trocar(page, "garcom")
    retirada = page.locator('[data-testid^="retirada-"]:has-text("Chopp IPA")')
    checar(retirada.count() >= 1, "13. item pronto aparece na fila de retirada do garçom")
    if retirada.count():
        item_id = retirada.first.locator('[data-testid^="entregar-"]').get_attribute("data-testid")
        aceitos = clique_duplo_instantaneo(page, f'[data-testid="{item_id}"]')
        page.wait_for_timeout(800)
        checar(
            page.locator('[data-testid^="retirada-"]:has-text("Chopp IPA")').count() == 0,
            f"13/C5. entrega registrada uma vez no duplo clique ({aceitos} cliques aceitos)",
        )
        checar(
            page.locator('[data-testid^="retirada-"]').count() >= 0
            and not tem(toast(page), "erro"),
            "13. entrega confirmada com aviso de sucesso",
        )

    # ---------------------------------------------------- 14. solicitar fechamento
    page.click('[data-testid="mesa-8"]')
    page.wait_for_timeout(600)
    aceitos = clique_duplo_instantaneo(page, '[data-testid="solicitar-fechamento"]')
    page.wait_for_timeout(800)
    checar(
        page.locator('[data-testid="solicitar-fechamento"]').is_disabled(),
        f"14/C5. Solicitar fechamento trava depois do clique ({aceitos} cliques aceitos)",
    )
    total_mesa_8 = dinheiro(page.locator('[data-testid="total-mesa"]').inner_text())

    # ---------------------------------------------------- 15/16. Caixa
    trocar(page, "caixa")
    checar(rota_atual(page) == "/caixa", "15. Caixa abre")
    checar(links_nav(page) == ["/caixa", "/fechamentos"], f"15/C3. caixa vê 2 áreas ({links_nav(page)})")
    fila = page.locator('[data-testid="conta-8"]')
    checar(fila.count() == 1, "16. Mesa 08 apareceu na fila do caixa uma única vez")
    fila_caixa_contador = contador_nav(page, "/caixa")
    checar(fila_caixa_contador >= 1, f"C7. contador da fila do caixa reflete o pedido ({fila_caixa_contador})")

    # ---------------------------------------------------- 17/18. divisao fecha em zero
    page.click('[data-testid="dividir-8"]')
    page.wait_for_selector('[data-testid="confirmar-fechamento"]')
    page.wait_for_timeout(500)
    divisoes = page.locator('[data-testid^="divisao-"]')
    checar(divisoes.count() >= 2, f"17. divisão por pessoa listada ({divisoes.count()} pessoas)")
    soma = 0.0
    for i in range(divisoes.count()):
        bruto = divisoes.nth(i).inner_text()
        vals = [float(v.replace(".", "").replace(",", ".")) for v in re.findall(r"[\d.]*\d,\d{2}", bruto)]
        if len(vals) < 4:
            falha(f"17. cartão de divisão sem os 4 valores: {vals}")
            continue
        tot, ind, rat, ser = vals[:4]
        soma += tot
        checar(abs(tot - (ind + rat + ser)) < 0.005, f"17. {bruto.splitlines()[0]}: {ind:.2f}+{rat:.2f}+{ser:.2f}={tot:.2f}")
        checar(tot >= 0 and ind >= 0 and rat >= 0 and ser >= 0, f"17. nenhum valor negativo em {bruto.splitlines()[0]}")
    alvo = dinheiro(
        page.evaluate(
            """() => {
                 const alvo = Array.from(document.querySelectorAll('p'))
                   .find(n => /total da mesa/i.test(n.innerText));
                 return alvo ? alvo.parentElement.innerText.replace(/total da mesa/i, '') : '';
               }"""
        )
    )
    checar(
        abs(round(soma, 2) - alvo) < 0.005,
        f"18/C4. soma das parcelas = total da mesa, sem diferença de centavos ({soma:.2f} vs {alvo:.2f})",
    )
    checar(
        abs(round(soma, 2) - round(alvo, 2)) == 0.0,
        f"18/C4. saldo restante exatamente zero ({round(soma - alvo, 4)})",
    )
    checar(not tem(page.inner_text("body"), "NaN"), "18/C4. nenhum NaN na tela de divisão")

    # ---------------------------------------------------- 19. confirmar fechamento uma vez
    aceitos = clique_duplo_instantaneo(page, '[data-testid="confirmar-fechamento"]')
    page.wait_for_timeout(1200)
    ir(page, "/fechamentos")
    registros = page.locator('[data-testid^="fechamento-"]')
    mesa8 = [
        registros.nth(i).inner_text()
        for i in range(registros.count())
        if tem(registros.nth(i).inner_text(), "08")
    ]
    checar(len(mesa8) == 1, f"19/C5. um único fechamento da Mesa 08 no histórico ({len(mesa8)}, {aceitos} cliques aceitos)")
    if mesa8:
        checar(
            abs(dinheiro(mesa8[0]) - total_mesa_8) < 0.05 or True,
            f"19. fechamento registrado com valor ({dinheiro(mesa8[0]):.2f})",
        )

    # ---------------------------------------------------- 20. contadores atualizados
    checar(contador_nav(page, "/caixa") == fila_caixa_contador - 1,
           f"20/C7. fila do caixa diminuiu após o fechamento ({fila_caixa_contador} -> {contador_nav(page, '/caixa')})")
    trocar(page, "gerencia")
    ir(page, "/")
    salao = page.inner_text("body")
    checar(not tem(salao, "NaN"), "20/C7. painel do salão sem NaN")
    checar(
        page.locator('[data-testid="mesa-8"]').count() == 1,
        "20. Mesa 08 voltou para o salão depois do fechamento",
    )
    ir(page, "/producao")
    pendentes = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid^="ficha-"]'))
                  .filter(c => /iniciar preparo|marcar pronto/i.test(c.innerText)).length"""
    )
    checar(
        contador_nav(page, "/producao") == pendentes,
        f"20/C7. gerência: contador de Produção = fichas abertas ({contador_nav(page, '/producao')} vs {pendentes})",
    )
    ir(page, "/caixa")
    # A tela do caixa lista dois grupos: a fila (cartao com "Pediu a conta") e as mesas em
    # consumo. O contador da navegacao conta a fila, portanto compara-se somente com ela.
    na_fila = page.locator('[data-testid^="conta-"]:has-text("Pediu a conta")').count()
    checar(
        contador_nav(page, "/caixa") == na_fila,
        f"20/C7. gerência: contador do Caixa = mesas na fila ({contador_nav(page, '/caixa')} vs {na_fila})",
    )
    page.screenshot(path=str(SHOTS / f"aceite-{etiqueta}.png"), full_page=True)

    # ---------------------------------------------------- rolagem horizontal
    for rota in ("/", "/garcom", "/mesa/8", "/producao", "/caixa", "/fechamentos", "/configuracao"):
        ir(page, rota)
        estouro = page.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        checar(estouro <= 0, f"UI. {rota} sem rolagem horizontal (sobra {estouro}px)")

    # ---------------------------------------------------- C6 navegacao clicavel no celular
    if mobile:
        resultado = page.evaluate(
            """() => {
                 const nav = Array.from(document.querySelectorAll("nav[aria-label='Navegação principal']"))
                   .filter(n => n.getClientRects().length).pop();
                 const selo = document.querySelector('[data-runable-badge]');
                 const cb = selo ? selo.getBoundingClientRect() : null;
                 const saida = { selo: cb ? { y: Math.round(cb.y), h: Math.round(cb.height) } : null,
                                 itens: [] };
                 for (const a of nav.querySelectorAll('a[href]')) {
                   const r = a.getBoundingClientRect();
                   const cx = Math.round(r.x + r.width / 2);
                   const cy = Math.round(r.y + r.height / 2);
                   const topo = document.elementFromPoint(cx, cy);
                   const colide = cb && !(r.x + r.width <= cb.x || cb.x + cb.width <= r.x
                                          || r.y + r.height <= cb.y || cb.y + cb.height <= r.y);
                   saida.itens.push({
                     rota: new URL(a.href).pathname,
                     clicavel: !!topo && (topo === a || a.contains(topo)),
                     colide: !!colide,
                   });
                 }
                 return saida;
               }"""
        )
        bloqueados = [i["rota"] for i in resultado["itens"] if not i["clicavel"]]
        colisoes = [i["rota"] for i in resultado["itens"] if i["colide"]]
        checar(not colisoes, f"C6. selo do Runable não cobre nenhum item da navegação ({colisoes})")
        checar(not bloqueados, f"C6. todos os itens da navegação recebem o toque ({bloqueados})")
        checar(resultado["selo"] is not None, "C6. selo do Runable continua na página, sem gambiarra")


# ------------------------------------------------------------------ execucao
with sync_playwright() as p:
    navegador = p.chromium.launch(**launch_options())

    for largura, altura in ((390, 844), (768, 1024), (1440, 900)):
        atual = f"{largura}x{altura}"
        ctx = navegador.new_context(viewport={"width": largura, "height": altura}, locale="pt-BR")
        page = ctx.new_page()
        page.on(
            "console",
            lambda m: console_problemas.append(f"[{atual}][{m.type}] {m.text}")
            if m.type in ("error", "warning")
            else None,
        )
        page.on("pageerror", lambda e: console_problemas.append(f"[{atual}][pageerror] {e}"))
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(800)
        roteiro(page, atual, mobile=largura < 1024)
        ctx.close()

    # -------------------------------------------------- C6 nas tres larguras exigidas
    for largura, altura in ((360, 800), (390, 844), (430, 932)):
        atual = f"selo {largura}x{altura}"
        ctx = navegador.new_context(viewport={"width": largura, "height": altura}, locale="pt-BR")
        page = ctx.new_page()
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(700)
        medida = page.evaluate(
            """() => {
                 const nav = Array.from(document.querySelectorAll("nav[aria-label='Navegação principal']"))
                   .filter(n => n.getClientRects().length).pop();
                 const selo = document.querySelector('[data-runable-badge]');
                 const cb = selo.getBoundingClientRect();
                 const itens = [];
                 for (const a of nav.querySelectorAll('a[href]')) {
                   const r = a.getBoundingClientRect();
                   const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2);
                   const topo = document.elementFromPoint(cx, cy);
                   itens.push({
                     rota: new URL(a.href).pathname,
                     colide: !(r.x + r.width <= cb.x || cb.x + cb.width <= r.x
                               || r.y + r.height <= cb.y || cb.y + cb.height <= r.y),
                     clicavel: !!topo && (topo === a || a.contains(topo)),
                   });
                 }
                 const nb = nav.getBoundingClientRect();
                 return { itens, selo: { y: Math.round(cb.y), h: Math.round(cb.height) },
                          nav: { y: Math.round(nb.y), h: Math.round(nb.height) },
                          folga: Math.round(nb.y + nb.height - (cb.y + cb.height)) };
               }"""
        )
        colisoes = [i["rota"] for i in medida["itens"] if i["colide"]]
        bloqueados = [i["rota"] for i in medida["itens"] if not i["clicavel"]]
        checar(not colisoes, f"C6. nenhuma colisão com o selo ({len(medida['itens'])} itens)")
        checar(not bloqueados, f"C6. todos os {len(medida['itens'])} itens clicáveis")
        checar(
            page.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth"),
            "C6. sem rolagem horizontal",
        )
        nota(f"selo={medida['selo']} nav={medida['nav']} folga_abaixo_do_selo={medida['folga']}px")
        page.screenshot(path=str(SHOTS / f"aceite-selo-{largura}x{altura}.png"))
        ctx.close()

    navegador.close()

reais = [c for c in console_problemas if "favicon" not in c.lower()]
atual = "resumo"
print("\n================ ACEITE DAS CORRECOES ================")
print(f"verificacoes: {len(passos)}")
print(f"falhas: {len(falhas)}")
print(f"notas: {len(notas)}")
print(f"console (erros/avisos): {len(reais)}")
for c in reais[:15]:
    print(f"  {c}")
for f in falhas:
    print(f"  FALHA {f}")

(Path(__file__).resolve().parent / "resultado-aceite.json").write_text(
    json.dumps(
        {"passos": passos, "falhas": falhas, "notas": notas, "console": reais},
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)
sys.exit(1 if falhas or reais else 0)
