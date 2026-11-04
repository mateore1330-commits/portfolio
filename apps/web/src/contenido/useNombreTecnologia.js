import { useCallback } from 'react'
import { useContenido } from '@/contenido/useContenido.js'
import { useElegir } from '@/idioma/useIdioma.js'

// Los proyectos guardan el nombre interno de cada tecnología ("API REST"); el que se ve
// es su display_name en el idioma de la página ("REST API" en inglés), si lo tiene.
export function useNombreTecnologia() {
  const p = useElegir()
  const { technologies } = useContenido()
  return useCallback(
    (interno) => {
      const tec = technologies.find((x) => x.name === interno)
      return (tec && p(tec.display_name)) || interno
    },
    [technologies, p],
  )
}
