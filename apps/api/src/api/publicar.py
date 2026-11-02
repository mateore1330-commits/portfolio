"""Publicar desde el panel (ADM-05): la foto, el CV en PDF y el despliegue en Vercel.

Son tres pasos y tres llamadas, en este orden; el panel pinta cada uno al terminar:
  1. POST /publicar                     guarda la instantánea. Desde ya, la web la enseña.
  2. POST /publicar/<id>/cv             el CV en PDF, si ha cambiado. Si no pasa la prueba
                                        ATS, el anterior se queda (decidido en ADM-05).
  3. POST /publicar/<id>/despliegue     llama al gancho de Vercel. Si falla, la foto ya
                                        está guardada: se puede repetir solo este paso.

"Qué hay sin publicar" se calcula comparando la foto de lo guardado con la última
publicada, no con fechas: si algo se cambia y se deja como estaba, no cuenta.
"""

import urllib.error
import urllib.request
from datetime import UTC, datetime

from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import select

from .admin import admin, admin_required
from .cv.generar import CVError, datos_cv, generar_pdfs, huella
from .extensions import db
from .models import CvPdf, CvStatus, DeployStatus, Snapshot
from .snapshot import InstantaneaError, generar_instantanea, publicar, ultima_instantanea

ESPERA_VERCEL = 15  # segundos
HISTORIAL = 50

# Cada texto de la web, en el resumen de cambios, por la sección del panel que lo edita.
SECCIONES_TEXTOS = {
    "hero": "Portada", "sobre": "Sobre mí", "conocimientos": "Conocimientos",
    "contacto": "Contacto", "pie": "Pie", "legal.aviso": "Aviso legal",
    "legal.privacidad": "Privacidad", "legal.actualizado": "Aviso legal",
}
OTRAS = {
    "links": "Enlaces", "technologies": "Conocimientos", "jobs": "Experiencia",
    "education": "Formación",
}


# ---------------------------------------------------------------- Qué ha cambiado

def _nombre(p):
    return (p.get("name") or {}).get("es") or p["slug"]


def _seccion_texto(clave):
    for prefijo, nombre in SECCIONES_TEXTOS.items():
        if clave == prefijo or clave.startswith(f"{prefijo}."):
            return nombre
    return "Otros"


def cambios(antes, ahora):
    """Lo que cambiará en la web, en frases cortas. antes: la foto publicada (o None)."""
    if antes is None:
        return ["Primera publicación"]
    lista = []

    viejos = {p["slug"]: p for p in antes.get("projects", [])}
    nuevos = {p["slug"]: p for p in ahora["projects"]}
    sin_orden = ("sort_order",)
    for slug, p in nuevos.items():
        if slug not in viejos:
            lista.append(f"Proyecto {_nombre(p)} · nuevo")
        elif {k: v for k, v in p.items() if k not in sin_orden} != {
            k: v for k, v in viejos[slug].items() if k not in sin_orden
        }:
            lista.append(f"Proyecto {_nombre(p)} · editado")
    lista += [f"Proyecto {_nombre(p)} · quitado" for s, p in viejos.items() if s not in nuevos]
    comunes_antes = [p["slug"] for p in antes.get("projects", []) if p["slug"] in nuevos]
    comunes_ahora = [p["slug"] for p in ahora["projects"] if p["slug"] in viejos]
    if comunes_antes != comunes_ahora:
        lista.append("Orden de los proyectos · cambiado")

    textos_antes, textos_ahora = antes.get("site_texts", {}), ahora["site_texts"]
    secciones = []
    for clave in sorted(set(textos_antes) | set(textos_ahora)):
        if textos_antes.get(clave) != textos_ahora.get(clave):
            nombre = _seccion_texto(clave)
            if nombre not in secciones:
                secciones.append(nombre)
    lista += [f"Textos · {s} · editados" for s in secciones]

    lista += [f"{nombre} · cambiado" for clave, nombre in OTRAS.items()
              if antes.get(clave) != ahora.get(clave)]
    return lista


def _huella_cv():
    """La huella del CV de ahora, o None si no hay CV (o le falta algo que enganchar)."""
    try:
        return huella(datos_cv())
    except CVError:
        return None


def _cv_publicado(lang="es"):
    return db.session.get(CvPdf, (lang, False))


def _cv_cambiado():
    actual = _huella_cv()
    publicado = _cv_publicado()
    return actual is not None and (publicado is None or publicado.cv_hash != actual)


def pendientes():
    """Qué hay guardado sin publicar: [frases], incluido el CV."""
    ultima = ultima_instantanea()
    lista = cambios(ultima.payload if ultima else None, generar_instantanea())
    if ultima is not None and _cv_cambiado():
        lista.append("CV en PDF · cambiado")
    return lista


# ---------------------------------------------------------------- Para la respuesta

def _iso(fecha):
    return fecha.isoformat() if fecha else None


def _publicacion(s):
    return {
        "id": s.snapshot_id,
        "fecha": _iso(s.published_at),
        "cambios": s.changes or [],
        "tamano": s.size_bytes,
        "cv": s.cv_status.value,
        "cv_detalle": s.cv_detail,
        "despliegue": s.deploy_status.value,
        "despliegue_detalle": s.deploy_detail,
        "desplegada": _iso(s.deployed_at),
    }


def _buscar(snapshot_id):
    s = db.session.get(Snapshot, snapshot_id)
    if s is None:
        return None, (jsonify(error="no_existe"), 404)
    return s, None


# ---------------------------------------------------------------- Rutas del panel

@admin.get("/publicar")
@admin_required
def ver_pendientes():
    """Para la barra de arriba y el diálogo: qué cambiará y cuándo fue la última."""
    ultima = ultima_instantanea()
    return jsonify(
        pendientes=pendientes(),
        ultima=_publicacion(ultima) if ultima else None,
        vercel=bool(current_app.config["VERCEL_DEPLOY_HOOK"]),
    )


@admin.post("/publicar")
@admin_required
def paso_foto():
    """Paso 1: la instantánea, con lo que cambia respecto a la anterior."""
    autor_id = int(get_jwt_identity())
    lista = pendientes()
    if not lista:
        return jsonify(error="sin_cambios"), 409
    cv_cambiado = _cv_cambiado()
    # publicar() lee con REPEATABLE READ y tiene que empezar su propia transacción.
    db.session.rollback()
    try:
        _, snapshot, tamano = publicar(autor_id, forzar=True)
    except InstantaneaError as error:
        db.session.rollback()
        return jsonify(error="demasiado_grande", detalle=str(error)), 422
    snapshot.changes = lista
    snapshot.size_bytes = tamano
    snapshot.cv_status = CvStatus.PENDING if cv_cambiado else CvStatus.UNCHANGED
    snapshot.deploy_status = DeployStatus.PENDING
    db.session.commit()
    return jsonify(_publicacion(snapshot)), 201


def _texto_problemas(pdfs):
    idioma = {"es": "español", "en": "inglés"}
    return " · ".join(
        f"El PDF en {idioma[p.lang]}: " + "; ".join(p.problemas) for p in pdfs if p.problemas
    )


def _guardar_pdfs(pdfs, datos, es_prueba):
    marca = huella(datos)
    for pdf in pdfs:
        fila = db.session.get(CvPdf, (pdf.lang, es_prueba))
        fila = fila or CvPdf(lang=pdf.lang, is_test=es_prueba)
        fila.content = pdf.contenido
        fila.pages = pdf.paginas
        fila.cv_hash = marca
        fila.ats_problems = pdf.problemas
        fila.generated_at = datetime.now(UTC)
        db.session.add(fila)


@admin.post("/publicar/<int:snapshot_id>/cv")
@admin_required
def paso_cv(snapshot_id):
    """Paso 2: el CV en PDF, solo si ha cambiado. Un CV roto nunca se publica."""
    snapshot, falla = _buscar(snapshot_id)
    if falla:
        return falla
    if snapshot.cv_status in (CvStatus.UNCHANGED, CvStatus.GENERATED):
        return jsonify(_publicacion(snapshot))
    try:
        datos = datos_cv()
        pdfs = generar_pdfs(datos)
    except CVError as error:
        snapshot.cv_status, snapshot.cv_detail = CvStatus.FAILED, str(error)
    else:
        if any(p.problemas for p in pdfs):
            snapshot.cv_status = CvStatus.FAILED
            snapshot.cv_detail = _texto_problemas(pdfs)
        else:
            _guardar_pdfs(pdfs, datos, es_prueba=False)
            snapshot.cv_status, snapshot.cv_detail = CvStatus.GENERATED, None
    db.session.commit()
    return jsonify(_publicacion(snapshot))


def llamar_vercel(gancho):
    """None si Vercel ha aceptado el despliegue; si no, por qué."""
    try:
        peticion = urllib.request.Request(gancho, method="POST", data=b"")
        with urllib.request.urlopen(peticion, timeout=ESPERA_VERCEL) as respuesta:
            if 200 <= respuesta.status < 300:
                return None
            return f"Vercel contestó {respuesta.status}."
    except urllib.error.HTTPError as error:
        return f"Vercel contestó {error.code}."
    except TimeoutError:
        return f"Vercel no contestó en {ESPERA_VERCEL} s."
    except (urllib.error.URLError, OSError) as error:
        motivo = getattr(error, "reason", error)
        if isinstance(motivo, TimeoutError):
            return f"Vercel no contestó en {ESPERA_VERCEL} s."
        return f"No se pudo conectar con Vercel ({motivo})."


@admin.post("/publicar/<int:snapshot_id>/despliegue")
@admin_required
def paso_despliegue(snapshot_id):
    """Paso 3 (y "Reintentar el despliegue"): que Vercel vuelva a construir la web."""
    snapshot, falla = _buscar(snapshot_id)
    if falla:
        return falla
    gancho = current_app.config["VERCEL_DEPLOY_HOOK"]
    if not gancho:
        snapshot.deploy_status, snapshot.deploy_detail = DeployStatus.NOT_CONFIGURED, None
    else:
        problema = llamar_vercel(gancho)
        if problema:
            snapshot.deploy_status, snapshot.deploy_detail = DeployStatus.FAILED, problema
        else:
            snapshot.deploy_status, snapshot.deploy_detail = DeployStatus.DEPLOYED, None
            snapshot.deployed_at = datetime.now(UTC)
    db.session.commit()
    return jsonify(_publicacion(snapshot))


@admin.get("/publicaciones")
@admin_required
def historial():
    filas = db.session.scalars(
        select(Snapshot).order_by(Snapshot.snapshot_id.desc()).limit(HISTORIAL)
    )
    return jsonify([_publicacion(s) for s in filas])


# ---------------------------------------------------------------- El PDF del CV

def _pdf_info(fila):
    if fila is None:
        return None
    return {
        "fecha": _iso(fila.generated_at),
        "tamano": len(fila.content),
        "paginas": fila.pages,
        "problemas": fila.ats_problems,
    }


@admin.get("/cv/pdf")
@admin_required
def estado_pdf():
    """Para la pantalla CV: el PDF publicado y el de prueba, de cada idioma."""
    return jsonify({
        tipo: {lang: _pdf_info(db.session.get(CvPdf, (lang, es_prueba))) for lang in ("es", "en")}
        for tipo, es_prueba in (("publicado", False), ("prueba", True))
    })


@admin.post("/cv/prueba")
@admin_required
def probar_pdf():
    """"Generar PDF" de la pantalla CV: los genera y los prueba, sin publicarlos."""
    try:
        datos = datos_cv()
        pdfs = generar_pdfs(datos)
    except CVError as error:
        return jsonify(error="cv", detalle=str(error)), 422
    _guardar_pdfs(pdfs, datos, es_prueba=True)
    db.session.commit()
    return jsonify(
        ok=not any(p.problemas for p in pdfs),
        detalle=_texto_problemas(pdfs) or None,
        prueba={p.lang: _pdf_info(db.session.get(CvPdf, (p.lang, True))) for p in pdfs},
    )


def _servir_pdf(fila, lang):
    respuesta = Response(fila.content, mimetype="application/pdf")
    respuesta.headers["Content-Disposition"] = (
        f'inline; filename="CV-Mateo-Rodriguez-Escobar-{lang.upper()}.pdf"'
    )
    respuesta.set_etag(fila.cv_hash)
    respuesta.headers["Cache-Control"] = "no-cache"
    return respuesta.make_conditional(request)


@admin.get("/cv/prueba/<any(es, en):lang>.pdf")
@admin_required
def pdf_de_prueba(lang):
    fila = db.session.get(CvPdf, (lang, True))
    if fila is None:
        return jsonify(error="no_existe"), 404
    return _servir_pdf(fila, lang)


# ---------------------------------------------------------------- Público

cv_publico = Blueprint("cv_publico", __name__, url_prefix="/api")


@cv_publico.get("/cv/<any(es, en):lang>.pdf")
def pdf_publicado(lang):
    """El último CV publicado. Lo recoge la web al construirse en Vercel."""
    fila = _cv_publicado(lang)
    if fila is None:
        return jsonify(error="Todavía no se ha publicado el CV."), 404
    return _servir_pdf(fila, lang)
