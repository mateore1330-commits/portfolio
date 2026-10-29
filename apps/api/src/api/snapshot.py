"""Instantánea del contenido publicado: la "foto" que se incrusta en la web.

La web la lleva dentro del bundle y se ve entera aunque la API esté caída.
Misma base de datos → mismo JSON byte a byte: así el ETag y git solo cambian
cuando cambia el contenido.
"""

import enum
import hashlib
import json
from datetime import date

from sqlalchemy import select

from .extensions import db
from .models import (
    ContentStatus,
    Education,
    Job,
    Link,
    Project,
    SiteText,
    Snapshot,
    TechCategory,
    Technology,
)

VERSION = 1
TAMANO_MAXIMO = 200 * 1024

# Campos internos que no le sirven a la web.
INTERNOS = {"created_at", "updated_at", "status", "is_visible"}


class InstantaneaError(Exception):
    """La instantánea no se puede publicar. El mensaje explica por qué."""


def _valor(v):
    if isinstance(v, enum.Enum):
        return v.value
    if isinstance(v, date):
        return v.isoformat()
    return v


def _fila(obj):
    tabla = obj.__table__
    pk = {c.key for c in tabla.primary_key.columns}
    return {
        c.key: _valor(getattr(obj, c.key))
        for c in tabla.columns
        if c.key not in INTERNOS | pk and not c.foreign_keys
    }


def generar_instantanea():
    """Todo lo publicado, en los dos idiomas, sin borradores ni ocultos y en orden fijo."""
    proyectos = db.session.scalars(
        select(Project)
        .where(Project.status == ContentStatus.PUBLISHED)
        .order_by(Project.sort_order, Project.slug)
    ).all()

    projects = []
    usadas = set()
    for p in proyectos:
        fila = _fila(p)
        fila["technologies"] = [pt.technology.name for pt in p.technologies]
        # A igual sort_order, PostgreSQL no garantiza el orden: se desempata por URL.
        fila["media"] = [_fila(m) for m in sorted(p.media, key=lambda m: (m.sort_order, m.url))]
        usadas.update(fila["technologies"])
        projects.append(fila)

    # Las de Conocimientos, y las de etiquetado solo si las usa un proyecto publicado.
    orden_categoria = {c: i for i, c in enumerate(TechCategory)}
    tecnologias = [
        t for t in db.session.scalars(select(Technology))
        if t.is_skill or t.name in usadas
    ]
    tecnologias.sort(key=lambda t: (orden_categoria[t.category], t.sort_order, t.name))

    def visibles(modelo, *orden):
        consulta = select(modelo).where(modelo.is_visible.is_(True)).order_by(*orden)
        return [_fila(o) for o in db.session.scalars(consulta)]

    return {
        "version": VERSION,
        "site_texts": {
            t.text_key: t.value
            for t in db.session.scalars(select(SiteText).order_by(SiteText.text_key))
        },
        "links": visibles(Link, Link.sort_order, Link.link_id),
        "technologies": [_fila(t) for t in tecnologias],
        "projects": projects,
        "jobs": visibles(Job, Job.sort_order, Job.start_date.desc()),
        "education": visibles(Education, Education.sort_order, Education.education_id),
    }


def canonico(payload):
    """JSON con las claves ordenadas y sin espacios: la base de la huella y del tamaño."""
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def huella(payload):
    return hashlib.sha256(canonico(payload)).hexdigest()


def ultima_instantanea():
    return db.session.scalar(select(Snapshot).order_by(Snapshot.snapshot_id.desc()).limit(1))


def publicar(autor_id):
    """Guarda una instantánea nueva si el contenido ha cambiado. Devuelve (nueva, snapshot, bytes).

    El que llama hace el commit. Se lee con REPEATABLE READ para que la foto no recoja
    la mitad de un cambio que alguien esté guardando a la vez. Por eso tiene que ser lo
    primero de la transacción: si ya se ha consultado algo, falla en vez de ignorarlo.
    """
    if db.session().in_transaction():
        raise RuntimeError("publicar() tiene que empezar su propia transacción.")
    db.session.connection(execution_options={"isolation_level": "REPEATABLE READ"})
    payload = generar_instantanea()
    tamano = len(canonico(payload))
    if tamano > TAMANO_MAXIMO:
        raise InstantaneaError(
            f"La instantánea ocupa {tamano / 1024:.0f} KB y el máximo es "
            f"{TAMANO_MAXIMO // 1024} KB: haría la web más lenta."
        )

    etag = huella(payload)
    ultima = ultima_instantanea()
    if ultima is not None and ultima.etag == etag:
        return False, ultima, tamano

    snapshot = Snapshot(payload=payload, etag=etag, published_by=autor_id)
    db.session.add(snapshot)
    db.session.flush()
    return True, snapshot, tamano
