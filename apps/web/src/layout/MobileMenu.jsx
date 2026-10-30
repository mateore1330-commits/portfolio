import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import LanguageSwitch from '@/i18n/LanguageSwitch.jsx'
import { useLang, useT } from '@/i18n/useLang.js'
import { enlaceSeccion, SECCIONES } from '@/layout/secciones.js'
import ThemeToggle from '@/layout/ThemeToggle.jsx'

// Hasta aquí el menú de secciones no cabe en la cabecera (igual que en layout.css).
const MOVIL = '(max-width: 1199px)'

// Botón "Menú" (móvil y tableta) y panel a pantalla completa con las secciones.
// Accesible: el foco entra al abrir, no se escapa con Tab, Escape cierra y el foco
// vuelve al botón. Mientras está abierto, la página de debajo no se mueve.
export default function MobileMenu({ activa }) {
  const [abierto, setAbierto] = useState(false)
  const lang = useLang()
  const t = useT()
  const boton = useRef(null)
  const panel = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const botonMenu = boton.current
    const raiz = document.documentElement
    raiz.style.overflow = 'hidden'
    panel.current.querySelector('a, button')?.focus()

    // Si se ensancha la ventana hasta escritorio con el panel abierto, se cierra.
    const media = matchMedia(MOVIL)
    const alCambiar = () => !media.matches && setAbierto(false)
    media.addEventListener('change', alCambiar)

    return () => {
      raiz.style.overflow = ''
      media.removeEventListener('change', alCambiar)
      botonMenu?.focus()
    }
  }, [abierto])

  const alPulsarTecla = (e) => {
    if (e.key === 'Escape') {
      setAbierto(false)
      return
    }
    if (e.key !== 'Tab') return
    const enfocables = [...panel.current.querySelectorAll('a, button')]
    const primero = enfocables[0]
    const ultimo = enfocables[enfocables.length - 1]
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  // Se cierra el panel (y se desbloquea el scroll) antes de ir a la sección: con el
  // scroll bloqueado, el navegador no podría bajar hasta ella.
  const irA = (e) => {
    e.preventDefault()
    const destino = e.currentTarget.getAttribute('href')
    setAbierto(false)
    requestAnimationFrame(() => window.location.assign(destino))
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        className="menu-boton tmode"
        aria-expanded={abierto}
        aria-controls="menu-movil"
        onClick={() => setAbierto(true)}
      >
        {t('menu.abrir')}
      </button>

      {abierto &&
        createPortal(
          <div
            id="menu-movil"
            ref={panel}
            className="menu-movil"
            role="dialog"
            aria-modal="true"
            aria-label={t('menu.etiqueta')}
            onKeyDown={alPulsarTecla}
          >
            <button type="button" className="tmode menu-cerrar" onClick={() => setAbierto(false)}>
              {t('menu.cerrar')}
            </button>
            <nav aria-label={t('nav.etiqueta')}>
              {SECCIONES.map((s, i) => (
                <a
                  key={s.id}
                  href={enlaceSeccion(lang, s.id)}
                  aria-current={activa === s.id ? 'location' : undefined}
                  onClick={irA}
                >
                  <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                  {t(s.clave)}
                </a>
              ))}
            </nav>
            {/* En móvil no caben en la cabecera: viven aquí. */}
            <div className="menu-movil-ajustes">
              <LanguageSwitch />
              <ThemeToggle />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
