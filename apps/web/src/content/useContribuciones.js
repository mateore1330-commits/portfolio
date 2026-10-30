import { useContext } from 'react'
import { ContribucionesContext } from '@/content/ContribucionesContext.js'

// Las contribuciones de GitHub de los últimos 12 meses:
// { total, racha_actual, racha_maxima, media_semanal, semanas, actualizado }.
// Las mismas para el gráfico de Actividad y para la cifra de Sobre mí. Siempre hay datos
// desde el primer render (la copia incrustada en el build).
export function useContribuciones() {
  return useContext(ContribucionesContext)
}
