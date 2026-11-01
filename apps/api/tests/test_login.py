"""El login del panel (ADM-01): lo más delicado del proyecto, así que cada criterio tiene
su prueba. Si un cambio futuro rompe algo de esto, el PR no pasa."""

from datetime import timedelta

from conftest import CORREO

COOKIE = "sesion_panel"
RUTA = "/api/admin"


def entrar(cliente, correo=CORREO, contrasena="una-contrasena-de-prueba"):
    return cliente.post(f"{RUTA}/login", json={"correo": correo, "contrasena": contrasena})


def cookie_de(respuesta):
    cookies = respuesta.headers.getlist("Set-Cookie")
    return next((c for c in cookies if c.startswith(f"{COOKIE}=")), "")


# ---------------------------------------------------------------- Entrar

def test_entrar_bien_da_la_cookie_protegida(cliente, admin):
    respuesta = entrar(cliente)
    assert respuesta.status_code == 200
    assert respuesta.json["csrf"]
    cookie = cookie_de(respuesta)
    for atributo in ("HttpOnly", "Secure", "SameSite=Lax", f"Path={RUTA}"):
        assert atributo in cookie, f"a la cookie le falta {atributo}"


def test_con_la_cookie_hay_sesion(cliente, admin):
    entrar(cliente)
    respuesta = cliente.get(f"{RUTA}/sesion")
    assert respuesta.status_code == 200
    assert respuesta.json["correo"] == CORREO


def test_el_correo_da_igual_en_mayusculas_o_con_espacios(cliente, admin):
    assert entrar(cliente, correo="  ADMIN@Ejemplo.TEST ").status_code == 200


def test_contrasena_mala_no_entra(cliente, admin):
    respuesta = entrar(cliente, contrasena="esta-no-es")
    assert respuesta.status_code == 401
    assert respuesta.json == {"error": "credenciales"}
    assert cookie_de(respuesta) == ""


def test_correo_inexistente_da_el_mismo_mensaje(cliente, admin):
    malo = entrar(cliente, contrasena="esta-no-es")
    inexistente = entrar(cliente, correo="nadie@ejemplo.test")
    assert inexistente.status_code == malo.status_code == 401
    assert inexistente.json == malo.json


def test_peticion_sin_datos_no_entra(cliente, admin):
    assert cliente.post(f"{RUTA}/login", json={}).status_code == 401
    assert cliente.post(f"{RUTA}/login", data="no es json").status_code == 401


# ---------------------------------------------------------------- Límite de intentos

def test_al_sexto_fallo_bloquea_aunque_la_contrasena_sea_buena(cliente, admin):
    for _ in range(5):
        assert entrar(cliente, contrasena="mal").status_code == 401
    bloqueada = entrar(cliente)
    assert bloqueada.status_code == 429
    assert bloqueada.json == {"error": "demasiados_intentos"}
    assert bloqueada.headers["Retry-After"] == "900"


def test_los_fallos_antiguos_no_cuentan(app, cliente, admin):
    from api.extensions import db
    from api.models import AuthAttempt

    for _ in range(5):
        entrar(cliente, contrasena="mal")
    with app.app_context():
        for intento in db.session.query(AuthAttempt):
            intento.created_at = intento.created_at - timedelta(minutes=16)
        db.session.commit()
    assert entrar(cliente).status_code == 200


# ---------------------------------------------------------------- Registro de intentos

def test_todos_los_intentos_quedan_registrados_sin_la_contrasena(app, cliente, admin):
    from api.extensions import db
    from api.models import AuthAttempt

    entrar(cliente, contrasena="contrasena-equivocada")
    entrar(cliente)
    with app.app_context():
        intentos = db.session.query(AuthAttempt).order_by(AuthAttempt.attempt_id).all()
        assert [i.success for i in intentos] == [False, True]
        assert all(i.email == CORREO and i.ip_address for i in intentos)
        for i in intentos:
            fila = " ".join(str(getattr(i, c.key)) for c in AuthAttempt.__table__.columns)
            assert "contrasena-equivocada" not in fila and "una-contrasena-de-prueba" not in fila


# ---------------------------------------------------------------- El portero

def test_sin_cookie_no_hay_sesion(cliente, admin):
    respuesta = cliente.get(f"{RUTA}/sesion")
    assert respuesta.status_code == 401
    assert respuesta.json == {"error": "sin_sesion"}


def test_una_cookie_manipulada_no_vale(cliente, admin):
    entrar(cliente)
    pase = cliente.get_cookie(COOKIE, path=RUTA).value
    cliente.set_cookie(COOKIE, pase[:-4] + "AAAA", path=RUTA)
    assert cliente.get(f"{RUTA}/sesion").status_code == 401


def test_un_pase_caducado_lo_dice(app, cliente, admin):
    from flask_jwt_extended import create_access_token

    with app.app_context():
        pase = create_access_token(
            identity="1", additional_claims={"v": 1}, expires_delta=timedelta(seconds=-1)
        )
    cliente.set_cookie(COOKIE, pase, path=RUTA)
    respuesta = cliente.get(f"{RUTA}/sesion")
    assert respuesta.status_code == 401
    assert respuesta.json == {"error": "sesion_caducada"}


# ---------------------------------------------------------------- Salir

def test_salir_sin_el_codigo_csrf_no_vale(cliente, admin):
    entrar(cliente)
    assert cliente.post(f"{RUTA}/logout").status_code == 401


def test_salir_cierra_todas_las_sesiones(cliente, admin):
    csrf = entrar(cliente).json["csrf"]
    pase_viejo = cliente.get_cookie(COOKIE, path=RUTA).value
    assert cliente.post(f"{RUTA}/logout", headers={"X-CSRF-TOKEN": csrf}).status_code == 200
    # La cookie se borra en este navegador…
    assert cliente.get(f"{RUTA}/sesion").status_code == 401
    # …y una copia del pase (otro dispositivo) tampoco vale ya.
    cliente.set_cookie(COOKIE, pase_viejo, path=RUTA)
    assert cliente.get(f"{RUTA}/sesion").status_code == 401
    # Y se puede volver a entrar.
    assert entrar(cliente).status_code == 200


# ---------------------------------------------------------------- CORS

def test_el_panel_acepta_credenciales_solo_desde_la_web(cliente, admin):
    desde_la_web = entrar(cliente)
    previa = cliente.options(f"{RUTA}/login", headers={
        "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
    })
    assert previa.headers.get("Access-Control-Allow-Credentials") == "true"
    assert previa.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"
    otra = cliente.options(f"{RUTA}/login", headers={
        "Origin": "https://otra-web.ejemplo", "Access-Control-Request-Method": "POST",
    })
    assert "Access-Control-Allow-Origin" not in otra.headers
    assert desde_la_web.status_code == 200
