"""Comprueba la llave de Backblaze del servidor (INFRA-05). Lo lanza 4-copias.sh.

Lo que debe salir: que sube, que solo ve su bucket y que NO puede borrar. Para saberlo de
verdad, sube un archivo de prueba a diarias/ (lo borra Backblaze con su regla de caducidad) e
intenta borrarlo: si lo consigue, la llave tiene demasiados permisos.

La llave llega por el entorno (B2_CUENTA, B2_LLAVE, B2_BUCKET); no se imprime nunca.
Solo la biblioteca estándar.
"""

import base64
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.backblazeb2.com/b2api/v2"
# Exactamente estos, ni uno más (crear-llave.py la crea así). La opción "Write Only" de la web
# de Backblaze trae también deleteFiles y writeBucketLifecycleRules: no vale.
PERMITIDOS = {"listBuckets", "listFiles", "writeFiles"}


def pedir(url, cabeceras, datos=None):
    req = urllib.request.Request(url, data=datos, headers=cabeceras, method="POST" if datos is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main():
    cuenta, llave, bucket = os.environ["B2_CUENTA"], os.environ["B2_LLAVE"], os.environ["B2_BUCKET"]
    basica = base64.b64encode(f"{cuenta}:{llave}".encode()).decode()
    estado, auth = pedir(f"{API}/b2_authorize_account", {"Authorization": f"Basic {basica}"})
    if estado != 200:
        sys.exit(f"MAL: Backblaze no acepta la llave ({estado} {auth.get('code')}). ¿keyID y applicationKey bien copiados?")

    permitido = auth["allowed"]
    permisos = set(permitido.get("capabilities") or [])
    print(f"Bucket de la llave: {permitido.get('bucketName')}")
    print(f"Permisos: {', '.join(sorted(permisos))}")
    if permitido.get("bucketName") != bucket:
        sys.exit(f"MAL: la llave no está limitada al bucket {bucket}.")
    if "writeFiles" not in permisos:
        sys.exit("MAL: la llave no puede subir archivos (falta writeFiles).")
    sobran = permisos - PERMITIDOS
    if sobran:
        sys.exit(f"MAL: la llave tiene permisos que no debe: {', '.join(sorted(sobran))}. "
                 "Hay que crearla con infra/copias/crear-llave.py.")

    # La prueba de verdad: subir y tratar de borrar.
    api, token = auth["apiUrl"] + "/b2api/v2", auth["authorizationToken"]
    contenido = f"Prueba de permisos de INFRA-05, {time.strftime('%F %T')}. Se borra sola.\n".encode()
    nombre = f"diarias/prueba-permisos/{int(time.time())}.txt"
    # Backblaze a veces contesta 503 ("ocupado"): lo que pide su documentación es otra dirección
    # de subida y volver a probar. rclone (la copia de cada noche) ya lo hace solo.
    for intento in range(1, 6):
        estado, subida = pedir(f"{api}/b2_get_upload_url", {"Authorization": token},
                               json.dumps({"bucketId": permitido["bucketId"]}).encode())
        if estado == 200:
            estado, archivo = pedir(subida["uploadUrl"], {
                "Authorization": subida["authorizationToken"],
                "X-Bz-File-Name": urllib.parse.quote(nombre),
                "Content-Type": "text/plain",
                "X-Bz-Content-Sha1": hashlib.sha1(contenido).hexdigest(),
            }, contenido)
            if estado == 200:
                break
        if estado not in (408, 429, 500, 503):
            sys.exit(f"MAL: no se pudo subir el archivo de prueba ({estado}).")
        print(f"  Backblaze ocupado ({estado}); otro intento ({intento}/5)…")
        time.sleep(2 * intento)
    else:
        sys.exit("MAL: Backblaze sigue ocupado tras 5 intentos. Prueba otra vez en un rato.")
    print(f"Sube: sí ({nombre}).")

    estado, _ = pedir(f"{api}/b2_delete_file_version", {"Authorization": token},
                      json.dumps({"fileName": nombre, "fileId": archivo["fileId"]}).encode())
    if estado == 200:
        sys.exit("MAL: ¡la llave PUEDE BORRAR! Hay que rehacerla con menos permisos.")
    print(f"Borra: no (Backblaze dice {estado}). Bien.")
    print("La llave está bien.")


if __name__ == "__main__":
    main()
