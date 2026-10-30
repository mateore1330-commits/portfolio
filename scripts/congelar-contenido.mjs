#!/usr/bin/env node
// Antes de cada build de la web: trae de la API las dos copias que se incrustan en el
// bundle y las guarda en apps/web/src/content/:
//   - snapshot.json: la última instantánea del contenido publicado.
//   - contribuciones.json: el gráfico de contribuciones de GitHub.
//
// NUNCA hace fallar el build. Si no hay API configurada, no contesta o contesta algo
// raro, avisa y se queda la copia que ya está en el repo. Esa es la regla del
// proyecto: la web se ve entera aunque la API esté caída.
//
// Uso: CONTENT_API_URL=https://api.ejemplo.com node scripts/congelar-contenido.mjs
// Sin dependencias: Node 24 ya trae fetch.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const CONTENIDO = fileURLToPath(new URL('../apps/web/src/content/snapshot.json', import.meta.url))
const CONTRIBUCIONES = fileURLToPath(new URL('../apps/web/src/content/contribuciones.json', import.meta.url))
const ESPERA_MAXIMA_MS = 5000
const VERSION = 1
const SECCIONES = ['site_texts', 'links', 'technologies', 'projects', 'jobs', 'education']
const SEMANAS = 53

const aviso = (mensaje) => console.warn(`⚠️  congelar-contenido: ${mensaje}`)

function esInstantaneaValida(datos) {
  return (
    datos !== null &&
    typeof datos === 'object' &&
    datos.version === VERSION &&
    SECCIONES.every((s) => s in datos)
  )
}

function sonContribucionesValidas(datos) {
  return (
    datos !== null &&
    typeof datos === 'object' &&
    Number.isInteger(datos.total) &&
    Array.isArray(datos.semanas) &&
    datos.semanas.length === SEMANAS &&
    datos.semanas.every((semana) => Array.isArray(semana) && semana.length === 7)
  )
}

// La respuesta de la API ({ datos, etag }), o null (con su aviso) si algo falla.
async function leer(base, ruta, que) {
  try {
    const respuesta = await fetch(new URL(ruta, base), {
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    })
    if (!respuesta.ok) {
      aviso(`la API contestó ${respuesta.status} (${que}): se usa la copia del repo.`)
      return null
    }
    return { datos: await respuesta.json(), etag: respuesta.headers.get('etag') }
  } catch (error) {
    const motivo = error.name === 'TimeoutError' ? `no contestó en ${ESPERA_MAXIMA_MS / 1000} s` : error.message
    aviso(`no se pudo leer la API (${que}: ${motivo}): se usa la copia del repo.`)
    return null
  }
}

// Escribe el archivo solo si ha cambiado: así git no ve cambios que no lo son.
async function guardar(destino, datos, que) {
  const nuevo = `${JSON.stringify(datos, null, 2)}\n`
  const actual = await readFile(destino, 'utf8').catch(() => '')
  if (nuevo === actual) {
    console.log(`congelar-contenido: ${que}: la copia del repo ya es la última.`)
    return
  }
  await writeFile(destino, nuevo)
  console.log(`congelar-contenido: ${que}: copia actualizada (${(nuevo.length / 1024).toFixed(1)} KB).`)
}

async function congelarContenido(base) {
  const leido = await leer(base, '/api/content', 'contenido')
  if (!leido) return
  if (!esInstantaneaValida(leido.datos)) {
    aviso('la API devolvió algo que no es una instantánea válida: se ignora y se usa la del repo.')
    return
  }
  // El ETag va dentro de la foto: la web se lo enseña a la API (If-None-Match) y, si
  // no ha cambiado, recibe un 304 en vez de la foto entera. Es el que calculó la API:
  // no se recalcula aquí, porque podría no coincidir byte a byte.
  const { datos, etag } = leido
  await guardar(CONTENIDO, etag ? { etag, ...datos } : datos, 'contenido')
}

async function congelarContribuciones(base) {
  const leido = await leer(base, '/api/contributions', 'contribuciones')
  if (!leido) return
  if (!sonContribucionesValidas(leido.datos)) {
    aviso('la API devolvió unas contribuciones con forma rara: se ignoran y se usa la copia del repo.')
    return
  }
  await guardar(CONTRIBUCIONES, leido.datos, 'contribuciones')
}

async function main() {
  const base = process.env.CONTENT_API_URL
  if (!base) {
    aviso('sin API configurada (CONTENT_API_URL): se usan las copias del repo.')
    return
  }
  await congelarContenido(base)
  await congelarContribuciones(base)
}

// Pase lo que pase, el build sigue.
main().catch((error) => aviso(`error inesperado (${error.message}): se usan las copias del repo.`))
