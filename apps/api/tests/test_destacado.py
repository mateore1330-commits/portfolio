"""Un solo proyecto destacado, siempre el primer publicado y el primero de la lista (#154)."""

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


def ambos(texto):
    return {"es": texto, "en": texto}


def proyecto(nombre, publicado=True, **cambios):
    datos = {"name": ambos(nombre), "summary": ambos("R"), "status": "draft"}
    if publicado:
        datos |= {"status": "published", "label": ambos("L"), "period": ambos("P")}
    return datos | cambios


def crear(cliente, csrf, nombre, publicado=True, **cambios):
    return cliente.post(f"{RUTA}/projects", json=proyecto(nombre, publicado, **cambios),
                        headers=csrf)


def lista(cliente):
    """["A ★", "B", …] en el orden de la lista."""
    filas = cliente.get(f"{RUTA}/projects").json
    return [p["name"]["es"] + (" ★" if p["is_featured"] else "") for p in filas]


def ids(cliente):
    return {p["name"]["es"]: p["id"] for p in cliente.get(f"{RUTA}/projects").json}


def test_el_primer_publicado_es_el_destacado(cliente, csrf):
    crear(cliente, csrf, "Borrador", publicado=False)
    # El primer publicado lo es solo, sin pedirlo, y sube el primero.
    primero = crear(cliente, csrf, "A").json
    assert primero["cambio_destacado"] == {"antes": None, "ahora": "A"}
    crear(cliente, csrf, "B")
    assert lista(cliente) == ["A ★", "Borrador", "B"]


def test_la_estrella_cambia_el_destacado(cliente, csrf):
    for nombre in ("A", "B", "C"):
        crear(cliente, csrf, nombre)
    respuesta = cliente.patch(f"{RUTA}/projects/{ids(cliente)['C']}", json={"is_featured": True},
                              headers=csrf)
    assert respuesta.json["cambio_destacado"] == {"antes": "A", "ahora": "C"}
    # Sube el primero; el anterior queda segundo y los demás no cambian entre ellos.
    assert lista(cliente) == ["C ★", "A", "B"]
    # La del que ya lo es: no cambia nada.
    otra = cliente.patch(f"{RUTA}/projects/{ids(cliente)['C']}", json={"is_featured": True},
                         headers=csrf)
    assert otra.json["cambio_destacado"] is None


def test_un_borrador_no_puede_ser_destacado(cliente, csrf):
    crear(cliente, csrf, "A")
    crear(cliente, csrf, "Borrador", publicado=False)
    estrella = cliente.patch(f"{RUTA}/projects/{ids(cliente)['Borrador']}",
                             json={"is_featured": True}, headers=csrf)
    assert estrella.status_code == 409
    assert estrella.json == {"error": "borrador"}
    # Pedirlo desde el formulario se ignora.
    crear(cliente, csrf, "Otro borrador", publicado=False, is_featured=True)
    assert lista(cliente) == ["A ★", "Borrador", "Otro borrador"]


def test_arrastrar_al_primer_puesto(cliente, csrf):
    for nombre in ("A", "B"):
        crear(cliente, csrf, nombre)
    crear(cliente, csrf, "Borrador", publicado=False)
    p = ids(cliente)
    ruta = f"{RUTA}/projects/orden"
    # Otro publicado arriba: pasa a ser el destacado.
    respuesta = cliente.put(ruta, json={"ids": [p["B"], p["A"], p["Borrador"]]}, headers=csrf)
    assert respuesta.json["cambio_destacado"] == {"antes": "A", "ahora": "B"}
    assert lista(cliente) == ["B ★", "A", "Borrador"]
    # Un borrador arriba: se queda segundo, debajo del destacado.
    respuesta = cliente.put(ruta, json={"ids": [p["Borrador"], p["B"], p["A"]]}, headers=csrf)
    assert respuesta.json["cambio_destacado"] is None
    assert lista(cliente) == ["B ★", "Borrador", "A"]
    # El destacado hacia abajo: el que queda primero pasa a serlo.
    cliente.put(ruta, json={"ids": [p["A"], p["Borrador"], p["B"]]}, headers=csrf)
    assert lista(cliente) == ["A ★", "Borrador", "B"]


def test_el_interruptor_del_formulario(cliente, csrf):
    for nombre in ("A", "B"):
        crear(cliente, csrf, nombre)
    b = cliente.get(f"{RUTA}/projects/{ids(cliente)['B']}").json
    guardado = cliente.put(f"{RUTA}/projects/{b['id']}", json={**b, "is_featured": True},
                           headers=csrf).json
    assert guardado["cambio_destacado"] == {"antes": "A", "ahora": "B"}
    assert guardado["posicion"] == 1
    # Apagarlo en el destacado no lo quita: siempre tiene que haber uno.
    cliente.put(f"{RUTA}/projects/{b['id']}", json={**b, "is_featured": False}, headers=csrf)
    assert lista(cliente) == ["B ★", "A"]
    # Uno nuevo creado ya publicado y destacado.
    nuevo = crear(cliente, csrf, "C", is_featured=True).json
    assert nuevo["cambio_destacado"] == {"antes": "B", "ahora": "C"}
    assert lista(cliente) == ["C ★", "B", "A"]


def test_si_el_destacado_se_va_pasa_al_siguiente_publicado(cliente, csrf):
    for nombre in ("A", "B"):
        crear(cliente, csrf, nombre)
    crear(cliente, csrf, "Borrador", publicado=False)
    crear(cliente, csrf, "C")
    p = ids(cliente)
    cliente.put(f"{RUTA}/projects/orden", json={"ids": [p["A"], p["Borrador"], p["B"], p["C"]]},
                headers=csrf)
    # A pasa a borrador: el siguiente publicado es B (el borrador de en medio no cuenta).
    a = cliente.get(f"{RUTA}/projects/{p['A']}").json
    guardado = cliente.put(f"{RUTA}/projects/{p['A']}", json={**a, "status": "draft"},
                           headers=csrf).json
    assert guardado["cambio_destacado"] == {"antes": "A", "ahora": "B"}
    assert lista(cliente) == ["B ★", "A", "Borrador", "C"]
    # Borrar el destacado: pasa a C.
    borrado = cliente.delete(f"{RUTA}/projects/{p['B']}", headers=csrf).json
    assert borrado["cambio_destacado"] == {"antes": "B", "ahora": "C"}
    assert lista(cliente) == ["C ★", "A", "Borrador"]
    # Sin publicados, ninguno.
    cliente.delete(f"{RUTA}/projects/{p['C']}", headers=csrf)
    assert lista(cliente) == ["A", "Borrador"]


def test_datos_que_no_cumplen_la_regla(app, cliente, csrf):
    from api import models as m
    from api.extensions import db

    with app.app_context():
        for i, (slug, destacado) in enumerate([("a", True), ("b", True), ("c", False)]):
            db.session.add(m.Project(slug=slug, name=ambos(slug.upper()), summary=ambos("R"),
                                     status=m.ContentStatus.PUBLISHED, is_featured=destacado,
                                     sort_order=i))
        db.session.commit()
    # Al guardar cualquier cosa, queda uno solo: el primer publicado.
    c = cliente.get(f"{RUTA}/projects/{ids(cliente)['C']}").json
    cliente.put(f"{RUTA}/projects/{c['id']}", json={**c, "label": ambos("L"),
                                                    "period": ambos("P")}, headers=csrf)
    assert lista(cliente) == ["A ★", "B", "C"]
