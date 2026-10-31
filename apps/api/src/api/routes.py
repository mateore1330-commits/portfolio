from flask import Blueprint, current_app, jsonify, request

from . import contacto
from .github import contribuciones
from .snapshot import ultima_instantanea

api = Blueprint("api", __name__, url_prefix="/api")


@api.get("/health")
def health():
    # Solo responde a "¿está viva la API?": no consulta la base de datos.
    return jsonify(ok=True, version=current_app.config["VERSION"])


@api.get("/content")
def content():
    """La última instantánea publicada. Con If-None-Match y el mismo ETag, 304 sin cuerpo."""
    snapshot = ultima_instantanea()
    if snapshot is None:
        return jsonify(error="Todavía no se ha publicado nada."), 404

    respuesta = jsonify(snapshot.payload)
    respuesta.set_etag(snapshot.etag)
    # no-cache: el navegador guarda la copia, pero pregunta antes de usarla. Si no ha
    # cambiado, la respuesta es un 304 de pocos bytes.
    respuesta.headers["Cache-Control"] = "no-cache"
    return respuesta.make_conditional(request)


@api.get("/contributions")
def contributions():
    """Las contribuciones de GitHub de los últimos 12 meses, ya calculadas."""
    datos = contribuciones()
    if datos is None:
        return jsonify(error="Todavía no hay datos de contribuciones."), 503

    respuesta = jsonify(datos)
    # Cambia como mucho una vez al día: el navegador puede reutilizarla una hora.
    respuesta.headers["Cache-Control"] = "public, max-age=3600"
    return respuesta


@api.post("/contact")
def contact():
    """El formulario de contacto. 201 enviado · 400 errores por campo · 429 demasiados."""
    datos = request.get_json(silent=True) or {}
    # Trampa o demasiado rápido: se responde como si se hubiera enviado y no se guarda.
    # A un bot no se le dan pistas de qué le ha delatado.
    if contacto.es_bot(datos):
        return jsonify(ok=True), 201

    campos = contacto.limpiar(datos)
    errores = contacto.validar(campos)
    if errores:
        return jsonify(errores=errores), 400

    # La IP real llega por el proxy del servidor (X-Forwarded-For); se configura en INFRA.
    ip = request.remote_addr
    if contacto.supera_limite(ip):
        return jsonify(error="limite"), 429

    message_id = contacto.guardar(campos, ip, request.headers.get("User-Agent"))
    contacto.avisar_en_segundo_plano(message_id)
    return jsonify(ok=True), 201
