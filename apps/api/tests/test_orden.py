"""Reordenar arrastrando (ADM-09): cada lista recibe su orden entero de una vez."""

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


def ambos(texto):
    return {"es": texto, "en": texto}


def ids(lista):
    return [x["id"] for x in lista]


@pytest.mark.parametrize("ruta", [
    "/projects/orden", "/jobs/orden", "/education/orden", "/technologies/orden",
    "/links/orden", "/projects/1/media/orden",
])
def test_sin_sesion_nada(cliente, ruta):
    assert cliente.put(f"{RUTA}{ruta}", json={"ids": []}).status_code == 401


def test_ordenar_los_proyectos(cliente, csrf):
    for nombre in ("Uno", "Dos", "Tres"):
        cliente.post(f"{RUTA}/projects", json={"name": {"es": nombre, "en": ""}}, headers=csrf)
    uno, dos, tres = ids(cliente.get(f"{RUTA}/projects").json)
    respuesta = cliente.put(f"{RUTA}/projects/orden", json={"ids": [tres, uno, dos]}, headers=csrf)
    assert respuesta.status_code == 200
    lista = cliente.get(f"{RUTA}/projects").json
    assert [(x["slug"], x["posicion"]) for x in lista] == [("tres", 1), ("uno", 2), ("dos", 3)]


def test_si_no_cuadra_no_se_toca_nada(cliente, csrf):
    for nombre in ("Uno", "Dos"):
        cliente.post(f"{RUTA}/projects", json={"name": {"es": nombre, "en": ""}}, headers=csrf)
    uno, dos = ids(cliente.get(f"{RUTA}/projects").json)
    ruta = f"{RUTA}/projects/orden"
    # Falta uno, sobra uno, uno repetido o uno que no existe: 409, como estaba.
    for malos in ([dos], [dos, uno, 999], [dos, dos], [dos, 999]):
        assert cliente.put(ruta, json={"ids": malos}, headers=csrf).status_code == 409
    # Lo que no es una lista de números: 400.
    for forma in ({"ids": "1,2"}, {"ids": [str(dos), str(uno)]}, {}):
        assert cliente.put(ruta, json=forma, headers=csrf).status_code == 400
    assert [x["slug"] for x in cliente.get(f"{RUTA}/projects").json] == ["uno", "dos"]


def test_ordenar_empleos_y_formacion_por_separado(app, cliente, csrf):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        for i, empresa in enumerate(("A", "B")):
            db.session.add(m.Job(slug=empresa.lower(), company=empresa, sort_order=i,
                                 position=ambos("P"), start_date="2020-01-01"))
        db.session.add(m.Education(slug="f", title=ambos("F")))
        db.session.commit()
    a, b = ids(cliente.get(f"{RUTA}/jobs").json["lista"])
    (f,) = ids(cliente.get(f"{RUTA}/education").json["lista"])
    # Un id de formación no vale como empleo.
    assert cliente.put(f"{RUTA}/jobs/orden", json={"ids": [b, f]}, headers=csrf).status_code == 409
    assert cliente.put(f"{RUTA}/jobs/orden", json={"ids": [b, a]}, headers=csrf).status_code == 200
    assert [e["company"] for e in cliente.get(f"{RUTA}/jobs").json["lista"]] == ["B", "A"]
    assert cliente.put(f"{RUTA}/education/orden", json={"ids": [f]},
                       headers=csrf).status_code == 200


def test_las_tecnologias_dentro_de_su_grupo(cliente, csrf):
    for nombre, grupo in (("React", "frontend"), ("Vite", "frontend"), ("Flask", "backend")):
        cliente.post(f"{RUTA}/technologies", json={"name": nombre, "category": grupo},
                     headers=csrf)
    todas = {t["name"]: t["id"] for t in cliente.get(f"{RUTA}/technologies").json}
    ruta = f"{RUTA}/technologies/orden"
    # Una de otro grupo no cuadra.
    mezcla = {"category": "frontend", "ids": [todas["Flask"], todas["React"], todas["Vite"]]}
    assert cliente.put(ruta, json=mezcla, headers=csrf).status_code == 409
    sin_grupo = {"category": "cocina", "ids": [todas["Vite"], todas["React"]]}
    assert cliente.put(ruta, json=sin_grupo, headers=csrf).status_code == 400
    bien = {"category": "frontend", "ids": [todas["Vite"], todas["React"]]}
    assert cliente.put(ruta, json=bien, headers=csrf).status_code == 200
    frontend = [(t["name"], t["posicion"]) for t in cliente.get(f"{RUTA}/technologies").json
                if t["category"] == "frontend"]
    assert frontend == [("Vite", 1), ("React", 2)]


def test_los_enlaces_y_la_web_al_publicar(app, cliente, csrf):
    for url in ("https://a.com", "https://b.com"):
        cliente.post(f"{RUTA}/links", json={"type": "other", "url": url}, headers=csrf)
    a, b = ids(cliente.get(f"{RUTA}/links").json)
    assert cliente.put(f"{RUTA}/links/orden", json={"ids": [b, a]}, headers=csrf).status_code == 200
    with app.app_context():
        from api.snapshot import generar_instantanea

        assert [e["url"] for e in generar_instantanea()["links"]] == [
            "https://b.com", "https://a.com",
        ]


def test_las_imagenes_de_un_proyecto(app, cliente, csrf):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        p = m.Project(slug="blog", name=ambos("Blog"), summary=ambos("R"))
        otro = m.Project(slug="otro", name=ambos("Otro"), summary=ambos("R"))
        db.session.add_all([p, otro])
        db.session.flush()
        for i in range(2):
            db.session.add(m.ProjectMedia(project_id=p.project_id, url=f"https://x/{i}.png",
                                          sort_order=i))
        db.session.add(m.ProjectMedia(project_id=otro.project_id, url="https://x/o.png"))
        db.session.commit()
        proyecto, ajeno = p.project_id, otro.project_id
    ruta = f"{RUTA}/projects/{proyecto}/media"
    primera, segunda = ids(cliente.get(ruta).json["imagenes"])
    (de_otro,) = ids(cliente.get(f"{RUTA}/projects/{ajeno}/media").json["imagenes"])
    assert cliente.put(f"{ruta}/orden", json={"ids": [segunda, de_otro]},
                       headers=csrf).status_code == 409
    assert cliente.put(f"{ruta}/orden", json={"ids": [segunda, primera]},
                       headers=csrf).status_code == 200
    assert ids(cliente.get(ruta).json["imagenes"]) == [segunda, primera]
    assert cliente.put(f"{RUTA}/projects/999/media/orden", json={"ids": []},
                       headers=csrf).status_code == 404
