import Marcado from '@/content/Marcado.jsx'
import { mesIso, periodo, porFechaDesc } from '@/content/fechas.js'
import { useContent } from '@/content/useContent.js'
import { useLang, usePick, useT } from '@/i18n/useLang.js'
import SectionHead from '@/sections/SectionHead.jsx'
import '@/sections/timeline.css'

// Una fila de la línea de tiempo: fechas · qué y dónde · descripción (y logros).
function Fila({ inicio, fin, titulo, donde, parrafos, logros }) {
  const t = useT()
  const lang = useLang()
  return (
    <li>
      <article className="row">
        <p className="when">
          <time dateTime={mesIso(inicio)}>{periodo(lang, inicio, fin, t('trayectoria.actualidad'))}</time>
        </p>
        <div className="what">
          <h4>{titulo}</h4>
          {donde && <p className="where">{donde}</p>}
        </div>
        <div className="desc">
          {parrafos.map((parrafo) => (
            <p key={parrafo}>
              <Marcado texto={parrafo} />
            </p>
          ))}
          {logros.length > 0 && (
            <ul>
              {logros.map((logro) => (
                <li key={logro}>
                  <Marcado texto={logro} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </li>
  )
}

const unir = (...partes) => partes.filter(Boolean).join(' · ')

// Experiencia y formación de la base de datos, de lo más reciente a lo más antiguo.
// La API ya da solo lo visible (is_visible).
export default function Timeline() {
  const t = useT()
  const p = usePick()
  const { jobs, education } = useContent()

  return (
    <section id="trayectoria" className="seccion timeline">
      <SectionHead id="trayectoria" />

      <div className="bloque-trayectoria">
        <h3 className="subcabecera">
          {t('trayectoria.experiencia')}
          <span>{t('trayectoria.experiencia_sub')}</span>
        </h3>
        <ol className="filas">
          {porFechaDesc(jobs).map((empleo) => (
            <Fila
              key={`${empleo.company}-${empleo.start_date}`}
              inicio={empleo.start_date}
              fin={empleo.end_date}
              titulo={p(empleo.position)}
              donde={unir(empleo.company, empleo.location)}
              parrafos={p(empleo.description) || []}
              logros={p(empleo.achievements) || []}
            />
          ))}
        </ol>
      </div>

      {education.length > 0 && (
        <div className="bloque-trayectoria">
          <h3 className="subcabecera">{t('trayectoria.formacion')}</h3>
          <ol className="filas">
            {porFechaDesc(education).map((curso) => (
              <Fila
                key={`${p(curso.title)}-${curso.start_date}`}
                inicio={curso.start_date}
                fin={curso.end_date}
                titulo={p(curso.title)}
                donde={unir(curso.institution, curso.location)}
                parrafos={p(curso.description) || []}
                logros={[]}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
