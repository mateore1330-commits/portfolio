"""Modelos de la base de datos. Traducen docs/MODELO_DATOS.dbml, con sus mismos bloques.

Los campos traducibles son JSONB con forma {"es": ..., "en": ...}. Los valores por
defecto van en la base de datos (server_default), para que valgan también al insertar
con SQL a mano.
"""

import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Index, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .extensions import db


def pg_enum(enum_class, name):
    """Enumerado de Python guardado como tipo nativo de PostgreSQL, con sus valores en minúscula."""
    return Enum(enum_class, name=name, values_callable=lambda e: [m.value for m in e])


def created_at():
    return mapped_column(server_default=func.now())


def updated_at():
    return mapped_column(server_default=func.now(), onupdate=func.now())


# =====================================================================
# ENUMERADOS
# =====================================================================

class ContentStatus(enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class TechCategory(enum.Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    DATA = "data"
    TOOLS = "tools"
    DESIGN = "design"
    SOFT = "soft"


class MediaType(enum.Enum):
    IMAGE = "image"
    VIDEO = "video"


class EducationKind(enum.Enum):
    """Formación: programas largos (bootcamp, FP…). Curso: cortos, de una o dos semanas."""

    PROGRAM = "program"
    COURSE = "course"


class LinkType(enum.Enum):
    GITHUB = "github"
    LINKEDIN = "linkedin"
    EMAIL = "email"
    CV = "cv"
    OTHER = "other"


class MessageStatus(enum.Enum):
    NEW = "new"
    READ = "read"
    REPLIED = "replied"
    SPAM = "spam"


# =====================================================================
# ADMINISTRACIÓN
# =====================================================================

class AdminUser(db.Model):
    __tablename__ = "admin_users"
    # Un CHECK no puede contar filas. Este siempre-true, junto con su UNIQUE,
    # deja una sola plaza: una segunda fila no tiene ningún valor válido.
    __table_args__ = (CheckConstraint("is_singleton", name="singleton"),)

    admin_id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    token_version: Mapped[int] = mapped_column(server_default=text("1"))
    last_login_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = created_at()
    is_singleton: Mapped[bool] = mapped_column(server_default=text("true"), unique=True)


class AuthAttempt(db.Model):
    __tablename__ = "auth_attempts"
    __table_args__ = (Index("idx_attempts_ip_fecha", "ip_address", "created_at"),)

    attempt_id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None]
    ip_address: Mapped[str]
    success: Mapped[bool] = mapped_column(server_default=text("false"))
    created_at: Mapped[datetime] = created_at()


# =====================================================================
# CONTENIDO — PROYECTOS
# =====================================================================

class Project(db.Model):
    __tablename__ = "projects"
    __table_args__ = (
        Index("idx_projects_publicados", "status", "sort_order"),
        CheckConstraint("commits_share BETWEEN 0 AND 100", name="commits_share_porcentaje"),
    )

    project_id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(unique=True)
    status: Mapped[ContentStatus] = mapped_column(
        pg_enum(ContentStatus, "content_status"), server_default="draft"
    )
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))
    is_featured: Mapped[bool] = mapped_column(server_default=text("false"))

    repo_url: Mapped[str | None]
    demo_url: Mapped[str | None]
    # Traducibles: "agosto – octubre 2026" / "August – October 2026".
    period: Mapped[dict | None]
    label: Mapped[dict | None]  # "Proyecto final del bootcamp · En equipo de 4"

    is_team_project: Mapped[bool] = mapped_column(server_default=text("false"))
    team_size: Mapped[int | None]
    commits_share: Mapped[int | None]

    name: Mapped[dict]
    summary: Mapped[dict]
    description: Mapped[dict | None]
    my_role: Mapped[dict | None]
    learning: Mapped[dict | None]

    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    # passive_deletes: el borrado en cascada lo hace PostgreSQL (ON DELETE CASCADE).
    media: Mapped[list["ProjectMedia"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True,
        order_by="ProjectMedia.sort_order",
    )
    technologies: Mapped[list["ProjectTechnology"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True,
        order_by="ProjectTechnology.sort_order",
    )


class ProjectMedia(db.Model):
    __tablename__ = "project_media"

    media_id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.project_id", ondelete="CASCADE")
    )
    url: Mapped[str]
    type: Mapped[MediaType] = mapped_column(
        pg_enum(MediaType, "media_type"), server_default="image"
    )
    is_cover: Mapped[bool] = mapped_column(server_default=text("false"))
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))
    alt: Mapped[dict | None]
    created_at: Mapped[datetime] = created_at()

    project: Mapped[Project] = relationship(back_populates="media")


# =====================================================================
# CONTENIDO — TECNOLOGÍAS
# =====================================================================

class Technology(db.Model):
    """Lista maestra: evita que "React" se escriba distinto en un proyecto y en conocimientos."""

    __tablename__ = "technologies"
    __table_args__ = (CheckConstraint("level BETWEEN 0 AND 100", name="level_porcentaje"),)

    technology_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)  # Clave interna, de un solo idioma
    # Solo si el nombre cambia con el idioma: "Trato con cliente" / "Client relations".
    display_name: Mapped[dict | None]
    category: Mapped[TechCategory] = mapped_column(pg_enum(TechCategory, "tech_category"))
    is_skill: Mapped[bool] = mapped_column(server_default=text("true"))
    level: Mapped[int | None]
    level_label: Mapped[dict | None]
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))


class ProjectTechnology(db.Model):
    __tablename__ = "project_technologies"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True
    )
    # Sin cascada: una tecnología que usa algún proyecto no se puede borrar.
    technology_id: Mapped[int] = mapped_column(
        ForeignKey("technologies.technology_id"), primary_key=True
    )
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))

    project: Mapped[Project] = relationship(back_populates="technologies")
    technology: Mapped[Technology] = relationship()


# =====================================================================
# CONTENIDO — TRAYECTORIA
# =====================================================================

class Job(db.Model):
    __tablename__ = "jobs"

    job_id: Mapped[int] = mapped_column(primary_key=True)
    # Clave corta y fija (wetaxi-madrid): con ella el CV engancha sus fechas a este empleo,
    # aunque la semilla vuelva a crear la fila con otro id.
    slug: Mapped[str] = mapped_column(unique=True)
    company: Mapped[str]
    location: Mapped[str | None]
    start_date: Mapped[date]
    end_date: Mapped[date | None]  # Nulo = actualmente
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))
    is_visible: Mapped[bool] = mapped_column(server_default=text("true"))

    position: Mapped[dict]
    description: Mapped[dict | None]
    achievements: Mapped[dict | None]  # {"es": [...], "en": [...]}
    tools: Mapped[str | None]


class Education(db.Model):
    __tablename__ = "education"
    __table_args__ = (CheckConstraint("hours > 0", name="horas_positivas"),)

    education_id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(unique=True)  # Como en Job: para los enganches del CV
    institution: Mapped[str | None]  # Nulo en la formación por cuenta propia
    location: Mapped[str | None]
    start_date: Mapped[date | None]
    end_date: Mapped[date | None]  # Nulo = en curso
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))
    is_visible: Mapped[bool] = mapped_column(server_default=text("true"))
    kind: Mapped[EducationKind] = mapped_column(
        pg_enum(EducationKind, "education_kind"), server_default="program"
    )
    hours: Mapped[int | None]
    # El certificado: el enlace de verificación (lo más fiable) y/o el archivo (PDF o imagen).
    certificate_url: Mapped[str | None]
    certificate_file: Mapped[str | None]

    title: Mapped[dict]
    description: Mapped[dict | None]


# =====================================================================
# CONTENIDO — TEXTOS Y ENLACES
# =====================================================================

class SiteText(db.Model):
    __tablename__ = "site_texts"

    text_key: Mapped[str] = mapped_column(primary_key=True)  # hero.titular, contacto.cta…
    value: Mapped[dict]
    updated_at: Mapped[datetime] = updated_at()


class Link(db.Model):
    __tablename__ = "links"

    link_id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[LinkType] = mapped_column(pg_enum(LinkType, "link_type"))
    url: Mapped[str]
    label: Mapped[dict | None]
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))
    is_visible: Mapped[bool] = mapped_column(server_default=text("true"))


# =====================================================================
# PUBLICACIÓN
# =====================================================================

class Snapshot(db.Model):
    """Cada "Publicar" deja una fila; la última es la que se incrusta en el build."""

    __tablename__ = "snapshots"

    snapshot_id: Mapped[int] = mapped_column(primary_key=True)
    payload: Mapped[dict]
    # SHA-256 del payload canónico: se calcula al publicar y sirve de ETag en /api/content.
    etag: Mapped[str]
    published_at: Mapped[datetime] = created_at()
    published_by: Mapped[int] = mapped_column(ForeignKey("admin_users.admin_id"))


# =====================================================================
# ENTRADA DE DATOS DESDE LA WEB
# =====================================================================

class ContactMessage(db.Model):
    __tablename__ = "contact_messages"
    __table_args__ = (Index("idx_mensajes_bandeja", "status", "created_at"),)

    message_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str]
    subject: Mapped[str | None]
    message: Mapped[str] = mapped_column(Text)
    locale: Mapped[str | None]
    ip_address: Mapped[str | None]
    user_agent: Mapped[str | None]
    status: Mapped[MessageStatus] = mapped_column(
        pg_enum(MessageStatus, "message_status"), server_default="new"
    )
    # Se guarda ANTES de intentar el envío: si el correo falla, el mensaje no se pierde.
    email_sent: Mapped[bool] = mapped_column(server_default=text("false"))
    # La prueba de que aceptó la política de privacidad (casilla obligatoria): cuándo y
    # qué versión (la fecha de "Actualizado el…" publicada en ese momento). Vacíos en los
    # mensajes anteriores a la casilla.
    privacy_accepted_at: Mapped[datetime | None]
    privacy_version: Mapped[str | None]
    created_at: Mapped[datetime] = created_at()


class ContributionsCache(db.Model):
    """Caché de 24 h. Si GitHub falla, se sirve esta copia aunque esté caducada."""

    __tablename__ = "contributions_cache"

    cache_id: Mapped[int] = mapped_column(primary_key=True)
    github_login: Mapped[str] = mapped_column(unique=True)
    payload: Mapped[dict]
    total_contributions: Mapped[int | None]
    current_streak: Mapped[int | None]
    longest_streak: Mapped[int | None]
    fetched_at: Mapped[datetime] = created_at()


class PageView(db.Model):
    """Sin cookies, sin IP y sin identificar a nadie."""

    __tablename__ = "page_views"
    __table_args__ = (Index("idx_visitas_fecha", "created_at"),)

    view_id: Mapped[int] = mapped_column(primary_key=True)
    path: Mapped[str]
    locale: Mapped[str | None]
    referrer: Mapped[str | None]
    country: Mapped[str | None]
    created_at: Mapped[datetime] = created_at()
