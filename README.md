# mateorodriguez.solutions

Mi portfolio. Está hecho a medida en vez de con una plantilla, y el código es público
porque la forma de trabajar también cuenta.

## Qué es

Una web estática en React con una API propia en Flask detrás. El contenido —proyectos,
experiencia, formación— **no está escrito en el código**: vive en PostgreSQL y se edita
desde un panel de administración.

La regla que manda sobre el resto del diseño:

> **La web se ve entera, completa y correcta aunque la API esté caída.**

El backend solo añade. Cada build congela una instantánea del contenido dentro del
bundle; si la API responde, se sustituye por datos frescos, y si no, nadie se entera.

## Estructura

```
apps/web    React 18 · Vite · React Router · GSAP        → Vercel
apps/api    Flask · SQLAlchemy · PostgreSQL · Gunicorn   → VPS propio
docs/       Arquitectura, modelo de datos y backlog
scripts/    Utilidades: semilla, instantáneas, CV en PDF
```

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md) — decisiones técnicas y por qué
- [Modelo de datos](docs/MODELO_DATOS.dbml) — esquema en DBML, se pega en dbdiagram.io
- [Backlog](docs/BACKLOG.md) — las épicas y su reparto entre v1 y v2

## Estado

En construcción. El avance se sigue en los issues.
