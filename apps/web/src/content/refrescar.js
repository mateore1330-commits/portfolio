// Pregunta a la API si hay una foto del contenido más reciente que la incrustada.
// NUNCA lanza un error: cualquier fallo acaba en un console.info y en null, y la
// web sigue con su foto. Es la regla del proyecto: se ve entera aunque la API caiga.

const API = import.meta.env.VITE_API_URL
const ESPERA_MAXIMA_MS = 5000
const VERSION = 1
const SECCIONES = ['site_texts', 'links', 'technologies', 'projects', 'jobs', 'education']

const informar = (motivo) =>
  console.info(`[contenido] Se mantiene el contenido incrustado: ${motivo}.`)

export function esFotoValida(datos) {
  return (
    datos !== null &&
    typeof datos === 'object' &&
    datos.version === VERSION &&
    SECCIONES.every((s) => s in datos)
  )
}

// Devuelve la foto nueva, o null si no hay nada que cambiar.
export async function refrescar(etagActual, senal) {
  // Sin dirección de la API (por ejemplo, en Vercel hasta que exista el VPS) no se pregunta.
  if (!API) return null

  try {
    const respuesta = await fetch(new URL('/api/content', API), {
      // La comparación la hace este código con el ETag. Con la caché del navegador de por
      // medio, un 304 llegaría convertido en 200 y no se sabría si ha cambiado.
      cache: 'no-store',
      headers: etagActual ? { 'If-None-Match': etagActual } : {},
      signal: AbortSignal.any([senal, AbortSignal.timeout(ESPERA_MAXIMA_MS)]),
    })
    if (respuesta.status === 304) return null
    if (!respuesta.ok) {
      informar(`la API contestó ${respuesta.status}`)
      return null
    }
    const datos = await respuesta.json()
    if (!esFotoValida(datos)) {
      informar('la API devolvió algo que no es una foto válida')
      return null
    }
    const etag = respuesta.headers.get('etag')
    return etag ? { etag, ...datos } : datos
  } catch (error) {
    // Si se canceló porque el componente se desmontó, no hay nada que contar.
    if (senal.aborted) return null
    informar(error.name === 'TimeoutError' ? `no contestó en ${ESPERA_MAXIMA_MS / 1000} s` : error.message)
    return null
  }
}
