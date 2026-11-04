import { useRef } from 'react'
import { Link } from 'react-router'
import Marcado from '@/compartido/componentes/Marcado.jsx'
import { portadaDe, porcentaje, rutaProyecto } from '@/contenido/proyectos.js'
import { useNombreTecnologia } from '@/contenido/useNombreTecnologia.js'
import { useIdioma, useElegir, useT } from '@/idioma/useIdioma.js'
import { medir } from '@/compartido/medir.js'
import EnlaceFuera from '@/compartido/componentes/EnlaceFuera.jsx'
import ImagenProyecto from '@/compartido/componentes/ImagenProyecto.jsx'
import { useMagnetico } from '@/compartido/efectos/useMagnetico.js'

export default function TarjetaProyecto({ proyecto, numero }) {
  const t = useT()
  const p = useElegir()
  const lang = useIdioma()
  const nombreTec = useNombreTecnologia()
  const completo = useRef(null)
  useMagnetico(completo)

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
            <EnlaceFuera className="btn" href={proyecto.demo_url} onClick={() => medir('demo-abierta', { proyecto: proyecto.slug, donde: 'portada' })}>
              {t('proyectos.demo')}
            </EnlaceFuera>
          )}
          {proyecto.repo_url && (
            <EnlaceFuera
              className="btn btn--ghost"
              href={proyecto.repo_url}
              onClick={() => medir('repo-abierto', { proyecto: proyecto.slug, donde: 'portada' })}
            >
              {t('proyectos.repo')}
            </EnlaceFuera>
          )}
          <Link ref={completo} className="btn btn--azul" to={rutaProyecto(lang, proyecto.slug)}>
            {t('proyectos.completo')} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      <ImagenProyecto imagen={portadaDe(proyecto)} nombre={nombre} />
    </article>
  )
}
