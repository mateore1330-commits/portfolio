import { Link } from 'react-router'
import { useContenido } from '@/contenido/useContenido.js'
import { rutaEn } from '@/idioma/idiomas.js'
import { useIdioma, useElegir, useT } from '@/idioma/useIdioma.js'

// El pie, en todas las páginas y en una línea: los derechos (con el año en curso, que se
// pone solo) a la izquierda, la autoría (del contenido) en el centro y los enlaces
// legales a la derecha. Las páginas de Aviso legal y Privacidad llegan con WEB-12.
export default function Pie() {
  const t = useT()
  const p = useElegir()
  const lang = useIdioma()
  const { site_texts: textos } = useContenido()

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
