"""La bandeja de mensajes del panel (ADM-10): leerlos, cambiarles el estado, borrarlos y
reintentar los avisos por correo que fallaron.

El panel no envía correos a quien escribe (decidido en ADM-00): se responde desde el correo
de Mateo y aquí solo se marca como respondido. Los mensajes se borran solos a los 12 meses
(`pipenv run borrar-mensajes-antiguos`), como dice la Privacidad.
"""

from flask import jsonify, request
from sqlalchemy import func, select

from .admin import admin, admin_required
from .contacto import avisar
from .correo import configurado
from .extensions import db
from .models import ContactMessage, MessageStatus

ESTADOS = {e.value: e for e in MessageStatus}


def _mensaje(m):
    return {
        "id": m.message_id,
        "nombre": m.name,
        "correo": m.email,
        "asunto": m.subject,
        "mensaje": m.message,
        "idioma": m.locale,
        "estado": m.status.value,
        "aviso_enviado": m.email_sent,
        "privacidad_version": m.privacy_version,
        "privacidad_fecha": m.privacy_accepted_at.isoformat() if m.privacy_accepted_at else None,
        "fecha": m.created_at.isoformat(),
    }


def _cuantos():
    """{"new": 2, "read": 0, …, "todos": 4}: el número de cada filtro."""
    filas = db.session.execute(
        select(ContactMessage.status, func.count()).group_by(ContactMessage.status)
    ).all()
    cuantos = {e.value: 0 for e in MessageStatus} | {estado.value: n for estado, n in filas}
    return cuantos | {"todos": sum(n for _, n in filas)}


def _avisos_fallidos():
    """Los mensajes cuyo aviso por correo no llegó a enviarse (los que no son spam)."""
    return db.session.scalars(
        select(ContactMessage)
        .where(ContactMessage.email_sent.is_(False), ContactMessage.status != MessageStatus.SPAM)
        .order_by(ContactMessage.created_at)
    ).all()


def _bandeja():
    return {
        "cuantos": _cuantos(),
        "fallidos": [
            {"id": m.message_id, "nombre": m.name, "fecha": m.created_at.isoformat()}
            for m in _avisos_fallidos()
        ],
    }


def _buscar(ident):
    m = db.session.get(ContactMessage, ident)
    if m is None:
        return None, (jsonify(error="no_existe"), 404)
    return m, None


@admin.get("/messages")
@admin_required
def bandeja():
    """La bandeja, de los más nuevos a los más viejos. ?estado=new|read|replied|spam (sin él,
    todos). Con el número de cada filtro y los avisos que fallaron."""
    estado = request.args.get("estado")
    consulta = select(ContactMessage).order_by(ContactMessage.created_at.desc())
    if estado:
        if estado not in ESTADOS:
            return jsonify(error="validacion", errores={"estado": "formato"}), 400
        consulta = consulta.where(ContactMessage.status == ESTADOS[estado])
    lista = [_mensaje(m) for m in db.session.scalars(consulta)]
    return jsonify(lista=lista, **_bandeja())


@admin.patch("/messages/<int:ident>")
@admin_required
def cambiar_estado(ident):
    """{"estado": "read" | "new" | "replied" | "spam"}."""
    m, falla = _buscar(ident)
    if falla:
        return falla
    datos = request.get_json(silent=True) or {}
    if set(datos) != {"estado"} or datos["estado"] not in ESTADOS:
        return jsonify(error="validacion", errores={"estado": "formato"}), 400
    m.status = ESTADOS[datos["estado"]]
    db.session.commit()
    return jsonify(mensaje=_mensaje(m), **_bandeja())


@admin.delete("/messages/<int:ident>")
@admin_required
def borrar_mensaje(ident):
    """Para siempre (el panel lo confirma antes)."""
    m, falla = _buscar(ident)
    if falla:
        return falla
    db.session.delete(m)
    db.session.commit()
    return jsonify(ok=True, **_bandeja())


@admin.post("/messages/reenviar")
@admin_required
def reenviar_avisos():
    """Vuelve a mandar los avisos por correo que fallaron (lo de `reenviar-avisos`)."""
    if not configurado():
        return jsonify(error="sin_correo"), 503
    pendientes = [m.message_id for m in _avisos_fallidos()]
    enviados = sum(avisar(ident) for ident in pendientes)
    return jsonify(pendientes=len(pendientes), enviados=enviados, **_bandeja())
