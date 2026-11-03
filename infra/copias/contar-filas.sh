#!/usr/bin/env bash
# Cuenta las filas de cada tabla de "portfolio" y "umami" (INFRA-05), para comparar una base
# recuperada con la original. Solo enseña nombres de tablas y números.
#
#   En el servidor:  sudo bash contar-filas.sh                    (contenedor portfolio-db-1)
#   En tu Mac:       bash contar-filas.sh portfolio-restaurada    (la base recuperada)
set -euo pipefail

CONTENEDOR="${1:-portfolio-db-1}"
CONSULTA="select table_name || ': ' || (xpath('/row/c/text()', query_to_xml(
  format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name"

for base in portfolio umami; do
  echo "== $base"
  docker exec "$CONTENEDOR" psql -U postgres -d "$base" -tAc "$CONSULTA"
done
