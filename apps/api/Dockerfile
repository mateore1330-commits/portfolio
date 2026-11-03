# La imagen de la API (INFRA-03). Se construye desde la raíz del repo (lo hace
# infra/docker-compose.yml): necesita apps/api y, para el CV en PDF, el retrato de apps/web.
#
# Dos fases: la primera solo descarga las fuentes de la web (las del CV); la segunda es la
# que se queda: Python, la API, Gunicorn y Chromium. Sin secretos: llegan del .env del
# servidor al arrancar.

# ---------------------------------------------------------------- Las fuentes del CV
FROM node:22.23.4-slim AS fuentes
WORKDIR /fuentes
# Las mismas versiones que apps/web/package.json.
RUN npm install --no-save --no-audit --no-fund \
      @fontsource-variable/archivo@5.3.0 \
      @fontsource-variable/newsreader@5.3.0 \
      @fontsource-variable/jetbrains-mono@5.3.0

# ---------------------------------------------------------------- Las dependencias
FROM python:3.13.18-slim AS dependencias
RUN pip install --no-cache-dir pipenv==2026.10.5
WORKDIR /dep
COPY apps/api/Pipfile apps/api/Pipfile.lock ./
# Las del Pipfile.lock exactas, sin las de desarrollo (ruff, pytest).
RUN pipenv requirements > requirements.txt

# ---------------------------------------------------------------- La API
FROM python:3.13.18-slim

# Chromium para el CV en PDF. Nada más del sistema.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium \
 && rm -rf /var/lib/apt/lists/*

COPY --from=dependencias /dep/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Lo del CV: las fuentes y el retrato, en su sitio (y la API los busca ahí).
COPY --from=fuentes /fuentes/node_modules/@fontsource-variable /opt/cv/fuentes
COPY apps/web/src/assets/retrato/retrato-400.jpg /opt/cv/retrato-400.jpg

# Un usuario sin privilegios: la API no corre como root dentro de su caja.
RUN useradd --create-home --shell /usr/sbin/nologin api
WORKDIR /app
COPY --chown=api:api apps/api/ /app/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CHROME=/usr/bin/chromium \
    CV_FUENTES=/opt/cv/fuentes \
    CV_RETRATO=/opt/cv/retrato-400.jpg \
    CV_CHROME_SIN_SANDBOX=1

USER api
EXPOSE 8000

# Al arrancar: las migraciones (no hacen nada si ya están al día) y Gunicorn. 2 procesos con 4
# hilos cada uno; 120 s de margen porque publicar genera el CV en PDF dentro de la petición.
CMD ["sh", "-c", "flask --app wsgi db upgrade && exec gunicorn wsgi:app --bind 0.0.0.0:8000 --workers 2 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
