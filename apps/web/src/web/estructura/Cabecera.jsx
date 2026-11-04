import { Link } from 'react-router'
import { useContenido } from '@/contenido/useContenido.js'
import SelectorIdioma from '@/idioma/SelectorIdioma.jsx'
import { useIdioma, useElegir, useT } from '@/idioma/useIdioma.js'
import { useCabeceraPegada, useSeccionActiva } from '@/web/estructura/desplazamiento.js'
import MenuMovil from '@/web/estructura/MenuMovil.jsx'
import { enlaceSeccion, SECCIONES } from '@/web/estructura/secciones.js'
import BotonTema from '@/tema/BotonTema.jsx'

const IDS = SECCIONES.map((s) => s.id)

// "Saltar al contenido" lleva el foco (y la vista) al contenido sin pasar por la dirección:
// con un #contenido, React Router lo tomaría por un "Atrás" y devolvería la página arriba.
function saltarAlContenido(e) {
  e.preventDefault()
  document.getElementById('contenido')?.focus()
}

// Cabecera fija de la maqueta: marca, menú de secciones, idioma y tema. A partir de
// 40 px de scroll toma fondo (.stuck). En móvil, el menú pasa a un panel (MenuMovil).
// Los enlaces a secciones son <Link> (#158): si los llevara el navegador, React Router los
// tomaría por un "Atrás" y su ScrollRestoration cortaría la bajada a la sección.
export default function Cabecera() {
  const lang = useIdioma()
  const t = useT()
  const p = useElegir()
  const { site_texts: textos } = useContenido()
  const pegada = useCabeceraPegada()
  const activa = useSeccionActiva(IDS)

  return (
    <>
      <a className="saltar mono" href="#contenido" onClick={saltarAlContenido}>
        {t('saltar')}
      </a>
      <header className={pegada ? 'top stuck' : 'top'}>
        <Link className="brand" to={enlaceSeccion(lang, 'inicio')} aria-label={t('marca.inicio')}>
          <b>{p(textos['hero.nombre'])}</b>
          <span className="mono dim">{t('marca.rol')}</span>
        </Link>

        <nav className="nav mono" aria-label={t('nav.etiqueta')}>
          {SECCIONES.map((s) => (
            <Link
              key={s.id}
              to={enlaceSeccion(lang, s.id)}
              aria-current={activa === s.id ? 'location' : undefined}
            >
              {t(s.clave)}
            </Link>
          ))}
        </nav>

        <div className="top-acciones">
          <SelectorIdioma />
          <BotonTema />
          <MenuMovil activa={activa} />
        </div>
      </header>
    </>
  )
}
