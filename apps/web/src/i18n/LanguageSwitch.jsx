import { Link, useLocation } from 'react-router'
import { guardarAncla } from '@/i18n/documento.js'
import { guardar, IDIOMAS, rutaEn } from '@/i18n/idiomas.js'
import { useLang, useT } from '@/i18n/useLang.js'

// Cada idioma se nombra en su propio idioma, sea cual sea el de la página.
const NOMBRES = { es: 'Español', en: 'English' }

// Enlaces de verdad, no botones: funcionan sin JavaScript, se pueden abrir en otra
// pestaña y Google los sigue.
export default function LanguageSwitch() {
  const lang = useLang()
  const t = useT()
  const { pathname, search } = useLocation()

  return (
    <nav className="language-switch mono" aria-label={t('idioma.etiqueta')}>
      {IDIOMAS.map((destino) => (
        <Link
          key={destino}
          to={rutaEn(destino, pathname) + search}
          lang={destino}
          hrefLang={destino}
          aria-label={NOMBRES[destino]}
          aria-current={destino === lang ? 'true' : undefined}
          onClick={() => {
            guardar(destino)
            if (destino !== lang) guardarAncla()
          }}
        >
          {destino.toUpperCase()}
        </Link>
      ))}
    </nav>
  )
}
