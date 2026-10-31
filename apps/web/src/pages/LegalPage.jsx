import { useEffect } from 'react'
import { Link } from 'react-router'
import Marcado from '@/content/Marcado.jsx'
import { useContent } from '@/content/useContent.js'
import { ponerTitulo } from '@/i18n/documento.js'
import { rutaEn } from '@/i18n/idiomas.js'
import { useLang, usePick, useT } from '@/i18n/useLang.js'
import '@/sections/projects.css'
import '@/pages/project-page.css'

// Aviso legal y Privacidad: el texto sale del contenido (legal.aviso / legal.privacidad),
// así se podrá editar desde el panel. Misma estructura que la página de un proyecto:
// titular, bloques numerados y "Volver al inicio".
export default function LegalPage({ clave }) {
  const t = useT()
  const p = usePick()
  const lang = useLang()
  const { site_texts: textos } = useContent()
  const pagina = p(textos[`legal.${clave}`])
  const titulo = pagina?.titulo ?? ''

  useEffect(() => {
    if (titulo) ponerTitulo(t('proyecto.titulo').replace('{nombre}', titulo))
  }, [titulo, t])

  if (!pagina) return null

  return (
    <main id="contenido" tabIndex={-1} className="pagina-proyecto pagina-legal">
      <Link className="volver" to={rutaEn(lang, '/')}>
        <span aria-hidden="true">←</span> {t('error.volver')}
      </Link>

      <header className="pp-cab">
        <p className="proj-num">
          {t('legal.actualizado')} {p(textos['legal.actualizado'])}
        </p>
        <h1>{titulo}</h1>
      </header>

      {pagina.bloques.map(({ titulo: subtitulo, texto }, i) => (
        <section key={subtitulo} className="pp-bloque" data-revelar="">
          <h2>
            {String(i + 1).padStart(2, '0')} · {subtitulo}
          </h2>
          <div className="pp-cuerpo">
            {texto.map((parrafo) => (
              <p key={parrafo}>
                <Marcado texto={parrafo} />
              </p>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
