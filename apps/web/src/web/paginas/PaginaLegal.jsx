import { useEffect } from 'react'
import { Link } from 'react-router'
import Marcado from '@/compartido/componentes/Marcado.jsx'
import { useContenido } from '@/contenido/useContenido.js'
import { ponerDescripcion, ponerTitulo } from '@/idioma/documento.js'
import { rutaEn } from '@/idioma/idiomas.js'
import { useIdioma, useElegir, useT } from '@/idioma/useIdioma.js'
import '@/web/secciones/proyectos.css'
import '@/web/paginas/pagina-proyecto.css'

// Aviso legal y Privacidad: el texto sale del contenido (legal.aviso / legal.privacidad),
// así se podrá editar desde el panel. Misma estructura que la página de un proyecto:
// titular, bloques numerados y "Volver al inicio".
export default function PaginaLegal({ clave }) {
  const t = useT()
  const p = useElegir()
  const lang = useIdioma()
  const { site_texts: textos } = useContenido()
  const pagina = p(textos[`legal.${clave}`])
  const titulo = pagina?.titulo ?? ''

  useEffect(() => {
    if (titulo) ponerTitulo(t('proyecto.titulo').replace('{nombre}', titulo))
    ponerDescripcion(t(`legal.descripcion_${clave}`))
  }, [titulo, t, clave])

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
