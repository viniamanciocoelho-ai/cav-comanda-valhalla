"""Verificação funcional em runtime do CAV Comanda (V2 modo garçom).

Percorre o fluxo real garçom -> produção -> garçom -> caixa -> fechamento em uma única
sessão SPA (nunca usa page.goto depois do primeiro load, para provar que o estado é
compartilhado entre rotas), coleta erros de console e mede overflow horizontal.
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

console_problemas: list[str] = []
falhas: list[str] = []
notas: list[str] = []
passos: list[str] = []


def ok(msg: str) -> None:
    passos.append(f"OK   {msg}")
    print(f"OK   {msg}", flush=True)


def falha(msg: str) -> None:
    falhas.append(msg)
    passos.append(f"FALHA {msg}")
    print(f"FALHA {msg}", flush=True)


def nota(msg: str) -> None:
    notas.append(msg)
    passos.append(f"NOTA {msg}")
    print(f"NOTA {msg}", flush=True)


def tem(corpo: str, agulha: str) -> bool:
    """Compara texto ignorando caixa: a UI usa `uppercase` no CSS, e innerText
    devolve o texto já transformado ("SALÃO", "CARDÁPIO PROVISÓRIO")."""
    return agulha.casefold() in corpo.casefold()


def contar(corpo: str, agulha: str) -> int:
    return corpo.casefold().count(agulha.casefold())


def checar(cond: bool, msg: str) -> bool:
    if cond:
        ok(msg)
    else:
        falha(msg)
    return cond


def overflow(page, rotulo: str) -> None:
    dados = page.evaluate(
        "() => ({ sw: document.documentElement.scrollWidth,"
        " cw: document.documentElement.clientWidth })"
    )
    if dados["sw"] > dados["cw"] + 1:
        falha(f"overflow horizontal em {rotulo}: scrollWidth {dados['sw']} > clientWidth {dados['cw']}")
    else:
        ok(f"sem overflow horizontal em {rotulo} ({dados['cw']}px)")


def dinheiro(texto: str) -> float:
    limpo = re.sub(r"[^\d,.-]", "", texto).replace(".", "").replace(",", ".")
    return float(limpo)


def shot(page, nome: str) -> None:
    page.screenshot(path=str(SHOTS / f"{nome}.png"), full_page=True)


with sync_playwright() as p:
    navegador = p.chromium.launch(**launch_options())
    ctx = navegador.new_context(viewport={"width": 1440, "height": 950}, locale="pt-BR")
    page = ctx.new_page()

    page.on(
        "console",
        lambda m: console_problemas.append(f"[{m.type}] {m.text}")
        if m.type in ("error", "warning")
        else None,
    )
    page.on("pageerror", lambda e: console_problemas.append(f"[pageerror] {e}"))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)

    # ---------------------------------------------------------------- 1. Salão (gerência)
    checar(tem(page.inner_text("body"), "Salão"), "gerência abre no Salão")
    checar(page.locator('[data-testid="abrir-mesa-08"]').count() == 1, "atalho da mesa do roteiro presente")
    overflow(page, "/ gerência desktop")
    shot(page, "01-salao-gerencia")

    # ---------------------------------------------------------------- 2. Troca para garçom
    page.click('[data-testid="trocar-perfil"]')
    page.wait_for_selector('[data-testid="perfil-garcom"]')
    page.click('[data-testid="perfil-garcom"]')
    page.wait_for_timeout(500)
    checar(page.evaluate("() => location.pathname") == "/garcom", "garçom cai em /garcom")
    corpo = page.inner_text("body")
    checar(
        not tem(corpo, "Configuração") and not tem(corpo, "Ajustes"),
        "garçom não vê navegação de Ajustes",
    )
    checar(
        not tem(corpo, "Fechamentos") and not tem(corpo, "Contas"),
        "garçom não vê navegação de Fechamentos",
    )
    overflow(page, "/garcom desktop")
    shot(page, "02-garcom-turno")

    # Garçom não deve alcançar rota proibida nem digitando (guarda do AppShell)
    page.evaluate("() => history.pushState({}, '', '/configuracao')")
    page.evaluate("() => window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_timeout(500)
    checar(
        page.evaluate("() => location.pathname") == "/garcom",
        "garçom é devolvido para /garcom ao tentar /configuracao",
    )

    # ---------------------------------------------------------------- 3. Abre mesa livre 3
    page.click('[data-testid="abrir-3"]')
    page.wait_for_timeout(500)
    checar(page.evaluate("() => location.pathname") == "/mesa/3", "abrir mesa livre leva à comanda")

    # pessoa nova
    page.fill('[data-testid="nova-pessoa"]', "Sigurd")
    page.click('[data-testid="adicionar-pessoa"]')
    page.wait_for_timeout(400)
    checar(tem(page.inner_text("body"), "Sigurd"), "pessoa adicionada na mesa em branco")

    # ---------------------------------------------------------------- 4. Lança itens
    page.click('[data-testid="adicionar-item"]')
    page.wait_for_selector('[data-testid="add-m1"]')
    page.click('[data-testid="destinatario-Sigurd"]')
    page.click('[data-testid="add-m1"]')  # CHOOP PIL 500ML 15,00
    page.click('[data-testid="categoria-Porções"]')
    page.wait_for_timeout(250)
    page.click('[data-testid="add-m7"]')  # BATATA COM CHEDDAR E BACON 28,00
    page.click('[data-testid="destinatario-Compartilhado"]')
    page.click('[data-testid="add-m9"]')  # PORÇ. TUL. TRAD 20,00 compartilhado
    shot(page, "03-cardapio")
    page.click('[data-testid="concluir-cardapio"]')
    page.wait_for_timeout(400)

    total_txt = page.inner_text('[data-testid="total-mesa"]')
    esperado = (15 + 28 + 20) * 1.1
    checar(
        abs(dinheiro(total_txt) - esperado) < 0.02,
        f"total da mesa com serviço 10% correto ({total_txt} ~ {esperado:.2f})",
    )
    overflow(page, "/mesa/3 desktop")
    shot(page, "04-comanda-mesa-3")

    # ---------------------------------------------------------------- 5. Duplo clique no envio
    botao = page.locator('[data-testid="enviar-pedido"]')
    botao.click()
    try:
        botao.click(timeout=800)
        nota("segundo clique no envio foi aceito pelo DOM (guarda de idempotência deve segurar)")
    except Exception:
        ok("botão de envio trava no primeiro clique")
    page.wait_for_timeout(900)
    shot(page, "05-pedido-enviado")

    # ---------------------------------------------------------------- 6. Produção recebe
    page.click('[data-testid="trocar-perfil"]')
    page.wait_for_selector('[data-testid="perfil-producao"]')
    page.click('[data-testid="perfil-producao"]')
    page.wait_for_timeout(500)
    checar(page.evaluate("() => location.pathname") == "/producao", "produção cai em /producao")

    # As fichas da mesa 3 são as únicas com a pessoa "Sigurd" nesta sessão; filtrar por elas
    # evita contar fichas demonstrativas das mesas 2/6/8 (que já têm Chopp Pilsen).
    fichas_m3 = page.locator('[data-testid^="ficha-"]:has-text("Sigurd")')
    checar(fichas_m3.count() >= 1, f"ficha da mesa 3 chegou na produção ({fichas_m3.count()})")
    texto_m3 = "\n".join(fichas_m3.all_inner_texts())
    checar(tem(texto_m3, "03"), "produção mostra a mesa de origem")
    checar(tem(texto_m3, "Sigurd"), "produção identifica a pessoa do item")
    checar(tem(texto_m3, "Rafael"), "produção identifica o garçom responsável")
    checar(tem(texto_m3, "PORÇ. TUL. TRAD"), "item compartilhado também chegou na produção")

    # duplicidade: o Chopp lançado uma vez deve aparecer uma única vez nas fichas da mesa 3
    ocorrencias = contar(texto_m3, "CHOOP PIL 500ML")
    checar(
        ocorrencias == 1,
        f"nenhum item duplicado por duplo clique (CHOOP PIL aparece {ocorrencias}x na mesa 3)",
    )
    # e o total de fichas da mesa 3 não pode dobrar: no máximo uma por destino (bar + cozinha)
    checar(fichas_m3.count() <= 2, f"envio não duplicou fichas (mesa 3 tem {fichas_m3.count()})")
    overflow(page, "/producao desktop")
    shot(page, "06-producao-fila")

    # avança SOMENTE as fichas da mesa 3 (identificadas pela pessoa Sigurd) até "pronto"
    for _ in range(12):
        alvo = page.locator('[data-testid^="ficha-"]:has-text("Sigurd")').locator(
            '[data-testid^="avancar-"]'
        )
        if alvo.count() == 0:
            break
        alvo.first.click()
        page.wait_for_timeout(350)
    fichas_bruno = page.locator('[data-testid^="ficha-"]:has-text("Sigurd")')
    checar(fichas_bruno.count() >= 1, f"mesa 3 gerou {fichas_bruno.count()} ficha(s) (bar + cozinha)")
    checar(
        page.locator('[data-testid^="ficha-"]:has-text("Sigurd") [data-testid^="avancar-"]').count()
        == 0,
        "todas as fichas da mesa 3 chegaram a pronto",
    )
    shot(page, "07-producao-prontos")

    # ---------------------------------------------------------------- 7. Garçom entrega
    page.click('[data-testid="trocar-perfil"]')
    page.click('[data-testid="perfil-garcom"]')
    page.wait_for_timeout(500)
    retiradas = page.locator('[data-testid^="retirada-"]')
    checar(retiradas.count() >= 1, f"fila de retirada do garçom tem {retiradas.count()} item(ns) prontos")
    checar(
        page.locator('[data-testid^="retirada-"]:has-text("Sigurd")').count() >= 1,
        "itens da mesa 3 aparecem na retirada com a pessoa certa",
    )
    shot(page, "08-garcom-retirada")
    for _ in range(12):
        entregar = page.locator('[data-testid^="retirada-"]:has-text("Sigurd")').locator(
            '[data-testid^="entregar-"]'
        )
        if entregar.count() == 0:
            break
        entregar.first.click()
        page.wait_for_timeout(300)
    checar(
        page.locator('[data-testid^="retirada-"]:has-text("Sigurd")').count() == 0,
        "itens da mesa 3 saem da retirada depois de entregues",
    )

    # ---------------------------------------------------------------- 8. Pede a conta na mesa 3
    cartao = page.locator('[data-testid="mesa-3"]')
    checar(cartao.count() == 1, "mesa 3 aparece entre as mesas abertas do garçom")
    if cartao.count():
        cartao.click()
        page.wait_for_timeout(600)
    if page.evaluate("() => location.pathname") != "/mesa/3":
        page.evaluate("() => history.pushState({}, '', '/mesa/3')")
        page.evaluate("() => window.dispatchEvent(new PopStateEvent('popstate'))")
        page.wait_for_timeout(600)
    checar(page.evaluate("() => location.pathname") == "/mesa/3", "volta para a comanda da mesa 3")
    checar(
        tem(page.inner_text("body"), "Entregue"),
        "estado compartilhado: comanda reflete os itens entregues pela produção/garçom",
    )
    page.click('[data-testid="solicitar-fechamento"]')
    page.wait_for_timeout(600)
    checar(
        page.locator('[data-testid="solicitar-fechamento"]').is_disabled(),
        "solicitar fechamento fica travado depois de pedir a conta",
    )
    shot(page, "09-conta-solicitada")

    # ---------------------------------------------------------------- 9. Caixa divide e encerra
    page.click('[data-testid="trocar-perfil"]')
    page.click('[data-testid="perfil-caixa"]')
    page.wait_for_timeout(500)
    checar(page.evaluate("() => location.pathname") == "/caixa", "caixa cai em /caixa")
    checar(
        page.locator('[data-testid="conta-3"]').count() == 1,
        "mesa 3 entrou na fila do caixa",
    )
    overflow(page, "/caixa desktop")
    shot(page, "10-caixa-fila")

    page.click('[data-testid="dividir-3"]')
    page.wait_for_selector('[data-testid="confirmar-fechamento"]')
    page.wait_for_timeout(400)
    folha = page.inner_text('[role="dialog"], [data-testid="dialogo-fechamento"], body')
    checar(tem(folha, "Sem emissão real") or tem(folha, "simula"), "aviso de NFC-e simulada visível")
    shot(page, "11-caixa-divisao")

    # soma da divisão tem de fechar com o total da mesa
    divisoes = page.locator('[data-testid^="divisao-"]')
    checar(divisoes.count() >= 1, f"divisão por pessoa listada ({divisoes.count()} pessoa(s))")
    # Cada cartão lista, nesta ordem: total da pessoa, consumo individual, rateio, serviço.
    valores = []
    for i in range(divisoes.count()):
        bruto = divisoes.nth(i).inner_text()
        achados = [dinheiro(v) for v in re.findall(r"R\$\s*[\d.]*\d,\d{2}", bruto)]
        if len(achados) < 4:
            falha(f"cartão de divisão sem os 4 valores esperados: {achados}")
            continue
        total_p, individual, rateio, servico = achados[:4]
        valores.append(total_p)
        checar(
            abs(total_p - (individual + rateio + servico)) < 0.02,
            f"divisão de {bruto.splitlines()[0]} soma consumo+rateio+serviço"
            f" ({individual:.2f}+{rateio:.2f}+{servico:.2f}={total_p:.2f})",
        )
    soma = round(sum(valores), 2)
    total_conta = dinheiro(
        page.evaluate(
            """() => {
                 const alvo = Array.from(document.querySelectorAll('p'))
                   .find(n => /total da mesa/i.test(n.innerText));
                 return alvo ? alvo.parentElement.innerText : '';
               }"""
        )
    )
    checar(
        abs(soma - total_conta) < 0.05,
        f"soma da divisão fecha com o total da conta ({soma:.2f} vs {total_conta:.2f})",
    )
    checar(
        abs(total_conta - esperado) < 0.05,
        f"total do caixa bate com consumo + serviço 10% ({total_conta:.2f} vs {esperado:.2f})",
    )

    # taxa de serviço: só o caixa pode alternar
    checar(
        page.locator('[data-testid="alternar-servico"]').count() == 1,
        "controle da taxa de serviço existe no caixa",
    )
    page.click('[data-testid="alternar-servico"]')
    page.wait_for_timeout(400)
    sem_servico = page.inner_text("body")
    checar(tem(sem_servico, "retirad"), "retirar a taxa de serviço reflete na tela")
    shot(page, "12-servico-retirado")
    page.click('[data-testid="alternar-servico"]')
    page.wait_for_timeout(400)

    page.click('[data-testid="simular-nfce"]')
    page.wait_for_timeout(500)
    page.click('[data-testid="confirmar-fechamento"]')
    page.wait_for_timeout(900)
    checar(
        page.evaluate("() => location.pathname") == "/fechamentos",
        "confirmar fechamento leva ao histórico",
    )
    hist = page.inner_text("body")
    checar("03" in hist, "fechamento da mesa 3 aparece no histórico")
    checar(tem(hist, "simulada"), "histórico registra a NFC-e como simulada")
    checar(
        tem(hist, "Rafael"),
        "histórico guarda o garçom responsável pela mesa fechada",
    )
    overflow(page, "/fechamentos desktop")
    shot(page, "13-fechamentos")

    # ---------------------------------------------------------------- 10. Roteiro (gerência)
    page.click('[data-testid="trocar-perfil"]')
    page.click('[data-testid="perfil-gerencia"]')
    page.wait_for_timeout(500)
    page.click('[data-testid="alternar-roteiro"]')
    page.wait_for_selector('[data-testid="painel-roteiro"]')
    page.wait_for_timeout(400)
    shot(page, "14-roteiro")
    avancos = 0
    for _ in range(20):
        prox = page.locator('[data-testid="roteiro-proximo"]')
        if prox.count() == 0 or prox.is_disabled():
            break
        prox.click()
        page.wait_for_timeout(180)
        avancos += 1
    rotulo = page.locator('[data-testid="painel-roteiro"]').inner_text()
    checar("14 de 14" in rotulo, f"roteiro chega ao passo 14 de 14 ({avancos} avanços manuais)")
    checar(
        tem(rotulo, "confirmad"),
        "painel do roteiro contabiliza ações já confirmadas no sistema",
    )
    # a barra superior nao pode ficar coberta pelo painel
    caixa_toggle = page.locator('[data-testid="alternar-roteiro"]').bounding_box()
    caixa_painel = page.locator('[data-testid="painel-roteiro"]').bounding_box()
    checar(
        caixa_toggle is not None
        and caixa_painel is not None
        and caixa_toggle["x"] + caixa_toggle["width"] <= caixa_painel["x"] + 1,
        "painel do roteiro não cobre o botão da barra superior",
    )
    page.click('[aria-label="Fechar roteiro"]')
    page.wait_for_timeout(300)
    checar(
        page.locator('[data-testid="painel-roteiro"]').count() == 0,
        "roteiro fecha pelo botão do próprio painel",
    )

    # mesa do roteiro continua íntegra
    page.click('[data-testid="abrir-mesa-08"]')
    page.wait_for_timeout(600)
    checar(page.evaluate("() => location.pathname") == "/mesa/8", "atalho abre a mesa do roteiro")
    m8 = page.inner_text("body")
    checar(tem(m8, "Dados demonstrativos"), "comanda marcada como demonstrativa")
    checar(tem(m8, "Cardápio provisório"), "cardápio marcado como provisório")
    overflow(page, "/mesa/8 desktop")
    shot(page, "15-mesa-8-desktop")

    # ---------------------------------------------------------------- 11. Mobile 390px
    ctx_mob = navegador.new_context(
        viewport={"width": 390, "height": 844},
        locale="pt-BR",
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    mob = ctx_mob.new_page()
    mob.on("pageerror", lambda e: console_problemas.append(f"[mobile pageerror] {e}"))
    mob.on(
        "console",
        lambda m: console_problemas.append(f"[mobile {m.type}] {m.text}")
        if m.type in ("error", "warning")
        else None,
    )
    for rota, nome in [
        ("/", "m-salao"),
        ("/garcom", "m-garcom"),
        ("/mesa/8", "m-mesa-8"),
        ("/producao", "m-producao"),
        ("/caixa", "m-caixa"),
        ("/fechamentos", "m-fechamentos"),
        ("/configuracao", "m-configuracao"),
    ]:
        mob.goto(BASE + rota, wait_until="networkidle")
        mob.wait_for_timeout(700)
        destino = mob.evaluate("() => location.pathname")
        if destino != rota:
            nota(f"mobile {rota} redirecionou para {destino} (guarda de perfil)")
        overflow(mob, f"{rota} mobile 390px")
        mob.screenshot(path=str(SHOTS / f"{nome}.png"), full_page=True)

    # zoom 200% aproximado: viewport estreito com escala
    ctx_zoom = navegador.new_context(viewport={"width": 720, "height": 600}, locale="pt-BR")
    z = ctx_zoom.new_page()
    z.goto(BASE + "/mesa/8", wait_until="networkidle")
    z.evaluate("() => { document.documentElement.style.zoom = '2'; }")
    z.wait_for_timeout(700)
    overflow(z, "/mesa/8 com zoom 200%")
    z.screenshot(path=str(SHOTS / "16-zoom-200.png"), full_page=True)

    # foco visível por teclado
    z.evaluate("() => { document.documentElement.style.zoom = '1'; }")
    z.wait_for_timeout(300)
    for _ in range(4):
        z.keyboard.press("Tab")
    foco = z.evaluate(
        """() => {
             const el = document.activeElement;
             if (!el || el === document.body) return null;
             const s = getComputedStyle(el);
             return { tag: el.tagName, outline: s.outlineStyle, width: s.outlineWidth,
                      ring: s.boxShadow };
           }"""
    )
    if foco is None:
        falha("navegação por Tab não move o foco para nenhum controle")
    else:
        visivel = foco["outline"] not in ("none", "") or (foco["ring"] and foco["ring"] != "none")
        checar(bool(visivel), f"foco de teclado visível em <{foco['tag']}> ({foco['outline']} {foco['width']})")

    navegador.close()

# ---------------------------------------------------------------------- relatório
ruido = ("Download the React DevTools", "vite", "[hmr]", "Lit is in dev mode")
console_reais = [c for c in console_problemas if not any(r in c for r in ruido)]

resumo = {
    "passos": passos,
    "falhas": falhas,
    "notas": notas,
    "console": console_reais,
}
(Path(__file__).resolve().parent / "resultado.json").write_text(
    json.dumps(resumo, ensure_ascii=False, indent=2)
)

print("\n================ RESUMO ================")
print(f"passos verificados: {len(passos)}")
print(f"falhas: {len(falhas)}")
for f in falhas:
    print("  -", f)
print(f"notas: {len(notas)}")
for n in notas:
    print("  -", n)
print(f"console (erros/avisos reais): {len(console_reais)}")
for c in console_reais[:25]:
    print("  -", c)

sys.exit(1 if falhas or console_reais else 0)
