"""/api/health (INFRA-07): la API y la base de datos. Lo miran el vigilante y el despliegue."""

from sqlalchemy.exc import OperationalError

from api.extensions import db


def test_con_la_base_todo_bien(cliente):
    respuesta = cliente.get("/api/health")
    assert respuesta.status_code == 200
    assert respuesta.json["ok"] is True
    assert respuesta.json["base"] is True


def test_sin_la_base_avisa_con_503(cliente, monkeypatch):
    def caida(*_args, **_kwargs):
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(db.session, "execute", caida)
    respuesta = cliente.get("/api/health")
    assert respuesta.status_code == 503
    assert respuesta.json == {"ok": False, "base": False, "version": respuesta.json["version"]}
    # Hacia fuera, nada del error.
    assert "refused" not in respuesta.get_data(as_text=True)
