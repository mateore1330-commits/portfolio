"""Genera el CV en PDF, en español y en inglés, desde la base de datos.

Uso:  pipenv run generar-cv   (desde apps/api, con Google Chrome instalado y
      npm install hecho en apps/web: usa sus fuentes)

- Los textos son los del CV (el texto "cv" del contenido): resumidos y adaptados a las
  ofertas, no una copia de la web.
- Las fechas NO se escriben en el CV: cada bloque está enganchado a uno o varios empleos o
  formaciones de la web y toma de ellos el inicio y el fin. Así siempre coinciden.
- Lo convierte en PDF con Chrome sin ventana y después lo lee como lo haría un ATS (los
  programas que filtran candidaturas). Si algo falla, no guarda nada.

Salida:
  apps/web/public/cv/CV-Mateo-Rodriguez-Escobar-ES.pdf y -EN.pdf   (públicos, sin teléfono)
  apps/api/cv-privado/…-con-telefono.pdf   (solo si hay CV_TELEFONO en .env; git lo ignora)
"""

import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import unquote

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup
from PIL import Image, ImageEnhance, ImageOps
from pypdf import PdfReader, PdfWriter
from sqlalchemy import select

API = Path(__file__).resolve().parent.parent
WEB = API.parent / "web"
sys.path.insert(0, str(API / "src"))

from api import create_app  # noqa: E402
from api.extensions import db  # noqa: E402
from api.models import Education, Job, Link, Project, SiteText  # noqa: E402

PUBLICOS = WEB / "public" / "cv"
PRIVADOS = API / "cv-privado"
NOMBRE_ARCHIVO = "CV-Mateo-Rodriguez-Escobar"
CHROME = os.getenv("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
FUENTES = WEB / "node_modules" / "@fontsource-variable"
RETRATO = WEB / "src" / "assets" / "retrato" / "retrato-400.jpg"
WEB_URL = "https://mateorodriguez.solutions"
AZUL = (0x1E, 0x3F, 0xB0)  # --blue de la web (tema claro)
TINTE = .55  # la opacidad del azul sobre la foto, como en la portada

# Las fuentes de la web son variables (grosor y anchura ajustables). Chrome las mete en el
# PDF como "Type 3", un formato que algunos ATS leen mal. Por eso se saca de cada una una
# versión fija por estilo, que va al PDF como TrueType normal: (archivo, ejes).
ARCHIVO = "archivo/files/archivo-latin-wdth-normal.woff2"
NEWSREADER = "newsreader/files/newsreader-latin-opsz-normal.woff2"
MONO = "jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2"
ESTILOS = {
    "titulo": (ARCHIVO, {"wdth": 118, "wght": 800}),
    "seccion": (ARCHIVO, {"wdth": 112, "wght": 750}),
    "fuerte": (ARCHIVO, {"wdth": 104, "wght": 650}),
    "contacto": (ARCHIVO, {"wdth": 100, "wght": 500}),
    "texto": (NEWSREADER, {"opsz": 12, "wght": 400}),
    "texto_negrita": (NEWSREADER, {"opsz": 12, "wght": 600}),
    "mono": (MONO, {"wght": 400}),
}

# Los títulos de sección, estándar: es lo que busca un ATS para saber qué es cada parte.
TEXTOS = {
    "es": {"perfil": "Perfil profesional", "proyectos": "Proyectos", "experiencia": "Experiencia",
           "educacion": "Educación", "habilidades": "Habilidades", "pie": "Portfolio y proyectos",
           "actualizado": "Actualizado", "actualidad": "Actualidad"},
    "en": {"perfil": "Professional summary", "proyectos": "Projects", "experiencia": "Experience",
           "educacion": "Education", "habilidades": "Skills", "pie": "Portfolio and projects",
           "actualizado": "Updated", "actualidad": "Present"},
}


class CVError(Exception):
    """El CV no se puede generar. El mensaje dice por qué."""


# =====================================================================
# FECHAS (de la web)
# =====================================================================

def mes(d):
    return d.strftime("%m/%Y")


def rango(inicios, fines, actualidad):
    """De varios empleos, el primer inicio y el último fin. Un fin vacío es "actualidad"."""
    inicio = min(inicios)
    fin = actualidad if None in fines else mes(max(fines))
    return f"{mes(inicio)} - {fin}"


def fechas_de(slugs, por_slug, que, actualidad):
    faltan = [s for s in slugs if s not in por_slug]
    if faltan:
        raise CVError(f"El CV usa {que} que no existe en la web: {', '.join(faltan)}.")
    filas = [por_slug[s] for s in slugs]
    if any(f.start_date is None for f in filas):
        raise CVError(f"{que.capitalize()} {', '.join(slugs)} no tiene fecha de inicio en la web.")
    return rango([f.start_date for f in filas], [f.end_date for f in filas], actualidad)


# =====================================================================
# LEER (de la base de datos) Y PREPARAR
# =====================================================================

def enlace(url):
    """La URL y cómo se ve: sin https://www. y con las tildes legibles (rodríguez)."""
    return {"url": url, "texto": unquote(re.sub(r"^https?://(www\.)?", "", url)).rstrip("/")}


def leer():
    texto = db.session.get(SiteText, "cv")
    if texto is None:
        raise CVError('No hay CV en la base de datos (el texto "cv"). Carga la semilla.')
    empleos = {j.slug: j for j in db.session.scalars(select(Job))}
    formacion = {e.slug: e for e in db.session.scalars(select(Education))}
    proyectos = {p.slug: p for p in db.session.scalars(select(Project))}
    enlaces = {link.type.value: link.url for link in db.session.scalars(select(Link))}
    for tipo in ("email", "linkedin", "github"):
        if tipo not in enlaces:
            raise CVError(f"Falta el enlace de {tipo} en el contenido.")
    return texto.value, empleos, formacion, proyectos, enlaces


def preparar(cv, lang, empleos, formacion, proyectos, enlaces):
    """Los datos que pinta la plantilla, en un idioma, con las fechas ya puestas."""
    t = TEXTOS[lang]
    datos = cv[lang]

    lista_proyectos = []
    for p in datos["proyectos"]:
        proyecto = proyectos.get(p["proyecto"])
        if proyecto is None:
            raise CVError(f"El CV usa el proyecto '{p['proyecto']}', que no existe en la web.")
        url = proyecto.repo_url or proyecto.demo_url
        hasta = date.fromisoformat(p["hasta"]) if p.get("hasta") else None
        fechas = rango([date.fromisoformat(p["desde"])], [hasta], t["actualidad"])
        lista_proyectos.append({**p, "fechas": fechas, "enlace": enlace(url) if url else None})

    experiencia = []
    for e in datos["experiencia"]:
        fechas = fechas_de(e["empleos"], empleos, "el empleo", t["actualidad"])
        orden = max(empleos[s].start_date for s in e["empleos"])
        experiencia.append({**e, "fechas": fechas, "_orden": orden})

    educacion = []
    for e in datos["educacion"]:
        fechas = fechas_de([e["formacion"]], formacion, "la formación", t["actualidad"])
        educacion.append({**e, "fechas": fechas, "_orden": formacion[e["formacion"]].start_date})

    # Lo más reciente arriba, sea cual sea el orden en que estén escritos.
    experiencia.sort(key=lambda e: e["_orden"], reverse=True)
    educacion.sort(key=lambda e: e["_orden"], reverse=True)
    lista_proyectos.sort(key=lambda p: p["desde"], reverse=True)

    return {
        "lang": lang,
        "textos": t,
        "cv": datos,
        "proyectos": lista_proyectos,
        "experiencia": experiencia,
        "educacion": educacion,
        "correo": enlaces["email"].removeprefix("mailto:"),
        "linkedin": enlace(enlaces["linkedin"]),
        "github": enlace(enlaces["github"]),
        "web": enlace(WEB_URL),
        "actualizado": mes(date.today()),
        "titulo": f"CV {datos['nombre']} · {datos['rol']}",
    }


# =====================================================================
# PINTAR Y CONVERTIR EN PDF
# =====================================================================

def marcar(texto):
    """**así** → negrita, como en el resto del contenido. El resto se escapa."""
    return Markup(re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html.escape(texto)))


def retrato_duotono(carpeta):
    """La foto en duotono, ya pintada: en gris y con el azul en modo "color", como la web.

    Si se pinta con filtros CSS, Chrome guarda la foto sin comprimir (unos 95 KB). Ya
    pintada como JPEG, la mete tal cual (unos 15 KB)."""

    def lum(c):
        return .3 * c[0] + .59 * c[1] + .11 * c[2]

    def con_luz(c, luz):
        # El modo "color" de CSS: el tono del azul con la luz de la foto.
        d = luz - lum(c)
        c = [x + d for x in c]
        bajo, alto, centro = min(c), max(c), lum(c)
        if bajo < 0:
            c = [centro + (x - centro) * centro / (centro - bajo) for x in c]
        if alto > 255:
            c = [centro + (x - centro) * (255 - centro) / (alto - centro) for x in c]
        return c

    tablas = [[], [], []]
    for gris in range(256):
        azul = con_luz(AZUL, gris)
        for canal in range(3):
            tablas[canal].append(round(gris * (1 - TINTE) + azul[canal] * TINTE))

    foto = Image.open(RETRATO).convert("RGB")
    lado = min(foto.size)
    # El encuadre de la web: centrado en horizontal y la cara arriba (50 % 18 %).
    x = (foto.width - lado) // 2
    y = round((foto.height - lado) * .18)
    gris = foto.crop((x, y, x + lado, y + lado)).resize((320, 320), Image.LANCZOS).convert("L")
    gris = ImageEnhance.Contrast(ImageOps.autocontrast(gris, cutoff=.5)).enhance(1.1)
    color = Image.merge("RGB", [gris.point(t) for t in tablas])
    destino = carpeta / "retrato-cv.jpg"
    color.save(destino, quality=86, optimize=True)
    return destino.as_uri()


def comprobar_recursos():
    if not Path(CHROME).exists():
        raise CVError(f"Hace falta Google Chrome ({CHROME}). Otra ruta: variable CHROME.")
    if any(not (FUENTES / archivo).exists() for archivo, _ in ESTILOS.values()):
        raise CVError("Faltan las fuentes de la web: ejecuta `npm install` en apps/web.")
    if not RETRATO.exists():
        raise CVError(f"Falta el retrato: {RETRATO}.")


def fuentes_fijas(carpeta):
    """Una fuente fija (TrueType) por estilo, sacada de la variable de la web."""
    rutas = {}
    for estilo, (archivo, ejes) in ESTILOS.items():
        fija = instancer.instantiateVariableFont(TTFont(FUENTES / archivo), ejes)
        fija.flavor = None
        destino = carpeta / f"{estilo}.ttf"
        fija.save(destino)
        rutas[estilo] = destino.as_uri()
    return rutas


def a_pdf(pagina_html, destino, carpeta):
    origen = carpeta / f"{destino.stem}.html"
    origen.write_text(pagina_html, encoding="utf-8")
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         "--virtual-time-budget=5000", f"--print-to-pdf={destino}", origen.as_uri()],
        check=True, capture_output=True, timeout=90,
    )


def poner_metadatos(ruta, datos):
    """Título, autor y palabras clave del documento: los leen los ATS y los buscadores."""
    escritor = PdfWriter(clone_from=ruta)
    habilidades = [t for g in datos["cv"]["habilidades"] for t in g["lista"]]
    escritor.add_metadata({
        "/Title": datos["titulo"],
        "/Author": datos["cv"]["nombre"],
        "/Subject": datos["cv"]["rol"],
        "/Keywords": ", ".join(habilidades),
    })
    escritor.write(ruta)


# =====================================================================
# LA PRUEBA ATS
# =====================================================================

def prueba_ats(ruta, datos, telefono):
    """Lee el PDF como un ATS y devuelve la lista de problemas (vacía si está bien)."""
    lector = PdfReader(ruta)
    problemas = []
    if len(lector.pages) != 1:
        problemas.append(f"ocupa {len(lector.pages)} páginas: tiene que caber en una")
    texto = "\n".join(p.extract_text() for p in lector.pages)
    plano = re.sub(r"\s+", " ", texto)
    bajo = plano.lower()

    def donde(fragmento, desde=0):
        return bajo.find(re.sub(r"\s+", " ", fragmento).lower(), desde)

    t = datos["textos"]
    titulos = [t[k] for k in ("perfil", "proyectos", "experiencia", "educacion", "habilidades")]
    posiciones = [donde(x) for x in titulos]
    for titulo, pos in zip(titulos, posiciones):
        if pos < 0:
            problemas.append(f"no se lee el título de sección '{titulo}'")
    if all(p >= 0 for p in posiciones) and posiciones != sorted(posiciones):
        problemas.append("las secciones no salen en orden: el texto se mezcla entre columnas")

    # Cada bloque, dentro de su sección (entre su título y el siguiente).
    tramos = dict(zip(titulos, posiciones + [len(bajo)]))
    for seccion, siguiente, bloques, campo in (
        (t["experiencia"], t["educacion"], datos["experiencia"], "puesto"),
        (t["educacion"], t["habilidades"], datos["educacion"], "titulo"),
    ):
        for b in bloques:
            pos = donde(b[campo], tramos[seccion])
            if not tramos[seccion] < pos < tramos[siguiente]:
                problemas.append(f"'{b[campo]}' no sale dentro de {seccion}")

    obligatorios = [datos["cv"]["nombre"], datos["correo"]]
    obligatorios += [datos["linkedin"]["texto"], datos["github"]["texto"]]
    bloques = datos["experiencia"] + datos["educacion"] + datos["proyectos"]
    obligatorios += [b["fechas"] for b in bloques]
    obligatorios += [p["enlace"]["texto"] for p in datos["proyectos"] if p["enlace"]]
    if telefono:
        obligatorios.append(telefono)
    for fragmento in obligatorios:
        if donde(fragmento) < 0:
            problemas.append(f"no se lee entero: '{fragmento}'")

    # Letras separadas por espacios ("D E S A R R O L L A D O R"): el ATS no las entiende.
    separadas = re.search(r"(?:\b\w ){4,}\w\b", plano)
    if separadas:
        problemas.append(f"letras separadas: '{separadas.group(0)}'")
    return problemas


# =====================================================================
# PRINCIPAL
# =====================================================================

def generar():
    comprobar_recursos()
    telefono = os.getenv("CV_TELEFONO", "").strip()
    entorno = Environment(loader=FileSystemLoader(API / "seed" / "cv"), autoescape=True)
    entorno.filters["marcar"] = marcar
    plantilla = entorno.get_template("plantilla.html")

    with create_app().app_context():
        cv, empleos, formacion, proyectos, enlaces = leer()
        versiones = []
        for lang in ("es", "en"):
            datos = preparar(cv, lang, empleos, formacion, proyectos, enlaces)
            nombre = f"{NOMBRE_ARCHIVO}-{lang.upper()}"
            versiones.append((datos, None, PUBLICOS / f"{nombre}.pdf"))
            if telefono:
                versiones.append((datos, telefono, PRIVADOS / f"{nombre}-con-telefono.pdf"))

    # Primero se generan y se prueban todos en una carpeta temporal. Solo si pasan todos,
    # se copian a su sitio: nunca queda publicado un CV a medias.
    with tempfile.TemporaryDirectory() as tmp:
        carpeta = Path(tmp)
        retrato = retrato_duotono(carpeta)
        fuentes = fuentes_fijas(carpeta)
        listos = []
        for datos, tel, destino in versiones:
            pdf = carpeta / destino.name
            pagina = plantilla.render(
                **datos, telefono=tel, fuentes=fuentes, retrato=retrato
            )
            a_pdf(pagina, pdf, carpeta)
            poner_metadatos(pdf, datos)
            problemas = prueba_ats(pdf, datos, tel)
            if problemas:
                detalle = "\n  ".join(problemas)
                raise CVError(f"{destino.name} no pasa la prueba ATS:\n  {detalle}")
            listos.append((pdf, destino))

        for pdf, destino in listos:
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(pdf, destino)
            ruta = destino.relative_to(API.parent.parent)
            print(f"{ruta}  {destino.stat().st_size // 1024} KB · prueba ATS superada")

    if not telefono:
        print("Sin CV_TELEFONO en .env: solo se han generado las versiones públicas.")


if __name__ == "__main__":
    try:
        generar()
    except CVError as e:
        sys.exit(f"No se ha generado el CV. {e}")
