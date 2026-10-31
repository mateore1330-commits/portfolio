import { Link, useLocation } from 'react-router'
import { guardarAncla } from '@/i18n/documento.js'
import { guardar, IDIOMAS, rutaEn } from '@/i18n/idiomas.js'
import { useLang, useT } from '@/i18n/useLang.js'

// Cada idioma se nombra en su propio idioma, sea cual sea el de la página. El nombre
// accesible empieza por lo que se ve ("ES, Español"): quien maneja la web con la voz dice
// lo que lee en pantalla.
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
          aria-label={`${destino.toUpperCase()}, ${NOMBRES[destino]}`}
          aria-current={destino === lang ? 'true' : undefined}
          // El scroll al cambiar de idioma lo lleva restaurarAncla (misma sección), no
          // ScrollRestoration (que subiría arriba del todo).
          preventScrollReset
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
