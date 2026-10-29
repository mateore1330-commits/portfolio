#!/usr/bin/env bash
# Lee por la entrada estándar la lista de archivos cambiados (uno por línea)
# y escribe qué aplicaciones hay que comprobar: web=true|false y api=true|false.
# Si cambia la propia CI o el package.json de la raíz, se comprueba todo.
set -euo pipefail

cambios=$(cat)
web=false
api=false

if grep -qE '^(\.github/(workflows|scripts)/|package\.json$)' <<<"$cambios"; then
  web=true
  api=true
fi
# scripts/ tiene utilidades de las dos: comprobar idiomas (API) y congelar el contenido (build de la web).
grep -qE '^(apps/web|scripts)/' <<<"$cambios" && web=true
grep -qE '^(apps/api|scripts)/' <<<"$cambios" && api=true

echo "web=$web"
echo "api=$api"
