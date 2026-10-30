import { useT } from '@/i18n/useLang.js'

// Un enlace que se abre en otra pestaña, y lo dice al lector de pantalla.
export default function EnlaceFuera({ href, className, children }) {
  const t = useT()
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children} <span aria-hidden="true">↗</span>
      <span className="solo-lector"> {t('enlace.nueva_pestana')}</span>
    </a>
  )
}
