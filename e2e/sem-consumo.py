"""Aceite do encerramento de mesa sem consumo (13 testes obrigatorios).

Roda numa unica sessao SPA em 390x844 (celular, resolucao exigida) e repete o caminho
principal em 1440x900 para provar que o desktop nao regrediu. Cada verificacao confere
o efeito real no estado central: mesa liberada, nada de pagamento/NFC-e/ficha, contadores
e auditoria.

Uso: python3 e2e/sem-consumo.py
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
passos: list[str] = []
atual = ""


def ok(msg: str) -> None:
    passos.append(f"OK   [{atual}] {msg}")
    print(f"OK   [{atual}] {msg}", flush=True)


def falha(msg: str) -> None:
    falhas.append(f"[{atual}] {msg}")
    passos.append(f"FALHA [{atual}] {msg}")
    print(f"FALHA [{atual}] {msg}", flush=True)


def checar(cond: bool, msg: str) -> bool:
    ok(msg) if cond else falha(msg)
    return bool(cond)


def tem(corpo: str, agulha: str) -> bool:
    return agulha.casefold() in corpo.casefold()


def trocar(page, perfil: str) -> None:
    page.click('[data-testid="trocar-perfil"]')
    page.wait_for_selector(f'[data-testid="perfil-{perfil}"]')
    page.click(f'[data-testid="perfil-{perfil}"]')
    page.wait_for_timeout(600)


def ir(page, rota: str) -> None:
    page.evaluate(f"() => history.pushState({{}}, '', '{rota}')")
    page.evaluate("() => window.dispatchEvent(new PopStateEvent('popstate'))")
    page.wait_for_timeout(450)


def toast(page) -> str:
    alvo = page.locator('[data-testid="toast-host"]')
    return alvo.inner_text() if alvo.count() else ""


def dialogo_aberto(page, testid: str = "dialogo-sem-consumo") -> bool:
    """O <dialog> nativo nunca sai do DOM: o que muda e a propriedade `open`."""
    return bool(
        page.evaluate(
            "(id) => { const d = document.querySelector(`[data-testid='${id}']`); return !!d && d.open; }",
            testid,
        )
    )


def texto_conteudo(page) -> str:
    """Texto da area de conteudo, sem os avisos flutuantes (toast) da demonstracao."""
    return page.evaluate("() => document.querySelector('main')?.innerText || ''")


def metrica(page, label: str) -> int:
    """Numero do cartao de metrica com o rotulo dado (ex.: 'Mesas abertas')."""
    return page.evaluate(
        """(label) => {
             for (const p of document.querySelectorAll('p')) {
               if (p.innerText.trim().toLowerCase() !== label.toLowerCase()) continue;
               const valor = p.parentElement?.querySelector('p:nth-of-type(2)');
               const m = (valor?.innerText || '').match(/\\d+/);
               if (m) return Number(m[0]);
             }
             return -1;
           }""",
        label,
    )


def clique_duplo_instantaneo(page, seletor: str) -> int:
    """Dois cliques no mesmo tique do JavaScript, sem re-render entre eles."""
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


def contador_nav(page, href: str) -> int:
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


def largura_demais(page) -> int:
    return page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )


def alvos_pequenos(page, seletores: list[str]) -> list[str]:
    """Botoes visiveis com menos de 44 px de altura (alvo de toque)."""
    pequenos = []
    for sel in seletores:
        alvo = page.locator(sel)
        if not alvo.count():
            continue
        caixa = alvo.first.bounding_box()
        if caixa and caixa["height"] < 43.5:
            pequenos.append(f"{sel}={round(caixa['height'])}px")
    return pequenos


def abrir_mesa_livre(page, mesa_id: int) -> None:
    """Abre a mesa pela tela do garcom e entra na comanda."""
    ir(page, "/garcom")
    page.wait_for_selector(f'[data-testid="abrir-{mesa_id}"]')
    page.click(f'[data-testid="abrir-{mesa_id}"]')
    page.wait_for_timeout(600)


def adicionar_pessoa(page, nome: str) -> None:
    page.fill('[data-testid="nova-pessoa"]', nome)
    page.click('[data-testid="adicionar-pessoa"]')
    page.wait_for_timeout(350)


def encerrar(page, motivo: str, observacao: str = "", descartar: bool = False, duplo: bool = False) -> None:
    page.click('[data-testid="encerrar-sem-consumo"]')
    page.wait_for_timeout(400)
    if descartar:
        page.check('[data-testid="sem-consumo-descartar"]')
    page.click(f'[data-testid="sem-consumo-motivo-{motivo}"]')
    if observacao:
        page.fill('[data-testid="sem-consumo-observacao"]', observacao)
    if duplo:
        aceitos = clique_duplo_instantaneo(page, '[data-testid="sem-consumo-confirmar"]')
        page.wait_for_timeout(700)
        return aceitos
    page.click('[data-testid="sem-consumo-confirmar"]')
    page.wait_for_timeout(700)
    return 1


def registros_auditoria(page, mesa_id: int) -> int:
    """Quantas linhas de auditoria existem para a mesa (na tela de fechamentos)."""
    return page.locator(f'[data-testid="sem-consumo-{mesa_id}"]').count()


def roteiro(page, etiqueta: str, mobile: bool) -> None:
    global atual
    atual = etiqueta

    # ------------------------------------------------ estado inicial de referencia
    trocar(page, "gerencia")
    ir(page, "/fechamentos")
    fechamentos_antes = page.locator('[data-testid^="fechamento-"]').count()
    ir(page, "/caixa")
    fila_caixa_antes = page.locator('[data-testid^="conta-"]').count()
    ir(page, "/producao")
    fichas_antes = page.locator('[data-testid^="ficha-"]').count()
    ir(page, "/")
    ocupadas_antes = metrica(page, "Mesas ocupadas")
    nav_producao_antes = contador_nav(page, "/producao")
    nav_caixa_antes = contador_nav(page, "/caixa")
    nav_garcom_antes = contador_nav(page, "/garcom")

    trocar(page, "garcom")
    ir(page, "/garcom")
    abertas_antes = metrica(page, "Mesas abertas")
    livres_antes = page.locator('[data-testid^="abrir-"]').count()

    # ------------------------------------------------ T1 abrir mesa livre
    checar(
        page.locator('[data-testid="abrir-9"]').count() == 1,
        "T1. mesa 09 aparece como livre para o garçom",
    )
    abrir_mesa_livre(page, 9)
    corpo = page.inner_text("body")
    checar(
        page.evaluate("() => location.pathname") == "/mesa/9",
        "T1. abrir a mesa leva direto para a comanda /mesa/9",
    )
    checar(tem(corpo, "Resumo da mesa"), "T1. comanda em branco abre com o resumo da mesa")

    # ------------------------------------------------ T2 pessoas sem nenhum item
    adicionar_pessoa(page, "Ana")
    adicionar_pessoa(page, "Bruno")
    corpo = page.inner_text("body")
    checar(
        tem(corpo, "Ana") and tem(corpo, "Bruno"),
        "T2. duas pessoas cadastradas na comanda, nenhum item lançado",
    )
    checar(
        page.locator('[data-testid="enviar-pedido"]').get_attribute("aria-disabled") == "true",
        "T2. sem item lançado não há nada para enviar à produção",
    )

    # ------------------------------------------------ T3 acao e dialogo
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 1,
        "T3. mesa aberta e vazia oferece a ação secundária ENCERRAR SEM CONSUMO",
    )
    page.click('[data-testid="encerrar-sem-consumo"]')
    page.wait_for_timeout(400)
    checar(dialogo_aberto(page), "T3. diálogo de confirmação abre")
    dialogo = page.locator('[data-testid="dialogo-sem-consumo"]').inner_text()
    checar(tem(dialogo, "Encerrar mesa sem consumo?"), "T3. título exigido no diálogo")
    checar(
        tem(dialogo, "A mesa será liberada sem gerar cobrança, pagamento ou documento fiscal."),
        "T3. texto exigido no diálogo",
    )
    for chave, rotulo in [
        ("desistiram", "Clientes desistiram"),
        ("nao_encontraram", "Não encontraram o que procuravam"),
        ("engano", "Mesa aberta por engano"),
        ("troca_mesa", "Troca de mesa"),
        ("outro", "Outro"),
    ]:
        checar(
            page.locator(f'[data-testid="sem-consumo-motivo-{chave}"]').count() == 1
            and tem(dialogo, rotulo),
            f"T3. motivo disponível: {rotulo}",
        )
    checar(
        page.locator('[data-testid="sem-consumo-voltar"]').count() == 1
        and page.locator('[data-testid="sem-consumo-confirmar"]').count() == 1,
        "T3. diálogo tem VOLTAR e CONFIRMAR E LIBERAR MESA",
    )
    # motivo obrigatorio: confirmar sem escolher nao encerra nada
    page.click('[data-testid="sem-consumo-confirmar"]')
    page.wait_for_timeout(400)
    checar(
        page.locator('[data-testid="sem-consumo-aviso"]').count() == 1 and dialogo_aberto(page),
        "T3. motivo é obrigatório: sem escolha o diálogo avisa e não encerra",
    )
    # voltar fecha sem efeito
    page.click('[data-testid="sem-consumo-voltar"]')
    page.wait_for_timeout(400)
    checar(
        not dialogo_aberto(page) and tem(texto_conteudo(page), "Resumo da mesa"),
        "T3. VOLTAR fecha o diálogo e mantém a mesa aberta",
    )
    if mobile:
        page.screenshot(path=str(SHOTS / f"sc-{etiqueta}-dialogo.png"))

    # ------------------------------------------------ T3/T13 encerramento efetivo
    encerrar(page, "desistiram", "preferiram esperar no balcão")
    aviso = toast(page)
    checar(tem(aviso, "Mesa liberada sem consumo"), f"T3. confirmação exibida ({aviso.strip()[:60]})")

    # ------------------------------------------------ T4 mesa volta a livre
    corpo = texto_conteudo(page)
    checar(tem(corpo, "Mesa livre"), "T4. comanda da mesa 09 volta ao estado de mesa livre")
    checar(
        page.locator('[data-testid="abrir-mesa"]').count() == 1,
        "T4. a mesa pode ser aberta de novo imediatamente",
    )
    conteudo = texto_conteudo(page)
    checar(
        not tem(conteudo, "Ana") and not tem(conteudo, "Bruno"),
        "T10. pessoas daquela abertura foram limpas",
    )

    # ------------------------------------------------ Desfazer (10 s na demonstracao)
    checar(
        page.locator('[data-testid="desfazer-sem-consumo"]').count() == 1,
        "T14. oferta de Desfazer aparece depois do encerramento",
    )
    rotulo_desfazer = page.locator('[data-testid="botao-desfazer-sem-consumo"]').inner_text()
    segundos = re.search(r"\((\d+)s\)", rotulo_desfazer, re.I)
    checar(
        bool(segundos) and 1 <= int(segundos.group(1)) <= 10,
        f"T14. contagem regressiva de 10 s ({rotulo_desfazer.strip()})",
    )

    # ------------------------------------------------ T5 nada financeiro criado
    trocar(page, "gerencia")
    ir(page, "/fechamentos")
    checar(
        page.locator('[data-testid^="fechamento-"]').count() == fechamentos_antes,
        "T5. nenhum fechamento de R$ 0,00 criado",
    )
    cartoes = [
        page.locator('[data-testid^="fechamento-"]').nth(i).inner_text()
        for i in range(page.locator('[data-testid^="fechamento-"]').count())
    ]
    checar(
        not any(tem(c, "Mesa 09") for c in cartoes),
        "T5. nenhum fechamento nem NFC-e simulada para a mesa liberada",
    )
    checar(
        not any(tem(c, "R$ 0,00") for c in cartoes),
        "T5. nenhum fechamento de valor zero na lista",
    )
    ir(page, "/caixa")
    checar(
        page.locator('[data-testid^="conta-"]').count() == fila_caixa_antes
        and page.locator('[data-testid="conta-9"]').count() == 0,
        "T5. mesa liberada não entra na fila do caixa (nenhum pagamento)",
    )
    ir(page, "/producao")
    checar(
        page.locator('[data-testid^="ficha-"]').count() == fichas_antes,
        "T5. nenhuma ficha de produção criada",
    )

    # ------------------------------------------------ T7 auditoria
    ir(page, "/fechamentos")
    checar(
        page.locator('[data-testid="auditoria-sem-consumo"]').count() == 1,
        "T7. tela de fechamentos traz a seção de auditoria das mesas sem consumo",
    )
    checar(registros_auditoria(page, 9) == 1, "T7. um registro de auditoria para a mesa 09")
    linha = page.locator('[data-testid="sem-consumo-9"]').first.inner_text()
    checar(tem(linha, "Clientes desistiram"), "T7. auditoria guarda o motivo escolhido")
    checar(tem(linha, "preferiram esperar no balcão"), "T7. auditoria guarda a observação")
    checar(tem(linha, "Rafael"), "T7. auditoria guarda quem encerrou")
    checar(tem(linha, "Garçom"), "T7. auditoria guarda o perfil do responsável")
    checar(
        bool(re.search(r"mesa aberta por (agora|\d+)", linha, re.I)),
        f"T7. auditoria guarda a duração da abertura ({linha!r})",
    )
    checar(tem(linha, "Sem cobrança"), "T7. registro marcado como sem cobrança")

    # ------------------------------------------------ T6 contadores
    ir(page, "/")
    checar(
        metrica(page, "Mesas ocupadas") == ocupadas_antes,
        f"T6. gerência: mesas ocupadas volta ao valor original ({ocupadas_antes})",
    )
    checar(
        contador_nav(page, "/producao") == nav_producao_antes
        and contador_nav(page, "/caixa") == nav_caixa_antes
        and contador_nav(page, "/garcom") == nav_garcom_antes,
        "T6. contadores de produção, caixa e garçom seguem coerentes",
    )
    trocar(page, "garcom")
    ir(page, "/garcom")
    checar(
        metrica(page, "Mesas abertas") == abertas_antes,
        f"T6. garçom: mesas abertas volta a {abertas_antes}",
    )
    checar(
        page.locator('[data-testid^="abrir-"]').count() == livres_antes,
        f"T6. garçom: mesas livres volta a {livres_antes}",
    )
    checar(
        page.locator('[data-testid="abrir-9"]').count() == 1,
        "T6. mesa 09 aparece de novo entre as livres, na hora",
    )

    # ------------------------------------------------ T8 clique duplo
    abrir_mesa_livre(page, 10)
    adicionar_pessoa(page, "Cliente")
    aceitos = encerrar(page, "engano", duplo=True)
    checar(aceitos in (1, 2), f"T8. dois cliques disparados no mesmo tique ({aceitos})")
    trocar(page, "gerencia")
    ir(page, "/fechamentos")
    checar(
        registros_auditoria(page, 10) == 1,
        f"T8. clique duplo gera um único encerramento ({registros_auditoria(page, 10)})",
    )
    checar(
        page.locator('[data-testid^="fechamento-"]').count() == fechamentos_antes,
        "T8. clique duplo não cria fechamento nenhum",
    )
    # repetir a operacao na mesma abertura nao duplica
    ir(page, "/mesa/10")
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 0,
        "T8. mesa já liberada não oferece a ação de novo",
    )

    # ------------------------------------------------ T9 item em rascunho
    trocar(page, "garcom")
    abrir_mesa_livre(page, 7)
    adicionar_pessoa(page, "Diego")
    page.click('[data-testid="adicionar-item"]')
    page.wait_for_selector('[data-testid="dialogo-cardapio"]')
    primeiro = page.locator('[data-testid^="add-"]').first
    primeiro.click()
    page.wait_for_timeout(300)
    page.click('[data-testid="concluir-cardapio"]')
    page.wait_for_timeout(400)
    corpo = page.inner_text("body")
    checar(tem(corpo, "rascunho") or tem(corpo, "Enviar pedido"), "T9. item lançado fica em rascunho")
    page.click('[data-testid="encerrar-sem-consumo"]')
    page.wait_for_timeout(400)
    checar(
        dialogo_aberto(page) and page.locator('[data-testid="sem-consumo-rascunhos"]').count() == 1,
        "T9. diálogo avisa que existem lançamentos em rascunho",
    )
    page.click('[data-testid="sem-consumo-motivo-troca_mesa"]')
    page.click('[data-testid="sem-consumo-confirmar"]')
    page.wait_for_timeout(500)
    checar(
        page.locator('[data-testid="sem-consumo-aviso"]').count() == 1 and dialogo_aberto(page),
        "T9. descarte do rascunho exige confirmação explícita",
    )
    page.check('[data-testid="sem-consumo-descartar"]')
    page.click('[data-testid="sem-consumo-confirmar"]')
    page.wait_for_timeout(700)
    checar(
        tem(texto_conteudo(page), "Mesa livre"),
        "T9. mesa com rascunho descartado volta a livre",
    )
    trocar(page, "gerencia")
    ir(page, "/producao")
    checar(
        page.locator('[data-testid^="ficha-"]').count() == fichas_antes,
        "T9. rascunho descartado não virou ficha de produção",
    )
    ir(page, "/fechamentos")
    linha7 = page.locator('[data-testid="sem-consumo-7"]').first.inner_text()
    checar(registros_auditoria(page, 7) == 1, "T9. auditoria registra a mesa 07")
    checar(
        tem(linha7, "rascunho") or tem(linha7, "descartado"),
        f"T9. auditoria registra o descarte dos rascunhos ({linha7[:90]!r})",
    )
    checar(tem(linha7, "Troca de mesa"), "T9. auditoria registra o motivo troca de mesa")

    # ------------------------------------------------ T10 bloqueio com item enviado
    trocar(page, "garcom")
    ir(page, "/mesa/8")
    corpo8 = page.inner_text("body")
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 0,
        "T10. mesa com item já enviado à produção NÃO oferece encerrar sem consumo",
    )
    checar(
        page.locator('[data-testid="solicitar-fechamento"]').count() == 1,
        "T10. fluxo normal de fechamento segue disponível nessa mesa",
    )
    ir(page, "/mesa/2")
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 0,
        "T10. mesa 02 (consumo enviado) também fica bloqueada",
    )
    # mesa com fechamento iniciado
    ir(page, "/mesa/6")
    if page.locator('[data-testid="solicitar-fechamento"]').count():
        page.click('[data-testid="solicitar-fechamento"]')
        page.wait_for_timeout(600)
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 0,
        "T10. mesa com fechamento iniciado fica bloqueada",
    )

    # ------------------------------------------------ T11 permissoes por perfil
    trocar(page, "garcom")
    abrir_mesa_livre(page, 5)
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 1,
        "T11. garçom responsável pela mesa vê a ação",
    )
    trocar(page, "gerencia")
    ir(page, "/mesa/5")
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 1,
        "T11. gerência vê a ação em qualquer mesa vazia",
    )
    trocar(page, "producao")
    ir(page, "/mesa/5")
    rota_prod = page.evaluate("() => location.pathname")
    bloqueado = tem(page.inner_text("body"), AVISO) or rota_prod != "/mesa/5"
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 0 and bloqueado,
        f"T11. produção não acessa a comanda nem a ação (rota {rota_prod})",
    )
    trocar(page, "caixa")
    ir(page, "/mesa/5")
    checar(
        page.locator('[data-testid="encerrar-sem-consumo"]').count() == 0,
        "T11. caixa vê a comanda em leitura, sem a ação de encerrar sem consumo",
    )
    # (garcom de outra mesa: coberto em e2e/sem-consumo.ts, a demonstracao tem um garcom so)

    # ------------------------------------------------ Desfazer efetivo
    trocar(page, "gerencia")
    ir(page, "/mesa/3")
    if page.locator('[data-testid="abrir-mesa"]').count():
        page.click('[data-testid="abrir-mesa"]')
        page.wait_for_timeout(500)
    adicionar_pessoa(page, "Teste")
    encerrar(page, "nao_encontraram")
    checar(
        tem(texto_conteudo(page), "Mesa livre"),
        "T14. mesa 03 liberada pela gerência",
    )
    page.click('[data-testid="botao-desfazer-sem-consumo"]')
    page.wait_for_timeout(700)
    corpo3 = texto_conteudo(page)
    checar(
        tem(corpo3, "Resumo da mesa") and tem(corpo3, "Teste"),
        "T14. Desfazer devolve a mesa aberta com as pessoas daquela abertura",
    )
    ir(page, "/fechamentos")
    linha3 = page.locator('[data-testid="sem-consumo-3"]').first.inner_text()
    checar(tem(linha3, "Desfeito"), "T14. auditoria preserva o registro e o marca como desfeito")

    # ------------------------------------------------ T12 celular 390x844
    if mobile:
        ir(page, "/mesa/5")
        trocar(page, "gerencia")
        ir(page, "/mesa/5")
        checar(largura_demais(page) <= 1, f"T12. comanda sem rolagem lateral ({largura_demais(page)}px)")
        page.click('[data-testid="encerrar-sem-consumo"]')
        page.wait_for_timeout(400)
        checar(
            largura_demais(page) <= 1,
            f"T12. diálogo sem rolagem lateral em 390x844 ({largura_demais(page)}px)",
        )
        pequenos = alvos_pequenos(
            page,
            [
                '[data-testid="sem-consumo-confirmar"]',
                '[data-testid="sem-consumo-voltar"]',
                '[data-testid="sem-consumo-motivo-outro"]',
                '[data-testid="sem-consumo-observacao"]',
            ],
        )
        checar(not pequenos, f"T12. alvos de toque com 44px ou mais ({pequenos})")
        dialogo_caixa = page.locator('[data-testid="dialogo-sem-consumo"]').bounding_box()
        checar(
            bool(dialogo_caixa) and dialogo_caixa["width"] <= 390,
            "T12. diálogo cabe na largura do celular",
        )
        page.screenshot(path=str(SHOTS / "sc-mobile-dialogo-390.png"))
        page.click('[data-testid="sem-consumo-voltar"]')
        page.wait_for_timeout(300)
        page.screenshot(path=str(SHOTS / "sc-mobile-comanda-390.png"), full_page=True)


def main() -> int:
    global atual
    with sync_playwright() as p:
        navegador = p.chromium.launch(**launch_options())
        for etiqueta, largura, altura, mobile in [
            ("celular-390x844", 390, 844, True),
            ("desktop-1440x900", 1440, 900, False),
        ]:
            contexto = navegador.new_context(
                viewport={"width": largura, "height": altura},
                device_scale_factor=2 if mobile else 1,
                locale="pt-BR",
                timezone_id="America/Sao_Paulo",
                is_mobile=mobile,
                has_touch=mobile,
            )
            page = contexto.new_page()
            page.on(
                "console",
                lambda m: console_problemas.append(f"[{etiqueta}] {m.type}: {m.text}")
                if m.type in ("error", "warning")
                else None,
            )
            page.on("pageerror", lambda e: console_problemas.append(f"[{etiqueta}] pageerror: {e}"))
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_timeout(700)
            try:
                roteiro(page, etiqueta, mobile)
            except Exception as erro:  # noqa: BLE001
                atual = etiqueta
                falha(f"excecao: {type(erro).__name__}: {erro}")
                page.screenshot(path=str(SHOTS / f"sc-erro-{etiqueta}.png"))
            contexto.close()
        navegador.close()

    atual = "console"
    checar(not console_problemas, f"T13. console sem erros nem avisos ({console_problemas[:4]})")

    resultado = {
        "falhas": falhas,
        "console": console_problemas,
        "passos": passos,
        "total": len(passos),
        "reprovados": len(falhas),
    }
    (Path(__file__).resolve().parent / "resultado-sem-consumo.json").write_text(
        json.dumps(resultado, ensure_ascii=False, indent=2)
    )
    print(f"\n{len(passos) - len(falhas)}/{len(passos)} verificacoes passaram.")
    if falhas:
        print("FALHAS:")
        for f in falhas:
            print(f"  - {f}")
        return 1
    print("Encerramento sem consumo: aceite completo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
