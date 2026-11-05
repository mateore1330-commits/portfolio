#!/usr/bin/env bash
# El "Ignored Build Step" de Vercel (vercel.json → ignoreCommand), que se ejecuta en apps/web.
# Vercel solo entiende dos respuestas: 0 = no construir, 1 = construir. Cualquier otra (un error
# de git, por ejemplo) la toma como un fallo del despliegue. Por eso, ante la duda, construye.
#
#   - Primera construcción de una rama (no hay "anterior"): construye.
#   - El mismo commit otra vez (el gancho de "Publicar", un Redeploy): construye.
#   - Un commit nuevo que no toca apps/web (solo la API, por ejemplo): no construye.
#
# VERCEL_GIT_PREVIOUS_SHA: el commit de lo último desplegado con éxito en esa rama (Vercel).

anterior="${VERCEL_GIT_PREVIOUS_SHA:-}"
actual="${VERCEL_GIT_COMMIT_SHA:-}"

if [ -z "$anterior" ] || [ "$anterior" = "$actual" ]; then
  echo "saltar-construccion: se construye (primera vez o mismo commit)."
  exit 1
fi
if git diff --quiet "$anterior" HEAD -- . 2>/dev/null; then
  echo "saltar-construccion: nada cambió en apps/web desde ${anterior:0:7}; no se construye."
  exit 0
fi
echo "saltar-construccion: se construye (cambió apps/web, o no se pudo comparar)."
exit 1
