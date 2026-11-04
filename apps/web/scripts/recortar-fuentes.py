# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]>=4.59"]
# ///
"""Recorta las fuentes variables de la web a lo que la web usa de verdad.

Por qué: las tres fuentes completas pesaban unos 400 KB, cuatro veces el JavaScript, y en
un móvil con conexión lenta eran lo que más tardaba (Lighthouse: 78 en rendimiento).
Una fuente variable trae todos los gruesos (200–800) y, Newsreader, todos los tamaños
ópticos (6–72). La web solo usa una parte; el resto se quita. Dentro de los rangos que
quedan, la letra se ve exactamente igual.

Rangos medidos en todas las páginas, en los dos idiomas, a 360 y 1440 px:
    Newsreader          grueso 400–600, tamaño óptico 16–36 (el tamaño de la letra en px)
    Newsreader cursiva  grueso 400, tamaño óptico 17: fija (solo la cita de "Sobre mí")
    Archivo             grueso 500–800, ancho 100–125
    JetBrains Mono      grueso 400–800
Si un texto nuevo pide un grueso o un ancho fuera del rango, se queda en el borde más
cercano: amplía aquí el rango y vuelve a ejecutarlo.

Lee el CSS de @fontsource-variable (mismos nombres y unicode-range), recorta los
alfabetos latino y latino extendido, y escribe:
    apps/web/src/assets/fuentes/*.woff2
    apps/web/src/styles/fonts.css

Uso, desde la raíz del repo (con node_modules instalado en apps/web):

    uv run scripts/recortar-fuentes.py
"""

import re
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "apps/web"
FONTSOURCE = WEB / "node_modules/@fontsource-variable"
DESTINO = WEB / "src/assets/fuentes"
CSS = WEB / "src/styles/fonts.css"
ALFABETOS = ("latin", "latin-ext")

# (CSS de fontsource, límites de cada eje)
FUENTES = [
    ("archivo/wdth.css", {"wght": (500, 800), "wdth": (100, 125)}),
    ("newsreader/opsz.css", {"wght": (400, 600), "opsz": (16, 36)}),
    ("newsreader/opsz-italic.css", {"wght": 400, "opsz": 17}),
    ("jetbrains-mono/wght.css", {"wght": (400, 800)}),
]

CABECERA = """/* GENERADO por scripts/recortar-fuentes.py: no editar a mano.
   Las fuentes se sirven desde la propia web, no desde Google Fonts: así no se envía la IP
   del visitante a terceros. Son las de @fontsource-variable recortadas a los gruesos,
   anchos y tamaños que usa la web (el script explica los rangos). Cada alfabeto va en su
   archivo con su unicode-range, y el navegador solo descarga los que usa. */
"""


def bloques(css):
    """Cada @font-face con su comentario de nombre: (nombre, cuerpo)."""
    return re.findall(r"/\* ([\w-]+) \*/\s*@font-face \{(.*?)\}", css, re.S)


def propiedad(cuerpo, nombre):
    return re.search(rf"{nombre}: ([^;]+);", cuerpo).group(1).strip()


def rango(limite):
    return f"{limite[0]} {limite[1]}" if isinstance(limite, tuple) else f"{limite}"


def recortar(origen, destino, limites):
    fuente = TTFont(origen)
    recortada = instancer.instantiateVariableFont(fuente, limites)
    recortada.flavor = "woff2"
    recortada.save(destino)


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    for viejo in DESTINO.glob("*.woff2"):
        viejo.unlink()

    reglas = []
    total_antes = total_despues = 0
    for hoja, limites in FUENTES:
        ruta_css = FONTSOURCE / hoja
        for nombre, cuerpo in bloques(ruta_css.read_text(encoding="utf-8")):
            # "archivo-latin-ext-wdth-normal" → "archivo-latin-ext": termina en el alfabeto.
            if not nombre.rsplit("-", 2)[0].endswith(tuple(f"-{a}" for a in ALFABETOS)):
                continue
            archivo = re.search(r"url\(\./files/([\w.-]+)\)", cuerpo).group(1)
            origen = ruta_css.parent / "files" / archivo
            destino = DESTINO / archivo
            recortar(origen, destino, limites)
            total_antes += origen.stat().st_size
            total_despues += destino.stat().st_size

            ancho = ""
            if "wdth" in limites:
                bajo, alto = limites["wdth"]
                ancho = f"\n  font-stretch: {bajo}% {alto}%;"
            reglas.append(
                f"/* {nombre} */\n@font-face {{\n"
                f"  font-family: {propiedad(cuerpo, 'font-family')};\n"
                f"  font-style: {propiedad(cuerpo, 'font-style')};\n"
                f"  font-display: swap;\n"
                f"  font-weight: {rango(limites['wght'])};{ancho}\n"
                f"  src: url(../assets/fuentes/{archivo}) format('woff2-variations');\n"
                f"  unicode-range: {propiedad(cuerpo, 'unicode-range')};\n}}\n"
            )
            print(f"{archivo}  {origen.stat().st_size // 1024} → {destino.stat().st_size // 1024} KB")

    CSS.write_text(CABECERA + "\n" + "\n".join(reglas), encoding="utf-8")
    print(f"Total: {total_antes // 1024} → {total_despues // 1024} KB · {CSS.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
