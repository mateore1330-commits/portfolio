from flask import Blueprint, current_app, jsonify, request

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
