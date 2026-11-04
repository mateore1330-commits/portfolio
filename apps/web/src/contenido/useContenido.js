import { useContext } from 'react'
import { ContextoContenido } from '@/contenido/ContextoContenido.js'

// El contenido publicado: { site_texts, links, technologies, projects, jobs, education }.
// Siempre tiene datos desde el primer render: nunca hay que comprobar si "ya ha cargado".
export function useContenido() {
  const contenido = useContext(ContextoContenido)
  if (!contenido) throw new Error('useContenido necesita estar dentro de <ProveedorContenido>')
  return contenido
}
