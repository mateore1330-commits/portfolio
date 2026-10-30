import { Link } from 'react-router'
import Marcado from '@/content/Marcado.jsx'
import { portadaDe, porcentaje, rutaProyecto } from '@/content/proyectos.js'
import { useNombreTecnologia } from '@/content/useNombreTecnologia.js'
import { useLang, usePick, useT } from '@/i18n/useLang.js'
import EnlaceFuera from '@/sections/EnlaceFuera.jsx'
import Portada from '@/sections/Portada.jsx'

export default function ProjectCard({ proyecto, numero }) {
  const t = useT()
  const p = usePick()
  const lang = useLang()
  const nombreTec = useNombreTecnologia()

  const nombre = p(proyecto.name)
  const aportacion = porcentaje(lang, proyecto.commits_share)

  return (
    <article className={proyecto.is_featured ? 'proj destacado' : 'proj'}>
      <div className="proj-texto">
        <p className="proj-num">
          {t('proyectos.numero').replace('{n}', String(numero).padStart(2, '0'))} · {p(proyecto.label)} · {p(proyecto.period)}
        </p>
        <ul className="proj-tag" aria-label={t('proyectos.tecnologias')}>
          {proyecto.technologies.map((interno) => (
            <li key={interno}>{nombreTec(interno)}</li>
          ))}
        </ul>
        <h3>{nombre}</h3>
        <p className="resumen">
          <Marcado texto={p(proyecto.summary)} />
        </p>
        {proyecto.is_team_project && proyecto.team_size && (
          <p className="equipo">
            {aportacion
              ? t('proyectos.equipo').replace('{n}', proyecto.team_size).replace('{pct}', aportacion)
              : t('proyectos.equipo_solo').replace('{n}', proyecto.team_size)}
          </p>
        )}
        {/* Solo los enlaces que existen: un botón que no lleva a nada resta. */}
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
          <Link className="btn btn--azul" to={rutaProyecto(lang, proyecto.slug)}>
            {t('proyectos.completo')} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      <Portada imagen={portadaDe(proyecto)} nombre={nombre} />
    </article>
  )
}
