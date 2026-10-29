# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=11.3"]
# ///
"""Genera las versiones del retrato de la portada a partir de una foto original.

Recorta en vertical (proporción 756:880, la de la maqueta), centrado en horizontal y con
toda la altura, y exporta cada ancho en AVIF, WebP y JPEG. Se guarda sin metadatos (EXIF):
en una foto que se publica, la cámara, la fecha o la ubicación no deben viajar.

Uso, desde la raíz del repo (no hace falta instalar nada en el proyecto):

    uv run scripts/optimizar-retrato.py ruta/a/la/foto.jpg

Si la foto nueva es más grande, añade el ancho a ANCHOS (p. ej. 1000, para pantallas
Retina) y actualiza la lista de imports de apps/web/src/sections/Hero.jsx.
"""

import sys
from pathlib import Path

from PIL import Image, ImageOps

PROPORCION = 756 / 880  # ancho / alto
ANCHOS = (400, 660)
DESTINO = Path(__file__).resolve().parent.parent / "apps/web/src/assets/retrato"
CALIDAD = {"avif": 55, "webp": 78, "jpg": 82}


def recortar(foto: Image.Image) -> Image.Image:
    ancho, alto = foto.size
    if ancho / alto > PROPORCION:  # sobra ancho: se corta por los lados
        nuevo = round(alto * PROPORCION)
        x = (ancho - nuevo) // 2
        return foto.crop((x, 0, x + nuevo, alto))
    nuevo = round(ancho / PROPORCION)  # sobra alto: se corta por abajo, la cara suele estar arriba
    return foto.crop((0, 0, ancho, nuevo))


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Uso: uv run scripts/optimizar-retrato.py ruta/a/la/foto.jpg")

    # exif_transpose gira la foto si la cámara la guardó de lado; luego se pierde el EXIF.
    foto = recortar(ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB"))
    if foto.width < max(ANCHOS):
        sys.exit(f"La foto recortada mide {foto.width} px de ancho: hacen falta {max(ANCHOS)}.")

    DESTINO.mkdir(parents=True, exist_ok=True)
    for ancho in ANCHOS:
        alto = round(ancho / PROPORCION)
        copia = foto.resize((ancho, alto), Image.Resampling.LANCZOS)
        for formato, calidad in CALIDAD.items():
            archivo = DESTINO / f"retrato-{ancho}.{formato}"
            opciones = {"progressive": True} if formato == "jpg" else {}
            copia.save(archivo, quality=calidad, optimize=formato == "jpg", **opciones)
            print(f"{archivo.relative_to(DESTINO.parents[4])}  {ancho}×{alto}  {archivo.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
