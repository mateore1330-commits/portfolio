import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

const UMBRAL_CABECERA = 40 // px, como en la maqueta

// true en cuanto se baja más de 40 px. Solo cambia al cruzar el umbral: React no
// vuelve a pintar la cabecera en cada píxel de scroll.
export function useCabeceraPegada() {
  const [pegada, setPegada] = useState(() => window.scrollY > UMBRAL_CABECERA)

  useEffect(() => {
    let pendiente = false
    const medir = () => {
      pendiente = false
      setPegada(window.scrollY > UMBRAL_CABECERA)
    }
    const alHacerScroll = () => {
      if (!pendiente) {
        pendiente = true
        requestAnimationFrame(medir)
      }
    }
    window.addEventListener('scroll', alHacerScroll, { passive: true })
    return () => window.removeEventListener('scroll', alHacerScroll)
  }, [])

  return pegada
}

// El id de la sección que cruza una franja estrecha a media pantalla, o null si
// ninguna la cruza (por ejemplo, arriba del todo o en la 404).
export function useSeccionActiva(ids) {
  // Se guarda junto a la ruta en la que se midió: al cambiar de página, la sección
  // anterior deja de valer sola, sin tener que borrarla dentro del efecto.
  const [medida, setMedida] = useState({ pathname: null, id: null })
  const { pathname } = useLocation()
  const clave = ids.join(',')

  useEffect(() => {
    const elementos = clave.split(',').map((id) => document.getElementById(id)).filter(Boolean)
    if (elementos.length === 0) return undefined

    const visibles = new Set()
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) visibles.add(e.target.id)
          else visibles.delete(e.target.id)
        }
        // Si dos cruzan a la vez (el borde entre ambas), gana la que va antes en la página.
        setMedida({ pathname, id: elementos.find((el) => visibles.has(el.id))?.id ?? null })
      },
      { rootMargin: '-45% 0px -54% 0px' },
    )
    elementos.forEach((el) => observador.observe(el))
    return () => observador.disconnect()
  }, [clave, pathname])

  return medida.pathname === pathname ? medida.id : null
}
