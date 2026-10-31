import { useEffect, useRef } from 'react'
import { useT } from '@/i18n/useLang.js'
import '@/layout/cursor.css'

const SEGUIMIENTO = 0.16 // cuánto se acerca el anillo al ratón en cada fotograma
const PULSABLE = 'a, button, [data-cursor]'
const CAMPO = 'input, textarea, select'

// El cursor de la maqueta: un punto azul en el ratón y un anillo que lo sigue con un poco
// de retraso. Sobre lo que se puede pulsar, el anillo crece, se rellena de azul y dice qué
// pasa ("Ver", "Abrir", "Enviar"). El cursor del sistema se queda: el anillo acompaña.
// - Solo con ratón, en pantallas anchas y sin movimiento reducido.
// - Se esconde al escribir en un campo y al salir de la ventana.
// - Se escribe en el DOM una vez por fotograma, sin estado: React no repinta nada; y el
//   bucle se para cuando el anillo alcanza al ratón.
export default function Cursor() {
  const t = useT()
  const punto = useRef(null)
  const anillo = useRef(null)
  const etiqueta = useRef(null)

  useEffect(() => {
    const apto = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 861px)')
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!apto.matches || reducido.matches) return undefined

    const raiz = document.documentElement
    let mx = -100
    let my = -100
    let rx = mx
    let ry = my
    let fotograma = 0

    const seguir = () => {
      rx += (mx - rx) * SEGUIMIENTO
      ry += (my - ry) * SEGUIMIENTO
      anillo.current.style.transform = `translate(${rx}px, ${ry}px)`
      fotograma = Math.abs(mx - rx) + Math.abs(my - ry) > 0.3 ? requestAnimationFrame(seguir) : 0
    }

    // Qué dice el anillo: lo que diga data-cursor o, si no, según lo que sea.
    const textoPara = (el) => {
      if (el.dataset.cursor !== undefined) return el.dataset.cursor
      if (el.matches('a[target="_blank"]')) return t('cursor.abrir')
      if (el.matches('button[type="submit"]')) return t('cursor.enviar')
      if (el.matches('a')) return t('cursor.ver')
      return ''
    }

    const alMover = (e) => {
      mx = e.clientX
      my = e.clientY
      punto.current.style.transform = `translate(${mx}px, ${my}px)`
      raiz.dataset.cursorVisible = ''
      if (!fotograma) fotograma = requestAnimationFrame(seguir)
    }
    const alEntrar = (e) => {
      const campo = e.target.closest?.(CAMPO)
      const pulsable = !campo && e.target.closest?.(PULSABLE)
      anillo.current.classList.toggle('ancho', Boolean(pulsable))
      raiz.toggleAttribute('data-cursor-escribiendo', Boolean(campo))
      etiqueta.current.textContent = pulsable ? textoPara(pulsable) : ''
    }
    const alSalir = () => delete raiz.dataset.cursorVisible

    document.addEventListener('mousemove', alMover, { passive: true })
    document.addEventListener('mouseover', alEntrar, { passive: true })
    document.documentElement.addEventListener('mouseleave', alSalir)
    return () => {
      cancelAnimationFrame(fotograma)
      document.removeEventListener('mousemove', alMover)
      document.removeEventListener('mouseover', alEntrar)
      document.documentElement.removeEventListener('mouseleave', alSalir)
      delete raiz.dataset.cursorVisible
      raiz.removeAttribute('data-cursor-escribiendo')
    }
  }, [t])

  return (
    <div className="cursor" aria-hidden="true">
      <span ref={punto} className="cursor-punto" />
      <span ref={anillo} className="cursor-anillo">
        <span className="cursor-forma">
          <span ref={etiqueta} className="cursor-etiqueta" />
        </span>
      </span>
    </div>
  )
}
