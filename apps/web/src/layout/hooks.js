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

// Altura de la línea de detección: justo debajo de donde queda el título al pulsar un
// enlace del menú (scroll-margin-top de las secciones = --sp-9, 96 px, + un margen).
const LINEA_ACTIVA = 120

// El id de la sección que está bajo la línea de detección, o null arriba del todo
// (en la portada) y en páginas sin secciones, como la 404.
// - Una línea cerca de la cabecera, y no a media pantalla: si no, al pulsar una sección
//   corta se marcaría la siguiente.
// - Al final de la página se marca la última: si no, nunca llegaría a la línea.
// - En el hueco entre dos secciones se mantiene la anterior.
export function useSeccionActiva(ids) {
  // Se guarda junto a la ruta en la que se midió: al cambiar de página, la sección
  // anterior deja de valer sola, sin tener que borrarla dentro del efecto.
  const [medida, setMedida] = useState({ pathname: null, id: null })
  const { pathname } = useLocation()
  const clave = ids.join(',')

  useEffect(() => {
    const lista = clave.split(',')
    // También se observa la portada (#inicio): cuando está bajo la línea, no hay activa.
    const elementos = ['inicio', ...lista].map((id) => document.getElementById(id)).filter(Boolean)
    if (elementos.length === 0) return undefined

    let bajoLaLinea = null
    let publicada
    const alFinal = () =>
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
    // Por encima de la primera sección (lo que hay antes de la portada) no hay activa.
    const antesDeTodo = () => elementos[0].getBoundingClientRect().top > LINEA_ACTIVA
    const publicar = () => {
      let id = bajoLaLinea === 'inicio' ? null : bajoLaLinea
      if (antesDeTodo()) id = null
      if (alFinal()) id = lista[lista.length - 1]
      if (id !== publicada) {
        publicada = id
        setMedida({ pathname, id })
      }
    }

    let observador
    const observar = () => {
      observador?.disconnect()
      // Una franja de 1 px a LINEA_ACTIVA del borde superior.
      const abajo = Math.max(window.innerHeight - LINEA_ACTIVA - 1, 0)
      observador = new IntersectionObserver(
        (entradas) => {
          const cruzando = entradas.filter((e) => e.isIntersecting)
          if (cruzando.length > 0) {
            bajoLaLinea = cruzando[cruzando.length - 1].target.id
            publicar()
          }
        },
        { rootMargin: `-${LINEA_ACTIVA}px 0px -${abajo}px 0px` },
      )
      elementos.forEach((el) => observador.observe(el))
    }
    observar()

    // El observador no sabe cuándo se llega al final de la página: eso se mira al hacer scroll.
    let pendiente = false
    const alHacerScroll = () => {
      if (!pendiente) {
        pendiente = true
        requestAnimationFrame(() => {
          pendiente = false
          publicar()
        })
      }
    }
    window.addEventListener('scroll', alHacerScroll, { passive: true })
    window.addEventListener('resize', observar)
    return () => {
      observador.disconnect()
      window.removeEventListener('scroll', alHacerScroll)
      window.removeEventListener('resize', observar)
    }
  }, [clave, pathname])

  return medida.pathname === pathname ? medida.id : null
}
