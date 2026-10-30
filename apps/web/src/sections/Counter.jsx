import { useLayoutEffect, useRef } from 'react'
import { formatoNumero } from '@/i18n/idiomas.js'
import { useLang } from '@/i18n/useLang.js'
import { alAparecer } from '@/sections/alAparecer.js'

const DURACION = 1400 // ms, como en la maqueta

// Un número que cuenta desde 0 hasta su valor al entrar en pantalla, una sola vez.
// - En reposo muestra el valor final: si ya se ve al cargar la página, no salta a 0.
// - Con movimiento reducido, o si el valor no es un entero ("B2"), no cuenta.
// - El número que cambia es solo visual: el lector de pantalla lee el valor final.
// - Se escribe directamente en el DOM en cada fotograma, sin estado: React no vuelve a
//   pintar nada mientras cuenta. Por eso el <span> no tiene hijos de React.
export default function Counter({ valor }) {
  const ref = useRef(null)
  const lang = useLang()
  const fin = Number(valor)
  const entero = Number.isInteger(fin)
  const formato = formatoNumero(lang)
  // Con el separador de miles de cada idioma: "1,160" en inglés y "1160" en español.
  const texto = entero ? formato.format(fin) : String(valor)

  // useLayoutEffect: el número se escribe antes del primer pintado, nunca se ve vacío.
  useLayoutEffect(() => {
    const el = ref.current
    el.textContent = texto
    if (!entero) return undefined

    let fotograma
    const dejarDeEsperar = alAparecer(el, () => {
      let inicio = null
      const paso = (ahora) => {
        inicio ??= ahora
        const p = Math.min((ahora - inicio) / DURACION, 1)
        el.textContent = formato.format(Math.round(fin * (1 - (1 - p) ** 3)))
        if (p < 1) fotograma = requestAnimationFrame(paso)
      }
      fotograma = requestAnimationFrame(paso)
    })
    if (!dejarDeEsperar) return undefined

    el.textContent = formato.format(0)
    return () => {
      dejarDeEsperar()
      cancelAnimationFrame(fotograma)
      el.textContent = texto
    }
  }, [texto, fin, entero, formato])

  return (
    <>
      <span ref={ref} aria-hidden="true" />
      <span className="solo-lector">{texto}</span>
    </>
  )
}
