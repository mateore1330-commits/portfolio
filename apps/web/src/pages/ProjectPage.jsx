import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import Marcado from '@/content/Marcado.jsx'
import { ordenProyectos, portadaDe, porcentaje, rutaProyecto } from '@/content/proyectos.js'
import { useContent } from '@/content/useContent.js'
import { useNombreTecnologia } from '@/content/useNombreTecnologia.js'
import { ponerDescripcion, ponerTitulo } from '@/i18n/documento.js'
import { useLang, usePick, useT } from '@/i18n/useLang.js'
import { enlaceSeccion } from '@/layout/secciones.js'
import NotFound from '@/pages/NotFound.jsx'
import EnlaceFuera from '@/sections/EnlaceFuera.jsx'
import Portada from '@/sections/Portada.jsx'
import '@/sections/projects.css'
import '@/pages/project-page.css'

// Para la descripción de la pestaña: el resumen sin las marcas ** y `.
const sinMarcas = (texto) => texto.replace(/\*\*|`/g, '')

// La página de un proyecto: todo su contenido, sacado de la foto incrustada (se ve
// aunque la API esté caída). Un slug que no existe, o un proyecto sin publicar, da la 404.
// La vista previa del panel (ADM-03) le pasa el slug y su propio contenido: así enseña la
// página de verdad, no una copia.
export default function ProjectPage({ slug: slugFijo }) {
  const { slug: slugDeLaRuta } = useParams()
  const slug = slugFijo ?? slugDeLaRuta
  const lang = useLang()
  const t = useT()
  const p = usePick()
  const nombreTec = useNombreTecnologia()
  const { projects } = useContent()

  const orden = ordenProyectos(projects)
  const indice = orden.findIndex((x) => x.slug === slug)
  const proyecto = orden[indice]
  // Desde el último, "Siguiente" vuelve al primero: nunca un callejón sin salida.
  const siguiente = orden.length > 1 ? orden[(indice + 1) % orden.length] : null

  const nombre = proyecto ? p(proyecto.name) : ''
  const resumen = proyecto ? p(proyecto.summary) : ''
  useEffect(() => {
    if (!nombre) return
    ponerTitulo(t('proyecto.titulo').replace('{nombre}', nombre))
    ponerDescripcion(sinMarcas(resumen))
  }, [nombre, resumen, t])

  if (!proyecto) return <NotFound />

  const aportacion = porcentaje(lang, proyecto.commits_share)
  const ficha = [
    proyecto.is_team_project && proyecto.team_size && [t('proyecto.equipo'), t('proyecto.personas').replace('{n}', proyecto.team_size)],
    proyecto.is_team_project && aportacion && [t('proyecto.aportacion'), t('proyecto.aportacion_valor').replace('{pct}', aportacion)],
    [t('proyecto.periodo'), p(proyecto.period)],
  ].filter(Boolean)
  // Solo los bloques con contenido (los individuales no tienen "Mi papel"), numerados en orden.
  const bloques = [
    [t('proyecto.que_es'), p(proyecto.description)],
    [t('proyecto.mi_papel'), p(proyecto.my_role)],
    [t('proyecto.aprendi'), p(proyecto.learning)],
  ].filter(([, parrafos]) => parrafos && parrafos.length > 0)

  const volver = (
    <Link className="volver" to={enlaceSeccion(lang, 'proyectos')}>
      <span aria-hidden="true">←</span> {t('proyecto.volver')}
    </Link>
  )

  return (
    <main id="contenido" tabIndex={-1} className="pagina-proyecto">
      {volver}

      <header className="pp-cab">
        <p className="proj-num">
          {p(proyecto.label)} · {p(proyecto.period)}
        </p>
        <h1>{nombre}</h1>
        <p className="pp-entradilla">
          <Marcado texto={resumen} />
        </p>
        <dl className="pp-ficha">
          {ficha.map(([clave, valor]) => (
            <div key={clave}>
              <dt>{clave}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
        <ul className="proj-tag" aria-label={t('proyectos.tecnologias')}>
          {proyecto.technologies.map((interno) => (
            <li key={interno}>{nombreTec(interno)}</li>
          ))}
        </ul>
        <div className="proj-links">
          {proyecto.demo_url && (
            <EnlaceFuera className="btn" href={proyecto.demo_url}>
              {t('proyectos.demo')}
            </EnlaceFuera>
          )}
          {proyecto.repo_url && (
            <EnlaceFuera className="btn btn--ghost" href={proyecto.repo_url}>
              {t('proyectos.repo')}
            </EnlaceFuera>
          )}
        </div>
      </header>

      <div className="pp-imagen" data-revelar="">
        <Portada imagen={portadaDe(proyecto)} nombre={nombre} ancha />
      </div>

      {bloques.map(([titulo, parrafos], i) => (
        <section key={titulo} className="pp-bloque" data-revelar="">
          <h2>
            {String(i + 1).padStart(2, '0')} · {titulo}
          </h2>
          <div className="pp-cuerpo">
            {parrafos.map((parrafo) => (
              <p key={parrafo}>
                <Marcado texto={parrafo} />
              </p>
            ))}
          </div>
        </section>
      ))}

      <nav className="pp-pie" aria-label={t('proyecto.navegacion')}>
        {volver}
        {siguiente && (
          <Link className="pp-siguiente" to={rutaProyecto(lang, siguiente.slug)}>
            <span>{t('proyecto.siguiente')}</span>
            <b>
              {p(siguiente.name)} <span aria-hidden="true">→</span>
            </b>
          </Link>
        )}
      </nav>
    </main>
  )
}
