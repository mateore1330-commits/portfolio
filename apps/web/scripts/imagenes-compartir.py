# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=11.3"]
# ///
"""Genera las imágenes para compartir (1200 × 630) de cada página: la tarjeta que enseñan
LinkedIn, WhatsApp o X al pegar un enlace.

Composición aprobada el 31/10/2026 (Recursos/Maquetas/compartir-tarjeta-e-imagen.html,
opción 2): el retrato en duotono a la izquierda y el nombre (o el del proyecto) a la
derecha. Una por idioma: la portada y cada proyecto publicado.

Monta cada imagen como una página HTML (con las fuentes y el retrato de la web) y le hace
una captura con Chrome sin ventana. Luego la pasa a JPEG.

Uso, desde la raíz del repo (con Google Chrome instalado):

    uv run scripts/imagenes-compartir.py

Vuelve a ejecutarlo si cambia un proyecto, el retrato o los textos. Las imágenes van a
apps/web/public/compartir/ y se suben al repo.
"""

import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "apps/web"
DESTINO = WEB / "public/compartir"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FUENTES = WEB / "node_modules/@fontsource-variable"
RETRATO = WEB / "src/assets/retrato/retrato-660.jpg"
DOMINIO = "mateorodriguez.solutions"

TEXTOS = {
    "es": {"portfolio": "Portfolio 2026", "rol": "Desarrollador<br>Full Stack", "proyecto": "Proyecto"},
    "en": {"portfolio": "Portfolio 2026", "rol": "Full Stack<br>Developer", "proyecto": "Project"},
}

PLANTILLA = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:Archivo;src:url("{archivo}") format("woff2");font-weight:100 900;font-stretch:62% 125%}}
@font-face{{font-family:Mono;src:url("{mono}") format("woff2");font-weight:100 800}}
*{{box-sizing:border-box;margin:0}}
html,body{{width:1200px;height:630px;overflow:hidden;background:#0B0D11}}
.og{{display:grid;grid-template-columns:450px 1fr;width:1200px;height:630px;color:#EDEBE5;font-family:Archivo}}
.foto{{position:relative;background:#000;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.12) brightness(1.02)}}
.foto i{{position:absolute;inset:0;background:#7290FF;mix-blend-mode:color;opacity:.58}}
.t{{position:relative;padding:70px}}
.k{{font:500 15px Mono;letter-spacing:.16em;text-transform:uppercase;color:#7290FF}}
h1{{margin:34px 0 40px;font-weight:800;font-variation-settings:"wdth" 125;text-transform:uppercase;
   letter-spacing:-.035em;line-height:.86;font-size:80px;max-width:610px}}
.r{{font:500 22px/1.5 Mono;letter-spacing:.14em;text-transform:uppercase}}
.dom{{position:absolute;left:70px;bottom:62px;font:500 15px Mono;letter-spacing:.14em;text-transform:uppercase;color:#8A8E99}}
</style></head><body><div class="og">
<div class="foto"><img src="{retrato}"><i></i></div>
<div class="t"><p class="k">{etiqueta}</p><h1>{titulo}</h1><p class="r">{subtitulo}</p><p class="dom">{dominio}</p></div>
</div><script>
// Si el titular no cabe en su columna, se reduce hasta que quepa.
document.fonts.ready.then(() => {{
  const h = document.querySelector('h1');
  let t = 80;
  while ((h.scrollWidth > h.clientWidth || h.offsetHeight > 300) && t > 40) h.style.fontSize = (t -= 2) + 'px';
}});
</script></body></html>"""


def en_lineas(nombre):
    """"Mateo Rodríguez" → dos líneas; "Blog Dragon Ball" → una palabra por línea."""
    return "<br>".join(html.escape(p) for p in nombre.split())


def capturar(pagina_html, salida):
    with tempfile.TemporaryDirectory() as tmp:
        origen = Path(tmp) / "og.html"
        png = Path(tmp) / "og.png"
        origen.write_text(pagina_html, encoding="utf-8")
        subprocess.run(
            [
                CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--window-size=1200,630",
                "--virtual-time-budget=3000", f"--screenshot={png}", origen.as_uri(),
            ],
            check=True, capture_output=True, timeout=60,
        )
        Image.open(png).convert("RGB").save(salida, quality=86, optimize=True, progressive=True)


def main():
    if not Path(CHROME).exists():
        sys.exit("Hace falta Google Chrome en /Applications para generar las imágenes.")
    contenido = json.loads((WEB / "src/content/snapshot.json").read_text(encoding="utf-8"))
    comun = {
        "archivo": (FUENTES / "archivo/files/archivo-latin-wdth-normal.woff2").as_uri(),
        "mono": (FUENTES / "jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2").as_uri(),
        "retrato": RETRATO.as_uri(),
        "dominio": DOMINIO,
    }
    DESTINO.mkdir(parents=True, exist_ok=True)

    paginas = []
    for lang, t in TEXTOS.items():
        nombre = contenido["site_texts"]["hero.nombre"][lang]
        paginas.append((f"portada-{lang}.jpg", t["portfolio"], en_lineas(nombre), t["rol"]))
        for p in contenido["projects"]:
            paginas.append((
                f"proyecto-{p['slug']}-{lang}.jpg",
                t["proyecto"],
                en_lineas(p["name"][lang]),
                html.escape(p["label"][lang]).replace(" · ", "<br>"),
            ))

    for archivo, etiqueta, titulo, subtitulo in paginas:
        salida = DESTINO / archivo
        capturar(PLANTILLA.format(etiqueta=etiqueta, titulo=titulo, subtitulo=subtitulo, **comun), salida)
        print(f"{salida.relative_to(RAIZ)}  {salida.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
