"""La bandeja de mensajes del panel (ADM-10)."""

from datetime import UTC, datetime, timedelta

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


@pytest.fixture
def mensajes(app):
    """Tres mensajes: uno nuevo con el aviso enviado, uno nuevo sin enviar y un spam."""
    from api import models as m
    from api.extensions import db

    ahora = datetime.now(UTC)
    with app.app_context():
        filas = [
            m.ContactMessage(name="Laura", email="laura@ejemplo.com", subject="Oferta",
                             message="Hola, Mateo.", locale="es", email_sent=True,
                             privacy_version="31 de octubre de 2026",
                             privacy_accepted_at=ahora, created_at=ahora - timedelta(hours=2)),
            m.ContactMessage(name="Estudio Norte", email="hola@norte.com", message="Hola.",
                             locale="en", email_sent=False, created_at=ahora - timedelta(days=1)),
            m.ContactMessage(name="Robot", email="spam@x.com", message="Compra.",
                             status=m.MessageStatus.SPAM, created_at=ahora - timedelta(days=2)),
        ]
        db.session.add_all(filas)
        db.session.commit()
        return {f.name: f.message_id for f in filas}


@pytest.mark.parametrize(("metodo", "ruta"), [
    ("get", "/messages"), ("patch", "/messages/1"), ("delete", "/messages/1"),
    ("post", "/messages/reenviar"),
])
def test_sin_sesion_nada(cliente, metodo, ruta):
    assert getattr(cliente, metodo)(f"{RUTA}{ruta}", json={}).status_code == 401


def test_la_bandeja(cliente, csrf, mensajes):
    todo = cliente.get(f"{RUTA}/messages").json
    assert [m["nombre"] for m in todo["lista"]] == ["Laura", "Estudio Norte", "Robot"]
    assert todo["cuantos"] == {"new": 2, "read": 0, "replied": 0, "spam": 1, "todos": 3}
    # El aviso que falló (el spam no cuenta).
    assert [f["nombre"] for f in todo["fallidos"]] == ["Estudio Norte"]
    laura = todo["lista"][0]
    assert laura["idioma"] == "es" and laura["aviso_enviado"] is True
    assert laura["privacidad_version"] == "31 de octubre de 2026"
    # Por estado.
    spam = cliente.get(f"{RUTA}/messages?estado=spam").json["lista"]
    assert [m["nombre"] for m in spam] == ["Robot"]
    assert cliente.get(f"{RUTA}/messages?estado=borrado").status_code == 400


def test_cambiar_el_estado(cliente, csrf, mensajes):
    ruta = f"{RUTA}/messages/{mensajes['Laura']}"
    leido = cliente.patch(ruta, json={"estado": "read"}, headers=csrf).json
    assert leido["mensaje"]["estado"] == "read"
    assert leido["cuantos"]["new"] == 1
    respondido = cliente.patch(ruta, json={"estado": "replied"}, headers=csrf).json
    assert respondido["cuantos"]["replied"] == 1
    # Volver a sin leer también.
    de_nuevo = cliente.patch(ruta, json={"estado": "new"}, headers=csrf).json
    assert de_nuevo["mensaje"]["estado"] == "new"
    assert cliente.patch(ruta, json={"estado": "archivado"}, headers=csrf).status_code == 400
    assert cliente.patch(f"{RUTA}/messages/999", json={"estado": "read"},
                         headers=csrf).status_code == 404


def test_borrar(cliente, csrf, mensajes):
    respuesta = cliente.delete(f"{RUTA}/messages/{mensajes['Robot']}", headers=csrf)
    assert respuesta.json["cuantos"]["todos"] == 2
    assert cliente.delete(f"{RUTA}/messages/{mensajes['Robot']}", headers=csrf).status_code == 404


def test_reenviar_los_avisos(cliente, csrf, mensajes, monkeypatch):
    from api import contacto
    from api import mensajes as bandeja

    # Sin correo configurado: lo dice.
    monkeypatch.setattr(bandeja, "configurado", lambda: False)
    assert cliente.post(f"{RUTA}/messages/reenviar", headers=csrf).json == {"error": "sin_correo"}

    enviados = []
    monkeypatch.setattr(bandeja, "configurado", lambda: True)
    monkeypatch.setattr(contacto, "enviar_aviso", lambda m: enviados.append(m.name))
    respuesta = cliente.post(f"{RUTA}/messages/reenviar", headers=csrf).json
    assert enviados == ["Estudio Norte"]
    assert (respuesta["pendientes"], respuesta["enviados"]) == (1, 1)
    assert respuesta["fallidos"] == []
