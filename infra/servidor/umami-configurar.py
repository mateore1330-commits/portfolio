"""Deja Umami listo para el portfolio (INFRA-04). Lo llama 3-https.sh --umami.

Hace (y se puede repetir: lo que ya está, no lo rehace):
  1. Cambia la contraseña de admin (si se da una nueva).
  2. Da de alta la web y la mete en un equipo "Portfolio".
  3. Crea el usuario de la API, solo lectura, y lo mete en el equipo como "solo lectura":
     puede ver las estadísticas, pero no borrar ni cambiar nada.
  4. Comprueba que ese usuario lee las estadísticas.

Las contraseñas llegan por el entorno (nunca por la orden ni la pantalla). Imprime el Website ID,
que no es secreto. Solo usa la biblioteca estándar de Python.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

URL = os.environ.get("UMAMI", "http://127.0.0.1:8081")
DOMINIO = "mateorodriguez.solutions"
EQUIPO = "Portfolio"


def pedir(metodo, ruta, token=None, datos=None):
    req = urllib.request.Request(URL + ruta, method=metodo)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    cuerpo = json.dumps(datos).encode() if datos is not None else None
    try:
        with urllib.request.urlopen(req, cuerpo, timeout=15) as r:
            texto = r.read().decode()
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        return e.code, None


def entrar(usuario, contrasena):
    estado, d = pedir("POST", "/api/auth/login", datos={"username": usuario, "password": contrasena})
    return d["token"] if estado == 200 else None


def lista(d):
    return d["data"] if isinstance(d, dict) else d


def parar(mensaje):
    print(f"ERROR: {mensaje}. No sigo.")
    sys.exit(1)


def main():
    actual = os.environ["ADMIN_ACTUAL"]
    nueva = os.environ.get("ADMIN_NUEVA", "")
    lector = os.environ["LECTOR"]
    lector_pass = os.environ["LECTOR_PASS"]

    token = entrar("admin", actual)
    if not token:
        parar("la contraseña actual de admin no es correcta")

    if nueva and nueva != actual:
        estado, _ = pedir("POST", "/api/me/password", token, {"currentPassword": actual, "newPassword": nueva})
        if estado != 200:
            parar(f"no se pudo cambiar la contraseña de admin ({estado})")
        token = entrar("admin", nueva)
        print("1/4 · Contraseña de admin cambiada.")
    else:
        print("1/4 · Contraseña de admin: sin cambios.")

    # El equipo y la web.
    _, d = pedir("GET", "/api/teams", token)
    equipo = next((t for t in lista(d) if t["name"] == EQUIPO), None)
    if not equipo:
        _, d = pedir("POST", "/api/teams", token, {"name": EQUIPO})
        equipo = lista(d)[0]
    _, d = pedir("GET", f"/api/teams/{equipo['id']}/websites", token)
    web = next((w for w in lista(d) if w["domain"] == DOMINIO), None)
    if not web:
        _, d = pedir("GET", "/api/websites", token)
        web = next((w for w in lista(d) if w["domain"] == DOMINIO), None)
        if not web:
            _, web = pedir("POST", "/api/websites", token, {"name": "Portfolio", "domain": DOMINIO})
        estado, _ = pedir("POST", f"/api/websites/{web['id']}/transfer", token, {"teamId": equipo["id"]})
        if estado != 200:
            parar(f"no se pudo meter la web en el equipo ({estado})")
    print(f"2/4 · Web {DOMINIO} en el equipo {EQUIPO}.")

    # El usuario de la API: solo lectura, dentro y fuera del equipo.
    _, d = pedir("GET", "/api/admin/users?pageSize=100", token)
    usuario = next((u for u in lista(d) if u["username"] == lector), None)
    if usuario:
        if usuario["role"] != "view-only":
            parar(f"ya existe un usuario {lector} que no es de solo lectura")
        pedir("POST", f"/api/users/{usuario['id']}", token, {"password": lector_pass})
    else:
        estado, usuario = pedir(
            "POST", "/api/users", token, {"username": lector, "password": lector_pass, "role": "view-only"}
        )
        if estado != 200:
            parar(f"no se pudo crear el usuario {lector} ({estado})")
    _, d = pedir("GET", f"/api/teams/{equipo['id']}/users", token)
    miembro = next((m for m in lista(d) if m["userId"] == usuario["id"]), None)
    if miembro:
        pedir("POST", f"/api/teams/{equipo['id']}/users/{usuario['id']}", token, {"role": "team-view-only"})
    else:
        estado, _ = pedir(
            "POST", f"/api/teams/{equipo['id']}/users", token, {"userId": usuario["id"], "role": "team-view-only"}
        )
        if estado != 200:
            parar(f"no se pudo meter a {lector} en el equipo ({estado})")
    print(f"3/4 · Usuario {lector}: solo lectura, en el equipo.")

    # La prueba: lee las estadísticas y no puede borrar la web.
    t = entrar(lector, lector_pass)
    ahora = int(time.time() * 1000)
    lee, _ = pedir("GET", f"/api/websites/{web['id']}/stats?startAt={ahora - 86400000}&endAt={ahora}", t)
    borra, _ = pedir("DELETE", f"/api/websites/{web['id']}", t)
    if not t or lee != 200 or borra == 200:
        parar(f"la prueba del usuario {lector} no sale bien (lee {lee}, borrar {borra})")
    print(f"4/4 · {lector} lee las estadísticas y no puede borrar nada.")
    print(f"WEBSITE_ID={web['id']}")


if __name__ == "__main__":
    main()
