#!/usr/bin/env python3
"""Comprueba que los dos JSON de contenido cuadran entre sí.

Uso:  python scripts/comprobar-idiomas.py [contenido.es.json contenido.en.json]

Falla (código 1) si:
  1. Las claves o el número de elementos de una lista no coinciden.
  2. Un valor que no se traduce (URL, fecha, slug, nombre…) es distinto en cada idioma.
  3. Un texto está vacío, o existe en un idioma y en el otro es nulo.

Además avisa, sin fallar, de los textos traducibles que son iguales en los dos idiomas.

Solo usa la biblioteca estándar: corre igual en local, en la CI y sin entorno virtual.
"""

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
POR_DEFECTO = (
    RAIZ / "apps/api/seed/contenido.es.json",
    RAIZ / "apps/api/seed/contenido.en.json",
)

# Campos que se escriben igual en los dos idiomas. Si cambian en uno, tienen que cambiar en el otro.
FIJOS = {
    "slug", "status", "type", "url", "repo_url", "demo_url", "start_date", "end_date",
    "category", "origen", "sort_order", "is_visible", "is_featured", "is_skill", "level",
    "team_size", "commits_share", "is_team_project", "name", "company", "location",
    "institution", "kind", "hours", "certificate_url", "certificate_file",
}
# Fijos solo dentro de ciertas secciones, donde son listas de nombres. Fuera, la misma
# clave es otra cosa que sí se traduce: "technologies" en la raíz es la sección entera de
# tecnologías y "tools" en conocimientos.grupos es el grupo Herramientas.
FIJOS_EN = {
    "technologies": (".projects[",),
    "tools": (".projects[", ".jobs["),
    # El CV: sus enganches a la web (proyecto, empleos, formación), las fechas del proyecto,
    # los nombres propios y las listas de tecnologías.
    **{
        clave: (".site_texts.cv",)
        for clave in ("proyecto", "empleos", "formacion", "desde", "hasta", "nombre", "empresa", "lista")
    },
}


def es_fijo(clave, ruta):
    return clave in FIJOS or any(ruta.startswith(p) for p in FIJOS_EN.get(clave, ()))


def corto(valor):
    texto = repr(valor)
    return texto if len(texto) <= 60 else texto[:57] + "..."


def comparar(es, en, ruta, errores, iguales, clave=None):
    if es_fijo(clave, ruta):
        if es != en:
            errores.append(f"{ruta}: no se traduce y es distinto ({corto(es)} / {corto(en)})")
        return

    if type(es) is not type(en):
        if es is None or en is None:
            falta = "es" if es is None else "en"
            errores.append(f"{ruta}: falta en {falta}")
        else:
            errores.append(f"{ruta}: tipo distinto ({type(es).__name__} / {type(en).__name__})")
        return

    if isinstance(es, dict):
        for k in sorted(es.keys() - en.keys()):
            errores.append(f"{ruta}.{k}: falta en en")
        for k in sorted(en.keys() - es.keys()):
            errores.append(f"{ruta}.{k}: falta en es")
        for k in es.keys() & en.keys():
            comparar(es[k], en[k], f"{ruta}.{k}", errores, iguales, k)
    elif isinstance(es, list):
        if len(es) != len(en):
            errores.append(f"{ruta}: {len(es)} elementos en es y {len(en)} en en")
        for i, (a, b) in enumerate(zip(es, en)):
            comparar(a, b, f"{ruta}[{i}]", errores, iguales, clave)
    elif isinstance(es, str):
        for idioma, texto in (("es", es), ("en", en)):
            if not texto.strip():
                errores.append(f"{ruta}: texto vacío en {idioma}")
        if es == en:
            iguales.append(f"{ruta}: {corto(es)}")


def main():
    rutas = [Path(p) for p in sys.argv[1:3]] if len(sys.argv) == 3 else POR_DEFECTO
    es, en = (json.loads(p.read_text(encoding="utf-8")) for p in rutas)

    errores, iguales = [], []
    comparar(es, en, "", errores, iguales)

    # Aviso, no error: algunos textos son iguales a propósito ("React", "LinkedIn"…),
    # pero así se ve de un vistazo si alguno se quedó sin traducir.
    print(f"Aviso: {len(iguales)} textos traducibles son iguales en los dos idiomas:")
    for t in iguales:
        print(f"  {t.lstrip('.')}")

    if errores:
        print(f"Los idiomas no cuadran ({len(errores)}):")
        for e in errores:
            print(f"  {e.lstrip('.')}")
        sys.exit(1)
    print("Los dos idiomas cuadran.")


if __name__ == "__main__":
    main()
