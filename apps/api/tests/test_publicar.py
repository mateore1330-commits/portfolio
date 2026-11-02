"""Publicar desde el panel (ADM-05).

El CV de verdad necesita Chrome: aquí se sustituye el generador por uno de mentira (el de
verdad se prueba a mano). Vercel también: un servidor local que contesta bien, mal o tarde.
"""

import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


@pytest.fixture
def cv(monkeypatch):
    """Un generador del CV de mentira. estado["cv"]: lo que "sale en el PDF";
    estado["problemas"]: lo que dirá la prueba ATS."""
    from api import publicar as p
    from api.cv.generar import PDF

    estado = {"cv": "versión 1", "problemas": [], "llamadas": 0}

    def generar(datos):
        estado["llamadas"] += 1
        return [PDF(lang, b"%PDF-" + lang.encode(), 1, list(estado["problemas"])) for lang in datos]

    datos = lambda: {lang: {"cv": estado["cv"]} for lang in ("es", "en")}  # noqa: E731
    monkeypatch.setattr(p, "datos_cv", datos)
    monkeypatch.setattr(p, "generar_pdfs", generar)
    return estado


def proyecto(app, slug, nombre, estado="published", orden=0):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        db.session.add(m.Project(slug=slug, status=m.ContentStatus(estado), sort_order=orden,
                                 name={"es": nombre, "en": nombre}, summary={"es": "R", "en": "R"}))
        db.session.commit()


def editar(app, slug, **campos):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        p = db.session.scalar(db.select(m.Project).where(m.Project.slug == slug))
        for k, v in campos.items():
            setattr(p, k, v)
        db.session.commit()


def publicar_todo(cliente, csrf):
    foto = cliente.post(f"{RUTA}/publicar", headers=csrf)
    assert foto.status_code == 201, foto.json
    pid = foto.json["id"]
    cliente.post(f"{RUTA}/publicar/{pid}/cv", headers=csrf)
    return cliente.post(f"{RUTA}/publicar/{pid}/despliegue", headers=csrf).json


@pytest.mark.parametrize(("metodo", "ruta"), [
    ("get", "/publicar"), ("post", "/publicar"), ("post", "/publicar/1/cv"),
    ("post", "/publicar/1/despliegue"), ("get", "/publicaciones"), ("get", "/cv/pdf"),
    ("post", "/cv/prueba"), ("get", "/cv/prueba/es.pdf"),
])
def test_sin_sesion_nada(cliente, metodo, ruta):
    assert getattr(cliente, metodo)(f"{RUTA}{ruta}").status_code == 401


def test_la_primera_publicacion(app, cliente, csrf, cv):
    proyecto(app, "blog", "Blog")
    assert cliente.get(f"{RUTA}/publicar").json["pendientes"] == ["Primera publicación"]
    final = publicar_todo(cliente, csrf)
    assert final["cv"] == "generated"
    # Sin gancho de Vercel: no es un error, está sin configurar.
    assert final["despliegue"] == "not_configured"
    # Y ya no queda nada.
    assert cliente.get(f"{RUTA}/publicar").json["pendientes"] == []
    assert cliente.post(f"{RUTA}/publicar", headers=csrf).status_code == 409


def test_que_ha_cambiado(app, cliente, csrf, cv):
    from api.models import ContentStatus

    proyecto(app, "blog", "Blog", orden=0)
    proyecto(app, "web", "Web", orden=1)
    proyecto(app, "viejo", "Viejo", orden=2)
    publicar_todo(cliente, csrf)

    editar(app, "blog", summary={"es": "Otro resumen", "en": "R"})
    editar(app, "web", sort_order=0)
    editar(app, "blog", sort_order=1)
    editar(app, "viejo", status=ContentStatus.DRAFT)
    proyecto(app, "nuevo", "Nuevo", orden=3)
    cv["cv"] = "versión 2"
    pendientes = cliente.get(f"{RUTA}/publicar").json["pendientes"]
    assert pendientes == [
        "Proyecto Blog · editado",
        "Proyecto Nuevo · nuevo",
        "Proyecto Viejo · quitado",
        "Orden de los proyectos · cambiado",
        "CV en PDF · cambiado",
    ]


def test_deshacer_un_cambio_no_cuenta(app, cliente, csrf, cv):
    proyecto(app, "blog", "Blog")
    publicar_todo(cliente, csrf)
    editar(app, "blog", summary={"es": "Otro", "en": "R"})
    assert cliente.get(f"{RUTA}/publicar").json["pendientes"] == ["Proyecto Blog · editado"]
    editar(app, "blog", summary={"es": "R", "en": "R"})
    assert cliente.get(f"{RUTA}/publicar").json["pendientes"] == []


def test_textos_por_seccion(app, cliente, csrf, cv):
    from api.extensions import db
    from api.models import SiteText

    with app.app_context():
        db.session.add_all([
            SiteText(text_key="hero.nombre", value={"es": "A", "en": "A"}),
            SiteText(text_key="hero.entradilla", value={"es": "B", "en": "B"}),
            SiteText(text_key="legal.privacidad", value={"es": "C", "en": "C"}),
        ])
        db.session.commit()
    publicar_todo(cliente, csrf)
    with app.app_context():
        for clave in ("hero.nombre", "hero.entradilla", "legal.privacidad"):
            db.session.get(SiteText, clave).value = {"es": "Z", "en": "Z"}
        db.session.commit()
    assert cliente.get(f"{RUTA}/publicar").json["pendientes"] == [
        "Textos · Portada · editados", "Textos · Privacidad · editados",
    ]


def test_el_cv_solo_se_genera_si_cambia(app, cliente, csrf, cv):
    proyecto(app, "blog", "Blog")
    publicar_todo(cliente, csrf)
    assert cv["llamadas"] == 1
    editar(app, "blog", summary={"es": "Otro", "en": "R"})
    final = publicar_todo(cliente, csrf)
    assert final["cv"] == "unchanged"
    assert cv["llamadas"] == 1


def test_solo_el_cv_tambien_se_publica(app, cliente, csrf, cv):
    proyecto(app, "blog", "Blog")
    publicar_todo(cliente, csrf)
    cv["cv"] = "versión 2"
    assert cliente.get(f"{RUTA}/publicar").json["pendientes"] == ["CV en PDF · cambiado"]
    assert publicar_todo(cliente, csrf)["cv"] == "generated"
    assert len(cliente.get(f"{RUTA}/publicaciones").json) == 2


def test_un_cv_roto_no_se_publica_y_lo_demas_si(app, cliente, csrf, cv):
    proyecto(app, "blog", "Blog")
    publicar_todo(cliente, csrf)
    antes = cliente.get("/api/cv/es.pdf").data

    cv["cv"] = "versión 2"
    cv["problemas"] = ["ocupa 2 páginas: tiene que caber en una"]
    editar(app, "blog", summary={"es": "Otro", "en": "R"})
    final = publicar_todo(cliente, csrf)
    assert final["cv"] == "failed"
    assert "El PDF en español: ocupa 2 páginas" in final["cv_detalle"]
    # El contenido sí: la web ya enseña el resumen nuevo.
    contenido = cliente.get("/api/content").json
    assert contenido["projects"][0]["summary"]["es"] == "Otro"
    # Y el CV publicado sigue siendo el anterior.
    assert cliente.get("/api/cv/es.pdf").data == antes


def test_el_cv_publicado_es_publico(app, cliente, csrf, cv):
    assert cliente.get("/api/cv/es.pdf").status_code == 404
    proyecto(app, "blog", "Blog")
    publicar_todo(cliente, csrf)
    respuesta = cliente.get("/api/cv/en.pdf")
    assert respuesta.status_code == 200
    assert respuesta.mimetype == "application/pdf"
    assert respuesta.data == b"%PDF-en"
    assert cliente.get("/api/cv/fr.pdf").status_code == 404


def test_la_prueba_del_pdf_no_publica(app, cliente, csrf, cv):
    cv["problemas"] = ["ocupa 2 páginas: tiene que caber en una"]
    respuesta = cliente.post(f"{RUTA}/cv/prueba", headers=csrf).json
    assert respuesta["ok"] is False
    assert respuesta["prueba"]["es"]["paginas"] == 1
    # Se puede descargar con sesión, y no hay nada publicado.
    assert cliente.get(f"{RUTA}/cv/prueba/es.pdf").data == b"%PDF-es"
    assert cliente.get("/api/cv/es.pdf").status_code == 404
    estado = cliente.get(f"{RUTA}/cv/pdf").json
    assert estado["publicado"]["es"] is None
    assert estado["prueba"]["en"]["problemas"] == ["ocupa 2 páginas: tiene que caber en una"]


# ---------------------------------------------------------------- Vercel de mentira

@pytest.fixture
def vercel(app, monkeypatch):
    """Un "Vercel" local. modo["respuesta"]: el código que da; modo["espera"]: lo que tarda."""
    from api import publicar as p

    modo = {"respuesta": 201, "espera": 0, "llamadas": 0}

    class Gancho(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802 (el nombre lo pone http.server)
            modo["llamadas"] += 1
            time.sleep(modo["espera"])
            self.send_response(modo["respuesta"])
            self.end_headers()

        def log_message(self, *args):
            pass

    # Cada llamada en su hilo: si no, la que llega mientras otra tarda se queda esperando y
    # el test falla de vez en cuando (pasaba ~1 de cada 4 veces).
    servidor = ThreadingHTTPServer(("127.0.0.1", 0), Gancho)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    monkeypatch.setitem(app.config, "VERCEL_DEPLOY_HOOK",
                        f"http://127.0.0.1:{servidor.server_port}/gancho")
    monkeypatch.setattr(p, "ESPERA_VERCEL", 0.5)
    yield modo
    servidor.shutdown()


def test_desplegar_en_vercel(app, cliente, csrf, cv, vercel):
    proyecto(app, "blog", "Blog")
    final = publicar_todo(cliente, csrf)
    assert final["despliegue"] == "deployed"
    assert final["desplegada"]
    assert vercel["llamadas"] == 1


def test_si_vercel_falla_se_reintenta_solo_el_despliegue(app, cliente, csrf, cv, vercel):
    proyecto(app, "blog", "Blog")
    vercel["respuesta"] = 500
    final = publicar_todo(cliente, csrf)
    assert final["despliegue"] == "failed"
    assert final["despliegue_detalle"] == "Vercel contestó 500."
    # La foto ya está guardada: la web la enseña.
    assert cliente.get("/api/content").status_code == 200

    vercel["respuesta"], vercel["espera"] = 201, 1
    lenta = cliente.post(f"{RUTA}/publicar/{final['id']}/despliegue", headers=csrf).json
    assert lenta["despliegue_detalle"] == "Vercel no contestó en 0.5 s."

    vercel["espera"] = 0
    bien = cliente.post(f"{RUTA}/publicar/{final['id']}/despliegue", headers=csrf).json
    assert bien["despliegue"] == "deployed"
    # Reintentar no crea otra publicación.
    assert len(cliente.get(f"{RUTA}/publicaciones").json) == 1
