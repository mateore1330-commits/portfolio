import { useEffect, useRef } from 'react'

// El fondo de la pantalla de entrar, como en la maqueta aprobada (ADM-00): la aurora azul
// que se mueve muy despacio, tu nombre gigante en contorno y una linterna que lo enciende.
// - Con ratón: el cursor de la web (punto + aro que crece sobre lo pulsable y dice qué
//   pasa); la linterna va enganchada al aro, que hace de lente. El botón [data-iman] se
//   acerca al ratón.
// - Sin ratón (móvil) o con "reducir movimiento": solo la aurora, quieta si se pide.
// Escribe en el DOM una vez por fotograma, sin estado de React.
const MAXIMO_IMAN = 12

export default function FondoEntrar({ nombre }) {
  const capa = useRef(null)
  const punto = useRef(null)
  const anillo = useRef(null)
  const etiqueta = useRef(null)

  useEffect(() => {
    const conRaton = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 861px)').matches
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!conRaton || reducido) return undefined

    const raiz = document.documentElement
    let mx = window.innerWidth * 0.68
    let my = window.innerHeight * 0.42
    let rx = mx
    let ry = my
    let fotograma = 0

    const pintar = () => {
      capa.current.style.setProperty('--x', `${rx}px`)
      capa.current.style.setProperty('--y', `${ry}px`)
      anillo.current.style.transform = `translate(${rx}px, ${ry}px)`
    }
    const seguir = () => {
      rx += (mx - rx) * 0.16
      ry += (my - ry) * 0.16
      pintar()
      fotograma = Math.abs(mx - rx) + Math.abs(my - ry) > 0.3 ? requestAnimationFrame(seguir) : 0
    }
    const alMover = (e) => {
      mx = e.clientX
      my = e.clientY
      punto.current.style.transform = `translate(${mx}px, ${my}px)`
      raiz.dataset.cursorVisible = ''
      if (!fotograma) fotograma = requestAnimationFrame(seguir)
    }
    const alEntrar = (e) => {
      const campo = e.target.closest?.('input, textarea, select')
      const pulsable = !campo && e.target.closest?.('a, button, [data-cursor]')
      anillo.current.classList.toggle('ancho', Boolean(pulsable))
      raiz.toggleAttribute('data-cursor-escribiendo', Boolean(campo))
      etiqueta.current.textContent = pulsable ? (pulsable.dataset.cursor ?? 'Ver') : ''
    }
    const alSalir = () => delete raiz.dataset.cursorVisible

    // El imán del botón Entrar (como useMagnetic en la web).
    const iman = document.querySelector('.pantalla-entrar [data-iman]')
    const limitar = (v) => Math.max(-MAXIMO_IMAN, Math.min(MAXIMO_IMAN, v))
    const atraer = (e) => {
      const r = iman.getBoundingClientRect()
      iman.style.transition = 'translate .1s linear'
      iman.style.translate = `${limitar((e.clientX - r.left - r.width / 2) * 0.28)}px ${limitar((e.clientY - r.top - r.height / 2) * 0.4)}px`
    }
    const soltar = () => {
      iman.style.transition = 'translate .55s cubic-bezier(.16, 1, .3, 1)'
      iman.style.translate = ''
    }

    pintar()
    raiz.dataset.cursorPanel = ''
    document.addEventListener('mousemove', alMover, { passive: true })
    document.addEventListener('mouseover', alEntrar, { passive: true })
    raiz.addEventListener('mouseleave', alSalir)
    iman?.addEventListener('mousemove', atraer)
    iman?.addEventListener('mouseleave', soltar)
    return () => {
      cancelAnimationFrame(fotograma)
      document.removeEventListener('mousemove', alMover)
      document.removeEventListener('mouseover', alEntrar)
      raiz.removeEventListener('mouseleave', alSalir)
      iman?.removeEventListener('mousemove', atraer)
      iman?.removeEventListener('mouseleave', soltar)
      delete raiz.dataset.cursorVisible
      delete raiz.dataset.cursorPanel
      raiz.removeAttribute('data-cursor-escribiendo')
    }
  }, [])

  const [primera, ...resto] = nombre.split(' ')
  const lineas = (
    <>
      <span>{primera}</span>
      <span>{resto.join(' ')}</span>
    </>
  )

  return (
    <div aria-hidden="true">
      <div className="entrar-aurora">
        <i />
        <i />
        <i />
      </div>
      <div ref={capa} className="entrar-nombre">
        <p className="contorno">{lineas}</p>
        <p className="luz">{lineas}</p>
      </div>
      <span ref={punto} className="entrar-cursor-punto" />
      <span ref={anillo} className="entrar-cursor-anillo">
        <span className="forma">
          <span ref={etiqueta} className="etiqueta" />
        </span>
      </span>
    </div>
  )
}
