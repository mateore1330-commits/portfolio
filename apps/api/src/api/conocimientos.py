"""Las tecnologías y los enlaces en el panel (ADM-07).

Las tecnologías son la lista maestra: la usan los proyectos (para etiquetarse) y la
sección Conocimientos (las que tienen is_skill). Por eso:
- el nombre no se repite (sin contar mayúsculas: "react" y "React" son la misma);
- borrar una que usan proyectos la quita de ellos (el panel lo avisa antes, con cuáles).
El nivel es uno de tres, con su etiqueta fija en los dos idiomas (decidido en ADM-07).

Los enlaces: el CV necesita el correo, LinkedIn y GitHub. Mientras sean el único de su
tipo, se editan y se ocultan, pero no se borran (decidido en ADM-07).
"""

import re

from flask import jsonify, request
from sqlalchemy import func, select

from .admin import admin, admin_required
from .extensions import db
from .models import Link, LinkType, Project, ProjectTechnology, TechCategory, Technology
from .proyectos import IDIOMAS, Invalido, _cadena, _texto

NIVELES = {
    33: {"es": "Lo he usado", "en": "Familiar"},
    67: {"es": "Sólido", "en": "Solid"},
    100: {"es": "Lo uso a diario", "en": "Daily use"},
}
NECESARIOS = {LinkType.EMAIL, LinkType.LINKEDIN, LinkType.GITHUB}
FORMATO_URL = re.compile(r"^https?://\S+\.\S+$")
FORMATO_CORREO = re.compile(r"^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$")
LARGO = 500


def _invalido(error):
    return jsonify(error="validacion", errores=error.errores), 400


def _al_final(lista, objeto):
    """Lo nuevo (o lo que cambia de grupo) va al final; desde ahí se mueve arrastrando (ADM-09)."""
    resto = [o for o in lista if o is not objeto]
    objeto.sort_order = max((o.sort_order for o in resto), default=-1) + 1


# ================================================================ Tecnologías

def _del_grupo(categoria):
    consulta = select(Technology).where(Technology.category == categoria)
    return db.session.scalars(consulta.order_by(Technology.sort_order, Technology.name)).all()


def _proyectos_de():
    """{technology_id: [nombre de cada proyecto que la usa]}."""
    filas = db.session.execute(
        select(ProjectTechnology.technology_id, Project.name, Project.slug)
        .join(Project)
        .order_by(Project.sort_order, Project.slug)
    )
    usos = {}
    for tid, nombre, slug in filas:
        usos.setdefault(tid, []).append((nombre or {}).get("es") or slug)
    return usos


def _tecnologia(t, posicion, usos):
    nombre_en = (t.display_name or {}).get("en")
    return {
        "id": t.technology_id,
        "name": t.name,
        "nombre_en": nombre_en if nombre_en and nombre_en != t.name else None,
        "category": t.category.value,
        "level": t.level,
        "level_label": t.level_label,
        "is_skill": t.is_skill,
        "posicion": posicion,
        "proyectos": usos.get(t.technology_id, []),
    }


def _todas():
    orden = {c: i for i, c in enumerate(TechCategory)}
    tecnologias = sorted(
        db.session.scalars(select(Technology)),
        key=lambda t: (orden[t.category], t.sort_order, t.name),
    )
    usos = _proyectos_de()
    posiciones, vistas = {}, {}
    for t in tecnologias:
        vistas[t.category] = vistas.get(t.category, 0) + 1
        posiciones[t.technology_id] = vistas[t.category]
    return [_tecnologia(t, posiciones[t.technology_id], usos) for t in tecnologias]


def limpiar_tecnologia(datos, actual=None):
    errores = {}
    nombre = _cadena(datos.get("name"))
    if not nombre:
        errores["name"] = "obligatorio"
    elif len(nombre) > 80:
        errores["name"] = "largo"
    else:
        consulta = select(Technology).where(func.lower(Technology.name) == nombre.lower())
        otra = db.session.scalar(consulta)
        if otra is not None and otra is not actual:
            errores["name"] = "existe"

    categoria = datos.get("category")
    if categoria not in {c.value for c in TechCategory}:
        errores["category"] = "formato"

    nivel = datos.get("level")
    if nivel is not None and nivel not in NIVELES:
        errores["level"] = "formato"

    if errores:
        raise Invalido(errores)

    # El nombre en inglés, solo si cambia con el idioma; si no, el nombre vale para los dos.
    nombre_en = _cadena(datos.get("nombre_en"))
    traducido = {"es": nombre, "en": nombre_en} if nombre_en and nombre_en != nombre else None
    return {
        "name": nombre,
        "display_name": traducido,
        "category": TechCategory(categoria),
        "level": nivel,
        "level_label": NIVELES.get(nivel),
        "is_skill": datos.get("is_skill") is True,
    }


def _aplicar_tecnologia(t, campos):
    cambia_de_grupo = t.category != campos["category"]
    nueva = t.technology_id is None
    with db.session.no_autoflush:
        for campo, valor in campos.items():
            setattr(t, campo, valor)
        if nueva or cambia_de_grupo:
            _al_final(_del_grupo(t.category), t)


@admin.get("/technologies")
@admin_required
def lista_tecnologias():
    """La lista maestra, por grupos. La usan también los proyectos para elegir."""
    return jsonify(_todas())


@admin.post("/technologies")
@admin_required
def crear_tecnologia():
    try:
        campos = limpiar_tecnologia(request.get_json(silent=True) or {})
    except Invalido as error:
        return _invalido(error)
    t = Technology()
    _aplicar_tecnologia(t, campos)
    db.session.add(t)
    db.session.commit()
    return jsonify(next(x for x in _todas() if x["id"] == t.technology_id)), 201


@admin.put("/technologies/<int:ident>")
@admin_required
def guardar_tecnologia(ident):
    t = db.session.get(Technology, ident)
    if t is None:
        return jsonify(error="no_existe"), 404
    try:
        campos = limpiar_tecnologia(request.get_json(silent=True) or {}, actual=t)
    except Invalido as error:
        return _invalido(error)
    _aplicar_tecnologia(t, campos)
    db.session.commit()
    return jsonify(next(x for x in _todas() if x["id"] == ident))


@admin.patch("/technologies/<int:ident>")
@admin_required
def cambiar_tecnologia(ident):
    """El interruptor "En Conocimientos" de la lista: se guarda al pulsarlo."""
    t = db.session.get(Technology, ident)
    if t is None:
        return jsonify(error="no_existe"), 404
    datos = request.get_json(silent=True) or {}
    if set(datos) != {"is_skill"} or not isinstance(datos["is_skill"], bool):
        return jsonify(error="validacion", errores={"is_skill": "formato"}), 400
    t.is_skill = datos["is_skill"]
    db.session.commit()
    return jsonify(next(x for x in _todas() if x["id"] == ident))


@admin.delete("/technologies/<int:ident>")
@admin_required
def borrar_tecnologia(ident):
    """Borrar. Si la usan proyectos, primero se quita de ellos (el panel ya lo ha avisado)."""
    t = db.session.get(Technology, ident)
    if t is None:
        return jsonify(error="no_existe"), 404
    usos = db.session.scalars(
        select(ProjectTechnology).where(ProjectTechnology.technology_id == ident)
    ).all()
    for pt in usos:
        db.session.delete(pt)
    grupo = t.category
    db.session.delete(t)
    db.session.flush()
    for i, o in enumerate(_del_grupo(grupo)):
        o.sort_order = i
    db.session.commit()
    return jsonify(ok=True, quitada_de=len(usos))


# ================================================================ Enlaces

def _enlaces():
    return db.session.scalars(select(Link).order_by(Link.sort_order, Link.link_id)).all()


def _enlace(e, posicion):
    return {
        "id": e.link_id,
        "type": e.type.value,
        "url": e.url,
        "label": e.label,
        "is_visible": e.is_visible,
        "posicion": posicion,
        "necesario": _es_necesario(e),
    }


def _es_necesario(e):
    """El único de su tipo, y de un tipo que necesita el CV."""
    if e.type not in NECESARIOS:
        return False
    consulta = select(func.count()).select_from(Link).where(Link.type == e.type)
    return db.session.scalar(consulta) <= 1


def _lista_enlaces():
    return [_enlace(e, i) for i, e in enumerate(_enlaces(), start=1)]


def limpiar_enlace(datos):
    errores = {}
    tipo = datos.get("type")
    if tipo not in {t.value for t in LinkType}:
        errores["type"] = "formato"
        tipo = None

    url = _cadena(datos.get("url"))
    # El correo a secas, con su mailto: delante.
    if tipo == "email" and url and not url.startswith("mailto:"):
        url = f"mailto:{url}"
    if not url:
        errores["url"] = "obligatorio"
    elif len(url) > LARGO:
        errores["url"] = "url"
    elif tipo == "email" and not FORMATO_CORREO.match(url):
        errores["url"] = "correo"
    elif tipo and tipo != "email" and not FORMATO_URL.match(url):
        errores["url"] = "url"

    etiqueta = _texto(datos, "label")
    for lang, otro in (("es", "en"), ("en", "es")):
        if etiqueta[otro] and not etiqueta[lang]:
            errores[f"label.{lang}"] = "falta"

    if errores:
        raise Invalido(errores)
    return {
        "type": LinkType(tipo),
        "url": url,
        "label": etiqueta if any(etiqueta[lang] for lang in IDIOMAS) else None,
        "is_visible": datos.get("is_visible", True) is True,
    }


def _aplicar_enlace(e, campos):
    nuevo = e.link_id is None
    with db.session.no_autoflush:
        for campo, valor in campos.items():
            setattr(e, campo, valor)
        if nuevo:
            _al_final(_enlaces(), e)


@admin.get("/links")
@admin_required
def lista_enlaces():
    return jsonify(_lista_enlaces())


@admin.post("/links")
@admin_required
def crear_enlace():
    try:
        campos = limpiar_enlace(request.get_json(silent=True) or {})
    except Invalido as error:
        return _invalido(error)
    e = Link()
    _aplicar_enlace(e, campos)
    db.session.add(e)
    db.session.commit()
    return jsonify(next(x for x in _lista_enlaces() if x["id"] == e.link_id)), 201


@admin.put("/links/<int:ident>")
@admin_required
def guardar_enlace(ident):
    e = db.session.get(Link, ident)
    if e is None:
        return jsonify(error="no_existe"), 404
    try:
        campos = limpiar_enlace(request.get_json(silent=True) or {})
    except Invalido as error:
        return _invalido(error)
    # Cambiar de tipo el único correo, LinkedIn o GitHub dejaría al CV sin él.
    if _es_necesario(e) and campos["type"] != e.type:
        return jsonify(error="validacion", errores={"type": "necesario"}), 400
    _aplicar_enlace(e, campos)
    db.session.commit()
    return jsonify(next(x for x in _lista_enlaces() if x["id"] == ident))


@admin.patch("/links/<int:ident>")
@admin_required
def cambiar_enlace(ident):
    """Ocultar o mostrar desde la lista."""
    e = db.session.get(Link, ident)
    if e is None:
        return jsonify(error="no_existe"), 404
    datos = request.get_json(silent=True) or {}
    if set(datos) != {"is_visible"} or not isinstance(datos["is_visible"], bool):
        return jsonify(error="validacion", errores={"is_visible": "formato"}), 400
    e.is_visible = datos["is_visible"]
    db.session.commit()
    return jsonify(next(x for x in _lista_enlaces() if x["id"] == ident))


@admin.delete("/links/<int:ident>")
@admin_required
def borrar_enlace(ident):
    e = db.session.get(Link, ident)
    if e is None:
        return jsonify(error="no_existe"), 404
    if _es_necesario(e):
        return jsonify(error="necesario"), 409
    db.session.delete(e)
    db.session.flush()
    for i, o in enumerate(_enlaces()):
        o.sort_order = i
    db.session.commit()
    return jsonify(ok=True)
