import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// Raíl lateral con el porcentaje leído. Escribe directamente en el DOM una vez por
// fotograma, como la maqueta: con un estado de React, la página entera se volvería a
// pintar en cada píxel de scroll. Es decorativo, así que va oculto a los lectores de pantalla.
export default function ProgressRail() {
  const linea = useRef(null)
  const numero = useRef(null)
  const { pathname } = useLocation()

  useEffect(() => {
    let pendiente = false
    const pintar = () => {
      pendiente = false
      const maximo = document.documentElement.scrollHeight - window.innerHeight
      const p = maximo > 0 ? Math.min(window.scrollY / maximo, 1) : 0
      linea.current.style.height = `${(p * 100).toFixed(2)}%`
      numero.current.textContent = String(Math.round(p * 100)).padStart(2, '0')
    }
    const programar = () => {
      if (!pendiente) {
        pendiente = true
        requestAnimationFrame(pintar)
      }
    }
    pintar()
    window.addEventListener('scroll', programar, { passive: true })
    window.addEventListener('resize', programar)
    // Si el contenido cambia de alto (por ejemplo, al llegar la foto nueva de la API).
    const tamano = new ResizeObserver(programar)
    tamano.observe(document.body)
    return () => {
      window.removeEventListener('scroll', programar)
      window.removeEventListener('resize', programar)
      tamano.disconnect()
    }
  }, [pathname])

  return (
    <aside className="rail" aria-hidden="true">
      <span className="rail-mark">MR</span>
      <div className="rail-track">
        <div className="rail-fill" ref={linea} />
      </div>
      <span className="rail-pct" ref={numero}>00</span>
    </aside>
  )
}
