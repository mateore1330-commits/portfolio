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
| Hosting API | **VPS propio (Hostinger KVM 2)** | 12,09 €/mes, mes a mes. Se administra entero (INFRA-01: el Hetzner CX23 previsto estaba agotado) |
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

**Stack:** React 18 · Vite · React Router · CSS propio · dnd-kit (ordenar arrastrando, en el panel)

- **CSS propio con tokens**, sin framework. La identidad "plano y plata" ya está definida en
  la maqueta: gris mineral `#E4E2DC`, azul de plano `#1E3FB0`, Archivo + Newsreader +
  JetBrains Mono. Se traslada tal cual.
- **Animaciones sin librerías**: CSS, `IntersectionObserver` (lo que aparece al bajar) y
  `requestAnimationFrame` (el cursor, el raíl, el campo de puntos del contacto, portado al estilo del
  "Dot Grid" de React Bits). Se planteó GSAP + ScrollTrigger, pero no hizo falta: menos peso y nada que
  mantener. Con "reducir movimiento", todo quieto.
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
- **Casilla de privacidad obligatoria** (`privacidad: true`). Con cada mensaje se guarda cuándo
  se aceptó y qué versión de la política (el "Actualizado el…" publicado, que pone el servidor).

### Tablas

```
contact_messages    id, nombre, email, asunto, mensaje, ip, user_agent, leido, privacidad_aceptada_en, version_privacidad, creado_en
contributions_cache id, payload (JSON), total, racha_actual, racha_max, actualizado_en
```

### Visitas

Las cuenta **Umami**, instalado en nuestro servidor (ADM-10): sin cookies y sin guardar nada en
el dispositivo de quien visita. La web le manda las páginas vistas y los eventos; el panel le pide
las cifras a la API, y la API a Umami (con su usuario, solo en el `.env`). El panel nunca se mide.


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
   └── apps/api  →  VPS Hostinger KVM 2           api.mateorodriguez.solutions
                    2 vCPU · 8 GB RAM · 100 GB NVMe · Ubuntu 26.04 LTS · Francia · 12,09 €/mes
```

El VPS no duerme, así que desaparece la acción programada para despertarlo. La regla de la
sección 2 sigue vigente de todas formas: si el servidor se cae, la web se ve igual.

### Qué corre en la máquina

Cuatro contenedores con Docker Compose (`infra/docker-compose.yml`, INFRA-03), en `/srv/portfolio`:

| Contenedor | Qué es | Expuesto |
|---|---|---|
| `caddy` | Proxy inverso y HTTPS con Let's Encrypt (pide y renueva los certificados solo). `api.` → la API; `visitas.` → solo el contador de Umami | 80, 443 (y 8081 solo en `127.0.0.1`) |
| `api` | Flask bajo Gunicorn (2 procesos × 4 hilos), con Chromium para el CV en PDF. Usuario sin privilegios | Solo red interna |
| `db` | PostgreSQL 18 con volumen persistente. Dos bases (`portfolio`, `umami`), cada una con su usuario sin privilegios | Solo red interna |
| `umami` | Las visitas (ADM-10). Su panel, solo por túnel SSH; la API lo lee con un usuario de solo lectura | Solo red interna |

Solo Caddy ve Internet. La API, la base de datos y Umami no tienen puerto publicado: se hablan por
la red interna de Docker. Es la diferencia entre un servidor y un servidor expuesto.

- La imagen de la API se construye en el servidor (`apps/api/Dockerfile`); con INFRA-06 pasará a GitHub.
- Al arrancar, la API aplica las migraciones pendientes. Detrás de Caddy lee la IP real del visitante (`PROXIES=1`).
- Registros con tope (3 × 10 MB por contenedor) y `no-new-privileges` para todos (`/etc/docker/daemon.json`).
- **HTTPS (INFRA-04)**: `infra/Caddyfile`. `http://` redirige a `https://`; TLS 1.2 y 1.3; cabeceras HSTS (un año,
  sin `includeSubDomains`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, sin `Server` ni `Via`.
  Nota A+ en SSL Labs (03/11/2026). Sin HTTP/3 (va por UDP y los cortafuegos solo abren TCP). La IP a secas no
  sirve nada. CORS lo pone la API, no Caddy.
- **Umami**: en `visitas.` solo `/script.js` y `/api/send`. Su panel escucha en `127.0.0.1:8081` y se entra con
  `ssh -L 8081:127.0.0.1:8081 portfolio`. La API usa el usuario `api-portfolio`, de solo lectura y en el equipo
  "Portfolio" con papel de solo lectura (lo crea `infra/servidor/umami-configurar.py`).
- Todo con `restart: unless-stopped`: tras reiniciar el servidor vuelve solo (comprobado el 03/11/2026).
- Instalado con `infra/servidor/2-docker.sh`: Docker desde su repositorio oficial, con la huella de su clave
  comprobada antes de instalar nada.

### Seguridad de base

- Usuario sin privilegios, **acceso solo por clave SSH**. Contraseñas desactivadas y root sin login.
  Hecho en INFRA-01: un solo usuario de administración (`mateo`, con `sudo` **que pide su contraseña**), clave
  ed25519 con passphrase, `AllowUsers mateo` y como mucho 3 intentos (`/etc/ssh/sshd_config.d/00-portfolio.conf`).
  El usuario de los despliegues automáticos, sin `sudo`, llega con INFRA-06.
- `ufw` con tres puertos abiertos: 22, 80 y 443. Nada más. **Y delante, el cortafuegos de Hostinger** con las
  mismas tres (Accept 22/80/443, Drop el resto): para el tráfico antes de llegar y Docker no puede saltárselo
  (INFRA-02). Ojo en INFRA-03: Docker se salta `ufw` si un contenedor publica un puerto; solo Caddy publica 80 y 443.
- `fail2ban` contra fuerza bruta en SSH: 5 fallos en 10 min → 1 h fuera, y el doble si repite (máx. 1 semana).
- `unattended-upgrades` para los parches de seguridad del sistema, **sin reinicio automático**: si un parche lo pide,
  sale "*** System restart required ***" al entrar por SSH y se reinicia a mano. Sin Ubuntu Pro (sus condiciones
  gratuitas no cubren con claridad un VPS alquilado). Script: `infra/servidor/1-seguridad.sh`.
- Secretos en `infra/.env` y `infra/api.env` del servidor, generados allí al azar, de root y con permisos 600;
  nunca en el repositorio (plantillas: `.env.example` y `api.env.example`).
- CORS restringido al dominio propio.

### Backups

Lo que más duele perder es la base de datos, y en un VPS **el backup es responsabilidad tuya**:
aquí no hay nadie haciéndolo por detrás. Montado en INFRA-05 siguiendo la regla **3-2-1**:

- **Cada noche a las 04:00 (Madrid)**, un temporizador de systemd (`portfolio-copia.timer`) lanza
  `infra/copias/copiar.sh`: `pg_dump -Fc` de `portfolio` y de `umami`.
- **Cifrado con age antes de salir**, con una llave **pública** (`infra/copias/llave-publica.txt`). La
  privada está solo en Bitwarden y en el Mac de Mateo: el servidor puede cerrar copias, pero **no abrirlas**.
- **Tres sitios**:
  - dentro, `/var/backups/portfolio/` (las 7 últimas; legibles por `mateo` para bajarlas, van cifradas);
  - **Backblaze B2** (Ámsterdam, gratis hasta 10 GB): `diarias/` 7 días y `semanales/` (domingos) 31 días.
    Lo viejo lo borran sus reglas de caducidad, con 7 días más de margen;
  - **el disco SSD de Mateo**, cuando él quiere: `infra/copias/bajar-al-disco.sh`.
  - Y aparte, la copia semanal de Hostinger.
- **La llave de Backblaze del servidor solo puede listar y subir** (`listBuckets`, `listFiles`,
  `writeFiles`, solo su bucket): no puede borrar ni cambiar las reglas, así que quien tomara el servidor no
  podría destruir las copias. La opción "Write Only" de la web de Backblaze **no sirve** (trae `deleteFiles`
  y `writeBucketLifecycleRules`): se crea con `infra/copias/crear-llave.py` y la comprueba
  `comprobar-llave.py` (sube un archivo e intenta borrarlo).
- **Si una copia falla**, systemd lanza `portfolio-copia-aviso` (`OnFailure`): un correo con las últimas
  líneas del registro, por el mismo buzón que el formulario de contacto (`SMTP_*` y `CONTACT_TO` de `api.env`).
  Probado provocando un fallo. Que la copia ni siquiera se lance, lo vigilará INFRA-07.
- Los scripts se instalan en `/usr/local/lib/portfolio-copias/` (de root: los ejecuta root cada noche) y la
  configuración en `/etc/portfolio-copias/` (root, 600). Instalador: `infra/servidor/4-copias.sh`.
- **Restaurada de verdad** (03/11/2026): una copia bajada de Backblaze, abierta y cargada en una base limpia:
  las 42 tablas con las mismas filas. El procedimiento, paso a paso, en **`docs/RESTAURAR.md`**.

### Despliegue

GitHub Actions al hacer merge en `main` (INFRA-06, `.github/workflows/deploy-api.yml`), solo si cambió la API o
el servidor:

1. Construye la imagen de la API y la sube a GitHub Container Registry (`ghcr.io/…/portfolio-api:<commit>`,
   pública: no lleva secretos).
2. Entra por SSH con una llave de despliegue dedicada, como el usuario `despliegue`, que **solo puede lanzar**
   `portfolio-desplegar <commit>` (orden forzada, sin terminal, `sudo` solo para eso).
3. En el servidor: código de `main`, la imagen, **una copia de la base**, las migraciones con la imagen nueva y
   la API nueva.
4. Comprueba `/api/health`; si falla, **vuelve sola a la imagen anterior** (probado: versión que no arranca,
   imagen que no existe, copia que falla, migración rota).

El servidor sigue `main`. Las migraciones tienen que ser compatibles hacia atrás. Todo, en `docs/DESPLIEGUE.md`.

El frontend se despliega solo: Vercel escucha el repositorio (GO-02). Proyecto con raíz `apps/web`; cabeceras
de seguridad y reglas de rutas en `apps/web/vercel.json`; "Publicar" lo reconstruye con un gancho secreto que
vive en el servidor. Todo, en `docs/DESPLIEGUE.md` (La web).

### DNS

Dominio: **mateorodriguez.solutions**, registrado en Hostinger.

| Registro | Apunta a |
|---|---|
| `mateorodriguez.solutions` | Vercel (registro A, el que da Vercel en *Domains*, TTL 1 h; el canónico, sin `www`; GO-01) |
| `www` | Vercel (CNAME al que da Vercel, TTL 1 h; redirige con 308 al de sin `www`) |
| `api.mateorodriguez.solutions` | IP del VPS (registro A, TTL 1 h; INFRA-04) |
| `visitas.mateorodriguez.solutions` | IP del VPS (registro A, TTL 1 h; INFRA-04) |

Los DNS se gestionan desde Hostinger. No hace falta mover el dominio de registrador, ni pasar los DNS a Vercel:
el correo (MX, SPF, DKIM, DMARC, `autodiscover`, `autoconfig`) sigue en Hostinger y no se toca. El certificado
de la web lo pide y lo renueva Vercel (Let's Encrypt).

### Vigilancia

Desde fuera del servidor (INFRA-07): si el servidor está caído, no puede avisar de que está caído.

- **UptimeRobot** (gratis: 50 monitores cada 5 min, aviso por correo, 3 meses de historial; vale para uso
  personal y comercial y no pide tarjeta, según su página de precios el 04/11/2026), cada 5 minutos:
  - `https://api.mateorodriguez.solutions/api/health` — la API **y la base de datos**: si PostgreSQL no contesta,
    responde `503` (el despliegue también lo usa, así que no da por buena una versión que no llega a la base);
  - `https://visitas.mateorodriguez.solutions/script.js` — Umami (y Caddy);
  - `https://mateorodriguez.solutions` — la web en Vercel (GO-02).
  Avisa por correo al caer (confirmado, con el código de respuesta) y al volver, y guarda cuánto estuvo caída.
- **Healthchecks.io** (gratis, plan Hobbyist): la copia nocturna avisa "¡hecha!" al terminar
  (`infra/copias/copiar.sh`). Si a las 06:00 de Madrid no ha llegado (la copia es a las 04:00, con 2 h de margen),
  manda un correo: así se ve también que la copia **ni siquiera se lanzó**, que el aviso de fallo de systemd no
  puede ver. La dirección del aviso es secreta: en el servidor, `/etc/portfolio-copias/vigilancia.env` (root, 600).
- Las dos cuentas, con verificación en dos pasos; los avisos, al Gmail de Mateo.

## 6. Estructura del repositorio

Nombres en español (ORG-01): cada archivo se llama como lo que exporta. Se quedan como están los que manda una
herramienta (`main.jsx`, `package.json`, `Dockerfile`…), el prefijo `use` de los hooks y, en la API, los nombres
habituales de Flask (`models.py`, `config.py`, `extensions.py`, `routes.py`).

```
portfolio/
├── apps/
│   ├── web/                    React + Vite (la web pública y el panel)
│   │   ├── src/
│   │   │   ├── main.jsx · Aplicacion.jsx · rutas.jsx
│   │   │   ├── web/            la web pública
│   │   │   │   ├── paginas/        Portada, PaginaProyecto, PaginaLegal, NoEncontrada
│   │   │   │   ├── secciones/      Inicio, SobreMi, Actividad, Conocimientos, Proyectos, Trayectoria, Contacto…
│   │   │   │   └── estructura/     EstructuraWeb, Cabecera, MenuMovil, Pie, RailProgreso, Cursor
│   │   │   ├── panel/          el panel: una carpeta por pantalla, comun/ y utilidades/
│   │   │   ├── compartido/     componentes/ y efectos/ que usan la web y el panel; medir.js (Umami)
│   │   │   ├── contenido/      instantanea.json, contribuciones.json y cómo se leen
│   │   │   ├── idioma/         es.json, en.json, el selector y useIdioma
│   │   │   ├── tema/           claro/oscuro
│   │   │   ├── estilos/        variables, fuentes, base y movimiento
│   │   │   └── recursos/       fuentes y retrato
│   │   ├── scripts/        congelar-contenido, paginas-estaticas, recortar-fuentes, optimizar-retrato, imagenes-compartir
│   │   └── public/
│   └── api/                    Flask
│       ├── src/api/        un módulo por tema (proyectos, textos, trayectoria, publicar, cv/…)
│       ├── tests/          un test por módulo
│       ├── migrations/     Alembic
│       ├── seed/           el contenido inicial
│       └── Dockerfile
├── infra/                      el servidor (infra/README.md): docker-compose, Caddyfile, servidor/ (1-seguridad … 5-despliegue), copias/, despliegue/
├── scripts/                    comprobar-idiomas (lo usan las dos aplicaciones)
├── docs/                       ARQUITECTURA, MODELO_DATOS, BACKLOG, DESPLIEGUE, RESTAURAR
├── .github/                    workflows: ci (cada PR) y deploy-api (al fusionar en main)
└── README.md
```

## 7. Pendiente de decidir

- Proveedor de envío de correo (Resend tiene plan gratuito suficiente)
- Destino de los backups: Hetzner Storage Box o Backblaze B2
