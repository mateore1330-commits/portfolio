"""Reordenar arrastrando (ADM-09): cada lista recibe su orden entero de una vez.

El panel manda los ids en el orden nuevo: {"ids": [3, 1, 2]}. Tienen que ser justo los que
hay, ni uno más ni uno menos. Si no cuadran (otra pestaña ha creado o borrado algo mientras
tanto), no se toca nada y se contesta 409: el panel recarga la lista y avisa.

Guardar no publica: la web y el CV toman el orden nuevo al publicar.
"""

from flask import jsonify, request
from sqlalchemy import select

from .admin import admin, admin_required
from .extensions import db
from .models import Link, Project, ProjectMedia, TechCategory, Technology
from .proyectos import un_destacado
from .trayectoria import EMPLEOS, FORMACION


def _ids():
    ids = (request.get_json(silent=True) or {}).get("ids")
    if isinstance(ids, list) and all(type(i) is int for i in ids):
        return ids
    return None


def _ordenar(lista, pk, despues=None):
    """Numera `lista` (los objetos de ahora) con el orden de los ids recibidos: 0, 1, 2…
    despues(): lo que haya que hacer luego (los proyectos: la regla del destacado); lo que
    devuelva va en la respuesta."""
    ids = _ids()
    if ids is None:
        return jsonify(error="validacion", errores={"ids": "forma"}), 400
    por_id = {getattr(o, pk): o for o in lista}
    if len(ids) != len(set(ids)) or set(ids) != set(por_id):
        return jsonify(error="desfasado"), 409
    for i, ident in enumerate(ids):
        por_id[ident].sort_order = i
    extra = despues() if despues else {}
    db.session.commit()
    return jsonify(ok=True, **extra)


@admin.put("/projects/orden")
@admin_required
def ordenar_proyectos():
    """El primer publicado del orden nuevo pasa a ser el destacado y va el primero (#154): un
    borrador puesto arriba queda segundo. El panel lo confirma antes de mandarlo."""
    lista = db.session.scalars(select(Project)).all()
    return _ordenar(lista, "project_id", lambda: {"cambio_destacado": un_destacado()})


@admin.put("/jobs/orden")
@admin_required
def ordenar_empleos():
    return _ordenar(EMPLEOS.ordenados(), EMPLEOS.pk)


@admin.put("/education/orden")
@admin_required
def ordenar_formacion():
    return _ordenar(FORMACION.ordenados(), FORMACION.pk)


@admin.put("/technologies/orden")
@admin_required
def ordenar_tecnologias():
    """Las de un grupo: {"category": "frontend", "ids": […]}. Cambiar de grupo, en su diálogo."""
    grupo = (request.get_json(silent=True) or {}).get("category")
    if grupo not in {c.value for c in TechCategory}:
        return jsonify(error="validacion", errores={"category": "formato"}), 400
    consulta = select(Technology).where(Technology.category == TechCategory(grupo))
    return _ordenar(db.session.scalars(consulta).all(), "technology_id")


@admin.put("/links/orden")
@admin_required
def ordenar_enlaces():
    return _ordenar(db.session.scalars(select(Link)).all(), "link_id")


@admin.put("/projects/<int:project_id>/media/orden")
@admin_required
def ordenar_imagenes(project_id):
    if db.session.get(Project, project_id) is None:
        return jsonify(error="no_existe"), 404
    consulta = select(ProjectMedia).where(ProjectMedia.project_id == project_id)
    return _ordenar(db.session.scalars(consulta).all(), "media_id")
