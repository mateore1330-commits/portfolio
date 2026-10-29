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
scripts/    Utilidades: comprobar idiomas, instantáneas, CV en PDF
```

## Arrancar en local

Necesitas Node 24, Python 3.13 con Pipenv y PostgreSQL 18. En macOS:
`brew install node@24 python@3.13 pipenv postgresql@18`.

**1. Base de datos.** PostgreSQL se arranca a mano y se para al terminar:

```bash
brew services run postgresql@18      # arrancar (no se queda configurado al encender el equipo)
psql -d postgres -c "CREATE ROLE portfolio LOGIN PASSWORD 'elige-una' NOSUPERUSER"
psql -d postgres -c "CREATE DATABASE portfolio OWNER portfolio"
```

**2. API** (`http://localhost:3001`):

```bash
cd apps/api
pipenv install --dev
cp .env.example .env                 # rellena las variables; cada una explica qué es
pipenv run flask --app wsgi db upgrade
pipenv run seed                      # carga el contenido de seed/*.json
pipenv run dev
```

La semilla se puede ejecutar todas las veces que haga falta: deja la base de datos igual
que los JSON y, si algo falla, no cambia nada. Con `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el
`.env` crea también el usuario del panel, solo si todavía no existe.

**3. Web** (`http://localhost:3000`):

```bash
cd apps/web
npm install
npm run dev
```

**Publicar y congelar el contenido.** La web lleva dentro una instantánea del contenido
(`apps/web/src/content/snapshot.json`), y por eso se ve entera aunque la API esté caída.

```bash
cd apps/api && pipenv run publicar                         # guarda una instantánea nueva si hay cambios
cd apps/web && CONTENT_API_URL=http://localhost:3001 npm run build   # la trae de la API y actualiza snapshot.json
```

Sin `CONTENT_API_URL`, o si la API no contesta, el build avisa y usa la instantánea que ya
está en el repo: nunca falla por eso. Para que la nueva quede como respaldo, se commitea
`snapshot.json`.

**Antes de abrir un PR**, desde la raíz: `npm run check` comprueba las dos aplicaciones.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md) — decisiones técnicas y por qué
- [Modelo de datos](docs/MODELO_DATOS.dbml) — esquema en DBML, se pega en dbdiagram.io
- [Backlog](docs/BACKLOG.md) — las épicas y su reparto entre v1 y v2

## Estado

En construcción. El avance se sigue en los issues.
