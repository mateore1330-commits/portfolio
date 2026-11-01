"""Los proyectos en el panel (ADM-03)."""

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    """Entra y devuelve la cabecera CSRF que piden las peticiones que cambian algo."""
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


@pytest.fixture
def tecnologias(app):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        lista = [
            m.Technology(name="React", category=m.TechCategory.FRONTEND),
            m.Technology(name="Flask", category=m.TechCategory.BACKEND),
            m.Technology(name="Alembic", category=m.TechCategory.DATA, is_skill=False),
        ]
        db.session.add_all(lista)
        db.session.commit()
        return {t.name: t.technology_id for t in lista}


def ambos(es, en):
    return {"es": es, "en": en}


def completo(**cambios):
    """Un proyecto con todo en los dos idiomas: se puede publicar."""
    return {
        "status": "published",
        "name": ambos("Blog Dragón Ball", "Dragon Ball Blog"),
        "label": ambos("Proyecto del bootcamp", "Bootcamp project"),
        "period": ambos("junio 2026", "June 2026"),
        "summary": ambos("Un blog.", "A blog."),
        "description": ambos(["Uno.", "Dos."], ["One.", "Two."]),
        "learning": ambos(["Aprendí."], ["I learned."]),
        "repo_url": "https://github.com/ejemplo/blog",
        **cambios,
    }


def crear(cliente, csrf, **datos):
    return cliente.post(f"{RUTA}/projects", json=datos, headers=csrf)


RUTAS = [
    ("get", "/projects"), ("post", "/projects"), ("get", "/projects/1"), ("put", "/projects/1"),
    ("patch", "/projects/1"), ("delete", "/projects/1"), ("get", "/projects/slug?valor=a"),
    ("get", "/projects/1/vista-previa"), ("get", "/technologies"),
]


@pytest.mark.parametrize(("metodo", "ruta"), RUTAS)
def test_sin_sesion_nada(cliente, metodo, ruta):
    respuesta = getattr(cliente, metodo)(f"{RUTA}{ruta}", json={})
    assert respuesta.status_code == 401


def test_cambiar_algo_sin_csrf_no_vale(cliente, csrf):
    assert cliente.post(f"{RUTA}/projects", json={"name": ambos("A", "")}).status_code == 401


def test_crear_un_borrador_a_medias(cliente, csrf, tecnologias):
    respuesta = crear(cliente, csrf, name=ambos("Blog Dragón Ball", ""),
                      technologies=[tecnologias["Flask"], tecnologias["React"]])
    assert respuesta.status_code == 201
    p = respuesta.json
    # La dirección sale del nombre: sin tildes y con guiones. Nace borrador.
    assert p["slug"] == "blog-dragon-ball"
    assert p["status"] == "draft"
    assert [t["name"] for t in p["technologies"]] == ["Flask", "React"]
    # Lo vacío en los dos idiomas se guarda como nada, igual que en la semilla.
    assert p["label"] is None and p["description"] is None


def test_un_borrador_necesita_el_nombre_en_espanol(cliente, csrf):
    respuesta = crear(cliente, csrf, name=ambos("", "Only English"))
    assert respuesta.status_code == 400
    assert respuesta.json["errores"]["name.es"] == "obligatorio"


def test_publicado_tiene_que_estar_completo(cliente, csrf):
    datos = completo(summary=ambos("Un blog.", ""),
                     learning=ambos(["Aprendí.", "Y esto."], ["I learned.", ""]))
    respuesta = crear(cliente, csrf, **datos)
    assert respuesta.status_code == 400
    errores = respuesta.json["errores"]
    assert errores["summary.en"] == "falta"
    # El párrafo 2 (índice 1) tiene texto en español y no en inglés.
    assert errores["learning.en.1"] == "falta"
    assert crear(cliente, csrf, **completo()).status_code == 201


def test_los_parrafos_vacios_en_los_dos_idiomas_se_quitan(cliente, csrf):
    datos = completo(description=ambos(["Uno.", "", "Tres."], ["One.", " ", "Three."]))
    p = crear(cliente, csrf, **datos).json
    assert p["description"] == ambos(["Uno.", "Tres."], ["One.", "Three."])


def test_la_direccion_repetida_dice_de_quien_es(cliente, csrf):
    crear(cliente, csrf, name=ambos("MIR Llamado", ""))
    respuesta = crear(cliente, csrf, name=ambos("Otro", ""), slug="mir-llamado")
    assert respuesta.status_code == 400
    assert respuesta.json["errores"]["slug"] == "existe"
    assert respuesta.json["slug_de"] == "MIR Llamado"

    libre = cliente.get(f"{RUTA}/projects/slug?valor=mir-llamado").json
    assert libre == {"valido": True, "libre": False, "de": "MIR Llamado"}
    assert cliente.get(f"{RUTA}/projects/slug?valor=Con Espacios").json["valido"] is False


def test_la_direccion_propia_no_cuenta_como_repetida(cliente, csrf):
    p = crear(cliente, csrf, name=ambos("Uno", "")).json
    respuesta = cliente.put(f"{RUTA}/projects/{p['id']}", json={**p, "name": ambos("Uno", "One")},
                            headers=csrf)
    assert respuesta.status_code == 200
    assert cliente.get(f"{RUTA}/projects/slug?valor=uno&excepto={p['id']}").json["libre"] is True


def test_validacion_de_la_ficha(cliente, csrf):
    respuesta = crear(cliente, csrf, name=ambos("A", ""), slug="Con Espacios",
                      is_team_project=True, team_size=1, commits_share=120,
                      demo_url="javascript:alert(1)", technologies=[9999], status="publicado")
    errores = respuesta.json["errores"]
    assert errores["slug"] == "formato"
    assert errores["team_size"] == "numero"
    assert errores["commits_share"] == "numero"
    assert errores["demo_url"] == "url"
    assert errores["technologies"] == "no_existe"
    assert errores["status"] == "formato"


def test_individual_no_guarda_equipo(cliente, csrf):
    p = crear(cliente, csrf, name=ambos("A", ""), is_team_project=False,
              team_size=4, commits_share=80).json
    assert p["team_size"] is None and p["commits_share"] is None


def test_editar_cambia_las_tecnologias_y_su_orden(cliente, csrf, tecnologias):
    t = tecnologias
    p = crear(cliente, csrf, name=ambos("A", ""), technologies=[t["React"], t["Flask"]]).json
    datos = {**p, "technologies": [t["Alembic"], t["React"]]}
    p = cliente.put(f"{RUTA}/projects/{p['id']}", json=datos, headers=csrf).json
    assert [x["name"] for x in p["technologies"]] == ["Alembic", "React"]


def test_la_posicion_corre_a_los_demas(cliente, csrf):
    for nombre in ("Uno", "Dos", "Tres"):
        crear(cliente, csrf, name=ambos(nombre, ""))
    lista = cliente.get(f"{RUTA}/projects").json
    assert [(x["slug"], x["posicion"]) for x in lista] == [("uno", 1), ("dos", 2), ("tres", 3)]

    tres = lista[2]
    cliente.put(f"{RUTA}/projects/{tres['id']}", json={**tres, "posicion": 1}, headers=csrf)
    assert [x["slug"] for x in cliente.get(f"{RUTA}/projects").json] == ["tres", "uno", "dos"]

    # Uno nuevo con posición entra ahí; sin ella, al final.
    crear(cliente, csrf, name=ambos("Cuatro", ""), posicion=2)
    orden = [x["slug"] for x in cliente.get(f"{RUTA}/projects").json]
    assert orden == ["tres", "cuatro", "uno", "dos"]


def test_la_estrella(cliente, csrf):
    p = crear(cliente, csrf, name=ambos("A", "")).json
    ruta = f"{RUTA}/projects/{p['id']}"
    assert cliente.patch(ruta, json={"is_featured": True}, headers=csrf).json["is_featured"] is True
    otra = cliente.patch(ruta, json={"slug": "x"}, headers=csrf)
    assert otra.status_code == 400


def test_borrar(app, cliente, csrf, tecnologias):
    p = crear(cliente, csrf, name=ambos("A", ""), technologies=[tecnologias["React"]]).json
    crear(cliente, csrf, name=ambos("B", ""))
    assert cliente.delete(f"{RUTA}/projects/{p['id']}", headers=csrf).status_code == 200
    assert cliente.get(f"{RUTA}/projects/{p['id']}").status_code == 404
    # El que queda pasa a ser el primero, y la tecnología sigue en la lista maestra.
    assert [(x["slug"], x["posicion"]) for x in cliente.get(f"{RUTA}/projects").json] == [("b", 1)]
    assert "React" in [t["name"] for t in cliente.get(f"{RUTA}/technologies").json]


def test_un_borrador_no_entra_en_la_foto_y_si_en_la_vista_previa(app, cliente, csrf):
    from api.snapshot import generar_instantanea

    borrador = crear(cliente, csrf, name=ambos("Borrador", "")).json
    crear(cliente, csrf, **completo())
    with app.app_context():
        assert [p["slug"] for p in generar_instantanea()["projects"]] == ["blog-dragon-ball"]

    previa = cliente.get(f"{RUTA}/projects/{borrador['id']}/vista-previa").json
    assert previa["slug"] == "borrador"
    assert [p["slug"] for p in previa["contenido"]["projects"]] == ["borrador", "blog-dragon-ball"]


@pytest.fixture
def cv(app):
    """Un CV que engancha el proyecto 'blog' en los dos idiomas."""
    from api.extensions import db
    from api.models import SiteText

    def entrada(titulo):
        return {"proyectos": [{"titulo": titulo, "proyecto": "blog"}, {"proyecto": "otro"}]}

    with app.app_context():
        valor = ambos(entrada("Dev · Blog"), entrada("Dev · Blog"))
        db.session.add(SiteText(text_key="cv", value=valor))
        db.session.commit()


def test_el_cv_sigue_al_cambiar_la_direccion(app, cliente, csrf, cv):
    from api.extensions import db
    from api.models import SiteText

    p = crear(cliente, csrf, name=ambos("Blog", "")).json
    assert p["en_cv"] == ["Dev · Blog"]

    cliente.put(f"{RUTA}/projects/{p['id']}", json={**p, "slug": "blog-nuevo"}, headers=csrf)
    with app.app_context():
        valor = db.session.get(SiteText, "cv").value
    for lang in ("es", "en"):
        assert [e["proyecto"] for e in valor[lang]["proyectos"]] == ["blog-nuevo", "otro"]


def test_la_lista_maestra_en_su_orden(cliente, csrf, tecnologias):
    nombres = [t["name"] for t in cliente.get(f"{RUTA}/technologies").json]
    # Por grupo, en el orden de la web: frontend, backend, datos.
    assert nombres == ["React", "Flask", "Alembic"]
