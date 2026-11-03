"""Las visitas en el panel (ADM-10): la API le pide las cifras a Umami, instalado en nuestro
servidor (decidido en ADM-10: el plan gratis de Umami Cloud no tiene API).

La web pública manda las visitas y los eventos a Umami (src/medir.js); el panel nunca habla
con Umami: pregunta aquí, y aquí se entra en Umami con el usuario y la contraseña del .env
(la forma oficial cuando lo instalas tú). El navegador nunca ve esas credenciales.

Lo que se pide se guarda 5 minutos: abrir Visitas e Inicio seguidos no repite llamadas.
Sin configurar, 503 {"error": "sin_umami"}; si Umami falla, 502 {"error": "umami"}: el panel
lo dice y todo lo demás sigue funcionando.
"""

import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from flask import current_app, jsonify, request

from .admin import admin, admin_required

ZONA = "Europe/Madrid"
ESPERA = 8  # segundos
CACHE = 300  # segundos
PERIODOS = {"7d": ("day", 7), "30d": ("day", 30), "12m": ("month", 12)}
# Los eventos de la web (src/medir.js) y la propiedad por la que se desglosa cada uno.
EVENTOS = {
    "formulario-enviado": None,
    "cv-descargado": "idioma",
    "correo-copiado": None,
    "correo-pulsado": None,
    "perfil-abierto": "red",
    "demo-abierta": "proyecto",
    "repo-abierto": "proyecto",
}
LIMITE = 10  # filas de cada lista (procedencias, países, páginas…)
# Los dominios de donde llegan, con su nombre de siempre (lo demás, con su dominio).
SITIOS = {"linkedin": "LinkedIn", "lnkd.in": "LinkedIn", "google": "Google", "github": "GitHub",
          "bing": "Bing", "duckduckgo": "DuckDuckGo", "x.com": "X", "t.co": "X",
          "twitter": "X", "facebook": "Facebook", "instagram": "Instagram"}


class ErrorUmami(Exception):
    """Umami no contesta o contesta mal. El mensaje nunca lleva la contraseña."""


class Umami:
    """Un cliente mínimo de la API de Umami (v3, instalado por nosotros)."""

    def __init__(self, url, usuario, contrasena, sitio):
        self.url, self.usuario, self.contrasena, self.sitio = url, usuario, contrasena, sitio
        self._pase = None

    def _llamar(self, ruta, datos=None, pase=None):
        cabeceras = {"Accept": "application/json"}
        cuerpo = None
        if datos is not None:
            cabeceras["Content-Type"] = "application/json"
            cuerpo = json.dumps(datos).encode()
        if pase:
            cabeceras["Authorization"] = f"Bearer {pase}"
        peticion = urllib.request.Request(f"{self.url}{ruta}", data=cuerpo, headers=cabeceras)
        try:
            with urllib.request.urlopen(peticion, timeout=ESPERA) as respuesta:
                return json.loads(respuesta.read() or b"null")
        except urllib.error.HTTPError as error:
            raise ErrorUmami(f"Umami contestó {error.code} en {ruta.split('?')[0]}") from None
        except (urllib.error.URLError, OSError, ValueError) as error:
            motivo = getattr(error, "reason", error)
            raise ErrorUmami(f"No se pudo hablar con Umami ({motivo})") from None

    def _entrar(self):
        datos = {"username": self.usuario, "password": self.contrasena}
        self._pase = self._llamar("/api/auth/login", datos)["token"]

    def pedir(self, ruta, **params):
        """GET de una ruta del sitio (/stats, /metrics…). Si el pase ha caducado, entra otra vez."""
        consulta = urllib.parse.urlencode(params)
        ruta = f"/api/websites/{self.sitio}{ruta}?{consulta}"
        if self._pase is None:
            self._entrar()
        try:
            return self._llamar(ruta, pase=self._pase)
        except ErrorUmami as error:
            if "contestó 401" not in str(error):
                raise
            self._entrar()
            return self._llamar(ruta, pase=self._pase)


_cliente = None
_cache = {}
_cerrojo = threading.Lock()


def nube():
    """El cliente de Umami, o None si falta algo en el .env. Uno para toda la API (guarda el
    pase); si cambia la configuración, otro."""
    global _cliente
    c = current_app.config
    claves = (c["UMAMI_URL"], c["UMAMI_USUARIO"], c["UMAMI_CONTRASENA"], c["UMAMI_WEBSITE_ID"])
    if not all(claves):
        return None
    actual = _cliente and (_cliente.url, _cliente.usuario, _cliente.contrasena, _cliente.sitio)
    if actual != claves:
        _cliente = Umami(*claves)
    return _cliente


# ---------------------------------------------------------------- El periodo

def _rango(periodo, ahora):
    """Desde el primer día (o mes) del periodo, a las 00:00 de Madrid, hasta ahora."""
    unidad, n = PERIODOS[periodo]
    hoy = ahora.date()
    if unidad == "day":
        inicio = hoy - timedelta(days=n - 1)
    else:
        mes = hoy.year * 12 + hoy.month - 1 - (n - 1)
        inicio = date(mes // 12, mes % 12 + 1, 1)
    desde = datetime.combine(inicio, datetime.min.time(), tzinfo=ahora.tzinfo)
    return desde, ahora


def _casillas(periodo, desde):
    """Los días (o meses) del periodo, para la gráfica: también los que no tienen visitas."""
    unidad, n = PERIODOS[periodo]
    if unidad == "day":
        return [(desde.date() + timedelta(days=i)).isoformat() for i in range(n)]
    mes = desde.year * 12 + desde.month - 1
    return [f"{(mes + i) // 12}-{(mes + i) % 12 + 1:02d}" for i in range(n)]


def _ms(momento):
    return int(momento.timestamp() * 1000)


# ---------------------------------------------------------------- Lo que se pide a Umami

def _cifra(valor):
    """Umami da a veces {"value": n} y a veces n."""
    if isinstance(valor, dict):
        valor = valor.get("value", 0)
    return int(valor or 0)


def _lista(filas, nombre="x"):
    return [{"nombre": f.get(nombre) or "", "total": _cifra(f.get("y", f.get("total")))}
            for f in filas or []]


def _procedencias(dominios, canales):
    """"De dónde vienen", como en la maqueta: LinkedIn, Directo, Google, GitHub… Umami da
    los dominios (linkedin.com, google.es…) y, aparte, las visitas sin procedencia ("direct")."""
    juntas = {}
    for fila in dominios:
        nombre = next((n for clave, n in SITIOS.items() if clave in fila["nombre"]), fila["nombre"])
        juntas[nombre] = juntas.get(nombre, 0) + fila["total"]
    directo = next((c["total"] for c in canales if c["nombre"] == "direct"), 0)
    if directo:
        juntas["Directo"] = directo
    filas = [{"nombre": n, "total": t} for n, t in juntas.items()]
    return sorted(filas, key=lambda f: -f["total"])[:LIMITE]


def recoger(cliente, periodo, ahora=None):
    """Todo lo que enseña la pantalla Visitas para un periodo."""
    ahora = ahora or datetime.now(ZoneInfo(ZONA))
    desde, hasta = _rango(periodo, ahora)
    unidad, _ = PERIODOS[periodo]
    rango = {"startAt": _ms(desde), "endAt": _ms(hasta), "timezone": ZONA}

    stats = cliente.pedir("/stats", **rango)
    antes = stats.get("comparison") or {}
    resumen = {
        "visitantes": _cifra(stats.get("visitors")),
        "paginas": _cifra(stats.get("pageviews")),
        "visitas": _cifra(stats.get("visits")),
        "tiempo": _cifra(stats.get("totaltime")),
        "antes": {
            "visitantes": _cifra(antes.get("visitors")),
            "paginas": _cifra(antes.get("pageviews")),
        },
    }

    serie = cliente.pedir("/pageviews", unit=unidad, **rango)
    corte = 10 if unidad == "day" else 7
    paginas = {str(f["x"])[:corte]: _cifra(f["y"]) for f in serie.get("pageviews") or []}
    visitantes = {str(f["x"])[:corte]: _cifra(f["y"]) for f in serie.get("sessions") or []}
    por_dia = [{"fecha": c, "visitantes": visitantes.get(c, 0), "paginas": paginas.get(c, 0)}
               for c in _casillas(periodo, desde)]

    def metricas(tipo, limite=LIMITE):
        return _lista(cliente.pedir("/metrics", type=tipo, limit=limite, **rango))

    totales = {e["nombre"]: e["total"] for e in metricas("event", 50)}
    eventos = []
    for nombre, propiedad in EVENTOS.items():
        detalle = []
        if propiedad and totales.get(nombre):
            valores = cliente.pedir("/event-data/values", eventName=nombre,
                                    propertyName=propiedad, **rango)
            detalle = _lista(valores, "value")
        eventos.append({"evento": nombre, "total": totales.get(nombre, 0), "detalle": detalle})

    return {
        "periodo": periodo,
        "unidad": unidad,
        "desde": desde.isoformat(),
        "hasta": hasta.isoformat(),
        "resumen": resumen,
        "por_dia": por_dia,
        "eventos": eventos,
        "procedencias": _procedencias(metricas("referrer", 50), metricas("channel")),
        "paises": metricas("country"),
        "dispositivos": metricas("device"),
        "paginas": metricas("path"),
    }


def visitas(periodo):
    """Con la caché de 5 minutos. Lanza ErrorUmami si Umami falla."""
    cliente = nube()
    with _cerrojo:
        guardado = _cache.get(periodo)
        if guardado and time.monotonic() - guardado[0] < CACHE:
            return guardado[1]
    datos = recoger(cliente, periodo)
    with _cerrojo:
        _cache[periodo] = (time.monotonic(), datos)
    return datos


@admin.get("/stats")
@admin_required
def estadisticas():
    """?periodo=7d|30d|12m (7d sin él)."""
    periodo = request.args.get("periodo", "7d")
    if periodo not in PERIODOS:
        return jsonify(error="validacion", errores={"periodo": "formato"}), 400
    if nube() is None:
        return jsonify(error="sin_umami"), 503
    try:
        return jsonify(visitas(periodo))
    except ErrorUmami as error:
        current_app.logger.warning("Visitas: %s", error)
        return jsonify(error="umami"), 502
