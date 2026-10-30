import { useContent } from '@/content/useContent.js'
import { usePick, useT } from '@/i18n/useLang.js'

// El pie, en todas las páginas: autoría y lugar (del contenido) y los derechos, con el
// año en curso, que se pone solo.
export default function Footer() {
  const t = useT()
  const p = usePick()
  const { site_texts: textos } = useContent()
  const [autoria, lugar] = p(textos['pie.texto'])

  return (
    <footer className="pie mono">
      <span>{autoria}</span>
      <span>{lugar}</span>
      <span>{t('pie.derechos').replace('{anio}', new Date().getFullYear())}</span>
    </footer>
  )
}
