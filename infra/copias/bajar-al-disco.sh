#!/usr/bin/env bash
# En tu Mac (INFRA-05): baja las copias cifradas del servidor a tu disco externo.
#
#   bash infra/copias/bajar-al-disco.sh "/Volumes/NOMBRE_DEL_DISCO"
#
# Van a la carpeta portfolio-copias/ del disco. No borra nada del disco (ahí se acumulan) y solo
# baja las que aún no tiene. Las copias van cerradas con tu llave: sin ella, no se pueden abrir.
# Entra con ssh portfolio, sin sudo.
set -euo pipefail

DISCO="${1:-}"
if [ -z "$DISCO" ]; then
  echo "Falta el disco. Uso: bash infra/copias/bajar-al-disco.sh \"/Volumes/NOMBRE_DEL_DISCO\""
  echo "Los discos conectados ahora:"
  ls /Volumes
  exit 1
fi
# Solo un disco externo de verdad: nada de escribir en el del Mac por un nombre mal escrito.
case "$DISCO" in
  /Volumes/?*) ;;
  *) echo "Tiene que ser un disco de /Volumes (p. ej. \"/Volumes/MiDisco\")."; exit 1 ;;
esac
if ! mount | grep -q " on ${DISCO%/} ("; then
  echo "No encuentro el disco $DISCO. ¿Está conectado?"
  exit 1
fi

DESTINO="${DISCO%/}/portfolio-copias"
mkdir -p "$DESTINO"
echo "Bajando a $DESTINO …"
rsync -a --ignore-existing --exclude '.en-curso.*' portfolio:/var/backups/portfolio/ "$DESTINO/"

# Comprobar: cada copia está cerrada (empieza por la cabecera de age) y no está vacía.
mal=0
total=0
while IFS= read -r archivo; do
  total=$((total + 1))
  if [ "$(head -c 21 "$archivo")" != "age-encryption.org/v1" ] || [ ! -s "$archivo" ]; then
    echo "OJO: $archivo no parece una copia buena."
    mal=$((mal + 1))
  fi
done < <(find "$DESTINO" -name '*.dump.age')

echo
echo "En el disco: $(find "$DESTINO" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ') días, $total archivos, $(du -sh "$DESTINO" | cut -f1)."
echo "La más reciente: $(ls "$DESTINO" | sort | tail -1)"
if [ "$mal" -gt 0 ]; then
  echo "Hay $mal archivos raros: avisa a Claude."
  exit 1
fi
echo "Todas cerradas con tu llave. Ya puedes expulsar el disco."
