import { Link } from 'react-router'
import { rutaEn } from '@/i18n/idiomas.js'
import { useLang, useT } from '@/i18n/useLang.js'
import '@/pages/pages.css'

export default function NotFound() {
  const lang = useLang()
  const t = useT()
  return (
    <main id="contenido" tabIndex={-1} className="pagina no-encontrada">
      <p className="mono">404</p>
      <h1>{t('error.titulo')}</h1>
      <p>{t('error.texto')}</p>
      <Link className="btn" to={rutaEn(lang, '/')}>
        {t('error.volver')}
      </Link>
    </main>
  )
}
