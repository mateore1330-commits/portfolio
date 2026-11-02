"""Los textos de la web y el CV en el panel (ADM-04)."""

import copy
from datetime import date

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


def ambos(es, en):
    return {"es": es, "en": en}


CV_ES = {
    "nombre": "Mateo", "rol": "Full Stack", "ubicacion": "Tenerife", "perfil": "Desarrollador.",
    "proyectos": [{"titulo": "Dev · Blog", "proyecto": "blog", "desde": "2026-09-01",
                   "hasta": "2026-10-01", "lugar": "Madrid", "descripcion": "Un blog.",
                   "puntos": ["Uno.", "Dos."]}],
    "experiencia": [{"puesto": "Taxista", "empresa": "WeTaxi", "lugar": "Madrid",
                     "empleos": ["wetaxi"], "descripcion": "Pasajeros.", "puntos": ["Clientes."]}],
    "educacion": [{"titulo": "Bootcamp", "centro": "4Geeks", "lugar": "Madrid",
                   "formacion": "bootcamp"}],
    "habilidades": [{"grupo": "Front-end", "lista": ["React", "APIs"]}],
}


def en_ingles(cv):
    """El mismo CV con los textos "traducidos" (lo compartido igual)."""
    en = copy.deepcopy(cv)
    for clave in ("nombre", "rol", "ubicacion", "perfil"):
        en[clave] = f"{cv[clave]} EN"
    for bloque in ("proyectos", "experiencia"):
        for b in en[bloque]:
            b["puntos"] = [f"{p} EN" for p in b["puntos"]]
    return en


@pytest.fixture
def contenido(app):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        db.session.add_all([
            m.SiteText(text_key="hero.entradilla", value=ambos("Hola.", "Hello.")),
            m.SiteText(text_key="hero.etiquetas",
                       value=ambos(["Full Stack", "IA"], ["Full Stack", "AI"])),
            m.SiteText(text_key="hero.ficha", value=ambos(
                [{"clave": "Base", "valor": "Tenerife"}],
                [{"clave": "Based", "valor": "Tenerife"}],
            )),
            m.SiteText(text_key="cv", value=ambos(CV_ES, en_ingles(CV_ES))),
            m.Project(slug="blog", name={"es": "Blog"}, summary={"es": "R"}),
            m.Job(slug="wetaxi", company="WeTaxi", start_date=date(2022, 6, 1),
                  position={"es": "Taxista"}),
            m.Education(slug="bootcamp", title={"es": "Bootcamp"}, start_date=date(2026, 5, 1)),
        ])
        db.session.commit()


@pytest.mark.parametrize(("metodo", "ruta"), [
    ("get", "/texts"), ("put", "/texts"), ("get", "/cv"), ("put", "/cv"), ("get", "/vista-previa"),
])
def test_sin_sesion_nada(cliente, metodo, ruta):
    assert getattr(cliente, metodo)(f"{RUTA}{ruta}", json={}).status_code == 401


def test_leer_los_textos_sin_el_cv(cliente, csrf, contenido):
    textos = cliente.get(f"{RUTA}/texts").json["textos"]
    assert set(textos) == {"hero.entradilla", "hero.etiquetas", "hero.ficha"}


def test_guardar_solo_lo_cambiado(cliente, csrf, contenido):
    cambio = {"hero.entradilla": ambos("  Hola de nuevo. ", "Hello again.")}
    respuesta = cliente.put(f"{RUTA}/texts", json={"textos": cambio}, headers=csrf)
    assert respuesta.status_code == 200
    textos = respuesta.json["textos"]
    # Sin los espacios de los extremos, y lo demás como estaba.
    assert textos["hero.entradilla"] == ambos("Hola de nuevo.", "Hello again.")
    assert textos["hero.etiquetas"]["en"] == ["Full Stack", "AI"]


def test_un_idioma_vacio_no_se_guarda(cliente, csrf, contenido):
    cambio = {
        "hero.entradilla": ambos("Hola.", ""),
        "hero.ficha": ambos(
            [{"clave": "Base", "valor": "Tenerife"}, {"clave": "Edad", "valor": "30"}],
            [{"clave": "Based", "valor": "Tenerife"}],
        ),
    }
    respuesta = cliente.put(f"{RUTA}/texts", json={"textos": cambio}, headers=csrf)
    assert respuesta.status_code == 400
    errores = respuesta.json["errores"]
    assert errores["hero.entradilla.en"] == "falta"
    # El segundo dato existe en español y no en inglés: faltan sus dos campos.
    assert errores["hero.ficha.en.1.clave"] == "falta"
    assert errores["hero.ficha.en.1.valor"] == "falta"
    # Y nada se ha guardado.
    assert cliente.get(f"{RUTA}/texts").json["textos"]["hero.entradilla"]["en"] == "Hello."


def test_los_elementos_vacios_en_los_dos_idiomas_se_quitan(cliente, csrf, contenido):
    cambio = {"hero.etiquetas": ambos(["Full Stack", "", "IA"], ["Full Stack", " ", "AI"])}
    textos = cliente.put(f"{RUTA}/texts", json={"textos": cambio}, headers=csrf).json["textos"]
    assert textos["hero.etiquetas"] == ambos(["Full Stack", "IA"], ["Full Stack", "AI"])


def test_la_forma_tiene_que_ser_la_misma(cliente, csrf, contenido):
    cambio = {
        "hero.entradilla": ambos(["una", "lista"], "Hello."),
        "hero.ficha": ambos([{"clave": "Base"}], [{"clave": "Based"}]),
        "hero.inventado": ambos("A", "B"),
        "cv": ambos("A", "B"),
    }
    errores = cliente.put(f"{RUTA}/texts", json={"textos": cambio}, headers=csrf).json["errores"]
    assert errores["hero.entradilla.es"] == "forma"
    assert errores["hero.ficha.es.0"] == "forma"
    assert errores["hero.inventado"] == "no_existe"
    # El CV tiene su propia ruta.
    assert errores["cv"] == "no_existe"


def test_leer_el_cv_con_lo_que_puede_enganchar(cliente, csrf, contenido):
    datos = cliente.get(f"{RUTA}/cv").json
    assert datos["cv"]["es"]["rol"] == "Full Stack"
    assert datos["opciones"]["empleos"] == [{
        "slug": "wetaxi", "empresa": "WeTaxi", "puesto": "Taxista",
        "desde": "2022-06-01", "hasta": None,
    }]
    assert [p["slug"] for p in datos["opciones"]["proyectos"]] == ["blog"]
    assert [f["slug"] for f in datos["opciones"]["formacion"]] == ["bootcamp"]


def test_guardar_el_cv_comparte_lo_que_no_se_traduce(cliente, csrf, contenido):
    es = copy.deepcopy(CV_ES)
    es["proyectos"][0]["hasta"] = ""
    en = en_ingles(CV_ES)
    # Aunque llegue distinto en inglés, lo compartido se toma del español.
    en["proyectos"][0]["desde"] = "1999-01-01"
    en["habilidades"][0]["lista"] = ["React", "", "Teamwork"]
    respuesta = cliente.put(f"{RUTA}/cv", json={"cv": ambos(es, en)}, headers=csrf)
    assert respuesta.status_code == 200, respuesta.json
    cv = respuesta.json["cv"]
    assert cv["en"]["proyectos"][0]["desde"] == "2026-09-01"
    assert cv["en"]["proyectos"][0]["hasta"] == ""
    # Las habilidades, en cada idioma las suyas, sin huecos.
    assert cv["en"]["habilidades"][0]["lista"] == ["React", "Teamwork"]


def test_el_cv_con_enganches_y_fechas_mal(cliente, csrf, contenido):
    es = copy.deepcopy(CV_ES)
    es["proyectos"][0].update(proyecto="no-existe", desde="ayer", hasta="2020-01-01")
    es["experiencia"][0]["empleos"] = []
    es["educacion"][0]["formacion"] = "otra"
    en = en_ingles(CV_ES)
    en["perfil"] = ""
    errores = cliente.put(f"{RUTA}/cv", json={"cv": ambos(es, en)}, headers=csrf).json["errores"]
    assert errores["cv.proyectos.0.proyecto"] == "no_existe"
    assert errores["cv.proyectos.0.desde"] == "fecha"
    assert errores["cv.experiencia.0.empleos"] == "obligatorio"
    assert errores["cv.educacion.0.formacion"] == "no_existe"
    assert errores["cv.en.perfil"] == "falta"


def test_el_cv_con_distinto_numero_de_bloques(cliente, csrf, contenido):
    en = en_ingles(CV_ES)
    en["educacion"] = []
    errores = cliente.put(f"{RUTA}/cv", json={"cv": ambos(CV_ES, en)}, headers=csrf).json["errores"]
    assert errores == {"cv.educacion": "forma"}


def test_lo_guardado_lo_entiende_el_generador_del_cv(app, cliente, csrf, contenido):
    """El generador del PDF (api/cv/generar.py) prepara lo que guarda el panel."""
    from api import models as m
    from api.cv import generar as generar_cv
    from api.extensions import db

    cliente.put(f"{RUTA}/cv", json={"cv": ambos(CV_ES, en_ingles(CV_ES))}, headers=csrf)
    with app.app_context():
        cv = db.session.get(m.SiteText, "cv").value
        empleos = {j.slug: j for j in db.session.scalars(db.select(m.Job))}
        formacion = {e.slug: e for e in db.session.scalars(db.select(m.Education))}
        proyectos = {p.slug: p for p in db.session.scalars(db.select(m.Project))}
        enlaces = {"email": "mailto:a@b.c", "linkedin": "https://l", "github": "https://g"}
        for lang in ("es", "en"):
            datos = generar_cv.preparar(cv, lang, empleos, formacion, proyectos, enlaces)
            assert datos["experiencia"][0]["fechas"].startswith("06/2022")


def test_la_vista_previa_es_lo_guardado(cliente, csrf, contenido):
    contenido_web = cliente.get(f"{RUTA}/vista-previa").json
    assert contenido_web["site_texts"]["hero.entradilla"] == ambos("Hola.", "Hello.")
    assert "cv" not in contenido_web["site_texts"]
