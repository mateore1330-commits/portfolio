import { useContent } from '@/content/useContent.js'
import { usePick, useT } from '@/i18n/useLang.js'

// El pie, en todas las páginas: las líneas del contenido (la autoría) y los derechos,
// con el año en curso, que se pone solo.
export default function Footer() {
  const t = useT()
  const p = usePick()
  const { site_texts: textos } = useContent()

  return (
    <footer className="pie mono">
      {p(textos['pie.texto']).map((linea) => (
        <span key={linea}>{linea}</span>
      ))}
      <span>{t('pie.derechos').replace('{anio}', new Date().getFullYear())}</span>
    </footer>
  )
}
