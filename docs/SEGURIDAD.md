# Seguridad

> Repaso antes de lanzar la web (GO-04, 07/11/2026). Qué se comprobó, cómo repetirlo, qué salió y qué riesgos se
> aceptan. Ni secretos, ni la IP del servidor, ni la dirección del panel aparecen aquí: el repositorio es público.

## En una frase

**Nada abierto y nada filtrado:** ningún secreto en el historial, todas las rutas del panel piden sesión, la web solo
carga lo que está en su lista (CSP), el correo del dominio no se puede suplantar fácilmente (DMARC) y los límites
de intentos y el antispam funcionan en producción.

## Lo comprobado

| Qué | Cómo | Resultado |
|---|---|---|
| Secretos en el repositorio y su historial | `gitleaks git . --log-opts="--all" --redact` (todas las ramas) | 0 hallazgos. Los `.env` versionados (`.env.example`, `.env.development`) solo traen nombres o valores de ejemplo |
| Secretos que se suban por error | Escaneo de secretos de GitHub y **protección al subir** (push protection), activados | 0 avisos |
| Rutas del panel (`/api/admin/*`) sin sesión | La lista sale de la propia API (`flask routes`, 66 rutas); cada una, con su método, contra producción y sin cookie | Las 65 que no son `login` → **401** |
| Límite de intentos al entrar | 6 intentos con un correo y una contraseña falsos, en producción | 5 × 401 y después **429** (bloqueo de 15 min por IP). Mismo tiempo de respuesta (~0,2 s) exista o no el correo |
| Antispam del formulario | En producción: con el campo trampa relleno, enviado en 1 s y 4 mensajes normales seguidos | Trampa y rapidez → 201 sin guardar ni avisar (al bot no se le dan pistas); 3 × 201 y el 4.º → **429** |
| Cookie de sesión | Configuración (`config.py`) y la respuesta de `login` en producción (DevTools → Network → `login` → Cookies) | `httpOnly`, `Secure`, `SameSite=Lax`, solo para `/api/admin`, con protección CSRF. **Arreglado:** la cookie se guardaba un año (lo que pone la librería por defecto) aunque el pase de dentro caduca a las 8 h; ahora caduca con él (`Max-Age` de 8 h, con su test) |
| Archivos de secretos del servidor | `sudo stat -c "%a %U:%G %n"` | Los cuatro (`infra/.env`, `infra/api.env` y los dos de `/etc/portfolio-copias/`), **600 root:root** |
| El panel en Google | `sitemap.xml`, `robots.txt` y la cabecera de sus páginas | No está en el sitemap ni en `robots.txt` (nombrarlo sería señalar la puerta); sus páginas llevan `noindex` |
| Correo del dominio | `dig` a los dos DNS de Hostinger | SPF y DKIM de Hostinger; **DMARC `p=quarantine`** (antes `p=none`), con informes a `info@` |
| Librerías con fallos conocidos | `npm audit` (web) y Dependabot (web, API y acciones del CI) | Ver "Riesgos aceptados" |
| Cabeceras | securityheaders.com y el observatorio de Mozilla, con la CSP ya en producción | Ver abajo |

## Las cabeceras

**La web** (Vercel, `apps/web/vercel.json`): HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy` y la **CSP**:

- `default-src 'self'`: por defecto, solo lo de la propia web.
- `script-src`: la propia web, el contador de visitas (Umami) y el script en línea del tema de `index.html` por su
  **huella**. Si ese script cambia y la huella no, `paginas-estaticas.mjs` hace fallar el build y dice la nueva.
- `style-src 'self'`: sin `'unsafe-inline'` (los estilos que pone React desde el código no los mira la CSP).
- `img-src`: la propia web, `data:` (los SVG de los estilos), `blob:` (la vista previa al subir fotos en el panel) y
  Cloudinary.
- `connect-src`: la API y el contador de visitas.
- `frame-src 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
  `upgrade-insecure-requests`.

Probada con la web construida, servida con las cabeceras de `vercel.json` y un `report-uri` solo en local: ningún
bloqueo en la portada (es y en, los dos temas), los proyectos, las legales ni la página de error. Un bloqueo
provocado a propósito sí llegó (la prueba de que el informe funcionaba).

**La API** (Caddy, `infra/Caddyfile`): HSTS, `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`; sin
`Server` ni `Via`. CORS, solo para los orígenes de `CORS_ORIGINS`.

## Riesgos aceptados

| Riesgo | Por qué se acepta | Qué lo vigila |
|---|---|---|
| Un 404 de `/assets/` se guarda un año (`immutable`) | Vercel pone las cabeceras también a los 404 y no deja elegirlas por el código de respuesta. Solo molesta si se vuelve a una versión anterior (*Instant Rollback*) y un visitante ya había pedido justo ese archivo; se arregla recargando a fondo. Bajar la caché haría la web más lenta para todos | Nada: está escrito aquí |
| ESLint 10 depende de `minimatch` 10, con un fallo moderado (denegación de servicio con patrones de archivos hechos a propósito) | El arreglo está en `minimatch` 11 y ESLint 10 aún no lo admite; bajar a ESLint 9 sería peor. Solo corre en el ordenador y en el CI con patrones que escribimos nosotros: no llega al navegador | Dependabot |
| El panel está en una dirección "escondida" | Esconderla quita ruido de robots; la seguridad de verdad es el login (bcrypt, bloqueo por IP, cookie `httpOnly`, CSRF) | Las rutas, probadas sin sesión |
| HSTS sin `includeSubDomains` ni *preload* | Obligaría a todos los subdominios, también los del correo de Hostinger | — |
| DMARC en `quarantine` y no en `reject` | Primero se ve en los informes que nada legítimo falla | Los informes diarios en `info@`. Siguiente paso: `p=reject` |

## Cómo repetirlo

- **Secretos:** `gitleaks git . --log-opts="--all" --redact` desde la raíz del repo.
- **Rutas del panel:** sacar la lista con `flask --app wsgi routes` (en `apps/api`, con variables de prueba:
  `SECRET_KEY=prueba DATABASE_URL=sqlite:// CORS_ORIGINS=http://localhost`) y llamar a cada `/api/admin/…` (menos
  `login`) sin cookie: todas, 401.
- **Límite de intentos y antispam:** como en la tabla. Ojo: el bloqueo deja la IP propia 15 minutos sin poder
  entrar, y los mensajes normales llegan de verdad (se borran en el panel).
- **Permisos del servidor:** `ssh -t portfolio 'sudo stat -c "%a %U:%G %n" /srv/portfolio/infra/.env
  /srv/portfolio/infra/api.env /etc/portfolio-copias/*.env'`.
- **DMARC:** `dig +short TXT _dmarc.mateorodriguez.solutions @nova.dns-parking.com`.
- **Si se filtra un secreto:** borrarlo del historial no basta (ya fue público): se **cambia** el secreto. Dónde
  vive cada uno, en `docs/DESPLIEGUE.md` y `portfolio-privado/`.
