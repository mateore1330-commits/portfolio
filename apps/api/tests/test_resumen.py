"""El resumen del Inicio del panel (ADM-02)."""

from datetime import UTC, date, datetime, timedelta

from conftest import CORREO

RUTA = "/api/admin"


def entrar(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    cliente.post(f"{RUTA}/login", json=datos)


def llenar(app):
    """Un poco de todo, con números distintos para que cada cifra se note si sale mal."""
    from api import models as m
    from api.extensions import db

    with app.app_context():
        ahora = datetime.now(UTC)
        db.session.add_all([
            m.ContactMessage(name="Antiguo", email="a@ejemplo.test", message="hola",
                             status=m.MessageStatus.READ, created_at=ahora - timedelta(days=3)),
            m.ContactMessage(name="Laura", email="l@ejemplo.test", subject="Oferta",
                             message="hola", created_at=ahora - timedelta(hours=2)),
            m.ContactMessage(name="Estudio", email="e@ejemplo.test", message="hola",
                             created_at=ahora - timedelta(days=1)),
            m.ContactMessage(name="Spam", email="s@ejemplo.test", message="compra",
                             status=m.MessageStatus.SPAM, created_at=ahora),
        ])
        for i, estado in enumerate(["published", "published", "published", "draft"]):
            db.session.add(m.Project(slug=f"p{i}", status=m.ContentStatus(estado),
                                     name={"es": "P"}, summary={"es": "R"}))
        for i, visible in enumerate([True, True, False]):
            db.session.add(m.Job(slug=f"j{i}", company="C", start_date=date(2020, 1, 1),
                                 is_visible=visible, position={"es": "Puesto"}))
        db.session.add(m.Education(slug="e0", title={"es": "Bootcamp"}))
        db.session.add_all([
            m.Technology(name="React", category=m.TechCategory.FRONTEND),
            m.Technology(name="Flask", category=m.TechCategory.BACKEND),
            m.Technology(name="Solo-etiqueta", category=m.TechCategory.TOOLS, is_skill=False),
        ])
        db.session.commit()


def test_sin_sesion_no_hay_resumen(cliente, admin):
    respuesta = cliente.get(f"{RUTA}/resumen")
    assert respuesta.status_code == 401
    assert respuesta.json == {"error": "sin_sesion"}


def test_el_resumen_cuenta_lo_que_hay(app, cliente, admin):
    llenar(app)
    entrar(cliente, admin)
    datos = cliente.get(f"{RUTA}/resumen").json

    assert datos["mensajes"]["sin_leer"] == 2
    # Los dos últimos, del más nuevo al más viejo, y nunca el spam.
    assert [u["nombre"] for u in datos["mensajes"]["ultimos"]] == ["Laura", "Estudio"]
    assert datos["mensajes"]["ultimos"][0]["asunto"] == "Oferta"
    assert datos["contenido"] == {
        "proyectos": {"publicados": 3, "borradores": 1},
        "empleos": {"visibles": 2, "ocultos": 1},
        "formacion": {"visibles": 1, "ocultos": 0},
        "conocimientos": 2,
    }
    assert datos["ultima_publicacion"] is None


def test_la_ultima_publicacion_es_la_mas_reciente(app, cliente, admin):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        yo = db.session.query(m.AdminUser).filter_by(email=CORREO).one().admin_id
        antes = datetime(2026, 10, 30, 20, 0, tzinfo=UTC)
        despues = datetime(2026, 10, 31, 21, 41, tzinfo=UTC)
        for cuando in (despues, antes):
            db.session.add(m.Snapshot(payload={}, etag="x", published_at=cuando, published_by=yo))
        db.session.commit()
    entrar(cliente, admin)
    publicada = cliente.get(f"{RUTA}/resumen").json["ultima_publicacion"]
    assert datetime.fromisoformat(publicada) == despues


def test_con_la_base_vacia_todo_es_cero(cliente, admin):
    entrar(cliente, admin)
    datos = cliente.get(f"{RUTA}/resumen").json
    assert datos["mensajes"] == {"sin_leer": 0, "ultimos": []}
    assert datos["contenido"]["proyectos"] == {"publicados": 0, "borradores": 0}
