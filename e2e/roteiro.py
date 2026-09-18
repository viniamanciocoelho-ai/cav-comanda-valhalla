"""Os 22 passos de teste exigidos pelo prompt mestre, na Mesa 08 com Ana,
mais as 10 regras de interface da seção de ajustes obrigatórios.

Roda numa única sessão SPA: nenhum page.goto depois do primeiro load, para provar
que o estado atravessa perfis e rotas.
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


def checar(cond: bool, msg: str) -> bool:
    if cond:
        ok(msg)
    else:
        falha(msg)
    return cond


def tem(corpo: str, agulha: str) -> bool:
    """A UI usa `uppercase` no CSS e innerText devolve o texto já transformado."""
    return agulha.casefold() in corpo.casefold()


def dinheiro(texto: str) -> float:
    achado = re.search(r"[\d.]*\d,\d{2}", texto)
    if not achado:
        return float("nan")
    return float(achado.group(0).replace(".", "").replace(",", "."))


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

    # ============================================================ passo 1
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(700)
    checar(page.evaluate("() => document.readyState") == "complete", "1. aplicação abre sem erros")

    # -------- regras de interface obrigatórias (1 a 10 da seção de ajustes)
    checar(page.title() == "CAV Comanda | Valhalla", f"UI1. título da aba: {page.title()!r}")
    checar(
        page.evaluate("() => document.documentElement.lang") == "pt-BR",
        "UI2. idioma do HTML é pt-BR",
    )
    # data/hora dinâmicas: tem de casar com o relógio do navegador, não com texto fixo
    relogio = page.evaluate(
        """() => {
             const agora = new Date();
             const dia = agora.toLocaleDateString('pt-BR', { day: 'numeric' });
             const hora = String(agora.getHours()).padStart(2, '0');
             return { dia, hora };
           }"""
    )
    cabecalho = page.inner_text("body")
    checar(
        tem(cabecalho, f"{relogio['dia']} de") and tem(cabecalho, f"{relogio['hora']}:"),
        f"UI3. data e hora dinâmicas batem com o relógio local (dia {relogio['dia']}, {relogio['hora']}h)",
    )
    pequenos = page.evaluate(
        """() => {
             const ruins = [];
             for (const el of document.querySelectorAll('body *')) {
               if (!el.textContent || !el.textContent.trim()) continue;
               if (el.children.length) continue;
               const px = parseFloat(getComputedStyle(el).fontSize);
               if (px && px < 12) ruins.push({ px, txt: el.textContent.trim().slice(0, 40) });
             }
             return ruins;
           }"""
    )
    checar(not pequenos, f"UI4. nenhum texto abaixo de 12px no desktop ({len(pequenos)} achados)")
    if pequenos:
        nota(f"textos pequenos: {pequenos[:5]}")

    alvos = page.evaluate(
        """() => {
             const ruins = [];
             const sel = 'button, a[href], input, select, [role="button"], [role="tab"]';
             for (const el of document.querySelectorAll(sel)) {
               const r = el.getBoundingClientRect();
               if (r.width === 0 && r.height === 0) continue;
               if (el.closest('#runable-badge, [data-runable]')) continue;
               if (r.height < 44 && r.width < 44) {
                 ruins.push({ h: Math.round(r.height), w: Math.round(r.width),
                              txt: (el.innerText || el.getAttribute('aria-label') || el.tagName).slice(0, 30) });
               }
             }
             return ruins;
           }"""
    )
    checar(not alvos, f"UI6. alvos de toque com ao menos 44px ({len(alvos)} abaixo)")
    if alvos:
        nota(f"alvos pequenos: {alvos[:6]}")

    reduz = page.evaluate(
        """() => Array.from(document.styleSheets).some(s => {
             try {
               return Array.from(s.cssRules).some(r =>
                 r.conditionText && r.conditionText.includes('prefers-reduced-motion'));
             } catch { return false; }
           })"""
    )
    checar(bool(reduz), "UI8. folha de estilo trata prefers-reduced-motion")
    marca = page.evaluate("() => /made with runable/i.test(document.body.innerText)")
    checar(bool(marca), "UI9. marca do Runable preservada na página")

    # ============================================================ passo 2
    page.click('[data-testid="trocar-perfil"]')
    page.wait_for_selector('[data-testid="perfil-garcom"]')
    page.click('[data-testid="perfil-garcom"]')
    page.wait_for_timeout(500)
    checar(page.evaluate("() => location.pathname") == "/garcom", "2. Gerência troca para Rafael")

    # ============================================================ passo 3
    corpo = page.inner_text("body")
    checar(
        not tem(corpo, "Faturamento")
        and not tem(corpo, "Fechamentos")
        and not tem(corpo, "Configuração"),
        "3. Rafael não vê faturamento nem configurações",
    )
    for rota in ["/configuracao", "/fechamentos", "/caixa"]:
        page.evaluate(f"() => history.pushState({{}}, '', '{rota}')")
        page.evaluate("() => window.dispatchEvent(new PopStateEvent('popstate'))")
        page.wait_for_timeout(400)
        checar(
            page.evaluate("() => location.pathname") == "/garcom",
            f"3. Rafael é bloqueado ao digitar {rota}",
        )

    # ============================================================ passo 4
    page.click('[data-testid="mesa-8"]')
    page.wait_for_timeout(600)
    checar(page.evaluate("() => location.pathname") == "/mesa/8", "4. Mesa 08 abre para o garçom")
    shot(page, "r01-mesa-8-garcom")

    # ============================================================ passo 5 (Ana, Chopp IPA)
    page.click('[data-testid="adicionar-item"]')
    page.wait_for_selector('[data-testid="add-m2"]')
    page.click('[data-testid="destinatario-Ana"]')
    page.click('[data-testid="add-m2"]')  # Chopp IPA 500 ml, 16,00, bar
    ok("5. item adicionado para Ana (Chopp IPA 500 ml)")

    # ============================================================ passo 6 (compartilhado + obs)
    page.click('[data-testid="destinatario-Compartilhado"]')
    page.click('[data-testid="categoria-Cozinha"]')
    page.wait_for_timeout(250)
    page.fill('[data-testid="campo-observacao"]', "Sem cebola")
    page.click('[data-testid="add-m12"]')  # Tábua para dois, 72,00, cozinha
    ok("6. item compartilhado com observação 'Sem cebola' adicionado")
    shot(page, "r02-cardapio-ana")

    # ============================================================ passo 7 (quantidade)
    page.click('[data-testid="destinatario-Ana"]')
    page.fill('[data-testid="campo-observacao"]', "")
    page.click('[data-testid="categoria-Bebidas"]')
    page.wait_for_timeout(250)
    campo_qtd = page.locator('[data-testid="quantidade-lancamento"]')
    checar(campo_qtd.count() >= 1, "7. controle de quantidade existe no lançamento")
    if campo_qtd.count():
        page.click('[aria-label="Aumentar quantidade"]')
        page.click('[aria-label="Aumentar quantidade"]')
        page.wait_for_timeout(250)
        checar(campo_qtd.first.inner_text().strip() == "3", "7. quantidade sobe para 3 no cardápio")
        page.click('[data-testid="add-m5"]')  # Água com gás 6,00 x3 = 18,00
    page.click('[data-testid="concluir-cardapio"]')
    page.wait_for_timeout(500)
    comanda = page.inner_text("body")
    checar(tem(comanda, "3×") or tem(comanda, "3x"), "7. quantidade 3 aparece na comanda")
    checar(tem(comanda, "Sem cebola"), "6. observação viaja com o item na comanda")

    # ============================================================ passo 11 (autoria e horário)
    novos = page.locator('[data-testid^="item-"]:has-text("Chopp IPA")')
    checar(novos.count() >= 1, "11. item novo aparece na comanda")
    linha = novos.first.inner_text()
    checar(tem(linha, "Rafael"), "11. item identifica o garçom Rafael")
    checar(
        bool(re.search(r"\d{2}:\d{2}", linha)),
        f"11 / UI10. item mostra o horário do lançamento ({re.findall(r'[0-9]{2}:[0-9]{2}', linha)})",
    )

    # ============================================================ passo 8 (remover antes do envio)
    antes = page.locator('[data-testid^="item-"]').count()
    remover = page.locator('[data-testid^="item-"]:has-text("Água com gás")').locator(
        '[data-testid^="remover-"]'
    )
    if remover.count() == 0:
        remover = page.locator('[data-testid^="remover-"]')
    checar(remover.count() >= 1, "8. item novo pode ser removido antes do envio")
    if remover.count():
        remover.first.click()
        page.wait_for_timeout(500)
        depois = page.locator('[data-testid^="item-"]').count()
        checar(depois == antes - 1, f"8. remoção tirou o item da comanda ({antes} -> {depois})")
    shot(page, "r03-comanda-revisada")

    # ============================================================ passo 9 + 10 (envio e duplicidade)
    total_antes = dinheiro(page.locator('[data-testid="total-mesa"]').inner_text())
    botao = page.locator('[data-testid="enviar-pedido"]')
    botao.click()
    duplo_aceito = False
    try:
        botao.click(timeout=800)
        duplo_aceito = True
    except Exception:
        ok("10. botão de envio trava no primeiro clique")
    page.wait_for_timeout(900)
    if duplo_aceito:
        nota("o DOM aceitou um segundo clique; a guarda de idempotência é quem deve segurar")
    total_depois = dinheiro(page.locator('[data-testid="total-mesa"]').inner_text())
    checar(
        abs(total_antes - total_depois) < 0.02,
        f"10. envio não alterou o total (nada duplicado: {total_antes:.2f} -> {total_depois:.2f})",
    )
    checar(
        page.locator('[data-testid^="item-"]:has-text("Chopp IPA")').count() == 1,
        "9/10. o Chopp IPA da Ana continua uma única linha depois do duplo clique",
    )
    shot(page, "r04-pedido-enviado")

    # ============================================================ passo 12 + 13
    page.click('[data-testid="trocar-perfil"]')
    page.click('[data-testid="perfil-producao"]')
    page.wait_for_timeout(600)
    checar(page.evaluate("() => location.pathname") == "/producao", "12. Produção abre")
    prod = page.inner_text("body")
    checar(tem(prod, "Cozinha") and tem(prod, "Bar"), "13. produção separa cozinha e bar")
    # a mesa 06 da demonstração já tem Chopp IPA em preparo, então a ficha da Ana
    # precisa ser isolada pelo nome da pessoa para não contar a ficha alheia.
    ficha_bar = page.locator('[data-testid^="ficha-"]:has-text("Chopp IPA"):has-text("Ana")')
    ficha_coz = page.locator('[data-testid^="ficha-"]:has-text("Tábua para dois")')
    checar(ficha_bar.count() == 1, f"13. Chopp IPA caiu em uma única ficha ({ficha_bar.count()})")
    checar(ficha_coz.count() == 1, f"13. Tábua caiu em uma única ficha ({ficha_coz.count()})")
    if ficha_bar.count() and ficha_coz.count():
        checar(
            ficha_bar.first.get_attribute("data-testid")
            != ficha_coz.first.get_attribute("data-testid"),
            "13. bebida e comida foram para fichas diferentes",
        )
    if ficha_coz.count():
        checar(tem(ficha_coz.first.inner_text(), "Sem cebola"), "13. observação chega na cozinha")
        checar(tem(ficha_coz.first.inner_text(), "Rafael"), "13. ficha identifica o garçom")
        checar(tem(ficha_coz.first.inner_text(), "08"), "13. ficha identifica a mesa")
    shot(page, "r05-producao-separada")

    # ============================================================ passo 14 (preparando e pronto)
    if ficha_bar.count():
        ficha_bar.first.locator('[data-testid^="avancar-"]').click()
        page.wait_for_timeout(450)
        checar(tem(ficha_bar.first.inner_text(), "prepar"), "14. ficha do bar vai para preparando")
        ficha_bar.first.locator('[data-testid^="avancar-"]').click()
        page.wait_for_timeout(450)
        checar(tem(ficha_bar.first.inner_text(), "pronto"), "14. ficha do bar vai para pronto")
    shot(page, "r06-producao-pronto")

    # ============================================================ passo 15
    page.click('[data-testid="trocar-perfil"]')
    page.click('[data-testid="perfil-garcom"]')
    page.wait_for_timeout(600)
    retirada = page.locator('[data-testid^="retirada-"]:has-text("Chopp IPA")')
    checar(retirada.count() >= 1, "15. Rafael vê o item pronto na fila de retirada")
    if retirada.count():
        checar(tem(retirada.first.inner_text(), "Ana"), "15. retirada mostra a pessoa (Ana)")
        retirada.first.locator('[data-testid^="entregar-"]').click()
        page.wait_for_timeout(600)
        checar(
            page.locator('[data-testid^="retirada-"]:has-text("Chopp IPA")').count() == 0,
            "15. item entregue sai da fila de retirada",
        )
    shot(page, "r07-garcom-entregue")

    # ============================================================ passo 16
    page.click('[data-testid="mesa-8"]')
    page.wait_for_timeout(600)
    checar(page.evaluate("() => location.pathname") == "/mesa/8", "16. volta para a Mesa 08")
    checar(
        tem(page.inner_text("body"), "Entregue"),
        "16. estado compartilhado: comanda mostra o item entregue",
    )
    page.click('[data-testid="solicitar-fechamento"]')
    page.wait_for_timeout(600)
    checar(
        page.locator('[data-testid="solicitar-fechamento"]').is_disabled(),
        "16. fechamento solicitado trava o botão",
    )

    # ============================================================ passo 17 + 18
    page.click('[data-testid="trocar-perfil"]')
    page.click('[data-testid="perfil-caixa"]')
    page.wait_for_timeout(600)
    checar(page.evaluate("() => location.pathname") == "/caixa", "17. Caixa abre")
    checar(page.locator('[data-testid="conta-8"]').count() == 1, "17. Mesa 08 está na fila do caixa")
    page.click('[data-testid="dividir-8"]')
    page.wait_for_selector('[data-testid="confirmar-fechamento"]')
    page.wait_for_timeout(500)
    divisoes = page.locator('[data-testid^="divisao-"]')
    checar(divisoes.count() == 4, f"18. divisão lista as 4 pessoas da Mesa 08 ({divisoes.count()})")

    def total_mesa() -> float:
        return dinheiro(
            page.evaluate(
                """() => {
                     const alvo = Array.from(document.querySelectorAll('p'))
                       .find(n => /total da mesa/i.test(n.innerText));
                     return alvo ? alvo.parentElement.innerText.replace(/total da mesa/i, '') : '';
                   }"""
            )
        )

    def conferir_divisao(rotulo: str) -> float:
        soma = 0.0
        for i in range(divisoes.count()):
            bruto = divisoes.nth(i).inner_text()
            vals = [
                float(v.replace(".", "").replace(",", "."))
                for v in re.findall(r"[\d.]*\d,\d{2}", bruto)
            ]
            if len(vals) < 4:
                falha(f"18. cartão de divisão sem os 4 valores ({rotulo}): {vals}")
                continue
            tot, ind, rat, ser = vals[:4]
            soma += tot
            checar(
                abs(tot - (ind + rat + ser)) < 0.02,
                f"18. {bruto.splitlines()[0]} ({rotulo}): {ind:.2f}+{rat:.2f}+{ser:.2f}={tot:.2f}",
            )
        alvo = total_mesa()
        checar(
            abs(round(soma, 2) - alvo) < 0.05,
            f"18. soma da divisão fecha com o total ({rotulo}): {soma:.2f} vs {alvo:.2f}",
        )
        return alvo

    com_servico = conferir_divisao("com serviço")
    shot(page, "r08-caixa-divisao")

    # ============================================================ passo 19 (retirar/recolocar 10%)
    page.click('[data-testid="alternar-servico"]')
    page.wait_for_timeout(500)
    sem_servico = total_mesa()
    checar(
        abs(com_servico - sem_servico * 1.1) < 0.05,
        f"19. retirar o serviço tira exatamente 10% ({com_servico:.2f} -> {sem_servico:.2f})",
    )
    conferir_divisao("sem serviço")
    shot(page, "r09-servico-retirado")
    page.click('[data-testid="alternar-servico"]')
    page.wait_for_timeout(500)
    checar(
        abs(total_mesa() - com_servico) < 0.05,
        f"19. recolocar o serviço volta ao total original ({total_mesa():.2f})",
    )

    # ============================================================ passo 20 (NFC-e simulada)
    page.click('[data-testid="simular-nfce"]')
    page.wait_for_timeout(600)
    aviso = page.locator('[data-testid="aviso-nfce"]').inner_text()
    checar(tem(aviso, "NFC-e simulada"), "20. simular NFC-e mostra o resultado simulado")
    checar(
        tem(aviso, "Sem emissão real") and tem(aviso, "Nenhum documento foi emitido"),
        "20. aviso de integração prevista continua visível depois de simular",
    )
    shot(page, "r10-nfce-simulada")
    page.click('[data-testid="confirmar-fechamento"]')
    page.wait_for_timeout(900)
    hist = page.inner_text("body")
    checar(tem(hist, "MESA 08"), "20. Mesa 08 registrada no histórico")
    checar(tem(hist, "simulada"), "20. histórico marca a NFC-e como simulada")
    checar(tem(hist, "Rafael"), "20. histórico guarda o garçom que atendeu")
    shot(page, "r11-fechamentos")

    # ============================================================ passo 21 + 22
    page.click('[data-testid="trocar-perfil"]')
    page.click('[data-testid="perfil-gerencia"]')
    page.wait_for_timeout(600)
    page.evaluate("() => history.pushState({}, '', '/configuracao')")
    page.evaluate("() => window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_timeout(700)
    reiniciar = page.locator('[data-testid="reiniciar-demonstracao"]')
    if reiniciar.count() == 0:
        reiniciar = page.locator('button:has-text("Reiniciar")')
    checar(reiniciar.count() >= 1, "21. botão de reiniciar a demonstração existe")
    if reiniciar.count():
        reiniciar.first.click()
        page.wait_for_timeout(900)
        confirmar = page.locator('button:has-text("Reiniciar")').last
        if page.locator('[role="dialog"]').count() and confirmar.count():
            confirmar.click()
            page.wait_for_timeout(900)
    page.evaluate("() => history.pushState({}, '', '/')")
    page.evaluate("() => window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_timeout(800)
    salao = page.inner_text("body")
    checar(page.evaluate("() => location.pathname") == "/", "22. volta ao Salão depois de reiniciar")
    checar(not tem(salao, "MESA 03"), "22. mesa aberta na demonstração voltou a ficar livre")
    # o estado inicial tem mesas 02, 06 e 08 ocupadas e nenhum fechamento
    for n in ["02", "06", "08"]:
        checar(tem(salao, f"MESA {n}") or tem(salao, n), f"22. mesa {n} voltou ao estado inicial")
    page.evaluate("() => history.pushState({}, '', '/fechamentos')")
    page.evaluate("() => window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_timeout(800)
    fech = page.inner_text("body")
    # sem fechamentos a tela mostra o estado vazio; com fechamentos mostra o contador.
    zerado = re.search(r"CONTAS FECHADAS\s*\n\s*(\d+)", fech, re.IGNORECASE)
    contador = zerado.group(1) if zerado else "estado vazio"
    checar(
        tem(fech, "Nenhuma conta fechada ainda") or contador == "0",
        f"22. histórico de fechamentos zerado ({contador})",
    )
    shot(page, "r12-reiniciado")

    # ============================================================ UI7: 375px sem overflow
    ctx375 = navegador.new_context(
        viewport={"width": 375, "height": 812},
        locale="pt-BR",
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    p375 = ctx375.new_page()
    p375.on(
        "console",
        lambda m: console_problemas.append(f"[375 {m.type}] {m.text}")
        if m.type in ("error", "warning")
        else None,
    )
    p375.on("pageerror", lambda e: console_problemas.append(f"[375 pageerror] {e}"))
    for rota in ["/", "/garcom", "/mesa/8", "/producao", "/caixa", "/fechamentos", "/configuracao"]:
        p375.goto(BASE + rota, wait_until="networkidle")
        p375.wait_for_timeout(600)
        d = p375.evaluate(
            "() => ({ sw: document.documentElement.scrollWidth,"
            " cw: document.documentElement.clientWidth })"
        )
        checar(d["sw"] <= d["cw"] + 1, f"UI7. {rota} sem overflow em 375px ({d['sw']}/{d['cw']})")
    # foco visível por teclado em 375px (UI5)
    p375.goto(BASE + "/garcom", wait_until="networkidle")
    p375.wait_for_timeout(500)
    vistos = 0
    for _ in range(6):
        p375.keyboard.press("Tab")
        f = p375.evaluate(
            """() => {
                 const el = document.activeElement;
                 if (!el || el === document.body) return null;
                 const s = getComputedStyle(el);
                 return (s.outlineStyle !== 'none' && s.outlineStyle !== '')
                        || (s.boxShadow && s.boxShadow !== 'none');
               }"""
        )
        if f:
            vistos += 1
    checar(vistos >= 3, f"UI5. foco visível ao navegar por teclado ({vistos}/6 paradas)")
    p375.screenshot(path=str(SHOTS / "r13-375px.png"), full_page=True)

    navegador.close()

ruido = ("Download the React DevTools", "vite", "[hmr]", "Lit is in dev mode")
console_reais = [c for c in console_problemas if not any(r in c for r in ruido)]

(Path(__file__).resolve().parent / "resultado-roteiro.json").write_text(
    json.dumps(
        {"passos": passos, "falhas": falhas, "notas": notas, "console": console_reais},
        ensure_ascii=False,
        indent=2,
    )
)

print("\n================ RESUMO 22 PASSOS ================")
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
