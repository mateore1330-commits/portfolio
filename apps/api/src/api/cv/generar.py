"""El CV en PDF, en español y en inglés, desde la base de datos.

Lo usan el comando `pipenv run generar-cv` (seed/generar_cv.py, escribe los archivos) y
el panel al publicar o al probar el PDF (ADM-05, los guarda en la base de datos).
Necesita Google Chrome y las fuentes de la web (npm install en apps/web). En el servidor
(INFRA-03), la imagen de Docker trae Chromium, las fuentes y el retrato, y dice dónde con
CHROME, CV_FUENTES y CV_RETRATO.

- Los textos son los del CV (el texto "cv" del contenido): resumidos y adaptados a las
  ofertas, no una copia de la web.
- Las fechas NO se escriben en el CV: cada bloque está enganchado a uno o varios empleos o
  formaciones de la web y toma de ellos el inicio y el fin. Así siempre coinciden.
- Lo convierte en PDF con Chrome sin ventana y después lo lee como lo haría un ATS (los
  programas que filtran candidaturas). Aquí no se decide qué hacer si falla: se devuelven
  los problemas y quien llama decide.
"""

import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
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

from ..extensions import db
from ..models import Education, Job, Link, Project, SiteText

# Este archivo está en apps/api/src/api/cv/: subiendo cuatro niveles, apps/.
APPS = Path(__file__).resolve().parents[4]
WEB = APPS / "web"
PLANTILLAS = Path(__file__).resolve().parent
IDIOMAS = ("es", "en")
NOMBRE_ARCHIVO = "CV-Mateo-Rodriguez-Escobar"
CHROME = os.getenv("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
FUENTES = Path(os.getenv("CV_FUENTES") or WEB / "node_modules" / "@fontsource-variable")
RETRATO = Path(os.getenv("CV_RETRATO") or WEB / "src" / "recursos" / "retrato" / "retrato-400.jpg")
# Dentro de un contenedor, Chromium no puede usar su "sandbox" (le faltan permisos del sistema).
# Se apaga solo ahí (CV_CHROME_SIN_SANDBOX=1): la página que abre la genera la propia API con el
# contenido de la base, no es una web de fuera.
SIN_SANDBOX = os.getenv("CV_CHROME_SIN_SANDBOX") == "1"
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
    orden = [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
             "--virtual-time-budget=5000", f"--print-to-pdf={destino}", origen.as_uri()]
    if SIN_SANDBOX:
        orden[1:1] = ["--no-sandbox", "--disable-dev-shm-usage"]
    subprocess.run(orden, check=True, capture_output=True, timeout=90)


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

@dataclass
class PDF:
    """Un CV ya generado y probado. problemas: lo que falla en la prueba ATS (vacío si pasa)."""

    lang: str
    contenido: bytes
    paginas: int
    problemas: list
    telefono: str | None = None

    @property
    def nombre(self):
        extra = "-con-telefono" if self.telefono else ""
        return f"{NOMBRE_ARCHIVO}-{self.lang.upper()}{extra}.pdf"


def datos_cv():
    """Lo que pinta la plantilla, en los dos idiomas. Dentro de un contexto de la aplicación."""
    cv, empleos, formacion, proyectos, enlaces = leer()
    return {lang: preparar(cv, lang, empleos, formacion, proyectos, enlaces) for lang in IDIOMAS}


def huella(datos):
    """Cambia si cambia algo que sale en el PDF: el CV y lo que engancha (fechas, enlaces).
    Sin el mes de "Actualizado": si no, cada mes el CV contaría como cambiado."""
    sin_mes = {
        lang: {k: v for k, v in d.items() if k != "actualizado"} for lang, d in datos.items()
    }
    texto = json.dumps(sin_mes, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(texto.encode()).hexdigest()


def generar_pdfs(datos, telefono=None):
    """Los PDF de cada idioma (y con teléfono, si lo hay), con su prueba ATS hecha.
    No escribe nada fuera de una carpeta temporal."""
    comprobar_recursos()
    entorno = Environment(loader=FileSystemLoader(PLANTILLAS), autoescape=True)
    entorno.filters["marcar"] = marcar
    plantilla = entorno.get_template("plantilla.html")

    resultados = []
    with tempfile.TemporaryDirectory() as tmp:
        carpeta = Path(tmp)
        retrato = retrato_duotono(carpeta)
        fuentes = fuentes_fijas(carpeta)
        for lang, d in datos.items():
            for tel in (None, telefono) if telefono else (None,):
                pdf = PDF(lang, b"", 0, [], tel)
                ruta = carpeta / pdf.nombre
                pagina = plantilla.render(**d, telefono=tel, fuentes=fuentes, retrato=retrato)
                a_pdf(pagina, ruta, carpeta)
                poner_metadatos(ruta, d)
                pdf.problemas = prueba_ats(ruta, d, tel)
                pdf.paginas = len(PdfReader(ruta).pages)
                pdf.contenido = ruta.read_bytes()
                resultados.append(pdf)
    return resultados
