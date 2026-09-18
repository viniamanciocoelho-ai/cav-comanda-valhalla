"""Diagnostico: reproduz o acesso do garcom a /caixa e mede o selo Runable vs barra inferior."""

import json
import sys

from playwright.sync_api import sync_playwright
from browser_runtime import launch_options

BASE = "http://localhost:4200"
erros: list[str] = []
notas: list[str] = []


def trocar_perfil(page, rotulo: str) -> None:
    page.get_by_test_id("trocar-perfil-lateral").click(timeout=5000)
    page.get_by_role("button", name=rotulo).first.click()
    page.wait_for_timeout(400)


with sync_playwright() as p:
    navegador = p.chromium.launch(**launch_options())

    # ---------------------------------------------------------------- desktop
    ctx = navegador.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.on("console", lambda m: erros.append(f"console:{m.type}:{m.text}") if m.type == "error" else None)
    page.goto(BASE, wait_until="networkidle")

    trocar_perfil(page, "Rafael (garçom)")
    notas.append(f"apos trocar para Rafael: url={page.url}")

    # A) navegacao SPA via history.pushState (o que o usuario faria digitando a rota)
    page.evaluate("window.history.pushState({}, '', '/caixa'); window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_timeout(700)
    notas.append(f"A) pushState /caixa -> url={page.url} titulo={page.locator('h1').first.inner_text()}")

    # B) load direto da URL /caixa (recarrega a pagina: perfil volta para Gerencia)
    page.goto(f"{BASE}/caixa", wait_until="networkidle")
    notas.append(f"B) goto /caixa apos reload -> url={page.url} titulo={page.locator('h1').first.inner_text()}")
    trocar_perfil(page, "Rafael (garçom)")
    page.wait_for_timeout(700)
    notas.append(f"B2) trocou para Rafael estando em /caixa -> url={page.url} titulo={page.locator('h1').first.inner_text()}")
    notas.append("B3) toast visivel: " + page.locator("[data-testid='toast-host']").inner_text().replace("\n", " | ") if page.locator("[data-testid='toast-host']").count() else "B3) sem toast-host")

    # C) links de navegacao visiveis para o garcom
    links = page.locator("nav[aria-label='Navegação principal']").first.locator("a")
    notas.append("C) nav lateral do garcom: " + ", ".join(links.nth(i).inner_text().split("\n")[0] for i in range(links.count())))
    ctx.close()

    # ---------------------------------------------------------------- mobile
    for largura, altura in ((360, 800), (390, 844), (430, 932)):
        ctx = navegador.new_context(viewport={"width": largura, "height": altura})
        page = ctx.new_page()
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(500)
        badge = page.locator("[data-runable-badge]")
        nav = page.locator("nav[aria-label='Navegação principal']").last
        cb = badge.bounding_box()
        cn = nav.bounding_box()
        itens = nav.locator("a")
        colisoes = []
        for i in range(itens.count()):
            box = itens.nth(i).bounding_box()
            if not box or not cb:
                continue
            sobrepoe = not (
                box["x"] + box["width"] <= cb["x"]
                or cb["x"] + cb["width"] <= box["x"]
                or box["y"] + box["height"] <= cb["y"]
                or cb["y"] + cb["height"] <= box["y"]
            )
            if sobrepoe:
                colisoes.append(itens.nth(i).inner_text().replace("\n", " "))
        notas.append(f"{largura}x{altura} badge={cb} nav={cn} colisoes={colisoes}")
        scroll_x = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        notas.append(f"{largura}x{altura} rolagem horizontal: {scroll_x}")
        ctx.close()

    navegador.close()

print(json.dumps({"notas": notas, "erros": erros}, ensure_ascii=False, indent=2))
sys.exit(0)
