"""Contribuciones de GitHub: la consulta, los cálculos y la caché de 24 h.

La API REST de GitHub no da las contribuciones: hay que usar la GraphQL, y exige token.
El token solo sale de aquí en la cabecera Authorization de la petición a GitHub: nunca
va en una respuesta, en la base de datos ni en un mensaje de error.
"""

import json
import urllib.error
import urllib.request
from datetime import UTC, date, datetime, timedelta

from flask import current_app
from sqlalchemy import select

from .extensions import db
from .models import ContributionsCache

URL = "https://api.github.com/graphql"
ESPERA_MAXIMA = 8  # segundos: si GitHub va lento, mejor servir la copia guardada
VALIDEZ = timedelta(hours=24)
SEMANAS = 53

# Los niveles de color de GitHub (por cuartiles). Usar los suyos hace que el gráfico
# coincida cuadro a cuadro con el del perfil.
NIVELES = {
    "NONE": 0,
    "FIRST_QUARTILE": 1,
    "SECOND_QUARTILE": 2,
    "THIRD_QUARTILE": 3,
    "FOURTH_QUARTILE": 4,
}

CONSULTA = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}
"""


class ErrorGitHub(Exception):
    """GitHub no contestó o contestó algo inesperado. El mensaje nunca lleva el token."""


def consultar(login, token):
    """El calendario de contribuciones del último año, tal como lo da GitHub."""
    cuerpo = json.dumps({"query": CONSULTA, "variables": {"login": login}}).encode()
    peticion = urllib.request.Request(
        URL,
        data=cuerpo,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "portfolio-api",
        },
    )
    try:
        with urllib.request.urlopen(peticion, timeout=ESPERA_MAXIMA) as respuesta:
            datos = json.load(respuesta)
    except urllib.error.HTTPError as error:
        raise ErrorGitHub(f"GitHub contestó {error.code}") from None
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        raise ErrorGitHub(f"no se pudo leer GitHub ({type(error).__name__})") from None

    try:
        return datos["data"]["user"]["contributionsCollection"]["contributionCalendar"]
    except (KeyError, TypeError):
        # Por ejemplo, un login que no existe: GitHub devuelve "user": null.
        raise ErrorGitHub("la respuesta de GitHub no trae el calendario") from None


def resumir(calendario):
    """Lo que pinta la web, ya calculado: semanas, total, rachas y media semanal.

    GitHub agrupa las semanas de domingo a sábado; aquí se reagrupan de lunes a domingo
    (como la maqueta) y se quedan las últimas 53. Los huecos (antes del primer día o
    después de hoy) son None.
    """
    dias = [
        {
            "fecha": d["date"],
            "n": d["contributionCount"],
            "nivel": NIVELES.get(d["contributionLevel"], 0),
        }
        for semana in calendario["weeks"]
        for d in semana["contributionDays"]
    ]
    if not dias:
        raise ErrorGitHub("el calendario de GitHub viene vacío")

    hueco_inicial = date.fromisoformat(dias[0]["fecha"]).weekday()  # 0 = lunes
    celdas = [None] * hueco_inicial + dias
    celdas += [None] * (-len(celdas) % 7)
    semanas = [celdas[i : i + 7] for i in range(0, len(celdas), 7)][-SEMANAS:]

    maxima = seguidos = 0
    for dia in dias:
        seguidos = seguidos + 1 if dia["n"] else 0
        maxima = max(maxima, seguidos)

    # La racha actual cuenta hasta ayer si hoy todavía no hay nada: el día no ha terminado.
    pendientes = dias[:-1] if dias[-1]["n"] == 0 else dias
    actual = 0
    for dia in reversed(pendientes):
        if not dia["n"]:
            break
        actual += 1

    # El total es el de GitHub: así coincide con el que se ve en el perfil.
    total = calendario["totalContributions"]
    return {
        "total": total,
        "racha_actual": actual,
        "racha_maxima": maxima,
        "media_semanal": round(total / SEMANAS),
        "semanas": semanas,
    }


def contribuciones():
    """La copia de la base de datos, renovada desde GitHub si tiene más de 24 h.

    Si GitHub falla, se devuelve la copia vieja: mejor un dato de ayer que ninguno.
    Devuelve None solo si no hay nada guardado y no se puede consultar.
    """
    login = current_app.config["GITHUB_LOGIN"]
    token = current_app.config["GITHUB_TOKEN"]
    if not login:
        return None

    copia = db.session.scalar(
        select(ContributionsCache).where(ContributionsCache.github_login == login)
    )
    ahora = datetime.now(UTC)
    if copia is not None and ahora - copia.fetched_at < VALIDEZ:
        return copia.payload
    if not token:
        return copia.payload if copia else None

    try:
        resumen = resumir(consultar(login, token))
    except ErrorGitHub as error:
        current_app.logger.warning("Contribuciones: %s. Se sirve la copia guardada.", error)
        return copia.payload if copia else None

    if copia is None:
        copia = ContributionsCache(github_login=login)
        db.session.add(copia)
    copia.payload = {"login": login, "actualizado": ahora.isoformat(timespec="seconds"), **resumen}
    copia.total_contributions = resumen["total"]
    copia.current_streak = resumen["racha_actual"]
    copia.longest_streak = resumen["racha_maxima"]
    copia.fetched_at = ahora
    db.session.commit()
    return copia.payload
