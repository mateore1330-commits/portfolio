# Arquitectura — Portfolio de Mateo Rodríguez

Decidido el 26 de octubre de 2026. Fase 3 del plan.

---

## 1. Decisiones tomadas

| Decisión | Elegido | Consecuencia |
|---|---|---|
| Arquitectura | **Full-stack**: React estático + API Flask + panel de administración | El portfolio es también un proyecto que enseñar |
| Idiomas | **Español e inglés** | Todo el contenido por duplicado; rutas `/` y `/en` |
| Contacto | **Formulario + correo visible** | Backend, antispam y envío de correo |
| Hosting front | Vercel (plan Hobby) | Gratis y permitido: portfolio personal, no comercial |
| Hosting API | **VPS propio (Hetzner CX23)** | ~5-6 €/mes. Se administra entero |
| Base de datos | PostgreSQL en el mismo VPS | En contenedor, con backups automáticos |
| Repositorio | Público, monorepo | `apps/web` + `apps/api` en el mismo sitio |

## 2. La regla que manda sobre todas las demás

> **La web se ve entera, completa y correcta aunque la API esté caída.**

El backend **solo añade**, nunca condiciona. Esto no es una preferencia: es lo que convierte
un riesgo en un detalle.

Cómo se cumple, pieza por pieza:

- **Gráfico de contribuciones.** En cada build se congela una instantánea en JSON dentro del
  bundle. La página la pinta de inmediato y, si la API contesta, la sustituye por los datos
  frescos. Si no contesta, nadie se entera.
- **Formulario de contacto.** Si la API no responde en 5 segundos, el formulario se
  reemplaza por el enlace de correo con el asunto ya puesto. El visitante nunca ve un error.
- **Contador de visitas.** Es un dato interno, no se muestra en la web. Si falla, no pasa nada.
- **Nada más depende del backend.** Textos, proyectos, experiencia y formación son estáticos.

## 3. Frontend

**Stack:** React 18 · Vite · React Router · GSAP + ScrollTrigger · React Bits · CSS propio

- **CSS propio con tokens**, sin framework. La identidad "plano y plata" ya está definida en
  la maqueta: gris mineral `#E4E2DC`, azul de plano `#1E3FB0`, Archivo + Newsreader +
  JetBrains Mono. Se traslada tal cual.
- **Animaciones con GSAP + ScrollTrigger**. React Bits aporta el Dot Grid del contacto y
  el Scroll Stack de los proyectos; el resto se porta de la maqueta.
- **Idiomas por prefijo de ruta**: `/` en español, `/en` en inglés. Mejor para SEO que un
  parámetro, y permite enlazar directamente a la versión inglesa.
- **Sin librería de i18n.** Dos ficheros `es.json` / `en.json` y un contexto de veinte líneas.
  Para una web de una página, `react-i18next` es más peso del que resuelve.
- **El contenido no está en los componentes**: viene de una instantánea JSON generada desde la
  base de datos (ver sección 4 bis). De ahí sale también el PDF del CV, así nunca se desincroniza.

## 4. Backend

**Stack:** Flask · SQLAlchemy · Flask-Migrate (Alembic) · PostgreSQL · Gunicorn · Python 3.13

Cuatro endpoints. Ni uno más.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/health` | Comprobación de vida |
| GET | `/api/contributions` | Gráfico de GitHub real, cacheado |
| POST | `/api/contact` | Recibe el formulario |
| GET | `/api/admin/messages` | Mensajes recibidos (protegido) |

### `/api/contributions`

La API REST de GitHub **no expone las contribuciones**: hay que usar la GraphQL
(`contributionsCollection`), y exige token. Por eso vive en el backend y no en el navegador.

- Token en variable de entorno, nunca en el repo.
- **Caché en base de datos con 24 h de validez.** Una llamada al día a GitHub, no una por visita.
- Si GitHub falla, devuelve la última copia buena aunque esté caducada.

### `/api/contact`

- Validación en servidor (nunca confiar en la del navegador).
- **Antispam en tres capas**: campo trampa oculto, tiempo mínimo de relleno y rate limit por IP.
- Guarda en base de datos **y** envía aviso por correo. Si el correo falla, el mensaje ya está
  guardado: no se pierde nada.
- Rate limit: 3 envíos por IP y hora.

### Tablas

```
contact_messages    id, nombre, email, asunto, mensaje, ip, user_agent, leido, creado_en
contributions_cache id, payload (JSON), total, racha_actual, racha_max, actualizado_en
page_views          id, ruta, idioma, referrer, pais, creado_en
```


## 4 bis. Contenido editable y panel de administración

El contenido de la web (proyectos, experiencia, formación, conocimientos y los textos de cada
sección) **no se escribe en el código**: se gestiona desde un panel de administración y vive en
PostgreSQL. Mateo puede añadir un proyecto nuevo sin tocar un fichero ni desplegar a mano.

### El flujo de publicación

```
  Admin edita  ──>  PostgreSQL  ──>  "Publicar"  ──>  instantánea JSON
                                                            │
                                            ┌───────────────┴───────────────┐
                                            ▼                               ▼
                                    Vercel reconstruye              La API la sirve
                                    (JSON en el bundle)             en /api/content
                                            │                               │
                                            └──────────> La web ◀───────────┘
                                         pinta el bundle al instante
                                     y lo sustituye si la API contesta
```

**La base de datos es la fuente para editar; el bundle es la fuente para servir.** Por eso la
regla de la sección 2 sigue intacta: con la API caída se ve el contenido de la última
publicación, nunca una página rota.

### Modelo de datos

Los campos traducibles se guardan como **JSONB** con forma `{"es": "...", "en": "..."}`, en lugar
de tablas de traducción aparte. Menos tablas, ningún `JOIN` extra, y añadir un tercer idioma
mañana no cuesta una migración por tabla.

```
admin_user        id, email, password_hash, token_version, creado_en      (un único usuario)
projects          id, slug, orden, estado(borrador|publicado), destacado,
                  repo_url, demo_url, stack[], periodo,
                  nombre JSONB, resumen JSONB, descripcion JSONB,
                  mi_rol JSONB, aprendizaje JSONB
project_media     id, project_id, url, orden, alt JSONB
jobs              id, orden, empresa, ubicacion, desde, hasta,
                  puesto JSONB, descripcion JSONB, logros JSONB
education         id, orden, centro, desde, hasta, titulo JSONB, descripcion JSONB
skills            id, grupo, nombre, nivel, orden
site_text         clave, valor JSONB            (hero, sobre mí, contacto, pie…)
links             id, tipo, url, orden          (github, linkedin, cv…)
snapshots         id, payload JSONB, publicado_en, publicado_por
```

El estado `borrador | publicado` permite preparar un proyecto con calma sin que aparezca en la
web hasta que se quiera.

**Las imágenes van a Cloudinary**, no al VPS: ya se usó en CleanFlow, el plan gratuito sobra para
unas decenas de capturas, optimiza y redimensiona solo, y no entra en el disco ni en los backups
del servidor. En base de datos se guarda la URL.

### Reparto en dos entregas

El panel completo retrasaría el envío varias semanas, así que se parte:

| | v1 — lo que se envía | v2 — después |
|---|---|---|
| Web pública | Completa, bilingüe | — |
| Contenido | Ya en PostgreSQL | — |
| Admin | Login · proyectos · textos de sección · publicar | Experiencia · formación · conocimientos · enlaces |
| Imágenes | URL pegada a mano | Subida a Cloudinary desde el panel |
| Orden | Campo numérico | Reordenar arrastrando |
| Mensajes | Llegan por correo | Bandeja dentro del panel |
| Visitas | Se registran en BD | Vista con gráficas |

Experiencia, formación y conocimientos se cargan en v1 con un script de semilla: son datos que no
cambian cada semana, y no justifican retrasar la entrega por tener su formulario.

### Endpoints que añade

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/content` | Contenido publicado, en los dos idiomas |
| POST | `/api/admin/login` | Entrada al panel |
| CRUD | `/api/admin/projects` · `/jobs` · `/education` · `/skills` · `/texts` · `/links` | Gestión del contenido |
| POST | `/api/admin/media` | Subida de imágenes a Cloudinary *(v2)* |
| POST | `/api/admin/publish` | Genera la instantánea y lanza el redespliegue |
| GET | `/api/admin/messages` | Bandeja de mensajes del formulario |

### Seguridad del panel

Un solo usuario. Aun así, es la parte más atacable de todo el proyecto:

- JWT en cookie `httpOnly` y contraseña con bcrypt (coste 12), como en CleanFlow.
- `token_version` para revocar sesiones al cambiar la contraseña.
- Rate limit en el login y registro de intentos fallidos.
- Validación de tipo y tamaño en la subida de imágenes; servidas desde un dominio aparte.
- `/admin` excluido de los buscadores.

## 5. Despliegue e infraestructura

```
GitHub (monorepo, público)
   │
   ├── apps/web  →  Vercel (Hobby, gratis)        mateorodriguez.solutions
   │
   └── apps/api  →  VPS Hetzner CX23              api.mateorodriguez.solutions
                    2 vCPU · 4 GB RAM · 40 GB NVMe · ~5-6 €/mes
```

El VPS no duerme, así que desaparece la acción programada para despertarlo. La regla de la
sección 2 sigue vigente de todas formas: si el servidor se cae, la web se ve igual.

### Qué corre en la máquina

Tres contenedores con Docker Compose:

| Contenedor | Qué es | Expuesto |
|---|---|---|
| `caddy` | Proxy inverso y TLS automático de Let's Encrypt | 80, 443 |
| `api` | Flask bajo Gunicorn | Solo red interna |
| `db` | PostgreSQL con volumen persistente | Solo red interna |

Solo Caddy ve Internet. La API y la base de datos no tienen puerto publicado: se hablan por
la red interna de Docker. Es la diferencia entre un servidor y un servidor expuesto.

### Seguridad de base

- Usuario sin privilegios, **acceso solo por clave SSH**. Contraseñas desactivadas y root sin login.
- `ufw` con tres puertos abiertos: 22, 80 y 443. Nada más.
- `fail2ban` contra fuerza bruta en SSH.
- `unattended-upgrades` para los parches de seguridad del sistema.
- Secretos en un `.env` del servidor con permisos 600, nunca en el repositorio.
- CORS restringido al dominio propio.

### Backups

Lo que más duele perder es la base de datos, y en un VPS **el backup es responsabilidad tuya**:
aquí no hay nadie haciéndolo por detrás.

- `pg_dump` diario mediante un temporizador de systemd.
- Cifrado del volcado antes de salir de la máquina.
- Copia fuera del servidor (Hetzner Storage Box o Backblaze B2, ambos de céntimos al mes).
- Retención de 7 diarios y 4 semanales.
- **Una prueba de restauración** al terminar el montaje. Un backup que no se ha restaurado
  nunca no es un backup.

### Despliegue

GitHub Actions al hacer merge en `main`:

1. Construye la imagen de la API y la sube a GitHub Container Registry.
2. Entra por SSH al VPS con una clave de despliegue dedicada.
3. `docker compose pull && docker compose up -d` y aplica las migraciones de Alembic.
4. Comprueba `/api/health`; si falla, revierte a la imagen anterior.

El frontend se despliega solo: Vercel escucha el repositorio.

### DNS

Dominio: **mateorodriguez.solutions**, registrado en Hostinger.

| Registro | Apunta a |
|---|---|
| `mateorodriguez.solutions` | Vercel |
| `www` | Vercel |
| `api.mateorodriguez.solutions` | IP del VPS |

Los DNS se gestionan desde Hostinger. No hace falta mover el dominio de registrador.

### Vigilancia

Un comprobador externo gratuito contra `/api/health` cada 5 minutos, con aviso por correo.
Sin esto te enteras de que la API está caída cuando te escriba alguien — o cuando no te escriba.

## 6. Estructura del repositorio

```
portfolio/
├── apps/
│   ├── web/              React + Vite
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── sections/      hero, sobre-mi, actividad, stack, proyectos, trayectoria, contacto
│   │   │   ├── content/       es.json, en.json, proyectos.json
│   │   │   ├── hooks/
│   │   │   └── styles/        tokens.css
│   │   └── public/
│   └── api/              Flask
│       ├── src/api/      models.py, routes.py, github.py, mail.py
│       └── migrations/
├── scripts/              generar-cv-pdf, congelar-instantanea-contribuciones
├── .github/workflows/    ci, despertar-api
├── ARQUITECTURA.md
├── BRIEFING.md
└── README.md
```

## 7. Pendiente de decidir

- Proveedor de envío de correo (Resend tiene plan gratuito suficiente)
- Analítica: contador propio en `page_views` o algo externo sin cookies
- Destino de los backups: Hetzner Storage Box o Backblaze B2
