import { useEffect, useRef } from 'react'
import { ordenProyectos } from '@/content/proyectos.js'
import { useContent } from '@/content/useContent.js'
import ProjectCard from '@/sections/ProjectCard.jsx'
import SectionHead from '@/sections/SectionHead.jsx'
import '@/sections/projects.css'

// La pila solo en escritorio y sin movimiento reducido (igual que en projects.css).
const CON_PILA = '(min-width: 901px) and (prefers-reduced-motion: no-preference)'
const ENCOGIDO = 0.06 // como mucho, un 6 % más pequeña
const OSCURECIDO = 0.35 // y un 35 % más oscura

// Las tarjetas se quedan pegadas arriba (sticky, en el CSS) y la siguiente tapa a la
// anterior, que se encoge y se oscurece según cuánto la tapa. Se escribe en el DOM una vez
// por fotograma, sin estado: React no repinta nada al hacer scroll.
function usePila(ref) {
  useEffect(() => {
    const media = window.matchMedia(CON_PILA)
    let pendiente = false

    const tarjetas = () => [...ref.current.children]
    const limpiar = () =>
      tarjetas().forEach((el) => {
        el.style.transform = ''
        el.style.filter = ''
      })
    const pintar = () => {
      pendiente = false
      const lista = tarjetas()
      lista.forEach((el, i) => {
        const siguiente = lista[i + 1]
        if (!siguiente) return
        const caja = el.getBoundingClientRect()
        const tapado = Math.min(Math.max((caja.bottom - siguiente.getBoundingClientRect().top) / caja.height, 0), 1)
        el.style.transform = tapado ? `scale(${1 - tapado * ENCOGIDO})` : ''
        el.style.filter = tapado ? `brightness(${1 - tapado * OSCURECIDO})` : ''
      })
    }
    const programar = () => {
      if (!pendiente) {
        pendiente = true
        requestAnimationFrame(pintar)
      }
    }
    const activar = () => {
      window.removeEventListener('scroll', programar)
      window.removeEventListener('resize', programar)
      limpiar()
      if (!media.matches) return
      window.addEventListener('scroll', programar, { passive: true })
      window.addEventListener('resize', programar)
      pintar()
    }

    activar()
    media.addEventListener('change', activar)
    return () => {
      media.removeEventListener('change', activar)
      window.removeEventListener('scroll', programar)
      window.removeEventListener('resize', programar)
    }
  }, [ref])
}

export default function Projects() {
  const { projects } = useContent()
  const pila = useRef(null)
  usePila(pila)

  const orden = ordenProyectos(projects)

  return (
    <section id="proyectos" className="seccion projects">
      <SectionHead id="proyectos" />
      <div className="stack" ref={pila} data-revelar="">
        {orden.map((proyecto, i) => (
          <ProjectCard key={proyecto.slug} proyecto={proyecto} numero={i + 1} />
        ))}
      </div>
    </section>
  )
}
