import { useContent } from '@/content/useContent.js'
import { usePick, useT } from '@/i18n/useLang.js'
import '@/pages/pages.css'

// PROVISIONAL: bloques de contenido sin diseño, para ver los dos idiomas y probar el
// selector en una página larga. Las secciones de verdad llegan con WEB-03 y siguientes.
// Los id de las secciones son iguales en los dos idiomas: el selector los usa.
export default function Home() {
  const t = useT()
  const p = usePick()
  const { site_texts: textos, projects, jobs } = useContent()

  return (
    <main className="pagina portada-provisional">
      <p className="mono aviso">{t('provisional.aviso')}</p>

      <section id="inicio">
        <h1>{p(textos['hero.nombre'])}</h1>
        <p className="entradilla">{p(textos['hero.entradilla'])}</p>
      </section>

      <section id="sobre-mi">
        <h2>{t('seccion.sobre')}</h2>
        <p className="titular">{p(textos['sobre.titular'])}</p>
        {p(textos['sobre.cuerpo']).map((parrafo) => (
          <p key={parrafo}>{parrafo}</p>
        ))}
      </section>

      <section id="proyectos">
        <h2>{t('seccion.proyectos')}</h2>
        {projects.map((proyecto) => (
          <article key={proyecto.slug}>
            <h3>{p(proyecto.name)}</h3>
            <p className="mono">{p(proyecto.label)} · {p(proyecto.period)}</p>
            <p>{p(proyecto.summary)}</p>
          </article>
        ))}
      </section>

      <section id="trayectoria">
        <h2>{t('seccion.trayectoria')}</h2>
        {jobs.map((empleo) => (
          <article key={`${empleo.company}-${empleo.start_date}`}>
            <h3>{p(empleo.position)}</h3>
            <p className="mono">{empleo.company}</p>
            {p(empleo.description).map((parrafo) => (
              <p key={parrafo}>{parrafo}</p>
            ))}
          </article>
        ))}
      </section>
    </main>
  )
}
