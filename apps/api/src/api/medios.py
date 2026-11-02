"""Las imágenes de los proyectos y los certificados, en Cloudinary (ADM-08).

El archivo pasa por la API, nunca directo del navegador a Cloudinary: así se comprueba de
verdad qué es (por sus primeros bytes, no por el nombre) y la clave de Cloudinary solo la
tiene el servidor. En la base de datos se guarda la dirección.

Borrar (decidido en ADM-08): lo que la web no enseña todavía se borra de Cloudinary al
momento; lo que sí enseña (está en la última publicación), al publicar, cuando la web ya no
lo usa. Así la web nunca enseña una imagen rota.

Sin CLOUDINARY_URL en el .env, subir responde 503 con un mensaje claro.
"""

import io
import json
import logging
import re
from urllib.parse import urlparse

from flask import current_app, jsonify, request
from sqlalchemy import func, select

from .admin import admin, admin_required
from .extensions import db
from .models import ContentStatus, Education, Project, ProjectMedia
from .proyectos import IDIOMAS, _cadena
from .snapshot import ultima_instantanea

MAXIMO = 5 * 1024 * 1024  # 5 MB, lo que dice la maqueta
IMAGENES = {"jpg", "png", "webp"}
CERTIFICADOS = {"pdf", "jpg", "png"}
# Lo que se pide a Cloudinary al servir una foto: el mejor formato para cada navegador, la
# calidad justa y como mucho 1600 px de ancho.
OPTIMIZADA = "f_auto,q_auto,c_limit,w_1600"
NUESTRA = re.compile(
    r"^https://res\.cloudinary\.com/[^/]+/(?P<tipo>image|raw)/upload/(?:[^/]+/)*?v\d+/(?P<id>.+)$"
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------- Qué es el archivo

def formato(contenido):
    """El formato de verdad, por sus primeros bytes. None si no es ninguno conocido."""
    if contenido.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "webp"
    if contenido.startswith(b"%PDF-"):
        return "pdf"
    return None


# ---------------------------------------------------------------- Cloudinary

class Cloudinary:
    """Lo único que se hace con Cloudinary: subir y borrar. Los tests ponen otro en su lugar."""

    def __init__(self, url):
        partes = urlparse(url)
        self.cuenta = {
            "cloud_name": partes.hostname,
            "api_key": partes.username,
            "api_secret": partes.password,
            "secure": True,
        }

    def subir(self, contenido, carpeta, tipo):
        import cloudinary.uploader

        resultado = cloudinary.uploader.upload(
            io.BytesIO(contenido), folder=carpeta, resource_type=tipo, **self.cuenta
        )
        return resultado["secure_url"]

    def borrar(self, public_id, tipo):
        import cloudinary.uploader

        cloudinary.uploader.destroy(public_id, resource_type=tipo, invalidate=True, **self.cuenta)


def nube():
    """La conexión con Cloudinary, o None si falta CLOUDINARY_URL."""
    url = current_app.config.get("CLOUDINARY_URL")
    return Cloudinary(url) if url else None


def _sin_nube():
    return jsonify(error="sin_cloudinary"), 503


def optimizada(url):
    """La dirección de la foto, con lo que se pide a Cloudinary al servirla."""
    return url.replace("/image/upload/", f"/image/upload/{OPTIMIZADA}/", 1)


def de_cloudinary(url):
    """(public_id, tipo) si es un archivo nuestro en Cloudinary; None si no (/certificados/…)."""
    m = NUESTRA.match(url or "")
    if not m:
        return None
    tipo, ident = m["tipo"], m["id"]
    # En las imágenes, el public_id va sin la extensión; en los archivos (raw), con ella.
    return (ident.rsplit(".", 1)[0] if tipo == "image" else ident), tipo


def en_la_web(url):
    """¿La enseña la web? Es decir, ¿está en la última publicación?"""
    ultima = ultima_instantanea()
    return ultima is not None and url in json.dumps(ultima.payload)


def borrar_de_cloudinary(url):
    """Borra el archivo de Cloudinary, si es nuestro. Si falla, solo se apunta: no se para nada."""
    datos = de_cloudinary(url)
    conexion = nube()
    if datos is None or conexion is None:
        return
    try:
        conexion.borrar(*datos)
    except Exception:  # noqa: BLE001 (Cloudinary puede fallar de muchas formas; no debe parar)
        log.exception("No se ha podido borrar de Cloudinary: %s", url)


def soltar(url):
    """Un archivo que deja de usarse en el panel: si la web no lo enseña, se borra ya; si lo
    enseña, se borrará al publicar (limpiar_al_publicar)."""
    if url and not en_la_web(url):
        borrar_de_cloudinary(url)


def _en_uso():
    """Todas las direcciones que usa ahora la base de datos."""
    usadas = set(db.session.scalars(select(ProjectMedia.url)))
    usadas |= set(db.session.scalars(select(Education.certificate_file)))
    return usadas


def limpiar_al_publicar(antes, despues):
    """Tras publicar: lo de Cloudinary que salía en la publicación anterior y ya no sale ni se
    usa en el panel se borra. antes: el texto de la anterior; despues: la nueva."""
    if not antes:
        return
    nuevas = json.dumps(despues)
    en_uso = _en_uso()
    viejas = set(re.findall(r'https://res\.cloudinary\.com/[^"]+', antes))
    for url in viejas:
        if url not in nuevas and url not in en_uso:
            borrar_de_cloudinary(url)


# ---------------------------------------------------------------- Subir

def _archivo(permitidos):
    """El archivo subido, comprobado. (contenido, formato) o (None, respuesta de error)."""
    archivo = request.files.get("archivo")
    if archivo is None:
        return None, (jsonify(error="sin_archivo"), 400)
    contenido = archivo.read(MAXIMO + 1)
    if len(contenido) > MAXIMO:
        return None, (jsonify(error="grande", tamano=len(contenido)), 400)
    tipo = formato(contenido)
    if tipo not in permitidos:
        return None, (jsonify(error="formato"), 400)
    return (contenido, tipo), None


def _subir(contenido, tipo, carpeta):
    conexion = nube()
    try:
        # Los PDF como archivo (raw): las cuentas nuevas de Cloudinary no sirven PDF como imagen.
        url = conexion.subir(contenido, carpeta, "raw" if tipo == "pdf" else "image")
    except Exception:  # noqa: BLE001
        log.exception("No se ha podido subir a Cloudinary")
        return None
    return optimizada(url) if tipo != "pdf" else url


# ---------------------------------------------------------------- Imágenes de un proyecto

def alt_completo(alt):
    return bool(alt) and all(_cadena(alt.get(lang)) for lang in IDIOMAS)


def _imagen(m):
    return {
        "id": m.media_id,
        "url": m.url,
        "alt": m.alt or {"es": "", "en": ""},
        "is_cover": m.is_cover,
        "posicion": m.sort_order + 1,
    }


def _imagenes(proyecto):
    consulta = select(ProjectMedia).where(ProjectMedia.project_id == proyecto.project_id)
    orden = (ProjectMedia.sort_order, ProjectMedia.media_id)
    return db.session.scalars(consulta.order_by(*orden)).all()


def _proyecto(project_id):
    p = db.session.get(Project, project_id)
    if p is None:
        return None, (jsonify(error="no_existe"), 404)
    return p, None


@admin.get("/projects/<int:project_id>/media")
@admin_required
def ver_imagenes(project_id):
    proyecto, falla = _proyecto(project_id)
    if falla:
        return falla
    return jsonify(
        imagenes=[_imagen(m) for m in _imagenes(proyecto)],
        nombre=proyecto.name.get("es") or proyecto.slug,
        publicado=proyecto.status == ContentStatus.PUBLISHED,
        nube=nube() is not None,
    )


@admin.post("/projects/<int:project_id>/media")
@admin_required
def subir_imagen(project_id):
    """Una imagen nueva: al final de la galería. Sin texto alternativo todavía."""
    proyecto, falla = _proyecto(project_id)
    if falla:
        return falla
    if nube() is None:
        return _sin_nube()
    archivo, falla = _archivo(IMAGENES)
    if falla:
        return falla
    url = _subir(*archivo, f"portfolio/proyectos/{proyecto.slug}")
    if url is None:
        return jsonify(error="cloudinary"), 502
    siguiente = db.session.scalar(
        select(func.count()).select_from(ProjectMedia).where(ProjectMedia.project_id == project_id)
    )
    imagen = ProjectMedia(project_id=project_id, url=url, sort_order=siguiente)
    db.session.add(imagen)
    db.session.commit()
    return jsonify(_imagen(imagen)), 201


@admin.put("/projects/<int:project_id>/media")
@admin_required
def guardar_textos_alternativos(project_id):
    """Los textos alternativos: {"alts": {"12": {"es": …, "en": …}}}. Si el proyecto está
    publicado, todas sus fotos con texto en los dos idiomas (decidido en ADM-08)."""
    proyecto, falla = _proyecto(project_id)
    if falla:
        return falla
    alts = (request.get_json(silent=True) or {}).get("alts")
    if not isinstance(alts, dict):
        return jsonify(error="validacion", errores={"alts": "forma"}), 400
    imagenes = {str(m.media_id): m for m in _imagenes(proyecto)}
    limpios = {}
    for ident, alt in alts.items():
        if ident not in imagenes or not isinstance(alt, dict):
            return jsonify(error="validacion", errores={ident: "no_existe"}), 400
        limpios[ident] = {lang: _cadena(alt.get(lang)) or "" for lang in IDIOMAS}
    if proyecto.status == ContentStatus.PUBLISHED:
        errores = {}
        for ident, m in imagenes.items():
            alt = limpios.get(ident, m.alt or {})
            for lang in IDIOMAS:
                if not _cadena(alt.get(lang)):
                    errores[f"{ident}.{lang}"] = "falta"
        if errores:
            return jsonify(error="validacion", errores=errores), 400
    for ident, alt in limpios.items():
        imagenes[ident].alt = alt if any(alt.values()) else None
    db.session.commit()
    return jsonify(imagenes=[_imagen(m) for m in _imagenes(proyecto)])


def _media(media_id):
    m = db.session.get(ProjectMedia, media_id)
    if m is None:
        return None, (jsonify(error="no_existe"), 404)
    return m, None


@admin.patch("/media/<int:media_id>")
@admin_required
def hacer_portada(media_id):
    """La portada del proyecto: solo una."""
    imagen, falla = _media(media_id)
    if falla:
        return falla
    if (request.get_json(silent=True) or {}) != {"is_cover": True}:
        return jsonify(error="validacion", errores={"is_cover": "formato"}), 400
    for m in _imagenes(imagen.project):
        m.is_cover = m.media_id == media_id
    db.session.commit()
    return jsonify(imagenes=[_imagen(m) for m in _imagenes(imagen.project)])


@admin.delete("/media/<int:media_id>")
@admin_required
def borrar_imagen(media_id):
    imagen, falla = _media(media_id)
    if falla:
        return falla
    proyecto, url = imagen.project, imagen.url
    db.session.delete(imagen)
    db.session.flush()
    for i, m in enumerate(_imagenes(proyecto)):
        m.sort_order = i
    db.session.commit()
    soltar(url)
    return jsonify(imagenes=[_imagen(m) for m in _imagenes(proyecto)])


# ---------------------------------------------------------------- Certificados

@admin.post("/education/<int:ident>/certificado")
@admin_required
def subir_certificado(ident):
    """Subir o cambiar el certificado de una formación (PDF o imagen)."""
    formacion = db.session.get(Education, ident)
    if formacion is None:
        return jsonify(error="no_existe"), 404
    if nube() is None:
        return _sin_nube()
    archivo, falla = _archivo(CERTIFICADOS)
    if falla:
        return falla
    url = _subir(*archivo, "portfolio/certificados")
    if url is None:
        return jsonify(error="cloudinary"), 502
    anterior = formacion.certificate_file
    formacion.certificate_file = url
    db.session.commit()
    soltar(anterior)
    return jsonify(certificate_file=url)
