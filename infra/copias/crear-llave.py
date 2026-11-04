"""Crea la llave de Backblaze del servidor con solo los permisos justos (INFRA-05). En tu Mac:

    python3 infra/copias/crear-llave.py

La web de Backblaze no deja elegir permisos sueltos ("Write Only" incluye borrar y cambiar las
reglas de caducidad), así que se pide por su API con la llave maestra de la cuenta:
  - solo el bucket mateo-portfolio-copias;
  - solo listBuckets, listFiles y writeFiles: ve su bucket, ve nombres de archivos y sube.
    No puede borrar ni tocar las reglas del bucket.

Te pide la llave maestra sin que se vea y te enseña la nueva UNA vez, aquí en tu terminal, para
que la guardes en Bitwarden. Nada se guarda en disco. Solo la biblioteca estándar.
"""

import base64
import getpass
import json
import sys
import urllib.error
import urllib.request

BUCKET = "mateo-portfolio-copias"
NOMBRE = "portfolio-servidor"
PERMISOS = ["listBuckets", "listFiles", "writeFiles"]


def pedir(url, cabeceras, datos=None):
    req = urllib.request.Request(url, data=json.dumps(datos).encode() if datos is not None else None,
                                 headers=cabeceras, method="POST" if datos is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main():
    print("La llave MAESTRA (Backblaze → Application Keys → Master Application Key).")
    cuenta = input("keyID de la maestra: ").strip()
    maestra = getpass.getpass("applicationKey de la maestra (no se ve al escribir): ").strip()
    basica = base64.b64encode(f"{cuenta}:{maestra}".encode()).decode()
    estado, auth = pedir("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {"Authorization": f"Basic {basica}"})
    del maestra, basica
    if estado != 200:
        sys.exit(f"Backblaze no acepta esa llave ({estado} {auth.get('code')}). ¿Bien copiada?")
    api, token = auth["apiUrl"] + "/b2api/v2", auth["authorizationToken"]

    estado, d = pedir(f"{api}/b2_list_buckets", {"Authorization": token},
                      {"accountId": auth["accountId"], "bucketName": BUCKET})
    buckets = d.get("buckets") or []
    if estado != 200 or not buckets:
        sys.exit(f"No encuentro el bucket {BUCKET} ({estado}).")

    estado, llave = pedir(f"{api}/b2_create_key", {"Authorization": token}, {
        "accountId": auth["accountId"],
        "keyName": NOMBRE,
        "capabilities": PERMISOS,
        "bucketId": buckets[0]["bucketId"],
    })
    if estado != 200:
        sys.exit(f"No se pudo crear la llave ({estado} {llave.get('code')}: {llave.get('message')}).")

    print()
    print(f"Llave '{NOMBRE}' creada: solo {BUCKET}, solo {', '.join(PERMISOS)}.")
    print("Guárdala YA en Bitwarden (\"Backblaze · llave del servidor\"): no se vuelve a enseñar.")
    print()
    print(f"  keyID:          {llave['applicationKeyId']}")
    print(f"  applicationKey: {llave['applicationKey']}")
    print()
    print("Cuando la tengas guardada, cierra o limpia esta terminal (Cmd + K).")


if __name__ == "__main__":
    main()
