"""Genera el CV en PDF, en español y en inglés, desde la base de datos.

Uso:  pipenv run generar-cv   (desde apps/api, con Google Chrome instalado y
      npm install hecho en apps/web: usa sus fuentes)

Desde ADM-05, el panel genera el CV público al publicar. Este comando sigue sirviendo para
hacerlo a mano y es el único que hace el CV con teléfono (el privado, para enviarlo tú).
El cómo está en src/api/cv/generar.py. Si alguno no pasa la prueba ATS, no guarda nada.

Salida:
  apps/web/public/cv/CV-Mateo-Rodriguez-Escobar-ES.pdf y -EN.pdf   (públicos, sin teléfono)
  apps/api/cv-privado/…-con-telefono.pdf   (solo si hay CV_TELEFONO en .env; git lo ignora)
"""

import os
import sys
from pathlib import Path

API = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API / "src"))

from api import create_app  # noqa: E402
from api.cv.generar import CVError, datos_cv, generar_pdfs  # noqa: E402

PUBLICOS = API.parent / "web" / "public" / "cv"
PRIVADOS = API / "cv-privado"


def generar():
    telefono = os.getenv("CV_TELEFONO", "").strip()
    with create_app().app_context():
        datos = datos_cv()
    pdfs = generar_pdfs(datos, telefono or None)

    fallan = [p for p in pdfs if p.problemas]
    if fallan:
        detalle = "\n".join(f"{p.nombre}:\n  " + "\n  ".join(p.problemas) for p in fallan)
        raise CVError(f"No pasa la prueba ATS:\n{detalle}")

    # Solo si pasan todos se escriben: nunca queda publicado un CV a medias.
    for pdf in pdfs:
        destino = (PRIVADOS if pdf.telefono else PUBLICOS) / pdf.nombre
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(pdf.contenido)
        print(f"{destino.relative_to(API.parent.parent)}  {len(pdf.contenido) // 1024} KB · "
              "prueba ATS superada")
    if not telefono:
        print("Sin CV_TELEFONO en .env: solo se han generado las versiones públicas.")


if __name__ == "__main__":
    try:
        generar()
    except CVError as e:
        sys.exit(f"No se ha generado el CV. {e}")
