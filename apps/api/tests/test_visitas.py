"""Las visitas del panel (ADM-10): la API se las pide a Umami. Aquí, un Umami de mentira."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

RUTA = "/api/admin"


@pytest.fixture
def csrf(cliente, admin):
    datos = {"correo": admin["correo"], "contrasena": admin["contrasena"]}
    return {"X-CSRF-TOKEN": cliente.post(f"{RUTA}/login", json=datos).json["csrf"]}


class UmamiDeMentira:
    """Contesta como Umami 3 a lo que pide visitas.recoger()."""

    def __init__(self, falla=False):
        self.llamadas, self.falla = [], falla

    def pedir(self, ruta, **params):
        from api.visitas import ErrorUmami

        self.llamadas.append((ruta, params.get("type") or params.get("eventName")))
        if self.falla:
            raise ErrorUmami("Umami contestó 500 en /stats")
        if ruta == "/stats":
            return {"pageviews": 760, "visitors": 362, "visits": 400, "totaltime": 42400,
                    "comparison": {"pageviews": 600, "visitors": 307}}
        if ruta == "/pageviews":
            return {"pageviews": [{"x": "2026-11-01 00:00:00", "y": 30}],
                    "sessions": [{"x": "2026-11-01 00:00:00", "y": 12}]}
        if ruta == "/event-data/values":
            return [{"value": "cleanflow", "total": 6}, {"value": "mir-llamado", "total": 4}]
        tipo = params["type"]
        return {
            "event": [{"x": "demo-abierta", "y": 10}, {"x": "formulario-enviado", "y": 3}],
            "referrer": [{"x": "linkedin.com", "y": 142}, {"x": "google.es", "y": 40},
                         {"x": "google.com", "y": 28}, {"x": "blog.ejemplo.com", "y": 2}],
            "channel": [{"x": "direct", "y": 101}, {"x": "organicSocial", "y": 142}],
            "country": [{"x": "ES", "y": 266}],
            "device": [{"x": "laptop", "y": 239}, {"x": "mobile", "y": 122}],
            "path": [{"x": "/", "y": 412}],
        }[tipo]


@pytest.fixture
def umami(monkeypatch):
    from api import visitas

    falso = UmamiDeMentira()
    monkeypatch.setattr(visitas, "nube", lambda: falso)
    visitas._cache.clear()
    return falso


def test_sin_sesion_nada(cliente):
    assert cliente.get(f"{RUTA}/stats").status_code == 401


def test_sin_umami_lo_dice(cliente, csrf):
    respuesta = cliente.get(f"{RUTA}/stats")
    assert respuesta.status_code == 503
    assert respuesta.json == {"error": "sin_umami"}


def test_las_visitas(cliente, csrf, umami):
    datos = cliente.get(f"{RUTA}/stats?periodo=7d").json
    assert datos["resumen"] == {"visitantes": 362, "paginas": 760, "visitas": 400,
                                "tiempo": 42400, "antes": {"visitantes": 307, "paginas": 600}}
    # Una casilla por día, también los días sin visitas.
    assert len(datos["por_dia"]) == 7
    # Procedencias juntas y con su nombre, más las directas.
    assert datos["procedencias"][:3] == [
        {"nombre": "LinkedIn", "total": 142}, {"nombre": "Directo", "total": 101},
        {"nombre": "Google", "total": 68},
    ]
    eventos = {e["evento"]: e for e in datos["eventos"]}
    assert len(eventos) == 7
    assert eventos["demo-abierta"]["detalle"] == [{"nombre": "cleanflow", "total": 6},
                                                 {"nombre": "mir-llamado", "total": 4}]
    # Sin eventos, no se pregunta por su desglose.
    assert eventos["cv-descargado"] == {"evento": "cv-descargado", "total": 0, "detalle": []}
    assert ("/event-data/values", "cv-descargado") not in umami.llamadas


def test_la_cache_y_el_periodo(cliente, csrf, umami):
    cliente.get(f"{RUTA}/stats?periodo=30d")
    llamadas = len(umami.llamadas)
    cliente.get(f"{RUTA}/stats?periodo=30d")
    assert len(umami.llamadas) == llamadas  # de la caché
    doce = cliente.get(f"{RUTA}/stats?periodo=12m").json
    assert doce["unidad"] == "month" and len(doce["por_dia"]) == 12
    assert cliente.get(f"{RUTA}/stats?periodo=1h").status_code == 400


def test_si_umami_falla(cliente, csrf, monkeypatch):
    from api import visitas

    monkeypatch.setattr(visitas, "nube", lambda: UmamiDeMentira(falla=True))
    visitas._cache.clear()
    respuesta = cliente.get(f"{RUTA}/stats")
    assert respuesta.status_code == 502
    assert respuesta.json == {"error": "umami"}


def test_el_rango_del_periodo():
    from api.visitas import _casillas, _rango

    ahora = datetime(2026, 11, 2, 18, 30, tzinfo=ZoneInfo("Europe/Madrid"))
    desde, hasta = _rango("7d", ahora)
    assert (desde.isoformat(), hasta) == ("2026-10-27T00:00:00+01:00", ahora)
    desde, _ = _rango("12m", ahora)
    assert desde.date().isoformat() == "2025-12-01"
    assert _casillas("12m", desde)[0] == "2025-12" and _casillas("12m", desde)[-1] == "2026-11"


def test_vuelve_a_entrar_si_el_pase_caduca(monkeypatch):
    from api.visitas import ErrorUmami, Umami

    cliente = Umami("http://umami", "admin", "secreta", "sitio")
    entradas, respuestas = [], [ErrorUmami("Umami contestó 401 en /api/websites"), {"ok": 1}]

    def llamar(ruta, datos=None, pase=None):
        if ruta == "/api/auth/login":
            entradas.append(datos["username"])
            return {"token": f"pase-{len(entradas)}"}
        respuesta = respuestas.pop(0)
        if isinstance(respuesta, Exception):
            raise respuesta
        return respuesta

    monkeypatch.setattr(cliente, "_llamar", llamar)
    assert cliente.pedir("/stats", startAt=1) == {"ok": 1}
    assert entradas == ["admin", "admin"]
    assert cliente._pase == "pase-2"
