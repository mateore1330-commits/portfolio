#!/usr/bin/env node
// Antes de cada build de la web: trae la última instantánea de la API y la guarda en
// apps/web/src/content/snapshot.json, que es la que se incrusta en el bundle.
//
// NUNCA hace fallar el build. Si no hay API configurada, no contesta o contesta algo
// raro, avisa y se queda la instantánea que ya está en el repo. Esa es la regla del
// proyecto: la web se ve entera aunque la API esté caída.
//
// Uso: CONTENT_API_URL=https://api.ejemplo.com node scripts/congelar-contenido.mjs
// Sin dependencias: Node 24 ya trae fetch.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const DESTINO = fileURLToPath(new URL('../apps/web/src/content/snapshot.json', import.meta.url))
const ESPERA_MAXIMA_MS = 5000
const VERSION = 1
const SECCIONES = ['site_texts', 'links', 'technologies', 'projects', 'jobs', 'education']

const aviso = (mensaje) => console.warn(`⚠️  congelar-contenido: ${mensaje}`)

function esInstantaneaValida(datos) {
  return (
    datos !== null &&
    typeof datos === 'object' &&
    datos.version === VERSION &&
    SECCIONES.every((s) => s in datos)
  )
}

async function main() {
  const base = process.env.CONTENT_API_URL
  if (!base) {
    aviso('sin API configurada (CONTENT_API_URL): se usa la instantánea del repo.')
    return
  }

  let datos
  let etag
  try {
    const respuesta = await fetch(new URL('/api/content', base), {
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    })
    if (!respuesta.ok) {
      aviso(`la API contestó ${respuesta.status}: se usa la instantánea del repo.`)
      return
    }
    datos = await respuesta.json()
    etag = respuesta.headers.get('etag')
  } catch (error) {
    const motivo = error.name === 'TimeoutError' ? `no contestó en ${ESPERA_MAXIMA_MS / 1000} s` : error.message
    aviso(`no se pudo leer la API (${motivo}): se usa la instantánea del repo.`)
    return
  }

  if (!esInstantaneaValida(datos)) {
    aviso('la API devolvió algo que no es una instantánea válida: se ignora y se usa la del repo.')
    return
  }

  // El ETag va dentro de la foto: la web se lo enseña a la API (If-None-Match) y, si
  // no ha cambiado, recibe un 304 en vez de la foto entera. Es el que calculó la API:
  // no se recalcula aquí, porque podría no coincidir byte a byte.
  const conEtag = etag ? { etag, ...datos } : datos
  const nuevo = `${JSON.stringify(conEtag, null, 2)}\n`
  const actual = await readFile(DESTINO, 'utf8').catch(() => '')
  if (nuevo === actual) {
    console.log('congelar-contenido: la instantánea del repo ya es la última.')
    return
  }
  await writeFile(DESTINO, nuevo)
  console.log(`congelar-contenido: instantánea actualizada (${(nuevo.length / 1024).toFixed(1)} KB).`)
}

// Pase lo que pase, el build sigue.
main().catch((error) => aviso(`error inesperado (${error.message}): se usa la instantánea del repo.`))
