"""La trayectoria en el panel (ADM-06): empleos (jobs) y formación (education).

El mismo patrón que los proyectos (proyectos.py): la lista, crear, editar, ocultar,
borrar y la vista previa. Lo propio de aquí:
- "Hasta" vacío es "actualmente". Un fin anterior al inicio no se guarda.
- Las fechas que se solapan se avisan, nunca se impiden (solaparse es legítimo).
- La clave (slug) se genera al crear y no cambia: el CV se engancha con ella.
- Lo que usa el CV no se puede borrar (decidido en ADM-06); ocultarlo, sí.
- Una entrada oculta se guarda a medias; una visible, completa en los dos idiomas.
"""

from datetime import date

from flask import jsonify, request
from sqlalchemy import select

from .admin import admin, admin_required
from .extensions import db
from .models import Education, EducationKind, Job, SiteText
from .proyectos import IDIOMAS, Invalido, _cadena, _numero, _parrafos, _texto, _url, a_slug
from .snapshot import generar_instantanea


def soltar(url):
    from .medios import soltar as soltar_medio

    soltar_medio(url)

LARGO_SLUG = 80


# ---------------------------------------------------------------- Lo que cambia de un tipo a otro

class Tipo:
    """Lo que distingue empleos de formación: el modelo, sus textos y cómo los engancha el CV."""

    def __init__(self, modelo, pk, titulo, textos, parrafos, bloque_cv, enganche_cv, nombre_cv):
        self.modelo = modelo
        self.pk = pk
        self.titulo = titulo  # el campo traducible que da nombre: position / title
        self.textos = textos
        self.parrafos = parrafos
        self.bloque_cv = bloque_cv  # experiencia / educacion
        self.enganche_cv = enganche_cv  # empleos (lista) / formacion (uno)
        self.nombre_cv = nombre_cv  # puesto / titulo

    def ordenados(self):
        orden = (self.modelo.sort_order, self.modelo.slug)
        return db.session.scalars(select(self.modelo).order_by(*orden)).all()

    def usos_en_cv(self, slug):
        cv = db.session.get(SiteText, "cv")
        bloques = (cv.value.get("es") or {}).get(self.bloque_cv, []) if cv else []
        usos = []
        for b in bloques:
            enganche = b.get(self.enganche_cv)
            if slug == enganche or (isinstance(enganche, list) and slug in enganche):
                usos.append(b.get(self.nombre_cv) or slug)
        return usos


EMPLEOS = Tipo(Job, "job_id", "position", ("position",), ("description", "achievements"),
               "experiencia", "empleos", "puesto")
FORMACION = Tipo(Education, "education_id", "title", ("title",), ("description",),
                 "educacion", "formacion", "titulo")


# ---------------------------------------------------------------- Fechas y solapes

def _fecha(valor):
    """"2026-05" o "2026-05-01" → el día 1 de ese mes. None si viene vacío; False si está mal."""
    texto = _cadena(valor)
    if not texto:
        return None
    try:
        return date.fromisoformat(texto[:7] + "-01")
    except ValueError:
        return False


def _iso(d):
    return d.isoformat() if d else None


def solapes():
    """Los pares de empleos visibles cuyas fechas se pisan. Sin fin = hasta hoy.
    Terminar uno y empezar otro el mismo mes no cuenta: es cambiar de trabajo."""
    empleos = db.session.scalars(
        select(Job).where(Job.is_visible.is_(True)).order_by(Job.start_date)
    ).all()
    hoy = date.today()
    pares = []
    for i, a in enumerate(empleos):
        for b in empleos[i + 1:]:
            if b.start_date < (a.end_date or hoy) and a.start_date < (b.end_date or hoy):
                pares.append([_resumen_solape(a), _resumen_solape(b)])
    return pares


def _resumen_solape(j):
    return {"id": j.job_id, "empresa": j.company, "desde": _iso(j.start_date),
            "hasta": _iso(j.end_date)}


# ---------------------------------------------------------------- Para la respuesta

def _posiciones(tipo):
    return {getattr(o, tipo.pk): i for i, o in enumerate(tipo.ordenados(), start=1)}


def _resumen(tipo, o, posicion):
    base = {
        "id": getattr(o, tipo.pk),
        "slug": o.slug,
        tipo.titulo: getattr(o, tipo.titulo),
        "location": o.location,
        "start_date": _iso(o.start_date),
        "end_date": _iso(o.end_date),
        "is_visible": o.is_visible,
        "posicion": posicion,
    }
    if tipo is EMPLEOS:
        base["company"] = o.company
    else:
        base |= {"institution": o.institution, "kind": o.kind.value, "hours": o.hours,
                 "certificate_url": o.certificate_url, "certificate_file": o.certificate_file}
    return base


def _entero(tipo, o, posicion):
    datos = _resumen(tipo, o, posicion)
    datos |= {campo: getattr(o, campo) for campo in tipo.parrafos}
    if tipo is EMPLEOS:
        datos["tools"] = o.tools
    datos["en_cv"] = tipo.usos_en_cv(o.slug)
    return datos


def _buscar(tipo, ident):
    o = db.session.get(tipo.modelo, ident)
    if o is None:
        return None, (jsonify(error="no_existe"), 404)
    return o, None


# ---------------------------------------------------------------- Limpiar y validar

def limpiar(tipo, datos, actual=None):
    errores = {}
    visible = datos.get("is_visible", True) is True
    campos = {campo: _texto(datos, campo) for campo in tipo.textos}
    campos |= {campo: _parrafos(datos, campo) for campo in tipo.parrafos}

    if not campos[tipo.titulo]["es"]:
        errores[f"{tipo.titulo}.es"] = "obligatorio"
    if visible:
        # Lo visible sale en la web: completo en los dos idiomas.
        for campo in tipo.textos:
            for lang in IDIOMAS:
                if not campos[campo][lang]:
                    errores.setdefault(f"{campo}.{lang}", "falta")
        for campo in tipo.parrafos:
            for lang in IDIOMAS:
                for i, texto in enumerate(campos[campo][lang]):
                    if not texto:
                        errores[f"{campo}.{lang}.{i}"] = "falta"

    desde, hasta = _fecha(datos.get("start_date")), _fecha(datos.get("end_date"))
    if desde is False:
        errores["start_date"] = "fecha"
    if hasta is False:
        errores["end_date"] = "fecha"
    if desde is None and tipo is EMPLEOS:
        errores["start_date"] = "obligatorio"
    if desde is None and hasta:
        errores["start_date"] = "obligatorio"
    if desde and hasta and hasta < desde:
        errores["end_date"] = "antes"

    salida = {
        "is_visible": visible,
        "location": _cadena(datos.get("location")) or None,
        "start_date": desde or None,
        "end_date": hasta or None,
    }

    if tipo is EMPLEOS:
        empresa = _cadena(datos.get("company"))
        if not empresa:
            errores["company"] = "obligatorio"
        salida |= {"company": empresa, "tools": _cadena(datos.get("tools")) or None}
    else:
        tipo_formacion = datos.get("kind", "program")
        if tipo_formacion not in {k.value for k in EducationKind}:
            errores["kind"] = "formato"
            tipo_formacion = "program"
        horas = _numero(datos.get("hours"), 1, 10000)
        if horas is False:
            errores["hours"] = "numero"
        url = _url(datos.get("certificate_url"))
        if url is False:
            errores["certificate_url"] = "url"
        # El archivo solo se puede quitar desde aquí: subirlo llega con ADM-08.
        archivo = datos.get("certificate_file")
        if archivo and archivo != (actual.certificate_file if actual else None):
            errores["certificate_file"] = "formato"
        salida |= {
            "kind": EducationKind(tipo_formacion),
            "institution": _cadena(datos.get("institution")) or None,
            "hours": horas or None,
            "certificate_url": url or None,
            "certificate_file": archivo or None,
        }

    if errores:
        raise Invalido(errores)

    def opcional(valor):
        return valor if any(valor[lang] for lang in IDIOMAS) else None

    salida[tipo.titulo] = campos[tipo.titulo]
    salida |= {campo: opcional(campos[campo]) for campo in tipo.parrafos}
    return salida


# ---------------------------------------------------------------- Guardar

def _clave_nueva(tipo, campos):
    """De la empresa (o del título y el centro) y, si ya existe, con -2, -3…"""
    if tipo is EMPLEOS:
        base = a_slug(campos["company"])
    else:
        base = a_slug(" ".join(filter(None, [campos["title"]["es"], campos.get("institution")])))
    base = (base or "entrada")[:LARGO_SLUG - 3].strip("-")
    existentes = set(db.session.scalars(select(tipo.modelo.slug)))
    clave, n = base, 2
    while clave in existentes:
        clave, n = f"{base}-{n}", n + 1
    return clave


def _al_final(tipo, objeto):
    """Lo nuevo va al final; desde ahí se mueve arrastrando (ADM-09, orden.py)."""
    resto = [o for o in tipo.ordenados() if o is not objeto]
    objeto.sort_order = max((o.sort_order for o in resto), default=-1) + 1


def _aplicar(tipo, objeto, campos):
    nuevo = getattr(objeto, tipo.pk) is None
    # Sin guardar a medias: las consultas de aquí (la clave, el orden) no tienen que escribir
    # un objeto nuevo que todavía no tiene clave.
    with db.session.no_autoflush:
        if nuevo:
            objeto.slug = _clave_nueva(tipo, campos)
        for campo, valor in campos.items():
            setattr(objeto, campo, valor)
        if nuevo:
            _al_final(tipo, objeto)


def _invalido(error):
    return jsonify(error="validacion", errores=error.errores), 400


# ---------------------------------------------------------------- Rutas, para los dos tipos

def _rutas(tipo, prefijo, nombre):
    @admin.get(f"/{prefijo}", endpoint=f"lista_{nombre}")
    @admin_required
    def lista():
        posiciones = _posiciones(tipo)
        filas = [_resumen(tipo, o, posiciones[getattr(o, tipo.pk)]) for o in tipo.ordenados()]
        return jsonify(lista=filas, solapes=solapes() if tipo is EMPLEOS else [])

    @admin.post(f"/{prefijo}", endpoint=f"crear_{nombre}")
    @admin_required
    def crear():
        try:
            campos = limpiar(tipo, request.get_json(silent=True) or {})
        except Invalido as error:
            return _invalido(error)
        objeto = tipo.modelo()
        db.session.add(objeto)
        _aplicar(tipo, objeto, campos)
        db.session.commit()
        return jsonify(_entero(tipo, objeto, _posiciones(tipo)[getattr(objeto, tipo.pk)])), 201

    @admin.get(f"/{prefijo}/<int:ident>", endpoint=f"ver_{nombre}")
    @admin_required
    def ver(ident):
        objeto, falla = _buscar(tipo, ident)
        return falla or jsonify(_entero(tipo, objeto, _posiciones(tipo)[ident]))

    @admin.put(f"/{prefijo}/<int:ident>", endpoint=f"guardar_{nombre}")
    @admin_required
    def guardar(ident):
        objeto, falla = _buscar(tipo, ident)
        if falla:
            return falla
        try:
            campos = limpiar(tipo, request.get_json(silent=True) or {}, actual=objeto)
        except Invalido as error:
            return _invalido(error)
        archivo = getattr(objeto, "certificate_file", None)
        _aplicar(tipo, objeto, campos)
        db.session.commit()
        # Un certificado quitado, fuera de Cloudinary (ya, o al publicar: ADM-08).
        if archivo and archivo != getattr(objeto, "certificate_file", None):
            soltar(archivo)
        datos = _entero(tipo, objeto, _posiciones(tipo)[ident])
        if tipo is EMPLEOS:
            datos["solapes"] = [p for p in solapes() if ident in (p[0]["id"], p[1]["id"])]
        return jsonify(datos)

    @admin.patch(f"/{prefijo}/<int:ident>", endpoint=f"cambiar_{nombre}")
    @admin_required
    def cambiar(ident):
        """Ocultar o mostrar desde la lista. Para mostrarla tiene que estar completa."""
        objeto, falla = _buscar(tipo, ident)
        if falla:
            return falla
        datos = request.get_json(silent=True) or {}
        if set(datos) != {"is_visible"} or not isinstance(datos["is_visible"], bool):
            return jsonify(error="validacion", errores={"is_visible": "formato"}), 400
        if datos["is_visible"]:
            actual = _entero(tipo, objeto, None)
            try:
                limpiar(tipo, {**actual, "is_visible": True}, actual=objeto)
            except Invalido as error:
                return jsonify(error="incompleto", errores=error.errores), 400
        objeto.is_visible = datos["is_visible"]
        db.session.commit()
        return jsonify(_resumen(tipo, objeto, _posiciones(tipo)[ident]))

    @admin.delete(f"/{prefijo}/<int:ident>", endpoint=f"borrar_{nombre}")
    @admin_required
    def borrar(ident):
        objeto, falla = _buscar(tipo, ident)
        if falla:
            return falla
        usos = tipo.usos_en_cv(objeto.slug)
        if usos:
            return jsonify(error="en_cv", usos=usos), 409
        archivo = getattr(objeto, "certificate_file", None)
        db.session.delete(objeto)
        db.session.flush()
        for i, o in enumerate(tipo.ordenados()):
            o.sort_order = i
        db.session.commit()
        soltar(archivo)
        return jsonify(ok=True)

    @admin.get(f"/{prefijo}/<int:ident>/vista-previa", endpoint=f"vista_previa_{nombre}")
    @admin_required
    def vista_previa(ident):
        """Todo el contenido de la web con esta entrada, aunque esté oculta (con lo guardado)."""
        objeto, falla = _buscar(tipo, ident)
        if falla:
            return falla
        clave = "empleo" if tipo is EMPLEOS else "formacion"
        return jsonify(contenido=generar_instantanea(**{clave: ident}))


_rutas(EMPLEOS, "jobs", "empleos")
_rutas(FORMACION, "education", "formacion")
