"""Las imágenes de los proyectos y los certificados, en Cloudinary (ADM-08).

Sin Cloudinary de verdad: uno de mentira que apunta lo que se sube y lo que se borra.
"""

import io

import pytest

RUTA = "/api/admin"
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 100
JPG = b"\xff\xd8\xff\xe0" + b"\0" * 100
PDF = b"%PDF-1.7\n" + b"\0" * 100


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


class NubeDeMentira:
    def __init__(self):
        self.subidas, self.borradas, self.n = [], [], 0

    def subir(self, contenido, carpeta, tipo):
        self.n += 1
        ext = "pdf" if tipo == "raw" else "png"
        self.subidas.append((carpeta, tipo))
        return f"https://res.cloudinary.com/demo/{tipo}/upload/v1/{carpeta}/f{self.n}.{ext}"

    def borrar(self, public_id, tipo):
        self.borradas.append((public_id, tipo))


@pytest.fixture
def nube(monkeypatch):
    from api import medios

    falsa = NubeDeMentira()
    monkeypatch.setattr(medios, "nube", lambda: falsa)
    return falsa


@pytest.fixture
def proyecto(app):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        p = m.Project(slug="blog", name={"es": "Blog", "en": "Blog"},
                      summary={"es": "R", "en": "R"})
        db.session.add(p)
        db.session.commit()
        return p.project_id


def subir(cliente, csrf, ruta, contenido, nombre="captura.png"):
    datos = {"archivo": (io.BytesIO(contenido), nombre)}
    return cliente.post(ruta, data=datos, headers=csrf, content_type="multipart/form-data")


@pytest.mark.parametrize(("metodo", "ruta"), [
    ("get", "/projects/1/media"), ("post", "/projects/1/media"), ("put", "/projects/1/media"),
    ("patch", "/media/1"), ("delete", "/media/1"), ("post", "/education/1/certificado"),
])
def test_sin_sesion_nada(cliente, metodo, ruta):
    assert getattr(cliente, metodo)(f"{RUTA}{ruta}").status_code == 401


def test_sin_cloudinary_503(cliente, csrf, proyecto):
    respuesta = subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", PNG)
    assert respuesta.status_code == 503
    assert respuesta.json == {"error": "sin_cloudinary"}
    assert cliente.get(f"{RUTA}/projects/{proyecto}/media").json["nube"] is False


def test_subir_una_imagen(cliente, csrf, proyecto, nube):
    respuesta = subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", PNG)
    assert respuesta.status_code == 201
    imagen = respuesta.json
    # La dirección que se guarda pide la foto optimizada.
    optimizada = "/image/upload/f_auto,q_auto,c_limit,w_1600/v1/portfolio/proyectos/blog/"
    assert optimizada in imagen["url"]
    assert nube.subidas == [("portfolio/proyectos/blog", "image")]
    assert subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", JPG).json["posicion"] == 2


def test_el_formato_se_mira_en_los_bytes(cliente, csrf, proyecto, nube):
    falso = subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", b"GIF89a" + b"\0" * 50,
                  nombre="logo.png")
    assert falso.json == {"error": "formato"}
    # Un PDF tampoco vale como imagen de un proyecto.
    assert subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", PDF).json["error"] == "formato"
    assert nube.subidas == []


def test_demasiado_grande(cliente, csrf, proyecto, nube):
    grande = PNG + b"\0" * (5 * 1024 * 1024)
    respuesta = subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", grande)
    assert respuesta.json["error"] == "grande"
    enorme = PNG + b"\0" * (7 * 1024 * 1024)
    respuesta = subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", enorme)
    assert respuesta.status_code == 413
    assert respuesta.json == {"error": "grande"}


def test_portada_y_textos_alternativos(cliente, csrf, proyecto, nube):
    ruta = f"{RUTA}/projects/{proyecto}/media"
    a = subir(cliente, csrf, ruta, PNG).json
    b = subir(cliente, csrf, ruta, PNG).json
    imagenes = cliente.patch(f"{RUTA}/media/{b['id']}", json={"is_cover": True},
                             headers=csrf).json["imagenes"]
    assert [i["is_cover"] for i in imagenes] == [False, True]
    alts = {str(a["id"]): {"es": " Reservas ", "en": "Bookings"}}
    guardado = cliente.put(ruta, json={"alts": alts}, headers=csrf).json["imagenes"]
    assert guardado[0]["alt"] == {"es": "Reservas", "en": "Bookings"}


def test_publicado_necesita_los_textos_alternativos(app, cliente, csrf, proyecto, nube):
    from api import models as m
    from api.extensions import db

    ruta = f"{RUTA}/projects/{proyecto}/media"
    a = subir(cliente, csrf, ruta, PNG).json
    # Publicar el proyecto con una foto sin texto alternativo: no.
    datos = cliente.get(f"{RUTA}/projects/{proyecto}").json
    publicado = {**datos, "status": "published", "label": {"es": "L", "en": "L"},
                 "period": {"es": "P", "en": "P"}}
    respuesta = cliente.put(f"{RUTA}/projects/{proyecto}", json=publicado, headers=csrf)
    assert respuesta.json["errores"] == {"imagenes": "alt"}
    # Con su texto en los dos idiomas, sí.
    cliente.put(ruta, json={"alts": {str(a["id"]): {"es": "A", "en": "A"}}}, headers=csrf)
    assert cliente.put(f"{RUTA}/projects/{proyecto}", json=publicado,
                       headers=csrf).status_code == 200
    # Y ya publicado, no se le puede vaciar.
    vacio = cliente.put(ruta, json={"alts": {str(a["id"]): {"es": "A", "en": ""}}}, headers=csrf)
    assert vacio.json["errores"] == {f"{a['id']}.en": "falta"}

    # Una foto nueva, aún sin texto, no sale en la web.
    subir(cliente, csrf, ruta, PNG)
    with app.app_context():
        from api.snapshot import generar_instantanea

        assert db.session.scalar(db.select(db.func.count()).select_from(m.ProjectMedia)) == 2
        assert len(generar_instantanea()["projects"][0]["media"]) == 1


def test_borrar_una_no_publicada_la_quita_de_cloudinary_ya(cliente, csrf, proyecto, nube):
    a = subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", PNG).json
    cliente.delete(f"{RUTA}/media/{a['id']}", headers=csrf)
    assert nube.borradas == [("portfolio/proyectos/blog/f1", "image")]


def test_borrar_una_publicada_espera_a_publicar(app, cliente, csrf, proyecto, nube, monkeypatch):
    from api import publicar as p

    monkeypatch.setattr(p, "datos_cv", lambda: {"es": {}, "en": {}})
    ruta = f"{RUTA}/projects/{proyecto}/media"
    a = subir(cliente, csrf, ruta, PNG).json
    cliente.put(ruta, json={"alts": {str(a["id"]): {"es": "A", "en": "A"}}}, headers=csrf)
    datos = cliente.get(f"{RUTA}/projects/{proyecto}").json
    cliente.put(f"{RUTA}/projects/{proyecto}", headers=csrf, json={
        **datos, "status": "published", "label": {"es": "L", "en": "L"},
        "period": {"es": "P", "en": "P"},
    })
    assert cliente.post(f"{RUTA}/publicar", headers=csrf).status_code == 201

    cliente.delete(f"{RUTA}/media/{a['id']}", headers=csrf)
    # La web todavía la enseña: no se borra.
    assert nube.borradas == []
    # Al publicar, ya no la enseña: ahora sí.
    assert cliente.post(f"{RUTA}/publicar", headers=csrf).status_code == 201
    assert nube.borradas == [("portfolio/proyectos/blog/f1", "image")]


def test_borrar_el_proyecto_borra_sus_fotos(cliente, csrf, proyecto, nube):
    subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", PNG)
    subir(cliente, csrf, f"{RUTA}/projects/{proyecto}/media", PNG)
    cliente.delete(f"{RUTA}/projects/{proyecto}", headers=csrf)
    assert len(nube.borradas) == 2


@pytest.fixture
def formacion(app):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        f = m.Education(slug="bootcamp", title={"es": "Bootcamp", "en": "Bootcamp"},
                        certificate_file="/certificados/viejo.pdf")
        db.session.add(f)
        db.session.commit()
        return f.education_id


def test_subir_y_cambiar_un_certificado(cliente, csrf, formacion, nube):
    ruta = f"{RUTA}/education/{formacion}/certificado"
    primero = subir(cliente, csrf, ruta, PDF, nombre="titulo.pdf").json["certificate_file"]
    assert primero.startswith("https://res.cloudinary.com/demo/raw/upload/v1/portfolio/certificados/")
    # El de antes era un archivo de la web, no de Cloudinary: no se toca.
    assert nube.borradas == []
    # Cambiarlo por una imagen: el PDF de Cloudinary se borra (no estaba publicado).
    segundo = subir(cliente, csrf, ruta, JPG, nombre="titulo.jpg").json["certificate_file"]
    assert "/image/upload/" in segundo
    assert nube.borradas == [("portfolio/certificados/f1.pdf", "raw")]
    assert subir(cliente, csrf, ruta, b"texto", nombre="x.pdf").json["error"] == "formato"


def test_quitar_el_certificado_lo_borra(cliente, csrf, formacion, nube):
    subir(cliente, csrf, f"{RUTA}/education/{formacion}/certificado", PDF)
    datos = cliente.get(f"{RUTA}/education/{formacion}").json
    cliente.put(f"{RUTA}/education/{formacion}", headers=csrf,
                json={**datos, "is_visible": False, "certificate_file": None})
    assert nube.borradas == [("portfolio/certificados/f1.pdf", "raw")]


def test_de_cloudinary():
    from api.medios import de_cloudinary

    url = "https://res.cloudinary.com/c/image/upload/f_auto,q_auto/v12/portfolio/a/b.png"
    assert de_cloudinary(url) == ("portfolio/a/b", "image")
    assert de_cloudinary("https://res.cloudinary.com/c/raw/upload/v3/x/y.pdf") == ("x/y.pdf", "raw")
    assert de_cloudinary("/certificados/viejo.pdf") is None
