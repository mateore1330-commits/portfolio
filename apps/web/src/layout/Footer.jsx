import { Link } from 'react-router'
import { useContent } from '@/content/useContent.js'
import { rutaEn } from '@/i18n/idiomas.js'
import { useLang, usePick, useT } from '@/i18n/useLang.js'

// El pie, en todas las páginas y en una línea: los derechos (con el año en curso, que se
// pone solo) a la izquierda, la autoría (del contenido) en el centro y los enlaces
// legales a la derecha. Las páginas de Aviso legal y Privacidad llegan con WEB-12.
export default function Footer() {
  const t = useT()
  const p = usePick()
  const lang = useLang()
  const { site_texts: textos } = useContent()

  return (
    <footer className="pie mono">
      <span className="pie-izq">{t('pie.derechos').replace('{anio}', new Date().getFullYear())}</span>
      <span className="pie-centro">{p(textos['pie.texto']).join(' · ')}</span>
      <nav className="pie-der" aria-label={t('pie.legal')}>
        <Link to={rutaEn(lang, '/aviso-legal')}>{t('pie.aviso_legal')}</Link>
        <Link to={rutaEn(lang, '/privacidad')}>{t('pie.privacidad')}</Link>
      </nav>
    </footer>
  )
}
