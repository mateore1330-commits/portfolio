import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router'

const ESCALON = 80 // ms entre bloques de una misma sección, como la maqueta
const MAXIMO = 4 // a partir del quinto bloque, sin más retraso

// Revela al bajar los bloques marcados con data-revelar (una vez, al entrar en pantalla).
// - Lo que ya se ve al cargar no se toca: ni espera ni se anima.
// - Con movimiento reducido, nada.
// - Se hace antes del primer pintado (useLayoutEffect): nunca se ve un salto.
// No pinta nada: es un componente solo para tener el ciclo de vida junto a las páginas.
export default function Revelado() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const esperando = [...document.querySelectorAll('main [data-revelar]')].filter((el) => {
      const caja = el.getBoundingClientRect()
      return caja.top >= window.innerHeight * 0.92
    })
    if (esperando.length === 0) return undefined

    // El escalón, por orden dentro de su sección.
    const porSeccion = new Map()
    for (const el of esperando) {
      const seccion = el.closest('section') ?? document.body
      const orden = porSeccion.get(seccion) ?? 0
      porSeccion.set(seccion, orden + 1)
      el.style.setProperty('--retraso', `${Math.min(orden, MAXIMO) * ESCALON}ms`)
      el.dataset.revelar = 'espera'
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          entrada.target.dataset.revelar = ''
          observador.unobserve(entrada.target)
        }
      },
      // Como la maqueta: un poco antes del borde inferior y con que asome un 8 %.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    esperando.forEach((el) => observador.observe(el))

    return () => {
      observador.disconnect()
      for (const el of esperando) {
        el.dataset.revelar = ''
        el.style.removeProperty('--retraso')
      }
    }
  }, [pathname])

  return null
}
