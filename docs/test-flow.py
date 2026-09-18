import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "e2e"))
from browser_runtime import launch_options

BASE = "http://localhost:4200"
OUT = Path(__file__).resolve().parent / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

RES = {"desktop": (1365, 900), "tablet": (768, 1024), "mobile": (375, 812)}
errors = []
log = []


def hook(page, tag):
    page.on("console", lambda m: errors.append(f"[{tag}] console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror: {e}"))


def overflow(page):
    return page.evaluate("() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})")


with sync_playwright() as p:
    browser = p.chromium.launch(**launch_options())

    # ---------- fluxo completo no desktop ----------
    ctx = browser.new_context(viewport={"width": 1365, "height": 900}, device_scale_factor=2, locale="pt-BR")
    page = ctx.new_page()
    hook(page, "desktop")
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / "01-salao-desktop.png"))
    log.append(("salao", overflow(page)))

    # abrir mesa 08
    page.click("[data-testid=abrir-mesa-08]")
    page.wait_for_timeout(500)
    total_antes = page.inner_text("[data-testid=total-mesa]")
    page.screenshot(path=f"{OUT}/02-mesa08-desktop.png")

    # adicionar item para Ana
    page.click("[data-testid=adicionar-item]")
    page.wait_for_timeout(400)
    page.click("[data-testid='destinatario-Ana']")
    page.click("[data-testid=add-m2]")  # Chopp IPA 500 ml, bar
    page.click("[data-testid=add-m9]")  # Asas de Valquiria, cozinha
    page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/03-cardapio-desktop.png")
    page.click("dialog[data-testid=dialogo-cardapio] button:has-text('Concluir')")
    page.wait_for_timeout(400)
    total_depois = page.inner_text("[data-testid=total-mesa]")
    log.append(("total mesa antes/depois", total_antes, total_depois))

    # filtro por pessoa
    page.click("[data-testid='aba-Ana']")
    page.wait_for_timeout(300)
    itens_ana = page.locator("li[data-testid^=item-]").count()
    log.append(("itens da Ana", itens_ana))
    page.click("[data-testid='aba-Todos']")

    # enviar pedido
    page.click("[data-testid=enviar-pedido]")
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/04-pedido-enviado-desktop.png")
    novos_restantes = page.locator("text=Novo item").count()
    log.append(("itens 'Novo item' apos envio", novos_restantes))

    # producao
    page.click("nav[aria-label='Navegação principal'] a[href='/producao']")
    page.wait_for_timeout(600)
    fichas = page.locator("li[data-testid^=ficha-]").count()
    log.append(("fichas na producao", fichas))
    page.screenshot(path=f"{OUT}/05-producao-desktop.png")
    primeira = page.locator("li[data-testid^=ficha-]").first
    fid = primeira.get_attribute("data-testid").replace("ficha-", "")
    page.click(f"[data-testid=avancar-{fid}]")
    page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/06-producao-status-desktop.png")

    # voltar para mesa e fechar conta
    page.goto(f"{BASE}/mesa/8", wait_until="networkidle")
    page.wait_for_timeout(400)
    page.click("[data-testid=dividir-conta]")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/07-divisao-desktop.png")
    page.click("[data-testid=simular-nfce]")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/08-nfce-simulada-desktop.png")
    page.click("[data-testid=confirmar-fechamento]")
    page.wait_for_timeout(800)
    url_pos = page.url
    log.append(("url apos fechamento", url_pos))
    page.screenshot(path=f"{OUT}/09-fechamentos-desktop.png")
    registros = page.locator("li[data-testid^=fechamento-]").count()
    log.append(("registros de fechamento", registros))

    # configuracao + tema claro
    page.click("nav[aria-label='Navegação principal'] a[href='/configuracao']")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/10-configuracao-desktop.png")
    page.click("[data-testid=theme-toggle]")
    page.wait_for_timeout(500)
    tema = page.evaluate("() => document.documentElement.dataset.theme")
    log.append(("tema apos toggle", tema))
    page.click("nav[aria-label='Navegação principal'] a[href='/mesa/8']")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/11a-mesa08-tema-claro-desktop.png")
    page.click("nav[aria-label='Navegação principal'] a[href='/']")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/11-salao-tema-claro-desktop.png")
    tema2 = page.evaluate("() => document.documentElement.dataset.theme")
    log.append(("tema mantido na navegacao interna (SPA)", tema2))
    recarregou = page.reload(wait_until="networkidle")
    page.wait_for_timeout(400)
    tema3 = page.evaluate("() => document.documentElement.dataset.theme")
    log.append(("tema apos recarregar a pagina (sem localStorage, volta ao padrao)", tema3))

    # foco por teclado no salao
    for _ in range(8):
        page.keyboard.press("Tab")
    foco = page.evaluate("() => { const a = document.activeElement; return a ? a.tagName + ' :: ' + (a.getAttribute('data-testid') || a.textContent || '').trim().slice(0,40) : 'nenhum'; }")
    log.append(("foco apos 8 Tabs", foco))
    page.screenshot(path=f"{OUT}/12-foco-teclado-desktop.png")

    # alvos de toque < 44px
    pequenos = page.evaluate(
        """() => [...document.querySelectorAll('button,a[href],[role=tab]')]
              .filter(el => el.offsetParent !== null)
              .map(el => ({ r: el.getBoundingClientRect(), t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0,30) }))
              .filter(o => o.r.height > 0 && o.r.height < 44)
              .map(o => `${o.t} (${Math.round(o.r.width)}x${Math.round(o.r.height)})`)"""
    )
    log.append(("alvos abaixo de 44px (desktop)", pequenos))
    ctx.close()

    # ---------- tablet e mobile ----------
    for nome, (w, h) in [("tablet", RES["tablet"]), ("mobile", RES["mobile"])]:
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, locale="pt-BR",
                                  is_mobile=(nome == "mobile"), has_touch=(nome == "mobile"))
        page = ctx.new_page()
        hook(page, nome)
        for rota, arquivo in [("/", "salao"), ("/mesa/8", "mesa08"), ("/producao", "producao"),
                              ("/fechamentos", "fechamentos"), ("/configuracao", "configuracao")]:
            page.goto(BASE + rota, wait_until="networkidle")
            page.wait_for_timeout(500)
            o = overflow(page)
            log.append((f"{nome} {rota} overflow", o, "OK" if o["sw"] <= o["cw"] + 1 else "OVERFLOW"))
            page.screenshot(path=f"{OUT}/{nome}-{arquivo}.png", full_page=False)
        # dialogo no mobile
        page.goto(f"{BASE}/mesa/8", wait_until="networkidle")
        page.wait_for_timeout(400)
        page.click("[data-testid=adicionar-item]")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/{nome}-cardapio.png")
        o = overflow(page)
        log.append((f"{nome} dialogo overflow", o, "OK" if o["sw"] <= o["cw"] + 1 else "OVERFLOW"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        aberto = page.evaluate("() => !!document.querySelector('dialog[open]')")
        log.append((f"{nome} dialogo fecha com Esc", not aberto))
        if nome == "mobile":
            pequenos = page.evaluate(
                """() => [...document.querySelectorAll('button,a[href],[role=tab]')]
                      .filter(el => el.offsetParent !== null)
                      .map(el => ({ r: el.getBoundingClientRect(), t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0,30) }))
                      .filter(o => o.r.height > 0 && o.r.height < 44)
                      .map(o => `${o.t} (${Math.round(o.r.width)}x${Math.round(o.r.height)})`)"""
            )
            log.append(("alvos abaixo de 44px (mobile)", pequenos))
        ctx.close()

    # ---------- prefers-reduced-motion ----------
    ctx = browser.new_context(viewport={"width": 1365, "height": 900}, locale="pt-BR", reduced_motion="reduce")
    page = ctx.new_page()
    hook(page, "reduced-motion")
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(500)
    dur = page.evaluate("() => getComputedStyle(document.querySelector('.vh-rise') || document.body).animationDuration")
    log.append(("animation-duration com reduced motion", dur))
    page.screenshot(path=f"{OUT}/13-reduced-motion-desktop.png")
    ctx.close()

    browser.close()

print("=== RESULTADOS ===")
for linha in log:
    print(" | ".join(str(x) for x in linha))
print("\n=== CONSOLE / ERROS ===")
if errors:
    for e in errors:
        print(e)
else:
    print("nenhum erro ou aviso de console")
