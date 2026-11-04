import { useEffect } from 'react'
import { Link } from 'react-router'
import { ponerTitulo } from '@/idioma/documento.js'
import { rutaEn } from '@/idioma/idiomas.js'
import { useIdioma, useT } from '@/idioma/useIdioma.js'
import '@/web/paginas/paginas.css'

export default function NoEncontrada() {
  const lang = useIdioma()
  const t = useT()

  // Su propio título en la pestaña: "Esta página no existe · Mateo Rodríguez".
  useEffect(() => {
    ponerTitulo(t('proyecto.titulo').replace('{nombre}', t('error.titulo')))
  }, [t])

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
