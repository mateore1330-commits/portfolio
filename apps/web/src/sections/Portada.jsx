import { usePick, useT } from '@/i18n/useLang.js'
import '@/sections/portada.css'

// La imagen de un proyecto, con proporción fija: la foto, al cargar, no mueve nada.
// Sin foto (se subirán desde el panel), un hueco con el icono de una cámara.
// La usan la tarjeta (16:11) y la página del proyecto (más ancha).
export default function Portada({ imagen, nombre, ancha = false }) {
  const t = useT()
  const p = usePick()
  const clase = ancha ? 'shot ancha' : 'shot'

  if (!imagen) {
    return (
      <div className={`${clase} vacia`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </svg>
        <span>{t('proyectos.sin_imagen')}</span>
      </div>
    )
  }
  return (
    <div className={clase}>
      <img src={imagen.url} alt={p(imagen.alt) || nombre} loading="lazy" decoding="async" />
    </div>
  )
}
