"""Los textos de la web y el CV en el panel (ADM-04).

Guardar no publica: lo guardado sale en la web con la próxima instantánea (snapshot.py).
Como los textos no tienen borrador, nunca se guarda uno a medio traducir: cada texto que
tiene algo escrito en un idioma tiene que tenerlo también en el otro.

Los textos se validan por su forma: la que ya tienen en la base de datos. Si hero.ficha es
una lista de pares {clave, valor}, lo que se guarde tiene que ser eso. Así no hace falta una
regla escrita a mano por cada texto, y uno nuevo ya sabe validarse.

Los errores van por campo, con la ruta del valor: "hero.ficha.en.2.valor": "falta".
"""

from datetime import date

from flask import jsonify, request
from sqlalchemy import func, select

from .admin import admin, admin_required
from .extensions import db
from .models import Education, Job, Project, SiteText
from .snapshot import generar_instantanea

IDIOMAS = ("es", "en")
CV = "cv"


class Invalido(Exception):
    def __init__(self, errores):
        super().__init__()
        self.errores = errores


def _invalido(error):
    return jsonify(error="validacion", errores=error.errores), 400


def _cadena(valor):
    return valor.strip() if isinstance(valor, str) else None


def _vacio(valor):
    """Nada escrito: ni un texto, ni en ninguno de sus elementos."""
    if isinstance(valor, str):
        return not valor.strip()
    if isinstance(valor, list):
        return all(_vacio(v) for v in valor)
    if isinstance(valor, dict):
        return all(_vacio(v) for v in valor.values())
    return valor is None


def _en_blanco(plantilla):
    """Un elemento vacío con la forma de la plantilla: para emparejar listas de distinto largo."""
    if isinstance(plantilla, str):
        return ""
    if isinstance(plantilla, list):
        return []
    if isinstance(plantilla, dict):
        return {k: _en_blanco(v) for k, v in plantilla.items()}
    return None


# ---------------------------------------------------------------- La forma

def con_forma(plantilla, valor, ruta, errores):
    """El valor limpio (textos sin espacios en los extremos) si tiene la forma de la
    plantilla. Si no, apunta el error en su ruta y devuelve None."""
    if isinstance(plantilla, str):
        texto = _cadena(valor)
        if texto is None:
            errores[ruta] = "forma"
        return texto
    if isinstance(plantilla, list):
        if not isinstance(valor, list):
            errores[ruta] = "forma"
            return None
        # Las listas pueden crecer o encoger: cada elemento, con la forma del primero.
        modelo = plantilla[0] if plantilla else (valor[0] if valor else "")
        return [con_forma(modelo, v, f"{ruta}.{i}", errores) for i, v in enumerate(valor)]
    if isinstance(plantilla, dict):
        if not isinstance(valor, dict) or set(valor) != set(plantilla):
            errores[ruta] = "forma"
            return None
        return {k: con_forma(plantilla[k], valor[k], f"{ruta}.{k}", errores) for k in plantilla}
    errores[ruta] = "forma"
    return None


# ---------------------------------------------------------------- Los dos idiomas

def emparejar(es, en):
    """Las dos listas del mismo largo, y sin los elementos vacíos en los dos idiomas."""
    modelo = (es or en or [""])[0]
    largo = max(len(es), len(en))
    es = es + [_en_blanco(modelo)] * (largo - len(es))
    en = en + [_en_blanco(modelo)] * (largo - len(en))
    quedan = [i for i in range(largo) if not (_vacio(es[i]) and _vacio(en[i]))]
    return [es[i] for i in quedan], [en[i] for i in quedan]


def completos(es, en, ruta, errores, *, libres=()):
    """Los dos idiomas con algo escrito en cada sitio. Devuelve los dos ya emparejados.

    ruta lleva un {lang} donde va el idioma: "hero.ficha.{lang}". libres: claves de un
    diccionario que no se comprueban (se validan aparte).
    """
    if isinstance(es, str):
        for lang, propio, otro in (("es", es, en), ("en", en, es)):
            if not propio:
                errores[ruta.format(lang=lang)] = "falta" if otro else "obligatorio"
        return es, en
    if isinstance(es, list):
        es, en = emparejar(es, en)
        pares = [
            completos(a, b, f"{ruta}.{i}", errores, libres=libres)
            for i, (a, b) in enumerate(zip(es, en))
        ]
        return [a for a, _ in pares], [b for _, b in pares]
    if isinstance(es, dict):
        salida_es, salida_en = {}, {}
        for k in es:
            if k in libres:
                salida_es[k], salida_en[k] = es[k], en[k]
            else:
                salida_es[k], salida_en[k] = completos(
                    es[k], en[k], f"{ruta}.{k}", errores, libres=libres
                )
        return salida_es, salida_en
    return es, en


# ---------------------------------------------------------------- Textos

def _textos():
    filas = db.session.scalars(select(SiteText).where(SiteText.text_key != CV))
    return {t.text_key: t for t in filas}


def _respuesta_textos():
    filas = _textos()
    actualizado = max((t.updated_at for t in filas.values()), default=None)
    return {
        "textos": {clave: t.value for clave, t in sorted(filas.items())},
        "actualizado": actualizado.isoformat() if actualizado else None,
    }


def limpiar_textos(datos, filas):
    errores = {}
    limpios = {}
    if not isinstance(datos, dict) or not datos:
        raise Invalido({"textos": "forma"})
    for clave, valor in datos.items():
        fila = filas.get(clave)
        if fila is None:
            errores[clave] = "no_existe"
            continue
        if not isinstance(valor, dict) or set(valor) != set(IDIOMAS):
            errores[clave] = "forma"
            continue
        # La plantilla es el valor en español que ya está guardado.
        antes = len(errores)
        es = con_forma(fila.value["es"], valor["es"], f"{clave}.es", errores)
        en = con_forma(fila.value["es"], valor["en"], f"{clave}.en", errores)
        if len(errores) > antes:
            continue
        es, en = completos(es, en, f"{clave}.{{lang}}", errores)
        limpios[clave] = {"es": es, "en": en}
    if errores:
        raise Invalido(errores)
    return limpios


@admin.get("/texts")
@admin_required
def ver_textos():
    """Todos los textos de la web, menos el CV (tiene su pantalla)."""
    return jsonify(_respuesta_textos())


@admin.put("/texts")
@admin_required
def guardar_textos():
    """Los textos cambiados: {"textos": {"hero.entradilla": {"es": …, "en": …}}}.
    Se guardan todos o ninguno."""
    datos = (request.get_json(silent=True) or {}).get("textos")
    filas = _textos()
    try:
        limpios = limpiar_textos(datos, filas)
    except Invalido as error:
        return _invalido(error)
    for clave, valor in limpios.items():
        filas[clave].value = valor
    db.session.commit()
    return jsonify(_respuesta_textos())


# ---------------------------------------------------------------- CV

# Lo que no se traduce va en los dos idiomas igual (decidido en ADM-04): se toma del español.
COMPARTIDOS = {
    "proyectos": ("proyecto", "desde", "hasta"),
    "experiencia": ("empleos",),
    "educacion": ("formacion",),
}
CABECERA = ("nombre", "rol", "ubicacion", "perfil")
PLANTILLA_CV = {
    **dict.fromkeys(CABECERA, ""),
    "proyectos": [{"titulo": "", "proyecto": "", "desde": "", "hasta": "", "lugar": "",
                   "descripcion": "", "puntos": [""]}],
    "experiencia": [{"puesto": "", "empresa": "", "lugar": "", "empleos": [""],
                     "descripcion": "", "puntos": [""]}],
    "educacion": [{"titulo": "", "centro": "", "lugar": "", "formacion": ""}],
    "habilidades": [{"grupo": "", "lista": [""]}],
}


def _fecha(texto):
    try:
        return date.fromisoformat(texto)
    except (TypeError, ValueError):
        return None


def _enganches(cv_es, errores):
    """Lo compartido: que exista en la web y que las fechas sean fechas."""
    proyectos = set(db.session.scalars(select(Project.slug)))
    empleos = set(db.session.scalars(select(Job.slug)))
    formacion = set(db.session.scalars(select(Education.slug)))
    for i, p in enumerate(cv_es["proyectos"]):
        if p["proyecto"] not in proyectos:
            errores[f"cv.proyectos.{i}.proyecto"] = "no_existe"
        desde, hasta = _fecha(p["desde"]), _fecha(p["hasta"]) if p["hasta"] else None
        if desde is None:
            errores[f"cv.proyectos.{i}.desde"] = "fecha"
        if p["hasta"] and (hasta is None or (desde and hasta < desde)):
            errores[f"cv.proyectos.{i}.hasta"] = "fecha"
    for i, e in enumerate(cv_es["experiencia"]):
        if not e["empleos"]:
            errores[f"cv.experiencia.{i}.empleos"] = "obligatorio"
        elif not set(e["empleos"]) <= empleos or len(set(e["empleos"])) != len(e["empleos"]):
            errores[f"cv.experiencia.{i}.empleos"] = "no_existe"
    for i, e in enumerate(cv_es["educacion"]):
        if e["formacion"] not in formacion:
            errores[f"cv.educacion.{i}.formacion"] = "no_existe"


def limpiar_cv(datos):
    errores = {}
    if not isinstance(datos, dict) or set(datos) != set(IDIOMAS):
        raise Invalido({"cv": "forma"})
    cv = {lang: con_forma(PLANTILLA_CV, datos[lang], f"cv.{lang}", errores) for lang in IDIOMAS}
    if errores:
        raise Invalido(errores)
    es, en = cv["es"], cv["en"]

    # Cuántos bloques hay también se comparte: el mismo número en los dos idiomas.
    for bloque, claves in COMPARTIDOS.items():
        if len(es[bloque]) != len(en[bloque]):
            errores[f"cv.{bloque}"] = "forma"
            continue
        for a, b in zip(es[bloque], en[bloque]):
            for clave in claves:
                b[clave] = a[clave]
    if len(es["habilidades"]) != len(en["habilidades"]):
        errores["cv.habilidades"] = "forma"
    if errores:
        raise Invalido(errores)

    # Las habilidades son palabras sueltas, en cada idioma las suyas (decidido en ADM-04).
    for grupo in es["habilidades"] + en["habilidades"]:
        grupo["lista"] = [x for x in grupo["lista"] if x]
    libres = {"proyecto", "desde", "hasta", "empleos", "formacion", "lista"}
    for clave in CABECERA:
        es[clave], en[clave] = completos(es[clave], en[clave], f"cv.{{lang}}.{clave}", errores)
    for bloque in ("proyectos", "experiencia", "educacion", "habilidades"):
        # Los bloques no se quitan por estar vacíos: su número es compartido.
        for i, (a, b) in enumerate(zip(es[bloque], en[bloque])):
            es[bloque][i], en[bloque][i] = completos(
                a, b, f"cv.{{lang}}.{bloque}.{i}", errores, libres=libres
            )
    _enganches(es, errores)
    if errores:
        raise Invalido(errores)
    return {"es": es, "en": en}


def _opciones():
    """Lo que el CV puede enganchar, con las fechas que pondrá el generador."""
    def iso(d):
        return d.isoformat() if d else None

    return {
        "proyectos": [
            {"slug": p.slug, "nombre": p.name.get("es") or p.slug}
            for p in db.session.scalars(select(Project).order_by(Project.sort_order, Project.slug))
        ],
        "empleos": [
            {"slug": j.slug, "empresa": j.company, "puesto": j.position.get("es"),
             "desde": iso(j.start_date), "hasta": iso(j.end_date)}
            for j in db.session.scalars(select(Job).order_by(Job.start_date.desc()))
        ],
        "formacion": [
            {"slug": e.slug, "titulo": e.title.get("es"), "desde": iso(e.start_date),
             "hasta": iso(e.end_date)}
            for e in db.session.scalars(
                select(Education).order_by(Education.start_date.desc().nulls_last())
            )
        ],
    }


def _respuesta_cv(fila):
    return {
        "cv": fila.value,
        "opciones": _opciones(),
        "actualizado": fila.updated_at.isoformat(),
    }


@admin.get("/cv")
@admin_required
def ver_cv():
    fila = db.session.get(SiteText, CV)
    if fila is None:
        return jsonify(error="no_existe"), 404
    return jsonify(_respuesta_cv(fila))


@admin.put("/cv")
@admin_required
def guardar_cv():
    """El CV entero, en los dos idiomas: {"cv": {"es": …, "en": …}}."""
    fila = db.session.get(SiteText, CV)
    if fila is None:
        return jsonify(error="no_existe"), 404
    try:
        fila.value = limpiar_cv((request.get_json(silent=True) or {}).get("cv"))
    except Invalido as error:
        return _invalido(error)
    fila.updated_at = func.now()
    db.session.commit()
    return jsonify(_respuesta_cv(fila))


# ---------------------------------------------------------------- Vista previa

@admin.get("/vista-previa")
@admin_required
def vista_previa_textos():
    """Todo el contenido de la web como está guardado, para la vista previa de los textos.
    Los textos que aún no se han guardado los pone encima la propia pantalla del panel."""
    return jsonify(generar_instantanea())
