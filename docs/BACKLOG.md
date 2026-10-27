# Backlog — Portfolio de Mateo Rodríguez

Fase 4 del plan. Escrito el 26 de octubre de 2026.

**Pendiente de revisión.** Cuando le des el visto bueno, se suben como issues a GitHub con `gh`.

- **v1** = entra en la entrega que envías a Ordenatech.
- **v2** = después, sin prisa.
- Cada issue lleva su plan paso a paso **justo antes de implementarlo**, no ahora.

| Épica | Issues | v1 | v2 |
|---|---|---|---|
| E1 · Cimientos | 7 | 7 | — |
| E2 · Contenido y datos | 8 | 7 | 1 |
| E3 · API en Flask | 9 | 7 | 2 |
| E4 · Panel de administración | 11 | 5 | 6 |
| E5 · Web pública | 12 | 12 | — |
| E6 · Animaciones y efectos | 7 | 7 | — |
| E7 · Infraestructura y VPS | 9 | 9 | — |
| E8 · Lanzamiento | 6 | 6 | — |
| **Total** | **69** | **60** | **9** |

---

## E1 · Cimientos

**1.1 · Crear el repositorio y la estructura del monorepo** `v1`
Repo público con `apps/web`, `apps/api`, `scripts/` y `.github/`.
- [ ] Estructura de carpetas creada y commiteada
- [ ] `.gitignore` cubre `.env`, `node_modules`, `__pycache__`, `dist`
- [ ] `README.md` con una descripción real, no una plantilla

**1.2 · Arrancar el frontend con Vite y React** `v1`
- [ ] `npm run dev` levanta una página en blanco sin errores
- [ ] Alias `@/` configurado hacia `src/`

**1.3 · Arrancar la API con Flask** `v1`
- [ ] Patrón de fábrica de aplicación y blueprints
- [ ] `/api/health` responde `200`
- [ ] Variables de entorno leídas con `python-dotenv`

**1.4 · Portar los tokens de diseño de la maqueta** `v1`
Depende de: 1.2
- [ ] `tokens.css` con la paleta, tipografías y escalas
- [ ] Los tres estados de tema funcionan: claro, oscuro y sistema
- [ ] Tipografías de Google cargadas con `display=swap`

**1.5 · Configurar linters y formateo** `v1`
- [ ] ESLint en el front, `ruff` o `pycodestyle` en la API
- [ ] Un único comando ejecuta ambos

**1.6 · Integración continua en GitHub Actions** `v1`
Depende de: 1.5
- [ ] Lint y build en cada pull request
- [ ] La rama `main` está protegida: no se puede empujar directamente

**1.7 · Plantillas de issue y de pull request** `v1`
- [ ] Plantilla de issue con alcance y criterios de aceptación
- [ ] Plantilla de PR que obliga a enlazar su issue

---

## E2 · Contenido y datos

**2.1 · Modelo de datos del contenido** `v1`
Depende de: 1.3. Tablas de la sección 4 bis de ARQUITECTURA.md.
- [ ] Modelos SQLAlchemy de `projects`, `jobs`, `education`, `skills`, `site_text`, `links`
- [ ] Campos traducibles como JSONB con forma `{"es": …, "en": …}`
- [ ] Migración inicial de Alembic aplicada

**2.2 · Modelos de apoyo** `v1`
Depende de: 2.1
- [ ] `admin_user`, `snapshots`, `contact_messages`, `contributions_cache`, `page_views`
- [ ] Restricción que impide más de un usuario administrador

**2.3 · Redactar el contenido real en español** `v1`
A partir de BRIEFING.md. **Bloquea a casi toda la E5.**
- [ ] Textos de las siete secciones
- [ ] Ficha de los tres proyectos: CleanFlow, MIR Llamado, Dragon Ball
- [ ] Seis empleos redactados orientados a competencias
- [ ] Formación y conocimientos
- [ ] Validado por Mateo antes de seguir

**2.4 · Traducir el contenido al inglés** `v1`
Depende de: 2.3
- [ ] Todos los campos traducidos
- [ ] Los términos técnicos no se traducen a la fuerza

**2.5 · Script de semilla** `v1`
Depende de: 2.1, 2.4
- [ ] Carga todo el contenido desde ficheros JSON versionados
- [ ] Idempotente: ejecutarlo dos veces no duplica nada

**2.6 · Instantánea de contenido** `v1`
Depende de: 2.5
- [ ] Genera `content.json` con lo publicado en los dos idiomas
- [ ] Se guarda en la tabla `snapshots` con fecha y autor

**2.7 · Congelar la instantánea en el build** `v1`
Depende de: 2.6
- [ ] El build del frontend incrusta el último `content.json`
- [ ] Si la API no responde durante el build, usa el último commiteado y avisa

**2.8 · Generar el CV en PDF desde el contenido** `v2`
Depende de: 2.4
- [ ] Un comando produce el PDF en los dos idiomas
- [ ] Mismos datos que la web: imposible que se desincronicen

---

## E3 · API en Flask

**3.1 · `GET /api/content`** `v1`
Depende de: 2.6
- [ ] Devuelve solo lo publicado, en los dos idiomas
- [ ] Cabeceras de caché y `ETag`

**3.2 · CORS y cabeceras de seguridad** `v1`
- [ ] CORS limitado al dominio propio
- [ ] CSP, HSTS, `X-Frame-Options` y `X-Content-Type-Options`

**3.3 · Autenticación del administrador** `v1`
Depende de: 2.2
- [ ] Login con bcrypt a coste 12 y JWT en cookie `httpOnly`
- [ ] `token_version` revoca las sesiones al cambiar la contraseña
- [ ] Decorador que protege las rutas de administración

**3.4 · Límite de intentos en el login** `v1`
Depende de: 3.3
- [ ] 5 intentos cada 15 minutos por IP
- [ ] Los intentos fallidos quedan registrados

**3.5 · `POST /api/contact`** `v1`
Depende de: 2.2
- [ ] Validación en servidor de todos los campos
- [ ] Antispam: campo trampa, tiempo mínimo de relleno y 3 envíos por IP y hora
- [ ] Guarda en base de datos antes de intentar enviar el correo

**3.6 · Envío de correo del formulario** `v1`
Depende de: 3.5
- [ ] Aviso por correo a Mateo con el contenido del mensaje
- [ ] Si el envío falla, el mensaje ya está guardado y queda marcado para reintento

**3.7 · `GET /api/contributions`** `v1`
- [ ] Consulta la API GraphQL de GitHub con token desde el entorno
- [ ] Caché en base de datos con 24 h de validez
- [ ] Si GitHub falla, devuelve la última copia buena aunque esté caducada

**3.8 · Registro de visitas** `v1`
- [ ] Guarda ruta, idioma, referente y país; **sin cookies ni datos personales**
- [ ] No bloquea la respuesta

**3.9 · Documentación de la API** `v2`
- [ ] Los endpoints documentados y accesibles

---

## E4 · Panel de administración

**4.1 · Estructura del panel y rutas protegidas** `v1`
Depende de: 3.3
- [ ] Ruta `/admin` separada de la web pública
- [ ] Redirige al login si no hay sesión
- [ ] `noindex` para los buscadores

**4.2 · Pantalla de login** `v1`
Depende de: 4.1
- [ ] Entra con correo y contraseña, y muestra el error cuando falla
- [ ] Cierre de sesión

**4.3 · CRUD de proyectos** `v1`
Depende de: 4.1, 3.1
- [ ] Listado con estado, orden y destacado
- [ ] Formulario con todos los campos en español e inglés
- [ ] Crear, editar, borrar con confirmación
- [ ] Borrador y publicado

**4.4 · Edición de los textos de sección** `v1`
Depende de: 4.1
- [ ] Formulario por sección en los dos idiomas
- [ ] Vista previa del texto antes de guardar

**4.5 · Botón de publicar** `v1`
Depende de: 2.6, 4.3
- [ ] Genera la instantánea y lanza el redespliegue en Vercel
- [ ] Muestra la fecha de la última publicación
- [ ] Avisa si hay cambios sin publicar

**4.6 · CRUD de experiencia laboral** `v2`
**4.7 · CRUD de formación** `v2`
**4.8 · CRUD de conocimientos y enlaces** `v2`
**4.9 · Subida de imágenes a Cloudinary** `v2`
- [ ] Validación de tipo y tamaño; se guarda la URL en base de datos
**4.10 · Reordenar arrastrando** `v2`
**4.11 · Bandeja de mensajes y vista de visitas** `v2`

---

## E5 · Web pública

**5.1 · Esqueleto, enrutado e idiomas** `v1`
Depende de: 1.2, 1.4
- [ ] Rutas `/` en español y `/en` en inglés
- [ ] Contexto de idioma propio, sin librería de i18n
- [ ] Selector de idioma que conserva la posición en la página

**5.2 · Carga del contenido con respaldo** `v1`
Depende de: 2.7, 3.1
- [ ] Pinta el contenido del bundle al instante
- [ ] Lo sustituye si la API responde; si no, no pasa nada
- [ ] **Probado con la API apagada**

**5.3 · Cabecera, navegación y raíl de progreso** `v1`
**5.4 · Sección Hero con el retrato en duotono** `v1`
- [ ] El nombre se superpone al retrato con `mix-blend-mode`
- [ ] El duotono se destiñe al pasar el ratón

**5.5 · Sección Sobre mí** `v1`
**5.6 · Gráfico de contribuciones** `v1`
Depende de: 3.7
- [ ] Rejilla de 53 semanas con tooltip al pasar por encima
- [ ] Cifras calculadas de los propios datos
- [ ] Con la API caída, muestra la instantánea del build

**5.7 · Sección Conocimientos** `v1`
**5.8 · Sección Proyectos con pila al hacer scroll** `v1`
**5.9 · Sección Trayectoria** `v1`
**5.10 · Sección Contacto con formulario** `v1`
Depende de: 3.5
- [ ] Validación en cliente y mensajes de error claros
- [ ] **Si la API no responde en 5 s, cae al enlace de correo**
- [ ] Campo trampa oculto

**5.11 · Adaptación a móvil** `v1`
- [ ] Revisado a 360, 768, 1024 y 1440 px
- [ ] El cuerpo de la página nunca hace scroll horizontal

**5.12 · Accesibilidad y SEO** `v1`
- [ ] Navegable entero con teclado y foco visible
- [ ] `prefers-reduced-motion` respetado
- [ ] Metadatos, Open Graph, `sitemap.xml` y `hreflang` entre idiomas

---

## E6 · Animaciones y efectos

**6.1 · Montar GSAP y ScrollTrigger** `v1`
**6.2 · Revelado al hacer scroll** `v1`
- [ ] Lo visible al cargar no se queda esperando al observador
**6.3 · Cursor personalizado con etiqueta** `v1`
- [ ] Desactivado en táctil
**6.4 · Botones magnéticos y microinteracciones** `v1`
**6.5 · Marquesina de tecnologías** `v1`
- [ ] Se detiene al pasar el ratón
**6.6 · Fondo Dot Grid del contacto** `v1`
- [ ] Los puntos se apartan del cursor y vuelven solos
- [ ] Onda de choque al hacer clic
- [ ] El bucle se apaga cuando todo está en reposo
**6.7 · Repaso de rendimiento** `v1`
- [ ] 60 fps en un portátil normal; sin animar propiedades que provocan relayout

---

## E7 · Infraestructura y VPS

**7.1 · Contratar y provisionar el servidor** `v1`
- [ ] Hetzner CX23 con Ubuntu LTS
- [ ] Usuario sin privilegios, acceso solo por clave SSH
- [ ] Contraseñas y acceso de root desactivados

**7.2 · Cortafuegos y protección contra fuerza bruta** `v1`
Depende de: 7.1
- [ ] `ufw` con 22, 80 y 443 abiertos; nada más
- [ ] `fail2ban` activo sobre SSH
- [ ] `unattended-upgrades` configurado

**7.3 · Docker y Docker Compose** `v1`
Depende de: 7.2
- [ ] Tres servicios: `caddy`, `api`, `db`
- [ ] **Ni la API ni la base de datos publican puerto**

**7.4 · Caddy como proxy inverso con TLS** `v1`
Depende de: 7.3
- [ ] Certificado automático de Let's Encrypt
- [ ] Redirección de HTTP a HTTPS

**7.5 · PostgreSQL en contenedor** `v1`
Depende de: 7.3
- [ ] Volumen persistente y contraseña fuerte desde el entorno

**7.6 · Backups automáticos** `v1`
Depende de: 7.5
- [ ] `pg_dump` diario con temporizador de systemd
- [ ] Cifrado antes de salir de la máquina
- [ ] Copia fuera del servidor y retención de 7 diarios y 4 semanales

**7.7 · Prueba de restauración** `v1`
Depende de: 7.6
- [ ] Restauración real en una base de datos limpia, documentada paso a paso
- [ ] **Este issue no se cierra hasta haberla hecho de verdad**

**7.8 · Despliegue automático de la API** `v1`
Depende de: 7.4, 1.6
- [ ] Al hacer merge en `main`: construye, sube la imagen y despliega por SSH
- [ ] Aplica migraciones y comprueba `/api/health`
- [ ] Revierte sola a la imagen anterior si falla

**7.9 · Vigilancia externa** `v1`
Depende de: 7.8
- [ ] Comprobación de `/api/health` cada 5 minutos con aviso por correo

---

## E8 · Lanzamiento

**8.1 · Configurar los DNS en Hostinger** `v1`
Dominio: `mateorodriguez.solutions`
- [ ] `mateorodriguez.solutions` y `www` apuntando a Vercel
- [ ] `api.mateorodriguez.solutions` apuntando a la IP del VPS
- [ ] Verificado con `dig` desde fuera

**8.2 · Desplegar el frontend en Vercel** `v1`
Depende de: 8.1, 5.12
- [ ] Dominio propio con TLS
- [ ] Variables de entorno configuradas

**8.3 · Cargar el contenido real en producción** `v1`
Depende de: 2.5, 7.8

**8.4 · Repaso de seguridad** `v1`
- [ ] Ningún secreto en el repositorio ni en su historial
- [ ] Cabeceras verificadas y rutas de administración protegidas

**8.5 · Revisión final con datos reales** `v1`
- [ ] Los dos idiomas revisados en móvil y escritorio
- [ ] **Prueba con la API apagada**: la web se ve entera
- [ ] Formulario probado de principio a fin

**8.6 · README del proyecto** `v1`
- [ ] Qué es, cómo se levanta en local y cómo se despliega
- [ ] Decisiones de arquitectura y por qué

---

## Camino crítico

```
1.1 → 1.3 → 2.1 → 2.3 → 2.4 → 2.5 → 2.6 → 3.1 → 5.2 → [secciones] → 8.5
                    ▲
            lo que más depende de Mateo
```

**2.3 (redactar el contenido) bloquea casi toda la E5.** Es lo primero que hay que cerrar.

En paralelo, sin depender de nadie: toda la E7 (el servidor) y la E6 (animaciones).
