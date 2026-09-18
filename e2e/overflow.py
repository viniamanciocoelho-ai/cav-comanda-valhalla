"""Encontra os elementos que estouram a largura em /mesa/8."""

from playwright.sync_api import sync_playwright
from browser_runtime import launch_options

SCRIPT = """() => {
  const limite = document.documentElement.clientWidth;
  const fora = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > limite + 1 || r.left < -1) {
      fora.push({
        tag: el.tagName,
        cls: (el.className || '').toString().slice(0, 150),
        txt: (el.innerText || '').slice(0, 60).replace(/\\n/g, ' | '),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        filhos: el.children.length,
      });
    }
  }
  return { limite, fora };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(**launch_options())
    for largura, rotulo, zoom in [(390, "mobile 390", None), (720, "720 zoom 200%", "2")]:
        ctx = b.new_context(
            viewport={"width": largura, "height": 850},
            locale="pt-BR",
            is_mobile=largura < 500,
            has_touch=largura < 500,
        )
        pg = ctx.new_page()
        pg.goto("http://localhost:4200/mesa/8", wait_until="networkidle")
        if zoom:
            pg.evaluate(f"() => {{ document.documentElement.style.zoom = '{zoom}'; }}")
        pg.wait_for_timeout(900)
        dados = pg.evaluate(SCRIPT)
        print(f"\n===== {rotulo} (clientWidth {dados['limite']}) =====")
        for f in dados["fora"][:25]:
            print(
                f"  <{f['tag']}> l={f['left']} r={f['right']} w={f['w']} filhos={f['filhos']}\n"
                f"     cls: {f['cls']}\n     txt: {f['txt']}"
            )
        if not dados["fora"]:
            print("  nada fora")
        ctx.close()
    b.close()
