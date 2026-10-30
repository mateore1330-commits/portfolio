import { startTransition, useEffect, useState } from 'react'
import { ContribucionesContext } from '@/content/ContribucionesContext.js'
import incrustadas from '@/content/contribuciones.json'

const API = import.meta.env.VITE_API_URL
const ESPERA_MAXIMA_MS = 5000
const SEMANAS = 53

function sonValidas(datos) {
  return (
    datos !== null &&
    typeof datos === 'object' &&
    Number.isInteger(datos.total) &&
    Array.isArray(datos.semanas) &&
    datos.semanas.length === SEMANAS &&
    datos.semanas.every((semana) => Array.isArray(semana) && semana.length === 7)
  )
}

// Igual que ContentProvider: arranca con la copia incrustada en el build y, en segundo
// plano, pide a la API la de hoy. Si la API falla, no pasa nada: se queda la copia.
// Va aparte del contenido porque cambia cada día y no depende de "Publicar".
export default function ContribucionesProvider({ children }) {
  const [datos, setDatos] = useState(incrustadas)

  useEffect(() => {
    // Sin dirección de la API (por ejemplo, en Vercel hasta que exista el VPS) no se pregunta.
    if (!API) return undefined
    const control = new AbortController()
    fetch(new URL('/api/contributions', API), {
      signal: AbortSignal.any([control.signal, AbortSignal.timeout(ESPERA_MAXIMA_MS)]),
    })
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`la API contestó ${respuesta.status}`)
        return respuesta.json()
      })
      .then((nuevas) => {
        if (!sonValidas(nuevas)) throw new Error('la API devolvió unas contribuciones con forma rara')
        startTransition(() => setDatos(nuevas))
      })
      .catch((error) => {
        if (control.signal.aborted) return
        const motivo = error.name === 'TimeoutError' ? `no contestó en ${ESPERA_MAXIMA_MS / 1000} s` : error.message
        console.info(`[contribuciones] Se mantiene la copia incrustada: ${motivo}.`)
      })
    return () => control.abort()
  }, [])

  return <ContribucionesContext.Provider value={datos}>{children}</ContribucionesContext.Provider>
}
