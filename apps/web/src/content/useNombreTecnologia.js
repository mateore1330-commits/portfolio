import { useCallback } from 'react'
import { useContent } from '@/content/useContent.js'
import { usePick } from '@/i18n/useLang.js'

// Los proyectos guardan el nombre interno de cada tecnología ("API REST"); el que se ve
// es su display_name en el idioma de la página ("REST API" en inglés), si lo tiene.
export function useNombreTecnologia() {
  const p = usePick()
  const { technologies } = useContent()
  return useCallback(
    (interno) => {
      const tec = technologies.find((x) => x.name === interno)
      return (tec && p(tec.display_name)) || interno
    },
    [technologies, p],
  )
}
