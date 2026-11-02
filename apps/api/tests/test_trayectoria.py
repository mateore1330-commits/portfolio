"""La trayectoria en el panel: empleos y formación (ADM-06)."""

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


def ambos(es, en):
    return {"es": es, "en": en}


def empleo(**cambios):
    return {
        "company": "Rolling Tours", "location": "Tenerife",
        "start_date": "2018-01", "end_date": "2020-03", "is_visible": True,
        "position": ambos("Fundador y gerente", "Founder & Manager"),
        "description": ambos(["Una empresa."], ["A company."]),
        "achievements": ambos(["Equipo de 2"], ["Team of 2"]),
        **cambios,
    }


def formacion(**cambios):
    return {
        "kind": "program", "institution": "4Geeks Academy", "location": "Madrid", "hours": 360,
        "start_date": "2026-05", "end_date": "2026-10", "is_visible": True,
        "title": ambos("Full Stack Developer", "Full Stack Developer"),
        "description": ambos(["Bootcamp."], ["Bootcamp."]),
        "certificate_url": "https://certificate.4geeks.com/abc",
        **cambios,
    }


def crear(cliente, csrf, ruta, datos):
    return cliente.post(f"{RUTA}/{ruta}", json=datos, headers=csrf)


RUTAS = [
    ("get", "/jobs"), ("post", "/jobs"), ("get", "/jobs/1"), ("put", "/jobs/1"),
    ("patch", "/jobs/1"), ("delete", "/jobs/1"), ("get", "/jobs/1/vista-previa"),
    ("get", "/education"), ("post", "/education"), ("put", "/education/1"),
    ("delete", "/education/1"),
]


@pytest.mark.parametrize(("metodo", "ruta"), RUTAS)
def test_sin_sesion_nada(cliente, metodo, ruta):
    assert getattr(cliente, metodo)(f"{RUTA}{ruta}", json={}).status_code == 401


def test_crear_un_empleo_con_su_clave(cliente, csrf):
    respuesta = crear(cliente, csrf, "jobs", empleo())
    assert respuesta.status_code == 201, respuesta.json
    e = respuesta.json
    assert e["slug"] == "rolling-tours"
    assert e["start_date"] == "2018-01-01" and e["end_date"] == "2020-03-01"
    # Otra con la misma empresa: la clave no se repite.
    assert crear(cliente, csrf, "jobs", empleo()).json["slug"] == "rolling-tours-2"


def test_sin_fin_es_actualmente(cliente, csrf):
    e = crear(cliente, csrf, "jobs", empleo(end_date="")).json
    assert e["end_date"] is None


def test_el_fin_antes_del_inicio_no_se_guarda(cliente, csrf):
    respuesta = crear(cliente, csrf, "jobs", empleo(start_date="2018-01", end_date="2017-03"))
    assert respuesta.status_code == 400
    assert respuesta.json["errores"]["end_date"] == "antes"


def test_visible_completo_oculto_a_medias(cliente, csrf):
    a_medias = empleo(position=ambos("Fundador", ""), achievements=ambos(["Uno"], []))
    errores = crear(cliente, csrf, "jobs", a_medias).json["errores"]
    assert errores["position.en"] == "falta"
    assert errores["achievements.en.0"] == "falta"
    oculto = crear(cliente, csrf, "jobs", {**a_medias, "is_visible": False})
    assert oculto.status_code == 201

    # Y mostrarlo desde la lista tampoco se puede mientras esté a medias.
    respuesta = cliente.patch(f"{RUTA}/jobs/{oculto.json['id']}", json={"is_visible": True},
                              headers=csrf)
    assert respuesta.status_code == 400
    assert respuesta.json["error"] == "incompleto"


def test_la_clave_no_cambia_al_editar(cliente, csrf):
    e = crear(cliente, csrf, "jobs", empleo()).json
    guardado = cliente.put(f"{RUTA}/jobs/{e['id']}", json={**empleo(company="Otra"), "slug": "x"},
                           headers=csrf).json
    assert guardado["slug"] == "rolling-tours"
    assert guardado["company"] == "Otra"


def test_los_solapes_se_avisan_y_no_bloquean(cliente, csrf):
    crear(cliente, csrf, "jobs", empleo())
    otro = crear(cliente, csrf, "jobs", empleo(company="Century 21", start_date="2019-04",
                                              end_date="2020-07"))
    assert otro.status_code == 201
    crear(cliente, csrf, "jobs", empleo(company="WeTaxi", start_date="2022-06", end_date=""))
    solapes = cliente.get(f"{RUTA}/jobs").json["solapes"]
    assert [[a["empresa"], b["empresa"]] for a, b in solapes] == [["Rolling Tours", "Century 21"]]
    # Al guardar uno que se solapa, también lo dice.
    guardado = cliente.put(f"{RUTA}/jobs/{otro.json['id']}",
                           json=empleo(company="Century 21", start_date="2019-04",
                                       end_date="2020-07"), headers=csrf).json
    assert len(guardado["solapes"]) == 1


def test_un_oculto_no_se_solapa(cliente, csrf):
    crear(cliente, csrf, "jobs", empleo())
    crear(cliente, csrf, "jobs", empleo(company="Oculta", is_visible=False))
    assert cliente.get(f"{RUTA}/jobs").json["solapes"] == []


def test_ocultar_y_el_orden(cliente, csrf):
    for nombre in ("Uno", "Dos", "Tres"):
        crear(cliente, csrf, "jobs", empleo(company=nombre))
    lista = cliente.get(f"{RUTA}/jobs").json["lista"]
    tres = lista[2]
    cliente.put(f"{RUTA}/jobs/{tres['id']}", json=empleo(company="Tres", posicion=1), headers=csrf)
    nombres = [e["company"] for e in cliente.get(f"{RUTA}/jobs").json["lista"]]
    assert nombres == ["Tres", "Uno", "Dos"]
    oculto = cliente.patch(f"{RUTA}/jobs/{tres['id']}", json={"is_visible": False}, headers=csrf)
    assert oculto.json["is_visible"] is False


def test_formacion_con_tipo_horas_y_certificado(cliente, csrf):
    f = crear(cliente, csrf, "education", formacion(kind="course", hours=20)).json
    assert f["slug"] == "full-stack-developer-4geeks-academy"
    assert f["kind"] == "course" and f["hours"] == 20
    assert f["certificate_url"] == "https://certificate.4geeks.com/abc"
    mal = crear(cliente, csrf, "education", formacion(hours=0, certificate_url="ftp://x",
                                                     kind="master")).json["errores"]
    assert mal == {"hours": "numero", "certificate_url": "url", "kind": "formato"}


def test_formacion_sin_fechas(cliente, csrf):
    """Como "Formación continua": sin fechas está bien; con fin y sin inicio, no."""
    sin = crear(cliente, csrf, "education", formacion(start_date="", end_date=""))
    assert sin.status_code == 201
    solo_fin = crear(cliente, csrf, "education", formacion(start_date="", end_date="2026-10"))
    assert solo_fin.json["errores"]["start_date"] == "obligatorio"


def test_el_archivo_del_certificado_solo_se_quita(app, cliente, csrf):
    from api.extensions import db
    from api.models import Education

    f = crear(cliente, csrf, "education", formacion()).json
    with app.app_context():
        db.session.get(Education, f["id"]).certificate_file = "/certificados/full-stack.pdf"
        db.session.commit()
    ruta = f"{RUTA}/education/{f['id']}"
    # Poner otro desde aquí no se puede (subir llega con ADM-08)…
    otro_archivo = formacion(certificate_file="/certificados/otro.pdf")
    otro = cliente.put(ruta, json=otro_archivo, headers=csrf)
    assert otro.json["errores"] == {"certificate_file": "formato"}
    # …dejar el que hay y quitarlo, sí.
    igual = formacion(certificate_file="/certificados/full-stack.pdf")
    assert cliente.put(ruta, json=igual, headers=csrf).json["certificate_file"]
    assert cliente.put(ruta, json=formacion(certificate_file=None),
                       headers=csrf).json["certificate_file"] is None


@pytest.fixture
def cv(app):
    from api.extensions import db
    from api.models import SiteText

    def bloques():
        return {
            "experiencia": [{"puesto": "Fundador y gerente", "empleos": ["rolling-tours"]}],
            "educacion": [
                {"titulo": "Bootcamp", "formacion": "full-stack-developer-4geeks-academy"}
            ],
        }

    with app.app_context():
        db.session.add(SiteText(text_key="cv", value=ambos(bloques(), bloques())))
        db.session.commit()


def test_lo_que_usa_el_cv_no_se_borra(cliente, csrf, cv):
    e = crear(cliente, csrf, "jobs", empleo()).json
    f = crear(cliente, csrf, "education", formacion()).json
    assert e["en_cv"] == ["Fundador y gerente"]
    respuesta = cliente.delete(f"{RUTA}/jobs/{e['id']}", headers=csrf)
    assert respuesta.status_code == 409
    assert respuesta.json == {"error": "en_cv", "usos": ["Fundador y gerente"]}
    assert cliente.delete(f"{RUTA}/education/{f['id']}", headers=csrf).status_code == 409
    # Ocultarlo, sí.
    oculto = cliente.patch(f"{RUTA}/jobs/{e['id']}", json={"is_visible": False}, headers=csrf)
    assert oculto.status_code == 200
    # Y uno que el CV no usa se borra.
    libre = crear(cliente, csrf, "jobs", empleo(company="Otra")).json
    assert cliente.delete(f"{RUTA}/jobs/{libre['id']}", headers=csrf).status_code == 200


def test_la_vista_previa_incluye_el_oculto(cliente, csrf):
    e = crear(cliente, csrf, "jobs", empleo(is_visible=False)).json
    contenido = cliente.get(f"{RUTA}/jobs/{e['id']}/vista-previa").json["contenido"]
    assert [j["company"] for j in contenido["jobs"]] == ["Rolling Tours"]
