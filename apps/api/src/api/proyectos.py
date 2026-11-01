"""Los proyectos en el panel (ADM-03): la lista, crear, editar, borrar y la vista previa.

Guardar no publica: la web enseña la última instantánea (snapshot.py), que solo recoge los
proyectos publicados. Un borrador se guarda con lo que tenga; para marcarlo publicado tiene
que estar completo en los dos idiomas, así en la web nunca sale nada a medio traducir.

Los errores de validación van por campo, con la forma que pinta el formulario:
{"name.en": "falta", "learning.en.3": "falta", "slug": "existe"…}.
"""

import copy
import re
import unicodedata

from flask import jsonify, request
from sqlalchemy import func, select

from .admin import admin, admin_required
from .extensions import db
from .models import (
    ContentStatus,
    Project,
    ProjectMedia,
    ProjectTechnology,
    SiteText,
    TechCategory,
    Technology,
)
from .snapshot import generar_instantanea

IDIOMAS = ("es", "en")
TEXTOS = ("name", "label", "period", "summary")
PARRAFOS = ("description", "my_role", "learning")
FORMATO_SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
FORMATO_URL = re.compile(r"^https?://\S+$")
LARGO_SLUG = 80
LARGO_URL = 500


class Invalido(Exception):
    def __init__(self, errores, **extra):
        super().__init__()
        self.errores = errores
        self.extra = extra


def a_slug(texto):
    """"Blog Dragón Ball" → "blog-dragon-ball": sin tildes, la ñ como n y guiones."""
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")[:LARGO_SLUG].strip("-")


# ---------------------------------------------------------------- Leer

def _ordenados():
    # El mismo orden que la instantánea: sort_order y, a igualdad, el slug.
    return db.session.scalars(select(Project).order_by(Project.sort_order, Project.slug)).all()


def _cv():
    return db.session.get(SiteText, "cv")


def usos_en_cv(slug):
    """Los títulos de las entradas del CV que enganchan este proyecto (en español)."""
    cv = _cv()
    entradas = (cv.value.get("es") or {}).get("proyectos", []) if cv else []
    return [e.get("titulo") or slug for e in entradas if e.get("proyecto") == slug]


def _resumen(p, posicion):
    return {
        "id": p.project_id,
        "slug": p.slug,
        "name": p.name,
        "label": p.label,
        "status": p.status.value,
        "posicion": posicion,
        "is_featured": p.is_featured,
        "tecnologias": len(p.technologies),
        "updated_at": p.updated_at.isoformat(),
    }


def _entero(p, posicion):
    return {
        **_resumen(p, posicion),
        "period": p.period,
        "summary": p.summary,
        **{campo: getattr(p, campo) for campo in PARRAFOS},
        "repo_url": p.repo_url,
        "demo_url": p.demo_url,
        "is_team_project": p.is_team_project,
        "team_size": p.team_size,
        "commits_share": p.commits_share,
        "technologies": [
            {"id": pt.technology_id, "name": pt.technology.name} for pt in p.technologies
        ],
        "imagenes": db.session.scalar(
            select(func.count())
            .select_from(ProjectMedia)
            .where(ProjectMedia.project_id == p.project_id)
        ),
        "en_cv": usos_en_cv(p.slug),
    }


def _posicion(p):
    return next(i for i, o in enumerate(_ordenados(), start=1) if o.project_id == p.project_id)


def _buscar(project_id):
    p = db.session.get(Project, project_id)
    if p is None:
        return None, (jsonify(error="no_existe"), 404)
    return p, None


# ---------------------------------------------------------------- Limpiar y validar

def _cadena(valor):
    return valor.strip() if isinstance(valor, str) else ""


def _texto(datos, campo):
    valor = datos.get(campo) if isinstance(datos.get(campo), dict) else {}
    return {lang: _cadena(valor.get(lang)) for lang in IDIOMAS}


def _parrafos(datos, campo):
    """Las dos listas, emparejadas por posición. Se quitan los huecos vacíos en los dos idiomas."""
    valor = datos.get(campo) if isinstance(datos.get(campo), dict) else {}
    listas = {
        lang: [_cadena(x) for x in valor.get(lang)] if isinstance(valor.get(lang), list) else []
        for lang in IDIOMAS
    }
    largo = max(len(lista) for lista in listas.values())
    for lista in listas.values():
        lista.extend([""] * (largo - len(lista)))
    parejas = [i for i in range(largo) if any(listas[lang][i] for lang in IDIOMAS)]
    return {lang: [listas[lang][i] for i in parejas] for lang in IDIOMAS}


def _numero(valor, minimo, maximo):
    """None si viene vacío; False si no es un entero válido."""
    if valor in (None, ""):
        return None
    if isinstance(valor, bool) or not isinstance(valor, int) or not minimo <= valor <= maximo:
        return False
    return valor


def _url(valor):
    texto = _cadena(valor)
    if not texto:
        return None
    if len(texto) > LARGO_URL or not FORMATO_URL.match(texto):
        return False
    return texto


def limpiar(datos, actual=None):
    """Lo que llega del formulario, listo para guardar. Lanza Invalido con todos los errores."""
    errores = {}
    extra = {}
    campos = {campo: _texto(datos, campo) for campo in TEXTOS}
    campos |= {campo: _parrafos(datos, campo) for campo in PARRAFOS}

    estado = datos.get("status", "draft")
    if estado not in {s.value for s in ContentStatus}:
        errores["status"] = "formato"
        estado = "draft"
    publicado = estado == ContentStatus.PUBLISHED.value

    if not campos["name"]["es"]:
        errores["name.es"] = "obligatorio"
    if publicado:
        # Completo: los textos en los dos idiomas y cada párrafo con su pareja.
        for campo in TEXTOS:
            for lang in IDIOMAS:
                if not campos[campo][lang]:
                    errores.setdefault(f"{campo}.{lang}", "falta")
        for campo in PARRAFOS:
            for lang in IDIOMAS:
                for i, texto in enumerate(campos[campo][lang]):
                    if not texto:
                        errores[f"{campo}.{lang}.{i}"] = "falta"

    slug = _cadena(datos.get("slug")) or a_slug(campos["name"]["es"])
    if not slug:
        errores.setdefault("slug", "obligatorio")
    elif len(slug) > LARGO_SLUG or not FORMATO_SLUG.match(slug):
        errores["slug"] = "formato"
    else:
        otro = db.session.scalar(select(Project).where(Project.slug == slug))
        if otro is not None and otro is not actual:
            errores["slug"] = "existe"
            extra["slug_de"] = otro.name.get("es") or otro.slug

    en_equipo = datos.get("is_team_project") is True
    personas = _numero(datos.get("team_size"), 2, 1000) if en_equipo else None
    commits = _numero(datos.get("commits_share"), 0, 100) if en_equipo else None
    if personas is False:
        errores["team_size"] = "numero"
    if commits is False:
        errores["commits_share"] = "numero"

    urls = {campo: _url(datos.get(campo)) for campo in ("demo_url", "repo_url")}
    errores |= {campo: "url" for campo, valor in urls.items() if valor is False}

    posicion = _numero(datos.get("posicion"), 1, 100000)
    if posicion is False:
        errores["posicion"] = "numero"

    ids = datos.get("technologies", [])
    enteros = isinstance(ids, list) and all(type(i) is int for i in ids)
    if not enteros:
        ids = None
    elif len(set(ids)) != len(ids):
        ids = None
    elif ids:
        consulta = select(Technology.technology_id).where(Technology.technology_id.in_(ids))
        existen = set(db.session.scalars(consulta))
        if existen != set(ids):
            ids = None
    if ids is None:
        errores["technologies"] = "no_existe"

    if errores:
        raise Invalido(errores, **extra)

    def opcional(valor):
        # Vacío en los dos idiomas → NULL, como los proyectos sin "Mi papel".
        return valor if any(valor[lang] for lang in IDIOMAS) else None

    return {
        "slug": slug,
        "status": ContentStatus(estado),
        "is_featured": datos.get("is_featured") is True,
        "is_team_project": en_equipo,
        "team_size": personas,
        "commits_share": commits,
        **urls,
        "name": campos["name"],
        "summary": campos["summary"],
        **{campo: opcional(campos[campo]) for campo in ("label", "period", *PARRAFOS)},
        "technologies": ids,
        "posicion": posicion,
    }


# ---------------------------------------------------------------- Guardar

def _colocar(proyecto, posicion):
    """Lo pone en esa posición (1 es la primera) y numera todos de nuevo: 0, 1, 2…"""
    resto = [p for p in _ordenados() if p is not proyecto]
    indice = len(resto) if posicion is None else min(posicion - 1, len(resto))
    resto.insert(indice, proyecto)
    for i, p in enumerate(resto):
        p.sort_order = i


def _renombrar_en_cv(anterior, nuevo):
    """El CV engancha los proyectos por su slug: si cambia, el enganche cambia con él."""
    cv = _cv()
    if cv is None:
        return
    valor = copy.deepcopy(cv.value)
    for lang in IDIOMAS:
        for entrada in (valor.get(lang) or {}).get("proyectos", []):
            if entrada.get("proyecto") == anterior:
                entrada["proyecto"] = nuevo
    # Un dict nuevo: SQLAlchemy no ve los cambios dentro de un JSONB si es el mismo objeto.
    cv.value = valor


def _aplicar(proyecto, campos):
    tecnologias = campos.pop("technologies")
    posicion = campos.pop("posicion")
    for campo, valor in campos.items():
        setattr(proyecto, campo, valor)
    # Las que ya estaban se reutilizan: una fila nueva con la misma clave chocaría con la
    # vieja antes de que se borre.
    ya = {pt.technology_id: pt for pt in proyecto.technologies}
    proyecto.technologies = [
        ya.get(tid) or ProjectTechnology(technology_id=tid) for tid in tecnologias
    ]
    for i, pt in enumerate(proyecto.technologies):
        pt.sort_order = i
    # Al crear, al final; al editar sin posición, donde estaba.
    if posicion is not None or proyecto.project_id is None:
        _colocar(proyecto, posicion)
    # updated_at solo se mueve solo si cambia una columna; las tecnologías también cuentan.
    proyecto.updated_at = func.now()


def _invalido(error):
    return jsonify(error="validacion", errores=error.errores, **error.extra), 400


# ---------------------------------------------------------------- Rutas

@admin.get("/projects")
@admin_required
def lista_proyectos():
    """Todos, publicados y borradores, en el orden de la web."""
    return jsonify([_resumen(p, i) for i, p in enumerate(_ordenados(), start=1)])


@admin.post("/projects")
@admin_required
def crear_proyecto():
    """Crear. Nace donde diga su posición o, si no la trae, al final."""
    try:
        campos = limpiar(request.get_json(silent=True) or {})
    except Invalido as error:
        return _invalido(error)
    proyecto = Project()
    db.session.add(proyecto)
    _aplicar(proyecto, campos)
    db.session.commit()
    return jsonify(_entero(proyecto, _posicion(proyecto))), 201


@admin.get("/projects/<int:project_id>")
@admin_required
def ver_proyecto(project_id):
    proyecto, falla = _buscar(project_id)
    return falla or jsonify(_entero(proyecto, _posicion(proyecto)))


@admin.put("/projects/<int:project_id>")
@admin_required
def guardar_proyecto(project_id):
    """El formulario entero. Si cambia el slug, el CV cambia con él en el mismo guardado."""
    proyecto, falla = _buscar(project_id)
    if falla:
        return falla
    try:
        campos = limpiar(request.get_json(silent=True) or {}, actual=proyecto)
    except Invalido as error:
        return _invalido(error)
    if campos["slug"] != proyecto.slug:
        _renombrar_en_cv(proyecto.slug, campos["slug"])
    _aplicar(proyecto, campos)
    db.session.commit()
    return jsonify(_entero(proyecto, _posicion(proyecto)))


@admin.patch("/projects/<int:project_id>")
@admin_required
def cambiar_proyecto(project_id):
    """Cambios sueltos desde la lista: por ahora, la estrella de destacado."""
    proyecto, falla = _buscar(project_id)
    if falla:
        return falla
    datos = request.get_json(silent=True) or {}
    if set(datos) != {"is_featured"} or not isinstance(datos["is_featured"], bool):
        return jsonify(error="validacion", errores={"is_featured": "formato"}), 400
    proyecto.is_featured = datos["is_featured"]
    db.session.commit()
    return jsonify(_resumen(proyecto, _posicion(proyecto)))


@admin.delete("/projects/<int:project_id>")
@admin_required
def borrar_proyecto(project_id):
    """Borrar. Sus tecnologías dejan de estar asociadas (la lista maestra no se toca). Si el
    CV lo engancha, el enganche se queda y hay que cambiarlo en el CV (el diálogo lo avisa)."""
    proyecto, falla = _buscar(project_id)
    if falla:
        return falla
    db.session.delete(proyecto)
    db.session.flush()
    for i, p in enumerate(_ordenados()):
        p.sort_order = i
    db.session.commit()
    return jsonify(ok=True)


@admin.get("/projects/slug")
@admin_required
def slug_libre():
    """¿Está libre esta dirección? Para avisar mientras se escribe. `excepto`: el que se edita."""
    valor = _cadena(request.args.get("valor"))
    excepto = request.args.get("excepto", type=int)
    if not valor or len(valor) > LARGO_SLUG or not FORMATO_SLUG.match(valor):
        return jsonify(valido=False, libre=False, de=None)
    otro = db.session.scalar(select(Project).where(Project.slug == valor))
    libre = otro is None or otro.project_id == excepto
    de = None if libre else (otro.name.get("es") or otro.slug)
    return jsonify(valido=True, libre=libre, de=de)


@admin.get("/projects/<int:project_id>/vista-previa")
@admin_required
def vista_previa(project_id):
    """Todo el contenido de la web como quedaría con este proyecto publicado (con lo guardado),
    y su slug, para saber cuál enseñar (la instantánea no lleva los id)."""
    proyecto, falla = _buscar(project_id)
    if falla:
        return falla
    return jsonify(slug=proyecto.slug, contenido=generar_instantanea(incluir=proyecto.project_id))


@admin.get("/technologies")
@admin_required
def lista_tecnologias():
    """La lista maestra, para elegir de ella (editarla es ADM-07)."""
    orden = {c: i for i, c in enumerate(TechCategory)}
    tecnologias = sorted(
        db.session.scalars(select(Technology)),
        key=lambda t: (orden[t.category], t.sort_order, t.name),
    )
    return jsonify([
        {"id": t.technology_id, "name": t.name, "category": t.category.value} for t in tecnologias
    ])
