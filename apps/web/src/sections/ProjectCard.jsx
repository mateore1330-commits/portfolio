import Marcado from '@/content/Marcado.jsx'
import { useContent } from '@/content/useContent.js'
import { useLang, usePick, useT } from '@/i18n/useLang.js'

// El hueco de la imagen, con proporción fija (16:11): la foto, al cargar, no mueve nada.
// Sin foto (de momento ninguna: se subirán desde el panel), el icono de una cámara.
function Portada({ imagen, nombre }) {
  const t = useT()
  const p = usePick()

  if (!imagen) {
    return (
      <div className="shot vacia" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </svg>
        <span>{t('proyectos.sin_imagen')}</span>
      </div>
    )
  }
  return (
    <div className="shot">
      <img src={imagen.url} alt={p(imagen.alt) || nombre} loading="lazy" decoding="async" />
    </div>
  )
}

// Un enlace que se abre en otra pestaña, y lo dice al lector de pantalla.
function EnlaceFuera({ href, className, children }) {
  const t = useT()
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children} <span aria-hidden="true">↗</span>
      <span className="solo-lector"> {t('enlace.nueva_pestana')}</span>
    </a>
  )
}

export default function ProjectCard({ proyecto, numero }) {
  const t = useT()
  const p = usePick()
  const lang = useLang()
  const { technologies } = useContent()

  const nombre = p(proyecto.name)
  // El proyecto guarda los nombres internos ("API REST"); el que se ve, en el idioma de la página.
  const nombreTec = (interno) => {
    const tec = technologies.find((x) => x.name === interno)
    return (tec && p(tec.display_name)) || interno
  }
  const portada = proyecto.media.find((m) => m.is_cover) ?? proyecto.media[0]
  const aportacion =
    proyecto.commits_share != null
      ? new Intl.NumberFormat(lang, { style: 'percent' }).format(proyecto.commits_share / 100)
      : null

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
        </div>
      </div>
      <Portada imagen={portada} nombre={nombre} />
    </article>
  )
}
