import { useContext } from 'react'
import { ContentContext } from '@/content/ContentContext.js'

// El contenido publicado: { site_texts, links, technologies, projects, jobs, education }.
// Siempre tiene datos desde el primer render: nunca hay que comprobar si "ya ha cargado".
export function useContent() {
  const contenido = useContext(ContentContext)
  if (!contenido) throw new Error('useContent necesita estar dentro de <ContentProvider>')
  return contenido
}
