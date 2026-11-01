"""El comando pipenv run cambiar-contrasena (ADM-01)."""

import pytest
from cambiar_contrasena import ContrasenaError, cambiar_contrasena, comprobar

RUTA = "/api/admin"


def entrar(cliente, correo, contrasena):
    return cliente.post(f"{RUTA}/login", json={"correo": correo, "contrasena": contrasena})


def test_cambiar_cierra_las_sesiones_y_solo_vale_la_nueva(app, cliente, admin):
    assert entrar(cliente, admin["correo"], admin["contrasena"]).status_code == 200

    with app.app_context():
        cambiar_contrasena("la-contrasena-nueva-123")

    # La sesión que había abierta ya no vale…
    assert cliente.get(f"{RUTA}/sesion").status_code == 401
    # …la contraseña vieja no entra y la nueva sí.
    vieja = entrar(cliente, admin["correo"], admin["contrasena"])
    nueva = entrar(cliente, admin["correo"], "la-contrasena-nueva-123")
    assert vieja.status_code == 401
    assert nueva.status_code == 200


@pytest.mark.parametrize("nueva, repetida, motivo", [
    ("una-contrasena-larga", "otra-contrasena-larga", "No coinciden"),
    ("corta", "corta", "12 caracteres"),
    ("ñ" * 40, "ñ" * 40, "72 bytes"),
])
def test_contrasenas_que_no_valen(nueva, repetida, motivo):
    with pytest.raises(ContrasenaError, match=motivo):
        comprobar(nueva, repetida)


def test_una_buena_vale():
    comprobar("una-contrasena-larga", "una-contrasena-larga")


def test_sin_administrador_lo_dice(app):
    with app.app_context(), pytest.raises(ContrasenaError, match="No hay administrador"):
        cambiar_contrasena("la-contrasena-nueva-123")
