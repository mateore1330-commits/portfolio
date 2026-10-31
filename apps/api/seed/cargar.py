"""Semilla: carga el contenido de los dos JSON en la base de datos.

Uso:  pipenv run seed   (desde apps/api)

- Los JSON son la fuente: la base de datos queda igual que ellos. Añade lo nuevo, actualiza
  lo que cambió y borra lo que ya no está.
- Es idempotente: ejecutarla dos veces deja lo mismo que una.
- Todo va en una transacción: o entra todo, o no entra nada.
- Crea el administrador si no existe (ADMIN_EMAIL y ADMIN_PASSWORD), y nunca lo modifica.
"""

import importlib.util
import json
import os
import sys
from datetime import date
from pathlib import Path

import bcrypt
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB

API = Path(__file__).resolve().parent.parent
RAIZ = API.parent.parent
sys.path.insert(0, str(API / "src"))

from api import create_app  # noqa: E402
from api.extensions import db  # noqa: E402
from api.models import (  # noqa: E402
    AdminUser,
    Education,
    Job,
    Link,
    Project,
    ProjectTechnology,
    SiteText,
    Technology,
)

JSON_ES = API / "seed" / "contenido.es.json"
JSON_EN = API / "seed" / "contenido.en.json"
CONTRASENA_MINIMA = 12


class SemillaError(Exception):
    """Un problema que impide cargar. Se muestra sin traza: el mensaje ya dice qué pasa."""


# =====================================================================
# LEER Y COMPROBAR (antes de tocar la base de datos)
# =====================================================================

def leer_json(ruta):
    try:
        return json.loads(ruta.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SemillaError(f"{ruta.name} no es JSON válido: línea {e.lineno}, columna {e.colno}.")


def comprobar_idiomas(es, en):
    # Se importa el script en vez de copiarlo: una sola regla para la CI y para la semilla.
    script = RAIZ / "scripts" / "comprobar-idiomas.py"
    spec = importlib.util.spec_from_file_location("idiomas", script)
    idiomas = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(idiomas)
    errores = []
    idiomas.comparar(es, en, "", errores, [])
    if errores:
        detalle = "\n".join(f"  {e.lstrip('.')}" for e in errores)
        raise SemillaError(f"Los idiomas no cuadran:\n{detalle}")


SECCIONES = {
    "technologies": Technology,
    "projects": Project,
    "jobs": Job,
    "education": Education,
    "links": Link,
}


def validar_estructura(es):
    errores = []
    for seccion in (*SECCIONES, "site_texts"):
        if seccion not in es:
            errores.append(f"falta la sección '{seccion}'")
    if errores:
        raise SemillaError("El JSON no tiene la estructura esperada:\n  " + "\n  ".join(errores))

    for seccion, modelo in SECCIONES.items():
        columnas = {c.name: c for c in modelo.__table__.columns}
        for i, fila in enumerate(es[seccion]):
            for nombre, col in columnas.items():
                if col.primary_key and col.autoincrement is not False and nombre.endswith("_id"):
                    continue
                obligatorio = not col.nullable and col.server_default is None
                if obligatorio and fila.get(nombre) is None:
                    errores.append(f"{seccion}[{i}]: falta '{nombre}'")
                enum_cls = getattr(col.type, "enum_class", None)
                valor = fila.get(nombre)
                if enum_cls and valor is not None and valor not in {e.value for e in enum_cls}:
                    errores.append(f"{seccion}[{i}].{nombre}: '{valor}' no es un valor válido")
            sobran = set(fila) - set(columnas) - {"technologies"}
            if sobran:
                errores.append(f"{seccion}[{i}]: campos desconocidos {sorted(sobran)}")

    nombres = [t["name"] for t in es["technologies"]]
    slugs = [p["slug"] for p in es["projects"]]
    empleos = [j["slug"] for j in es["jobs"]]
    formacion = [e["slug"] for e in es["education"]]
    listas = (
        (nombres, "tecnología"), (slugs, "proyecto"), (empleos, "empleo"), (formacion, "formación")
    )
    for lista, que in listas:
        for repetido in sorted({x for x in lista if lista.count(x) > 1}):
            errores.append(f"{que} repetido: '{repetido}'")
    for p in es["projects"]:
        for t in p.get("technologies", []):
            if t not in nombres:
                errores.append(f"projects '{p['slug']}': usa '{t}', que no está en technologies")
    errores += comprobar_enganches_cv(es["site_texts"].get("cv"), slugs, empleos, formacion)
    if errores:
        raise SemillaError("El JSON tiene errores:\n  " + "\n  ".join(errores))


def comprobar_enganches_cv(cv, proyectos, empleos, formacion):
    """Cada bloque del CV toma sus fechas (o su enlace) de algo de la web: tiene que existir."""
    if cv is None:
        return []
    errores = []
    for i, p in enumerate(cv.get("proyectos", [])):
        if p.get("proyecto") not in proyectos:
            errores.append(f"cv.proyectos[{i}]: el proyecto '{p.get('proyecto')}' no existe")
    for i, e in enumerate(cv.get("experiencia", [])):
        if not e.get("empleos"):
            errores.append(f"cv.experiencia[{i}]: no está enganchado a ningún empleo")
        for slug in e.get("empleos", []):
            if slug not in empleos:
                errores.append(f"cv.experiencia[{i}]: el empleo '{slug}' no existe")
    for i, e in enumerate(cv.get("educacion", [])):
        if e.get("formacion") not in formacion:
            errores.append(f"cv.educacion[{i}]: la formación '{e.get('formacion')}' no existe")
    return errores


def comprobar_admin_env():
    """Devuelve (email, contraseña) o None. Falla antes de escribir si la contraseña no vale."""
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    contrasena = os.getenv("ADMIN_PASSWORD", "")
    if not email or not contrasena:
        return None
    if "@" not in email:
        raise SemillaError("ADMIN_EMAIL no parece un correo.")
    if len(contrasena) < CONTRASENA_MINIMA:
        raise SemillaError(f"ADMIN_PASSWORD tiene que tener {CONTRASENA_MINIMA} caracteres o más.")
    if len(contrasena.encode("utf-8")) > 72:
        raise SemillaError("ADMIN_PASSWORD no puede pasar de 72 bytes: es el límite de bcrypt.")
    return email, contrasena


# =====================================================================
# UNIR LOS DOS IDIOMAS
# =====================================================================

def unir(modelo, fila_es, fila_en):
    """Convierte una fila de cada idioma en los valores de una fila de la tabla."""
    valores = {}
    for col in modelo.__table__.columns:
        if col.name not in fila_es:
            continue
        valor = fila_es[col.name]
        if isinstance(col.type, JSONB):
            valor = None if valor is None else {"es": valor, "en": fila_en[col.name]}
        elif getattr(col.type, "enum_class", None) and valor is not None:
            valor = col.type.enum_class(valor)
        elif col.type.python_type is date and valor is not None:
            valor = date.fromisoformat(valor)
        valores[col.key] = valor
    return valores


def filas(es, en, seccion, modelo):
    return [unir(modelo, a, b) for a, b in zip(es[seccion], en[seccion])]


# =====================================================================
# ESCRIBIR (todo dentro de la misma transacción)
# =====================================================================

def aplicar(obj, valores):
    """Asigna los valores y dice si algo cambió."""
    cambio = False
    for k, v in valores.items():
        if getattr(obj, k) != v:
            setattr(obj, k, v)
            cambio = True
    return cambio


def sincronizar_por_clave(modelo, clave, deseadas, resumen, nombre):
    """Crea o actualiza por clave natural, y borra lo que ya no está. Conserva los ids."""
    existentes = {getattr(o, clave): o for o in db.session.scalars(select(modelo))}
    creados = actualizados = 0
    for valores in deseadas:
        obj = existentes.pop(valores[clave], None)
        if obj is None:
            db.session.add(modelo(**valores))
            creados += 1
        elif aplicar(obj, valores):
            actualizados += 1
    for obj in existentes.values():
        db.session.delete(obj)
    db.session.flush()
    resumen[nombre] = (creados, actualizados, len(existentes))


def sustituir_si_cambia(modelo, deseadas, resumen, nombre):
    """Para tablas sin clave natural: si ya es igual, no toca nada; si no, lo sustituye."""
    pk = modelo.__table__.primary_key.columns.keys()[0]
    actuales = db.session.scalars(select(modelo).order_by(getattr(modelo, pk))).all()

    campos = sorted(deseadas[0]) if deseadas else []

    def comparable(valores_o_obj):
        es_obj = not isinstance(valores_o_obj, dict)
        return [(k, getattr(valores_o_obj, k) if es_obj else valores_o_obj[k]) for k in campos]

    if [comparable(o) for o in actuales] == [comparable(v) for v in deseadas]:
        resumen[nombre] = (0, 0, 0)
        return
    for obj in actuales:
        db.session.delete(obj)
    db.session.flush()
    db.session.add_all(modelo(**v) for v in deseadas)
    db.session.flush()
    resumen[nombre] = (len(deseadas), 0, len(actuales))


def sincronizar_tecnologias_de_proyectos(es, resumen):
    tecnologias = {t.name: t for t in db.session.scalars(select(Technology))}
    cambiados = 0
    for p in es["projects"]:
        proyecto = db.session.scalar(select(Project).where(Project.slug == p["slug"]))
        deseado = [(nombre, i) for i, nombre in enumerate(p.get("technologies", []))]
        actual = [(pt.technology.name, pt.sort_order) for pt in proyecto.technologies]
        if actual == deseado:
            continue
        # Primero se vacía y se escribe, y después se añade: si no, la clave primaria
        # (project_id, technology_id) chocaría al reinsertar la misma tecnología.
        proyecto.technologies.clear()
        db.session.flush()
        proyecto.technologies.extend(
            ProjectTechnology(technology=tecnologias[nombre], sort_order=i) for nombre, i in deseado
        )
        cambiados += 1
    db.session.flush()
    resumen["tecnologías de proyectos"] = (0, cambiados, 0)


def sincronizar_textos(es, en, resumen):
    deseadas = [
        {"text_key": k, "value": {"es": v, "en": en["site_texts"][k]}}
        for k, v in es["site_texts"].items()
    ]
    sincronizar_por_clave(SiteText, "text_key", deseadas, resumen, "textos")


def borrar_tecnologias_sobrantes(es, resumen):
    """Las tecnologías se borran al final, cuando ya no las usa ningún proyecto."""
    nombres = {t["name"] for t in es["technologies"]}
    sobrantes = [t for t in db.session.scalars(select(Technology)) if t.name not in nombres]
    for t in sobrantes:
        db.session.delete(t)
    db.session.flush()
    creados, actualizados, _ = resumen["tecnologías"]
    resumen["tecnologías"] = (creados, actualizados, len(sobrantes))


def crear_admin(datos):
    if db.session.scalar(select(AdminUser)) is not None:
        return "El administrador ya existe: no se ha cambiado."
    if datos is None:
        return ("Aviso: no hay administrador. Para crearlo, rellena ADMIN_EMAIL y ADMIN_PASSWORD "
                "en el .env y vuelve a ejecutar la semilla.")
    email, contrasena = datos
    hash_ = bcrypt.hashpw(contrasena.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")
    db.session.add(AdminUser(email=email, password_hash=hash_))
    db.session.flush()
    return f"Administrador creado: {email}"


def escribir(es, en, admin):
    resumen = {}
    # Las tecnologías se crean y actualizan primero (los proyectos las necesitan), pero
    # las que sobran se borran al final, cuando ya no las usa nadie.
    tecnologias = filas(es, en, "technologies", Technology)
    existentes = {t.name: t for t in db.session.scalars(select(Technology))}
    creados = actualizados = 0
    for valores in tecnologias:
        obj = existentes.get(valores["name"])
        if obj is None:
            db.session.add(Technology(**valores))
            creados += 1
        elif aplicar(obj, valores):
            actualizados += 1
    db.session.flush()
    resumen["tecnologías"] = (creados, actualizados, 0)

    sincronizar_por_clave(Project, "slug", filas(es, en, "projects", Project), resumen, "proyectos")
    sincronizar_tecnologias_de_proyectos(es, resumen)
    borrar_tecnologias_sobrantes(es, resumen)
    sincronizar_textos(es, en, resumen)
    sustituir_si_cambia(Job, filas(es, en, "jobs", Job), resumen, "empleos")
    sustituir_si_cambia(Education, filas(es, en, "education", Education), resumen, "formación")
    sustituir_si_cambia(Link, filas(es, en, "links", Link), resumen, "enlaces")
    mensaje_admin = crear_admin(admin)
    return resumen, mensaje_admin


# =====================================================================
# PRINCIPAL
# =====================================================================

def cargar():
    es, en = leer_json(JSON_ES), leer_json(JSON_EN)
    comprobar_idiomas(es, en)
    validar_estructura(es)
    admin = comprobar_admin_env()

    app = create_app()
    with app.app_context():
        try:
            resumen, mensaje_admin = escribir(es, en, admin)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

    print("Contenido cargado.\n")
    print(f"  {'':26}{'creados':>9}{'actualizados':>14}{'borrados':>10}")
    for tabla, (c, a, b) in resumen.items():
        print(f"  {tabla:26}{c:>9}{a:>14}{b:>10}")
    print(f"\n{mensaje_admin}")


if __name__ == "__main__":
    try:
        cargar()
    except SemillaError as e:
        sys.exit(f"No se ha cargado nada. {e}")
