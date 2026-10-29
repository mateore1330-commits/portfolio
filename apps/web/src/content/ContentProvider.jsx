import { startTransition, useEffect, useState } from 'react'
import { ContentContext } from '@/content/ContentContext.js'
import { refrescar } from '@/content/refrescar.js'
import incrustado from '@/content/snapshot.json'

// Arranca con la foto incrustada en el bundle: el primer render ya tiene todo el
// contenido, sin esperar a nadie. Después, en segundo plano, pregunta a la API si hay
// una más reciente. Si la hay, la cambia; si no, o si la API falla, no pasa nada.
export default function ContentProvider({ children }) {
  const [contenido, setContenido] = useState(incrustado)

  useEffect(() => {
    const control = new AbortController()
    refrescar(incrustado.etag, control.signal).then((nueva) => {
      // startTransition: React prepara el contenido nuevo sin bloquear la página y lo
      // cambia de una vez, sin parpadeo.
      if (nueva) startTransition(() => setContenido(nueva))
    })
    // Si el componente se desmonta antes de que conteste la API, se cancela la petición.
    return () => control.abort()
  }, [])

  return <ContentContext.Provider value={contenido}>{children}</ContentContext.Provider>
}
