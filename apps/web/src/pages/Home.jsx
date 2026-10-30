import { useContent } from '@/content/useContent.js'
import { usePick, useT } from '@/i18n/useLang.js'
import { SECCIONES } from '@/layout/secciones.js'
import '@/pages/pages.css'
import About from '@/sections/About.jsx'
import Activity from '@/sections/Activity.jsx'
import Hero from '@/sections/Hero.jsx'
import Skills from '@/sections/Skills.jsx'

// PROVISIONAL: bloques de contenido sin diseño, en el orden y con los id de
// SECCIONES (los mismos que usa el menú). Cada issue de sección (WEB-08 a WEB-10)
// sustituye su bloque por la sección de verdad.
export default function Home() {
  const t = useT()
  const p = usePick()
  const { site_texts: textos, projects, jobs } = useContent()

  const bloques = {
    proyectos: projects.map((proyecto) => (
      <article key={proyecto.slug}>
        <h3>{p(proyecto.name)}</h3>
        <p className="mono">{p(proyecto.label)} · {p(proyecto.period)}</p>
        <p>{p(proyecto.summary)}</p>
      </article>
    )),
    trayectoria: jobs.map((empleo) => (
      <article key={`${empleo.company}-${empleo.start_date}`}>
        <h3>{p(empleo.position)}</h3>
        <p className="mono">{empleo.company}</p>
        {p(empleo.description).map((parrafo) => (
          <p key={parrafo}>{parrafo}</p>
        ))}
      </article>
    )),
    contacto: (
      <>
        <p className="titular">{p(textos['contacto.titular'])}</p>
        {p(textos['contacto.texto']).map((parrafo) => (
          <p key={parrafo}>{parrafo}</p>
        ))}
      </>
    ),
  }

  return (
    <main id="contenido" tabIndex={-1}>
      <Hero />
      <About />
      <Activity />
      <Skills />

      <div className="pagina portada-provisional">
        <p className="mono aviso">{t('provisional.aviso')}</p>

        {SECCIONES.filter((s) => !['sobre-mi', 'actividad', 'conocimientos'].includes(s.id)).map((s) => (
          <section key={s.id} id={s.id}>
            <h2>{t(s.clave)}</h2>
            {bloques[s.id] ?? <p className="mono">{t('provisional.pendiente')}</p>}
          </section>
        ))}
      </div>
    </main>
  )
}
