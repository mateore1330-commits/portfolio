"""El panel de administración: entrar, salir y saber si hay sesión (ADM-01), y el resumen
del Inicio (ADM-02). Las rutas de cada pantalla van en su módulo (proyectos.py, ADM-03).

La sesión es un JWT en una cookie httpOnly (ver config.py). Cada pase lleva dentro la
`token_version` del administrador: si cambia (al salir o al cambiar la contraseña),
todos los pases anteriores dejan de valer, en cualquier dispositivo.

Lo que nunca pasa: la contraseña no se guarda en claro, no se registra en ningún sitio y
no viaja más que en la propia petición de entrar.
"""

from datetime import UTC, datetime, timedelta
from functools import wraps

import bcrypt
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_csrf_token,
    get_jwt,
    get_jwt_identity,
    set_access_cookies,
    unset_jwt_cookies,
    verify_jwt_in_request,
)
from sqlalchemy import func, select

from .extensions import db
from .models import (
    AdminUser,
    AuthAttempt,
    ContactMessage,
    ContentStatus,
    Education,
    Job,
    MessageStatus,
    Project,
    Snapshot,
    Technology,
)

admin = Blueprint("admin", __name__, url_prefix="/api/admin")
jwt = JWTManager()

INTENTOS_MAXIMOS = 5
VENTANA = timedelta(minutes=15)

# Un hash de verdad (coste 12) contra el que se compara cuando el correo no existe: así la
# respuesta tarda lo mismo que con un correo real y nadie puede adivinar cuál es por el tiempo.
_HASH_FALSO = None


def _hash_falso():
    global _HASH_FALSO
    if _HASH_FALSO is None:
        _HASH_FALSO = bcrypt.hashpw(b"no-es-ninguna-contrasena", bcrypt.gensalt(rounds=12))
    return _HASH_FALSO


def _ip():
    # La IP real llega por el proxy del servidor (X-Forwarded-For); se configura en INFRA.
    return request.remote_addr or "desconocida"


def _bloqueada(ip):
    """5 intentos fallidos desde la misma IP en los últimos 15 minutos (ventana deslizante)."""
    desde = datetime.now(UTC) - VENTANA
    fallidos = db.session.scalar(
        select(func.count())
        .select_from(AuthAttempt)
        .where(
            AuthAttempt.ip_address == ip,
            AuthAttempt.success.is_(False),
            AuthAttempt.created_at > desde,
        )
    )
    return fallidos >= INTENTOS_MAXIMOS


def _respuesta_sin_sesion(motivo):
    respuesta = jsonify(error=motivo)
    unset_jwt_cookies(respuesta)
    return respuesta, 401


# ---------------------------------------------------------------- El portero

@jwt.token_in_blocklist_loader
def _pase_revocado(_cabecera, contenido):
    """Un pase vale solo si su versión es la actual del administrador."""
    admin_user = db.session.get(AdminUser, int(contenido["sub"]))
    return admin_user is None or contenido.get("v") != admin_user.token_version


@jwt.expired_token_loader
def _caducado(_cabecera, _contenido):
    return _respuesta_sin_sesion("sesion_caducada")


@jwt.revoked_token_loader
@jwt.invalid_token_loader
@jwt.unauthorized_loader
def _sin_sesion(*_):
    # Sin cookie, cookie manipulada, pase revocado o sin el código CSRF: lo mismo para todos.
    return _respuesta_sin_sesion("sin_sesion")


def admin_required(vista):
    """Para cada ruta del panel: pase válido, sin caducar, de la versión actual y, si la
    petición cambia algo, con su código CSRF."""
    @wraps(vista)
    def envoltura(*args, **kwargs):
        verify_jwt_in_request()
        return vista(*args, **kwargs)
    return envoltura


def _datos_de_sesion(pase, caduca):
    return {"ok": True, "csrf": get_csrf_token(pase), "caduca": caduca.isoformat()}


# ---------------------------------------------------------------- Rutas

@admin.post("/login")
def login():
    """Entrar. 200 con la cookie · 401 correo o contraseña mal · 429 demasiados intentos."""
    ip = _ip()
    if _bloqueada(ip):
        respuesta = jsonify(error="demasiados_intentos")
        respuesta.headers["Retry-After"] = str(int(VENTANA.total_seconds()))
        return respuesta, 429

    datos = request.get_json(silent=True) or {}
    correo = datos.get("correo")
    contrasena = datos.get("contrasena")
    correo = correo.strip().lower()[:254] if isinstance(correo, str) else ""
    contrasena = contrasena.encode("utf-8") if isinstance(contrasena, str) else b""

    admin_user = None
    if correo:
        admin_user = db.session.scalar(select(AdminUser).where(AdminUser.email == correo))
    guardado = admin_user.password_hash.encode("ascii") if admin_user else _hash_falso()
    # bcrypt solo mira los primeros 72 bytes: más largas, se rechazan sin comparar.
    acierta = bool(contrasena) and len(contrasena) <= 72 and bcrypt.checkpw(contrasena, guardado)
    acierta = acierta and admin_user is not None

    db.session.add(AuthAttempt(email=correo or None, ip_address=ip, success=acierta))
    if not acierta:
        db.session.commit()
        return jsonify(error="credenciales"), 401

    admin_user.last_login_at = datetime.now(UTC)
    db.session.commit()
    pase = create_access_token(
        identity=str(admin_user.admin_id), additional_claims={"v": admin_user.token_version}
    )
    caduca = datetime.now(UTC) + current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]
    respuesta = jsonify(_datos_de_sesion(pase, caduca))
    set_access_cookies(respuesta, pase)
    return respuesta


@admin.get("/sesion")
@admin_required
def sesion():
    """¿Hay sesión? La usa la web al abrir el panel; devuelve también el código CSRF."""
    pase = request.cookies.get(current_app.config["JWT_ACCESS_COOKIE_NAME"])
    caduca = datetime.fromtimestamp(get_jwt()["exp"], UTC)
    admin_user = db.session.get(AdminUser, int(get_jwt_identity()))
    return jsonify({**_datos_de_sesion(pase, caduca), "correo": admin_user.email})


@admin.post("/logout")
@admin_required
def logout():
    """Salir: sube token_version, así se cierran todas las sesiones, en todos los dispositivos."""
    admin_user = db.session.get(AdminUser, int(get_jwt_identity()))
    admin_user.token_version += 1
    db.session.commit()
    respuesta = jsonify(ok=True)
    unset_jwt_cookies(respuesta)
    return respuesta


def _contar(modelo, *condiciones):
    return db.session.scalar(select(func.count()).select_from(modelo).where(*condiciones))


def _visibles_y_ocultos(modelo):
    ocultos = _contar(modelo, modelo.is_visible.is_(False))
    return {"visibles": _contar(modelo) - ocultos, "ocultos": ocultos}


@admin.get("/resumen")
@admin_required
def resumen():
    """Lo que enseña el Inicio del panel, en una sola petición. Las visitas (ADM-10) y los
    cambios sin publicar (ADM-05) se añadirán aquí cuando existan."""
    ultimos = db.session.scalars(
        select(ContactMessage)
        .where(ContactMessage.status != MessageStatus.SPAM)
        .order_by(ContactMessage.created_at.desc())
        .limit(2)
    )
    ultima = db.session.scalar(select(func.max(Snapshot.published_at)))
    return jsonify({
        "mensajes": {
            "sin_leer": _contar(ContactMessage, ContactMessage.status == MessageStatus.NEW),
            "ultimos": [
                {
                    "nombre": m.name,
                    "asunto": m.subject,
                    "fecha": m.created_at.isoformat(),
                    "sin_leer": m.status == MessageStatus.NEW,
                }
                for m in ultimos
            ],
        },
        "contenido": {
            "proyectos": {
                "publicados": _contar(Project, Project.status == ContentStatus.PUBLISHED),
                "borradores": _contar(Project, Project.status == ContentStatus.DRAFT),
            },
            "empleos": _visibles_y_ocultos(Job),
            "formacion": _visibles_y_ocultos(Education),
            # Los de la sección Conocimientos (las de solo etiquetar proyectos no salen ahí).
            "conocimientos": _contar(Technology, Technology.is_skill.is_(True)),
        },
        "ultima_publicacion": ultima.isoformat() if ultima else None,
    })


def iniciar(app):
    """Engancha el panel a la aplicación (lo llama create_app)."""
    # Las rutas de cada pantalla se añaden al blueprint al importarlas: antes de registrarlo.
    from . import proyectos  # noqa: F401

    jwt.init_app(app)
    app.register_blueprint(admin)
