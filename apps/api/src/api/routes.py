from flask import Blueprint, current_app, jsonify, request

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
