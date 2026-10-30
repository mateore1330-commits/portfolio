import { useLayoutEffect, useRef } from 'react'

const DURACION = 1400 // ms, como en la maqueta

// Un número que cuenta desde 0 hasta su valor al entrar en pantalla, una sola vez.
// - En reposo muestra el valor final: si ya se ve al cargar la página, no salta a 0.
// - Con movimiento reducido, o si el valor no es un entero ("B2"), no cuenta.
// - El número que cambia es solo visual: el lector de pantalla lee el valor final.
// - Se escribe directamente en el DOM en cada fotograma, sin estado: React no vuelve a
//   pintar nada mientras cuenta. Por eso el <span> no tiene hijos de React.
export default function Counter({ valor }) {
  const ref = useRef(null)
  const texto = String(valor)

  // useLayoutEffect: el número se escribe antes del primer pintado, nunca se ve vacío.
  useLayoutEffect(() => {
    const el = ref.current
    el.textContent = texto
    const fin = Number(texto)
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const caja = el.getBoundingClientRect()
    const yaSeVe = caja.top < window.innerHeight && caja.bottom > 0
    if (!Number.isInteger(fin) || reducido || yaSeVe) return undefined

    el.textContent = '0'
    let fotograma
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return
        observador.disconnect()
        let inicio = null
        const paso = (ahora) => {
          inicio ??= ahora
          const p = Math.min((ahora - inicio) / DURACION, 1)
          el.textContent = String(Math.round(fin * (1 - (1 - p) ** 3)))
          if (p < 1) fotograma = requestAnimationFrame(paso)
        }
        fotograma = requestAnimationFrame(paso)
      },
      { threshold: 0.5 },
    )
    observador.observe(el)
    return () => {
      observador.disconnect()
      cancelAnimationFrame(fotograma)
      el.textContent = texto
    }
  }, [texto])

  return (
    <>
      <span ref={ref} aria-hidden="true" />
      <span className="solo-lector">{texto}</span>
    </>
  )
}
