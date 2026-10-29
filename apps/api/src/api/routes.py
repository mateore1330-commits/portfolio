from flask import Blueprint, current_app, jsonify

api = Blueprint("api", __name__, url_prefix="/api")


@api.get("/health")
def health():
    # Solo responde a "¿está viva la API?": no consulta la base de datos.
    return jsonify(ok=True, version=current_app.config["VERSION"])
