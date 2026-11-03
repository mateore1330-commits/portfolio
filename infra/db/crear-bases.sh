#!/bin/sh
# Solo la primera vez que arranca PostgreSQL con el volumen vacío (lo ejecuta la imagen
# oficial desde /docker-entrypoint-initdb.d/). Crea un usuario y una base por aplicación,
# sin superpoderes: cada una solo manda en la suya. Las contraseñas llegan del .env.
set -eu

psql -v ON_ERROR_STOP=1 --username postgres <<EOSQL
CREATE ROLE portfolio LOGIN PASSWORD '${PORTFOLIO_DB_PASSWORD}';
CREATE DATABASE portfolio OWNER portfolio;
CREATE ROLE umami LOGIN PASSWORD '${UMAMI_DB_PASSWORD}';
CREATE DATABASE umami OWNER umami;
EOSQL
