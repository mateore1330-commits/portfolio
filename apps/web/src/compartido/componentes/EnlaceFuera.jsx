import { useT } from '@/idioma/useIdioma.js'

// Un enlace que se abre en otra pestaña, y lo dice al lector de pantalla.
export default function EnlaceFuera({ href, className, children, onClick }) {
  const t = useT()
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {children} <span aria-hidden="true">↗</span>
      <span className="solo-lector"> {t('enlace.nueva_pestana')}</span>
    </a>
  )
}
