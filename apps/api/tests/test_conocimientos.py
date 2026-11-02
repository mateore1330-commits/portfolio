"""Las tecnologías y los enlaces en el panel (ADM-07)."""

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


def tecnologia(**cambios):
    return {"name": "React", "category": "frontend", "level": 100, "is_skill": True, **cambios}


def crear(cliente, csrf, ruta, datos):
    return cliente.post(f"{RUTA}/{ruta}", json=datos, headers=csrf)


@pytest.mark.parametrize(("metodo", "ruta"), [
    ("get", "/technologies"), ("post", "/technologies"), ("put", "/technologies/1"),
    ("patch", "/technologies/1"), ("delete", "/technologies/1"),
    ("get", "/links"), ("post", "/links"), ("put", "/links/1"), ("patch", "/links/1"),
    ("delete", "/links/1"),
])
def test_sin_sesion_nada(cliente, metodo, ruta):
    assert getattr(cliente, metodo)(f"{RUTA}{ruta}", json={}).status_code == 401


# ---------------------------------------------------------------- Tecnologías

def test_crear_con_la_etiqueta_del_nivel(cliente, csrf):
    t = crear(cliente, csrf, "technologies", tecnologia(level=67)).json
    assert t["level_label"] == {"es": "Sólido", "en": "Solid"}
    sin_nivel = crear(cliente, csrf, "technologies", tecnologia(name="Jest", level=None)).json
    assert sin_nivel["level_label"] is None


def test_el_nombre_no_se_repite(cliente, csrf):
    crear(cliente, csrf, "technologies", tecnologia())
    respuesta = crear(cliente, csrf, "technologies", tecnologia(name="react"))
    assert respuesta.json["errores"]["name"] == "existe"


def test_validacion(cliente, csrf):
    errores = crear(cliente, csrf, "technologies",
                    tecnologia(name="", category="cocina", level=50)).json["errores"]
    assert errores == {"name": "obligatorio", "category": "formato", "level": "formato"}


def test_el_nombre_en_ingles(cliente, csrf):
    t = crear(cliente, csrf, "technologies",
              tecnologia(name="Trato con cliente", category="soft", nombre_en="Client relations"))
    assert t.json["nombre_en"] == "Client relations"
    # El mismo nombre en inglés que en español no se guarda aparte.
    igual = crear(cliente, csrf, "technologies", tecnologia(name="Vite", nombre_en="Vite")).json
    assert igual["nombre_en"] is None


def test_orden_dentro_del_grupo_y_al_cambiar_de_grupo(cliente, csrf):
    for nombre in ("React", "Vite", "CSS"):
        crear(cliente, csrf, "technologies", tecnologia(name=nombre))
    flask = crear(cliente, csrf, "technologies", tecnologia(name="Flask", category="backend")).json
    assert flask["posicion"] == 1
    frontend = [t["name"] for t in cliente.get(f"{RUTA}/technologies").json
                if t["category"] == "frontend"]
    # Las nuevas, al final de su grupo (el orden se cambia arrastrando: test_orden.py).
    assert frontend == ["React", "Vite", "CSS"]
    # Pasar React a backend: al final de su grupo nuevo.
    react = next(t for t in cliente.get(f"{RUTA}/technologies").json if t["name"] == "React")
    movida = cliente.put(f"{RUTA}/technologies/{react['id']}",
                         json=tecnologia(category="backend"), headers=csrf).json
    assert movida["posicion"] == 2


def test_en_conocimientos_al_momento(cliente, csrf):
    t = crear(cliente, csrf, "technologies", tecnologia()).json
    apagada = cliente.patch(f"{RUTA}/technologies/{t['id']}", json={"is_skill": False},
                            headers=csrf)
    assert apagada.json["is_skill"] is False


def test_borrar_una_usada_la_quita_de_los_proyectos(app, cliente, csrf):
    from api import models as m
    from api.extensions import db

    t = crear(cliente, csrf, "technologies", tecnologia()).json
    with app.app_context():
        for slug in ("blog", "web"):
            p = m.Project(slug=slug, name={"es": slug.title()}, summary={"es": "R"})
            p.technologies = [m.ProjectTechnology(technology_id=t["id"])]
            db.session.add(p)
        db.session.commit()
    lista = cliente.get(f"{RUTA}/technologies").json
    assert lista[0]["proyectos"] == ["Blog", "Web"]

    respuesta = cliente.delete(f"{RUTA}/technologies/{t['id']}", headers=csrf)
    assert respuesta.json == {"ok": True, "quitada_de": 2}
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(m.ProjectTechnology)) == 0
        assert db.session.scalar(db.select(db.func.count()).select_from(m.Project)) == 2


# ---------------------------------------------------------------- Enlaces

def enlace(**cambios):
    return {"type": "github", "url": "https://github.com/mateo", "label": {"es": "GitHub",
            "en": "GitHub"}, "is_visible": True, **cambios}


def test_crear_enlaces_y_el_correo_a_secas(cliente, csrf):
    correo = crear(cliente, csrf, "links", enlace(type="email", url="info@ejemplo.com")).json
    assert correo["url"] == "mailto:info@ejemplo.com"
    assert crear(cliente, csrf, "links", enlace()).status_code == 201


def test_direcciones_mal(cliente, csrf):
    sin_https = crear(cliente, csrf, "links", enlace(url="linkedin.com/in/mateo")).json
    assert sin_https["errores"] == {"url": "url"}
    correo = crear(cliente, csrf, "links", enlace(type="email", url="no-es-un-correo")).json
    assert correo["errores"] == {"url": "correo"}
    etiqueta = crear(cliente, csrf, "links", enlace(label={"es": "GitHub", "en": ""})).json
    assert etiqueta["errores"] == {"label.en": "falta"}
    tipo = crear(cliente, csrf, "links", enlace(type="twitter")).json
    assert tipo["errores"]["type"] == "formato"


def test_los_que_necesita_el_cv_no_se_borran(cliente, csrf):
    github = crear(cliente, csrf, "links", enlace()).json
    assert github["necesario"] is True
    assert cliente.delete(f"{RUTA}/links/{github['id']}", headers=csrf).status_code == 409
    # Tampoco se le puede cambiar el tipo; ocultarlo, sí.
    otro_tipo = cliente.put(f"{RUTA}/links/{github['id']}", json=enlace(type="other"),
                            headers=csrf)
    assert otro_tipo.json["errores"] == {"type": "necesario"}
    oculto = cliente.patch(f"{RUTA}/links/{github['id']}", json={"is_visible": False},
                           headers=csrf)
    assert oculto.json["is_visible"] is False

    # Con un segundo GitHub, ya no es el único: se puede borrar uno.
    segundo = crear(cliente, csrf, "links", enlace(url="https://github.com/otro")).json
    assert cliente.delete(f"{RUTA}/links/{segundo['id']}", headers=csrf).status_code == 200
    # Uno de tipo "otro" se borra siempre.
    otro = crear(cliente, csrf, "links", enlace(type="other", url="https://ejemplo.com")).json
    assert cliente.delete(f"{RUTA}/links/{otro['id']}", headers=csrf).status_code == 200


def test_un_enlace_nuevo_va_al_final(cliente, csrf):
    for url in ("https://a.com", "https://b.com", "https://c.com"):
        crear(cliente, csrf, "links", enlace(type="other", url=url))
    assert [e["url"] for e in cliente.get(f"{RUTA}/links").json] == [
        "https://a.com", "https://b.com", "https://c.com",
    ]
